import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
// Pages rejects account_id in its config; explicitly select the project's account.
const accountId = readFileSync('wrangler.jsonc', 'utf8').match(/"account_id"\s*:\s*"([a-f0-9]{32})"/)?.[1];
if (!accountId) throw new Error('Project Cloudflare account ID is missing.');
const result = spawnSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'deploy', '--cwd', resolve('pages'), '--branch', 'main', '--commit-dirty=true'], { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId } });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
