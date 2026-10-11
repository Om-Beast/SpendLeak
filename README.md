# SpendLeak

**Find the charges that repeat, the payments that look unusual, and the patterns hiding in your transaction history.**

SpendLeak is a privacy-conscious, full-stack spending intelligence MVP. It accepts a user-selected CSV statement, normalizes merchant names, detects plausible recurring payments, flags duplicate candidates and unusually high charges, and explains the results in plain language. It never asks for bank login credentials.

> **Prototype disclaimer:** SpendLeak is a learning/demo product, not a bank, accounting system, fraud detector, or source of financial advice. Findings are signals to review, not proof of fraud or mistakes. Use synthetic or redacted statements while testing.

## Product tour

- **Overview:** monthly spend, income, trends, categories, recent transactions, recurring estimates, and a review queue.
- **Transactions:** search and filter the ledger, export the normalized data, and delete an individual row.
- **Recurring payments:** estimated cadence, next expected date, confidence label, and rough annualized cost.
- **Insights:** explainable flags for exact-pattern duplicate candidates and merchant charges materially above the historical median.
- **Optional AI explanation:** click to explain aggregated totals and category shares in plain language. Without a `GEMINI_API_KEY`, a deterministic rules-based explanation works instead.
- **Privacy controls:** cookie-backed sessions, account-scoped data, workspace data clearing and permanent account deletion.
- **Installable web app:** PWA manifest/icons and an online-first service worker that never caches `/api/*` responses.

## Tech stack

- **Frontend:** semantic HTML, modern CSS, browser JavaScript modules (no build step or frontend runtime dependencies).
- **Backend:** Node.js 22.9+, native HTTP server, small and explicit route handlers.
- **Persistence:** SQLite for local development and tests; managed PostgreSQL when `DATABASE_URL` is configured.
- **AI:** optional Gemini REST API call with aggregate-only input and a deterministic fallback.
- **Testing:** Node's built-in `node:test` runner.

The small dependency surface is intentional: the code is easy to read, run and explain in an interview. The frontend is custom-built rather than a template; the analysis rules are ordinary JavaScript functions with direct unit tests.

## Run locally

Requirements: Node.js **22.9 or newer**.

Download and unzip the project, then run:

```bash
cd spendleak
cp .env.example .env
npm start
```

