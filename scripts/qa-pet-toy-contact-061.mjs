import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {homeToysFor,homeToyApproach,PET_ROAM} from '../src/shared/pets.ts';
import {petNavigationGeometry,planPetRoute} from '../src/game/PetNavigation.ts';
import {placeObstacles} from '../src/shared/locations.ts';
import {HOME_FLOOR} from '../src/shared/home.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-061-toys';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{
 for(const mode of ['toys','walk']){
  const dir=mkdtempSync(join(tmpdir(),'toy-contact-061-'));let server,page;
  try{
   const s=initialState();s.clock.minute=780;s.autonomy={vlad:'off',alina:'off'};
   const geometry=petNavigationGeometry(placeObstacles('home',s.furnishing),HOME_FLOOR);
   for(const id of ['verdell','simba']){
    const pet=s.pets[id],index=homeToysFor(id).findIndex(t=>t.kind===(id==='verdell'?'rope':'mouse'));
    const toy=homeToysFor(id)[index],goal=homeToyApproach(id,index);
    Object.assign(pet,{position:goal,satiety:95,energy:95,happiness:95,bladder:98,bond:80});
    if('id' in toy)pet.ownedToys=[toy.id];
    if(mode==='toys'){
     pet.routine={kind:'toy',target:index,goal,startedAt:780,until:840,route:{from:goal,path:[]}};
    }else{
     const target=PET_ROAM.reduce((best,p,i)=>Math.hypot(p.x-goal.x,p.z-goal.z)>Math.hypot(PET_ROAM[best].x-goal.x,PET_ROAM[best].z-goal.z)?i:best,0);
     const route=planPetRoute(goal,PET_ROAM[target],geometry);assert.ok(route);
     pet.routine={kind:'wander',target,startedAt:780,until:840,route};
    }
   }
   openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&petMotionQA=1',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   for(const id of ['verdell','simba']){
    await page.locator('#showcase-toggle').click();await page.locator('[data-showcase='+id+']').click();
    await page.waitForFunction(({id,mode})=>{const p=JSON.parse(document.querySelector('#game-canvas').dataset.petMotionState||'{}')[id];return mode==='toys'?p?.routine==='toy'&&p.settled%4.8>1.3&&p.settled%4.8<3.0:p?.gait>.4;},{id,mode},{timeout:20000});
    for(let i=0;i<3;i++){await page.screenshot({path:join(out,mode+'-'+id+'-'+i+'.png')});await page.waitForTimeout(140);}
    await page.locator('#showcase-return').click();
   }
   assert.deepEqual(errors,[]);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
 console.log('PET GAIT AND TOY CONTACT VISUAL OK');
}finally{await browser.close();}