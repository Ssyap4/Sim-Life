import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const dir='/tmp/simlife-024-media';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader',
]});
const errors=[];
try{
  const page=await browser.newPage({
    viewport:{width:390,height:850},deviceScaleFactor:1,isMobile:true,hasTouch:true,
  });
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/qa-pets-024.html',
    {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
  const state=await page.evaluate(()=>({
    begging:document.body.dataset.begging,
    bothPaws:document.body.dataset.bothPaws,
    tilt:Number(document.body.dataset.dogTilt),
    catHead:Number(document.body.dataset.catHead),
    distinct:Number(document.body.dataset.unique),
    width:document.documentElement.scrollWidth,
  }));
  if(state.begging!=='true'||state.bothPaws!=='true')
    errors.push('Verdell two-paw bunny is not visible');
  if(state.tilt>-.15)errors.push('Verdell does not sit upright');
  if(state.catHead>.82)errors.push('Simba muzzle too wide');
  if(state.distinct!==4)errors.push('Duplicate animal renders');
  if(state.width>390)errors.push('Overflow in mobile visual gallery');
  await page.locator('#scene').screenshot({path:path.join(dir,'simba-and-verdell-bunny.png')});
  fs.writeFileSync(path.join(dir,'pets-results.json'),JSON.stringify({state,errors},null,2));
  if(errors.length)throw Error(errors.join('; '));
}finally{await browser.close();}
