import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-061-walls';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'walls-061-')),nightDir=mkdtempSync(join(tmpdir(),'walls-night-061-'));let browser,server,nightServer;
try{
 const s=initialState();s.clock.minute=750;s.autonomy={vlad:'off',alina:'off'};openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));

 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&sideWallsQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 const canvas=page.locator('#game-canvas');
 await page.waitForFunction(()=>document.querySelector('#game-canvas')?.dataset.sideWalls);
 await page.screenshot({path:join(out,'01-default.png')});
 for(const [view,west,east] of [['front',true,true],['west',false,true],['east',true,false],['bedroom',false,true],['study',true,true],['wing',true,false],['passages',true,true],['kitchen',true,true],['bath',true,true],['basin',true,true],['wc',true,true]]){
  await canvas.evaluate((el,v)=>el.dataset.wallView=v,view);
  await page.waitForFunction(({west,east})=>{const el=document.querySelector('#game-canvas');const w=JSON.parse(el.dataset.sideWalls||'[]');return w[0]?.[1]===west&&w[1]?.[1]===east;},{west,east},{timeout:20000});
  await page.waitForTimeout(1000);
  assert.deepEqual(await canvas.evaluate(el=>JSON.parse(el.dataset.sideWalls)),[['west',west,!west],['east',east,!east]]);
  await page.screenshot({path:join(out,view+'.png')});
 }
 // The actual server owns night time; no synthetic snapshot races the live clock.
 const night=initialState();night.clock.minute=1320;night.autonomy={vlad:'off',alina:'off'};
 openServerFiles(nightDir).save(night);
 nightServer=await startServer({port:0,host:'127.0.0.1',dataDir:nightDir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 await page.close();
 const nightPage=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 nightPage.on('pageerror',e=>errors.push(e.message));
 await nightPage.goto('http://127.0.0.1:'+nightServer.port+'/?cameraQA=1&sideWallsQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await nightPage.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await nightPage.locator('.enter-button').click();await nightPage.locator('#auth').waitFor({state:'hidden',timeout:30000});
 const nc=nightPage.locator('#game-canvas');
 await nc.evaluate(el=>el.dataset.wallView='kitchen');
 await nightPage.waitForFunction(()=>Number(document.querySelector('#game-canvas')?.dataset.cottageLampLevel)>.95,undefined,{timeout:20000});
 await nightPage.waitForTimeout(1500);
 assert.ok(Number(await nc.getAttribute('data-cottage-lamp-level'))>.95);
 await nightPage.screenshot({path:join(out,'kitchen-night.png')}); assert.deepEqual(errors,[]);
 console.log('HOME WALLS QA OK');
}finally{await browser?.close();await server?.close();await nightServer?.close();rmSync(dir,{recursive:true,force:true});rmSync(nightDir,{recursive:true,force:true});}