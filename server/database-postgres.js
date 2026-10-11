import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Math.min(20, Math.max(2, Number(process.env.DB_POOL_SIZE || 10))),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});
pool.on('error', (error) => console.error('PostgreSQL idle client error:', error.message));

await pool.query(
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);" +
  "CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, transaction_date TEXT NOT NULL, description TEXT NOT NULL, merchant TEXT NOT NULL, amount_minor BIGINT NOT NULL CHECK(amount_minor > 0), direction TEXT NOT NULL CHECK(direction IN ('expense','income')), category TEXT NOT NULL DEFAULT 'Uncategorized', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);" +
  "CREATE INDEX IF NOT EXISTS idx_transactions_user_merchant ON transactions(user_id, merchant);" +
  "CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, file_hash TEXT NOT NULL, file_name TEXT NOT NULL, row_count INTEGER NOT NULL, imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,file_hash));" +
  "CREATE TABLE IF NOT EXISTS preferences (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, reminders_enabled INTEGER NOT NULL DEFAULT 1, currency TEXT NOT NULL DEFAULT 'INR', updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);"
);

export const db = { close: () => pool.end() };
async function one(sql, values = []) { return (await pool.query(sql, values)).rows[0] || null; }
async function changed(sql, values = []) { return (await pool.query(sql, values)).rowCount; }

