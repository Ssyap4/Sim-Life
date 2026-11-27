import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {spaTogetherTrip} from '../server/locations.ts';
import {stationById,approachFor} from '../src/shared/locations.ts';
import {DISTRICT_OFFSET_Z,DISTRICT_POND} from '../src/shared/district.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const mode=process.argv[2]??'home',out='/tmp/simlife-water-fire-'+mode;
mkdirSync(out,{recursive:true});
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 for(const phase of mode==='spa'?['day']:['day','night']){
  const dir=mkdtempSync(join(tmpdir(),'water-fire-'));let server,page;
  try{
   let s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};
   s.clock.minute=phase==='day'?750:1320;
   if(mode==='spa'){
    const visit=spaTogetherTrip(s,'vlad','package');assert.ok(visit.ok);s=visit.state;
    for(const role of ['vlad','alina'])Object.assign(s.characters[role],approachFor(stationById('spa','spa-pool'),role));
   }else if(mode==='home'){
    s.furnishing.placed=[{id:2,sku:'oasis-pool',finish:'oak',x:-9.95,z:8.1,rotation:0}];s.furnishing.nextId=3;
   }else if(mode==='park'){
    s.world.places.vlad='park';Object.assign(s.characters.vlad,approachFor(stationById('park','park-fire'),'vlad'));
    s.world.campLitUntil=100000;
   }else if(mode==='district'){
    s.world.places.vlad='district';Object.assign(s.characters.vlad,{x:DISTRICT_POND.x-3,z:DISTRICT_POND.z+DISTRICT_OFFSET_Z});
   }else throw Error('unknown mode');
   openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
   await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&waterFireQA=1',{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('.enter-button').waitFor({timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.waitForFunction(m=>document.querySelector('#app')?.getAttribute('data-place')===m,mode,{timeout:30000});
   await page.waitForTimeout(2200);
   const name=mode+'-'+phase,p=join(out,name+'.jpg');
   await page.screenshot({path:p,type:'jpeg',quality:76,timeout:20000});
   const b64=readFileSync(p).toString('base64');for(let i=0;i<b64.length;i+=6000)console.log('WATERQA_IMAGE '+name+' '+(i/6000)+' '+b64.slice(i,i+6000));
   assert.deepEqual(errors,[]);console.log('WATERQA '+name+' rendered without shader/page errors');
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
}finally{await browser?.close();}
