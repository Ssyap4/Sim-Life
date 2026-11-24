/**
 * Real WebGL screenshots of the ACTUAL imported Simba model on several
 * furniture sockets. Runs in cloud GitHub Actions only (not ALINA-PC).
 * Four independent fresh households avoid stale save/UI state.
 */
import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {initialState} from '../src/shared/protocol.ts';
import {gameMinutes} from '../src/shared/life.ts';
import {catPerchCandidates} from '../src/shared/CatPerches.ts';
import {chooseCatRestPose} from '../src/shared/CatRestPoses.ts';
import {startServer} from '../server/server.ts';
import {openServerFiles} from '../server/storage.ts';

const out='/tmp/simlife-028-simba-authored';
mkdirSync(out,{recursive:true});
const cases=[
  {name:'sofa-rest-A',key:'starter:sofa',minute:0},
  {name:'sofa-rest-B',key:'starter:sofa',minute:1},
  {name:'bed-curl',key:'starter:bed',minute:0},
  {name:'chair-compact',key:'placed:41',minute:0},
  {name:'rotated-sofa',key:'placed:42',minute:0},
];
const errors=[],captures=[];
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle',
  '--use-angle=swiftshader','--disable-dev-shm-usage',
]});
try{
  for(const scenario of cases){
    const dir=mkdtempSync(join(tmpdir(),'simlife-simba-rest-'));
    let server,context;
    try{
      const state=initialState();
      state.money=100_000;
      state.characters.vlad.energy=20;
      state.furnishing.nextId=43;
      state.furnishing.placed=[
        {id:41,sku:'chair-cloud',finish:'sage',x:2.45,z:2.1,rotation:1},
        {id:42,sku:'sofa-luna',finish:'oak',x:2.45,z:-.2,rotation:2},
      ];
      const perch=catPerchCandidates(state.furnishing).find(p=>p.key===scenario.key);
      if(!perch||!perch.catAnchor)throw Error('Missing physical furniture socket '+scenario.key);
      const now=gameMinutes(state.clock);
      const startedAt=now-scenario.minute;
      state.pets.simba.position={...perch.approach};
      Object.assign(state.pets.simba,{satiety:94,energy:95,bladder:98,happiness:85,bond:88});
      state.pets.simba.routine={
        kind:'perch',target:0,startedAt,until:now+60,
        route:{from:{...perch.approach},path:[]},perch,
      };
      const chosen=chooseCatRestPose(perch.catAnchor.poses,perch.key,startedAt,perch.kind);
      const files=openServerFiles(dir);
      files.save(state);
      server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),
        testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
      context=await browser.newContext({viewport:{width:390,height:844},
        isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await context.newPage();
      await page.addInitScript(()=>{
        const Native=window.WebSocket;
        window.WebSocket=class extends Native{
          constructor(...args){
            super(...args);
            if(this.url.includes('/sync')){
              window.__simbaQA=this;
              this.addEventListener('message',event=>{
                const packet=JSON.parse(event.data);
                if(packet.type==='snapshot')window.__simbaSnapshot=packet.state;
              });
            }
          }
        };
      });
      page.on('pageerror',err=>errors.push(scenario.name+': '+err.message));
      page.on('console',msg=>{if(msg.type()==='error')
        errors.push(scenario.name+': browser console '+msg.text().slice(0,220));});
      await page.goto('http://127.0.0.1:'+server.port+'/?gfx=full',
        {waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('.enter-button').waitFor({state:'visible',timeout:60000});
      await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,
        {timeout:70000});
      await page.locator('.enter-button').click();
      await page.waitForFunction(()=>document.querySelector('#auth')?.hidden===true,
        {timeout:15000});
      // Enough time to finish the same jump / crouch blend used on phones.
      await page.waitForTimeout(2200);
      const shot=async suffix=>{
        const path=join(out,scenario.name+'-'+suffix+'.png');
        await page.screenshot({path,timeout:30000});
        const measure=await page.evaluate(()=>({
          canvas:document.querySelector('canvas')?.width??0,
          viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          playable:document.querySelector('#auth')?.hidden===true,
        }));
        captures.push({scenario:scenario.name,chosen,suffix,...measure});
        if(measure.canvas<200||measure.scroll>measure.viewport+2||!measure.playable)
          errors.push(scenario.name+': broken 3D canvas/UI '+JSON.stringify(measure));
      };
      await shot('world');
      await page.locator('#showcase-toggle').click();
      await page.locator('[data-showcase="simba"]').click();
      await page.waitForTimeout(900);
      await shot('close-front');
      await page.waitForTimeout(460);
      await shot('close-stable');
      if(scenario.key==='starter:bed'){
        await page.evaluate(()=>window.__simbaQA.send(JSON.stringify({type:'sleep_start',mode:'full'})));
        const release=page.getByRole('button',{name:/Убрать Симбу/});
        await release.waitFor({state:'visible',timeout:15000});
        await shot('sleep-blocked-menu');
        await release.click();
        await page.waitForFunction(()=>window.__simbaSnapshot?.pets.simba.furnitureYield,
          {timeout:15000});
        await page.waitForTimeout(2200);
        await shot('cat-on-floor');
        await page.evaluate(()=>window.__simbaQA.send(JSON.stringify({type:'sleep_start',mode:'full'})));
        await page.waitForFunction(()=>window.__simbaSnapshot?.characters.vlad.pose==='sleep',
          {timeout:15000});
        await page.locator('#showcase-return').click();
        await page.waitForTimeout(5500);
        await shot('sleep-after-release');
      }
      await context.close();
      context=undefined;
    }finally{
      await context?.close();
      await server?.close();
      rmSync(dir,{recursive:true,force:true});
    }
  }
  writeFileSync(join(out,'results.json'),JSON.stringify({captures,errors},null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
