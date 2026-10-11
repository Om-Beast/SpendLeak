# Android / Play Store packaging

SpendLeak first becomes an installable Progressive Web App; a Trusted Web Activity (TWA) then packages the owned HTTPS experience in a verified Android shell. A TWA is not a native app rewrite, and it does not guarantee Play approval.

Only point the Android package to the verified production HTTPS host after managed PostgreSQL, backups, account deletion and security review are complete. Do not use the free SQLite demo as a real-user service.

On Windows:
```powershell
npm install -g @bubblewrap/cli
bubblewrap init --manifest="https://YOUR-PRODUCTION-HOST/manifest.webmanifest"
bubblewrap build
```

Review the generated package ID and SDK/target API (API 36+ for new submissions after 31 August 2026), icons and signing configuration. In Play Console App integrity, use the actual Play app-signing SHA-256 fingerprint and publish a matching /.well-known/assetlinks.json to the production host. Do not commit signing keys or passwords. Test import/export, account deletion and narrow screens on physical Android devices before internal/closed testing.
