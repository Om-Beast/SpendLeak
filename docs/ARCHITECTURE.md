# Architecture notes

## Design goals

SpendLeak is intentionally a small modular monolith: one process, one deployable unit, explicit route handlers, pure analysis functions, and a single local relational database. This avoids distributed-system complexity that the MVP does not need while leaving seams for future separation.

## Module boundaries

- `server/index.js` — HTTP routing, cookies, validation, security headers, request size limits and response serialization.
- `server/database.js` — schema, prepared queries, account-scoped persistence, transaction boundaries and demo fixtures.
- `server/lib/csv.js` — CSV dialect detection, header mapping, amount/date parsing and row-level validation.
- `server/lib/merchant.js` — deterministic alias rules and descriptor normalization.
- `server/lib/analysis.js` — pure functions that identify recurrence, anomalies and dashboard aggregations.
- `server/lib/security.js` — password hashing, session tokens, cookie helpers and fingerprints.
- `server/lib/ai.js` — optional provider call and deterministic fallback. It sees aggregate data only.
- `public/` — accessible, responsive UI with no third-party JavaScript dependencies.

## Data model

`users` owns the account profile; `sessions` stores only a hash of the browser's random session token and an expiry; `transactions` contains normalized ledger records; `imports` records content hashes so a client retry does not duplicate an entire file; `preferences` holds display and reminder options. Foreign keys use cascade deletion where appropriate.

The amount is stored in integer minor units (paise/cents) to avoid floating-point rounding in totals. Direction is a separate enum-like column (`expense` / `income`), which keeps spend queries straightforward. The UI currency selector only changes the displayed symbol; it does not perform FX conversion.

## Import consistency and idempotency

The parser produces a validated list before writing. The database inserts valid rows inside a single `BEGIN IMMEDIATE` transaction. The exact file hash is checked before persistence, and a unique constraint on `(user_id, file_hash)` prevents re-importing an identical file. A new file with similar transactions is still allowed; possible duplicate payments are review signals, not deletion rules.

## Analysis model

Dashboard data is recomputed from normalized transactions in one process. For a personal ledger of thousands to tens of thousands of rows this keeps the behavior obvious and testable. The key queries have user/date and user/merchant indexes. Analysis can later be cached or materialized if profiling shows a need.

## AI boundary

AI is a presentation helper, not the source of truth. Cadence and anomaly flags are produced by deterministic functions, and their evidence is surfaced in the UI. A user action is required to request an explanation. The provider receives summarized totals, category shares and counts — never raw statement lines, descriptions or exact transaction dates. A fixed short output budget, timeout, cautious system instruction and deterministic fallback bound cost and failure impact.

## Security controls

- `scrypt` with a random per-password salt for password storage.
- 256-bit random session tokens, SHA-256 token hashes in the database, HttpOnly + SameSite=Strict cookie, and server-side expiry.
- Parameterized SQL and authenticated user filters for every data mutation/query.
- Same-origin validation for mutating requests, no permissive CORS, rate limits for auth/demo flows, request-size limits, and security headers.
- SQLite file permissions are restricted where the host OS supports POSIX permissions.

## Growth path

```text
Current MVP
  Browser → HTTP modular monolith → SQLite

Next, when justified by actual use
  Browser → Node API → PostgreSQL
                      ├── durable job queue → reminder worker
                      ├── scheduled analysis / cached summaries
                      └── metrics + structured logs
```

Do not add Redis, a queue or a service split just to decorate the architecture. Introduce them when a real queue, concurrency, reliability or scale requirement exists. In particular, SQLite should remain on one persistent host volume and one app instance in this version.
