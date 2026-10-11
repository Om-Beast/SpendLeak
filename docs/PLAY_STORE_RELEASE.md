# SpendLeak production and Google Play release plan

SpendLeak is currently a portfolio/demo app. Green tests and a polished UI do not prove production-grade security. Do not invite users to import real bank statements until the production database, backups, support, privacy and operational controls are verified.

## Work in this branch
- Optional PostgreSQL adapter selected by DATABASE_URL; local dev/tests remain on SQLite.
- Permanent in-app account deletion and public web deletion instructions.
- Privacy Policy and Terms pages.
- Installable PWA manifest and online-first service worker; authenticated /api responses are never cached.
- AI category allow-list to avoid placing arbitrary user-uploaded category strings into prompts.
- Separate billable render.production.yaml; the existing render.yaml remains the free demo.

## Run tests
```bash
npm run check
```
Local SQLite tests cover parsing, analysis, auth, data isolation, CSV idempotency, cross-origin mutation protection, account deletion, PWA manifest and service-worker API exclusion. PostgreSQL must still pass a smoke test against an actual managed instance after setup. Tests are not a substitute for a security audit.

## Production storage
Render Free web services have ephemeral filesystems. Free Postgres databases expire after 30 days and lack production backups. Review [Render Free limitations](https://render.com/docs/free).

Do not use the free Render service for real statements. For a small pilot, explicitly choose render.production.yaml as Blueprint path. It creates a paid web service plus managed PostgreSQL; review current price before applying. Demo SQLite data is not automatically migrated.

Before enabling real-user uploads:
- test that records survive app redeploy/restart;
- enable backups and complete a restore drill;
- keep DB access private and secrets only in Render environment settings;
- add monitoring, incident response contact and tested rollback;
- verify deletion removes account, sessions, preferences, transactions and imports.

## Security work still required before broad launch
- Email verification and secure password-reset flow.
- Distributed rate limits / abuse controls if multiple instances are used; current limiter is in-memory.
- Dependency scanning, independent security review and penetration testing.
- Durable backups, restore drills, alerting, retention schedule and incident response process.
- A monitored support email and privacy/legal review.
- Test production cookie/session settings and verify the public privacy statement against actual providers.
- No app-level encryption of transaction rows is claimed; verify provider encryption controls rather than stating an unverified guarantee.

AI is optional. Without GEMINI_API_KEY the app uses deterministic rules. If enabled, only aggregated values and approved category labels are intended for the provider; review model availability and provider terms before real-user usage.

## PWA and Android
After the production host is stable:
1. Test the site on multiple Android phones; Chrome menu → Install app / Add to Home screen.
2. Verify manifest, icons, sw.js, privacy.html, terms.html, delete-account.html and /api/health return successfully.
3. Verify imported financial data never enters browser localStorage or service-worker Cache Storage.
4. Use a Trusted Web Activity (TWA) for a browser-powered Android shell via [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli) and the [Android TWA guide](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2).
5. Choose a permanent app package ID and signing key. Publish Digital Asset Links with the actual Play app-signing certificate SHA-256 fingerprint; never publish a placeholder. Keep a secure backup of the signing key.
6. New Play submissions from 31 August 2026 must target Android 16 / API 36 or higher: [official policy](https://support.google.com/googleplay/android-developer/answer/11926878).
7. New personal developer accounts created after 13 November 2023 must complete a closed test with at least 12 testers opted in continuously for 14 days before applying for production access: [official testing policy](https://support.google.com/googleplay/android-developer/answer/14151465).
8. Publish an accurate privacy policy, in-app account-deletion flow and public deletion URL. Complete Data safety form to match actual collection/provider behavior: [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311).

Never commit keystores, signing passwords, APP_SECRET, DATABASE_URL, AI provider keys or service account credentials. Play Store approval is not guaranteed.

## Go/no-go checks
- [ ] Paid production Blueprint explicitly approved and created.
- [ ] PostgreSQL persistence survives a redeploy/restart; backup restore is tested.
- [ ] Account deletion tested for a normal user and reflected in deployed public page.
- [ ] AI configured/unconfigured paths tested; raw transactions never sent to AI.
- [ ] Privacy, Terms, support contact and retention text match real deployment.
- [ ] Mobile file picker, export, sign-in/out, app resume, accessibility and poor network tested on real Android devices.
- [ ] Second reviewer checks auth, data isolation, database and AI boundary before broad user invite.
