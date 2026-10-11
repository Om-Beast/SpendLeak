# Zero-budget Android approach

Start with the installable Progressive Web App. It runs at the HTTPS URL, can be added to an Android home screen from Chrome, and does not require a paid app-store account.

1. Deploy the free web service with Render and use Neon Free for PostgreSQL; do not rely on Render local SQLite storage.
2. Install from Chrome menu → Install app / Add to Home screen.
3. Test sign-up, login/logout, CSV file picker, export, account deletion, small screens, app resume and slow internet.
4. The service worker caches only static public assets and never caches any `/api/*` financial data.
5. Keep Gemini unconfigured for actual financial statements unless users have given clear consent to send aggregated spending metrics to Google's free-tier API (which may use content to improve products).

**Play Store is not a $0 route for a new developer account.** Google currently lists a US$25 one-time Play Console developer registration fee. If the budget is strictly zero and there is no existing Play Console account, ship the installable PWA and share its URL/QR code first. If you later use Play Store, use Bubblewrap/TWA, target API 36+, secure the signing key and publish Digital Asset Links with the real Play app-signing certificate fingerprint. Store approval is not guaranteed.
