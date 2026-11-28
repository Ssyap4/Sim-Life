import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {gzipSync,gunzipSync} from 'node:zlib';
import {LiveConnection,type ConnectionCallbacks} from '../../src/core/network';
import {startServer} from '../server';

test('resume from cached page, reject stale sockets, bound authentication wait and respect logout',()=>{
  let next=0,ready=0,disconnected=0;
  const timers=new Map<number,()=>void>();
  const sockets:FakeSocket[]=[];
  class FakeSocket {
    static OPEN=1;static CONNECTING=0;
    readyState=0;onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;
    onerror:(()=>void)|null=null;onmessage:((e:{data:string})=>void)|null=null;
    sent:string[]=[];
    constructor(_url:string){sockets.push(this);}
    close(){this.readyState=3;}
    send(data:string){this.sent.push(data);}
    open(){this.readyState=1;this.onopen?.();}
    packet(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
  }
  const descriptors=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value] of Object.entries({
    window:{setTimeout:(fn:()=>void)=>{timers.set(++next,fn);return next;},clearTimeout:(id:number)=>timers.delete(id)},
    location:{protocol:'http:',host:'localhost'},WebSocket:FakeSocket
  })){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
  const callbacks=new Proxy({onReady:()=>ready++,onDisconnect:()=>disconnected++},{get:(target,key)=>Reflect.get(target,key)??(()=>{})}) as unknown as ConnectionCallbacks;
  const net=new LiveConnection(callbacks);
  const fire=()=>{const [id,fn]=[...timers][0];timers.delete(id);fn();};
  try{
    net.login('vlad','example-test-code');
    const first=sockets[0];first.open();assert.equal(JSON.parse(first.sent[0]).type,'auth');
    first.packet({type:'ready',role:'vlad',state:{},online:[]});assert.equal(ready,1);assert.equal(timers.size,1);
    const stale=first.onmessage!;
    net.suspend();assert.equal(disconnected,1);assert.equal(net.isReady(),false);
    net.wake();net.wake();assert.equal(sockets.length,2);
    stale({data:JSON.stringify({type:'ready',role:'vlad'})});assert.equal(ready,1);
    const second=sockets[1];second.open();second.packet({type:'error',reason:'Этот персонаж уже занят на другом устройстве'});
    assert.equal(timers.size,1);fire();assert.equal(sockets.length,3);
    const third=sockets[2];third.open();third.packet({type:'ready',role:'vlad',state:{},online:[]});assert.equal(ready,2);
    // A socket that stays OPEN but receives no server packets must recover.
    third.packet({type:'clock_sync',sample:{minutes:480,multiplier:0}});
    assert.equal(timers.size,1);fire();assert.equal(third.readyState,3);assert.equal(disconnected,2);
    assert.equal(net.isReady(),false);assert.equal(timers.size,1);fire();assert.equal(sockets.length,4);
    net.stop();net.wake();assert.equal(sockets.length,4);assert.equal(timers.size,0);
    net.login('alina','example-test-code');assert.equal(sockets.length,5);fire();
    assert.equal(sockets[4].readyState,3);assert.equal(timers.size,1);fire();assert.equal(sockets.length,6);
    net.stop();assert.equal(timers.size,0);
  }finally{net.stop();for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});

function raw(port:number,path:string,encoding:string,method='GET'){
  return new Promise<{status:number|undefined,headers:Record<string,unknown>,body:Buffer}>((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers:{'accept-encoding':encoding}},res=>{
      const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);req.end();
  });
}
test('fingerprinted static assets negotiate gzip, retain bytes and keep HTML uncached',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim063-static-'));
  const dist=join(dir,'dist');mkdirSync(join(dist,'assets'),{recursive:true});
  const js=Buffer.from('console.log("SimOurHome");\n'.repeat(100));const packed=gzipSync(js);
  writeFileSync(join(dist,'assets','main-AbCd1234.js'),js);writeFileSync(join(dist,'assets','main-AbCd1234.js.gz'),packed);
  const glb=Buffer.concat([Buffer.from('glTF'),Buffer.alloc(4096,7)]);const glbPacked=gzipSync(glb);
  writeFileSync(join(dist,'assets','vlad-AbCd1234.glb'),glb);writeFileSync(join(dist,'assets','vlad-AbCd1234.glb.gz'),glbPacked);
  writeFileSync(join(dist,'index.html'),'<!doctype html>');
  const server=await startServer({port:0,host:'127.0.0.1',dataDir:join(dir,'data'),distDir:dist});
  try{
    const path='/assets/main-AbCd1234.js';
    const gzip=await raw(server.port,path,'br, gzip');assert.equal(gzip.status,200);assert.equal(gzip.headers['content-encoding'],'gzip');
    assert.equal(gzip.headers.vary,'Accept-Encoding');assert.match(String(gzip.headers['cache-control']),/immutable/);
    assert.deepEqual(gunzipSync(gzip.body),js);assert.equal(Number(gzip.headers['content-length']),packed.length);
    const identity=await raw(server.port,path,'gzip;q=0, *;q=1');assert.equal(identity.headers['content-encoding'],undefined);assert.deepEqual(identity.body,js);
    const head=await raw(server.port,path,'gzip','HEAD');assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),packed.length);
    const model='/assets/vlad-AbCd1234.glb';const compressedModel=await raw(server.port,model,'gzip');
    assert.equal(compressedModel.status,200);assert.equal(compressedModel.headers['content-type'],'model/gltf-binary');assert.equal(compressedModel.headers['content-encoding'],'gzip');assert.equal(compressedModel.headers.vary,'Accept-Encoding');assert.deepEqual(gunzipSync(compressedModel.body),glb);assert.equal(Number(compressedModel.headers['content-length']),glbPacked.length);
    const plainModel=await raw(server.port,model,'identity');assert.equal(plainModel.headers['content-encoding'],undefined);assert.deepEqual(plainModel.body,glb);
    const modelHead=await raw(server.port,model,'gzip','HEAD');assert.equal(modelHead.body.length,0);assert.equal(Number(modelHead.headers['content-length']),glbPacked.length);
    assert.equal((await raw(server.port,'/','gzip')).headers['cache-control'],'no-store');
    assert.equal((await raw(server.port,'/health','gzip')).headers['cache-control'],'no-store');
  }finally{await server.close();rmSync(dir,{recursive:true,force:true});}
});
