import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {initialState,type CharacterId,type ServerPacket} from '../../src/shared/protocol';
import {albumFor,ALBUM_LIMIT,validAlbum} from '../../src/shared/familyAlbum';
import {openAlbum,decodePhoto} from '../familyAlbum';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
const jpeg='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAMABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCOiiisziP/2Q==';
test('JPEG limits reject invalid data and dimensions',()=>{
 const d=decodePhoto(jpeg);assert.ok(d);assert.equal(d.width,16);assert.equal(d.height,12);
 for(const input of [null,'','data:image/png;base64,abc','x'.repeat(120004),Buffer.from('abc').toString('base64'),jpeg.slice(0,-8)])assert.equal(decodePhoto(input),null);
 const b=Buffer.from(jpeg,'base64'),sof=b.indexOf(Buffer.from([255,192]));b.writeUInt16BE(641,sof+7);assert.equal(decodePhoto(b.toString('base64')),null);
});
test('album uses separately stored JPEGs, preserves needs and enforces authorship and capacity',()=>{
 const dir=mkdtempSync(join(tmpdir(),'album067-'));try{
 const album=openAlbum(dir),s=initialState(),r=album.add(s,'alina',jpeg,'  Дома ♡  ');assert.ok(r.ok);
 assert.deepEqual(r.state.characters,s.characters);assert.equal(r.state.money,s.money);assert.equal(r.photo.caption,'Дома ♡');assert.equal(r.photo.by,'alina');assert.equal(r.photo.place,'home');
 assert.equal(album.get(r.state,r.photo.id),jpeg);assert.equal(album.get(s,r.photo.id),null);assert.equal(album.get(r.state,'../household'),null);assert.ok(!JSON.stringify(r.state).includes(jpeg));
 assert.ok(validAlbum(r.state.familyAlbum));const f=openServerFiles(dir);f.save(r.state);assert.deepEqual(f.load().familyAlbum,r.state.familyAlbum);
 assert.equal(album.remove(r.state,'vlad',r.photo.id).ok,false);
 assert.equal(album.add(r.state,'vlad',jpeg,'x'.repeat(101)).ok,false);
 const full=structuredClone(r.state);full.familyAlbum=Array.from({length:ALBUM_LIMIT},(_,i)=>({...r.photo,id:i.toString(16).padStart(32,'0')}));assert.equal(album.add(full,'vlad',jpeg,'').ok,false);
 const del=album.remove(r.state,'alina',r.photo.id);assert.ok(del.ok);f.save(del.state);del.cleanup();assert.equal(album.get(del.state,r.photo.id),null);assert.equal(readdirSync(join(dir,'family-photos')).length,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
function wait(ws:WebSocket,predicate:(p:ServerPacket)=>boolean){return new Promise<ServerPacket>((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',on);reject(Error('Packet timeout'));},5000);
 function on(raw:WebSocket.RawData){const p=JSON.parse(raw.toString()) as ServerPacket;if(predicate(p)){clearTimeout(timer);ws.off('message',on);resolve(p);}}ws.on('message',on);
});}
test('real two-player sockets share photo metadata and fetch bytes only after authentication; restart retains album',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'album067-live-'));let server=await startServer({port:0,dataDir:dir,testNoCodes:true});const sockets:WebSocket[]=[];
 async function connect(role?:CharacterId){const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);await once(ws,'open');if(role){const ready=wait(ws,p=>p.type==='ready');ws.send(JSON.stringify({type:'auth',role,code:'TEST-LOCAL-NO-CODES'}));await ready;}return ws;}
 try{
 const v=await connect('vlad'),a=await connect('alina');const snapshot=wait(a,p=>p.type==='snapshot'&&albumFor(p.state).length===1);v.send(JSON.stringify({type:'album_add',jpeg,caption:'Наш дом',by:'alina'}));
 const p=await snapshot;assert.equal(p.type,'snapshot');if(p.type!=='snapshot')throw Error('snapshot');const photo=albumFor(p.state)[0];assert.equal(photo.by,'vlad');assert.ok(!JSON.stringify(p).includes(jpeg));
 const anonymous=await connect();const refused=wait(anonymous,p=>p.type==='error');anonymous.send(JSON.stringify({type:'album_get',id:photo.id}));await refused;
 const image=wait(a,p=>p.type==='album_image');a.send(JSON.stringify({type:'album_get',id:photo.id}));const got=await image;assert.equal(got.type,'album_image');if(got.type==='album_image')assert.equal(got.jpeg,jpeg);
 const denied=wait(a,p=>p.type==='album_error');a.send(JSON.stringify({type:'album_delete',id:photo.id}));await denied;
 for(const ws of sockets)ws.terminate();await server.close();server=await startServer({port:0,dataDir:dir,testNoCodes:true});
 const again=await connect('vlad');const fetched=wait(again,p=>p.type==='album_image');again.send(JSON.stringify({type:'album_get',id:photo.id}));await fetched;
 const removed=wait(again,p=>p.type==='snapshot'&&albumFor(p.state).length===0);again.send(JSON.stringify({type:'album_delete',id:photo.id}));await removed;
 assert.equal(albumFor(openServerFiles(dir).load()).length,0);
 }finally{for(const ws of sockets)ws.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
});
