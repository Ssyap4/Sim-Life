import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState,points} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-044-care';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'vanity-mobile-'));let server,browser;
try{
 const s=initialState();s.autonomy={vlad:'off',alina:'off'};s.money=100000;
 Object.assign(s.characters.alina,points.vanity);Object.assign(s.characters.vlad,{x:-6.0,z:-2.86});s.characters.alina.mood=40;s.characters.alina.social=40;
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:.35,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
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
 const a=await player('alina'),v=await player('vlad');
 const send=(p,cmd)=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),cmd);
 const shot=(p,name)=>p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:94});
 await a.waitForTimeout(2000);
 await a.locator('#showcase-toggle').evaluate(el=>el.click());await a.locator('[data-showcase=alina]').evaluate(el=>el.click());await a.waitForTimeout(1500);await shot(a,'alina-before');
 for(const care of ['style','light','perfume','fancy','evening']){
  await send(a,{type:'vanity_care',care});await a.waitForFunction(c=>window.__qaMessages.some(m=>m.type==='task_started'&&m.command.type==='vanity_care'&&m.command.care===c),care,{timeout:15000});
  const id=await a.evaluate(c=>window.__qaMessages.find(m=>m.type==='task_started'&&m.command.care===c).taskId,care);
  await a.waitForFunction(id=>window.__qaMessages.some(m=>m.type==='task_active'&&m.taskId===id),id,{timeout:15000});await a.waitForTimeout(900);await shot(a,care+'-active');
  await a.waitForFunction(id=>window.__qaMessages.some(m=>m.type==='task_ended'&&m.taskId===id&&m.outcome==='completed'),id,{timeout:40000});
 }
 await a.locator('#showcase-return').evaluate(el=>el.click());await a.locator('#showcase-toggle').evaluate(el=>el.click());await a.locator('[data-showcase=alina]').evaluate(el=>el.click());await a.waitForTimeout(1800);await shot(a,'alina-after');await a.locator('#showcase-return').evaluate(el=>el.click());await a.locator('#needs-toggle').click();assert.ok(await a.getByText('✨ Ухоженность',{exact:true}).isVisible());await shot(a,'needs');await a.locator('.care-effects summary').click();await shot(a,'needs-effects');await a.locator('#needs-close').click();
 await send(a,{type:'social_propose',action:'nearTalk:careMakeup'});
 await v.waitForFunction(()=>window.__qaMessages.some(m=>m.type==='social_pending'),undefined,{timeout:20000});await shot(v,'vlad-question');
 const invite=await v.evaluate(()=>window.__qaMessages.find(m=>m.type==='social_pending').offer.id);
 await send(v,{type:'social_reply',inviteId:invite,choice:0});await a.waitForFunction(()=>window.__qaMessages.some(m=>m.type==='social_closed'&&m.phase==='accepted'),undefined,{timeout:15000});await shot(a,'alina-answer');
 await a.waitForFunction(()=>window.__qaMessages.some(m=>m.type==='snapshot'&&m.state.vanity?.makeup?.noticed),undefined,{timeout:20000});
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
