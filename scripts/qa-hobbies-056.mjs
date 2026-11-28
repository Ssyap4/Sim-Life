import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const dir=mkdtempSync(join(tmpdir(),'hobbies-056-')),out='/tmp/simlife-family-life-056';
mkdirSync(out,{recursive:true});let server,browser;
try{
 const s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 s.furnishing.placed=[{id:2,sku:'hobby-workbench',finish:'oak',x:13.7,z:-6.4,rotation:0}];s.furnishing.nextId=3;
 Object.assign(s.characters.vlad,{x:13.7,z:-5.68,pose:'idle'});
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:1,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.WebSocket;window.__packets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);if(this.url.includes('/sync')){window.__socket=this;this.addEventListener('message',e=>{try{window.__packets.push(JSON.parse(e.data));}catch{}});}}};});
 const shot=async(name)=>{const p=join(out,name+'.jpg');await page.screenshot({path:p,type:'jpeg',quality:80,timeout:20000});const b64=readFileSync(p).toString('base64');for(let i=0;i<b64.length;i+=6000)console.log('FAMILYQA_IMAGE '+name+' '+(i/6000)+' '+b64.slice(i,i+6000));};
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&hobbyQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 const canvas=page.locator('#game-canvas');
 for(const [id,action,activity] of [[2,'buildCar','modeling']]){
  await canvas.evaluate((c,id)=>c.dataset.hobbyView=String(id),id);
  await page.evaluate(c=>window.__socket.send(JSON.stringify(c)),{type:'furniture_use',furnitureId:id,action});
  await page.waitForFunction(activity=>JSON.parse(document.querySelector('#game-canvas')?.dataset.yardQA||'{}').actors?.vlad?.activity===activity,activity,{timeout:45000});
  await page.waitForFunction(action=>document.querySelector('#game-canvas')?.dataset.hobbyResult===action,action,{timeout:20000});await shot('hobby-'+activity);
  await page.waitForFunction(({action,activity})=>window.__packets.some(p=>p.type==='snapshot'&&p.state.familyLife?.hobbies.vlad[activity]?.unique.includes(action)),{action,activity},{timeout:75000});
  assert.ok(files.load().familyLife.hobbies.vlad[activity].unique.includes(action));assert.equal(files.load().familyLife.displayWorks[String(id)],action);await page.waitForTimeout(800);await shot('hobby-finished-'+activity);
 }
 await page.locator('#phone-btn').click();await page.locator('[data-phone-app=hobbies]').click();
 await page.getByText('В коллекции',{exact:true}).first().waitFor();await shot('hobby-collection');
 assert.deepEqual(errors,[]);console.log('Remaining hobby task completed, animated, and persisted in personal collection');
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
