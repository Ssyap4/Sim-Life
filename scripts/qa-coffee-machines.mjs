import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {initialElectronics} from '../src/shared/electronics.ts';
import {KITCHEN_WORK} from '../src/shared/home.ts';
import {stationById,approachFor} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-coffee-machines';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{
 for(const mode of ['shop','coffeePremium']){
  const dir=mkdtempSync(join(tmpdir(),'coffee-'));let server,page;const errors=[];
  try{
   const s=initialState();s.money=100000;s.autonomy.vlad=s.autonomy.alina='off';s.pantry.beansJardin=3;s.characters.vlad.energy=35;
   if(mode==='shop'){
    s.world.places.vlad='electronics';
    Object.assign(s.characters.vlad,approachFor(stationById('electronics','tech-cash'),'vlad'),{pose:'idle'});
   }else{
    s.world.electronics={...initialElectronics(),coffee:mode};
    Object.assign(s.characters.vlad,KITCHEN_WORK.coffee.position,{pose:'idle'});
   }
   openServerFiles(dir).save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);if(this.url.includes('/sync')){window.qaSocket=this;this.addEventListener('message',e=>{const p=JSON.parse(e.data);if(p.type==='snapshot'||p.type==='ready')window.qaState=p.state;if(p.type==='task_started')window.qaTask=p;if(p.type==='task_ended')window.qaEnded=p;});}}};});
   await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('.enter-button').waitFor({timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.waitForTimeout(1600);
   const send=c=>page.evaluate(c=>window.qaSocket.send(JSON.stringify(c)),c);
   if(mode==='shop'){
    await page.screenshot({path:join(out,'showroom.jpg'),type:'jpeg',quality:85});
    await send({type:'electronics_buy',model:'coffeeBasic'});
    await page.waitForFunction(()=>window.qaState?.world.electronics?.coffee==='coffeeBasic');
   }else{
    await send({type:'brew_coffee',blend:'beansJardin',drink:'Капучино'});
    await page.waitForFunction(()=>window.qaTask?.command?.drink==='Капучино');
    await page.locator('#showcase-toggle').click();await page.locator('[data-showcase=vlad]').click();await page.waitForTimeout(2500);
    await page.screenshot({path:join(out,'home-brew.jpg'),type:'jpeg',quality:85});
    await page.waitForFunction(()=>window.qaEnded?.outcome==='completed',undefined,{timeout:30000});
    await page.waitForFunction(()=>window.qaState?.pantry?.beansJardin===2);
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2&&!!document.querySelector('canvas')&&document.querySelector('canvas').width>250&&!document.querySelector('#graphics-recovery')));
   assert.deepEqual(errors,[]);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
}finally{await browser.close();}