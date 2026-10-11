# Publish SpendLeak to GitHub and Render

## 1. Create the GitHub repository

Create a **new empty public repository** named `SpendLeak` in your account. Do not initialize it with a README, license, or `.gitignore`; these files already exist in the project.

## 2. Push the source

Open PowerShell or a VS Code terminal in the extracted `spendleak` directory:

```bash
git init -b main
git add .
git commit -m "feat: build SpendLeak spending intelligence SaaS"
git remote add origin https://github.com/Om-Beast/SpendLeak.git
git push -u origin main
```

If you use a different owner or repository name, change the remote URL. Git may ask you to authenticate in a browser. Do not put a GitHub token in source code or commit it.

After the first push, the included GitHub Actions workflow runs `npm run check` on pushes and pull requests. The checked-in source was verified locally with Node 22.16.0: all 22 tests passed.

## 3. Deploy on Render using the Blueprint

1. Open this link after the GitHub push completes: <https://dashboard.render.com/blueprint/new?repo=https://github.com/Om-Beast/SpendLeak>
2. Sign in to Render and connect/authorize GitHub if asked.
3. Select the workspace you want to use. Check that the Blueprint is reading `render.yaml` from the `main` branch.
4. Review the service settings and select **Apply**. The Blueprint uses the included Dockerfile, sets `NODE_ENV=production`, configures `/data`, and has Render generate the required `APP_SECRET`.
5. Wait for the first deployment to complete, open the service's `onrender.com` URL, and check `/api/health`. A healthy response looks like `{"status":"ok","service":"spendleak","version":"1.0.0"}`.

## Important free-tier limitation

This Blueprint uses Render's free web service plan for a portfolio/demo deployment. Free web services have an ephemeral filesystem: the SQLite database and all accounts/transactions can disappear when the service spins down, restarts, or redeploys. **Use only synthetic/sample data on this demo URL; never upload real bank statements.** The service can also take around a minute to wake after 15 minutes without traffic.

If you later need persistent storage for real users, upgrade deliberately and attach a persistent disk mounted at `/data`, or migrate the database layer to a managed PostgreSQL service first. Do not treat this learning MVP as a production financial application; the SQLite file is not encrypted at rest.

## Optional AI explanations

SpendLeak works without an AI key. To enable Gemini explanations, add `GEMINI_API_KEY` through the Render service's Environment page. Keep the key out of GitHub and never store it in `render.yaml`. The `GEMINI_MODEL` variable is optional; the project currently defaults to `gemini-3.5-flash`, so verify that model is available for your API key before using provider-backed explanations.
