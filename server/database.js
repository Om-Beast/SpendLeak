import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dataDir = path.resolve(process.env.DATA_DIR || './data');
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const databasePath = path.join(dataDir, 'spendleak.sqlite');
export const db = new DatabaseSync(databasePath);
try { chmodSync(databasePath, 0o600); } catch { /* The file may not exist until the first write. */ }
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_date TEXT NOT NULL,
    description TEXT NOT NULL,
    merchant TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
    direction TEXT NOT NULL CHECK(direction IN ('expense', 'income')),
    category TEXT NOT NULL DEFAULT 'Uncategorized',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS anomaly_reviews (
    transaction_id TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('reviewed', 'dismissed')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_anomaly_reviews_user_status
    ON anomaly_reviews(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_merchant ON transactions(user_id, merchant);
  CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_hash TEXT NOT NULL,
    file_name TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, file_hash)
  );
  CREATE TABLE IF NOT EXISTS preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reminders_enabled INTEGER NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'INR',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 48),
    monthly_limit_minor INTEGER NOT NULL CHECK(monthly_limit_minor > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_category
    ON budgets(user_id, category COLLATE NOCASE);
`);

export function createUser({ id = randomUUID(), name, email, passwordHash, isDemo = false }) {
  db.prepare('INSERT INTO users(id, name, email, password_hash, is_demo) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, email.trim().toLowerCase(), passwordHash, isDemo ? 1 : 0);
  db.prepare('INSERT INTO preferences(user_id) VALUES (?)').run(id);
  return db.prepare('SELECT id, name, email, is_demo FROM users WHERE id = ?').get(id);
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email.trim());
}

export function getPublicUser(userId) {
  return db.prepare('SELECT id, name, email, is_demo, created_at FROM users WHERE id = ?').get(userId) || null;
}

export function saveSession(tokenHash, userId, expiresAt) {
  db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt);
}

export function findSession(tokenHash) {
  return db.prepare(`SELECT u.id, u.name, u.email, u.is_demo FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`)
    .get(tokenHash, Date.now()) || null;
}

export function removeSession(tokenHash) {
  if (tokenHash) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function removeExpiredSessions() {
  const now = Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    // Demo accounts are disposable. Remove their seed data once no active
    // session remains, including after a server restart or expired session.
    db.prepare(`DELETE FROM users
      WHERE is_demo = 1
        AND NOT EXISTS (
          SELECT 1 FROM sessions
          WHERE sessions.user_id = users.id AND sessions.expires_at > ?
        )`).run(now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function insertTransactions(userId, transactions) {
  const insert = db.prepare(`INSERT INTO transactions(id, user_id, transaction_date, description, merchant, amount_minor, direction, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const t of transactions) {
      insert.run(randomUUID(), userId, t.date, t.description, t.merchant, t.amountMinor, t.direction, t.category || 'Uncategorized');
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listTransactions(userId) {
  return db.prepare(`SELECT id, transaction_date AS date, description, merchant, amount_minor AS amountMinor,
      direction, category, created_at AS createdAt FROM transactions WHERE user_id = ? ORDER BY transaction_date ASC, created_at ASC`)
    .all(userId).map((t) => ({ ...t, amountMinor: Number(t.amountMinor) }));
}

export function saveImport(userId, fileHash, fileName, rowCount) {
  db.prepare('INSERT INTO imports(id, user_id, file_hash, file_name, row_count) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, fileHash, fileName.slice(0, 160), rowCount);
}


export function importTransactionsOnce(userId, fileHash, fileName, transactions, rowCount) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT 1 FROM imports WHERE user_id = ? AND file_hash = ?').get(userId, fileHash);
    if (existing) {
      db.exec('ROLLBACK');
      return { alreadyImported: true, imported: 0 };
    }
    const insert = db.prepare(`INSERT INTO transactions(id, user_id, transaction_date, description, merchant, amount_minor, direction, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const t of transactions) {
      insert.run(randomUUID(), userId, t.date, t.description, t.merchant, t.amountMinor, t.direction, t.category || 'Uncategorized');
    }
    db.prepare('INSERT INTO imports(id, user_id, file_hash, file_name, row_count) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), userId, fileHash, fileName.slice(0, 160), rowCount);
    db.exec('COMMIT');
    return { alreadyImported: false, imported: transactions.length };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function hasImported(userId, fileHash) {
  return Boolean(db.prepare('SELECT 1 FROM imports WHERE user_id = ? AND file_hash = ?').get(userId, fileHash));
}

export function removeTransaction(userId, transactionId) {
  return db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(transactionId, userId).changes > 0;
}

export function clearUserData(userId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM imports WHERE user_id = ?').run(userId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getPreferences(userId) {
  return db.prepare('SELECT reminders_enabled AS remindersEnabled, currency FROM preferences WHERE user_id = ?').get(userId) || { remindersEnabled: 1, currency: 'INR' };
}

export function updatePreferences(userId, values) {
  db.prepare(`INSERT INTO preferences(user_id, reminders_enabled, currency) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET reminders_enabled = excluded.reminders_enabled, currency = excluded.currency, updated_at = CURRENT_TIMESTAMP`)
    .run(userId, values.remindersEnabled ? 1 : 0, values.currency || 'INR');
  return getPreferences(userId);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function relativeMonth(offset, day = 8) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return isoDate(date);
}

export function seedDemoData(userId) {
  const rows = [];
  const currentDay = new Date().getUTCDate();
  const add = (monthOffset, day, description, amount, direction, category, merchant = description) => {
    // A demo ledger should not show future-dated charges as already incurred.
    if (monthOffset === 0 && day > currentDay) return;
    rows.push({ date: relativeMonth(monthOffset, day), description, merchant, amountMinor: Math.round(amount * 100), direction, category });
  };

  for (let offset = -4; offset <= 0; offset += 1) {
    add(offset, 2, 'RENT TRANSFER', 16000, 'expense', 'Home & bills', 'Rent');
    add(offset, 5, 'NETFLIX.COM MONTHLY', 649, 'expense', 'Subscriptions', 'Netflix');
    add(offset, 6, 'SPOTIFY PREMIUM', 119, 'expense', 'Subscriptions', 'Spotify');
    add(offset, 7, 'GOOGLE ONE STORAGE', 130, 'expense', 'Subscriptions', 'Google One');
    add(offset, 8, 'SALARY CREDIT', 85000, 'income', 'Income', 'Salary');
    add(offset, 10, 'ELECTRICITY BOARD BILL', [1880, 2050, 1760, 2320, 2890][offset + 4], 'expense', 'Home & bills', 'Electricity');
    add(offset, 12, 'SWIGGY ORDER', [420, 620, 530, 710, 490][offset + 4], 'expense', 'Food & dining', 'Swiggy');
    add(offset, 16, 'ZOMATO ORDER', [350, 490, 410, 560, 620][offset + 4], 'expense', 'Food & dining', 'Zomato');
    add(offset, 18, 'UBER INDIA TRIP', [210, 340, 185, 420, 260][offset + 4], 'expense', 'Transport', 'Uber');
    add(offset, 20, 'AMAZON PAY ORDER', [1299, 2200, 1699, 1899, 1599][offset + 4], 'expense', 'Shopping', 'Amazon');
    add(offset, 24, 'GROCERY STORE', [1800, 2200, 1950, 2500, 2150][offset + 4], 'expense', 'Groceries', 'Groceries');
  }
  // A deliberately obvious, explainable outlier for demonstrating anomaly detection.
  add(0, 9, 'AMAZON PAY ELECTRONICS ORDER', 11999, 'expense', 'Shopping', 'Amazon');
  const today = new Date();
  const date = isoDate(today);
  rows.push({ date, description: 'UBER INDIA TRIP 48391', merchant: 'Uber', amountMinor: 28_400, direction: 'expense', category: 'Transport' });
  rows.push({ date, description: 'UBER INDIA TRIP 48391', merchant: 'Uber', amountMinor: 28_400, direction: 'expense', category: 'Transport' });
  // Keep demo history bounded and use the same transaction insertion path as imports.
  insertTransactions(userId, rows);
}

export function getTableCounts(userId) {
  return {
    transactions: Number(db.prepare('SELECT COUNT(*) AS count FROM transactions WHERE user_id = ?').get(userId).count),
    imports: Number(db.prepare('SELECT COUNT(*) AS count FROM imports WHERE user_id = ?').get(userId).count)
  };
}


export function listBudgets(userId) {
  return db.prepare(`SELECT id, category, monthly_limit_minor AS monthlyLimitMinor,
      created_at AS createdAt, updated_at AS updatedAt
    FROM budgets WHERE user_id = ? ORDER BY category COLLATE NOCASE ASC`)
    .all(userId)
    .map((row) => ({ ...row, monthlyLimitMinor: Number(row.monthlyLimitMinor) }));
}

export function saveBudget(userId, category, monthlyLimitMinor) {
  // SQLite writes are synchronous here; the check-and-write remains in one
  // transaction so concurrent requests cannot create duplicate category budgets.
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT id FROM budgets WHERE user_id = ? AND category = ? COLLATE NOCASE')
      .get(userId, category);
    if (existing) {
      db.prepare(`UPDATE budgets SET category = ?, monthly_limit_minor = ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
        .run(category, monthlyLimitMinor, existing.id, userId);
    } else {
      db.prepare(`INSERT INTO budgets(id, user_id, category, monthly_limit_minor)
        VALUES (?, ?, ?, ?)`)
        .run(randomUUID(), userId, category, monthlyLimitMinor);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return listBudgets(userId).find((item) => item.category.toLowerCase() === category.toLowerCase()) || null;
}

export function removeBudget(userId, budgetId) {
  return db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(budgetId, userId).changes > 0;
}


export function listAnomalyReviews(userId) {
  return db.prepare(`SELECT transaction_id AS transactionId, status,
      updated_at AS updatedAt
    FROM anomaly_reviews WHERE user_id = ?`)
    .all(userId);
}

export function saveAnomalyReview(userId, transactionId, status) {
  if (!['reviewed', 'dismissed'].includes(status)) return false;
  const owned = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?')
    .get(transactionId, userId);
  if (!owned) return false;
  db.prepare(`INSERT INTO anomaly_reviews(transaction_id, user_id, status)
    VALUES (?, ?, ?)
    ON CONFLICT(transaction_id) DO UPDATE SET
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
    WHERE anomaly_reviews.user_id = excluded.user_id`)
    .run(transactionId, userId, status);
  return true;
}

export function removeAnomalyReview(userId, transactionId) {
  return db.prepare('DELETE FROM anomaly_reviews WHERE user_id = ? AND transaction_id = ?')
    .run(userId, transactionId).changes > 0;
}


/**
 * Permanently delete a user account. Foreign-key cascades remove the account's
 * sessions, imported transactions, import history, preferences, budgets, and
 * any review feedback associated with those transactions.
 */
export function deleteAccount(userId) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(userId).changes > 0;
}
