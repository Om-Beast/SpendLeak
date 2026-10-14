# SpendLeak

**Find the charges that repeat, the payments that look unusual, and the patterns hiding in your transaction history.**

SpendLeak is a privacy-conscious full-stack spending analytics application. It imports a user-selected CSV, normalizes merchants, detects plausible recurring charges, flags possible duplicate payments and unusually high transactions, tracks category budgets, and can explain aggregated trends with optional Gemini AI.

> **Prototype disclaimer:** SpendLeak is a portfolio/demo application, not a bank, accounting system, fraud detector, or source of financial advice. Findings are prompts to review, not proof of fraud or mistakes. The current free Render deployment uses ephemeral storage: use synthetic or redacted statements only.

## Highlights

- **Typed React dashboard:** responsive overview, transaction search/filter, spending trend, category breakdown, recurring-payment estimates, budget tracking, and insights review.
- **Deterministic analytics:** recurring cadence, merchant amount stability, median-based unusual-charge flags and same-day duplicate candidates are calculated in backend code, not delegated to an LLM.
- **AI with guardrails:** Gemini can produce a plain-English explanation of aggregated totals and category shares only after the user asks. A deterministic fallback works when the API key is absent or the provider is unavailable.
- **CSV safety:** quoted and multiline records, header aliases, date/amount validation, a 1 MB input cap, a 10,000-row limit, idempotent repeated imports, and spreadsheet-formula neutralization on export.
- **Account controls:** password hashing with scrypt, hash-only session tokens, HttpOnly/SameSite cookies, account-scoped queries, budget limits, reviewed/dismissed anomaly flags, account deletion, and transaction-data deletion.
- **Testing and delivery:** Node's built-in test runner, REST integration tests, TypeScript type-checking, Vite production build, GitHub Actions, and a multi-stage Docker image.

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, Lucide icons, responsive CSS.
- **Backend:** Node.js 22.12+, native HTTP server, same-origin REST endpoints.
- **Database:** SQLite via Node's built-in node:sqlite API. It is synchronous and intentionally restricted to a single app instance with persistent storage.
- **AI:** optional Gemini REST API, aggregate-only input and rule-based fallback.
- **Delivery:** Docker, Render, GitHub Actions, node:test.

React/TypeScript has been migrated into the source tree; SQLite remains the implemented database. PostgreSQL/Prisma and Express are **not** required by the current code and must not be listed as implemented technologies yet.

## Run locally

Requirements: Node.js 22.12 or newer.

1. Install packages with `npm install`.
2. Copy `.env.example` to `.env`.
3. Start the API in one terminal with `npm run dev:api`.
4. Start Vite in a second terminal with `npm run dev`.
5. Open the Vite URL printed in the terminal (normally http://localhost:5173). The development server proxies /api to http://127.0.0.1:3000.

For production-style local verification, run `npm run build`, then `npm start`, and open http://localhost:3000. Use **Explore synthetic demo** or import the sample CSV in examples/. No paid service is required for local operation.

## Tests and production build

Run `npm install` followed by `npm run check`.

The check command runs backend JavaScript syntax checks, TypeScript validation, a Vite production build, and the complete Node test suite, including REST and built-frontend smoke tests. GitHub Actions runs these checks on pushes and pull requests.

## Optional Gemini setup

The app is functional without a key. Put GEMINI_API_KEY and GEMINI_MODEL in .env to enable provider-backed explanations. The key is read only on the server. A user action is required to request an explanation; requests send current/prior month aggregates, percentage change, recurring/anomaly counts and top category shares—not transaction descriptions or precise transaction dates. If the provider returns an error, no text, or times out, SpendLeak falls back to deterministic rule-based explanations. Model availability and free-tier quotas may change; confirm the current model and limits in the official [Gemini API documentation](https://ai.google.dev/gemini-api/docs/models).

## CSV format

Required columns are Date, Description (or Merchant / Narration / Details), and Amount, or separate Debit and Credit columns. Type and Category are optional. Quoted fields, commas and embedded line breaks are supported. Ambiguous slash dates default to DD/MM/YYYY for an INR-oriented workspace.

    Date,Description,Amount,Type,Category
    2026-10-02,NETFLIX.COM MONTHLY,649,Debit,Subscriptions
    2026-10-04,SALARY CREDIT,65000,Credit,Income

The maximum upload is 1 MB and the parser accepts up to 10,000 rows per file. An exact file hash prevents the same file from being imported twice. A different file with similar rows is not silently discarded; matching patterns are surfaced for review.

## Architecture

    Browser (React + TypeScript, built by Vite)
                     | same-origin REST + HttpOnly session cookie
                     v
           Node.js native HTTP server
           - Auth and input validation
           - CSV import/export
           - Dashboard, budgets and review routes
           - Deterministic analytics
           - Optional aggregate-only Gemini explanation
                     | parameterized SQL
                     v
             SQLite (node:sqlite)

The backend remains a modular monolith: route handling, persistence, parsing, analysis, security and AI explanation logic are kept in separate modules. The frontend build is produced at dist/ and served by the existing same-origin server, avoiding a separate paid frontend service or permissive CORS configuration.

## API reference

| Method | Route | Purpose |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/me | Current signed-in account |
| POST | /api/auth/signup | Create account |
| POST | /api/auth/login | Sign in |
| POST | /api/auth/logout | Revoke session |
| POST | /api/demo | Create synthetic demo workspace |
| GET | /api/dashboard | Overview aggregates and trends |
| GET | /api/transactions | Search/filter the ledger |
| POST | /api/import | Import CSV transaction text |
| GET | /api/export.csv | Export normalized ledger |
| DELETE | /api/transactions/:id | Delete a transaction |
| GET/POST | /api/budgets | Read or set category budgets |
| GET | /api/recurring | Recurring-payment estimates |
| GET | /api/anomalies | Anomaly candidates |
| POST | /api/anomaly-reviews | Review/dismiss a finding |
| POST | /api/ai/insights | Request an explanation |
| DELETE | /api/data | Delete transaction/import data |
| DELETE | /api/account | Permanently delete account data |

Authenticated routes use a same-origin HttpOnly, SameSite=Strict session cookie. All API routes remain server-side; Gemini credentials are never included in client bundles.

## Deployment and storage limits

The Dockerfile builds the React/TypeScript bundle in a build stage, then copies only compiled static assets and the Node server into the runtime image. Render is configured for the free web-service plan and auto-deploys the main branch. Do not upgrade hosting or attach a paid disk as part of this project without explicit approval.

The current SQLite database is designed for one app instance and a persistent writable data directory. Render Free's filesystem is ephemeral unless a supported persistent disk is attached, so the live demo cannot guarantee data survival through restart or redeploy. Avoid uploading real bank statements. A PostgreSQL migration should be a separate, tested change that introduces an asynchronous DB adapter, versioned migrations, account-isolation regression tests and a verified free database tier before being called complete.

## Security boundaries and known limitations

- Passwords use Node scrypt; random session bearer tokens are stored as SHA-256 hashes and sent via HttpOnly, SameSite cookies.
- Mutations validate same-origin requests; response headers, request limits, parameterized SQL and account-scoped queries limit common attack paths.
- CSV formula triggers are neutralized in exported text. Imported values are not treated as authoritative classifications.
- AI output is an explanation helper, not the source of truth; amounts, dates and transaction history stay in deterministic code and the database.
- The current app is a portfolio/demo prototype. It is not independently audited and must not be described as “100% secure” or production-ready for real financial statements.
