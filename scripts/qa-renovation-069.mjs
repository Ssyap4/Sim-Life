import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {stationById,approachFor} from '../src/shared/locations.ts';
import {renovationQuote,coveringById} from '../src/shared/renovation.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-069-renovation';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'renovation-069-'));let browser,server;const pages=[];
try{
 const s=initialState();s.money=200000;s.autonomy={vlad:'off',alina:'off'};s.furnishing.placed.push({id:1,sku:'dresser-nora',finish:'oak',x:14,z:-6,rotation:0});s.furnishing.nextId=2;
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car'),'vlad'));
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const errors=[];
 async function login(role,width,height){const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync')){window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}}};});await p.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});await p.locator('[data-role='+role+']').first().tap();await p.locator('.enter-button').tap();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;}
 const shot=async(p,name,log=false)=>{const path=join(out,name+'.jpg');await p.screenshot({path,type:'jpeg',quality:75,timeout:20000});if(log){const b64=readFileSync(path).toString('base64');for(let i=0;i<b64.length;i+=4000)console.log('RENOVATION_IMAGE '+name+' '+(i/4000)+' '+b64.slice(i,i+4000));}};
 const send=(p,c)=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),c);
 const snap=(p,expr,arg)=>p.waitForFunction(expr,arg,{timeout:45000});
 const v=await login('vlad',390,844),a=await login('alina',320,568);
 const panel=p=>p.locator('#location-panel');
 async function approach(p,place,station){await send(p,{type:'approach',place,station});await p.locator('#location-panel[data-station='+station+']:not([hidden])').waitFor({timeout:45000});}
 const close=p=>panel(p).locator('.close-actions').tap();
 await approach(v,'home','family-car');
 await panel(v).getByRole('button',{name:/ДомСтрой/}).tap();
 await snap(v,()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.places.vlad==='buildshop'));
 await v.locator('#car-ride').waitFor({state:'hidden',timeout:30000});await v.waitForTimeout(1000);await shot(v,'01-shop-390',true);
 await approach(v,'buildshop','build-walls');await panel(v).locator('[data-renovation-sample=wall-linen-sage]').tap();
 await snap(a,()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.renovation?.samples.includes('wall-linen-sage')));
 await shot(v,'02-wall-catalogue-390',true);await close(v);
 await approach(v,'buildshop','build-floors');await panel(v).locator('[data-renovation-sample=floor-parquet-oak]').tap();
 await snap(a,()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.renovation?.samples.includes('floor-parquet-oak')));
 await shot(v,'03-floor-catalogue-390');await close(v);
 await approach(v,'buildshop','build-light');
 for(const sku of ['ceiling-flush','ceiling-ring','ceiling-pendant','ceiling-globe','ceiling-rail','ceiling-crystal']){const b=panel(v).locator('[data-renovation-sample='+sku+']');await b.tap();await snap(v,sku=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.renovation?.samples.includes(sku)),sku);}
 await shot(v,'07-ceiling-shop-390',true);await close(v);
 await approach(v,'buildshop','build-portable');
 for(const sku of ['lamp-table-globe','lamp-lantern']){const b=panel(v).locator('[data-renovation-sample='+sku+']');await b.tap();await snap(v,sku=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.renovation?.samples.includes(sku)),sku);}
 await shot(v,'08-lamp-shop-390',true);await close(v);
 assert.equal(files.load().money,200000);
 await send(v,{type:'approach',place:'buildshop',station:'build-exit'});
 await snap(v,()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.places.vlad==='home'&&p.state.world.renovation?.samples.length===10));
 await v.locator('#car-ride').waitFor({state:'hidden',timeout:30000});
 async function open(p){await p.locator('#phone-btn').tap();await p.locator('[data-phone-app=renovation]').tap();await panel(p).locator('[data-renovation-room]').waitFor();}
 async function choose(p,room,kind,sku){await panel(p).locator('[data-renovation-room]').selectOption(room);await panel(p).locator('[data-renovation-kind='+kind+']').tap();await panel(p).locator('[data-renovation-sku]').selectOption(sku);}
 await open(v);await choose(v,'bedroom','wall','wall-linen-sage');
 await panel(v).locator('[data-renovation-preview]').tap();
 await snap(v,()=>JSON.parse(document.querySelector('#game-canvas').dataset.renovationPreview||'null')?.sku==='wall-linen-sage');
 assert.equal(await a.locator('#game-canvas').evaluate(c=>JSON.parse(c.dataset.renovationInstalled||'{}').bedroom),undefined);
 assert.equal(files.load().money,200000);await shot(v,'04-wall-preview-390',true);
 await panel(v).locator('[data-renovation-cancel]').tap();
 await snap(v,()=>JSON.parse(document.querySelector('#game-canvas').dataset.renovationPreview||'null')===null);
 assert.deepEqual(files.load().world.renovation.surfaces,{});assert.equal(files.load().money,200000);
 await panel(v).locator('[data-renovation-preview]').tap();await panel(v).locator('[data-renovation-install]').tap();
 for(const p of [v,a])await snap(p,()=>JSON.parse(document.querySelector('#game-canvas').dataset.renovationInstalled||'{}').bedroom?.wall==='wall-linen-sage');
 const wallPrice=renovationQuote('bedroom',coveringById('wall-linen-sage')).total;
 assert.equal(files.load().money,200000-wallPrice);await close(v);
 await open(a);await choose(a,'bedroom','floor','floor-parquet-oak');await panel(a).locator('[data-renovation-preview]').tap();
 assert.equal(await panel(a).evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 await shot(a,'05-floor-preview-320',true);await panel(a).locator('[data-renovation-install]').tap();
 for(const p of [v,a])await snap(p,()=>JSON.parse(document.querySelector('#game-canvas').dataset.renovationInstalled||'{}').bedroom?.floor==='floor-parquet-oak');
 assert.equal(files.load().money,200000-wallPrice-renovationQuote('bedroom',coveringById('floor-parquet-oak')).total);
 await shot(a,'06-installed-320');await close(a);
 await open(v);
 for(const sku of ['ceiling-flush','ceiling-ring','ceiling-pendant','ceiling-globe','ceiling-rail','ceiling-crystal']){
  await choose(v,'living','ceiling',sku);await panel(v).locator('[data-renovation-preview]').tap();
  await snap(v,sku=>JSON.parse(document.querySelector('#game-canvas').dataset.renovationPreview||'null')?.sku===sku,sku);
  await v.waitForTimeout(300);await shot(v,'preview-'+sku,true);await panel(v).locator('[data-renovation-cancel]').tap();
 }
 await choose(v,'living','ceiling','ceiling-ring');await panel(v).locator('[data-renovation-preview]').tap();await panel(v).locator('[data-renovation-install]').tap();
 for(const p of [v,a])await snap(p,()=>JSON.parse(document.querySelector('#game-canvas').dataset.renovationInstalled||'{}').living?.ceiling==='ceiling-ring');
 await close(v);await open(a);await choose(a,'living','ceiling','ceiling-ring');
 for(const [mode,level] of [['warm',1],['soft',.45],['off',0]]){await panel(a).locator('[data-room-light='+mode+']').tap();for(const p of [v,a])await snap(p,({mode,level})=>JSON.parse(document.querySelector('#game-canvas').dataset.renovationModes||'{}').living===mode&&Math.abs((JSON.parse(document.querySelector('#game-canvas').dataset.ceilingQA||'{}').living?.level??-1)-level)<.001,{mode,level});}
 await close(a);await open(v);
 await choose(v,'wing1','portable','lamp-lantern');await panel(v).locator('[data-renovation-preview]').tap();await shot(v,'09-floor-lamp-preview-390',true);await panel(v).locator('[data-renovation-cancel]').tap();
 await choose(v,'wing1','portable','lamp-table-globe');await panel(v).locator('[data-renovation-preview]').tap();await shot(v,'10-table-lamp-preview-390',true);await panel(v).locator('[data-renovation-install]').tap();
 for(const p of [v,a])await snap(p,()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.furnishing.orders.some(i=>i.sku==='lamp-table-globe')));
 assert.equal(files.load().money,200000-wallPrice-renovationQuote('bedroom',coveringById('floor-parquet-oak')).total-renovationQuote('living',coveringById('ceiling-ring')).total-renovationQuote('wing1',coveringById('lamp-table-globe')).total);
 assert.deepEqual(errors,[]);
 console.log('RENOVATION 069 MOBILE OK');
}catch(e){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:join(out,'failure-'+i+'.jpg')}).catch(()=>{});throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
