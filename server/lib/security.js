import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function keyedHash(value, secret) {
  return createHmac('sha256', secret).update(String(value)).digest('hex');
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(key).toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, salt, storedHex] = String(encoded).split(':');
  if (algorithm !== 'scrypt' || !salt || !storedHex) return false;
  const actual = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(storedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function randomToken() {
  return randomBytes(32).toString('base64url');
}

export function cookieOptions(token, maxAge, isProduction = false) {
  return `spendleak_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`;
}

export function readCookie(cookieHeader = '', name = 'spendleak_session') {
  const part = cookieHeader.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  if (!part) return null;
  try { return decodeURIComponent(part.slice(name.length + 1)); } catch { return null; }
}

export function makeFingerprint(transaction) {
  const source = [transaction.date, transaction.description.trim().toLowerCase(), transaction.amountMinor, transaction.direction].join('|');
  return sha256(source);
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return 'Password must be between 10 and 128 characters.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use at least one letter and one number.';
  return null;
}

export function signData(data, secret) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
