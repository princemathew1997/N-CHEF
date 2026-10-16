import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { migrationDigest, fail } from './lib/releases.mjs';
const files=readdirSync('migrations').filter(name=>name.endsWith('.sql')).sort();
const current=files.map(name=>({name,sha256:migrationDigest(readFileSync('migrations/'+name))}));
const locked=JSON.parse(readFileSync('migrations.lock.json'));
for(const entry of locked)if(current.find(row=>row.name===entry.name)?.sha256!==entry.sha256)fail('Do not edit or delete applied migration '+entry.name+'. Add a new migration instead.');
if(process.argv.includes('--update'))writeFileSync('migrations.lock.json',JSON.stringify(current,null,2)+'\n');
else if(JSON.stringify(current)!==JSON.stringify(locked))fail('New migrations must be added to the lock with node scripts/check-migrations.mjs --update.');
const index=process.argv.indexOf('--base');
const base=index===-1?process.env.MIGRATION_BASE:process.argv[index+1];
if(base && !/^0+$/.test(base)) {
  if(!/^[a-f0-9]{40}$/.test(base))fail('Migration base must be a full Git commit SHA.');
  const original=execFileSync('git',['ls-tree','--name-only',base+':migrations'],{encoding:'utf8'}).trim().split('\n').filter(n=>n.endsWith('.sql'));
  for(const name of original) {
    const before=execFileSync('git',['show',base+':migrations/'+name]);
    if(current.find(row=>row.name===name)?.sha256!==migrationDigest(before))fail('Existing migration changed since the base commit: '+name);
  }
}
console.log('Migration files and immutable checksums verified.');
