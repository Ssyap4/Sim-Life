import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-061-performances';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'pet-performance-061-'));let browser,server;
try{
 const s=initialState();s.clock.minute=780;s.autonomy={vlad:'off',alina:'off'};
 for(const id of ['verdell','simba']){
  Object.assign(s.pets[id],{position:{x:id==='verdell'?-1.5:1.5,z:9.5},satiety:95,energy:95,bladder:98,happiness:95,bond:80});
  delete s.pets[id].routine;
 }
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&petMotionQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 const canvas=page.locator('#game-canvas');
 for(const [id,gestures] of [['verdell',['sitLook','shake','backStretch','earScratch','yawn']],['simba',['arch','knead','faceWash','stalk','sideStretch','yawn']]]){
  await page.locator('#showcase-toggle').click();await page.locator('[data-showcase='+id+']').click();
  for(const gesture of gestures){
   await canvas.evaluate((el,v)=>el.dataset.petMotion=v,id+':'+gesture);
   await page.waitForFunction(({id,gesture})=>{const p=JSON.parse(document.querySelector('#game-canvas').dataset.petMotionState||'{}')[id];return p?.gesture===gesture&&p.time>=.95&&p.time<2.1;},{id,gesture},{timeout:20000});
   await page.screenshot({path:join(out,id+'-'+gesture+'.png')});
  }
  await page.locator('#showcase-return').click();
 }
 assert.deepEqual(errors,[]);console.log('PET PERFORMANCE VISUAL OK');
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}