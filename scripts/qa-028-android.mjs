// Real browser-based Android-size WebGL smoke + forced context-loss recovery.
// Chromium emulates the Android viewport and user-agent, not the physical GPU.
import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {initialState} from '../src/shared/protocol.ts';
import {startServer} from '../server/server.ts';
import {openServerFiles} from '../server/storage.ts';

const out='/tmp/simlife-028-android-webgl';
mkdirSync(out,{recursive:true});
const saves=mkdtempSync(join(tmpdir(),'simlife-028-android-'));
const files=openServerFiles(saves);
files.save(initialState());
const errors=[],captures=[];
let server,browser;
try{
  server=await startServer({port:0,host:'127.0.0.1',dataDir:saves,
    distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
  browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle',
    '--use-angle=swiftshader','--disable-dev-shm-usage',
  ]});
  const context=await browser.newContext({
    viewport:{width:393,height:873},deviceScaleFactor:3,
    hasTouch:true,isMobile:true,
    userAgent:'Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('Page: '+e.message));
  await page.goto('http://127.0.0.1:'+server.port+'/?gfx=safe',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.enter-button').waitFor({state:'visible',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,{timeout:70000});
  await page.locator('.enter-button').click();
  await page.waitForFunction(()=>document.querySelector('#auth')?.hidden===true,{timeout:15000});
  await page.waitForTimeout(5200); // allow the blank-screen watchdog to run
  const inspect=()=>page.evaluate(()=>{
    const canvas=document.querySelector('#game-canvas');
    const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const attr=gl?.getContextAttributes();
    return {
      ua:navigator.userAgent,
      cssWidth:canvas?.clientWidth,cssHeight:canvas?.clientHeight,
      width:canvas?.width,height:canvas?.height,
      antialias:attr?.antialias,stencil:attr?.stencil,
      lost:gl?.isContextLost(),webgl:!!gl,
      warning:document.querySelector('#graphics-recovery')?.textContent||null,
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth:innerWidth,
    };
  });
  const first=await inspect();
  captures.push({phase:'first',...first});
  await page.screenshot({path:join(out,'01-android-real-world.png')});
  if(!first.ua.includes('Android')||!first.webgl||first.lost||first.warning)
    errors.push('Android WebGL unavailable: '+JSON.stringify(first));
  if(first.antialias!==false||first.stencil!==false)
    errors.push('Android compatibility context attributes not selected: '+JSON.stringify(first));
  if(first.width>first.cssWidth*1.04||first.height>first.cssHeight*1.04)
    errors.push('Android pixel ratio exceeded low-memory cap');
  if(first.scrollWidth>first.innerWidth+2)
    errors.push('Android HUD overflows viewport');
  const ext=await page.evaluate(()=>{
    const canvas=document.querySelector('#game-canvas');
    const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
    const loss=gl?.getExtension('WEBGL_lose_context');
    if(!loss)return false;
    loss.loseContext();
    return true;
  });
  if(ext){
    try{
      await page.locator('#graphics-recovery').waitFor({state:'visible',timeout:10000});
      await page.screenshot({path:join(out,'02-android-webgl-context-lost.png')});
      await page.evaluate(()=>{
        const canvas=document.querySelector('#game-canvas');
        const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
        gl?.getExtension('WEBGL_lose_context')?.restoreContext();
      });
      await page.locator('#graphics-recovery').waitFor({state:'detached',timeout:15000});
      await page.waitForTimeout(950);
      const restored=await inspect();
      captures.push({phase:'restored',...restored});
      await page.screenshot({path:join(out,'03-android-webgl-restored.png')});
      if(restored.lost||restored.warning)errors.push('Context recovery failed');
    }catch(e){errors.push('Simulated WebGL recovery failed: '+String(e));}
  }else captures.push({phase:'context-loss-extension-unavailable'});
  writeFileSync(join(out,'results.json'),JSON.stringify({errors,captures},null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{
  await browser?.close();
  await server?.close();
  rmSync(saves,{recursive:true,force:true});
}
