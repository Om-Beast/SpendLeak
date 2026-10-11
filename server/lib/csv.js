import { normalizeMerchant } from './merchant.js';

const HEADER_ALIASES = {
  date: ['date', 'transaction date', 'txn date', 'value date', 'posted date', 'booking date'],
  description: ['description', 'details', 'narration', 'merchant', 'transaction details', 'particulars', 'remarks', 'payee', 'name'],
  amount: ['amount', 'transaction amount', 'txn amount', 'value'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'money out', 'paid out'],
  credit: ['credit', 'deposit', 'deposits', 'money in', 'paid in'],
  type: ['type', 'transaction type', 'dr/cr', 'direction'],
  category: ['category', 'expense category', 'spend category']
};

function splitLine(line, delimiter) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim()); current = '';
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(firstLine) {
  const candidates = [',', ';', '\t', '|'];
  return candidates.map((delimiter) => ({ delimiter, count: splitLine(firstLine, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function normalizeHeader(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function findColumn(headers, field) {
  return headers.findIndex((header) => HEADER_ALIASES[field].includes(normalizeHeader(header)));
}

function parseDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  let year, month, day;
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) [, year, month, day] = match;
  if (!match) {
    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (match) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      // This product defaults ambiguous slash dates to Indian DD/MM/YYYY format.
      if (first > 12) [, day, month, year] = match;
      else if (second > 12) [, month, day, year] = match;
      else [, day, month, year] = match;
    }
  }
  if (match) {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)) {
      return date.toISOString().slice(0, 10);
    }
  }
  const fallback = new Date(text);
  if (Number.isNaN(fallback.getTime())) return null;
  return fallback.toISOString().slice(0, 10);
}

function parseMoney(value) {
  let text = String(value ?? '').trim().replace(/[₹$€£,\s]/g, '');
  if (!text || text === '-' || text === '—') return null;
  const parenthesesNegative = text.startsWith('(') && text.endsWith(')');
  text = text.replace(/[()]/g, '').replace(/[^0-9.+-]/g, '');
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  const amount = Math.round(Math.abs(parsed) * 100);
  return { amountMinor: amount, wasNegative: parsed < 0 || parenthesesNegative };
}

export function parseTransactionsCsv(csvText) {
  if (typeof csvText !== 'string' || !csvText.trim()) throw new Error('The CSV file is empty.');
  if (csvText.length > 1_000_000) throw new Error('Please upload a CSV smaller than 1 MB.');
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) throw new Error('Add a header row and at least one transaction.');
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);
  const columns = Object.fromEntries(Object.keys(HEADER_ALIASES).map((field) => [field, findColumn(headers, field)]));
  if (columns.date < 0 || columns.description < 0 || (columns.amount < 0 && columns.debit < 0 && columns.credit < 0)) {
    throw new Error('Required columns not found. Include Date, Description and Amount (or Debit/Credit).');
  }

  const transactions = [];
  const errors = [];
  const maxRows = Math.min(lines.length - 1, 10_000);
  for (let index = 1; index <= maxRows; index += 1) {
    const cells = splitLine(lines[index], delimiter);
    const date = parseDate(cells[columns.date]);
    const description = String(cells[columns.description] ?? '').trim().slice(0, 240);
    const debitText = columns.debit >= 0 ? cells[columns.debit] : '';
    const creditText = columns.credit >= 0 ? cells[columns.credit] : '';
    const debit = parseMoney(debitText);
    const credit = parseMoney(creditText);
    const generic = columns.amount >= 0 ? parseMoney(cells[columns.amount]) : null;
    const type = columns.type >= 0 ? String(cells[columns.type] ?? '').toLowerCase() : '';

    let amount = 0;
    let direction = 'expense';
    if (columns.debit >= 0 || columns.credit >= 0) {
      if (credit?.amountMinor && credit.amountMinor > 0) { amount = credit.amountMinor; direction = 'income'; }
      else if (debit?.amountMinor && debit.amountMinor > 0) { amount = debit.amountMinor; direction = 'expense'; }
    } else if (generic) {
      amount = generic.amountMinor;
      if (/credit|salary|income|deposit|refund|received|cr\b/.test(type)) direction = 'income';
      else if (/debit|expense|withdraw|paid|dr\b/.test(type)) direction = 'expense';
      else direction = generic.wasNegative ? 'expense' : 'expense';
    }

    if (!date || !description || !amount || !Number.isSafeInteger(amount) || amount > 100_000_000_00) {
      errors.push({ row: index + 1, reason: 'Missing date/description or invalid amount.' });
      continue;
    }
    const merchant = normalizeMerchant(description);
    const category = columns.category >= 0 ? (String(cells[columns.category] ?? '').trim().slice(0, 60) || 'Uncategorized') : 'Uncategorized';
    transactions.push({ date, description, merchant, amountMinor: amount, direction, category });
  }

  if (!transactions.length) throw new Error('No valid transactions found. Check the date and amount formats.');
  return { transactions, errors, skippedRows: lines.length - 1 - maxRows, totalRows: lines.length - 1 };
}

export function createSampleCsv() {
  return [
    'Date,Description,Amount,Type,Category',
    '2026-10-02,NETFLIX.COM MONTHLY,649,Debit,Subscriptions',
    '2026-10-03,SWIGGY UPI REF 982771,499,Debit,Food & dining',
    '2026-10-04,SALARY CREDIT,65000,Credit,Income',
    '2026-10-06,SPOTIFY PREMIUM,119,Debit,Subscriptions',
    '2026-10-07,AMAZON PAY ORDER 873413,1299,Debit,Shopping',
    '2026-10-08,GOOGLE ONE STORAGE,130,Debit,Subscriptions',
    '2026-10-09,UBER INDIA TRIP 44920,284,Debit,Transport'
  ].join('\n');
}
