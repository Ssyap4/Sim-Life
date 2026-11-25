import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='/tmp/simlife-045-characters';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[],results={};page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|webgl|three/i.test(m.text()))errors.push(m.text());});
 for(const id of ['alina','vlad'])for(const variant of ['before','after']){
  await page.goto('http://127.0.0.1:4173/qa-characters-045.html?id='+id+'&variant='+variant,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.ready==='true',undefined,{timeout:40000});
  for(const view of ['front','quarter','full']){
   const name=id+'-'+variant+'-'+view;
   results[name]=await page.evaluate(v=>window.renderPortrait(v),view);
   await page.screenshot({path:out+'/'+name+'.png'});
  }
  if(id==='alina'&&variant==='after')for(const care of ['light','evening']){
   await page.evaluate(c=>window.renderPortrait('front',c),care);
   await page.screenshot({path:out+'/alina-'+care+'.png'});
  }
 }
 for(const id of ['alina','vlad'])assert.equal(results[id+'-before-front'],results[id+'-after-front'],'triangle budget');
 writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();}