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

const MAX_FILE_CHARS = 1_000_000;
const MAX_ROWS = 10_000;
const MAX_DESCRIPTION_LENGTH = 240;
const MAX_CATEGORY_LENGTH = 60;
const MAX_AMOUNT_MINOR = 100_000_000_00;

/**
 * Parse CSV records rather than splitting on newlines: valid quoted CSV cells
 * can contain commas, quotes, CRLFs, and line breaks.
 */
function parseRecords(text, delimiter) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  let quoteClosed = false;

  const pushField = () => {
    record.push(field.trim());
    field = '';
    quoteClosed = false;
  };
  const pushRecord = () => {
    pushField();
    if (record.some((cell) => cell !== '')) records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        field += char;
      }
      continue;
    }

    if (quoteClosed && char !== delimiter && char !== '\r' && char !== '\n' && char !== ' ' && char !== '\t') {
      throw new Error('Malformed CSV: unexpected characters after a quoted field.');
    }

    if (char === '"') {
      if (field.trim() !== '' || quoteClosed) {
        throw new Error('Malformed CSV: unexpected quote in an unquoted field.');
      }
      field = '';
      quoted = true;
    } else if (char === delimiter) {
      pushField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      pushRecord();
    } else if (!quoteClosed || (char !== ' ' && char !== '\t')) {
      field += char;
    }
  }

  if (quoted) throw new Error('Malformed CSV: a quoted field was not closed.');
  if (field !== '' || record.length > 0 || quoteClosed) pushRecord();
  return records;
}

function detectDelimiter(firstRecord) {
  const candidates = [',', ';', '\t', '|'];
  return candidates
    .map((delimiter) => ({ delimiter, count: parseRecords(firstRecord, delimiter)[0]?.length || 0 }))
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
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|\s)/);
  if (match) [, year, month, day] = match;

  if (!match) {
    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:$|\s)/);
    if (match) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      // Ambiguous slash dates default to Indian DD/MM/YYYY format.
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
    return null;
  }

  const fallback = new Date(text);
  if (Number.isNaN(fallback.getTime())) return null;
  return fallback.toISOString().slice(0, 10);
}

function parseMoney(value) {
  let text = String(value ?? '').trim();
  if (!text || text === '-' || text === '—') return null;

  text = text.replace(/^(?:INR|RS\.?)[ \t]*/i, '');
  text = text.replace(/[₹$€£,\s]/g, '');
  const parenthesesNegative = text.startsWith('(') && text.endsWith(')');
  if (parenthesesNegative) text = text.slice(1, -1);

  // Reject malformed amounts instead of silently stripping arbitrary letters
  // (e.g. "12abc34" must not become a valid amount of 1234).
  if (!/^[+-]?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;

  const amount = Math.round(Math.abs(parsed) * 100);
  return { amountMinor: amount, wasNegative: parsed < 0 || parenthesesNegative };
}

export function parseTransactionsCsv(csvText) {
  if (typeof csvText !== 'string' || !csvText.trim()) throw new Error('The CSV file is empty.');
  if (csvText.length > MAX_FILE_CHARS) throw new Error('Please upload a CSV smaller than 1 MB.');

  const text = csvText.replace(/^\uFEFF/, '');
  const firstRecordEnd = text.search(/[\r\n]/);
  const firstRecordText = firstRecordEnd === -1 ? text : text.slice(0, firstRecordEnd);
  const delimiter = detectDelimiter(firstRecordText);
  const records = parseRecords(text, delimiter);
  if (records.length < 2) throw new Error('Add a header row and at least one transaction.');

  const headers = records[0];
  const columns = Object.fromEntries(Object.keys(HEADER_ALIASES).map((field) => [field, findColumn(headers, field)]));
  if (columns.date < 0 || columns.description < 0 || (columns.amount < 0 && columns.debit < 0 && columns.credit < 0)) {
    throw new Error('Required columns not found. Include Date, Description and Amount (or Debit/Credit).');
  }

  const transactions = [];
  const errors = [];
  const availableRows = records.length - 1;
  const maxRows = Math.min(availableRows, MAX_ROWS);

  for (let index = 1; index <= maxRows; index += 1) {
    const cells = records[index];
    const rowNumber = index + 1;
    const date = parseDate(cells[columns.date]);
    const description = String(cells[columns.description] ?? '').trim().slice(0, MAX_DESCRIPTION_LENGTH);
    const debit = columns.debit >= 0 ? parseMoney(cells[columns.debit]) : null;
    const credit = columns.credit >= 0 ? parseMoney(cells[columns.credit]) : null;
    const generic = columns.amount >= 0 ? parseMoney(cells[columns.amount]) : null;
    const type = columns.type >= 0 ? String(cells[columns.type] ?? '').toLowerCase() : '';

    let amount = 0;
    let direction = 'expense';
    if (columns.debit >= 0 || columns.credit >= 0) {
      if (credit?.amountMinor > 0) {
        amount = credit.amountMinor;
        direction = 'income';
      } else if (debit?.amountMinor > 0) {
        amount = debit.amountMinor;
        direction = 'expense';
      }
    } else if (generic) {
      amount = generic.amountMinor;
      if (/credit|salary|income|deposit|refund|received|cr\b/.test(type)) direction = 'income';
      else direction = 'expense';
    }

    if (!date || !description || !Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT_MINOR) {
      errors.push({ row: rowNumber, reason: 'Missing date/description or invalid amount.' });
      continue;
    }

    const merchant = normalizeMerchant(description);
    const category = columns.category >= 0
      ? (String(cells[columns.category] ?? '').trim().slice(0, MAX_CATEGORY_LENGTH) || 'Uncategorized')
      : 'Uncategorized';
    transactions.push({ date, description, merchant, amountMinor: amount, direction, category });
  }

  if (!transactions.length) throw new Error('No valid transactions found. Check the date and amount formats.');
  return {
    transactions,
    errors,
    skippedRows: availableRows - maxRows,
    totalRows: availableRows
  };
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
