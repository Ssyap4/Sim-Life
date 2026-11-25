import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-049-home-light';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{
 for(const [name,minute] of [['morning',420],['day',750],['night',1320]]){
  const dir=mkdtempSync(join(tmpdir(),'polish-home-'));let server,page;const errors=[];
  try{
   const s=initialState();s.clock.minute=minute;s.autonomy={vlad:'off',alina:'off'};
   s.furnishing.placed=[{id:42,sku:'sofa-luna',finish:'oak',x:2.45,z:.05,rotation:2}];s.furnishing.nextId=43;
   openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
   await page.goto('http://127.0.0.1:'+server.port+'/?perf=1',{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('.enter-button').waitFor({timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.waitForTimeout(3000);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2&&document.querySelector('canvas')?.width>250&&!document.querySelector('#graphics-recovery')));
   await page.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:90});
   console.log(name,await page.locator('.performance-probe').innerText());
   await page.locator('#showcase-toggle').click();await page.locator('[data-showcase=vlad]').click();
   await page.waitForTimeout(2500);await page.screenshot({path:join(out,name+'-close.jpg'),type:'jpeg',quality:90});
   assert.deepEqual(errors,[]);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
}finally{await browser.close();}
