import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../server';
for(const [ext,mime] of [['mp3','audio/mpeg'],['mp4','video/mp4']])test(ext+' requests stream with Safari-compatible content type and byte ranges',async()=>{
 const root=mkdtempSync(join(tmpdir(),'simlife-stream-'));const dist=join(root,'dist');mkdirSync(dist);
 const bytes=Buffer.from(Array.from({length:32},(_,i)=>i));writeFileSync(join(dist,'test.'+ext),bytes);
 const server=await startServer({port:0,distDir:dist,dataDir:join(root,'data')});
 try{
  const url='http://127.0.0.1:'+server.port+'/test.'+ext;
  const full=await fetch(url);assert.equal(full.status,200);assert.equal(full.headers.get('content-type'),mime);assert.equal(full.headers.get('content-length'),'32');assert.deepEqual(Buffer.from(await full.arrayBuffer()),bytes);
  const partial=await fetch(url,{headers:{Range:'bytes=0-1'}});assert.equal(partial.status,206);assert.equal(partial.headers.get('accept-ranges'),'bytes');assert.equal(partial.headers.get('content-range'),'bytes 0-1/32');assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(0,2));
  const tail=await fetch(url,{headers:{Range:'bytes=-5'}});assert.equal(tail.status,206);assert.deepEqual(Buffer.from(await tail.arrayBuffer()),bytes.subarray(27));
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.headers.get('content-length'),'32');assert.equal((await head.arrayBuffer()).byteLength,0);
  const bad=await fetch(url,{headers:{Range:'bytes=33-40'}});assert.equal(bad.status,416);assert.equal(bad.headers.get('content-range'),'bytes */32');
 }finally{await server.close();rmSync(root,{recursive:true,force:true});}
});
