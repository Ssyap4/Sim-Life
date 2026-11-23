import {chromium} from 'playwright';
import WebSocket from 'ws';
import {once} from 'node:events';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {initialState} from '../src/shared/protocol.ts';
import {startServer} from '../server/server.ts';
import {familyMoments,FAMILY_MOMENT_PREFIX} from '../src/shared/familyMoments.ts';
import {openServerFiles} from '../server/storage.ts';

const out='/tmp/simlife-028-people-real-3d';
mkdirSync(out,{recursive:true});
const saves=mkdtempSync(join(tmpdir(),'simlife-028-people-'));
const files=openServerFiles(saves);
const state=initialState();
state.pantry.eggs=10;state.pantry.milk=8;
state.autonomy.vlad='off';state.autonomy.alina='off';
files.save(state);
const errors=[],results=[];
let server,browser,buddy,page;
const queue=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitPacket=async(type,predicate=()=>true,ms=30000)=>{
  const deadline=Date.now()+ms;
  while(Date.now()<deadline){
    const i=queue.findIndex(p=>p.type===type&&predicate(p));
    if(i>=0)return queue.splice(i,1)[0];
    const failure=queue.find(p=>p.type==='error');
    if(failure)throw Error('WebSocket: '+failure.reason);
    await sleep(40);
  }
  throw Error('Timed out for '+type+' after '+JSON.stringify(queue.slice(-8).map(p=>p.type)));
};
const snap=async(name)=>{
  await page.screenshot({path:join(out,name+'.png'),timeout:22000});
  const info=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
    viewport:window.innerWidth,authHidden:document.querySelector('#auth')?.hidden,
    canvas:document.querySelector('canvas')?.getBoundingClientRect().toJSON(),
    status:document.querySelector('#status')?.textContent,
    action:document.querySelector('#task-panel')?.textContent?.slice(0,130),
  }));
  results.push({name,...info});
  if(info.width>info.viewport+2)errors.push(name+': horizontal scroll '+info.width+' > '+info.viewport);
};
try{
  server=await startServer({port:0,host:'127.0.0.1',dataDir:saves,distDir:resolve('dist'),
    testNoCodes:true,taskTimeScale:2.3});
  const base='http://127.0.0.1:'+server.port;
  browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
    '--disable-dev-shm-usage',
  ]});
  const context=await browser.newContext({viewport:{width:390,height:844},
    hasTouch:true,isMobile:true,deviceScaleFactor:1});
  page=await context.newPage();
  page.on('pageerror',error=>errors.push('Page exception: '+error.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push('Browser: '+msg.text().slice(0,240));});
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.enter-button').waitFor({state:'visible',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,{timeout:70000});
  await page.locator('.enter-button').click();
  await page.waitForFunction(()=>document.querySelector('#auth')?.hidden===true,{timeout:15000});
  await sleep(450);
  await snap('01-world-iphone');

  buddy=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');
  buddy.on('message',data=>{try{queue.push(JSON.parse(data.toString()));}catch{}});
  await once(buddy,'open');
  buddy.send(JSON.stringify({type:'auth',role:'alina',code:'TEST-LOCAL-NO-CODES'}));
  await waitPacket('ready');
  // Actual dual-user 3D, no mock scene: both clients must accept, approach,
  // synchronize gestures and complete their server-owned tasks.
  for(const [idx,action,item] of [
    ['01','softHug',null],
    ['02','kiss',null],
    ['03','petPet','simba'],
  ]){
    buddy.send(JSON.stringify({type:'social_propose',action,...(item?{item}:{})}));
    const invitation=await waitPacket('social_pending',p=>p.offer.action===action,12000);
    await page.locator('#social-invite:not([hidden])').waitFor({timeout:14000});
    await page.locator('#social-invite [data-social-reply="0"]').click();
    await waitPacket('social_closed',p=>p.inviteId===invitation.offer.id&&p.phase==='accepted',15000);
    const first=await waitPacket('task_started',p=>p.role==='vlad'&&p.command.type==='together'&&p.command.action===action,16000);
    const second=await waitPacket('task_started',p=>p.role==='alina'&&p.command.type==='together'&&p.command.action===action,16000);
    if(!first.home?.pair||!second.home?.pair)
      errors.push(action+': missing server-defined synchronized pair animation');
    await waitPacket('task_active',p=>p.role==='vlad'&&p.taskId===first.taskId,40000);
    const focused=await page.evaluate(()=>{
      const el=document.querySelector('.running-task[data-role="vlad"] [data-focus-shared]');
      if(!(el instanceof HTMLButtonElement))return false;
      el.click();return true;
    });
    if(!focused)errors.push(action+': no in-game shared camera');
    for(let frame=0;frame<3;frame++){
      await sleep(800);
      await snap(idx+'-'+action+'-couple-'+frame);
    }
    const finished=await waitPacket('task_ended',p=>p.role==='vlad'&&p.taskId===first.taskId,90000);
    if(finished.outcome!=='completed')errors.push(action+': '+finished.outcome+' '+finished.message);
    await waitPacket('task_ended',p=>p.role==='alina'&&p.taskId===second.taskId,12000);
    await sleep(450);
  }
  // Real purchased/fixture laptop and its active screen. Camera follows
  // Alina performing an existing game, not a separate static mock monitor.
  buddy.send(JSON.stringify({type:'play_game',device:'laptop',game:'paw-house'}));
  const laptop=await waitPacket('task_started',
    p=>p.role==='alina'&&p.command.type==='play_game',20000);
  // Solo laptop tasks use the regular task runner: unlike co-op tasks,
  // they do not emit the co-op-only `task_active` packet. Let the REAL actor
  // approach the physical machine before filming its animated display.
  await sleep(3400);
  await page.locator('#showcase-toggle').click();
  await page.locator('[data-showcase="alina"]').click();
  for(let frame=0;frame<3;frame++){
    await sleep(850);
    await snap('04-laptop-animated-screen-'+frame);
  }
  await page.locator('#showcase-return').click();
  writeFileSync(join(out,'results.json'),JSON.stringify({errors,results},null,2));
  if(errors.length)throw Error(errors.join('\n'));
} finally {
  try{buddy?.close();}catch{}
  try{await browser?.close();}catch{}
  try{await server?.close();}catch{}
  rmSync(saves,{recursive:true,force:true});
}
