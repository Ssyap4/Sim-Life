import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../server';
import {openServerFiles} from '../storage';

test('fresh private preview starts with exactly 100 000 rubles and retains later earnings/spending',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'simlife-preview-money-'));
  const settings={port:0,host:'127.0.0.1',dataDir:dir,testNoCodes:true,previewStartMoney:100_000};
  try{
    const first=await startServer(settings);
    try{
      assert.equal(openServerFiles(dir).load().money,100_000);
      const files=openServerFiles(dir);
      const saved=files.load();
      saved.money=37_000;
      files.save(saved);
    }finally{await first.close();}
    const second=await startServer(settings);
    try{assert.equal(openServerFiles(dir).load().money,37_000,
      'restarting an existing preview must not silently replenish its balance');}
    finally{await second.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('normal server keeps original economic starting money and rejects preview override',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'simlife-normal-money-'));
  try{
    await assert.rejects(
      startServer({port:0,host:'127.0.0.1',dataDir:dir,previewStartMoney:100_000}),
      /Preview starting money requires/);
    const server=await startServer({port:0,host:'127.0.0.1',dataDir:dir});
    try{assert.equal(openServerFiles(dir).load().money,10_000);}
    finally{await server.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});
