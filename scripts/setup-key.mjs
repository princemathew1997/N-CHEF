import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// This file is ignored by Git and never copied to the deployment assets.
if (!existsSync('.dev.vars')) writeFileSync('.dev.vars', `SETUP_TOKEN=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
const token = readFileSync('.dev.vars', 'utf8').match(/^SETUP_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token || token.length < 32) throw new Error('A valid SETUP_TOKEN is required in .dev.vars.');
if (process.argv.includes('--upload')) {
  const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'secret', 'bulk', '--name', 'nchef-api'], {
    input: JSON.stringify({ SETUP_TOKEN: token }), encoding: 'utf8', env: process.env,
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) process.exit(result.status || 1);
} else console.log('Setup key ready in ignored .dev.vars. Its value was not printed.');
