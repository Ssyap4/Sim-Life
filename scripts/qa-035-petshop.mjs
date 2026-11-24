import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {once} from 'node:events';
import {homeToysFor,homeToyApproach} from '../src/shared/pets.ts';
import {PET_TOYS} from '../src/shared/petToys.ts';
import {DOG_COMMANDS} from '../src/shared/dogTraining.ts';
import {feedingStation} from '../src/shared/petFeeders.ts';
import {DOG_BATH_APPROACH,DOG_BATH_OWNER} from '../src/shared/dogBath.ts';
import {applyPetAction} from '../server/pets.ts';
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
   await send({type:'pet_furniture_buy',sku:'pet-house-igloo'});
   await page.waitForFunction(()=>window.qaState?.furnishing.stored.some(i=>i.sku==='pet-house-igloo'));
   await shot('petshop-furniture-purchase');
   await send({type:'pet_toy_buy',product:'cat-mouse'});
   await page.waitForFunction(()=>window.qaState?.pets.simba.ownedToys?.includes('cat-mouse'));
 });
 const home=base();grantStarterPetFurniture(home);
 home.furnishing.placed.push({id:home.furnishing.nextId++,sku:'pet-bed-dog-nest',finish:'sage',x:-2.9,z:3.34,rotation:0});
 await scenario(home,async(page,shot)=>{await shot('new-pet-furniture-home');});
 for(const toy of PET_TOYS){
  const s=base();grantStarterPetFurniture(s);const p=s.pets[toy.pet];p.ownedToys=[toy.id];const index=homeToysFor(toy.pet).findIndex(t=>t.id===toy.id),goal=homeToyApproach(toy.pet,index);p.position=goal;p.routine={kind:'toy',target:index,goal,route:{from:goal,path:[]},startedAt:480,until:492};
  await scenario(s,async(page,shot)=>{await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="'+toy.pet+'"]').click();await page.waitForTimeout(1800);await shot('toy-'+toy.id+'-a');await page.waitForTimeout(800);await shot('toy-'+toy.id+'-b');});
 }
 const training=base();grantStarterPetFurniture(training);
 Object.assign(training.characters.vlad,{x:-2.7,z:8.65,pose:'idle'});
 await scenario(training,async(page,shot,send)=>{
  await send({type:'pet_action',pet:'verdell',action:'train-sit'});
  await page.waitForFunction(()=>window.qaState?.pets.verdell.routine?.training?.command==='sit');
  await shot('training-command-network');
 });
 for(const command of DOG_COMMANDS.filter(c=>c!=='fetch')){
  const s=base();grantStarterPetFurniture(s);Object.assign(s.characters.vlad,{x:-2.7,z:8.65,pose:'idle'});
  const r=applyPetAction(s,'vlad','verdell','train-'+command,undefined,()=>0);assert.ok(r.ok);
  const next=r.state,p=next.pets.verdell,lesson=p.routine;const goal=lesson.goal;
  p.position=goal;lesson.route={from:goal,path:[]};
  await scenario(next,async(page,shot)=>{await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="verdell"]').click();await page.waitForTimeout(1600);await shot('training-'+command);});
 }
 const bath=base();grantStarterPetFurniture(bath);bath.pets.verdell.cleanliness=31;
 Object.assign(bath.characters.vlad,DOG_BATH_OWNER,{pose:'idle'});bath.pets.verdell.position={...DOG_BATH_APPROACH};delete bath.pets.verdell.routine;
 await scenario(bath,async(page,shot,send)=>{
  await send({type:'pet_action',pet:'verdell',action:'bathe'});
  await page.waitForFunction(()=>window.qaState?.pets.verdell.routine?.kind==='bath');
  await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="vlad"]').click();
  await page.waitForTimeout(3100);await shot('dog-bath-wet');
  await page.waitForTimeout(6500);await shot('dog-bath-soap');
  await page.waitForTimeout(9000);await shot('dog-bath-rinse');
  await page.waitForFunction(()=>window.qaState?.pets.verdell.cleanliness===100,undefined,{timeout:25000});
  await shot('dog-bath-completed');
 });
 const feeder=base();grantStarterPetFurniture(feeder);
 feeder.furnishing.placed.push({id:feeder.furnishing.nextId++,sku:'pet-feed-verdell-plus',finish:'ivory',x:-2.9,z:3.34,rotation:1});
 feeder.furnishing.placed.push({id:feeder.furnishing.nextId++,sku:'pet-feed-simba-steel',finish:'terracotta',x:-6.26,z:-3.71,rotation:1});
 const station=feedingStation(feeder.furnishing,'verdell');
 Object.assign(feeder.characters.vlad,station.goal,{pose:'idle'});feeder.pets.verdell.satiety=23;feeder.pets.verdell.energy=90;feeder.pets.verdell.bladder=95;
 feeder.pets.verdell.position={...station.goal};delete feeder.pets.verdell.routine;
 feeder.petFood.verdell=10;feeder.pets.verdell.foodQueue=Array(10).fill('verdell-dry-2');
 await scenario(feeder,async(page,shot,send)=>{
  await shot('feeder-installed');
  await send({type:'pet_action',pet:'verdell',action:'loadFeeder'});
  await page.waitForFunction(()=>window.qaState?.pets.verdell.feederReserve?.length===10,undefined,{timeout:20000});await shot('feeder-loaded');
 });
 const fed=structuredClone(feeder);fed.pets.verdell.feederReserve=Array(10).fill('verdell-dry-2');fed.petFood.verdell=0;fed.pets.verdell.foodQueue=[];runPetRoutines(fed,0,480,new Set(['simba']),()=>.99);
 assert.equal(fed.petBowls.verdell,3);
 await scenario(fed,async(page,shot)=>{
  await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="verdell"]').click();await page.waitForTimeout(1500);await shot('feeder-eating');
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(join(out,'diagnostics.json'),JSON.stringify({errors}));await browser?.close();}
