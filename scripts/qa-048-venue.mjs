import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {venueTogetherTrip} from '../server/locations.ts';
import {VENUE_GAMES,venueStation} from '../src/shared/venue.ts';
import {approachFor,stationById} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-048-venue';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'venue-mobile-'));let browser,server;
try{
 const initial=initialState();initial.autonomy={vlad:'off',alina:'off'};initial.money=100000;
 const visit=venueTogetherTrip(initial,'vlad');assert.ok(visit.ok);const s=visit.state;
 for(const r of ['vlad','alina'])Object.assign(s.characters[r],approachFor(stationById('venue','venue-bowling'),r),{energy:100,hunger:100});
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:.5,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const errors=[];
 async function player(role){
  const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
  await p.addInitScript(()=>{const Original=window.WebSocket;window.__qaMessages=[];window.WebSocket=class extends Original{constructor(...args){super(...args);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaMessages.push(JSON.parse(e.data));}catch{}});}};});
  await p.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await p.locator('.enter-button').waitFor({timeout:60000});await p.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
  await p.locator('[data-role='+role+']').first().click();await p.locator('.enter-button').click();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;
 }
 const v=await player('vlad'),a=await player('alina');
 const shot=(p,name)=>p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:90});
 const send=(p,cmd)=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),cmd);
 await v.waitForTimeout(1700);await shot(v,'00-overview');
 for(const game of Object.keys(VENUE_GAMES)){
  await send(v,{type:'social_propose',action:game});
  await a.waitForFunction(g=>window.__qaMessages.some(m=>m.type==='social_pending'&&m.offer.action===g),game,{timeout:15000});
  const invite=await a.evaluate(g=>window.__qaMessages.findLast(m=>m.type==='social_pending'&&m.offer.action===g).offer.id,game);
  await send(a,{type:'social_reply',inviteId:invite,choice:0});
  await v.waitForFunction(g=>window.__qaMessages.some(m=>m.type==='task_started'&&m.role==='vlad'&&m.command?.action===g),game,{timeout:15000});
  const id=await v.evaluate(g=>window.__qaMessages.findLast(m=>m.type==='task_started'&&m.role==='vlad'&&m.command?.action===g).taskId,game);
  await v.waitForFunction(id=>window.__qaMessages.some(m=>m.type==='task_active'&&m.taskId===id),id,{timeout:40000});
  await v.waitForTimeout(3500);await shot(v,game);
  await send(v,{type:'cancel_task',taskId:id});
  await v.waitForFunction(id=>window.__qaMessages.some(m=>m.type==='task_ended'&&m.taskId===id),id,{timeout:20000});
  await v.waitForTimeout(900);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