export async function createUser({ id = randomUUID(), name, email, passwordHash, isDemo = false }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO users(id,name,email,password_hash,is_demo) VALUES($1,$2,$3,$4,$5)', [id,name,email.trim().toLowerCase(),passwordHash,isDemo ? 1 : 0]);
    await client.query('INSERT INTO preferences(user_id) VALUES($1)', [id]);
    const user = (await client.query('SELECT id,name,email,is_demo FROM users WHERE id=$1', [id])).rows[0];
    await client.query('COMMIT');
    return user;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function findUserByEmail(email) { return one('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [String(email).trim()]); }
export async function getPublicUser(userId) { return one('SELECT id,name,email,is_demo,created_at FROM users WHERE id=$1', [userId]); }
export async function saveSession(tokenHash,userId,expiresAt) { return changed('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [tokenHash,userId,expiresAt]); }
export async function findSession(tokenHash) { return one('SELECT u.id,u.name,u.email,u.is_demo FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2', [tokenHash,Date.now()]); }
export async function removeSession(tokenHash) { return tokenHash ? changed('DELETE FROM sessions WHERE token_hash=$1', [tokenHash]) : 0; }
export async function removeExpiredSessions() { return changed('DELETE FROM sessions WHERE expires_at<=$1', [Date.now()]); }

export async function insertTransactions(userId, rows) {
  if (!rows.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of rows) await client.query('INSERT INTO transactions(id,user_id,transaction_date,description,merchant,amount_minor,direction,category) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(),userId,t.date,t.description,t.merchant,t.amountMinor,t.direction,t.category || 'Uncategorized']);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function listTransactions(userId) {
  const rows = (await pool.query('SELECT id,transaction_date AS date,description,merchant,amount_minor AS "amountMinor",direction,category,created_at AS "createdAt" FROM transactions WHERE user_id=$1 ORDER BY transaction_date ASC,created_at ASC', [userId])).rows;
  return rows.map((row) => ({...row, amountMinor:Number(row.amountMinor)}));
}
export async function saveImport(userId,fileHash,fileName,rowCount) { return changed('INSERT INTO imports(id,user_id,file_hash,file_name,row_count) VALUES($1,$2,$3,$4,$5)', [randomUUID(),userId,fileHash,String(fileName).slice(0,160),rowCount]); }
export async function hasImported(userId,fileHash) { return Boolean(await one('SELECT 1 FROM imports WHERE user_id=$1 AND file_hash=$2', [userId,fileHash])); }
export async function importTransactionsOnce(userId,fileHash,fileName,rows,rowCount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const imported = await client.query('INSERT INTO imports(id,user_id,file_hash,file_name,row_count) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,file_hash) DO NOTHING RETURNING id', [randomUUID(),userId,fileHash,String(fileName).slice(0,160),rowCount]);
    if (!imported.rowCount) { await client.query('ROLLBACK'); return {alreadyImported:true, imported:0}; }
    for (const t of rows) await client.query('INSERT INTO transactions(id,user_id,transaction_date,description,merchant,amount_minor,direction,category) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(),userId,t.date,t.description,t.merchant,t.amountMinor,t.direction,t.category || 'Uncategorized']);
    await client.query('COMMIT');
    return {alreadyImported:false, imported:rows.length};
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function removeTransaction(userId,id) { return (await changed('DELETE FROM transactions WHERE id=$1 AND user_id=$2', [id,userId])) > 0; }
export async function clearUserData(userId) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); await client.query('DELETE FROM transactions WHERE user_id=$1',[userId]); await client.query('DELETE FROM imports WHERE user_id=$1',[userId]); await client.query('COMMIT'); }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function deleteUser(userId) { return (await changed('DELETE FROM users WHERE id=$1', [userId])) > 0; }
export async function getPreferences(userId) { return (await one('SELECT reminders_enabled AS "remindersEnabled",currency FROM preferences WHERE user_id=$1',[userId])) || {remindersEnabled:1,currency:'INR'}; }
export async function updatePreferences(userId,v) {
  await pool.query('INSERT INTO preferences(user_id,reminders_enabled,currency) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET reminders_enabled=EXCLUDED.reminders_enabled,currency=EXCLUDED.currency,updated_at=CURRENT_TIMESTAMP',[userId,v.remindersEnabled?1:0,v.currency||'INR']);
  return getPreferences(userId);
}
function dateForMonth(offset,day) { const n=new Date(); const d=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth()+offset,1)); const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(day,last)); return d.toISOString().slice(0,10); }
export async function seedDemoData(userId) {
  const rows=[]; const utility=[1880,2050,1760,2320,2890], food=[420,620,530,710,490], dining=[350,490,410,560,620], rides=[210,340,185,420,260], shop=[1299,2200,1699,1899,1599], groceries=[1800,2200,1950,2500,2150];
  const add=(o,d,description,amount,direction,category,merchant=description)=>{const date=dateForMonth(o,d);if(o===0&&date>new Date().toISOString().slice(0,10))return;rows.push({date,description,merchant,amountMinor:Math.round(amount*100),direction,category});};
  for(let o=-4;o<=0;o++){add(o,2,'RENT TRANSFER',16000,'expense','Home & bills','Rent');add(o,5,'NETFLIX.COM MONTHLY',649,'expense','Subscriptions','Netflix');add(o,6,'SPOTIFY PREMIUM',119,'expense','Subscriptions','Spotify');add(o,7,'GOOGLE ONE STORAGE',130,'expense','Subscriptions','Google One');add(o,8,'SALARY CREDIT',85000,'income','Income','Salary');add(o,10,'ELECTRICITY BOARD BILL',utility[o+4],'expense','Home & bills','Electricity');add(o,12,'SWIGGY ORDER',food[o+4],'expense','Food & dining','Swiggy');add(o,16,'ZOMATO ORDER',dining[o+4],'expense','Food & dining','Zomato');add(o,18,'UBER INDIA TRIP',rides[o+4],'expense','Transport','Uber');add(o,20,'AMAZON PAY ORDER',shop[o+4],'expense','Shopping','Amazon');add(o,24,'GROCERY STORE',groceries[o+4],'expense','Groceries','Groceries');}
  const today=new Date().toISOString().slice(0,10); rows.push({date:today,description:'UBER INDIA TRIP DEMO',merchant:'Uber',amountMinor:28400,direction:'expense',category:'Transport'},{date:today,description:'UBER INDIA TRIP DEMO',merchant:'Uber',amountMinor:28400,direction:'expense',category:'Transport'});
  return insertTransactions(userId,rows);
}
export async function getTableCounts(userId) { const a=await one('SELECT COUNT(*) AS count FROM transactions WHERE user_id=$1',[userId]); const b=await one('SELECT COUNT(*) AS count FROM imports WHERE user_id=$1',[userId]); return {transactions:Number(a.count),imports:Number(b.count)}; }
