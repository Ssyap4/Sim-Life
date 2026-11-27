import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-061-notices';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'notices-061-'));let browser,server;
try{
 const s=initialState();s.autonomy={vlad:'off',alina:'off'};
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync'))window.__socket=this;}};});
 await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 const bell=page.locator('#notice-bell'),history=page.locator('#notice-history'),wish=page.locator('#thought-trigger');
 const overlaps=(a,b)=>a.x<b.x+b.width-.5&&a.x+a.width>b.x+.5&&a.y<b.y+b.height-.5&&a.y+a.height>b.y+.5;
 for(const [width,height] of [[320,568],[360,780],[390,844],[430,932]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(500);
  await wish.waitFor();await bell.waitFor();
  const bounds=await bell.boundingBox(),buttons=await page.locator('.home-buttons > button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
  assert.equal(buttons.length,4);assert.ok(bounds.width>=44&&bounds.height>=44);
  for(const a of buttons){assert.ok(a.x>=0&&a.x+a.width<=width+.5&&a.y>=0&&a.y+a.height<=height+.5,JSON.stringify({width,height,a}));}
  for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++)assert.ok(!overlaps(buttons[i],buttons[j]));
  assert.ok(!overlaps(bounds,await wish.boundingBox()));
  assert.ok(await bell.evaluate(el=>{const a=getComputedStyle(el),b=getComputedStyle(document.querySelector('#pause-btn'));return a.backgroundImage===b.backgroundImage&&a.color===b.color&&a.borderRadius===b.borderRadius;}),'matching pause button style');
  await page.screenshot({path:join(out,'hud-'+width+'.png')});
  await wish.click();await page.locator('#thought-panel').waitFor();
  assert.ok(!overlaps(bounds,await page.locator('#thought-panel').boundingBox()),'expanded wishes overlap bell at '+width);
  await bell.click();await history.waitFor();assert.equal(await bell.getAttribute('aria-expanded'),'true');
  await history.locator('[data-notice-close]').click();await history.waitFor({state:'hidden'});
  await page.locator('[data-thought-close]').click();await page.locator('#thought-panel').waitFor({state:'hidden'});
 }
 await page.evaluate(()=>window.__socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'billing_event',messages:['QA 061 notification']})})));
 await bell.locator('small').waitFor();
 assert.ok(Number(await bell.locator('small').innerText())>=1);
 await page.screenshot({path:join(out,'unread-430.png')});
 await bell.click();await history.waitFor();assert.equal(await history.getByText('QA 061 notification',{exact:true}).count(),1);
 assert.ok(!(await bell.locator('small').isVisible()));
 await page.screenshot({path:join(out,'history-430.png')});
 assert.deepEqual(errors,[]);console.log('NOTICE DOCK QA OK');
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}