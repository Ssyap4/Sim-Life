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
    viewport:{width:390,height:1400},deviceScaleFactor:1,isMobile:true,hasTouch:true,
  });
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/qa-media-024.html',
    {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
  const result=await page.evaluate(()=>({
    count:document.querySelectorAll('#gallery canvas').length,
    distinct:Number(document.body.dataset.unique),
    animated:Number(document.body.dataset.animated),
    initial:document.body.dataset.initial,
    next:document.body.dataset.next,
    width:document.documentElement.scrollWidth,
  }));
  if(result.count!==12)errors.push('12 authentic screen scenes expected');
  if(result.distinct<11)errors.push('PC or television images repeated: '+result.distinct);
  if(result.animated<9)errors.push('Too many static scenes: '+result.animated);
  if(result.width>390)errors.push('iPhone-width horizontal overflow: '+result.width);
  await page.locator('#gallery').screenshot({path:path.join(dir,'pc-tv-animated-gallery.png')});
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({result,errors},null,2));
  if(errors.length)throw Error(errors.join('; '));
}finally{await browser.close();}
