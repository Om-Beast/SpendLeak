/**
 * Merchant normalization is deliberately rule-based: it's predictable, cheap,
 * and easy to explain. Add aliases here as new statement formats are observed.
 */
const ALIASES = new Map([
  ['AMAZON', 'Amazon'], ['AMAZON PAY', 'Amazon'], ['AMZN', 'Amazon'],
  ['NETFLIX', 'Netflix'], ['SPOTIFY', 'Spotify'], ['GOOGLE ONE', 'Google One'],
  ['GOOGLE STORAGE', 'Google One'], ['YOUTUBE PREMIUM', 'YouTube Premium'],
  ['SWIGGY', 'Swiggy'], ['ZOMATO', 'Zomato'], ['UBER', 'Uber'],
  ['OLA', 'Ola'], ['JIO', 'Jio'], ['AIRTEL', 'Airtel'],
  ['HOTSTAR', 'Disney+ Hotstar'], ['DISNEY HOTSTAR', 'Disney+ Hotstar'],
  ['APPLE', 'Apple'], ['APPLE COM BILL', 'Apple'], ['CLOUDWAYS', 'Cloudways'],
  ['ELECTRICITY BOARD', 'Electricity'], ['BESCOM', 'Electricity'],
  ['RENT', 'Rent'], ['SALARY', 'Salary'], ['STARBUCKS', 'Starbucks'],
  ['DMART', 'DMart'], ['BIG BASKET', 'BigBasket'], ['BIGBASKET', 'BigBasket']
]);

const IGNORE_TOKENS = new Set([
  'UPI', 'POS', 'NEFT', 'IMPS', 'RTGS', 'NACH', 'ACH', 'REF', 'REFNO', 'REFNUM',
  'TXN', 'TRANSACTION', 'PAYMENT', 'PURCHASE', 'DEBIT', 'CREDIT', 'CARD', 'NO',
  'ID', 'ONLINE', 'INDIA', 'PVT', 'LTD', 'LIMITED', 'IN', 'ON', 'THE'
]);

export function normalizeMerchant(value = '') {
  let normalized = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(?:UPI|POS|NEFT|IMPS|RTGS|NACH|ACH)[\s\-/]*/g, ' ')
    .replace(/\b(?:REF(?:ERENCE)?|TXN|TRANSACTION|UTR|RRN|AUTH|TERMINAL)[\s:#-]*[A-Z0-9-]+/g, ' ')
    .replace(/[0-9]{4,}/g, ' ')
    .replace(/[^A-Z0-9& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return 'Unknown merchant';
  for (const [alias, canonical] of ALIASES) {
    if (normalized === alias || normalized.startsWith(`${alias} `) || normalized.includes(` ${alias} `)) {
      return canonical;
    }
  }

  const tokens = normalized.split(' ').filter((token) => !IGNORE_TOKENS.has(token) && !/^\d+$/.test(token));
  const result = tokens.slice(0, 4).join(' ').trim();
  if (!result) return 'Unknown merchant';
  return result.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
