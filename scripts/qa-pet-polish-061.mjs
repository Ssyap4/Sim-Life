import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {gameMinutes} from '../src/shared/life.ts';
import {PET_BOWL_CAPACITY} from '../src/shared/pets.ts';
import {feedingStation} from '../src/shared/petFeeders.ts';
import {catPerchCandidates} from '../src/shared/CatPerches.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-061-pets';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const errors=[];
try{
 for(const mode of ['floor','meals','perch']){
  const dir=mkdtempSync(join(tmpdir(),'pets-061-'));let server,page;
  try{
   const s=initialState();s.clock.minute=780;s.autonomy={vlad:'off',alina:'off'};
   const now=gameMinutes(s.clock);
   for(const id of ['verdell','simba']){
    const pet=s.pets[id],station=feedingStation(s.furnishing,id);
    const perch=mode==='perch'&&id==='simba'?catPerchCandidates(s.furnishing).find(p=>p.key==='starter:sofa'):undefined;
    const goal=mode==='meals'?station.goal:perch?perch.approach:{x:id==='verdell'?-1.5:1.5,z:9.5};
    Object.assign(pet,{position:goal,satiety:mode==='meals'?28:90,energy:mode==='floor'?20:90,bladder:90,happiness:90,bond:80});
    s.petBowls[id]=mode==='meals'?PET_BOWL_CAPACITY:0;
    pet.routine={kind:mode==='meals'?'eat':perch?'perch':'sleep',target:0,goal,startedAt:now,until:now+60,route:{from:goal,path:[]},...(perch?{perch}:{})};
   }
   openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>errors.push(mode+': '+e.message));
   await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   for(const id of mode==='perch'?['simba']:['verdell','simba']){
    await page.locator('#showcase-toggle').click();
    await page.locator('[data-showcase='+id+']').click();
    await page.waitForTimeout(2800);
    await page.screenshot({path:join(out,mode+'-'+id+'.png')});
    await page.locator('#showcase-return').click();
   }
   assert.deepEqual(errors,[]);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
 console.log('PET POLISH VISUAL OK');
}finally{await browser.close();}