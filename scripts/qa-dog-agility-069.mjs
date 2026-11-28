import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {AGILITY_ACTIONS,DOG_AGILITY} from '../src/shared/dogAgility.ts';
import {approachFor,stationById} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-069-agility';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'agility-069-'));let browser,server;const pages=[];
try{
 const s=initialState();s.autonomy={vlad:'off',alina:'off'};s.money=100000;s.world.places={vlad:'park',alina:'park'};
 for(const role of ['vlad','alina'])Object.assign(s.characters[role],approachFor(stationById('park','park-dog'),role),{pose:'idle'});
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const errors=[];
 async function login(role,width,height){const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}};});await p.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&agilityQA=1',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});await p.locator('[data-role='+role+']').first().click();await p.locator('.enter-button').click();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;}
 const send=(p,msg)=>p.evaluate(m=>window.__qaSocket.send(JSON.stringify(m)),msg);
 async function shot(p,name){const bytes=await p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:75});const b=bytes.toString('base64');for(let i=0;i<b.length;i+=3000)console.log('QA_IMAGE '+name+' '+b.slice(i,i+3000));}
 const v=await login('vlad',390,844),a=await login('alina',320,568);
 await send(v,{type:'dog_leash'});await v.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.dogWalker==='vlad'));
 for(const p of [v,a]){await p.locator('#game-canvas').evaluate(c=>c.dataset.agilityView='overview');}await v.waitForTimeout(1000);await shot(v,'course-overview-390');await shot(a,'course-overview-320');
 for(const [i,action] of AGILITY_ACTIONS.entries()){
  const p=i%2?a:v,role=i%2?'alina':'vlad';for(const client of [v,a])await client.locator('#game-canvas').evaluate((c,action)=>c.dataset.agilityView=action,action);await send(p,{type:'local_activity',station:'park-dog',action});
  await p.waitForFunction(({role,action})=>window.__qaPackets.some(p=>p.type==='task_started'&&p.role===role&&p.command?.action===action),{role,action});
  const taskId=await p.evaluate(({role,action})=>window.__qaPackets.findLast(p=>p.type==='task_started'&&p.role===role&&p.command?.action===action).taskId,{role,action});
  if(i===0){await send(a,{type:'local_activity',station:'park-dog',action:'dogTunnel'});await a.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='error'));}

  const {x,z}=DOG_AGILITY[action];
  await p.waitForFunction(({x,z})=>{try{const pos=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).lakeDog.position;return Math.abs(pos[0]-x)<.48&&Math.abs(pos[2]-z)<.55;}catch{return false;}},{x,z},{timeout:19000});
  await shot(p,action+'-'+(i%2?'320':'390'));
  if(i===0){await p.locator('[data-agility-cue]').waitFor();await p.waitForFunction(()=>{const b=document.querySelector('[data-agility-cue]');return b&&!b.disabled;},undefined,{timeout:12000});await p.locator('[data-agility-cue]').click();await a.locator('[data-agility-cue]').click();await a.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='agility_feedback'&&p.role==='alina'));await p.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='agility_feedback'&&p.role==='vlad'));}console.log('AGILITY reached',action,await p.locator('#game-canvas').evaluate(c=>JSON.parse(c.dataset.yardQA).lakeDog));
  await p.waitForFunction(id=>window.__qaPackets.some(p=>p.type==='task_ended'&&p.taskId===id&&p.outcome==='completed'),taskId,{timeout:35000});
  assert.equal(files.load().world.parkDog.agility.attempts,i+1);
 }
 assert.equal(files.load().money,100000);assert.deepEqual(errors,[]);console.log('DOG AGILITY 069 MOBILE OK');
}catch(e){for(let i=0;i<pages.length;i++){const p=pages[i];console.log('AGILITY FAILURE',i,await p.locator('#game-canvas').evaluate(c=>c.dataset.yardQA).catch(()=>''));const bytes=await p.screenshot({path:join(out,'failure-'+i+'.jpg'),type:'jpeg'}).catch(()=>null);if(bytes){const b=bytes.toString('base64');for(let j=0;j<b.length;j+=3000)console.log('QA_IMAGE agility-failure-'+i+' '+b.slice(j,j+3000));}}throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
