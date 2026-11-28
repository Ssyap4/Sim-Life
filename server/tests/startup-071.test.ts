import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readPreviewConfig,fetchModelBytes,MODEL_TRANSFER_TIMEOUT_MS} from '../../src/core/startup';
import {outfitChoices} from '../../src/shared/previewWardrobe';

test('startup health enables code-free mode only on explicit true',async()=>{
 for(const [body,expected] of [[{testNoCodes:true},true],[{testNoCodes:false},false],[{testNoCodes:'true'},false],[null,false],[{},false]] as const){
  assert.equal(await readPreviewConfig(async(url,init)=>{assert.equal(url,'/health');assert.equal(init?.cache,'no-store');return Response.json(body);}),expected);
 }
 assert.equal(await readPreviewConfig(async()=>new Response('no',{status:503})),null);
 assert.equal(await readPreviewConfig(async()=>new Response('invalid json')),null);
 assert.equal(await readPreviewConfig(async()=>{throw Error('offline');}),null);
});
test('health and model transfers abort on stalled connection or body',async()=>{
 const stall:typeof fetch=async(_url,init)=>new Promise((_,reject)=>init!.signal!.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
 assert.equal(await readPreviewConfig(stall,15),null);
 await assert.rejects(fetchModelBytes('/model.glb',stall,15),/aborted/);
 const bodyStall:typeof fetch=async(_url,init)=>new Response(new ReadableStream({start(controller){init!.signal!.addEventListener('abort',()=>controller.error(Error('body aborted')),{once:true});}}));
 await assert.rejects(fetchModelBytes('/model.glb',bodyStall,15),/body aborted/);
});
test('successful transfers retain all bytes; HTTP errors reject; slow links have a bounded budget',async()=>{
 const bytes=new Uint8Array([103,108,84,70,0,255,42]);
 assert.deepEqual(new Uint8Array(await fetchModelBytes('/model.glb',async()=>new Response(bytes))),bytes);
 await assert.rejects(fetchModelBytes('/model.glb',async()=>new Response('',{status:404})),/HTTP 404/);
 assert.equal(MODEL_TRANSFER_TIMEOUT_MS,45000);
});
test('pure wardrobe choices retain signature, unknown and existing outfit behavior',()=>{
 assert.deepEqual(outfitChoices('signature'),[]);
 assert.deepEqual(outfitChoices('invalid'),[]);
 assert.deepEqual(outfitChoices('home'),['alina-home-upper','alina-home-lower','alina-home-footwear','vlad-home-upper','vlad-home-lower','vlad-home-footwear']);
});
