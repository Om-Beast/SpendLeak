import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard, classifyCadence, detectAnomalies, detectRecurring } from '../server/lib/analysis.js';

const tx = (id, date, merchant, amount, category = 'Subscriptions', direction = 'expense') => ({
  id, date, merchant, description: merchant, amountMinor: amount * 100, category, direction
});

test('classifyCadence maps common repeat intervals conservatively', () => {
  assert.equal(classifyCadence([29, 31, 30]).cadence, 'Monthly');
  assert.equal(classifyCadence([7, 7, 6]).cadence, 'Weekly');
  assert.equal(classifyCadence([20, 70]), null);
});

test('recurring detection estimates monthly dates and labels confidence', () => {
  const rows = [
    tx('a', '2026-07-05', 'NETFLIX', 649),
    tx('b', '2026-08-05', 'NETFLIX', 649),
    tx('c', '2026-09-05', 'NETFLIX', 649),
    tx('d', '2026-10-05', 'NETFLIX', 699)
  ];
  const recurring = detectRecurring(rows, '2026-10-11');
  assert.equal(recurring.length, 1);
  assert.equal(recurring[0].merchant, 'Netflix');
  assert.equal(recurring[0].cadence, 'Monthly');
  assert.equal(recurring[0].confidence, 'Likely');
  assert.equal(recurring[0].increased, false, '₹50 increase should not cross the absolute increase threshold');
  assert.equal(recurring[0].nextDate, '2026-11-04');
});


test('regularly spaced variable food spending is not automatically a recurring bill', () => {
  const rows = [
    tx('a', '2026-06-12', 'Swiggy', 420, 'Food & dining'),
    tx('b', '2026-07-12', 'Swiggy', 620, 'Food & dining'),
    tx('c', '2026-08-12', 'Swiggy', 530, 'Food & dining'),
    tx('d', '2026-09-12', 'Swiggy', 710, 'Food & dining'),
    tx('e', '2026-10-10', 'Swiggy', 490, 'Food & dining')
  ];
  assert.equal(detectRecurring(rows, '2026-10-11').length, 0);
});

test('anomaly detection flags exact duplicate candidates without deleting data', () => {
  const rows = [tx('a', '2026-10-10', 'Uber', 284), tx('b', '2026-10-10', 'Uber', 284)];
  const anomalies = detectAnomalies(rows);
  assert.equal(anomalies.length, 2);
  assert.ok(anomalies.every((item) => item.type === 'possible_duplicate'));
});

test('anomaly detection uses prior merchant history for high charges', () => {
  const rows = [
    tx('a', '2026-05-20', 'Amazon', 1299, 'Shopping'),
    tx('b', '2026-06-20', 'Amazon', 2200, 'Shopping'),
    tx('c', '2026-07-20', 'Amazon', 1699, 'Shopping'),
    tx('d', '2026-08-20', 'Amazon', 1899, 'Shopping'),
    tx('e', '2026-09-20', 'Amazon', 1599, 'Shopping'),
    tx('f', '2026-10-09', 'Amazon', 11999, 'Shopping')
  ];
  const anomalies = detectAnomalies(rows);
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].transactionId, 'f');
  assert.equal(anomalies[0].type, 'unusual_amount');
  assert.match(anomalies[0].reason, /above the median/i);
});

test('dashboard calculates current-month spend and omits income from expenses', () => {
  const rows = [tx('a', '2026-10-02', 'Rent', 16000, 'Home & bills'), tx('b', '2026-10-08', 'Salary', 85000, 'Income', 'income')];
  const dashboard = buildDashboard(rows, '2026-10-11');
  assert.equal(dashboard.summary.currentSpendMinor, 1_600_000);
  assert.equal(dashboard.summary.currentIncomeMinor, 8_500_000);
  assert.equal(dashboard.summary.availableTransactions, 2);
  assert.equal(dashboard.categories[0].name, 'Home & bills');
});
