
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {initialState,type CharacterId,type ServerPacket} from '../../src/shared/protocol';
import {applyFamilyMessage,messagesFor,unreadMessages,validFamilyMessages,HISTORY_LIMIT} from '../../src/shared/familyMessages';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
test('message text is literal, validated and personal; no changes to needs or money',()=>{
 const s=initialState(),r=applyFamilyMessage(s,'vlad',{type:'family_message_send',from:'alina',text:'  Привет! <b>текст</b>\r\n♡  '});
 assert.ok(r.ok);assert.equal(messagesFor(r.state).items[0].from,'vlad');assert.equal(messagesFor(r.state).items[0].text,'Привет! <b>текст</b>\n♡');
 assert.deepEqual(r.state.characters,s.characters);assert.equal(r.state.money,s.money);assert.equal(unreadMessages(r.state,'alina').length,1);assert.equal(unreadMessages(r.state,'vlad').length,0);
 for(const text of ['', ' ', 'x'.repeat(401),null,123,'a\u0000b'])assert.equal(applyFamilyMessage(s,'alina',{type:'family_message_send',text}).ok,false);
 assert.equal(messagesFor(s).items.length,0);assert.ok(validFamilyMessages(r.state.familyMessages));
});
test('read cursor is personal, monotonic and bounded; history cannot grow without bound',()=>{
 let s=initialState();for(let i=0;i<HISTORY_LIMIT+3;i++){const r=applyFamilyMessage(s,'alina',{type:'family_message_send',text:'Привет '+i});assert.ok(r.ok);s=r.state;}
 const m=messagesFor(s);assert.equal(m.items.length,HISTORY_LIMIT);assert.equal(m.items[0].id,4);
 assert.equal(applyFamilyMessage(s,'vlad',{type:'family_message_read',through:m.nextId}).ok,false);
 const r=applyFamilyMessage(s,'vlad',{type:'family_message_read',through:m.nextId-1});assert.ok(r.ok);assert.equal(unreadMessages(r.state,'vlad').length,0);assert.equal(messagesFor(r.state).read.alina,0);
 const old=applyFamilyMessage(r.state,'vlad',{type:'family_message_read',through:2});assert.ok(old.ok);assert.equal(old.state,r.state);
 assert.ok(validFamilyMessages(r.state.familyMessages));
});
function wait(ws:WebSocket,predicate:(p:ServerPacket)=>boolean){return new Promise<ServerPacket>((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',on);reject(Error('Packet timeout'));},5000);
 function on(raw:WebSocket.RawData){const p=JSON.parse(raw.toString()) as ServerPacket;if(predicate(p)){clearTimeout(timer);ws.off('message',on);resolve(p);}}ws.on('message',on);
});}
test('real sockets: offline partner receives persisted message on login and sender sees read receipt',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'messages067-'));let server=await startServer({port:0,dataDir:dir,testNoCodes:true});const sockets:WebSocket[]=[];
 async function connect(role:CharacterId){const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);await once(ws,'open');const ready=wait(ws,p=>p.type==='ready');ws.send(JSON.stringify({type:'auth',role,code:'TEST-LOCAL-NO-CODES'}));return {ws,packet:await ready};}
 try{
 const v=await connect('vlad');const snap=wait(v.ws,p=>p.type==='snapshot'&&messagesFor(p.state).items.length===1);v.ws.send(JSON.stringify({type:'family_message_send',text:'Купи молоко ♡',from:'alina'}));await snap;
 const stored=openServerFiles(dir).load();assert.equal(unreadMessages(stored,'alina').length,1);assert.equal(messagesFor(stored).items[0].from,'vlad');
 v.ws.terminate();await server.close();server=await startServer({port:0,dataDir:dir,testNoCodes:true});
 const a=await connect('alina');assert.equal(a.packet.type,'ready');if(a.packet.type==='ready')assert.equal(unreadMessages(a.packet.state,'alina')[0].text,'Купи молоко ♡');
 const v2=await connect('vlad');const read=wait(v2.ws,p=>p.type==='snapshot'&&messagesFor(p.state).read.alina===1);a.ws.send(JSON.stringify({type:'family_message_read',through:1}));await read;
 const reply=wait(v2.ws,p=>p.type==='snapshot'&&messagesFor(p.state).items.length===2);a.ws.send(JSON.stringify({type:'family_message_send',text:'Хорошо!'}));await reply;
 assert.equal(unreadMessages(openServerFiles(dir).load(),'vlad')[0].text,'Хорошо!');
 }finally{for(const ws of sockets)ws.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
});
