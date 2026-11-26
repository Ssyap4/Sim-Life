import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {initialElectronics,electronicsFor} from '../src/shared/electronics.ts';
import {applyFurnishing} from '../server/furnishing.ts';
import {HOME_PLACEMENTS} from '../src/shared/home.ts';
import {applyWorld} from '../server/locations.ts';
import {stationById,approachFor} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const id=process.argv[2],out='/tmp/tv-home-'+id;
mkdirSync(out,{recursive:true});
assert.ok(['tvStart',...electronicsFor('tv')].includes(id));
const dir=mkdtempSync(join(tmpdir(),'tv-home-'));let browser,server,page;
try{
 let s=initialState();s.clock.minute=750;s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 if(id!=='tvStart'){
  s.world.places.vlad='electronics';
  Object.assign(s.characters.vlad,approachFor(stationById('electronics','tech-cash'),'vlad'),{pose:'idle'});
  const r=applyWorld(s,'vlad',{type:'electronics_buy',model:id});assert.ok(r.ok,JSON.stringify(r));s=r.state;
  s.world.places.vlad='home';
 }
 s.world.electronics??=initialElectronics();assert.equal(s.world.electronics.tv,id);
 Object.assign(s.characters.vlad,{x:-3.65,z:1.15,pose:'idle'});
 Object.assign(s.characters.alina,{x:-1.05,z:1.10,pose:'idle'});
 if(id==='tvStart'){s.furnishing.stored.push({id:99,sku:'console-ps5',finish:'ivory'});s.furnishing.nextId=100;const r=applyFurnishing(s,'vlad',{type:'furniture_place',id:99,x:HOME_PLACEMENTS.tv.x-.60,z:HOME_PLACEMENTS.tv.z+.04,rotation:0},0);assert.ok(r.ok);s=r.state;s.consoleLibrary=['ufc6'];}
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.WebSocket;window.__packets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync')){window.__socket=this;this.addEventListener('message',e=>{try{window.__packets.push(JSON.parse(e.data))}catch{}});}}};});
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&tvQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 await page.waitForFunction(id=>JSON.parse(document.querySelector('#game-canvas').dataset.tvQa||'{}').id===id,id,{timeout:45000});
 const shot=async(view,angle=view)=>{
  await page.evaluate(view=>document.querySelector('#game-canvas').dataset.tvView=view,angle);
  await page.waitForTimeout(1700);
  const p=join(out,view+'.jpg');await page.screenshot({path:p,type:'jpeg',quality:85});
  const b64=readFileSync(p).toString('base64');
  for(let i=0;i<b64.length;i+=6000)console.log('TVQA_IMAGE '+id+' '+view+' '+(i/6000)+' '+b64.slice(i,i+6000));
 };
 for(const v of ['front','side'])await shot(v);
 if(id==='tvStart'){
  const send=cmd=>page.evaluate(cmd=>window.__socket.send(JSON.stringify(cmd)),cmd);
  const state=()=>page.locator('#game-canvas').evaluate(el=>JSON.parse(el.dataset.tvQa));
  for(const [command,label] of [[{type:'free_tv'},'broadcast'],[{type:'console_play',game:'ufc6'},'ufc6']]){
   await send(command);
   const started=await page.waitForFunction(type=>window.__packets.find(p=>p.type==='task_started'&&p.role==='vlad'&&p.command?.type===type),command.type,{timeout:30000});
   const task=await started.jsonValue();
   await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.tvQa).screenActive,undefined,{timeout:35000});
   const first=(await state()).screenVersion;
   await page.waitForFunction(v=>JSON.parse(document.querySelector('#game-canvas').dataset.tvQa).screenVersion>v+1,first,{timeout:15000});
   await shot(label,'close');
   await send({type:'cancel_task',taskId:task.taskId});
   await page.waitForFunction(()=>!JSON.parse(document.querySelector('#game-canvas').dataset.tvQa).screenActive,undefined,{timeout:20000});
  }
 }
 console.log('TVQA_BOUNDS',await page.locator('#game-canvas').evaluate(el=>el.dataset.tvQa));
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
