import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {HOME_PLACEMENTS,homeSeat} from '../src/shared/home.ts';
import {applyFurnishing} from '../server/furnishing.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-043-consoles';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'console-match-mobile-'));let server,browser;
try{
 let s=initialState();s.autonomy={vlad:'off',alina:'off'};s.money=100000;
 for(const [id,sku,x] of [[1,'console-ps5',-.60],[2,'console-switch2',.60]]){
  s.furnishing.stored.push({id,sku,finish:'ivory'});s.furnishing.nextId=id+1;
  const r=applyFurnishing(s,'vlad',{type:'furniture_place',id,x:HOME_PLACEMENTS.tv.x+x,z:HOME_PLACEMENTS.tv.z+.04,rotation:0},0);assert.ok(r.ok);s=r.state;
 }
 for(const role of ['vlad','alina'])Object.assign(s.characters[role],homeSeat('sofa',role).approach);
 s.consoleLibrary=['ufc6','marioKart'];openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const errors=[];
 async function joinPlayer(role){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>{const Original=window.WebSocket;window.__qaMessages=[];window.WebSocket=class extends Original{constructor(...args){super(...args);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaMessages.push(JSON.parse(e.data));}catch{}});}};});
  await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
  await page.locator('[data-role='+role+']').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
  return page;
 }
 const v=await joinPlayer('vlad'),a=await joinPlayer('alina');
 const send=(p,command)=>p.evaluate(cmd=>window.__qaSocket.send(JSON.stringify(cmd)),command);
 await send(v,{type:'social_propose',action:'consoleTogether',item:'ufc6'});
 await a.waitForFunction(()=>window.__qaMessages.some(m=>m.type==='social_pending'),undefined,{timeout:30000});
 const invite=await a.evaluate(()=>window.__qaMessages.find(m=>m.type==='social_pending').offer.id);
 await send(a,{type:'social_reply',inviteId:invite,choice:0});
 await v.waitForFunction(()=>window.__qaMessages.some(m=>m.type==='task_active'&&m.role==='vlad')&&window.__qaMessages.some(m=>m.type==='task_active'&&m.role==='alina'),undefined,{timeout:30000});
 await v.waitForTimeout(2500);
 await v.screenshot({path:join(out,'ufc-pair-vlad.jpg'),type:'jpeg',quality:94});
 await a.screenshot({path:join(out,'ufc-pair-alina.jpg'),type:'jpeg',quality:94});
 await v.waitForTimeout(1700);await v.screenshot({path:join(out,'ufc-pair-later.jpg'),type:'jpeg',quality:94});
 assert.deepEqual(errors,[]);await v.close();await a.close();
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}