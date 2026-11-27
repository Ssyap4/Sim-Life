import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const mode=process.argv[2]??'mobile',out='/tmp/simourhome-059-'+mode;
mkdirSync(out,{recursive:true});
const cases=mode==='desktop'?[[1440,900,false]]:mode==='secure'?[[390,844,true],[320,568,true]]:[[390,844,false],[320,568,false],[430,932,false]];
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 for(const [width,height,secure] of cases){
  const dir=mkdtempSync(join(tmpdir(),'simourhome-'));let server,page;
  try{
   const s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};
   const files=openServerFiles(dir);files.save(s);
   server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:!secure,lifeClock:{now:()=>0,tickMs:600000}});
   page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:width<700,hasTouch:width<700});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
   await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
   assert.match(await page.title(),/SimOurHome/);
   assert.equal(await page.locator('#access-code').isVisible(),secure);
   assert.equal(await page.locator('#access-code').evaluate(e=>e.required),secure);
   await page.locator('[data-role=alina]').click();
   assert.equal(await page.locator('[data-role=alina]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-role=vlad]').getAttribute('aria-pressed'),'false');
   assert.match(await page.locator('.enter-button').innerText(),/Алину/);
   await page.waitForTimeout(1000);
   const name=width+'x'+height+(secure?'-secure':''),shot=async(suffix)=>{
    const p=join(out,name+'-'+suffix+'.jpg');await page.screenshot({path:p,type:'jpeg',quality:68});
    const b64=readFileSync(p).toString('base64');for(let i=0;i<b64.length;i+=6000)console.log('TITLEQA_IMAGE '+name+'-'+suffix+' '+i/6000+' '+b64.slice(i,i+6000));
   };
   const fit=await page.locator('#auth').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,title:document.querySelector('#auth-title').scrollWidth,box:document.querySelector('#auth-title').clientWidth,button:document.querySelector('.enter-button').getBoundingClientRect().height}));
   assert.ok(fit.scroll<=fit.width+2,JSON.stringify(fit));assert.ok(fit.button>=44);
   await shot('menu');
   await page.locator('.title-settings summary').click();await page.locator('#title-volume').fill('40');assert.equal(await page.locator('#title-volume-value').innerText(),'40%');
   await page.locator('.title-settings summary').click();
   if(secure)await page.locator('#access-code').fill(files.access.alina);
   await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
   await page.locator('#phone-btn').click();
   assert.equal(await page.locator('.phone-group-title').count(),6);
   const appIds=await page.locator('[data-phone-app]').evaluateAll(els=>els.map(e=>e.dataset.phoneApp));
   assert.equal(appIds.length,28);assert.equal(new Set(appIds).size,28);
   await shot('phone');
   await page.locator('[data-phone-app=audio]').click();
   assert.ok(await page.locator('.phone-info').isVisible());assert.ok(!(await page.locator('.phone-grid').isVisible()));
   await page.locator('[data-phone-back]').click();assert.ok(await page.locator('.phone-grid').isVisible());
   assert.deepEqual(errors,[]);console.log('TITLEQA_OK',name,fit);
  }finally{await page?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
 }
}finally{await browser?.close();}
