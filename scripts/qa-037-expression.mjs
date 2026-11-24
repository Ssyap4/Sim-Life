import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {recordEmotion,residentEmotion} from '../src/shared/emotions.ts';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-037-expression';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{
 for(const [name,minute,role] of [['happy',750,'vlad'],['sad',750,'vlad'],['tired',750,'alina'],['inspired',750,'alina']]){
  const dir=mkdtempSync(join(tmpdir(),'cottage-'));let server,page;const errors=[];
  try{
   const s=initialState();s.clock.minute=minute;s.autonomy.vlad=s.autonomy.alina='off';s.money=100000;Object.assign(s.characters[role],{x:1.6,z:-2,pose:'idle',hunger:90,energy:name==='tired'?30:90,mood:90,bladder:90,hygiene:90,social:90,fun:90,comfort:90});if(name==='sad')recordEmotion(s,role,'mealBad');if(name==='inspired')recordEmotion(s,role,'study');assert.equal(residentEmotion(s,role).id,name);openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.port+'/?perf=1',{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('.enter-button').waitFor({timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('[data-role='+role+']').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.locator('#showcase-toggle').click();await page.locator('[data-showcase='+role+']').click();
   await page.waitForTimeout(2500);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2&&!!document.querySelector('canvas')&&document.querySelector('canvas').width>250&&!document.querySelector('#graphics-recovery')));
   const shot=await page.screenshot({path:join(out,role+'-'+name+'.jpg'),type:'jpeg',quality:68});
   const b64=shot.toString('base64');for(let i=0;i<b64.length;i+=8000)console.log('QA_IMAGE '+name+' '+i/8000+' '+b64.slice(i,i+8000));
   console.log(name,await page.locator('.performance-probe').innerText());
   assert.deepEqual(errors,[]);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
}finally{await browser.close();}
