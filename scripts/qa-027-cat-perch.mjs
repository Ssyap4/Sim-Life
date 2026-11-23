// The *actual* 3D mobile game: Simba walks to a purchased, rotated sofa,
// jumps onto the actual model and curls up. No mock rigs or fake screenshots.
// All saves stay in a temporary directory; no WebGL on ALINA-PC.
import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {initialState} from '../src/shared/protocol.ts';
import {gameMinutes} from '../src/shared/life.ts';
import {HOME_FLOOR} from '../src/shared/home.ts';
import {placeObstacles} from '../src/shared/locations.ts';
import {catPerchCandidates} from '../src/shared/CatPerches.ts';
import {planPetRoute,petNavigationGeometry} from '../src/game/PetNavigation.ts';
import {startServer} from '../server/server.ts';
import {openServerFiles} from '../server/storage.ts';

const out='/tmp/simlife-027-cat-perches-iphone';
mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'sim-life-027-cat-jump-'));
const state=initialState();
state.furnishing.soldFixtures=['sofa'];
state.furnishing.nextId=42;
state.furnishing.placed=[{
  id:41,sku:'sofa-luna',finish:'sage',x:-2.36,z:2.02,rotation:2,
}];
const perch=catPerchCandidates(state.furnishing).find(c=>c.key==='placed:41');
if(!perch)throw Error('A bought, rotated sofa has no physical cat perch');
const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
const route=planPetRoute(state.pets.simba.position,perch.approach,geometry);
const end=route?.path.at(-1)??route?.from;
if(!route||!end||Math.hypot(end.x-perch.approach.x,end.z-perch.approach.z)>.02)
  throw Error('The cat cannot reach the bought sofa without crossing furniture');
Object.assign(state.pets.simba,{satiety:89,energy:90,happiness:87,bond:90,bladder:91});
state.pets.simba.routine={
  kind:'perch',target:0,startedAt:gameMinutes(state.clock),
  until:gameMinutes(state.clock)+40,route,perch,
};
const files=openServerFiles(dir);
files.save(state);
const errors=[],frames=[];
let server,browser;
try{
  server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,
    // Freeze only the server life timer, not WebGL time: no unrelated NPC
    // task should steal the camera while the real cat route is filmed.
    lifeClock:{now:()=>0,tickMs:600000}});
  browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle',
    '--use-angle=swiftshader','--disable-dev-shm-usage',
  ]});
  const context=await browser.newContext({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('JS: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('Console: '+m.text().slice(0,240));});
  await page.goto('http://127.0.0.1:'+server.port+'/',{
    waitUntil:'domcontentloaded',timeout:45000,
  });
  await page.locator('.enter-button').waitFor({state:'visible',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,{timeout:70000});
  await page.locator('.enter-button').click();
  await page.waitForFunction(()=>document.querySelector('#auth')?.hidden===true,{timeout:15000});
  await page.locator('#showcase-toggle').click();
  await page.locator('[data-showcase="simba"]').click();
  const inspect=await page.locator('#app').evaluate(e=>e.classList.contains('inspecting'));
  if(!inspect)errors.push('The original pet close-up camera did not activate');
  for(let index=0;index<36;index++){
    await page.waitForTimeout(320);
    const name='simba-on-purchased-sofa-'+String(index).padStart(2,'0');
    await page.screenshot({path:join(out,name+'.png'),timeout:30000});
    const details=await page.evaluate(()=>({
      width:document.documentElement.scrollWidth,viewport:window.innerWidth,
      canvas:!!document.querySelector('canvas')&&document.querySelector('canvas').width>250,
      logged:document.querySelector('#auth')?.hidden===true,
    }));
    frames.push({name,...details});
    if(details.width>details.viewport+2)errors.push(name+': sideways scroll on iPhone');
    if(!details.canvas||!details.logged)errors.push(name+': client/canvas stopped');
  }
  const persisted=files.load();
  if(persisted.pets.simba.routine?.kind!=='perch'||persisted.pets.simba.routine.perch?.key!=='placed:41')
    errors.push('Real saved sofa contact was lost during visual film');
  writeFileSync(join(out,'results.json'),JSON.stringify({
    errors,frames,sofa:perch,routePoints:route.path.length,
    saveInfo:{money:persisted.money,kittenPerch:persisted.pets.simba.routine?.perch},
  },null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{
  await browser?.close();
  await server?.close();
  rmSync(dir,{recursive:true,force:true});
}
