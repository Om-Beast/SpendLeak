import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, sha256, randomToken, cookieOptions, readCookie, validatePassword, makeFingerprint } from '../server/lib/security.js';

test('password hash verifies only the original password', async () => {
  const hash = await hashPassword('spendleak-test-123');
  assert.equal(await verifyPassword('spendleak-test-123', hash), true);
  assert.equal(await verifyPassword('wrong-password-123', hash), false);
});

test('session token helpers store token hashes and parse cookie safely', () => {
  const token = randomToken();
  assert.ok(token.length >= 40);
  assert.equal(sha256(token).length, 64);
  assert.equal(readCookie(`other=x; spendleak_session=${token}; theme=light`), token);
  assert.equal(readCookie('spendleak_session=%E0%A4%A'), null);
  assert.equal(readCookie('spendleak_session=not-a-session-token'), null);
  assert.match(cookieOptions(token, 300), /HttpOnly; SameSite=Strict; Path=\//);
  assert.match(cookieOptions(token, 300, true), /Secure/);
});

test('password policy requires length, a letter, and a number', () => {
  assert.equal(validatePassword('short1'), 'Password must be between 10 and 128 characters.');
  assert.equal(validatePassword('longpassword'), 'Use at least one letter and one number.');
  assert.equal(validatePassword('longpassword123'), null);
});

test('fingerprints are stable for the same row', () => {
  const row = { date: '2026-10-01', description: 'Netflix', amountMinor: 64900, direction: 'expense' };
  assert.equal(makeFingerprint(row), makeFingerprint({ ...row }));
  assert.notEqual(makeFingerprint(row), makeFingerprint({ ...row, amountMinor: 65000 }));
});
