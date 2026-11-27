import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {STATIONS,approachFor} from '../src/shared/locations.ts';
import {DISTRICT_OFFSET_Z,DISTRICT_POND} from '../src/shared/district.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const mode=process.argv[2]??'home',out='/tmp/simlife-world-057-'+mode;
mkdirSync(out,{recursive:true});
const cases=mode==='home'?[['home','day','clear'],['home','night','clear'],['home','rain','rain'],['home','snow','snow']]:mode==='district'?[['district','day','clear'],['district','rain','rain'],['district','snow','snow']]:mode==='park'?[['park','day','clear'],['park','night','clear']]:mode==='shops-a'?[['market','day','clear'],['cafe','night','rain'],['petshop','day','clear']]:[['electronics','day','clear'],['clothing','night','clear'],['education','day','clear']];
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 for(const [place,phase,weather] of cases){
  const dir=mkdtempSync(join(tmpdir(),'world-057-'));let server,page;
  try{
   const s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};
   s.clock.day=weather==='snow'?2:18;s.clock.minute=phase==='night'?1320:750;
   if(place!=='home'){
    s.world.places.vlad=place;
    if(place==='district')Object.assign(s.characters.vlad,{x:DISTRICT_POND.x-3,z:DISTRICT_POND.z+DISTRICT_OFFSET_Z});
    else Object.assign(s.characters.vlad,approachFor(STATIONS[place][0],'vlad'));
   }
   if(place==='park')s.world.campLitUntil=100000;
   openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
   await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&worldArtQA=1&weather='+weather,{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('.enter-button').waitFor({timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.waitForFunction(m=>document.querySelector('#app')?.getAttribute('data-place')===m,place,{timeout:30000});
   await page.waitForTimeout(1700);
   const name=place+'-'+phase,p=join(out,name+'.jpg');
   await page.screenshot({path:p,type:'jpeg',quality:76,timeout:20000});
   const b64=readFileSync(p).toString('base64');for(let i=0;i<b64.length;i+=6000)console.log('WORLDQA_IMAGE '+name+' '+(i/6000)+' '+b64.slice(i,i+6000));
   assert.deepEqual(errors,[]);console.log('WORLDQA '+name+' rendered without shader/page errors');
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
}finally{await browser?.close();}
