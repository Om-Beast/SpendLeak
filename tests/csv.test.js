import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTransactionsCsv, createSampleCsv } from '../server/lib/csv.js';

test('parses sample CSV with expenses, income, and merchant cleanup', () => {
  const result = parseTransactionsCsv(createSampleCsv());
  assert.equal(result.transactions.length, 7);
  assert.equal(result.errors.length, 0);
  assert.equal(result.transactions[0].merchant, 'Netflix');
  assert.equal(result.transactions[2].direction, 'income');
  assert.equal(result.transactions[0].amountMinor, 64900);
});

test('supports quoted commas and escaped quotes in descriptions', () => {
  const result = parseTransactionsCsv('Date,Description,Amount,Type,Category\n2026-09-10,"CAFE, ""NORTH""",250,Debit,"Food, dining"');
  assert.equal(result.transactions[0].description, 'CAFE, "NORTH"');
  assert.equal(result.transactions[0].category, 'Food, dining');
});

test('supports multiline quoted fields and keeps them in one record', () => {
  const result = parseTransactionsCsv('Date,Description,Amount\r\n2026-09-10,"CAFE NORTH\r\nBRANCH 2",250');
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].description, 'CAFE NORTH\r\nBRANCH 2');
  assert.equal(result.totalRows, 1);
});

test('supports semicolon-delimited and tab-delimited files', () => {
  const semicolon = parseTransactionsCsv('Date;Description;Amount\n2026-09-10;Cafe;250');
  const tab = parseTransactionsCsv('Date\tDescription\tAmount\n2026-09-10\tCafe\t250');
  assert.equal(semicolon.transactions[0].amountMinor, 25000);
  assert.equal(tab.transactions[0].merchant, 'Cafe');
});

test('supports separate debit and credit columns', () => {
  const result = parseTransactionsCsv('Date,Narration,Debit,Credit\n2026-09-01,Salary,,50000\n2026-09-02,Groceries,1250,');
  assert.equal(result.transactions[0].direction, 'income');
  assert.equal(result.transactions[0].amountMinor, 5_000_000);
  assert.equal(result.transactions[1].direction, 'expense');
  assert.equal(result.transactions[1].amountMinor, 125_000);
});

test('skips malformed rows and reports why', () => {
  const result = parseTransactionsCsv('Date,Description,Amount\nnot-a-date,Shop,22\n2026-09-03,Valid Shop,20');
  assert.equal(result.transactions.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].row, 2);
});

test('rejects empty files and unsupported headers', () => {
  assert.throws(() => parseTransactionsCsv('  '), /empty/i);
  assert.throws(() => parseTransactionsCsv('Name,Age\nRavi,22'), /Required columns/i);
});

test('ambiguous slash dates default to DD/MM/YYYY', () => {
  const result = parseTransactionsCsv('Date,Description,Amount\n05/10/2026,Shop,20');
  assert.equal(result.transactions[0].date, '2026-10-05');
});

test('rejects malformed money instead of coercing it into a different amount', () => {
  const result = parseTransactionsCsv('Date,Description,Amount\n2026-09-10,Shop,12abc34\n2026-09-11,Cafe,"₹1,234.50"');
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].amountMinor, 123450);
  assert.equal(result.errors.length, 1);
});

test('rejects unmatched quotes instead of persisting corrupt rows', () => {
  assert.throws(() => parseTransactionsCsv('Date,Description,Amount\n2026-09-10,"Shop,20'), /quoted field was not closed/i);
});

test('rejects files above the documented import limit', () => {
  assert.throws(() => parseTransactionsCsv('x'.repeat(1_000_001)), /smaller than 1 MB/i);
});
