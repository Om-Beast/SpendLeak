const OTHER = 'Other';

/**
 * Builds a current-period view of saved category budgets.
 * Amounts are integer minor units (paise/cents), matching transaction storage.
 */
export function calculateBudgetProgress(budgets, transactions, period = new Date().toISOString().slice(0, 7)) {
  const spendingByCategory = new Map();
  for (const transaction of transactions) {
    if (transaction.direction !== 'expense' || !String(transaction.date).startsWith(period)) continue;
    const rawCategory = transaction.category && transaction.category !== 'Uncategorized'
      ? transaction.category
      : OTHER;
    const categoryKey = rawCategory.trim().toLocaleLowerCase();
    spendingByCategory.set(categoryKey, (spendingByCategory.get(categoryKey) || 0) + Number(transaction.amountMinor || 0));
  }

  return budgets.map((budget) => {
    const limit = Number(budget.monthlyLimitMinor);
    const spent = spendingByCategory.get(String(budget.category).trim().toLocaleLowerCase()) || 0;
    const usagePercent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return {
      ...budget,
      spentMinor: spent,
      remainingMinor: limit - spent,
      usagePercent,
      isOverBudget: spent > limit,
      period
    };
  });
}
