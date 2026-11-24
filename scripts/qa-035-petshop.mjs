import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {once} from 'node:events';
import {initialState} from '../src/shared/protocol.ts';
import {homeSeat} from '../src/shared/home.ts';
import {grantStarterPetFurniture} from '../server/starterPets.ts';
import {runPetRoutines} from '../server/pets.ts';
import {addReadyFood} from '../src/shared/readyFood.ts';
import {stationById,approachFor,clockMinutes,CAFE_MENU} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';

const out='/tmp/simlife-035-petshop';mkdirSync(out,{recursive:true});
const errors=[];let browser;
const auth='TEST-LOCAL-NO-CODES';
async function scenario(s,fn){
 const dir=mkdtempSync(join(tmpdir(),'simlife-035-qa-'));const files=openServerFiles(dir);
 files.save(s);let server,page,buddy;
 try{
  server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const Native=window.WebSocket;
   window.WebSocket=class extends Native{constructor(...args){super(...args);if(this.url.includes('/sync')){window.qaSocket=this;this.addEventListener('message',e=>{const p=JSON.parse(e.data);if(p.type==='snapshot'||p.type==='ready')window.qaState=p.state;if(p.type==='task_started')window.qaTask=p;if(p.type==='task_ended')window.qaEnded=p;if(p.type==='task_active')window.qaActive=p;});}}};
  });
  buddy=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');await once(buddy,'open');
  buddy.send(JSON.stringify({type:'auth',role:'alina',code:auth}));
  await page.goto('http://127.0.0.1:'+server.port+'/?gfx=full',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.enter-button').waitFor({timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
  await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
  async function capture(name){
   await page.waitForTimeout(650);
   const valid=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2&&!!document.querySelector('canvas')&&document.querySelector('canvas').width>250);
   assert.ok(valid,name+' viewport');
   const jpeg=await page.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:62});
   // Log actual browser screenshot bytes in short chunks for the reviewer.
   const b64=jpeg.toString('base64');
   for(let i=0;i<b64.length;i+=8000)console.log('QA_IMAGE '+name+' '+(i/8000)+' '+b64.slice(i,i+8000));
  }
  const send=cmd=>page.evaluate(c=>window.qaSocket.send(JSON.stringify(c)),cmd);
  await fn(page,capture,send,files,buddy);
 }finally{buddy?.terminate();await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
}
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const base=()=>{const s=initialState();s.autonomy.vlad=s.autonomy.alina='off';return s;};
 for(const [station,action] of [['park-badminton','badminton'],['park-picnic','picnic'],['park-swing','swing']]){
  const s=base();
  for(const role of ['vlad','alina']){s.world.places[role]='park';Object.assign(s.characters[role],approachFor(stationById('park',station),role),{pose:'sit',hunger:15});}
  s.world.picnic={portions:{vlad:[{kind:'meal',item:'omelette',expiresAt:clockMinutes(s.clock)+480}],alina:[{kind:'meal',item:'omelette',expiresAt:clockMinutes(s.clock)+480}]}};
  await scenario(s,async(page,shot,send,files,buddy)=>{
   await shot(station+'-overview');
   if(action==='badminton'){
     const accept=raw=>{const p=JSON.parse(raw);if(p.type==='social_pending'&&p.offer.action==='parkBadminton')buddy.send(JSON.stringify({type:'social_reply',inviteId:p.offer.id,choice:0}));};
     buddy.on('message',accept);await send({type:'social_propose',action:'parkBadminton'});
     await page.waitForFunction(()=>window.qaActive&&window.qaTask?.command?.action==='parkBadminton',undefined,{timeout:25000});
     await page.waitForTimeout(3500);await shot('badminton-rally-a');
     await page.waitForTimeout(5500);await shot('badminton-rally-b');
     await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="vlad"]').click();
     await page.waitForTimeout(2500);await shot('badminton-grip');
     buddy.off('message',accept);return;
   }
   await send({type:'local_activity',station,action});
   await page.waitForTimeout(2500);
   await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="vlad"]').click();
   await page.waitForTimeout(700);await shot(station+'-close');
  });
 }
 const s=base();s.money=100000;s.furnishing.soldFixtures=['table','sofa','bed','desk','officeChair','nightstandLeft','nightstandRight'];
 s.furnishing.placed=[{id:1,sku:'leisure-chess',finish:'sage',x:12.5,z:-5.5,rotation:0},{id:2,sku:'leisure-darts',finish:'sage',x:12.5,z:-1.8,rotation:0},{id:3,sku:'leisure-swing',finish:'sage',x:12.5,z:2.7,rotation:0}];s.furnishing.nextId=4;
 await scenario(s,async(page,shot,send)=>{
   await shot('home-leisure-overview');
   await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="vlad"]').click();
   await send({type:'furniture_use',furnitureId:1,action:'chessGame'});await page.waitForTimeout(6000);await shot('home-chess');
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(join(out,'diagnostics.json'),JSON.stringify({errors}));await browser?.close();}
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const base=()=>{const s=initialState();s.autonomy.vlad=s.autonomy.alina='off';s.money=100000;return s;};
 const shop=base();
 shop.world.places.vlad='electronics';
 Object.assign(shop.characters.vlad,approachFor(stationById('electronics','tech-cash'),'vlad'),{pose:'idle'});
 await scenario(shop,async(page,shot,send)=>{
   await shot('showroom-overview');
   await send({type:'electronics_buy',model:'pcCreator'});
   await page.waitForFunction(()=>window.qaState?.world.electronics?.desktop==='pcCreator');
   await shot('showroom-purchased');
 });
 const home=base();
 home.world.electronics={desktop:'pcPro',laptop:'laptopPlus',tv:'tvOLED',phones:{vlad:'phonePro',alina:'phoneLite'}};
 Object.assign(home.characters.vlad,homeSeat('sofa','vlad').approach);
 await scenario(home,async(page,shot,send)=>{
   await shot('home-upgraded');
   await send({type:'act',actionId:'sofaScroll'});
   await page.waitForFunction(()=>window.qaTask?.command?.actionId==='sofaScroll',undefined,{timeout:20000});
   await page.waitForTimeout(3500);
   await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="vlad"]').click();
   await shot('phone-scroll');
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(join(out,'diagnostics.json'),JSON.stringify({errors}));await browser?.close();}
import {districtArrival} from '../src/shared/district.ts';
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const base=()=>{const s=initialState();s.autonomy.vlad=s.autonomy.alina='off';s.money=100000;return s;};
 const street=base();street.world.places.vlad='district';Object.assign(street.characters.vlad,districtArrival('petshop','vlad'),{pose:'idle'});
 await scenario(street,async(page,shot)=>{await shot('petshop-exterior');});
 const shop=base();shop.world.places.vlad='petshop';Object.assign(shop.characters.vlad,approachFor(stationById('petshop','pet-cash'),'vlad'),{pose:'idle'});
 await scenario(shop,async(page,shot,send)=>{
   await shot('petshop-interior');
   await send({type:'pet_food_buy',product:'simba-wet-3'});
   await page.waitForFunction(()=>window.qaState?.pets.simba.foodQueue?.length===10,undefined,{timeout:20000});
   await shot('petshop-purchase');
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(join(out,'diagnostics.json'),JSON.stringify({errors}));await browser?.close();}
