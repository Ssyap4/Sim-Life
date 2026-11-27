import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../server/server.ts';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
const out='/tmp/simourhome-063-coop';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'sim063-coop-'));let server,browser;
const report={},errors=[];
try{
 const s=initialState();s.autonomy={vlad:'off',alina:'off'};openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:.025,
 lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 async function enter(role,width,height){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(role+': '+e.message));
  await page.addInitScript(()=>{
   const Native=window.WebSocket;window.__qaSockets=[];window.__qaReady=0;window.__qaClock=0;
   window.WebSocket=class extends Native{constructor(...a){super(...a);if(!this.url.includes('/sync'))return;
    window.__qaSocket=this;window.__qaSockets.push(this);
    this.addEventListener('message',e=>{
     if(window.__qaMute===this){e.stopImmediatePropagation();return;}
     const p=JSON.parse(e.data);
     if(p.type==='ready'){window.__qaReady++;window.__qaState=p.state;window.__qaOnline=p.online;}
     if(p.type==='snapshot')window.__qaState=p.state;
     if(p.type==='online')window.__qaOnline=p.online;
     if(p.type==='clock_sync')window.__qaClock++;
    });
   }};
  });
  await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.enter-button:enabled').waitFor({timeout:90000});
  await page.locator('[data-role='+role+']').click();await page.locator('.enter-button').click();
  await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
  await page.waitForFunction(()=>window.__qaReady===1);
  return page;
 }
 const v=await enter('vlad',390,844),a=await enter('alina',360,780);
 await v.waitForFunction(()=>window.__qaOnline?.length===2);
 await a.waitForFunction(()=>window.__qaOnline?.length===2);
 const initial=await a.evaluate(()=>window.__qaState.revision);
 await v.evaluate(()=>{window.__qaMute=window.__qaSocket;window.__qaMuteStart=performance.now();});
 await a.evaluate(()=>window.__qaSocket.send(JSON.stringify({type:'act',actionId:'alinaStudy'})));
 await a.waitForFunction(rev=>window.__qaState.revision>rev,initial,{timeout:30000});
 const updated=await a.evaluate(()=>window.__qaState.revision);
 await v.waitForFunction(()=>window.__qaReady===2&&window.__qaOnline?.length===2,undefined,{timeout:90000});
 await v.waitForFunction(rev=>window.__qaState.revision>=rev,updated);
 assert.equal(await a.evaluate(()=>window.__qaSockets.length),1);
 assert.equal(await v.evaluate(()=>window.__qaSockets.length),2);
 assert.equal(await v.evaluate(()=>window.__qaMute.readyState),3);
 assert.equal(await v.evaluate(()=>window.__qaState.money),await a.evaluate(()=>window.__qaState.money));
 assert.ok(!(await v.locator('#message').textContent()).includes('Соединение потеряно'),'resolved connection warning must not remain on screen');
 await v.locator('#phone-btn').tap();await v.locator('#phone-overlay').waitFor({state:'visible'});
 await a.locator('#phone-btn').tap();await a.locator('#phone-overlay').waitFor({state:'visible'});
 await v.screenshot({path:join(out,'vlad-recovered.png')});await a.screenshot({path:join(out,'alina-continuous.png')});
 Object.assign(report,{initial,updated,vladRevision:await v.evaluate(()=>window.__qaState.revision),vladSockets:2,alinaSockets:1,clockPackets:await a.evaluate(()=>window.__qaClock),bothOnline:true,elapsedMs:await v.evaluate(()=>performance.now()-window.__qaMuteStart)});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{writeFileSync(join(out,'report.json'),JSON.stringify({report,errors},null,2));await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
