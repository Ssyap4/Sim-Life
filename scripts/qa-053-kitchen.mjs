import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {KITCHEN_WORK} from '../src/shared/home.ts';
import {addReadyFood} from '../src/shared/readyFood.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-053-kitchen';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'kitchen-053-'));let browser,server,page;
try{
 const s=initialState();s.clock.minute=780;s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 s.pantry.eggs=2;s.pantry.milk=1;s.meals.porridge=1;addReadyFood(s,'meal','porridge',1,'table');
 Object.assign(s.characters.vlad,KITCHEN_WORK.stove.position,{pose:'idle',energy:90,hunger:25});
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:1.5,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}};});
 const send=m=>page.evaluate(m=>window.__qaSocket.send(JSON.stringify(m)),m);
 const shot=name=>page.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:92});
 const take=async(type,predicate=()=>true)=>{for(let i=0;i<1200;i++){const p=(await page.evaluate(()=>window.__qaPackets)).find(x=>x.type===type&&predicate(x));if(p)return p;await new Promise(r=>setTimeout(r,60));}throw Error('Missing '+type);};
 const inspect=async()=>{await page.locator('#showcase-toggle').tap();await page.locator('[data-showcase=vlad]').tap();await page.waitForTimeout(500);};
 const waitTool=async(tool,portion=false)=>page.waitForFunction(({tool,portion})=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors.vlad;return a.kitchen.tool===tool&&a.kitchen.error!==null&&a.kitchen.error<.04&&(!portion||a.kitchen.portion);},{tool,portion},{timeout:45000});
 const begin=async(type,recipe)=>{await send({type,recipe});return take('task_started',p=>p.role==='vlad'&&p.command?.type===type&&p.command?.recipe===recipe);};
 const finish=async t=>take('task_ended',p=>p.taskId===t.taskId&&p.outcome==='completed');
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 await inspect();
 let task=await begin('cook','omelette');await waitTool('spoon');await shot('01-whisk');await waitTool('spatula');await inspect();await shot('02-spatula');await finish(task);
 task=await begin('eat','omelette');await waitTool('fork');await inspect();await waitTool('fork',true);await shot('03-fork');await finish(task);
 task=await begin('eat','porridge');await waitTool('spoon');await inspect();await waitTool('spoon',true);await shot('04-spoon');await finish(task);
 assert.deepEqual(errors,[]);console.log('KITCHEN_QA_OK');
}catch(e){console.error(e);if(page){console.error(await page.evaluate(()=>({packets:window.__qaPackets?.filter(m=>['task_started','task_ended','error'].includes(m.type)).slice(-8),qa:document.querySelector('#game-canvas')?.dataset.yardQA})).catch(()=>null));await page.screenshot({path:join(out,'failure.jpg')}).catch(()=>{});}throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
