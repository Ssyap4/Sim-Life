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
    if(width===390){
      await page.locator('#map-btn').click();
      await page.getByRole('button',{name:/Общий вид района/}).click();
      await page.waitForTimeout(2200);
      await page.screenshot({path:path.join(dir,'district-overview-390.png'),animations:'disabled'});
      await page.locator('#map-btn').click();
      await page.getByRole('button',{name:/Камера к торговой улице/}).click();
      await page.waitForTimeout(2200);
      await page.screenshot({path:path.join(dir,'district-shops-390.png'),animations:'disabled'});
      // Move to a real residential plot after shopping, do not fake a render.
      await page.locator('#map-btn').click();
      await page.getByRole('button',{name:/Осмотреть соседей/}).click();
      await page.waitForTimeout(2350);
      await page.screenshot({path:path.join(dir,'neighbor-yards-390.png'),animations:'disabled'});
    }
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
    await page.locator('#needs-close').click();
    if(width===390){
      const follow=page.locator('#camera-follow');
      await follow.click();
      await page.waitForTimeout(300);
      if(await follow.getAttribute('aria-pressed')!=='true')failures.push('camera follow cannot be activated');
      await follow.click();
      await page.waitForTimeout(300);
      if(await follow.getAttribute('aria-pressed')!=='false')failures.push('free camera cannot be restored');
      // Rapid double-taps on the actual 3D canvas must not select page text.
      await page.locator('#game-canvas').click({position:{x:12,y:180},clickCount:2});
      const selected=await page.evaluate(()=>window.getSelection()?.toString()||'');
      if(selected.length)failures.push('mobile double-tap selected page text');
    }
    await page.locator('#phone-btn').click();
    await page.locator('#phone-overlay').waitFor({state:'visible',timeout:12000});
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(dir,'phone-'+width+'x'+height+'.png'),animations:'disabled'});
    await page.close();
  }
  fs.writeFileSync(path.join(dir,'errors.txt'),failures.join('\n')||'No page errors or viewport overflow detected\n');
  if(failures.length)throw new Error(failures.join('; '));
}finally{await browser.close();}
