import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const dir='/tmp/simlife-022-restaurant-gallery';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader',
]});
try {
  const page=await browser.newPage({viewport:{width:900,height:930},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/qa-cooking-022.html',{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>document.body.dataset.qaReady==='true',{timeout:20000});
  const summary=await page.evaluate(()=>({
    count:Number(document.body.dataset.count),
    distinct:Number(document.body.dataset.distinct),
    hashes:document.body.dataset.hashes,
    labels:[...document.querySelectorAll('[data-recipe]')].map(n=>n.textContent),
    webgl:!!document.querySelector('canvas')?.getContext('webgl2'),
  }));
  if(summary.count!==14||summary.distinct!==14||summary.labels.length!==14)
    errors.push('Missing, identical or fallback model geometry: '+JSON.stringify(summary));
  if(!summary.webgl)errors.push('WebGL2 failed to initialize');
  await page.screenshot({path:path.join(dir,'all-14-3d-dishes.png'),fullPage:true});
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({summary,errors},null,2));
  if(errors.length)throw new Error(errors.join('; '));
} finally {await browser.close();}
