import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const dir='/tmp/simlife-021-mobile-visual';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
let failures=[];
try{
  for(const [width,height] of [[320,568],[390,844],[430,932]]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    page.on('pageerror',error=>failures.push(width+' pageerror '+error.message));
    await page.goto('http://127.0.0.1:3150/',{waitUntil:'domcontentloaded',timeout:25000});
    await page.locator('.enter-button').waitFor({state:'visible',timeout:20000});
    await page.waitForTimeout(900);
    const enter=page.locator('.enter-button');
    await enter.click();
    await page.locator('#auth').waitFor({state:'hidden',timeout:20000});
    await page.waitForTimeout(2000);
    await page.screenshot({path:path.join(dir,'game-'+width+'x'+height+'.png'),animations:'disabled'});
    const measure=await page.evaluate(()=>{
      const needs=document.querySelector('#needs-toggle');
      const rect=needs.getBoundingClientRect();
      const brand=document.querySelector('.brand h1');
      return {title:brand?.textContent,needs:{x:rect.x,y:rect.y,w:rect.width,h:rect.height},
        viewport:{w:innerWidth,h:innerHeight},scrollWidth:document.documentElement.scrollWidth};
    });
    if(measure.needs.w<38||measure.needs.h<38)failures.push(width+' needs tap area too small');
    if(measure.scrollWidth>width+2)failures.push(width+' unexpected horizontal scroll');
    fs.writeFileSync(path.join(dir,'measure-'+width+'.json'),JSON.stringify(measure,null,2));
    await page.locator('#needs-toggle').click();
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(dir,'needs-'+width+'x'+height+'.png'),animations:'disabled'});
    await page.close();
  }
  fs.writeFileSync(path.join(dir,'errors.txt'),failures.join('\n')||'No page errors or viewport overflow detected\n');
  if(failures.length)throw new Error(failures.join('; '));
}finally{await browser.close();}
