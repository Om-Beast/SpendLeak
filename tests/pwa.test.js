import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPublic = (name) => readFile(path.join(root, 'public', name), 'utf8');
test('PWA manifest declares an installable standalone application and icons', async () => {
 const m = JSON.parse(await readPublic('manifest.webmanifest'));
 assert.equal(m.short_name, 'SpendLeak'); assert.equal(m.display, 'standalone');
 assert.ok(m.icons.some((i) => i.sizes === '192x192')); assert.ok(m.icons.some((i) => i.sizes === '512x512'));
});
test('service worker never caches authenticated API responses', async () => {
 const sw = await readPublic('sw.js');
 assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)\) return/);
 assert.match(sw, /request\.mode === 'navigate'/);
 assert.doesNotMatch(sw, /caches\.put\([^\n]*\/api\//);
});
test('privacy policy, terms and account deletion instructions exist', async () => {
 const privacy = await readPublic('privacy.html'); const deletion = await readPublic('delete-account.html');
 assert.match(privacy, /Optional AI explanations/); assert.match(privacy, /delete-account\.html/);
 assert.match(deletion, /Delete your SpendLeak account/); assert.match(await readPublic('terms.html'), /not a bank/);
});
