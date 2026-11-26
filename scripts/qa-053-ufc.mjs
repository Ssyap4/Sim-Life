import {build} from 'vite';
import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'ufc-053-')),out='/tmp/simlife-053-ufc';mkdirSync(out,{recursive:true});
let browser,server;
try{
 // Synthetic fixture, no real UFC footage leaves the household.
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=magenta:s=256x144:r=15','-t','4','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',join(dir,'fixture.mp4')]);
 await build({configFile:false,publicDir:false,build:{outDir:join(dir,'bundle'),lib:{entry:resolve('src/game/ConsoleFrames.ts'),name:'SimFight',formats:['iife'],fileName:()=> 'fight.js'}}});
 const data=readFileSync(join(dir,'fixture.mp4'));
 server=createServer((req,res)=>{
  if(req.url==='/fight.js'){res.setHeader('content-type','application/javascript');res.end(readFileSync(join(dir,'bundle','fight.js')));}
  else if(req.url==='/media/ufc-private/manifest.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify(['exchange-1.mp4','celebrate-1.mp4']));}
  else if(req.url?.endsWith('.mp4')){res.setHeader('content-type','video/mp4');res.setHeader('accept-ranges','bytes');const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range??'');if(m){const a=Number(m[1]),b=Math.min(data.length-1,m[2]?Number(m[2]):data.length-1);res.writeHead(206,{'content-range':'bytes '+a+'-'+b+'/'+data.length,'content-length':b-a+1});res.end(data.subarray(a,b+1));}else{res.setHeader('content-length',data.length);res.end(data);}}
  else{res.setHeader('content-type','text/html');res.end('<canvas id="screen" width="256" height="144" style="width:768px;height:432px"></canvas><script src="/fight.js"></script>');}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:800,height:460}});
 await page.addInitScript(()=>{const create=document.createElement.bind(document);window.__videos=[];document.createElement=(...args)=>{const e=create(...args);if(args[0]==='video')window.__videos.push(e);return e;};});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>window.SimFight?.drawConsoleFrame);
 const match={seed:0,winner:'blue',redLabel:'VLAD',blueLabel:'ALINA'};
 const draw=t=>page.evaluate(({t,match})=>window.SimFight.drawConsoleFrame(document.querySelector('canvas').getContext('2d'),'ufc6',t,match),{t,match});
 const shot=name=>page.locator('canvas').screenshot({path:join(out,name+'.png')});
 await draw(5);await shot('01-fight');
 await page.waitForFunction(({match})=>{const c=document.querySelector('canvas').getContext('2d');window.SimFight.drawConsoleFrame(c,'ufc6',8.5,match);const [r,g,b]=c.getImageData(128,72,1,1).data;return r>180&&g<80&&b>180;},{match},{timeout:20000});
 await shot('02-video-fixture');
 assert.equal(await page.evaluate(()=>window.__videos.length),1);
 await draw(108.9);await shot('03-knockdown');
 assert.ok(await page.evaluate(()=>window.__videos.every(v=>v.paused&&!v.hasAttribute('src'))));
 await draw(113);await shot('04-replay');
 await draw(118);await shot('05-winner-blue');
 await page.evaluate(()=>window.SimFight.drawConsoleFrame(document.querySelector('canvas').getContext('2d'),'ufc6',118,{seed:1,winner:'red',redLabel:'VLAD',blueLabel:'ALINA'}));await shot('06-winner-red');
 assert.deepEqual(errors,[]);
 console.log('UFC renderer, local muted video, release and both outcomes passed');
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
