import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  db, createUser, findUserByEmail, getPublicUser, saveSession, findSession,
  removeSession, removeExpiredSessions, insertTransactions, listTransactions,
  importTransactionsOnce, saveImport, hasImported, removeTransaction, clearUserData, getPreferences,
  updatePreferences, seedDemoData, listBudgets, saveBudget, removeBudget,
  listAnomalyReviews, saveAnomalyReview, removeAnomalyReview, deleteAccount
} from './database.js';
import { parseTransactionsCsv } from './lib/csv.js';
import { normalizeMerchant } from './lib/merchant.js';
import { buildDashboard } from './lib/analysis.js';
import { hashPassword, verifyPassword, sha256, randomToken, cookieOptions, readCookie, validatePassword } from './lib/security.js';
import { generateInsights, summarizeForAI } from './lib/ai.js';
import { calculateBudgetProgress } from './lib/budget.js';
import { annotateAnomalies } from './lib/reviews.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(HERE, '../public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1_000_000;
const loginAttempts = new Map();
const developmentSecret = randomBytes(32).toString('hex');
const appSecret = process.env.APP_SECRET || developmentSecret;

if (IS_PRODUCTION && !process.env.APP_SECRET) {
  throw new Error('APP_SECRET is required in production. Set a long, random secret in your environment.');
}

function sendJson(response, status, data, extraHeaders = {}) {
  const payload = JSON.stringify(data);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...extraHeaders
  });
  response.end(payload);
}

function setSecurityHeaders(response) {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}

function readBody(request, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

async function readJson(request) {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw Object.assign(new Error('Send a JSON request body.'), { status: 415 });
  }
  const raw = await readBody(request);
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error('Invalid JSON request body.'), { status: 400 }); }
}

function rateLimitKey(request) {
  return request.socket.remoteAddress || 'unknown';
}
function rateLimit(request, limit = 12) {
  const now = Date.now();
  const key = rateLimitKey(request);
  const current = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60_000 };
  if (current.resetAt <= now) { current.count = 0; current.resetAt = now + 15 * 60_000; }
  current.count += 1;
  loginAttempts.set(key, current);
  if (current.count > limit) throw Object.assign(new Error('Too many attempts. Please try again in 15 minutes.'), { status: 429 });
}

function getSession(request) {
  const token = readCookie(request.headers.cookie || '');
  if (!token) return null;
  const user = findSession(sha256(token));
  if (!user) return null;
  return { ...user, tokenHash: sha256(token) };
}

function requireUser(session) {
  if (!session) throw Object.assign(new Error('Please sign in to continue.'), { status: 401 });
  return session;
}

function csvCell(value) {
  let text = String(value ?? '');
  // Prevent spreadsheet programs from evaluating untrusted imported text as a
  // formula when the user opens an export in Excel, Numbers, or Sheets.
  if (/^[\s\uFEFF\u200B]*[=+\-@]/.test(text)) text = "'" + text;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sendCsv(response, content) {
  response.writeHead(200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="spendleak-transactions.csv"',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(content)
  });
  response.end(content);
}

function getSummaryForAI(dashboard) {
  return summarizeForAI(dashboard);
}

function attachAnomalyReviews(userId, dashboard) {
  dashboard.anomalies = annotateAnomalies(dashboard.anomalies, listAnomalyReviews(userId));
  return dashboard;
}

