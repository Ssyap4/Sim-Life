import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {once} from 'node:events';
import {initialState} from '../src/shared/protocol.ts';
import {defaultWardrobe} from '../src/shared/previewWardrobe.ts';
import {applyWorld,lakeTogetherTrip} from '../server/locations.ts';
import {stationById,approachFor} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const mode=process.argv[2]??'day';const out='/tmp/simlife-lake-054-'+mode;mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'lake-054-'));let browser,server,buddy,page;
try{
 let s=initialState();s.clock.minute=mode==='night'?1240:750;s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 s.world.wardrobe=defaultWardrobe();s.world.wardrobe.vlad={owned:['signature','polo'],worn:'polo'};s.world.wardrobe.alina={owned:['signature','pink'],worn:'pink'};
 const trip=lakeTogetherTrip(s,'vlad','night',mode==='night');assert.ok(trip.ok);s=trip.state;
 const apply=(role,command)=>{const r=applyWorld(s,role,command);assert.ok(r.ok,JSON.stringify(r));s=r.state;};
 Object.assign(s.characters.vlad,approachFor(stationById('lake','lake-rental'),'vlad'));
 apply('vlad',{type:'lake_rent',category:'tent',item:mode==='night'?'summit':'family'});apply('vlad',{type:'lake_rent',category:'rod',item:mode==='fish'?'float':'spin'});
 Object.assign(s.characters.vlad,approachFor(stationById('lake','lake-pitch-2'),'vlad'));apply('vlad',{type:'lake_pitch',station:'lake-pitch-2'});
 Object.assign(s.characters.vlad,approachFor(stationById('lake','lake-fire-2'),'vlad'));apply('vlad',{type:'lake_fire',station:'lake-fire-2',lit:true});Object.assign(s.characters.alina,{x:-2.95,z:-5.75,pose:'idle'});
 if(mode==='fish'){Object.assign(s.characters.vlad,approachFor(stationById('lake','lake-fish-2'),'vlad'));Object.assign(s.characters.alina,{x:2.5,z:-5,pose:'idle'});}
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:.45,lifeClock:{now:()=>0,tickMs:600000}});
 buddy=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');await once(buddy,'open');buddy.send(JSON.stringify({type:'auth',role:'alina',code:'TEST-LOCAL-NO-CODES'}));
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{const Native=window.WebSocket;window.__packets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync')){window.__socket=this;this.addEventListener('message',e=>{try{window.__packets.push(JSON.parse(e.data))}catch{}});}}};});
 const shot=async(name)=>{await page.waitForTimeout(1700);const p=join(out,name+'.jpg');await page.screenshot({path:p,type:'jpeg',quality:85});const b64=readFileSync(p).toString('base64');for(let i=0;i<b64.length;i+=6000)console.log('LAKEQA_IMAGE '+name+' '+(i/6000)+' '+b64.slice(i,i+6000));};
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&lakeQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.cameraPose||'{}').place==='lake',undefined,{timeout:45000});
 if(mode==='fish'){
  const send=cmd=>page.evaluate(cmd=>window.__socket.send(JSON.stringify(cmd)),cmd);
  const setView=async(v)=>page.locator('#game-canvas').evaluate((el,v)=>el.dataset.lakeView=v,v);
  const original=Math.random;Math.random=()=>.10;
  try{await setView('fishing');await send({type:'local_activity',station:'lake-fish-2',action:'lakeFishFloat'});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').actors?.vlad?.activity==='fishing',undefined,{timeout:15000});await shot('01-fishing');
  await page.waitForFunction(()=>window.__packets.some(p=>p.type==='snapshot'&&p.state.world.lake?.vlad?.catch),undefined,{timeout:60000});await setView('catch');await shot('02-catch');
  await send({type:'lake_catch',keep:true});await page.waitForFunction(()=>window.__packets.some(p=>p.type==='snapshot'&&p.state.world.fishing?.fish?.length===1),undefined,{timeout:10000});
  await send({type:'approach',place:'lake',station:'lake-fire-2'});await page.waitForTimeout(5000);await setView('fire');await send({type:'local_activity',station:'lake-fire-2',action:'lakeCookSoup'});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').actors?.vlad?.activity==='grill',undefined,{timeout:25000});await shot('03-ukha');
  await page.waitForFunction(()=>window.__packets.some(p=>p.type==='snapshot'&&p.state.world.lake?.vlad?.meals?.soup===2),undefined,{timeout:60000});assert.deepEqual(errors,[]);
  console.log('Fishing, catch decision and real fish soup passed');}finally{Math.random=original;}
 }else{
 await shot('01-overview');
 const setView=async(v)=>page.locator('#game-canvas').evaluate((el,v)=>el.dataset.lakeView=v,v);
 for(const v of ['camp','shore','water','fire']){await setView(v);await shot('02-'+v);}
 const send=cmd=>page.evaluate(cmd=>window.__socket.send(JSON.stringify(cmd)),cmd);
 const action=mode==='night'?'lakeCookMarshmallow':'lakeCookSausages';
 await setView('fire');await send({type:'local_activity',station:'lake-fire-2',action});
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').actors?.vlad?.activity==='grill',undefined,{timeout:15000});
 await shot('03-cooking');
 await page.waitForFunction(()=>window.__packets.some(p=>p.type==='task_ended'&&p.role==='vlad'&&p.outcome==='completed'),undefined,{timeout:45000});
 if(mode==='night'){
  await send({type:'approach',place:'lake',station:'lake-pitch-2'});await page.waitForTimeout(3000);await setView('sleep');await send({type:'local_activity',station:'lake-pitch-2',action:'lakeSleep'});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').actors?.vlad?.pose==='sleep',undefined,{timeout:20000});await page.waitForFunction(()=>{const d=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').lakeDog;return d?.visible&&d.mode==='sleep:lake-pitch-2'&&Math.hypot(d.position[0]+4,d.position[2]+6.89)<.45;},undefined,{timeout:25000});await page.getByRole('button',{name:'×',exact:true}).first().click({timeout:1500}).catch(()=>{});await shot('04-sleep-with-dog');
  await page.waitForFunction(()=>window.__packets.some(p=>p.type==='snapshot'&&p.state.characters.vlad.energy===100),undefined,{timeout:90000});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').actors?.vlad?.pose!=='sleep',undefined,{timeout:15000});
 }
 await setView('');
 if(mode==='day')for(const role of ['vlad','alina']){await page.locator('#showcase-toggle').tap();await page.locator('[data-showcase='+role+']').tap();await shot('02-'+role);}
 await send({type:'approach',place:'lake',station:'lake-exit'});
 await page.waitForTimeout(2500);
 await send({type:'travel',place:'district',via:'lake-exit'});
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.cameraPose||'{}').place==='home',undefined,{timeout:35000});
 await page.locator('#showcase-toggle').tap();await page.locator('[data-showcase=vlad]').tap();await shot('03-home-restored');
 assert.deepEqual(errors,[]);
 console.log('Lake scene, active resident wardrobe, return to home and shader runtime passed');
 }
}finally{buddy?.terminate();await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
