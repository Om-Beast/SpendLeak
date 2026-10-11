import { normalizeMerchant } from './merchant.js';

const DAY_MS = 86_400_000;
const roundMoney = (minor) => Math.round(minor) / 100;
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const addDays = (date, days) => new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);
const sameMonth = (date, reference) => date.slice(0, 7) === reference.slice(0, 7);

export function classifyCadence(intervals) {
  const average = median(intervals);
  if (average >= 6 && average <= 8.5) return { cadence: 'Weekly', days: 7 };
  if (average >= 12 && average <= 16) return { cadence: 'Biweekly', days: 14 };
  if (average >= 26 && average <= 35) return { cadence: 'Monthly', days: 30 };
  if (average >= 82 && average <= 100) return { cadence: 'Quarterly', days: 91 };
  if (average >= 340 && average <= 390) return { cadence: 'Yearly', days: 365 };
  return null;
}

export function detectRecurring(transactions, today = new Date().toISOString().slice(0, 10)) {
  const expenses = transactions.filter((t) => t.direction === 'expense');
  const groups = new Map();
  for (const transaction of expenses) {
    const key = normalizeMerchant(transaction.merchant || transaction.description);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(transaction);
  }

  const recurring = [];
  for (const [merchant, items] of groups) {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) continue;
    const intervals = [];
    for (let i = 1; i < sorted.length; i += 1) intervals.push(dayNumber(sorted[i].date) - dayNumber(sorted[i - 1].date));
    const cadence = classifyCadence(intervals);
    if (!cadence) continue;
    // A merchant appearing on a similar day is not sufficient by itself (for
    // example, restaurant spending). Permit variable utility/bill amounts, but
    // require more stable amounts for other merchants to reduce false positives.
    const recentForStability = sorted.slice(-4);
    const observedAmounts = recentForStability.map((item) => item.amountMinor);
    const referenceAmount = median(observedAmounts);
    const amountSpread = referenceAmount > 0
      ? (Math.max(...observedAmounts) - Math.min(...observedAmounts)) / referenceAmount
      : 1;
    const hasBillCategory = recentForStability.some((item) => /subscription|home & bills|utilities/i.test(item.category || ''));
    if (!hasBillCategory && amountSpread > 0.30) continue;
    const last = sorted.at(-1);
    const recentAmounts = sorted.slice(-3).map((t) => t.amountMinor);
    const typicalAmount = Math.round(median(recentAmounts));
    const previous = sorted.at(-2);
    const amountChangePercent = previous.amountMinor ? Math.round(((last.amountMinor - previous.amountMinor) / previous.amountMinor) * 100) : 0;
    const increased = amountChangePercent >= 15 && last.amountMinor - previous.amountMinor >= 5_000;
    let nextDate = addDays(last.date, cadence.days);
    while (nextDate < today) nextDate = addDays(nextDate, cadence.days);
    recurring.push({
      id: `${merchant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${cadence.cadence.toLowerCase()}`,
      merchant,
      cadence: cadence.cadence,
      intervalDays: cadence.days,
      amountMinor: typicalAmount,
      lastAmountMinor: last.amountMinor,
      nextDate,
      lastDate: last.date,
      occurrences: sorted.length,
      confidence: sorted.length >= 3 ? 'Likely' : 'Possible',
      amountChangePercent,
      increased,
      totalAnnualMinor: Math.round(typicalAmount * (365 / cadence.days))
    });
  }
  return recurring.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

