import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {stationById,approachFor} from '../src/shared/locations.ts';
import {weatherAt} from '../src/shared/weather.ts';
import {gameMinutes} from '../src/shared/life.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const night=process.argv.includes('--night');const out='/tmp/simourhome-070-water'+(night?'/night':'');mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'resort-water-070-'));let browser,server,p;const errors=[];
try{
 const s=initialState();s.money=81100;s.autonomy={vlad:'off',alina:'off'};s.clock.minute=900;for(let day=1;day<150;day++){s.clock.day=day;if(weatherAt(s.clock).temp>=23&&weatherAt(s.clock).kind==='clear')break;}assert.ok(weatherAt(s.clock).temp>=20);
 if(night)s.clock.minute=1260;const now=gameMinutes(s.clock);s.world.carDriver='vlad';s.world.places={vlad:'resort',alina:'resort'};s.world.resort={pass:'night',from:now,until:now+1440,guests:['vlad','alina'],eaten:{},pets:['verdell','simba']};
 for(const role of ['vlad','alina'])Object.assign(s.characters[role],approachFor(stationById('resort','resort-pool'),role));
 const files=openServerFiles(dir);files.save(s);server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync')){window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}}};});await p.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&shopDetailQA=1',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled);await p.locator('[data-role=vlad]').first().tap();await p.locator('.enter-button').tap();await p.locator('#auth').waitFor({state:'hidden'});
 const send=c=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),c);const snap=(fn,arg)=>p.waitForFunction(fn,arg,{timeout:90000});const shot=async(name)=>{const b=await p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:80,timeout:60000});const base=b.toString('base64');for(let i=0;i<base.length;i+=4000)console.log('WATER_IMAGE '+name+' '+(i/4000)+' '+base.slice(i,i+4000));};
 await snap(()=>{const q=JSON.parse(document.querySelector('#game-canvas').dataset.cameraPose||'{}');return q.place==='resort'&&q.far>=220&&q.fogFar>=205;});await p.waitForTimeout(1000);await shot(night?'night-overview':'summer-overview');
 if(night){for(const view of ['terrace','rear','fixture','bathroom']){await p.evaluate(view=>document.querySelector('#game-canvas').dataset.shopDetailView=view,view);await p.waitForTimeout(1000);await shot('night-'+view);}}else{
 for(const [station,action,view,label] of [['resort-pool','resortPool','pool','Поплавать в бассейне'],['resort-jacuzzi','resortJacuzzi','jacuzzi','Отдохнуть в джакузи'],['resort-lake','resortLake','fixture','Поплавать в лазурном озере'],['resort-shower','resortShower','bathroom','Принять душ'],['resort-toilet','resortToilet','bathroom','Воспользоваться туалетом']]){
  await p.evaluate(view=>document.querySelector('#game-canvas').dataset.shopDetailView=view,view);await send({type:'approach',place:'resort',station});await p.locator('#location-panel[data-station='+station+']:not([hidden])').waitFor();await p.locator('#location-panel').getByRole('button',{name:label,exact:true}).tap();await snap(action=>window.__qaPackets.some(p=>p.type==='task_started'&&p.command?.action===action),action);await snap(action=>{const q=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}');return action==='resortJacuzzi'||action==='resortToilet'?q.actors?.vlad?.pose==='sit':action==='resortShower'?q.actors?.vlad?.activity==='shower':q.actors?.vlad?.activity==='spaSwim';},action);await p.waitForTimeout(1200);await shot(action);const id=await p.evaluate(()=>window.__qaPackets.findLast(p=>p.type==='task_started'&&p.role==='vlad').taskId);await send({type:'cancel_task',taskId:id});await snap(id=>window.__qaPackets.some(p=>p.type==='task_ended'&&p.taskId===id),id);
 }
 }
 assert.equal(files.load().money,81100);assert.deepEqual(errors,[]);console.log('RESORT WATER 070 MOBILE OK');
}catch(e){if(p){console.log('WATER_DIAGNOSTIC',JSON.stringify(await p.evaluate(()=>({qa:document.querySelector('#game-canvas')?.dataset.yardQA,packets:window.__qaPackets?.filter(x=>x.type!=='snapshot'&&x.type!=='clock_sync').slice(-10)})).catch(()=>null)));await p.screenshot({path:join(out,'failure.jpg')}).catch(()=>{});}throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
