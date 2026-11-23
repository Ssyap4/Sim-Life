import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const dir='/tmp/simlife-023-portrait';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader',
]});
const failures=[];
try{
  const page=await browser.newPage({
    viewport:{width:390,height:900},deviceScaleFactor:1,isMobile:true,hasTouch:true,
  });
  page.on('pageerror',err=>failures.push(err.message));
  await page.goto('http://127.0.0.1:4173/qa-living-023.html',
    {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
  const state=await page.evaluate(()=>({
    models:Number(document.body.dataset.loadedModels),
    rendered:Number(document.body.dataset.rendered),
    hashes:document.body.dataset.hashes?.split(',')??[],
    width:document.documentElement.scrollWidth,
  }));
  if(state.models!==2)failures.push('Original Vlad and Alina GLB assets not loaded');
  if(state.rendered!==4||new Set(state.hashes).size!==4)
    failures.push('Character/pet scene has missing or repeated renders');
  if(state.width>390)failures.push('Mobile viewport horizontal overflow');
  await page.locator('#scene').screenshot({path:path.join(dir,'vlad-alina-verdell-simba.png')});
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({state,failures},null,2));
  if(failures.length)throw Error(failures.join('; '));
}finally{await browser.close();}
