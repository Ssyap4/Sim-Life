
import {chromium} from 'playwright';
import fs from 'node:fs';
const dir='/tmp/simourhome-067-wardrobe';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const look of ['trackNavy','trackForest','teeRetro','teeBlack','robeNavy','robeGrey','pajamaRose','pajamaMint','pajamaCream','silkBerry','silkMidnight','datePearl']){
  for(const pose of ['idle','walk','sit','sleep']){
   await page.goto('http://127.0.0.1:4173/qa-wardrobe-033.html?look='+look+'&pose='+pose);
   await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
   const shot=await page.screenshot({path:dir+'/'+look+'-'+pose+'.jpg',type:'jpeg',quality:75});
   if(pose==='idle'||(pose==='sit'&&look.startsWith('robe'))){const b=shot.toString('base64');for(let i=0;i<b.length;i+=3000)console.log('QA_IMAGE '+look+'-'+pose+' '+b.slice(i,i+3000));}
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
