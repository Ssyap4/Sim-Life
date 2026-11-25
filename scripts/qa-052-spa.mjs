import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {spaTogetherTrip} from '../server/locations.ts';
import {approachFor,stationById} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-052-spa';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'spa-mobile-'));let browser,server;
try{
 const initial=initialState();initial.autonomy={vlad:'off',alina:'off'};initial.money=100000;
 const visit=spaTogetherTrip(initial,'vlad','package');assert.ok(visit.ok);const s=visit.state;
 for(const r of ['vlad','alina'])Object.assign(s.characters[r],approachFor(stationById('spa','spa-pool'),r),{energy:65,hunger:100,hygiene:25,comfort:20,mood:20,fun:20});
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:.6,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const errors=[];
 async function player(role){
  const p=await browser.newPage({viewport:role==='vlad'?{width:390,height:844}:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
  await p.addInitScript(()=>{const Original=window.WebSocket;window.__qaMessages=[];window.WebSocket=class extends Original{constructor(...args){super(...args);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaMessages.push(JSON.parse(e.data));}catch{}});}};});
  await p.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await p.locator('.enter-button').waitFor({timeout:60000});await p.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
  await p.locator('[data-role='+role+']').first().click();await p.locator('.enter-button').click();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;
 }
 const v=await player('vlad'),a=await player('alina');
 const shot=(p,name)=>p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:90});
 const send=(p,cmd)=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),cmd);
 await v.waitForTimeout(1600);await shot(v,'01-spa-overview');
 await v.locator('#phone-btn').click();await v.locator('[data-phone-app=spa]').click();assert.ok(await v.getByText('SPA «Лагуна»',{exact:true}).isVisible());await shot(v,'02-phone');await v.locator('[data-phone-close]').click();
 async function task(p,role,action,station){
  await send(p,{type:'local_activity',action,station});
  await p.waitForFunction(({role,action})=>window.__qaMessages.some(m=>m.type==='task_started'&&m.role===role&&m.command?.action===action),{role,action},{timeout:20000});
  return p.evaluate(({role,action})=>window.__qaMessages.findLast(m=>m.type==='task_started'&&m.role===role&&m.command?.action===action).taskId,{role,action});
 }
 const end=(p,id)=>p.waitForFunction(id=>window.__qaMessages.some(m=>m.type==='task_ended'&&m.taskId===id&&m.outcome==='completed'),id,{timeout:65000});
 const both=await Promise.all([task(v,'vlad','spaPool','spa-pool'),task(a,'alina','spaPool','spa-pool')]);
 await v.locator('[data-focus-shared]').click();await v.waitForFunction(()=>window.__qaMessages.some(m=>m.type==='snapshot'&&m.state.world.spa?.vlad?.progress?.spaPool),undefined,{timeout:30000});await shot(v,'03-pool');await Promise.all([end(v,both[0]),end(a,both[1])]);
 const jacuzzi=await Promise.all([task(v,'vlad','spaJacuzzi','spa-jacuzzi'),task(a,'alina','spaJacuzzi','spa-jacuzzi')]);
 await v.locator('[data-focus-shared]').click();await a.locator('[data-focus-shared]').click();await v.waitForFunction(()=>window.__qaMessages.some(m=>m.type==='snapshot'&&m.state.world.spa?.vlad?.progress?.spaJacuzzi),undefined,{timeout:35000});await shot(v,'04-jacuzzi-vlad');await shot(a,'04-jacuzzi-alina');await Promise.all([end(v,jacuzzi[0]),end(a,jacuzzi[1])]);
 const massages=await Promise.all([task(v,'vlad','spaMassage','spa-massage-v'),task(a,'alina','spaMassage','spa-massage-a')]);
 await v.locator('[data-focus-shared]').click();await v.waitForFunction(()=>window.__qaMessages.some(m=>m.type==='snapshot'&&m.state.world.spa?.vlad?.progress?.spaMassage),undefined,{timeout:35000});await shot(v,'05-massage');await Promise.all([end(v,massages[0]),end(a,massages[1])]);
 const shower=await task(v,'vlad','spaShower','spa-shower-v');await v.locator('[data-focus-shared]').click();await v.waitForTimeout(9000);await shot(v,'05-shower');await end(v,shower);
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
