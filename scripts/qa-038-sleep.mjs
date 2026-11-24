import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {selectSleepBed} from '../src/shared/bedSleep.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-038-sleep';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{
 for(const scenario of ['starter','purchased']){
  const dir=mkdtempSync(join(tmpdir(),'sleep-'));let server,page;const errors=[];
  try{
   const s=initialState();s.clock.minute=750;s.autonomy.vlad=s.autonomy.alina='off';
   if(scenario==='purchased'){s.furnishing.soldFixtures=['bed'];s.furnishing.placed=[{id:1,sku:'bed-aurora',finish:'sage',x:-6.97,z:-5.88,rotation:1}];s.furnishing.nextId=2;}
   for(const role of ['vlad','alina']){
    const chosen=selectSleepBed(s,role);assert.ok(chosen.ok);
    Object.assign(s.characters[role],chosen.bed.approach,{pose:'sleep',sleepingOn:chosen.bed.id,sleepMode:'full',energy:30});
   }
   openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.port+'/?perf=1',{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('.enter-button').waitFor({timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.waitForTimeout(2500);
   for(const role of ['vlad','alina']){
    await page.locator('#showcase-toggle').click();await page.locator('[data-showcase='+role+']').click();await page.waitForTimeout(1700);
    await page.screenshot({path:join(out,scenario+'-'+role+'.jpg'),type:'jpeg',quality:80});
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2&&!!document.querySelector('canvas')&&document.querySelector('canvas').width>250&&!document.querySelector('#graphics-recovery')));
   console.log(scenario,await page.locator('.performance-probe').innerText());assert.deepEqual(errors,[]);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
}finally{await browser.close();}