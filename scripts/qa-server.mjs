// Disposable, in-memory QA database. Never connects to Cloudflare or writes credentials to D1 production.
import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { resolve, extname, sep } from 'node:path';
const bundle = await build({ entryPoints: ['worker/index.mjs'], bundle: true, format: 'esm', platform: 'browser', write: false });
const site = resolve('dist/site');
const assets = async request => {
  const path = new URL(request.url).pathname;
  const file = resolve(site, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(site + sep)) return new Response('Not found', { status: 404 });
  try { return new Response(readFileSync(file), { headers: { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' })[extname(file)] || 'application/octet-stream' } }); }
  catch { return new Response('Not found', { status: 404 }); }
};
const mf = new Miniflare(convertV4MiniflareOptions({ name: 'nchef-qa', port: 8888, host: '127.0.0.1', modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-14', d1Databases: ['DB'], serviceBindings: { ASSETS: assets }, bindings: { SETUP_TOKEN: 'qa-only-key' } }));
const db = await mf.getD1Database('DB');
for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim());
const res = await mf.dispatchFetch('http://localhost/api/setup', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify({ setupToken: 'qa-only-key', username: 'qa_admin', name: 'QA Admin', password: 'qa-only-password-2026' }) });
if (res.status !== 201) throw new Error(await res.text());
console.log('Disposable QA app ready at http://127.0.0.1:8888; qa_admin / qa-only-password-2026');
process.on('SIGINT', async () => { await mf.dispose(); process.exit(0); });
