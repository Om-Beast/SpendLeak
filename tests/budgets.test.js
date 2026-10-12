import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBudgetProgress } from '../server/lib/budget.js';

const tx = (date, category, amountMinor, direction = 'expense') => ({
  date, category, amountMinor, direction
});

test('budget progress totals only expenses in the requested month', () => {
  const result = calculateBudgetProgress(
    [{ id: 'b1', category: 'Food & dining', monthlyLimitMinor: 100_000 }],
    [
      tx('2026-10-02', 'Food & dining', 35_000),
      tx('2026-10-08', 'Food & dining', 20_000),
      tx('2026-10-09', 'Income', 200_000, 'income'),
      tx('2026-09-30', 'Food & dining', 50_000)
    ],
    '2026-10'
  );
  assert.equal(result[0].spentMinor, 55_000);
  assert.equal(result[0].remainingMinor, 45_000);
  assert.equal(result[0].usagePercent, 55);
  assert.equal(result[0].isOverBudget, false);
});

test('budget progress maps uncategorized transactions to Other and flags overruns', () => {
  const result = calculateBudgetProgress(
    [{ id: 'b2', category: 'Other', monthlyLimitMinor: 20_000 }],
    [tx('2026-10-02', 'Uncategorized', 25_000)],
    '2026-10'
  );
  assert.equal(result[0].spentMinor, 25_000);
  assert.equal(result[0].remainingMinor, -5_000);
  assert.equal(result[0].usagePercent, 125);
  assert.equal(result[0].isOverBudget, true);
});

test('budget progress handles empty ledgers without mutating saved limits', () => {
  const budget = { id: 'b3', category: 'Transport', monthlyLimitMinor: 75_000 };
  const result = calculateBudgetProgress([budget], [], '2026-10');
  assert.equal(result[0].spentMinor, 0);
  assert.equal(result[0].remainingMinor, 75_000);
  assert.equal(result[0].usagePercent, 0);
  assert.equal(result[0].isOverBudget, false);
  assert.equal(budget.monthlyLimitMinor, 75_000);
});
