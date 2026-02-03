# Cloudflare Deploy Troubleshooting

Deploys can fail for two main reasons: **API token permissions** (most common) or a **security/abuse block**. Use this guide in order.

---

## 1. API token permissions (fix first)

Error **8000119** often means the token doesn’t have permission to deploy Pages, **not** that the project is blocked.

### Fix: Token with Pages Edit

1. **Create a new API token**
   - Go to: https://dash.cloudflare.com/profile/api-tokens  
   - **Create Token** → **Create Custom Token**
   - **Permissions:** **Account** → **Cloudflare Pages** → **Edit**
   - **Account resources:** Include → select your account
   - Create token and **copy it once** (it won’t be shown again)

2. **Update GitHub secret**
   - Repo → **Settings** → **Secrets and variables** → **Actions**
   - Edit **CLOUDFLARE_API_TOKEN** and paste the new token (no extra spaces)

3. **Optional but recommended:** set **CLOUDFLARE_ACCOUNT_ID**
   - In Cloudflare: select your account → right sidebar → **Account ID**
   - In GitHub Actions secrets, add or update **CLOUDFLARE_ACCOUNT_ID** with that value  
   - The main workflow (`ci-cd.yml`) uses `wrangler-action`; the simpler `deploy.yml` uses this for `wrangler pages deploy`.

4. **Redeploy**
   - Push a commit to `main` or run the workflow manually from **Actions**.

**Docs:** [Cloudflare Pages API – token permissions](https://developers.cloudflare.com/pages/configuration/api/) require at least **Pages Read** or **Pages Write** (Edit gives Write).

---

## 2. GitHub ↔ Cloudflare “linking”

You’re deploying via **GitHub Actions** (wrangler), not Cloudflare’s “Connect to Git”. So “linking” means: **correct project name and account**.

| Check | Where | What to verify |
|-------|--------|----------------|
| **Project name** | `wrangler.toml` and workflow | Project name is **panacea** (`name = "panacea"`, `--project-name=panacea`). In Cloudflare: **Workers & Pages** → project must be named **panacea** (or create it with that name). |
| **Account** | Cloudflare dashboard | Deploy runs in the same account where the **panacea** Pages project lives. Token must be from that account and have Pages Edit. |
| **Secrets** | GitHub → Settings → Secrets and variables → Actions | **CLOUDFLARE_API_TOKEN** set; **CLOUDFLARE_ACCOUNT_ID** set (recommended). No typos, no leading/trailing spaces. |

If the project was created via Cloudflare’s “Connect to Git”, its name might differ (e.g. repo name). Either:

- Use that name in the workflow: `wrangler pages deploy dist/ --project-name=<actual-project-name> --branch=main`, or  
- Create a **new** Pages project in the dashboard named **panacea** and deploy to it (no need to connect Git if you only use Actions).

---

## 3. If it’s still failing (possible block)

If you’ve fixed the token (Pages Edit, correct account, correct project name) and still see:

```text
Your Pages project has been blocked. Contact abusereply@cloudflare.com. [code: 8000119]
```

then Cloudflare may have applied a security/abuse block.

**What to do:**

1. **Email:** abusereply@cloudflare.com  
2. **Subject:** e.g. `Pages project blocked – 8000119 – studypanacea.com`  
3. **Include:** Account ID, project name (**panacea**), domain (**studypanacea.com**), that it’s a medical education app (PANCE/PANRE), and that you’ve already fixed API token permissions.

Templates and more detail: **DEPLOYMENT_BLOCK_QUICK_FIX.md** and **CLOUDFLARE_DEPLOYMENT_BLOCKED.md** in the repo root.

---

## 4. Quick checklist

- [ ] New API token with **Account → Cloudflare Pages → Edit**
- [ ] **CLOUDFLARE_API_TOKEN** updated in GitHub Actions secrets
- [ ] **CLOUDFLARE_ACCOUNT_ID** set in GitHub Actions secrets (recommended)
- [ ] Pages project in Cloudflare named **panacea** (or workflow uses actual project name)
- [ ] Token and project are in the **same** Cloudflare account
- [ ] No spaces when pasting the token
- [ ] If all above are correct and 8000119 persists → contact abusereply@cloudflare.com

---

## 5. Local deploy (no GitHub)

When GitHub Actions or git isn't available, deploy from your machine with the same result as CI. Use `npm run deploy:local` (build + deploy in one step), or run `npm run build` then `npx wrangler pages deploy dist/ --project-name=panacea --branch=main`. Ensure `CLOUDFLARE_API_TOKEN` is set or run `wrangler login` first.

**One-liner (same as CI):**

```bash
npm run deploy:local
```

Or run `npm run build` then `npx wrangler pages deploy dist/ --project-name=panacea --branch=main`. If this fails with 8000119, it’s token/account/project or a block, not GitHub linking.