Open [http://localhost:3000](http://localhost:3000). No `npm install` is needed because the runtime has no third-party dependencies. Select **Explore the demo** to load an isolated sample workspace, or create an account for your own data.

To publish this project to your own GitHub repository, follow [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

For development with automatic restarts:

```bash
npm run dev
```

## Run tests

```bash
npm test
npm run check
```

`npm run check` performs JavaScript syntax checks and runs the full unit suite. GitHub Actions runs the same checks on pushes and pull requests.

## Optional AI setup

SpendLeak works without an API key. To enable provider-backed explanations, set these values in `.env`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash
```

Restart the server. The key is only read by the server; it is never placed in frontend code. The AI endpoint receives only aggregated values: current and prior month totals, percentage change, recurring count/cost, anomaly count, and top category shares. Raw descriptions and transaction dates are not sent. The user must explicitly click **Explain my spending** to trigger the request. If the provider errors or times out, the app returns rule-based insights instead.

Model availability can change. See the [official Gemini model list](https://ai.google.dev/gemini-api/docs/models) before selecting a model.

## CSV format

Required columns: `Date`, `Description` (or Merchant / Narration / Details), and `Amount` — alternatively, use `Debit` and `Credit` columns. `Type` and `Category` are optional. Amounts can contain commas and a currency symbol; quoted CSV fields are supported. The parser accepts ISO dates and common slash formats, assuming **DD/MM/YYYY** when a slash date is ambiguous (appropriate for the default INR workspace).

Example:

```csv
Date,Description,Amount,Type,Category
2026-10-02,NETFLIX.COM MONTHLY,649,Debit,Subscriptions
2026-10-04,SALARY CREDIT,65000,Credit,Income
```

The maximum upload size is 1 MB and the parser processes up to 10,000 rows per file. The exact file content is hashed to make a retry of the same import idempotent. Importing another file containing similar rows does not automatically discard them; the analysis flags matching merchant/date/amount patterns so the user can review them.

## Architecture

```text
Browser (HTML / CSS / JS)
        │ same-origin HTTP + HttpOnly session cookie
        ▼
Native Node HTTP server
  ├── Auth & request validation
  ├── CSV import / export routes
  ├── Spending analysis routes
  ├── Optional AI explanation route
  └── Security headers / request limits
        │ parameterized SQL
        ▼
SQLite database
  ├── users + hashed session tokens
  ├── account-scoped transactions
  ├── import hashes / audit history
  └── workspace preferences
```

### Request lifecycle for an import

1. The browser sends the selected CSV to `POST /api/import` over same-origin HTTP.
2. The server validates the content type and size, parses quoted fields, normalizes merchant names and validates each row.
3. A hash of the exact file content prevents an accidental retry from inserting the same import again.
4. Valid rows and the import record are persisted in a SQLite transaction.
5. The deterministic analysis functions recompute spending summaries, recurring patterns and review flags from the user's own ledger.
6. The UI refreshes and presents the results with the evidence used by each flag.

More detail lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/ALGORITHMS.md`](docs/ALGORITHMS.md), and the beginner-friendly [`docs/LEARNING_PATH.md`](docs/LEARNING_PATH.md).

## API reference

All endpoints are same-origin. Authenticated routes use the `HttpOnly`, `SameSite=Strict` `spendleak_session` cookie.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/me` | Current account, if signed in |
| `POST` | `/api/auth/signup` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Revoke the current session |
| `POST` | `/api/demo` | Create an isolated demo workspace |
| `GET` | `/api/dashboard` | Aggregated dashboard and preferences |
| `GET` | `/api/transactions` | Search/filter transactions |
| `POST` | `/api/import` | Import CSV text |
| `GET` | `/api/export.csv` | Export normalized transactions |
| `DELETE` | `/api/transactions/:id` | Delete one transaction |
| `DELETE` | `/api/data` | Delete all user transaction/import data |
| `GET` | `/api/recurring` | Recurring pattern estimates |
| `GET` | `/api/anomalies` | Explainable anomaly candidates |
| `GET/PATCH` | `/api/preferences` | Read/update display and reminder settings |
| `POST` | `/api/ai/insights` | Explicitly request a plain-English explanation |

## Deployment notes

A container definition is included. Set `NODE_ENV=production`, a strong random `APP_SECRET`, and a persistent writable `DATA_DIR`. Terminate TLS at the hosting platform and ensure its host/origin setup is compatible with same-origin requests. The SQLite database is designed for a **single application instance with persistent disk**; it is not a multi-region or horizontally scaled database. For a larger production workload, move the relational layer to managed PostgreSQL and put reminder delivery into a durable worker queue. Do not claim that the current MVP provides background email/SMS delivery.

## Security notes / known limitations

- Passwords use Node's `scrypt`; sessions use random bearer values whose HMAC-SHA-256 hashes are stored server-side and sent to the browser as `HttpOnly` cookies.
- Mutating requests reject cross-site Fetch Metadata and mismatched `Origin` values. Login/signup and demo creation are rate-limited by source address.
- SQL operations use prepared statements; data endpoints filter by the authenticated user ID.
- Security headers include a same-origin content security policy, clickjacking protection, and a restrictive permissions policy.
- Imported transaction fields are personal data. The MVP does not encrypt the SQLite database itself. Protect the host volume and use a trusted server; do not put bank account numbers or credentials in descriptions.
- The recurring and anomaly rules are deliberately conservative and explainable; they are not statistically certified and can create false positives/negatives.
- The first version stores one account and transaction ledger per user. It does not connect to banking APIs, convert currency, execute payments, or actually cancel subscriptions.
- The browser reminder feature is an in-app prompt only; it is not a background notification worker.

## Production and Play Store

- `render.yaml` remains the free demo configuration. `render.production.yaml` is a separate **billable** web-service + PostgreSQL Blueprint. Review current Render pricing before explicitly applying it; it does not change the demo automatically.
- Read [`docs/PLAY_STORE_RELEASE.md`](docs/PLAY_STORE_RELEASE.md) for the production safety checklist, data persistence, backup, Android/TWA and Play Console requirements.
- Public pages: [Privacy Policy](/privacy.html), [Terms](/terms.html), [Account deletion](/delete-account.html).

## Roadmap

- Add labelled test fixtures from diverse redacted statement formats and measure parser coverage.
- Introduce confidence calibration and a review/ignore feedback loop for recurring and anomaly candidates.
- Add background notifications only after introducing a durable queue and retry/dead-letter handling.
- Move production persistence to PostgreSQL with migrations, backups and operational metrics before scaling.

## License

MIT — see [`LICENSE`](LICENSE).
