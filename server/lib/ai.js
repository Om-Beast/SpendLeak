const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

function fallbackInsights(summary) {
  const insights = [];
  if (summary.monthChangePercent !== null && summary.monthChangePercent > 0) {
    insights.push(`Your tracked spending is ${summary.monthChangePercent}% higher than last month. Review the biggest category changes before changing your budget.`);
  } else if (summary.monthChangePercent !== null && summary.monthChangePercent < 0) {
    insights.push(`Your tracked spending is ${Math.abs(summary.monthChangePercent)}% lower than last month. Check whether both months cover a similar number of days.`);
  } else {
    insights.push('A month-over-month comparison is available once both months have transactions. Import a broader date range for a more useful trend.');
  }
  if (summary.anomalyCount > 0) insights.push(`${summary.anomalyCount} transaction pattern(s) need a quick review. These are flags, not proof of fraud or error.`);
  if (summary.recurringCount > 0) insights.push(`You have ${summary.recurringCount} possible recurring payment(s). Confirm the schedule before treating the estimated annual cost as committed spending.`);
  if (summary.topCategory) insights.push(`${summary.topCategory.name} is the largest category in the current month at ${summary.topCategory.sharePercent}% of tracked expenses.`);
  return { text: insights.join('\n\n'), provider: 'rules', disclaimer: 'Based on deterministic rules; not financial advice.' };
}

export async function generateInsights(summary) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackInsights(summary);

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  // Only aggregated metrics are sent to the provider. Transaction descriptions,
  // dates, account identifiers, and raw merchant history are not sent.
  const safeSummary = {
    currentMonthSpend: summary.currentSpend,
    previousMonthSpend: summary.previousSpend,
    monthChangePercent: summary.monthChangePercent,
    recurringCount: summary.recurringCount,
    recurringEstimatedMonthlyCost: summary.recurringMonthlyCost,
    anomalyCount: summary.anomalyCount,
    topCategories: summary.topCategories.map((category) => ({ name: category.name, sharePercent: category.sharePercent }))
  };

  try {
    const response = await fetch(`${GEMINI_BASE_URL}${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are SpendLeak, a cautious personal spending explainer. Use only the given aggregated figures. Do not make investment, credit, tax, or financial product recommendations. Do not claim fraud. Explain patterns in plain language, offer at most three practical review actions, and state that estimates can be incomplete.' }] },
        contents: [{ role: 'user', parts: [{ text: `Explain these spending aggregates in at most 140 words. Be specific but do not invent facts.\n${JSON.stringify(safeSummary)}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 220 }
      })
    });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!text) throw new Error('AI provider returned no text');
    return { text, provider: 'gemini', disclaimer: 'AI-generated explanation of aggregated data; review figures before acting.' };
  } catch {
    return { ...fallbackInsights(summary), provider: 'rules-fallback', disclaimer: 'AI is temporarily unavailable. Showing rule-based insights instead.' };
  }
}

export function summarizeForAI(dashboard) {
  return {
    currentSpend: (dashboard.summary.currentSpendMinor / 100).toFixed(2),
    previousSpend: (dashboard.summary.previousSpendMinor / 100).toFixed(2),
    monthChangePercent: dashboard.summary.monthChangePercent,
    recurringCount: dashboard.recurring.length,
    recurringMonthlyCost: (dashboard.summary.recurringMonthlyMinor / 100).toFixed(2),
    anomalyCount: dashboard.anomalies.length,
    topCategory: dashboard.categories[0] ? { name: dashboard.categories[0].name, sharePercent: dashboard.categories[0].sharePercent } : null,
    topCategories: dashboard.categories.slice(0, 3).map(({ name, sharePercent }) => ({ name, sharePercent }))
  };
}
