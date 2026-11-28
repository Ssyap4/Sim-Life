import {chromium} from 'playwright';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {CAT_DIRECTIONS,PET_TOYS} from '../src/shared/petToys.ts';
import {applyCatPlay} from '../server/pets.ts';
import {grantStarterPetFurniture} from '../server/starterPets.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-069-cat';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'cat-069-'));let browser,server;const pages=[];
try{
 const s=initialState();grantStarterPetFurniture(s);s.autonomy={vlad:'off',alina:'off'};s.money=100000;
 s.pets.simba.ownedToys=PET_TOYS.filter(t=>t.manual).map(t=>t.id);Object.assign(s.characters.vlad,{x:-.96,z:10.28,pose:'idle'});Object.assign(s.characters.alina,{x:1.4,z:8.85,pose:'idle'});
 const direction=CAT_DIRECTIONS.find(d=>applyCatPlay(s,'vlad','cat-wand',d).ok);assert.ok(direction);
 const first=applyCatPlay(s,'vlad','cat-wand',direction);assert.ok(first.ok);s.pets.simba.position={...first.state.pets.simba.routine.goal};
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const errors=[];
 async function login(role,width,height){const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}};});await p.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});await p.locator('[data-role='+role+']').first().click();await p.locator('.enter-button').click();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;}
 async function shot(p,name){const bytes=await p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:75});const b=bytes.toString('base64');for(let i=0;i<b.length;i+=3000)console.log('QA_IMAGE '+name+' '+b.slice(i,i+3000));}
 const v=await login('vlad',390,844),a=await login('alina',320,568);
 for(const p of [v,a]){await p.locator('#showcase-toggle').click();await p.locator('[data-showcase=simba]').click();await p.waitForTimeout(1000);}
 await v.locator('#pets-btn').click();await v.locator('.pet-tab').filter({hasText:'Симба'}).click();await v.locator('[data-cat-play=open]').click();
 const controls=v.locator('#cat-play-controls');await controls.waitFor();assert.equal(await controls.locator('option').count(),4);
 await controls.locator('[data-cat-direction='+direction+']').click();await v.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.pets.simba.routine?.manualToy?.owner==='vlad'));
 for(const t of ['cat-wand','cat-string-mouse','cat-laser','cat-bell-ball']){
  if(t!=='cat-wand'){await controls.locator('select').selectOption(t);await controls.locator('[data-cat-direction='+direction+']').click();}
  await v.waitForFunction(id=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.pets.simba.routine?.manualToy&&p.state.pets.simba.routine.target===id),s.pets.simba.ownedToys.indexOf(t)+3);
  await v.waitForTimeout(1900);if(t!=='cat-bell-ball'){for(const client of [v,a])await client.waitForFunction(()=>JSON.parse(document.querySelector('#game-canvas').dataset.yardQA).actors.vlad.catToy.held,undefined,{timeout:5000});}await shot(v,t+'-390');await shot(a,t+'-320');if(t!=='cat-bell-ball'){for(const client of [v,a])await client.locator('#game-canvas').evaluate(c=>c.dataset.catHandView='wide');await v.waitForTimeout(500);await shot(v,t+'-owner-390');await shot(a,t+'-owner-320');for(const client of [v,a])await client.locator('#game-canvas').evaluate(c=>delete c.dataset.catHandView);for(const client of [v,a]){await client.locator('#showcase-toggle').click();await client.locator('[data-showcase=simba]').click();}}
 }
 await controls.getByRole('button',{name:'Перетаскивание: выкл.'}).click();assert.equal(await controls.locator('.cat-drag-mode').getAttribute('aria-pressed'),'true');await v.locator('#game-canvas').evaluate(c=>c.dataset.catHandView='wide');await v.waitForTimeout(500);const target=first.state.pets.simba.routine.manualToy.point;const offset=[[-.28,0],[.28,0],[0,.28],[0,-.28]].map(([x,z])=>({x:target.x+x,z:target.z+z})).find(p=>applyCatPlay(s,'vlad','cat-bell-ball',p).ok);assert.ok(offset);const pose=await v.locator('#game-canvas').evaluate(c=>JSON.parse(c.dataset.cameraPose)),bounds=await v.locator('#game-canvas').boundingBox();const camera=new PerspectiveCamera(pose.fov,pose.aspect,.1,180);camera.position.fromArray(pose.eye);camera.quaternion.fromArray(pose.quaternion);camera.updateMatrixWorld(true);const screen=p=>{const q=new Vector3(p.x,0,p.z).project(camera);return {x:Math.round(bounds.x+(q.x+1)*bounds.width/2),y:Math.round(bounds.y+(1-q.y)*bounds.height/2)};};const start=screen(target),end=screen(offset);assert.ok(await v.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id==='game-canvas',start));const cdp=await v.context().newCDPSession(v);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await v.waitForFunction(p=>window.__qaPackets.some(x=>x.type==='snapshot'&&x.state.pets.simba.routine?.manualToy&&Math.hypot(x.state.pets.simba.routine.manualToy.point.x-p.x,x.state.pets.simba.routine.manualToy.point.z-p.z)<.09),offset,{timeout:10000});await shot(v,'cat-drag-390');await controls.getByRole('button',{name:'Перетаскивание: вкл.'}).click();assert.equal(await controls.locator('.cat-drag-mode').getAttribute('aria-pressed'),'false');
 const final=files.load().pets.simba.routine;assert.ok(final?.manualToy);assert.equal(final.target,6);assert.equal(files.load().money,100000);assert.deepEqual(errors,[]);
 console.log('CAT PLAY 069 MOBILE OK');
}catch(e){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:join(out,'failure-'+i+'.jpg')}).catch(()=>{});throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
