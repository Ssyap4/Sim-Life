import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-037-cottage';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{
 for(const [name,minute,query] of [['day',750,''],['night',1260,''],['snow',750,'&weather=snow']]){
  const dir=mkdtempSync(join(tmpdir(),'cottage-'));let server,page;const errors=[];
  try{
   const s=initialState();s.clock.minute=minute;s.autonomy.vlad=s.autonomy.alina='off';s.money=100000;Object.assign(s.characters.vlad,{x:1.6,z:-2,pose:'idle'});openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.port+'/?perf=1'+query,{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('.enter-button').waitFor({timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.waitForTimeout(2500);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2&&!!document.querySelector('canvas')&&document.querySelector('canvas').width>250&&!document.querySelector('#graphics-recovery')));
   const shot=await page.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:68});
   const b64=shot.toString('base64');for(let i=0;i<b64.length;i+=8000)console.log('QA_IMAGE '+name+' '+i/8000+' '+b64.slice(i,i+8000));
   console.log(name,await page.locator('.performance-probe').innerText());
   assert.deepEqual(errors,[]);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
}finally{await browser.close();}
