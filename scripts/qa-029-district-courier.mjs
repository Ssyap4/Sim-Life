import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {initialState} from '../src/shared/protocol.ts';
import {applyWorld} from '../server/locations.ts';
import {HOME_GATE_INSIDE} from '../src/shared/district.ts';
import {startServer} from '../server/server.ts';
import {openServerFiles} from '../server/storage.ts';

const out='/tmp/simlife-029-district-courier';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'simlife-district-'));
const errors=[],samples={};let server,browser;
try{
 let s=initialState();s.money=100000;s.happiness.vlad.points=5000;
 Object.assign(s.characters.vlad,HOME_GATE_INSIDE);
 const ordered=applyWorld(s,'vlad',{type:'delivery_order',lines:[{id:'grocery:milk',quantity:1}],sequence:0});
 assert.ok(ordered.ok,ordered.ok?'':ordered.reason);
 s=ordered.state;s.clock.minute+=18;openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Native=window.WebSocket;
  window.WebSocket=class extends Native{constructor(...args){super(...args);if(this.url.includes('/sync')){window.qaSocket=this;this.addEventListener('message',e=>{const p=JSON.parse(e.data);if(p.type==='snapshot')window.qaState=p.state;});}}};
 });
 await page.goto('http://127.0.0.1:'+server.port+'/?gfx=full&perf=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('.enter-button').click();
 await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 async function capture(name){
  await page.waitForTimeout(3200);
  samples[name]=await page.locator('.performance-probe').innerText();
  await page.screenshot({path:join(out,name+'.png')});
 }
 async function travel(place){
  await page.locator('#map-btn').click();
  await page.locator('#map-panel [data-place="'+place+'"]').click();
  await page.locator('#app[data-place="'+place+'"]').waitFor({timeout:45000});
 }
 await capture('01-home-courier-waiting');
 await travel('district');
 await capture('02-district');
 await page.locator('#map-btn').click();
 await page.getByRole('button',{name:/Общий вид района/}).click();
 await capture('03-district-overview');
 await travel('home');
 await capture('04-home-return');
 await page.evaluate(()=>window.qaSocket.send(JSON.stringify({type:'approach',place:'home',station:'courier-handoff'})));
 await page.getByRole('button',{name:/Получить у курьера/}).waitFor({timeout:45000});
 await capture('05-handoff-menu');
 await page.getByRole('button',{name:/Получить у курьера/}).click();
 await page.waitForFunction(()=>window.qaState?.world.deliveries[0]?.handedAt!==undefined);
 await capture('06-parcels-after-handoff');
 if(process.env.GITHUB_REF_NAME==='feat/family-car-wishes-029'){
  await page.evaluate(()=>window.qaSocket.send(JSON.stringify({type:'approach',place:'home',station:'family-car'})));
  await page.getByRole('button',{name:/🚗 Супермаркет/}).waitFor({timeout:60000});
  await capture('07-car-menu');
  await page.getByRole('button',{name:/🚗 Супермаркет/}).click();
  await page.locator('#app[data-place="market"]').waitFor({timeout:30000});
  await capture('08-car-market');
  await travel('home');
  await capture('09-car-home-parking');
  assert.equal(await page.evaluate(()=>window.qaState?.world.carDriver),undefined);
  await page.locator('#thought-trigger').click();
  await page.locator('[data-happiness-toggle]').click();
  await page.locator('.happiness-card').first().waitFor();
  await capture('10-happiness-shop');
  const sleep=page.locator('.happiness-card').filter({hasText:'Борьба со сном'});
  await sleep.getByRole('button',{name:/Купить/}).click();
  await page.waitForFunction(()=>window.qaState?.happiness.vlad.stock.energy===1);
  await sleep.getByRole('button',{name:'Активировать'}).click();
  await page.waitForFunction(()=>window.qaState?.happiness.vlad.until.energy>0&&window.qaState.characters.vlad.energy===100);
  await capture('11-happiness-active');
  assert.equal(await page.evaluate(()=>window.qaState.happiness.vlad.points),2750);
 }
 assert.deepEqual(errors,[]);
}finally{
 writeFileSync(join(out,'diagnostics.json'),JSON.stringify({samples,errors},null,2));
 await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});
}
