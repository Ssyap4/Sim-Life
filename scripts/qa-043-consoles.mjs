import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {HOME_PLACEMENTS} from '../src/shared/home.ts';
import {approachFor,stationById} from '../src/shared/locations.ts';
import {applyFurnishing} from '../server/furnishing.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-043-consoles';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{for(const place of ['electronics','home']){
 const dir=mkdtempSync(join(tmpdir(),'console-mobile-'));let page,server;
 try{
  let s=initialState();s.autonomy={vlad:'off',alina:'off'};s.money=100000;
  if(place==='electronics'){s.world.places.vlad=place;s.world.carDriver='vlad';Object.assign(s.characters.vlad,approachFor(stationById(place,'tech-ps5'),'vlad'));}
  else {
   for(const [id,sku,x] of [[1,'console-ps5',-.60],[2,'console-switch2',.60]]){
    s.furnishing.stored.push({id,sku,finish:'ivory'});s.furnishing.nextId=id+1;
    const r=applyFurnishing(s,'vlad',{type:'furniture_place',id,x:HOME_PLACEMENTS.tv.x+x,z:HOME_PLACEMENTS.tv.z+.04,rotation:0},0);assert.ok(r.ok);s=r.state;
   }
   s.consoleLibrary=['ufc6','marioKart'];
  }
  openServerFiles(dir).save(s);
  server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
  await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
  await page.waitForTimeout(2600);await page.screenshot({path:join(out,place+'.jpg'),type:'jpeg',quality:90});
  await page.locator('#phone-btn').click();await page.locator('[data-phone-app=consoles]').click();
  const info=page.locator('.phone-info');assert.ok(await info.getByText('PlayStation 5',{exact:true}).isVisible());assert.equal(await info.getByRole('button',{name:/UFC 6/}).count(),1);
  if(place==='home'){assert.ok(await info.getByRole('button',{name:/UFC 6.*В библиотеке/}).isDisabled());assert.ok(await info.getByRole('button',{name:/Mortal Kombat/}).isEnabled());}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:join(out,place+'-phone.jpg'),type:'jpeg',quality:90});assert.deepEqual(errors,[]);
 }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
}}finally{await browser.close();}