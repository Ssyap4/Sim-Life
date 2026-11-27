import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {weatherAt} from '../src/shared/weather.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-062-yard-touch';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const errors=[],reports=[];
const clearDay=Array.from({length:9},(_,i)=>10+i).find(day=>weatherAt({day,minute:750}).kind==='clear')??10;
try{
 for(const [label,day,minute] of [['day',clearDay,750],['night',clearDay,1320],['winter',28,750]]){
  const dir=mkdtempSync(join(tmpdir(),'yard-touch-062-'));let server,page;
  try{
   const state=initialState();state.clock={day,minute};state.autonomy={vlad:'off',alina:'off'};
   openServerFiles(dir).save(state);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
   page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|VALIDATE_STATUS/i.test(m.text()))errors.push(m.text());});
   await page.addInitScript(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync'))window.__qaSocket=this;}};});
   await page.goto('http://127.0.0.1:'+server.port+'/?perfQA=1&cameraQA=1&sideWallsQA=1',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   const canvas=page.locator('#game-canvas');
   await page.waitForFunction(()=>{const c=document.querySelector('#game-canvas');return c?.dataset.yardQA&&c.dataset.resourceReport;},undefined,{timeout:40000});
   for(const view of label==='day'?['yard-wide','yard-close','yard-lawn','yard-parking']:label==='night'?['yard-wide','yard-close','yard-lawn']:['yard-wide','yard-lawn']){
    await canvas.evaluate((el,v)=>el.dataset.wallView=v,view);
    await page.waitForTimeout(1200);
    const report=await canvas.evaluate(el=>({view:el.dataset.wallView,...JSON.parse(el.dataset.resourceReport),grass:JSON.parse(el.dataset.yardQA).grass,lamps:el.dataset.yardLamps}));
    assert.ok(report.grass>0);assert.equal(report.lamps,label==='night'?'on':'off');assert.ok(report.calls<450,JSON.stringify(report));
    reports.push({label,...report});await page.screenshot({path:join(out,label+'-'+view+'.png')});
   }
   if(label==='day'){
    for(const view of ['kitchen','bedroom','living','bath','passages','study']){await canvas.evaluate((el,v)=>el.dataset.wallView=v,view);await page.waitForTimeout(1100);await page.screenshot({path:join(out,'home-'+view+'.png')});}
    await canvas.evaluate(el=>delete el.dataset.wallView);
    await page.locator('#camera-reset').tap();
    const up=page.locator('#camera-height-up'),reset=page.locator('#camera-reset'),phone=page.locator('#phone-btn');
    for(const [width,height] of [[320,568],[360,780],[390,844],[430,932]]){
     await page.setViewportSize({width,height});await page.waitForTimeout(500);
     for(const b of [up,reset]){if(await b.isVisible()){const bb=await b.boundingBox();assert.ok(bb.width>=43&&bb.height>=43);}}
     await phone.tap();await page.locator('[data-phone-app=profiles]').tap();
     assert.equal(await up.isVisible(),false);assert.equal(await reset.isVisible(),false);
     const tabs=page.locator('.profile-tabs').first();assert.ok(await tabs.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
     await page.screenshot({path:join(out,'phone-'+width+'.png')});
     await page.locator('[data-phone-close]').tap();
    }
    await page.setViewportSize({width:390,height:844});await phone.tap();await page.locator('[data-phone-app=profiles]').tap();
    const tab=page.locator('[data-profile-role=alina]'),box=await tab.boundingBox();assert.ok(box);
    await tab.evaluate(el=>el.dataset.heldQa='original');
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:0}]});
    state.revision=1234;state.characters.vlad.mood=37;
    await page.evaluate(s=>window.__qaSocket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'snapshot',state:s})})),state);
    await page.waitForTimeout(100);
    assert.equal(await tab.getAttribute('data-held-qa'),'original','snapshot must not replace pressed DOM node');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.locator('[data-profile-card=alina]').waitFor({timeout:5000});
    await page.locator('[data-phone-close]').tap();
    await page.screenshot({path:join(out,'hud-390.png')});
   }
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify(reports));writeFileSync(join(out,'report.json'),JSON.stringify(reports,null,2));
}finally{await browser.close();}
