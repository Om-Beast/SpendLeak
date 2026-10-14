# SpendLeak architecture notes

## Design goals

SpendLeak is a modular monolith: one deployable Node process, explicit HTTP routes, pure analysis functions, and a single local relational database. React/TypeScript improves the client structure while keeping API contracts same-origin. This deliberately avoids introducing distributed components without a demonstrated need.

## Module boundaries

- **client/src/App.tsx** — typed client state, authentication flow, workspace loading, navigation, data actions and accessible UI.
- **client/src/styles.css** — responsive layout, component states, accessible focus styles and reduced-motion support.
- **vite.config.ts** — client root, React plugin, production bundle output and development API proxy.
- **server/index.js** — HTTP routing, cookies, validation, security headers, request size limits and static serving of dist/.
- **server/database.js** — SQLite schema, prepared queries, account-scoped persistence, transaction boundaries and synthetic demo fixtures.
- **server/lib/csv.js** — CSV delimiter detection, header mapping, date/amount parsing and row-level validation.
- **server/lib/merchant.js** — deterministic merchant aliases and descriptor normalization.
- **server/lib/analysis.js** — pure functions for recurrence detection, anomaly candidates and dashboard aggregations.
- **server/lib/budget.js** — category budget usage calculations.
- **server/lib/security.js** — password hashing, session tokens, cookie helpers and fingerprints.
- **server/lib/ai.js** — optional provider call and deterministic fallback; input contains aggregated metrics only.
- **tests/** — unit, security and HTTP integration tests using Node's built-in test runner.

## Data model

users owns the account profile; sessions stores a hash of the random browser token and an expiry; transactions contains normalized ledger records; imports records content hashes so a client retry does not duplicate a file; preferences stores UI options; budgets stores per-account category limits; anomaly_reviews stores the account-scoped review status.

Money is stored as integer minor units (paise/cents) to avoid floating-point rounding in totals. SQL uses placeholders and user IDs are included in ownership filters on data operations.

## Frontend build and delivery

The source HTML and TSX are under client/. Vite bundles React, TypeScript and CSS into dist/. The native Node server serves the compiled HTML, hashed JavaScript and CSS from the same origin as the API. This keeps session cookies same-site and does not require a separate frontend deployment. The Dockerfile builds the client in a dedicated stage so the runtime image only needs the Node server, built static files and data directory.

## Import consistency and idempotency

The CSV parser validates records before writes. Valid transactions and the import record are persisted in one BEGIN IMMEDIATE transaction. The exact file hash is checked before persistence and a unique constraint on (user_id, file_hash) prevents accidental replay of the same file. Similar rows from a different file remain visible for review rather than being silently discarded.

## Analysis model

Recurring-payment and anomaly functions are deterministic and independently tested. Cadence estimates use observed transaction intervals; repeat merchants require multiple occurrences, and non-bill merchants also require relatively stable amounts to reduce false positives. Outlier candidates compare a merchant charge with a median of prior charges and use explicit minimum-difference thresholds. Exact merchant/date/amount repeats are flagged as possible duplicates. These are heuristic signals and not fraud conclusions.

## AI boundary

AI is a presentation helper, not the source of truth. A user action is required to request an explanation. Gemini receives current and prior period totals, percentage movement, recurrence/anomaly counts and category shares—never raw statement lines, transaction descriptions or precise transaction dates. A timeout, bounded output budget, cautious instruction and deterministic fallback constrain provider failures.

## Security controls

- scrypt with a random salt for password storage.
- Cryptographically random session tokens, SHA-256 token hashes in the database, HttpOnly + SameSite cookies and server-side expiry.
- Parameterized SQL and authenticated user filters for account-owned reads and mutations.
- Same-origin validation for mutating requests, request-size limits, authentication rate limits and response security headers.
- CSV export neutralizes spreadsheet formula triggers.
- Render Free uses ephemeral disk. The hosted demo should only be tested with synthetic or redacted data.

## Planned database evolution

    Current implementation:
    React + TypeScript -> same-origin Node REST API -> SQLite (one instance)

    Future migration, not yet implemented:
    React + TypeScript -> Node REST API -> PostgreSQL
                                            -> versioned schema/data migrations

A PostgreSQL migration is intentionally separate: SQLite calls are synchronous, and production handlers currently use the SQLite data layer directly. Replacing it safely requires asynchronous repository methods, migrations, preservation of transaction boundaries and account-isolation regression tests. Do not claim PostgreSQL or Prisma is in the implemented stack until that work is deployed and verified.
