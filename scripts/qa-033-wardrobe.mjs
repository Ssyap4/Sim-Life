import { chromium } from 'playwright';
import fs from 'node:fs';
const dir='/tmp/simlife-033-wardrobe';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>console.error(e));
 for(const look of ['home','denim','city','cozy','street']){
  for(const pose of ['idle','walk','sit','work','sleep','cook','eat']){
   await page.goto('http://127.0.0.1:4173/qa-wardrobe-033.html?look='+look+'&pose='+pose);
   await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
   await page.screenshot({path:dir+'/'+look+'-'+pose+'.png'});
  }
  await page.goto('http://127.0.0.1:4173/qa-wardrobe-033.html?look='+look+'&back=1');
  await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
  await page.screenshot({path:dir+'/'+look+'-back.png'});
 }
}finally{await browser.close();}
