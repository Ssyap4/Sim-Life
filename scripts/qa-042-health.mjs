import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {initialHealth} from '../src/shared/health.ts';
import {approachFor,stationById} from '../src/shared/locations.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simlife-042-health';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
try{for(const place of ['clinic','work-clinic']){
 const dir=mkdtempSync(join(tmpdir(),'health-mobile-'));let page,server;
 try{
  const s=initialState();s.autonomy={vlad:'off',alina:'off'};s.world.places.vlad=place;s.world.carDriver='vlad';s.money=100000;s.health=initialHealth();
  s.health.people.vlad.illness={id:'cold',remaining:2880,diagnosed:false};
  if(place==='work-clinic'){s.world.vetVisit={owner:'vlad',pet:'simba'};s.health.pets.simba.illness={id:'digestive',remaining:2880,diagnosed:false};}
  Object.assign(s.characters.vlad,approachFor(stationById(place,place==='clinic'?'clinic-doctor':'service'),'vlad'));
  openServerFiles(dir).save(s);
  server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
  await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
  await page.waitForTimeout(2600);await page.screenshot({path:join(out,place+'.jpg'),type:'jpeg',quality:90});
  assert.ok(await page.locator('#needs-toggle').evaluate(e=>e.classList.contains('health-alert')));
  await page.locator('#phone-btn').click();await page.locator('[data-phone-app=health]').click();
  const info=page.locator('.phone-info');assert.ok(await info.getByText('Моё здоровье').isVisible());assert.equal(await info.getByRole('button',{name:'Записать к ветеринару'}).count(),2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:join(out,place+'-phone.jpg'),type:'jpeg',quality:90});assert.deepEqual(errors,[]);
 }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
}}finally{await browser.close();}