async function handleApi(request, response, url) {
  const method = request.method || 'GET';
  const pathname = url.pathname;
  const session = getSession(request);

  if (method !== 'GET' && method !== 'HEAD') {
    if (request.headers['sec-fetch-site'] === 'cross-site') {
      throw Object.assign(new Error('Cross-site requests are not accepted.'), { status: 403 });
    }
    const origin = request.headers.origin;
    if (origin) {
      const expectedHost = request.headers.host;
      let originHost = '';
      try { originHost = new URL(origin).host; } catch { /* invalid Origin is rejected below */ }
      if (!expectedHost || originHost !== expectedHost) {
        throw Object.assign(new Error('Origin validation failed.'), { status: 403 });
      }
    }
  }

  if (method === 'GET' && pathname === '/api/health') return sendJson(response, 200, { status: 'ok', service: 'spendleak', version: '1.0.0' });
  if (method === 'GET' && pathname === '/api/me') {
    if (!session) return sendJson(response, 200, { user: null });
    return sendJson(response, 200, { user: getPublicUser(session.id) });
  }
  if (method === 'POST' && pathname === '/api/demo') {
    rateLimit(request, 10);
    const id = randomUUID();
    const email = `demo-${id}@demo.spendleak.local`;
    const user = createUser({ id, name: 'Demo Analyst', email, passwordHash: await hashPassword(`${randomUUID()}A1!`), isDemo: true });
    seedDemoData(user.id);
    return createLoginSession(response, user);
  }
  if (method === 'POST' && pathname === '/api/auth/signup') {
    rateLimit(request);
    const body = await readJson(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = body.password;
    if (name.length < 2 || name.length > 70) throw Object.assign(new Error('Name must be 2–70 characters.'), { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
    const passwordError = validatePassword(password);
    if (passwordError) throw Object.assign(new Error(passwordError), { status: 400 });
    if (findUserByEmail(email)) throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
    const user = createUser({ name, email, passwordHash: await hashPassword(password) });
    return createLoginSession(response, user, 201);
  }
  if (method === 'POST' && pathname === '/api/auth/login') {
    rateLimit(request);
    const body = await readJson(request);
    const email = String(body.email || '').trim();
    const password = typeof body.password === 'string' ? body.password : '';
    const user = findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 });
    }
    return createLoginSession(response, user);
  }
  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (session?.tokenHash) {
      // Demo workspaces contain synthetic rows only; remove them completely on logout.
      if (session.is_demo) deleteAccount(session.id);
      else removeSession(session.tokenHash);
    }
    response.setHeader('set-cookie', cookieOptions('', 0, IS_PRODUCTION));
    return sendJson(response, 200, { ok: true });
  }

  requireUser(session);
  if (method === 'GET' && pathname === '/api/dashboard') {
    const transactions = listTransactions(session.id);
    const dashboard = attachAnomalyReviews(session.id, buildDashboard(transactions));
    return sendJson(response, 200, { dashboard, preferences: getPreferences(session.id) });
  }
  if (method === 'GET' && pathname === '/api/transactions') {
    const query = String(url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 100);
    const direction = url.searchParams.get('direction');
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 200)));
    let rows = listTransactions(session.id).reverse();
    if (query) rows = rows.filter((t) => `${t.description} ${t.merchant} ${t.category}`.toLowerCase().includes(query));
    if (direction === 'expense' || direction === 'income') rows = rows.filter((t) => t.direction === direction);
    return sendJson(response, 200, { transactions: rows.slice(0, limit), total: rows.length });
  }
  if (method === 'GET' && pathname === '/api/recurring') {
    return sendJson(response, 200, { recurring: buildDashboard(listTransactions(session.id)).recurring });
  }
  if (method === 'GET' && pathname === '/api/anomalies') {
    const dashboard = attachAnomalyReviews(session.id, buildDashboard(listTransactions(session.id)));
    return sendJson(response, 200, { anomalies: dashboard.anomalies });
  }
  if (method === 'POST' && pathname === '/api/anomaly-reviews') {
    const body = await readJson(request);
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    const status = body.status;
    if (!transactionId || transactionId.length > 100) {
      throw Object.assign(new Error('Invalid transaction id.'), { status: 400 });
    }
    if (!['reviewed', 'dismissed'].includes(status)) {
      throw Object.assign(new Error('Status must be reviewed or dismissed.'), { status: 400 });
    }
    if (!saveAnomalyReview(session.id, transactionId, status)) {
      throw Object.assign(new Error('Transaction was not found in this workspace.'), { status: 404 });
    }
    return sendJson(response, 200, { ok: true, transactionId, status });
  }
  if (method === 'DELETE' && pathname.startsWith('/api/anomaly-reviews/')) {
    const transactionId = decodeURIComponent(pathname.slice('/api/anomaly-reviews/'.length));
    if (!transactionId || transactionId.length > 100) {
      throw Object.assign(new Error('Invalid transaction id.'), { status: 400 });
    }
    removeAnomalyReview(session.id, transactionId);
    return sendJson(response, 200, { ok: true });
  }
  if (method === 'GET' && pathname === '/api/export.csv') {
    const lines = [['Date', 'Description', 'Merchant', 'Amount', 'Direction', 'Category'].join(',')];
    for (const transaction of listTransactions(session.id)) {
      const values = [transaction.date, transaction.description, transaction.merchant, (transaction.amountMinor / 100).toFixed(2), transaction.direction, transaction.category];
      lines.push(values.map(csvCell).join(','));
    }
    return sendCsv(response, `\uFEFF${lines.join('\r\n')}`);
  }
  if (method === 'POST' && pathname === '/api/import') {
    const contentType = String(request.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('text/csv') && !contentType.startsWith('text/plain')) throw Object.assign(new Error('Upload a CSV file.'), { status: 415 });
    const csv = await readBody(request, MAX_BODY_BYTES);
    const parsed = parseTransactionsCsv(csv);
    const fileHash = sha256(csv);
    const exactDuplicates = new Map();
    for (const t of parsed.transactions) {
      const key = `${t.date}|${normalizeMerchant(t.merchant || t.description)}|${t.amountMinor}|${t.direction}`;
      exactDuplicates.set(key, (exactDuplicates.get(key) || 0) + 1);
    }
    let fileName = String(request.headers['x-file-name'] || 'transactions.csv');
    try { fileName = decodeURIComponent(fileName); } catch { /* Keep a malformed filename as a harmless string. */ }
    const importResult = importTransactionsOnce(session.id, fileHash, fileName, parsed.transactions, parsed.transactions.length);
    if (importResult.alreadyImported) return sendJson(response, 200, { ok: true, alreadyImported: true, imported: 0, totalRows: parsed.totalRows, message: 'This exact CSV has already been imported.' });
    return sendJson(response, 201, {
      ok: true, imported: importResult.imported, totalRows: parsed.totalRows,
      invalidRows: parsed.errors.length + parsed.skippedRows,
      errors: parsed.errors.slice(0, 12),
      duplicateCandidates: [...exactDuplicates.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
      message: 'Transactions imported. Review flagged duplicates before taking action.'
    });
  }
  if (method === 'DELETE' && pathname.startsWith('/api/transactions/')) {
    const transactionId = decodeURIComponent(pathname.slice('/api/transactions/'.length));
    if (!transactionId || transactionId.length > 100) throw Object.assign(new Error('Invalid transaction id.'), { status: 400 });
    if (!removeTransaction(session.id, transactionId)) throw Object.assign(new Error('Transaction was not found.'), { status: 404 });
    return sendJson(response, 200, { ok: true });
  }
  if (method === 'DELETE' && pathname === '/api/data') {
    clearUserData(session.id);
    return sendJson(response, 200, { ok: true, message: 'All imported transactions and import history were deleted.' });
  }
  if (method === 'DELETE' && pathname === '/api/account') {
    deleteAccount(session.id);
    response.setHeader('set-cookie', cookieOptions('', 0, IS_PRODUCTION));
    return sendJson(response, 200, { ok: true, message: 'Your account and associated app data were permanently deleted.' });
  }
  if (method === 'GET' && pathname === '/api/budgets') {
    const period = new Date().toISOString().slice(0, 7);
    const budgets = calculateBudgetProgress(listBudgets(session.id), listTransactions(session.id), period);
    return sendJson(response, 200, { budgets, period });
  }
  if (method === 'POST' && pathname === '/api/budgets') {
    const body = await readJson(request);
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const monthlyLimitMinor = Number(body.monthlyLimitMinor);
    if (category.length < 1 || category.length > 48 || /[<>]/.test(category)) {
      throw Object.assign(new Error('Category must be 1–48 characters.'), { status: 400 });
    }
    if (!Number.isSafeInteger(monthlyLimitMinor) || monthlyLimitMinor < 100 || monthlyLimitMinor > 100_000_000_000) {
      throw Object.assign(new Error('Monthly budget must be between ₹1 and ₹1,000,000,000.'), { status: 400 });
    }
    const budget = saveBudget(session.id, category, monthlyLimitMinor);
    return sendJson(response, 200, { budget, message: 'Monthly budget saved.' });
  }
  if (method === 'DELETE' && pathname.startsWith('/api/budgets/')) {
    const budgetId = decodeURIComponent(pathname.slice('/api/budgets/'.length));
    if (!budgetId || budgetId.length > 100) throw Object.assign(new Error('Invalid budget id.'), { status: 400 });
    if (!removeBudget(session.id, budgetId)) throw Object.assign(new Error('Budget was not found.'), { status: 404 });
    return sendJson(response, 200, { ok: true });
  }
  if (method === 'GET' && pathname === '/api/preferences') return sendJson(response, 200, { preferences: getPreferences(session.id) });
  if (method === 'PATCH' && pathname === '/api/preferences') {
    const body = await readJson(request);
    const currency = body.currency === undefined ? getPreferences(session.id).currency : String(body.currency);
    if (!['INR', 'USD', 'EUR', 'GBP'].includes(currency)) throw Object.assign(new Error('Unsupported display currency.'), { status: 400 });
    const remindersEnabled = body.remindersEnabled === undefined ? Boolean(getPreferences(session.id).remindersEnabled) : Boolean(body.remindersEnabled);
    return sendJson(response, 200, { preferences: updatePreferences(session.id, { currency, remindersEnabled }) });
  }
  if (method === 'POST' && pathname === '/api/ai/insights') {
    const dashboard = buildDashboard(listTransactions(session.id));
    const insights = await generateInsights(getSummaryForAI(dashboard));
    return sendJson(response, 200, { insights });
  }
  return sendJson(response, 404, { error: 'API route not found.' });
}

