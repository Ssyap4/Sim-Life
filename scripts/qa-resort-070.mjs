import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {stationById,approachFor} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-070-resort';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'resort-070-'));let browser,server;const pages=[],errors=[];
try{
 const s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 for(const role of ['vlad','alina'])Object.assign(s.characters[role],approachFor(stationById('home','family-car'),role));
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 async function login(role,width,height){const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});pages.push(p);await p.bringToFront();p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync')){window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}}};});await p.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:90000});await p.locator('[data-role='+role+']').first().tap();await p.locator('.enter-button').tap();await p.locator('#auth').waitFor({state:'hidden',timeout:90000});return p;}
 const send=(p,c)=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),c);
 const snap=(p,expr,arg)=>p.waitForFunction(expr,arg,{timeout:90000});
 const shot=async(p,name)=>{await p.bringToFront();const b=await p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:80,timeout:60000});const base=b.toString('base64');for(let i=0;i<base.length;i+=4000)console.log('RESORT_IMAGE '+name+' '+(i/4000)+' '+base.slice(i,i+4000));};
 const v=await login('vlad',390,844),a=await login('alina',320,568);
 const panel=p=>p.locator('#location-panel');
 async function approach(p,place,station){await p.bringToFront();await send(p,{type:'approach',place,station});await p.locator('#location-panel[data-station='+station+']:not([hidden])').waitFor({timeout:90000});}
 for(const p of [v,a]){await approach(p,'home','family-car');await panel(p).getByRole('button',{name:/Лазурный берег · Сутки/}).tap();}
 for(const p of [v,a]){await p.bringToFront();await snap(p,()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.places.vlad==='resort'&&p.state.world.places.alina==='resort'));await p.locator('#car-ride').waitFor({state:'hidden',timeout:90000});await snap(p,()=>JSON.parse(document.querySelector('#game-canvas').dataset.cameraPose||'{}').place==='resort');await shot(p,p===v?'arrival-390':'arrival-320');}
 assert.equal(files.load().money,81100);
 await approach(v,'resort','resort-terrace');await shot(v,'terrace-menu-390');await panel(v).getByRole('button',{name:'Позавтракать на веранде'}).tap();
 await snap(v,()=>window.__qaPackets.some(p=>p.type==='task_started'&&p.command?.action==='resortBreakfast'));
 await shot(v,'breakfast-390');await snap(v,()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.resort?.eaten.vlad?.includes('0:breakfast')));
 assert.equal(files.load().money,81100);assert.deepEqual(errors,[]);console.log('RESORT 070 MOBILE OK');
}catch(e){for(let i=0;i<pages.length;i++){const p=pages[i];console.log('RESORT_DIAGNOSTIC',i,JSON.stringify(await p.evaluate(()=>({packets:window.__qaPackets?.slice(-5).map(x=>({type:x.type,reason:x.reason,message:x.message})),camera:document.querySelector('#game-canvas')?.dataset.cameraPose,visible:document.visibilityState})).catch(()=>null)));await p.screenshot({path:join(out,'failure-'+i+'.jpg')}).catch(()=>{});}throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
