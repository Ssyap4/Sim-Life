import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {petApproach} from '../src/shared/pets.ts';
import {HOME_FLOOR} from '../src/shared/home.ts';
import {placeObstacles} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const id=process.argv[2]??'verdell',role=id==='verdell'?'vlad':'alina';
const out='/tmp/simlife-053-pet-contact';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'pet-contact-053-'));let browser,server,page;
try{
 const s=initialState();s.clock.minute=780;s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 const position={x:-.96,z:10.28};
 Object.assign(s.pets[id],{position,satiety:90,happiness:90,energy:90,bladder:90,bond:80});
 delete s.pets[id].routine;
 const approach=petApproach(position,placeObstacles('home',s.furnishing),HOME_FLOOR);assert.ok(approach);
 Object.assign(s.characters[role],approach,{pose:'idle',energy:90,hunger:90});
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:role==='vlad'?{width:390,height:844}:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}};});
 const send=m=>page.evaluate(m=>window.__qaSocket.send(JSON.stringify(m)),m);
 const shot=name=>page.screenshot({path:join(out,id+'-'+name+'.jpg'),type:'jpeg',quality:92});
 const take=async(type,predicate=()=>true)=>{for(let i=0;i<800;i++){const p=(await page.evaluate(()=>window.__qaPackets)).find(x=>x.type===type&&predicate(x));if(p)return p;await new Promise(r=>setTimeout(r,60));}throw Error('Missing '+type);};
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role='+role+']').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 for(const action of ['pet','brush']){
  await send({type:'pet_action',pet:id,action});
  const t=await take('task_started',p=>p.role===role&&p.command?.action===action);
  await page.waitForFunction(({role,action})=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors[role];return a.activity===action&&a.handheld.elapsed>.5;},{role,action},{timeout:45000});
  await page.locator('#showcase-toggle').tap();await page.locator('[data-showcase='+role+']').tap();
  await page.waitForTimeout(700);await shot(action);
  await take('task_ended',p=>p.taskId===t.taskId&&p.outcome==='completed');
 }
 assert.deepEqual(errors,[]);
 console.log('PET_CONTACT_QA_OK',id);
}catch(e){console.error(e);if(page){console.error(await page.evaluate(()=>({packets:window.__qaPackets?.slice(-8),qa:document.querySelector('#game-canvas')?.dataset.yardQA})).catch(()=>null));await shotFallback();}throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
async function shotFallback(){await page.screenshot({path:join(out,id+'-failure.jpg')}).catch(()=>{});}
