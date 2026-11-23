import { chromium } from 'playwright';
import WebSocket from 'ws';
import {once} from 'node:events';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {initialState} from '../src/shared/protocol.ts';
import {startServer} from '../server/server.ts';
import {openServerFiles} from '../server/storage.ts';

const out='/tmp/simlife-027-real-personalities';
mkdirSync(out,{recursive:true});
const saves=mkdtempSync(join(tmpdir(),'sim-life-027-personalities-'));
const files=openServerFiles(saves);
const state=initialState();
Object.assign(state.characters.vlad,{mood:16,energy:32,hunger:78,fun:49});
Object.assign(state.characters.alina,{mood:93,energy:93,hunger:81,fun:83});
// Both residents stand near enough for an actual in-game friendly glance,
// but far enough apart to keep the existing collision separation stable.
Object.assign(state.characters.vlad,{x:-1.0,z:2.38});
// A real walk brings Alina into Vlad's sight AFTER the portrait camera settles.
// Triggering the greeting at initial page load had hidden its 3-second wave.
Object.assign(state.characters.alina,{x:4.2,z:2.38});
for(const pet of ['simba','verdell']){
  Object.assign(state.pets[pet],{satiety:85,energy:85,happiness:93,bond:88});
  state.petBowls[pet]=2;
}
files.save(state);
const errors=[],results=[];
let server,browser,buddy;
try{
  // Freeze only the cloud visual fixture's SERVER tick. Actors and pets
  // still animate normally in real client time, but unrelated legacy
  // autonomous leisure cannot seat Alina at the computer during a mood study.
  server=await startServer({port:0,host:'127.0.0.1',dataDir:saves,distDir:resolve('dist'),testNoCodes:true,
    taskTimeScale:1,lifeClock:{now:()=>0,tickMs:600000}});
  browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
    '--disable-dev-shm-usage',
  ]});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('Page exception: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('Browser: '+m.text().slice(0,220));});
  await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.enter-button').waitFor({state:'visible',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,{timeout:70000});
  await page.locator('.enter-button').click();
  await page.waitForFunction(()=>document.querySelector('#auth')?.hidden===true,{timeout:15000});

  buddy=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');
  await once(buddy,'open');
  const seen=[];
  const waitBuddy=(accepted,timeout=7000)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{buddy.off('message',receive);reject(Error('Timed out waiting for real Alina server packet'));},timeout);
    function receive(raw){
      const packet=JSON.parse(raw.toString());
      if(!accepted(packet))return;
      clearTimeout(timer);buddy.off('message',receive);resolve(packet);
    }
    buddy.on('message',receive);
  });
  const ready=waitBuddy(packet=>packet.type==='ready');
  buddy.send(JSON.stringify({type:'auth',role:'alina',code:'TEST-LOCAL-NO-CODES'}));
  await ready;
  buddy.on('message',raw=>{
    const packet=JSON.parse(raw.toString());
    if(['world_path','world_position','error'].includes(packet.type))seen.push(packet);
  });
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  await wait(550);
  const makeShot=async name=>{
    await page.screenshot({path:join(out,name+'.png'),timeout:26000});
    const data=await page.evaluate(()=>({
      width:document.documentElement.scrollWidth,viewport:window.innerWidth,
      canvas:!!document.querySelector('canvas')&&document.querySelector('canvas').width>250,
      lobbyHidden:document.querySelector('#auth')?.hidden,
      status:document.querySelector('#status')?.textContent,
    }));
    results.push({name,...data});
    if(data.width>data.viewport+2)errors.push(name+': horizontal overflow');
    if(!data.canvas||!data.lobbyHidden)errors.push(name+': real WebGL/client not running '+JSON.stringify(data));
  };
  await makeShot('01-home-unhappy-vlad-happy-alina');
  await makeShot('01b-separated-before-approach');
  // A normal authenticated second player walks toward Vlad. This is a real
  // websocket command, not a direct tweak to a 3D rig or production debug hook.
  // Lock the real existing portrait inspection camera on STATIONARY Vlad
  // *before* Alina enters his proximity radius. Capture every part of the wave.
  await page.locator('#showcase-toggle').click();
  await page.locator('[data-showcase="vlad"]').click();
  await page.waitForTimeout(2000);
  if(!await page.locator('#app').evaluate(el=>el.classList.contains('inspecting')))
    errors.push('Vlad inspection camera failed before greeting film');
  await makeShot('01c-vlad-before-approach');
  const approaching=waitBuddy(p=>p.type==='world_path'&&p.role==='alina');
  buddy.send(JSON.stringify({type:'walk',place:'home',x:1.0,z:2.38}));
  const path=await approaching;
  if(!path.path?.length)errors.push('Real approaching Alina has no server route');
  // 24 actual rendered WebGL frames at a fixed phone viewpoint, 250ms apart.
  // This gives reviewers an actual motion strip, not two unrelated portraits.
  for(let frame=0;frame<24;frame++){
    await wait(240);
    await makeShot('01d-real-greeting-'+String(frame).padStart(2,'0'));
  }
  if(seen.some(p=>p.type==='error'))errors.push('Alina walk was rejected: '+JSON.stringify(seen.filter(p=>p.type==='error')));
  results.push({name:'real-approach-path',points:path.path?.length??0});
  // Actual existing in-game portrait showcase, not an invented camera API.
  // Capture all four in close-up so a human can inspect faces, shoulders,
  // ears, paws and tail; repeat each to see a real animation progression.
  for(const [index,subject] of ['alina','vlad','verdell','simba'].entries()){
    await page.locator('#showcase-toggle').click();
    await page.locator('[data-showcase="'+subject+'"]').click();
    await page.waitForTimeout(900);
    if(!await page.locator('#app').evaluate(el=>el.classList.contains('inspecting')))
      errors.push('The actual 3D character inspection camera did not activate for '+subject);
    await makeShot('0'+(index*2+2)+'-'+subject+'-close-up');
    await wait(subject==='simba'?4900:subject==='verdell'?4200:3000);
    await makeShot('0'+(index*2+3)+'-'+subject+'-gesture');
  }
  const final=files.load();
  if(final.characters.vlad.mood>18||final.characters.alina.mood<80)
    errors.push('Fixture lost emotional difference before capturing');
  if(!final.pets.simba||!final.pets.verdell)errors.push('Pets are missing from authoritative state');
  writeFileSync(join(out,'results.json'),JSON.stringify({errors,results,
    actualApproach:seen.filter(p=>p.type==='world_path'),frameCount:24,
  },null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{
  try{buddy?.close();}catch{}
  try{await browser?.close();}catch{}
  try{await server?.close();}catch{}
  rmSync(saves,{recursive:true,force:true});
}