export function detectAnomalies(transactions) {
  const expenses = transactions.filter((t) => t.direction === 'expense');
  const flagged = new Map();
  const byDayMerchantAmount = new Map();

  for (const t of expenses) {
    const key = `${t.date}|${normalizeMerchant(t.merchant || t.description)}|${t.amountMinor}`;
    if (!byDayMerchantAmount.has(key)) byDayMerchantAmount.set(key, []);
    byDayMerchantAmount.get(key).push(t);
  }
  for (const [key, matches] of byDayMerchantAmount) {
    if (matches.length > 1) {
      for (const t of matches) flagged.set(t.id, {
        transactionId: t.id, type: 'possible_duplicate', severity: 'medium',
        title: 'Possible duplicate charge',
        reason: `${matches.length} transactions have the same merchant, amount and date. Check whether both payments were intentional.`,
        amountMinor: t.amountMinor, date: t.date, merchant: t.merchant || normalizeMerchant(t.description)
      });
    }
  }

  const byMerchant = new Map();
  for (const t of expenses) {
    const merchant = normalizeMerchant(t.merchant || t.description);
    if (!byMerchant.has(merchant)) byMerchant.set(merchant, []);
    byMerchant.get(merchant).push(t);
  }
  for (const [merchant, items] of byMerchant) {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 3; i < sorted.length; i += 1) {
      const current = sorted[i];
      const history = sorted.slice(Math.max(0, i - 6), i).map((t) => t.amountMinor);
      const typical = median(history);
      if (typical > 0 && current.amountMinor >= typical * 1.8 && current.amountMinor - typical >= 10_000) {
        if (!flagged.has(current.id)) {
          const increasePercent = Math.round(((current.amountMinor - typical) / typical) * 100);
          flagged.set(current.id, {
            transactionId: current.id, type: 'unusual_amount', severity: current.amountMinor >= typical * 3 ? 'high' : 'medium',
            title: 'Higher-than-usual amount',
            reason: `This charge is ${increasePercent}% above the median of ${history.length} earlier ${merchant} transactions.`,
            amountMinor: current.amountMinor, typicalAmountMinor: Math.round(typical), date: current.date, merchant
          });
        }
      }
    }
  }
  return [...flagged.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function buildDashboard(transactions, today = new Date().toISOString().slice(0, 10)) {
  const ordered = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const expenses = ordered.filter((t) => t.direction === 'expense');
  const income = ordered.filter((t) => t.direction === 'income');
  const currentMonth = today.slice(0, 7);
  const previousMonthDate = new Date(`${currentMonth}-01T00:00:00Z`);
  previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
  const previousMonth = previousMonthDate.toISOString().slice(0, 7);
  const currentSpend = expenses.filter((t) => sameMonth(t.date, today)).reduce((sum, t) => sum + t.amountMinor, 0);
  const previousSpend = expenses.filter((t) => t.date.slice(0, 7) === previousMonth).reduce((sum, t) => sum + t.amountMinor, 0);
  const currentIncome = income.filter((t) => sameMonth(t.date, today)).reduce((sum, t) => sum + t.amountMinor, 0);
  const monthChangePercent = previousSpend ? Math.round(((currentSpend - previousSpend) / previousSpend) * 100) : null;

  const months = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(`${currentMonth}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - offset);
    const key = date.toISOString().slice(0, 7);
    months.push({ month: key, label: date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }), amountMinor: expenses.filter((t) => t.date.startsWith(key)).reduce((sum, t) => sum + t.amountMinor, 0) });
  }

  const categoryMap = new Map();
  for (const t of expenses.filter((t) => sameMonth(t.date, today))) {
    const category = t.category && t.category !== 'Uncategorized' ? t.category : 'Other';
    categoryMap.set(category, (categoryMap.get(category) || 0) + t.amountMinor);
  }
  const categories = [...categoryMap.entries()].map(([name, amountMinor]) => ({ name, amountMinor, sharePercent: currentSpend ? Math.round((amountMinor / currentSpend) * 100) : 0 }))
    .sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 6);

  const merchantMap = new Map();
  for (const t of expenses.filter((t) => sameMonth(t.date, today))) {
    const name = normalizeMerchant(t.merchant || t.description);
    const prior = merchantMap.get(name) || { merchant: name, amountMinor: 0, transactions: 0, latestDate: t.date };
    prior.amountMinor += t.amountMinor; prior.transactions += 1;
    if (t.date > prior.latestDate) prior.latestDate = t.date;
    merchantMap.set(name, prior);
  }
  const topMerchants = [...merchantMap.values()].sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 5);
  const recurring = detectRecurring(ordered, today);
  const anomalies = detectAnomalies(ordered);
  const monthTransactions = ordered.filter((t) => sameMonth(t.date, today));

  return {
    summary: {
      currentSpendMinor: currentSpend, previousSpendMinor: previousSpend, currentIncomeMinor: currentIncome,
      monthChangePercent, transactionCount: monthTransactions.length,
      averageTransactionMinor: expenses.filter((t) => sameMonth(t.date, today)).length
        ? Math.round(currentSpend / expenses.filter((t) => sameMonth(t.date, today)).length) : 0,
      recurringMonthlyMinor: recurring.filter((r) => r.cadence === 'Monthly' || r.cadence === 'Biweekly' || r.cadence === 'Weekly')
        .reduce((sum, r) => sum + Math.round(r.amountMinor * (30 / r.intervalDays)), 0),
      availableTransactions: ordered.length,
      period: currentMonth
    },
    trend: months,
    categories,
    topMerchants,
    recurring,
    anomalies,
    recentTransactions: ordered.slice(-8).reverse()
  };
}
