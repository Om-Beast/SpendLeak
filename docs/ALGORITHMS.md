# Analysis algorithms (interview guide)

## 1. Merchant normalization

Normalize Unicode, uppercase the descriptor, remove common rails (`UPI`, `POS`, `NEFT`), strip long reference numbers, collapse whitespace, and map known aliases (for example, `NETFLIX.COM MONTHLY` → `Netflix`). Unknown strings keep a shortened, human-readable token sequence. This is deterministic, O(L) per descriptor where L is the description length, and intentionally easy to debug.

Trade-off: a small alias table will miss new bank abbreviations and broad token rules can merge unrelated merchants. In a later version, keep user-corrected aliases and use fuzzy matching only to suggest matches; don't silently change the user's ledger.

## 2. Recurring payment detection

Group expense transactions by normalized merchant and sort each group by date. Compute day intervals between consecutive observations and take the median interval. Accept only plausible cadence windows (weekly, biweekly, monthly, quarterly or yearly), then estimate the next date from the most recent observed date. Two observations are “Possible”; three or more are “Likely”. Amount estimates use the median of the latest three charges.

Complexity per merchant group is O(n log n) for sorting; grouping is O(n). Estimates are heuristic: monthly plans can change dates or amounts, and unrelated payments may repeat near a cadence. The UI labels them as estimates, shows how many observations support them, and never cancels anything.

## 3. Duplicate candidates

Group transactions by date, normalized merchant, amount in minor units, and direction. Groups containing multiple entries are flagged. This is O(n) expected time with a hash map. We do not auto-delete matching transactions because two same-day purchases can be legitimate. Re-importing the exact same file is separately protected by an import content hash.

## 4. High-charge candidates

For a merchant with a history, compare each later expense with the median of up to the six preceding amounts. A flag requires the amount to be at least 1.8× the median and at least ₹100 above the median. The highest severity label is used only at 3× the baseline. A median is more resistant to one large value than a mean.

Trade-off: this simple detector may miss an unusual small transaction, and merchants with few observations don't get high-charge checks. Future evaluation should compare precision/recall on labelled synthetic and consented datasets before changing thresholds.

## 5. Monthly dashboard

Expenses and income are aggregated independently. Expenses only are used for category and spending trend charts. Month-over-month percentage change is shown only when the preceding month has a non-zero denominator. This avoids treating missing history as zero spending.

## 6. AI explanation

The AI layer receives the dashboard's aggregate summary, not individual ledger rows. The deterministic result remains the baseline; provider output is only a natural-language explanation. If no API key is set, the same endpoint returns a useful rules-based summary. AI output must never be used as the sole basis for a fraud claim or financial decision.
