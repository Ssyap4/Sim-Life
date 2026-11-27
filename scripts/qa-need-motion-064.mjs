import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-064-need-motion';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{
 for(const swapped of [false,true]){
  const dir=mkdtempSync(join(tmpdir(),'need-motion-064-'));let server,page;
  try{
   const s=initialState();s.clock.minute=780;s.autonomy={vlad:'off',alina:'off'};
   for(const [i,role] of ['vlad','alina'].entries()){
    const hungry=(i===0)!==swapped;
    Object.assign(s.characters[role],{x:i===0?-1.5:1.5,z:9.5,pose:'idle',hunger:hungry?18:95,energy:hungry?95:18,bladder:95,hygiene:95,mood:70});
   }
   openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
   page=await browser.newPage({viewport:swapped?{width:412,height:915}:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&needMotionQA=1',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled&&!!document.querySelector('.enter-button'),undefined,{timeout:70000});
   await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   for(const [i,role] of ['vlad','alina'].entries()){
    const kind=(i===0)!==swapped?'hunger':'tired';
    await page.locator('#showcase-toggle').click();await page.locator('[data-showcase='+role+']').click();
    await page.waitForFunction(({role,kind})=>{const a=JSON.parse(document.querySelector('#game-canvas').dataset.needMotionState||'{}')[role];return a?.kind===kind&&a.time>=1.15&&a.time<=2.55;},{role,kind},{timeout:120000});
    const name=role+'-'+kind;const shot=await page.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:80});
    // Compact review copy in private CI logs; full screenshot in artifact.
    const b64=shot.toString('base64');for(let i=0;i<b64.length;i+=3000)console.log('QA_IMAGE '+name+' '+b64.slice(i,i+3000));
    await page.locator('#showcase-return').click();
   }
   assert.deepEqual(errors,[]);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
 console.log('NEED MOTION VISUAL OK');
}finally{await browser.close();}
