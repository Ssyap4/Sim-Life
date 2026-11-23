// Real 3D/Safari-sized view of purchased pet furniture and real client commands.
// Runs only in isolated GitHub Actions /tmp, NEVER on ALINA-PC production data.
import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {initialState} from '../src/shared/protocol.ts';
import {startServer} from '../server/server.ts';
import {openServerFiles} from '../server/storage.ts';

const out='/tmp/simlife-028-pets-mobile';
mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'simlife-028-real-pets-'));
const files=openServerFiles(dir);
const household=initialState();
household.furnishing.nextId=34;
household.furnishing.placed=[
  {id:31,sku:'pet-bed-verdell',finish:'sage',x:-2.90,z:3.34,rotation:0},
  {id:32,sku:'pet-bed-simba',finish:'ivory',x:-.25,z:1.32,rotation:0},
  {id:33,sku:'pet-scratcher-simba',finish:'walnut',x:1.12,z:1.84,rotation:0},
];
for(const id of ['verdell','simba']){
  Object.assign(household.pets[id],{satiety:94,energy:90,bladder:96,happiness:74,bond:80});
}
files.save(household);
let server,browser;
const errors=[],captures=[];
try{
  server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,
    lifeClock:{now:()=>0,tickMs:600000}});
  browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle',
    '--use-angle=swiftshader','--disable-dev-shm-usage',
  ]});
  const context=await browser.newContext({viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('Page: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('Console: '+m.text().slice(0,220));});
  await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.enter-button').waitFor({state:'visible',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,{timeout:70000});
  await page.locator('.enter-button').click();
  await page.waitForFunction(()=>document.querySelector('#auth')?.hidden===true,{timeout:15000});
  const shot=async name=>{
    await page.screenshot({path:join(out,name+'.png'),timeout:30000});
    const display=await page.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,viewport:window.innerWidth,
      canvas:!!document.querySelector('canvas')&&document.querySelector('canvas').width>250,
      logged:document.querySelector('#auth')?.hidden===true,
      panel:document.querySelector('#actions')?.innerText?.slice(0,380),
    }));
    captures.push({name,...display});
    if(display.scroll>display.viewport+2||!display.canvas||!display.logged)
      errors.push(name+': viewport/WebGL/auth broken: '+JSON.stringify(display));
  };
  await shot('01-installed-pet-furniture-real-world');
  for(const [idx,id,button,expected] of [
    ['02','verdell','Принести мячик','fetch'],
    ['03','verdell','Отдохнуть на лежанке','sleep'],
    ['04','simba','Поточить когти','scratch'],
    ['05','simba','Отдохнуть на лежанке','sleep'],
    ['06','simba','Попросить полежать на мебели','perch'],
  ]){
    await page.locator('#pets-btn').click();
    const tab=page.locator('#actions .pet-tab').filter({hasText:id==='simba'?'Симба':'Верделл'});
    await tab.click();
    await shot(idx+'-menu-'+id);
    const action=page.locator('#actions .pet-action').filter({hasText:button});
    if(await action.count()!==1||await action.isDisabled()){
      errors.push(idx+' missing or disabled pet command: '+button);continue;
    }
    await action.click();
    await page.waitForTimeout(250);
    const pet=files.load().pets[id];
    if(pet.routine?.kind!==expected)
      errors.push(idx+' real server command did not produce '+expected+': '+pet.routine?.kind);
    captures.push({name:idx+'-server',kind:pet.routine?.kind,
      equipment:pet.routine?.equipment?.id??null,route:pet.routine?.route?.path?.length??0});
    await page.locator('#showcase-toggle').click();
    await page.locator('[data-showcase="'+id+'"]').click();
    await page.waitForTimeout(440);
    for(let frame=0;frame<5;frame++){
      await page.waitForTimeout(420);
      await shot(idx+'-'+id+'-real-'+String(frame).padStart(2,'0'));
    }
    await page.locator('#showcase-toggle').click();
  }
  // A genuine visible 3D object may never be confused with an empty sticker:
  // the test captures both live world geometry and actual interactive actor frames.
  const saved=files.load();
  writeFileSync(join(out,'results.json'),JSON.stringify({errors,captures,
    purchasedFurniture:saved.furnishing.placed.map(x=>({sku:x.sku,x:x.x,z:x.z})),
    finalPetRoutines:Object.fromEntries(['verdell','simba'].map(id=>[id,saved.pets[id].routine?.kind])),
  },null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{
  await browser?.close();
  await server?.close();
  rmSync(dir,{recursive:true,force:true});
}
