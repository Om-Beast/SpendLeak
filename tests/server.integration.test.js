import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSampleCsv } from '../server/lib/csv.js';

let child;
let baseUrl;
let tempDir;

async function freePort() {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
async function waitForServer() {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch { /* Wait for the child process to bind its port. */ }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error('Integration server did not become ready.');
}
function apiRequest(route, { method = 'GET', body, cookie, headers = {} } = {}) {
  const requestHeaders = { ...headers, origin: baseUrl };
  if (cookie) requestHeaders.cookie = cookie;
  if (body !== undefined && !requestHeaders['content-type']) requestHeaders['content-type'] = 'application/json';
  return fetch(`${baseUrl}${route}`, { method, headers: requestHeaders, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
}
async function signup(name, email) {
  const response = await apiRequest('/api/auth/signup', { method: 'POST', body: { name, email, password: 'GoodPassword123' } });
  const payload = await response.json();
  assert.equal(response.status, 201, JSON.stringify(payload));
  return { user: payload.user, cookie: response.headers.get('set-cookie').split(';')[0] };
}

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'spendleak-test-'));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const serverEntry = fileURLToPath(new URL('../server/index.js', import.meta.url));
  child = spawn(process.execPath, [serverEntry], {
    // npm runs this test with the project root as cwd. Use that known-good
    // working directory and an absolute script path to avoid Windows ENOENT
    // errors caused by URL-derived cwd values.
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: tempDir, NODE_ENV: 'test', APP_SECRET: 'test-secret-at-least-32-characters-long' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  await waitForServer();
});

after(async () => {
  if (child && !child.killed) { child.kill('SIGTERM'); }
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test('health check is public; account data requires a session', async () => {
  const health = await apiRequest('/api/health');
  assert.equal(health.status, 200);
  const dashboard = await apiRequest('/api/dashboard');
  assert.equal(dashboard.status, 401);
});

test('signup creates an account and sets an HttpOnly same-site session cookie', async () => {
  const account = await signup('Test User', 'test-user@example.com');
  assert.match(account.cookie, /^spendleak_session=/);
  assert.match((await apiRequest('/api/me', { cookie: account.cookie })).headers.get('cache-control'), /no-store/);
  const profile = await (await apiRequest('/api/me', { cookie: account.cookie })).json();
  assert.equal(profile.user.email, 'test-user@example.com');
  assert.equal(profile.user.name, 'Test User');
});

test('same CSV is idempotent and rows remain scoped to the account', async () => {
  const first = await signup('Import Owner', 'import-owner@example.com');
  const second = await signup('Other User', 'other-user@example.com');
  const csv = createSampleCsv();
  const headers = { 'content-type': 'text/csv; charset=utf-8', 'x-file-name': 'sample.csv' };
  const response1 = await apiRequest('/api/import', { method: 'POST', cookie: first.cookie, headers, body: csv });
  assert.equal(response1.status, 201);
  const result1 = await response1.json();
  assert.equal(result1.imported, 7);
  const response2 = await apiRequest('/api/import', { method: 'POST', cookie: first.cookie, headers, body: csv });
  assert.equal(response2.status, 200);
  assert.equal((await response2.json()).alreadyImported, true);
  const dashboard1 = await (await apiRequest('/api/dashboard', { cookie: first.cookie })).json();
  const dashboard2 = await (await apiRequest('/api/dashboard', { cookie: second.cookie })).json();
  assert.equal(dashboard1.dashboard.summary.availableTransactions, 7);
  assert.equal(dashboard2.dashboard.summary.availableTransactions, 0);
  const transactions = await (await apiRequest('/api/transactions', { cookie: first.cookie })).json();
  const foreignDelete = await apiRequest(`/api/transactions/${transactions.transactions[0].id}`, { method: 'DELETE', cookie: second.cookie });
  assert.equal(foreignDelete.status, 404);
});

test('origin validation rejects cross-origin mutations', async () => {
  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Evil', email: 'evil@example.com', password: 'GoodPassword123' })
  });
  assert.equal(response.status, 403);
});

test('logout revokes the session server-side', async () => {
  const account = await signup('Logout User', 'logout-user@example.com');
  const logout = await apiRequest('/api/auth/logout', { method: 'POST', body: {}, cookie: account.cookie });
  assert.equal(logout.status, 200);
  const profile = await apiRequest('/api/me', { cookie: account.cookie });
  assert.equal((await profile.json()).user, null);
});
