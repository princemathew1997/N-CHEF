import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';

// Clean only these generated directories so stale files cannot escape the allowlist.
const outputRoot = resolve('dist');
for (const name of ['site', 'pages']) {
    const target = resolve(outputRoot, name);
    if (dirname(target) !== outputRoot) throw new Error('Invalid build output path.');
    rmSync(target, { recursive: true, force: true });
}
// Explicit allowlist: never upload source tools, .dev.vars, backups or credentials.
mkdirSync('dist/site/js', { recursive: true });
mkdirSync('dist/pages', { recursive: true });
for (const path of ['index.html', 'setup.html', 'css', 'assets']) cpSync(path, `dist/site/${path}`, { recursive: true });
for (const path of ['inventory-tools.js', 'inventory-ui.js', 'api-data.js', 'app.js', 'wizard.js', 'setup.js', 'stock-actions.js']) cpSync(`js/${path}`, `dist/site/js/${path}`);
writeFileSync('dist/site/_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n  Cache-Control: no-cache\n');
cpSync('dist/site', 'dist/pages', { recursive: true });
await build({ entryPoints: ['worker/pages.mjs'], outfile: 'dist/pages/_worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
writeFileSync('dist/pages/_routes.json', JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }));
console.log('Built static site and Pages Worker with an explicit asset allowlist.');
