import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {spawn} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';

const out='/tmp/simourhome-060-performance';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'performance-060-'));let browser,server;
const report=[];
try{
 const s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 // Dedicated rendering fixture. This does not edit the live household.
 s.furnishing.placed=[
  {id:101,sku:'bed-aurora',finish:'sage',x:-6.97,z:-5.88,rotation:0},
  {id:102,sku:'nightstand',finish:'sage',x:-4.7,z:-5.88,rotation:0},
 ];
 s.furnishing.nextId=103;
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,
  lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync'))window.__socket=this;}};});
 await page.goto('http://127.0.0.1:'+server.port+'/?perf=1&perfQA=1&cameraQA=1&shopDetailQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 const canvas=page.locator('#game-canvas');
 const read=()=>canvas.evaluate(c=>JSON.parse(c.dataset.resourceReport||'null'));
 async function sample(place,label,revision){
  await page.waitForFunction(({place,revision})=>{const r=JSON.parse(document.querySelector('#game-canvas').dataset.resourceReport||'null');return r?.place===place&&r.calls>0&&Number.isInteger(r.revision)&&(revision===undefined||r.revision===revision);},{place,revision},{timeout:40000});
  await page.waitForTimeout(1100);
  await page.waitForFunction(()=>!document.querySelector('#world-transition')?.hasAttribute('data-pending-place'));
  const r=await read();assert.equal(r.place,place);assert.ok(Number.isInteger(r.revision));assert.ok(r.calls>0&&r.triangles>0);
  const probe=await page.locator('.performance-probe').evaluate(p=>({scope:p.dataset.scope,sample:JSON.parse(p.dataset.sample||'null')}));
  assert.equal(probe.scope,place,'diagnostics follow the scene');
  if(probe.sample)assert.equal(probe.sample.scope,place,'no stale FPS from another scene');
  report.push({label,...r,frame:probe.sample});
  return r;
 }
 const current=structuredClone(s);
 current.revision=1000;
 async function snapshot(){
  current.revision++;
  await page.evaluate(state=>window.__socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'snapshot',state})})),current);
 }
 const first=await sample('home','home-initial');assert.equal(first.models.length,2);
 if(process.env.SIM_STABILITY_AUDIT==='1'){
  const open=async()=>{await page.locator('#phone-btn').tap();await page.locator('[data-phone-app=furnishing]').tap();await page.locator('#furnishing-overlay').waitFor({state:'visible'});};
  await open();
  const search=page.locator('#furnishing-overlay input[type=search]');
  for(const q of ['стол','кровать','диван',''])await search.fill(q);
  await page.locator('[data-furnish-close]').tap();
  await open();await search.fill('');
  const thumbnail=page.locator('.furnish-card-icon img').first();
  await thumbnail.waitFor({timeout:40000});
  const pixels=await thumbnail.evaluate(async img=>{
   await img.decode();const canvas=document.createElement('canvas');canvas.width=32;canvas.height=20;
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,32,20);const data=ctx.getImageData(0,0,32,20).data;
   const colors=new Set();for(let i=0;i<data.length;i+=4)colors.add([data[i]>>4,data[i+1]>>4,data[i+2]>>4].join(','));
   return {width:img.naturalWidth,height:img.naturalHeight,colors:colors.size};
  });
  assert.ok(pixels.width>=300&&pixels.height>=180&&pixels.colors>=8,JSON.stringify(pixels));
  await page.screenshot({path:join(out,'catalog-reopened.png')});
  await page.locator('[data-furnish-close]').tap();
 }
 current.furnishing.placed[1].x+=.2;await snapshot();const moved=await sample('home','moved',current.revision);
 assert.deepEqual(moved.models,first.models,'moving furniture preserves actual mesh identities');
 current.furnishing.placed=current.furnishing.placed.slice(0,1);await snapshot();
 const removed=await sample('home','removed',current.revision);assert.deepEqual(removed.models,[first.models[0]]);
 current.furnishing.placed.push({...s.furnishing.placed[1],x:-4.5});await snapshot();
 const restored=await sample('home','restored',current.revision);assert.equal(restored.models[0][1],first.models[0][1]);
 assert.notEqual(restored.models[1][1],first.models[1][1]);
 async function go(place,label){
  for(const role of ['vlad','alina']){current.world.places[role]=place;Object.assign(current.characters[role],spawn(place,role),{pose:'idle'});}
  await snapshot();return sample(place,label,current.revision);
 }
 // Warm the deterministic scene caches, then repeat identical scene transitions.
 const home=[];
 for(let cycle=1;cycle<=(process.env.SIM_STABILITY_AUDIT==='1'?4:2);cycle++){
  for(const place of (process.env.SIM_STABILITY_AUDIT==='1'?['market','park','spa','lake','electronics','petshop','resort','grooming','buildshop']:['market','park','spa']))await go(place,place+'-'+cycle);
  home.push(await go('home','home-'+cycle));
 }
 for(const visit of home.slice(1))assert.deepEqual(visit.models,home[0].models,'returning home retains furniture models');
 // Persistent global caches can warm on first visit. Identical warmed visits
 // should not keep allocating geometries/textures in the WebGL renderer.
 assert.ok(home[1].geometries<=home[0].geometries+8,JSON.stringify(home));
 assert.ok(home[1].textures<=home[0].textures+8,JSON.stringify(home));
 if(process.env.SIM_STABILITY_AUDIT==='1'){
  const warm=home[1],last=home.at(-1);
  for(const key of ['geometries','textures','programs'])assert.ok(last[key]<=warm[key]+8,JSON.stringify(home));
  assert.ok(last.sceneSwitches>warm.sceneSwitches);
  assert.ok(report.filter(r=>r.sceneSwitches>0).every(r=>Number.isFinite(r.sceneSwitchMs)&&r.sceneSwitchMs>=0));
 }
 // The 0.61 audit adds the remaining active destinations. These synthetic
 // snapshots isolate rendering/resource lifetimes, not server travel rules.
 if(process.env.SIM_LOCATION_AUDIT==='1'){
  for(const place of ['market','park','cafe','petshop','electronics','clothing','lake','fitness','spa','clinic','barber','venue','industrial','education','work-it','work-detail','work-marketing','work-clinic','resort','grooming','buildshop']){
   await go(place,place+'-audit');
   await page.screenshot({path:join(out,place+'-audit.png')});
    if(['market','park','lake','cafe','petshop','clothing','electronics','venue','fitness','spa','barber','clinic','industrial','education','work-it','work-detail','work-marketing','work-clinic','resort','grooming','buildshop'].includes(place)){
     for(const view of ['rear','fixture']){
      await canvas.evaluate((c,v)=>c.dataset.shopDetailView=v,view);
      await page.waitForTimeout(500);
      await page.screenshot({path:join(out,place+'-'+view+'.png')});
     }
     await canvas.evaluate(c=>delete c.dataset.shopDetailView);
    }
  }
  await go('home','home-after-all-destinations');
  // Simulate the partner remaining elsewhere while the local view changes.
  current.world.places.alina='cafe';Object.assign(current.characters.alina,spawn('cafe','alina'),{pose:'idle'});
  await snapshot();await sample('home','split-home-cafe',current.revision);
  current.world.places.vlad='market';Object.assign(current.characters.vlad,spawn('market','vlad'),{pose:'idle'});
  await snapshot();await sample('market','split-market-cafe',current.revision);
  await go('home','home-after-split');
 }
 for(const [width,height] of [[320,568],[360,780],[430,932],[390,844]]){
  await page.setViewportSize({width,height});
  await page.waitForTimeout(650);
  assert.ok(await canvas.evaluate(c=>c.clientWidth>0&&c.clientHeight>0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 }
 await page.screenshot({path:join(out,'home-after-cycles.png')});
 assert.deepEqual(errors,[]);
 console.log('PERFORMANCE QA OK',JSON.stringify(report));
}finally{
 writeFileSync(join(out,'resource-report.json'),JSON.stringify(report,null,2));
 await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});
}