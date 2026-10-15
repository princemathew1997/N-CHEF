# N-CHEF: starting with your AI assistant

## What you need to do manually

### 1. Get the correct code

Ask the maintainer for the repository URL and access to branch
`codex/cloudflare-d1-backend` (implementation commit `5eac894`).
Repository: https://github.com/princemathew1997/N-CHEF.
Use that repository's development branch. `adminnchef-rgb` currently has push
access; ownership is still under `princemathew1997` as verified on 14 October
2026. Confirm any later repository transfer with the maintainer.

Sign in to GitHub with your own account and accept any repository invitation.
Your AI assistant can clone the repository, check out the branch, and create
your feature branch once access is available.

### 2. Accept Cloudflare access

Use your own Cloudflare account. Ask the owner of the N-CHEF account
(`admin.nchef@gmail.com`) to invite that email, then accept the invitation.

For database development, you need permission to read and modify D1. If you
will deploy releases, also request the necessary Workers and Pages permissions.
Do not assume D1 access includes deployment or secret-management access.
No shared owner password is needed.

When your assistant starts `npx wrangler login`, complete the browser login
and authorize Wrangler using your own invited account. Have the assistant
verify that the N-CHEF account appears in `npx wrangler whoami`.

### 3. Give your assistant a development workspace

Open the project folder in your AI development tool and enable the file and
terminal access it needs. Let it install/check Git, Node.js 24 with npm, and
Python 3.11+ for the database tests. Approve installation prompts when needed.
Dependencies and Wrangler should be installed from the project's lockfile;
the assistant can run those commands.

### 4. Create your local application login

After the assistant starts the local app, open
`http://localhost:8000/setup.html`. Use the setup key it generated in your
local `.dev.vars`, then choose your own local admin username and password
(12–128 characters). Enter the password yourself in the form.

Cloudflare login and N-CHEF application login are separate. Local accounts
are also separate from production accounts. Use an existing local admin if
your local database was already set up.

Do not copy production passwords, setup keys, or OAuth tokens into your
assistant's chat. An authenticated CLI and a local ignored secret file are
sufficient. No production secret needs to be configured for local development.

## Give this prompt to your AI assistant

Copy the following block into your assistant after opening the project folder.
Replace the last line with the feature you want it to implement.

```text
You are helping me develop N-CHEF, an existing kitchen inventory application.

First inspect the repository and its instructions. Confirm I have branch
codex/cloudflare-d1-backend, which contains the D1 implementation starting at
commit 5eac894. Create a separate feature branch for my work. Do not rebuild
the application from scratch.

Set up the local environment for me. Check Node.js 24/npm, Git, and Python
3.11+; install project dependencies with npm ci. Use the project-local Wrangler.
If cloud authentication is needed, initiate npx wrangler login and let me
complete its browser authorization. Verify the N-CHEF account with whoami.
Never ask me to paste passwords or tokens into chat.

Project configuration already exists:
- Live site: https://nchef.pages.dev/
- Cloudflare account ID: 5461025e548c01fea04a40b509473036
- D1 database: nchef-db
- Database ID: cdd61c50-94ca-4978-a588-8dce8ceacdc1
- D1 Worker binding: DB
- Private API Worker: nchef-api
- Pages project: nchef
- Pages service binding: API -> nchef-api
- API/local configuration: wrangler.jsonc
- Pages configuration: pages/wrangler.jsonc
- Compatibility date: 2026-10-14

Use those configuration files. Do not create a replacement production database
or substitute my personal Cloudflare account ID.

Read these files for project context before changing code:
1. README.md and docs/D1_MIGRATION.md
2. worker/index.mjs, worker/auth.mjs, worker/model.mjs,
   worker/database.mjs, and worker/pages.mjs
3. js/api-data.js, js/app.js, js/wizard.js, and js/stock-actions.js
4. migrations/, tests/, scripts/build.mjs, scripts/deploy-pages.mjs,
   package.json, and both Wrangler configurations

Prepare local D1 using npm run db:local. Generate a LOCAL setup key with
node scripts/setup-key.mjs, then run npm start. Have me create the local admin
at /setup.html with my own password. The local database under .wrangler is
isolated from production. Do not use a generic static/Python HTTP server.

Architecture and rules to preserve:
- Pages serves the interface and forwards same-origin /api/* requests to the
  private Worker, which accesses D1 through env.DB.
- Business data is stored in D1. localStorage is only for view preferences.
  js/data.js is legacy demo data and must remain excluded from deployment.
- Authorization is enforced server-side by role, outlet, and cuisine.
- Passwords are hashed; sessions use expiring HttpOnly cookies. Do not expose
  passwords, session tokens, setup keys, or OAuth credentials in responses/logs.
- Existing UI saves must await saveData(); explicit workflows should await
  runDatabaseAction(). Show success only after the server confirms the save.
- Use parameterized SQL. Preserve normalized records AND their payload_json /
  profile_json representations through the existing persistence layer.
- Keep revision guards, operation UUID deduplication, business writes, stock
  balances, ledger/audit writes, and revision advance in one atomic D1 batch.
  A stale command must fail rather than overwrite another device's work.
- Central balance = bought - sum(allocations). Outlet balance = allocated -
  consumed. No negative stock. Approval and receiving must not deduct/add twice.
- Add new numbered migrations; never rewrite already-applied migrations.
  Check the current migration list before picking the next number.
- Build assets are allowlisted. Add a new frontend file to scripts/build.mjs
  when needed. Never upload .dev.vars, backups, tests, or development tools.

Validate changes with the relevant tests and npm run build. Available checks:
- npm test
- npm run test:database
- npx wrangler deploy --dry-run --outdir dist/worker
- git diff --check
Tests must use isolated local data, not production D1.

Known behavior: polling runs every 10 seconds; global revisions can cause
conflicts between unrelated edits; PO receiving currently handles full remaining
deliveries; indent approval directly allocates stock to the outlet. Display text
currently rejects markup/quotes/backslashes because of legacy HTML templates.
Consider these constraints when proposing a feature.

Production operations need my explicit release instruction. Do not run
npm run db:remote, wrangler deploy, npm run deploy:pages, or
scripts/setup-key.mjs --upload as part of local setup. There is no separate
cloud staging environment configured. When I authorize a release, follow the
documented migration -> Worker -> Pages order and stop if any step fails.
Never replace the production setup key during a normal release.

Work until my requested feature is implemented and tested. Report the changes,
validation, and any remaining user action. Ask only for information or account
actions you cannot complete yourself.

My next feature is: [DESCRIBE THE FEATURE HERE]
```

This prompt supplies project context to the assistant. Keep it with the
repository; have the assistant re-read the actual code as it changes.
