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
for(const pet of ['simba','verdell']){
  Object.assign(state.pets[pet],{satiety:85,energy:85,happiness:93,bond:88});
  state.petBowls[pet]=2;
}
files.save(state);
const errors=[],results=[];
let server,browser,buddy;
try{
  server=await startServer({port:0,host:'127.0.0.1',dataDir:saves,distDir:resolve('dist'),testNoCodes:true,
    taskTimeScale:1});
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
  buddy.send(JSON.stringify({type:'auth',role:'alina',code:'TEST-LOCAL-NO-CODES'}));
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  await wait(1100);
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
  for(let i=2;i<=5;i++){
    await wait(3200);
    await makeShot('0'+i+'-living-characters-and-pets');
  }
  const final=files.load();
  if(final.characters.vlad.mood>18||final.characters.alina.mood<80)
    errors.push('Fixture lost emotional difference before capturing');
  if(!final.pets.simba||!final.pets.verdell)errors.push('Pets are missing from authoritative state');
  writeFileSync(join(out,'results.json'),JSON.stringify({errors,results},null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{
  try{buddy?.close();}catch{}
  try{await browser?.close();}catch{}
  try{await server?.close();}catch{}
  rmSync(saves,{recursive:true,force:true});
}
