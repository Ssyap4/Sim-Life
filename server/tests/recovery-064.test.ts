import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openServerFiles,recoverHouseholdBackup} from '../storage';

function setup(fn:(dir:string)=>void){
  const dir=mkdtempSync(join(tmpdir(),'simourhome-recovery-064-'));
  try{fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}
}
test('064 recovery restores only a validated backup, quarantines corruption and keeps credentials',()=>setup(dir=>{
  const files=openServerFiles(dir);
  const old=files.load();old.money=7654;old.revision=5;files.save(old);
  const next=structuredClone(old);next.money=8000;next.revision=6;files.save(next);
  const primary=join(dir,'household.json'), backup=join(dir,'household.backup.json');
  const bytes=readFileSync(backup),access=readFileSync(join(dir,'access.json'));
  writeFileSync(join(dir,'trusted-devices.json'),'private fixture');
  const damaged=Buffer.from('{incomplete');
  writeFileSync(primary,damaged);
  assert.throws(()=>files.load());
  const recovered=recoverHouseholdBackup(dir);
  assert.equal(recovered.revision,5);
  assert.deepEqual(readFileSync(recovered.quarantine),damaged);
  assert.deepEqual(readFileSync(backup),bytes);
  assert.deepEqual(readFileSync(primary),bytes);
  assert.equal(files.load().money,7654);
  assert.deepEqual(readFileSync(join(dir,'access.json')),access);
  assert.equal(readFileSync(join(dir,'trusted-devices.json'),'utf8'),'private fixture');
  assert.throws(()=>recoverHouseholdBackup(dir),/valid/);
}));
test('064 deliberate reset must never recover an older household',()=>setup(dir=>{
  const files=openServerFiles(dir),old=files.load();old.money=1234;files.save(old);
  old.money=5678;files.save(old);
  const primary=join(dir,'household.json');
  unlinkSync(primary);
  assert.throws(()=>recoverHouseholdBackup(dir),/reset/);
  assert.equal(existsSync(primary),false);
  assert.equal(files.load().money,10000);
  files.save(files.load());
  writeFileSync(primary,"{broken fresh save");
  recoverHouseholdBackup(dir);
  assert.equal(files.load().money,10000);
}));
test('064 invalid backup refuses recovery without rewriting primary',()=>setup(dir=>{
  const files=openServerFiles(dir),old=files.load();files.save(old);
  const primary=join(dir,'household.json');
  writeFileSync(primary,'{}');
  writeFileSync(join(dir,'household.backup.json'),'{"money":-7}');
  assert.throws(()=>recoverHouseholdBackup(dir),/Invalid household backup/);
  assert.equal(readFileSync(primary,'utf8'),'{}');
}));
