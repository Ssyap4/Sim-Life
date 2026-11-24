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

const out='/tmp/simlife-030-visual';mkdirSync(out,{recursive:true});
const errors=[];let browser;
const auth='TEST-LOCAL-NO-CODES';
async function scenario(s,fn){
 const dir=mkdtempSync(join(tmpdir(),'simlife-030-qa-'));const files=openServerFiles(dir);
 files.save(s);let server,page,buddy;
 try{
  server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const Native=window.WebSocket;
   window.WebSocket=class extends Native{constructor(...args){super(...args);if(this.url.includes('/sync')){window.qaSocket=this;this.addEventListener('message',e=>{const p=JSON.parse(e.data);if(p.type==='snapshot'||p.type==='ready')window.qaState=p.state;if(p.type==='task_started')window.qaTask=p;if(p.type==='task_ended')window.qaEnded=p;});}}};
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
 let s=initialState();grantStarterPetFurniture(s);
 s.autonomy.vlad=s.autonomy.alina='off';
 const owner=homeSeat('table','vlad').approach;
 for(const role of ['vlad','alina'])Object.assign(s.characters[role],homeSeat('table',role).approach,{pose:'sit',hunger:15});
 for(const pet of ['verdell','simba'])Object.assign(s.pets[pet],{satiety:60,energy:90,bladder:90});
 runPetRoutines(s,0,clockMinutes(s.clock),new Set(),()=>.2,undefined,new Map([['vlad',owner]]));
 for(const id of ['verdell','simba']){
  const pet=s.pets[id],r=pet.routine;assert.equal(r.kind,'beg');
  pet.position=r.goal;r.route={from:r.goal,path:[]};
 }
 s.meals.omelette=2;addReadyFood(s,'meal','omelette',2,'table');
 await scenario(s,async(page,shot,send,files)=>{
  await shot('01-home-starter-items');
  await send({type:'eat',recipe:'omelette'});
  await page.waitForFunction(()=>window.qaTask?.command.type==='eat',undefined,{timeout:10000});
  await page.waitForTimeout(3500);
  await shot('02-dining-begging');
  for(const id of ['verdell','simba']){
   await page.locator('#showcase-toggle').click();await page.locator('[data-showcase="'+id+'"]').click();
   await page.waitForTimeout(850);await shot('03-'+id+'-begging');
   await page.locator('#showcase-return').click();
  }
  await page.locator('#pets-btn').click();
  await page.locator('#actions .pet-tab').filter({hasText:'Верделл'}).click();
  const treat=page.locator('#actions .pet-action').filter({hasText:'Дать лакомство'});
  await shot('04-treat-menu');assert.ok(await treat.isEnabled());await treat.click();
  await page.waitForFunction(()=>window.qaState?.pets.verdell.treats?.used===1,undefined,{timeout:15000});
  assert.equal(files.load().pets.verdell.treats.used,1);
  await page.locator('#pets-btn').click();await page.locator('#actions .pet-tab').filter({hasText:'Верделл'}).click();
  await shot('05-two-treats-left');
 });
 s=initialState();s.autonomy.vlad=s.autonomy.alina='off';
 for(const role of ['vlad','alina']){
  s.world.places[role]='cafe';Object.assign(s.characters[role],approachFor(stationById('cafe','cafe-center'),role),{pose:'sit',hunger:10});
  const item=role==='vlad'?'tomYum':'bbqRibs';
  s.world.cafe[role]={item,table:'cafe-center',pickedUp:false,orderedAt:clockMinutes(s.clock)-CAFE_MENU[item].minutes,readyAt:clockMinutes(s.clock)};
 }
 await scenario(s,async(page,shot,send)=>{
  await shot('06-cafe-both-guests-served');
  // Clicking a seated table must open its action menu without standing up.
  // Use a real station approach command to reach the real location panel.
  await send({type:'approach',place:'cafe',station:'cafe-center'});
  await page.getByRole('button',{name:/Сесть за столик|Съесть блюдо/}).waitFor({timeout:15000});
  const seat=page.getByRole('button',{name:'Сесть за столик'});
  if(await seat.count()){await seat.click();await page.waitForFunction(()=>window.qaState?.characters.vlad.pose==='sit',undefined,{timeout:15000});}
  await shot('07-cafe-table-panel');
  const talk=page.getByRole('button',{name:/Поболтать за столиком/});
  await talk.waitFor({timeout:10000});await talk.click();await page.getByText('Как прошёл день?',{exact:true}).waitFor({timeout:10000});await shot('08-cafe-talk-menu');
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(join(out,'diagnostics.json'),JSON.stringify({errors}));await browser?.close();}
