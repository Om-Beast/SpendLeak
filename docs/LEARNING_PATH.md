# SpendLeak: beginner-friendly code tour

This guide is for reading the project before explaining it in an interview. Start with the happy path rather than opening every file at once.

## Run it first

```bash
cp .env.example .env
npm start
```

Open `http://localhost:3000` and select **Explore the demo**. It creates a separate demo workspace with synthetic transactions, so you can explore without uploading personal information.

## Follow one CSV import

1. `public/main.js` opens the import dialog, reads the chosen CSV as text, and sends it to `POST /api/import`.
2. `server/index.js` checks the session, request origin, content type, and size. It calls the parser; it does not contain the parsing algorithm itself.
3. `server/lib/csv.js` detects a delimiter, maps column names, validates each row, and returns normalized transaction objects.
4. `server/lib/merchant.js` cleans merchant descriptors so variants such as `NETFLIX.COM MONTHLY` are grouped consistently.
5. `server/database.js` checks the exact file-content hash and writes valid rows within a SQLite transaction. Retrying an identical upload will not insert the same file again.
6. `server/lib/analysis.js` recomputes summaries, recurrence estimates, and review flags from the normalized ledger.
7. The browser refreshes `GET /api/dashboard` and renders the returned data.

## Which file should I understand first?

| File | Plain-English responsibility |
|---|---|
| `package.json` | Start and test commands; supported Node.js version |
| `public/index.html` | Page structure and accessible app shell |
| `public/styles.css` | Colors, layout, responsive behavior, motion and reduced-motion styles |
| `public/main.js` | UI state, rendering, forms, requests and click handlers |
| `server/index.js` | HTTP routes, sessions, validation and API responses |
| `server/database.js` | SQLite schema, prepared queries and transaction writes |
| `server/lib/csv.js` | Import parsing and row validation |
| `server/lib/merchant.js` | Merchant descriptor cleanup and known aliases |
| `server/lib/analysis.js` | Recurrence, duplicate candidates, unusual charges and aggregates |
| `server/lib/ai.js` | Aggregate-only optional Gemini explanation and rules fallback |
| `server/lib/security.js` | Password hashing, session token helpers and input policies |
| `tests/` | Executable examples of expected behavior and edge cases |

## The core algorithms in plain English

- **Merchant normalization:** clean noise from the bank descriptor and apply a small known-alias table. It is deterministic, fast, and easy to correct.
- **Recurring detection:** group expenses by merchant, sort by date, compute gaps between charges, and compare the median gap to conservative cadence windows. Two observations mean *Possible*; three or more mean *Likely*. Those labels are heuristic confidence, not statistical probabilities.
- **Duplicate candidate detection:** group by date, normalized merchant, amount, and direction. If more than one row shares the key, flag the group for review. Never automatically delete it: two legitimate purchases can look the same.
- **Unusually high charge:** compare a new merchant charge to the median of up to six prior charges. Flag only when it is at least 1.8 times the baseline and at least ₹100 higher. This is a transparent threshold, not a fraud verdict.
- **Idempotent import:** hash the exact file content and enforce a unique user/file hash pair in the database. This protects against a client retry of the same upload; it does not silently deduplicate similar-looking transactions from different files.
- **AI boundary:** the deterministic engine creates the findings. When a user explicitly requests an explanation, only aggregate totals, counts and category shares are sent to Gemini. Without an API key or if the provider fails, rules-based text still works.

## Interview-ready explanation

**30-second pitch:**

> SpendLeak is a full-stack spending analysis app that imports user-selected transaction CSVs and helps people notice recurring charges, duplicate candidates, and unusually high merchant charges. I kept the core detection deterministic and explainable, used SQLite transactions plus file-hash idempotency for reliable imports, and added an optional AI layer only to explain aggregated results. It never auto-deletes a transaction or claims that a flag proves fraud.

**Trade-offs to be ready to discuss:**

1. Why a modular monolith and SQLite? The MVP has one small workload and one deployable process; service separation would add operational cost before it solves a real problem.
2. Why not make an LLM detect everything? Financial records need repeatable results and evidence. Rules are testable; AI is optional narrative, not the source of truth.
3. What would change at larger scale? Use managed PostgreSQL, migrations/backups, observable jobs and a durable queue for real notifications, then measure before caching or splitting services.
4. What are the limitations? Statement formats vary, cadence can be coincidental, thresholds can miss events, and SQLite is for a single application instance on a persistent disk in this version.

## Resume bullet (do not add invented metrics)

**SpendLeak — Full-Stack Spending Intelligence SaaS** | Node.js, JavaScript, SQLite, HTML/CSS

- Built a privacy-conscious transaction analysis app with CSV parsing, merchant normalization, recurring-charge estimates and explainable duplicate/high-charge review flags.
- Implemented account-scoped persistence, hashed session tokens, prepared SQL queries and file-hash idempotency for safe repeat imports.
- Added an optional AI explanation endpoint that uses aggregated spending data with a deterministic fallback, plus 22 automated checks covering parser, algorithm, auth and API behavior.

Only keep the test-count claim while `npm run check` continues to pass; update it when tests change. Do not claim measured user savings or production usage until you have real evidence.
