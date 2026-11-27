import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState,points} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-065-care';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'care-mobile-065-'));let server,browser,page;
try{
 const s=initialState();s.clock.minute=780;s.autonomy={vlad:'off',alina:'off'};Object.assign(s.characters.alina,points.vanity);s.characters.alina.hygiene=95;
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:1,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Original=window.WebSocket;window.__qaMessages=[];window.WebSocket=class extends Original{constructor(...args){super(...args);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaMessages.push(JSON.parse(e.data));}catch{}});}};});
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});
 await page.locator('[data-role=alina]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 const send=cmd=>page.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),cmd);
 async function shot(name){
  for(let i=0;i<8;i++){const close=page.locator('.notice-close').first();if(!await close.isVisible())break;await close.evaluate(el=>el.click());}
  const b=await page.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:80});
  const data=b.toString('base64');for(let i=0;i<data.length;i+=3000)console.log('QA_IMAGE '+name+' '+data.slice(i,i+3000));
 }
 async function start(care,station,activity){
  await send({type:'vanity_care',care});
  await page.waitForFunction(c=>window.__qaMessages.some(m=>m.type==='task_started'&&m.role==='alina'&&m.command.care===c),care,{timeout:20000});
  const id=await page.evaluate(c=>window.__qaMessages.find(m=>m.type==='task_started'&&m.role==='alina'&&m.command.care===c).taskId,care);
  await page.waitForFunction(id=>window.__qaMessages.some(m=>m.type==='task_active'&&m.taskId===id),id,{timeout:45000});
  await page.waitForFunction(({station,activity})=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').actors?.alina;return a?.station===station&&a.activity===activity;},{station,activity},{timeout:20000});
  if(!(await page.locator('#showcase-return').isVisible())){await page.locator('#showcase-toggle').evaluate(el=>el.click());await page.locator('[data-showcase=alina]').evaluate(el=>el.click());}
  await page.waitForTimeout(1000);return id;
 }
 async function cancel(id){await send({type:'cancel_task',taskId:id});await page.waitForFunction(id=>window.__qaMessages.some(m=>m.type==='task_ended'&&m.taskId===id&&m.outcome==='cancelled'),id,{timeout:15000});await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').actors?.alina?.care?.id===null,undefined,{timeout:10000});if(await page.locator('#showcase-return').isVisible())await page.locator('#showcase-return').evaluate(el=>el.click());}
 async function phase(care,kind,min,max){
  await page.waitForFunction(({care,kind,min,max})=>{const q=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}').actors?.alina?.care;return q?.id===care&&q.phase===kind&&q.elapsed>=min&&q.elapsed<=max;},{care,kind,min,max},{timeout:130000});
  const q=await page.evaluate(()=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors.alina.care);
  console.log('CARE_SAMPLE',care,kind,JSON.stringify(q));if(q.error!==null&&q.blend>.98)assert.ok(q.error<.08,care+' '+kind+' contact '+q.error);
  await shot(care+'-'+kind);
 }
 for(const care of ['hydrate','serum','faceMask','handCream','lipCare']){
  const id=await start(care,'furniture','vanity');await phase(care,care==='lipCare'?'lip':'apply',6,10);await cancel(id);
 }
 for(const care of ['bathLavender','bathRose','bathMilk','bathShave','bathRitual']){
  const id=await start(care,'bathtub','bath');await phase(care,'relax',7,13);
  if(care==='bathShave'||care==='bathRitual')await phase(care,'shave',22,28);
  if(care==='bathMilk'||care==='bathRitual')await phase(care,'bodyCream',40,46);
  await cancel(id);
 }
 assert.deepEqual(errors,[]);
 console.log('CARE MOBILE VISUAL OK');
} catch(error){if(page)await page.screenshot({path:join(out,'failure.jpg')}).catch(()=>{});throw error;
} finally{await page?.close();await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
