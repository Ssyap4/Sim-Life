import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {stationById,approachFor} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const id=process.argv[2];assert.ok(id==='verdell'||id==='simba');
const role=id==='verdell'?'vlad':'alina',other=role==='vlad'?'alina':'vlad',action=id==='verdell'?'dogFull':'catFull',price=id==='verdell'?3200:1950;
const out='/tmp/simourhome-070-grooming-'+id;mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'grooming-070-'));let browser,server,p;const errors=[];
try{
 const s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};s.world.carDriver=role;s.world.places[role]='grooming';s.world.groomVisit={owner:role,pet:id};Object.assign(s.characters[role],approachFor(stationById('grooming','grooming-care'),role));
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 p=await browser.newPage({viewport:id==='verdell'?{width:390,height:844}:{width:320,height:568},deviceScaleFactor:1,isMobile:true,hasTouch:true});p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync')){window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}}};});await p.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&shopDetailQA=1',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled);await p.locator('[data-role='+role+']').first().tap();await p.locator('.enter-button').tap();await p.locator('#auth').waitFor({state:'hidden'});
 const send=c=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),c);const snap=(fn,arg)=>p.waitForFunction(fn,arg,{timeout:90000});const shot=async(name)=>{const b=await p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:80,timeout:60000});const base=b.toString('base64');for(let i=0;i<base.length;i+=4000)console.log('GROOM_IMAGE '+name+' '+(i/4000)+' '+base.slice(i,i+4000));};
 await snap(()=>JSON.parse(document.querySelector('#game-canvas').dataset.cameraPose||'{}').place==='grooming');await snap(id=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').pets?.[id]?.visible===true,id);await shot(id+'-arrival');await p.evaluate(()=>document.querySelector('#game-canvas').dataset.shopDetailView='fixture');await send({type:'approach',place:'grooming',station:'grooming-care'});await p.locator('#location-panel[data-station=grooming-care]:not([hidden])').waitFor();await p.locator('#location-panel').getByRole('button',{name:id==='verdell'?/Полный комплекс/:/Деликатный комплекс/}).tap();
 for(const stage of id==='verdell'?['wash','dry','brush','paws']:['brush','paws']){await snap(stage=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').groomStage===stage,stage);await snap(id=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').pets?.[id]?.position[1]>.6,id);await snap(()=>{const q=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}');return Number.isFinite(q.groomContactError)&&q.groomContactError<.13;});await shot(id+'-'+stage);}
 await snap(({role,action,id})=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.pets[id].groomedService===action&&p.state.world.groomVisit.owner===role),{role,action,id});assert.equal(files.load().money,100000-price);assert.equal(files.load().world.places[other],'home');assert.deepEqual(errors,[]);console.log('GROOM 070 MOBILE OK',id);
}catch(e){if(p){console.log('GROOM_DIAGNOSTIC',JSON.stringify(await p.evaluate(()=>({qa:document.querySelector('#game-canvas')?.dataset.yardQA,packets:window.__qaPackets?.filter(x=>x.type!=='snapshot'&&x.type!=='clock_sync').slice(-10)})).catch(()=>null)));await p.screenshot({path:join(out,'failure.jpg')}).catch(()=>{});}throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
