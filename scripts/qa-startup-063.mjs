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
const s=initialState();s.money=100000;openServerFiles(dir).save(s);const server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const errors=[],reports=[];
try{
 for(const [width,height,role] of [[320,568,'vlad'],[390,844,'alina']]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
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
   reports.push({width,height,role,reconnected:true});
  }finally{await page.close();}
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
}finally{await browser.close();await server.close();rmSync(dir,{recursive:true,force:true});}