function createLoginSession(response, user, status = 200) {
  const token = randomToken();
  const tokenHash = sha256(token);
  saveSession(tokenHash, user.id, Date.now() + SESSION_TTL_MS);
  response.setHeader('set-cookie', cookieOptions(token, Math.floor(SESSION_TTL_MS / 1000), IS_PRODUCTION));
  return sendJson(response, status, { user: { id: user.id, name: user.name, email: user.email, is_demo: user.is_demo ?? 0 } });
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

async function serveStatic(request, response, url) {
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const resolved = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!resolved.startsWith(`${PUBLIC_DIR}${path.sep}`) && resolved !== path.join(PUBLIC_DIR, 'index.html')) {
    return sendJson(response, 403, { error: 'Invalid file path.' });
  }
  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[path.extname(resolved)] || 'application/octet-stream',
      'content-length': fileStat.size,
      'cache-control': path.extname(resolved) === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    if (request.method === 'HEAD') return response.end();
    createReadStream(resolved).pipe(response);
  } catch {
    return sendJson(response, 404, { error: 'File not found.' });
  }
}

const server = http.createServer(async (request, response) => {
  setSecurityHeaders(response);
  const requestId = randomUUID();
  response.setHeader('x-request-id', requestId);
  const start = Date.now();
  try {
    const host = request.headers.host || 'localhost';
    const url = new URL(request.url || '/', `http://${host}`);
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
    else if (['GET', 'HEAD'].includes(request.method || 'GET')) await serveStatic(request, response, url);
    else sendJson(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) console.error(JSON.stringify({ requestId, message: error.message, elapsedMs: Date.now() - start }));
    if (!response.headersSent) sendJson(response, status, { error: status >= 500 ? 'Something went wrong. Try again.' : error.message, requestId });
    else response.destroy();
  }
});

removeExpiredSessions();
setInterval(removeExpiredSessions, 60 * 60 * 1000).unref();
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts) if (value.resetAt <= now) loginAttempts.delete(key);
}, 15 * 60 * 1000).unref();
server.listen(PORT, HOST, () => console.log(`SpendLeak running at http://localhost:${PORT}`));

function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
