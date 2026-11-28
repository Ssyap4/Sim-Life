import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../server/server.ts';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
const out='/tmp/simourhome-063-startup';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'sim063-'));
const s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};openServerFiles(dir).save(s);const server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const errors=[],reports=[];
try{
 for(const [width,height,role] of [[320,568,'vlad'],[390,844,'alina']]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  let healthRequested=false,slowModelCompleted=false,healthBeforeSlowModel=false;
  await page.addInitScript(()=>{
   const Native=window.WebSocket;
   window.__qaPackets=[];
   window.WebSocket=class extends Native{
    constructor(...args){super(...args);if(this.url.includes('/sync')){window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}}
    send(data){if(window.__qaHoldDelivery&&JSON.parse(data).type==='delivery_order'){window.__qaHeldDelivery=data;return;}super.send(data);}
   };
  });
  const fallbackWarnings=[];
  page.on('request',req=>{if(new URL(req.url()).pathname==='/health')healthRequested=true;});
  page.on('console',m=>{if(m.type()==='warning'&&/Using previous game asset|Using built-in character/.test(m.text()))fallbackWarnings.push(m.text());});
  if(width===320)await page.route('**/assets/vlad-*.glb',async route=>{
   await new Promise(resolve=>setTimeout(resolve,5200));
   healthBeforeSlowModel=healthRequested;
   slowModelCompleted=true;await route.continue();
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|VALIDATE_STATUS/i.test(m.text()))errors.push(m.text());});
  try{
   let release,seen;const blocked=new Promise(r=>release=r),requested=new Promise(r=>seen=r);
   await page.route('**/assets/main-*.js',async route=>{seen();await blocked;await route.continue();});
   await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
   await requested;
   const cover=page.locator('#boot-cover');await cover.waitFor({state:'visible',timeout:10000});
   assert.equal(await cover.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   await page.screenshot({path:join(out,'boot-'+width+'.png')});release();
   await page.locator('.enter-button:enabled').waitFor({timeout:90000});
   assert.ok(healthRequested);
   if(width===320){assert.ok(slowModelCompleted);assert.ok(healthBeforeSlowModel,'server health starts before slow model completes');}
   assert.deepEqual(fallbackWarnings,[],'normal/slow connection should retain approved characters');
   assert.equal(await page.locator('[data-app-version]').innerText(),JSON.parse((await import('node:fs')).readFileSync('package.json','utf8')).version);
   await page.screenshot({path:join(out,'menu-'+width+'.png')});
   await page.locator('[data-role='+role+']').click();await page.locator('.enter-button').click();
   await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.screenshot({path:join(out,'game-'+width+'.png')});
   // Simulate the cached-page lifecycle; the underlying WebSocket is real.
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
   await page.waitForFunction(async()=>!(await (await fetch('/health')).json()).online,undefined,{timeout:15000});
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
   await page.waitForFunction(async()=>Boolean((await (await fetch('/health')).json()).online),undefined,{timeout:30000});
   await page.locator('#phone-btn').tap();await page.locator('#phone-overlay').waitFor({state:'visible'});
   await page.screenshot({path:join(out,'reconnected-'+width+'.png')});
   if(width===390){
    await page.locator('#phone-overlay [data-phone-app=delivery]').click();
    const market=page.locator('#market-overlay');
    await market.waitFor({state:'visible'});
    await market.locator('.market-adjust:not([disabled])').filter({hasText:/^\+$/}).first().click();
    const order=market.locator('.market-order');
    assert.equal(await order.isEnabled(),true);
    await page.evaluate(()=>window.__qaHoldDelivery=true);
    await order.click();assert.equal(await order.isDisabled(),true);
    assert.ok(await page.evaluate(()=>!!window.__qaHeldDelivery),'test must actually intercept submitted request');
    await page.evaluate(()=>window.__qaSocket.send(JSON.stringify({type:'furniture_order',sku:'stool-cube',finish:'sage',shipping:'express',quantity:1})));
    await page.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='store_event'));
    assert.equal(await order.isDisabled(),true);
    assert.ok(await market.locator('.market-summary-count').innerText().then(s=>s.includes('1')));
    await page.evaluate(()=>window.__qaSocket.send(JSON.stringify({type:'qa-unknown'})));
    await page.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='error'&&p.deliverySequence===undefined));
    assert.equal(await order.isDisabled(),true);
    await page.evaluate(()=>{window.__qaHoldDelivery=false;window.__qaSocket.send(window.__qaHeldDelivery);});
    await page.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.deliveries.some(d=>d.role==='alina')));
    await page.waitForFunction(()=>document.querySelector('#market-overlay .market-summary-count')?.textContent?.includes('Выбери'));
    await page.screenshot({path:join(out,'delivery-confirmed-'+width+'.png')});
   }
   reports.push({width,height,role,reconnected:true,delivery:width===390?'confirmed':undefined});
  }finally{await page.close();}
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
}finally{await browser.close();await server.close();rmSync(dir,{recursive:true,force:true});}
