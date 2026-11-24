import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {weatherAt,weatherTemperature} from '../src/shared/weather.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const kind=process.argv[2],out='/tmp/simlife-039-weather';mkdirSync(out,{recursive:true});
let selected;
for(let day=1;day<=365&&!selected;day++){
 const c={day,minute:750},w=weatherAt(c);
 if((kind==='winter-clear'?w.season==='winter'&&w.kind==='clear':w.kind===kind)&&(kind!=='snow'||w.snow>=.6))selected=c;
}
assert.ok(selected,'missing actual calendar weather '+kind);
const dir=mkdtempSync(join(tmpdir(),'weather-'));let browser,page,server;
try{
 const s=initialState();s.clock=selected;s.autonomy={vlad:'off',alina:'off'};Object.assign(s.characters.vlad,{x:1.6,z:-2,pose:'idle'});openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.port+'/?perf=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 await page.waitForTimeout(2500);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2&&!!document.querySelector('canvas')&&document.querySelector('canvas').width>250&&!document.querySelector('#graphics-recovery')));
 const w=weatherAt(selected);assert.ok((await page.locator('[data-game-season]').textContent()).includes(weatherTemperature(w.temp)));
 await page.screenshot({path:join(out,kind+'.jpg'),type:'jpeg',quality:82});
 console.log(kind,JSON.stringify(w),await page.locator('.performance-probe').innerText());
 assert.deepEqual(errors,[]);
}finally{await page?.close();await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}