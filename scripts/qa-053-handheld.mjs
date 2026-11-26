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
const out='/tmp/simlife-053-handheld-'+role;mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'handheld-053-'));let browser,server,page;
try{
 const s=initialState();s.clock.minute=780;s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 s.furnishing.soldFixtures=['sofa'];s.furnishing.placed=[{id:1,sku:'sofa-luna',x:-2.36,z:2.02,rotation:0,finish:'sage'}];s.furnishing.nextId=2;
 const first=furnitureUseLocation(s,role,1,'sofaScroll');assert.ok(first);
 Object.assign(s.characters[role],first.route.path.at(-1)??first.route.from,{pose:'idle',energy:90,hunger:90});
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:1,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:android?{width:412,height:915}:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}};});
 const send=m=>page.evaluate(m=>window.__qaSocket.send(JSON.stringify(m)),m);
 const shot=name=>page.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:92});
 const take=async(type,predicate=()=>true)=>{for(let i=0;i<800;i++){const p=(await page.evaluate(()=>window.__qaPackets)).find(x=>x.type===type&&predicate(x));if(p)return p;await new Promise(r=>setTimeout(r,60));}throw Error('Missing '+type);};
 const inspect=async()=>{await page.locator('#showcase-toggle').tap();await page.locator('[data-showcase='+role+']').tap();await page.waitForTimeout(1000);};
 const begin=async(action,activity)=>{
  await send({type:'furniture_use',furnitureId:1,action,...(action==='read_book'?{book:'prince'}:{})});
  const t=await take('task_started',p=>p.role===role&&p.command?.action===action);
  await page.waitForFunction(({role,activity})=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors[role];return a.activity===activity&&a.handheld.elapsed>.75&&(activity==='read'?a.handheld.book:a.handheld.phone);},{role,activity},{timeout:45000});
  await inspect();return t;
 };
 const finish=async t=>{await take('task_ended',p=>p.taskId===t.taskId&&p.outcome==='completed');await page.waitForFunction(role=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors[role];return !a.handheld.phone&&!a.handheld.book;},role,{timeout:15000});};
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role='+role+']').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 let task=await begin('sofaScroll','scrollPhone');await shot('01-scroll');await finish(task);
 task=await begin('sofaCall','phone');await shot('02-call');await finish(task);
 task=await begin('read_book','read');await shot('03-reading');
 await page.waitForFunction(role=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors[role];return a.handheld.page&&a.handheld.pageAngle>.5&&a.handheld.pageAngle<2.8;},role,{timeout:30000});
 await shot('04-page-turn');await finish(task);
 assert.deepEqual(errors,[]);console.log('HANDHELD_QA_OK',role);
}catch(e){console.error(e);if(page){console.error(await page.evaluate(()=>({packets:window.__qaPackets?.slice(-8),qa:document.querySelector('#game-canvas')?.dataset.yardQA})).catch(()=>null));await page.screenshot({path:join(out,'failure.jpg')}).catch(()=>{});}throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
