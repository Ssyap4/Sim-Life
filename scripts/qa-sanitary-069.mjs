import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {BATH_FIXTURES} from '../src/shared/home.ts';
import {SANITARY,FIXTURE_ROOMS,renovationQuote} from '../src/shared/renovation.ts';
import {DOG_BATH_APPROACH} from '../src/shared/dogBath.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const slot=process.env.QA_SLOT??'bathtub';assert.ok(Object.hasOwn(BATH_FIXTURES,slot));
const products=SANITARY.filter(p=>p.fixture===slot),room=FIXTURE_ROOMS[slot];
const out='/tmp/simourhome-069-sanitary-'+slot;mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'sanitary-069-'));let browser,server;const pages={};
const motion={toilet:['toiletUse','toilet'],shower:['bathShower','shower'],bathtub:['bathFoam','bath'],basin:['bathTeeth','teeth'],wcBasin:['wcWash','washHands']}[slot];
try{
 const s=initialState();s.money=500000;s.clock.minute=780;s.autonomy={vlad:'off',alina:'off'};
 s.world.renovation={surfaces:{},samples:products.map(p=>p.id)};
 Object.assign(s.characters.vlad,BATH_FIXTURES[slot].approach,{pose:'idle'});
 s.pets.verdell.position={...DOG_BATH_APPROACH};s.pets.verdell.cleanliness=33;delete s.pets.verdell.routine;
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:1,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const errors=[];
 async function login(role,width,height){const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});pages[role]=p;p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync')){window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}}};});await p.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&sanitaryQA=1',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});await p.locator('[data-role='+role+']').first().tap();await p.locator('.enter-button').tap();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;}
 const v=await login('vlad',390,844),a=await login('alina',320,568);
 const panel=p=>p.locator('#location-panel'),canvas=p=>p.locator('#game-canvas');
 const send=(p,c)=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),c);
 const snap=(p,expr,arg,timeout=45000)=>p.waitForFunction(expr,arg,{timeout});
 async function shot(p,name,log=true){for(let i=0;i<5;i++){const n=p.locator('.notice-close').first();if(!await n.isVisible())break;await n.evaluate(el=>el.click());}const path=join(out,name+'.jpg');await p.screenshot({path,type:'jpeg',quality:75,timeout:20000});if(log){const b64=readFileSync(path).toString('base64');for(let i=0;i<b64.length;i+=4000)console.log('SANITARY_IMAGE '+name+' '+(i/4000)+' '+b64.slice(i,i+4000));}}
 const focus=(p,on)=>canvas(p).evaluate((c,slot)=>{if(slot)c.dataset.sanitaryFocus=slot;else delete c.dataset.sanitaryFocus;},on?slot:null);
 const readModels=p=>canvas(p).evaluate(c=>JSON.parse(c.dataset.sanitaryModels||'{}'));
 async function open(p){await focus(p,false);await p.locator('#phone-btn').tap();await p.locator('[data-phone-app=renovation]').tap();await panel(p).locator('[data-renovation-room]').waitFor();}
 async function choose(p,sku){await panel(p).locator('[data-renovation-room]').selectOption(room);await panel(p).locator('[data-renovation-kind=sanitary]').tap();await panel(p).locator('[data-renovation-sku]').selectOption(sku);}
 const close=p=>panel(p).locator('.close-actions').tap();
 let previous=null,balance=s.money;const baselines={};
 async function runAction(p,role,sku,command,activity,label){
  await focus(p,true);
  const before=await p.evaluate(()=>window.__qaPackets.length);
  await send(p,command);
  await snap(p,({before,role})=>window.__qaPackets.slice(before).some(m=>m.type==='task_started'&&m.role===role),{before,role},25000);
  const id=await p.evaluate(({before,role})=>window.__qaPackets.slice(before).find(m=>m.type==='task_started'&&m.role===role).taskId,{before,role});
  await snap(p,({role,activity})=>{const q=JSON.parse(document.querySelector('#game-canvas').dataset.sanitaryMotion||'{}')[role];return q?.activity===activity&&q.time>=.7;},{role,activity},55000);
  const q=await canvas(p).evaluate((c,role)=>JSON.parse(c.dataset.sanitaryMotion||'{}')[role],role);
  assert.ok(q.body.every(Number.isFinite)&&q.head.every(Number.isFinite)&&q.hands.flat().every(Number.isFinite));
  const key=role+':'+label;
  if(!sku)baselines[key]=q;else if(baselines[key]&&activity!=='bathe'){
    const b=baselines[key];assert.ok(Math.hypot(...q.root.map((x,i)=>x-b.root[i]))<.16,sku+' '+role+' anchor changed');assert.ok(Math.hypot(...q.body.map((x,i)=>x-b.body[i]))<.24,sku+' '+role+' body changed');
  }
  console.log('SANITARY_MOTION',slot,sku??'stock',role,label,JSON.stringify(q));await shot(p,(sku??'stock')+'-'+role+'-'+label);
  const ended=await p.evaluate(id=>window.__qaPackets.some(m=>m.type==='task_ended'&&m.taskId===id),id);if(!ended)await send(p,{type:'cancel_task',taskId:id});
  await snap(p,id=>window.__qaPackets.some(m=>m.type==='task_ended'&&m.taskId===id),id,20000);
  await snap(p,({role,activity})=>JSON.parse(document.querySelector('#game-canvas').dataset.sanitaryMotion||'{}')[role]?.activity!==activity,{role,activity},20000);
  await focus(p,false);
 }
 async function checkModel(sku){
  for(const [role,p] of Object.entries(pages)){
   await runAction(p,role,sku,{type:'act',actionId:motion[0]},motion[1],motion[0]);
   if(slot==='basin')await runAction(p,role,sku,{type:'act',actionId:'bathWash'},'wash','bathWash');
  }
  if(slot==='bathtub'){
   await runAction(a,'alina',sku,{type:'vanity_care',care:'bathHairWash'},'bath','hair-care');
   if(sku)await runAction(v,'vlad',sku,{type:'pet_action',pet:'verdell',action:'bathe'},'bathe','dog-bath');
  }
 }
 await checkModel(null);
 for(const product of products){
  await open(v);await choose(v,product.id);await panel(v).locator('[data-renovation-preview]').tap();
  await snap(v,({slot,sku})=>JSON.parse(document.querySelector('#game-canvas').dataset.sanitaryModels||'{}')[slot]===sku,{slot,sku:product.id});
  assert.equal((await readModels(a))[slot],previous);assert.equal(files.load().money,balance);
  await shot(v,product.id+'-preview',false);
  await panel(v).locator('[data-renovation-cancel]').tap();await snap(v,({slot,previous})=>JSON.parse(document.querySelector('#game-canvas').dataset.sanitaryModels||'{}')[slot]===previous,{slot,previous});
  assert.equal(files.load().money,balance);
  await panel(v).locator('[data-renovation-preview]').tap();await panel(v).locator('[data-renovation-install]').tap();
  for(const p of [v,a])await snap(p,({slot,sku})=>window.__qaPackets.some(m=>m.type==='snapshot'&&m.state.world.renovation?.fixtures?.[slot]===sku)&&JSON.parse(document.querySelector('#game-canvas').dataset.sanitaryModels||'{}')[slot]===sku,{slot,sku:product.id});
  balance-=renovationQuote(room,product).total;assert.equal(files.load().money,balance);previous=product.id;await close(v);
  await checkModel(product.id);
 }
 assert.deepEqual(errors,[]);console.log('SANITARY MOBILE OK',slot,products.length);
}catch(e){for(const [role,p] of Object.entries(pages))await p.screenshot({path:join(out,'failure-'+role+'.jpg')}).catch(()=>{});throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
