import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {furnitureUseLocation} from '../src/shared/furnitureUse.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const android=process.argv.includes('android'),role=android?'alina':'vlad';
const out='/tmp/simlife-053-seating-'+role;mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'seating-053-'));let browser,server,page;
try{
 const s=initialState();s.clock.minute=780;s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 s.furnishing.soldFixtures=['sofa','officeChair'];
 s.furnishing.placed=[{id:1,sku:'sofa-luna',x:-2.36,z:2.02,rotation:0,finish:'sage'},
 {id:2,sku:'chair-cloud',x:6.47,z:-2.84,rotation:1,finish:'terracotta'}];s.furnishing.nextId=3;
 const first=furnitureUseLocation(s,role,1,'sofaRest');assert.ok(first);
 Object.assign(s.characters[role],first.route.path.at(-1)??first.route.from,{pose:'idle',energy:90,hunger:90});
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:1,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:android?{width:412,height:915}:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,...(android?{userAgent:'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}:{})});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}};});
 const send=m=>page.evaluate(m=>window.__qaSocket.send(JSON.stringify(m)),m);
 const shot=name=>page.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:92});
 const take=async(type,predicate=()=>true)=>{for(let i=0;i<800;i++){const p=(await page.evaluate(()=>window.__qaPackets)).find(x=>x.type===type&&predicate(x));if(p)return p;await new Promise(r=>setTimeout(r,60));}throw Error('Missing '+type);};
 const inspect=async()=>{await page.locator('#showcase-toggle').tap();await page.locator('[data-showcase='+role+']').tap();await page.waitForTimeout(1000);};
 const seat=async(id,action,name)=>{
  await send({type:'furniture_use',furnitureId:id,action});
  const t=await take('task_started',p=>p.role===role&&p.command?.furnitureId===id);
  assert.equal(t.home.furnitureSeat,true);
  if(id===2){
   await page.waitForFunction(role=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors[role];return a.pose==='idle'&&Math.abs(a.body[1])<.08;},role,{timeout:30000});
   await shot('02-standing');
  }
  const target=t.home.furniturePose;
  await page.waitForFunction(({role,target})=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors[role];return a.pose==='sit'&&Math.hypot(a.body[0]-target.x,a.body[1]-target.y,a.body[2]-target.z)<.09;},{role,target},{timeout:45000});
  await inspect();await shot(name);
  console.log('SEAT_053',role,id,await page.locator('#game-canvas').evaluate(el=>JSON.parse(el.dataset.yardQA)));
  await take('task_ended',p=>p.taskId===t.taskId&&p.outcome==='completed');
  return t;
 };
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role='+role+']').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 await seat(1,'sofaRest','01-purchased-sofa');
 await seat(2,'officeChairSit','03-rotated-armchair');
 assert.deepEqual(errors,[]);
}catch(e){console.error('SEATING_QA_FAILURE',e);if(page)await page.screenshot({path:join(out,'failure.jpg')}).catch(()=>{});throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
