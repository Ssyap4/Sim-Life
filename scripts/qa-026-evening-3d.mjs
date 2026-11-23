import {chromium} from 'playwright';
import WebSocket from 'ws';
import {once} from 'node:events';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {initialState} from '../src/shared/protocol.ts';
import {startServer} from '../server/server.ts';
import {openServerFiles} from '../server/storage.ts';

const out='/tmp/simlife-026-real-3d';
mkdirSync(out,{recursive:true});
const saves=mkdtempSync(join(tmpdir(),'simlife-026-3d-'));
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
    testNoCodes:true,taskTimeScale:1});
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
  const actions=[
    ['eveningPlan','omelette','prepare','02-table-plan'],
    ['cook','omelette','dine','03-shared-cooking'],
    ['eat','omelette','unwind','04-dinner-for-two'],
    ['tv',null,'complete','05-relax-together'],
  ];
  for(const [action,item,phase,shot] of actions){
    buddy.send(JSON.stringify({type:'social_propose',action,...(item?{item}:{})}));
    const offer=(await waitPacket('social_pending')).offer;
    await page.locator('#social-invite:not([hidden])').waitFor({timeout:10000});
    await snap('invite-'+action);
    await page.locator('#social-invite [data-social-reply="0"]').click();
    await waitPacket('social_closed',p=>p.inviteId===offer.id&&p.phase==='accepted',12000);
    const first=await waitPacket('task_started',p=>p.role==='vlad'&&p.command.type==='together'&&p.command.action===action);
    const peer=await waitPacket('task_started',p=>p.role==='alina'&&p.command.type==='together'&&p.command.action===action);
    if(first.home?.pair?.motion===undefined||peer.home?.pair?.motion===undefined)
      errors.push(action+': missing synchronized 3D motion');
    try {
      await waitPacket('task_active',p=>p.role==='vlad'&&p.taskId===first.taskId,20000);
      // The task card is short-lived in accelerated QA. Click synchronously BEFORE
      // taking any slow software-WebGL screenshot, not after the task has ended.
      const focused=await page.evaluate(()=>{
        const button=document.querySelector('.running-task[data-role="vlad"] [data-focus-shared]');
        if(!(button instanceof HTMLButtonElement))return false;
        button.click();return true;
      });
      if(!focused)errors.push(action+': shared camera control missing while task active');
      // At production pace, residents can really reach their stations and perform
      // the gestures before the shot. A scaled 0.28 run only captured walking.
      await sleep(action==='tv'?6500:action==='cook'?4400:action==='eat'?3600:3000);
      await snap(shot+'-close-up');
    }catch(error){
      errors.push(action+': '+String(error));
      await snap(shot+'-fallback');
    }
    const ending=await waitPacket('task_ended',p=>p.role==='vlad'&&p.taskId===first.taskId,90000);
    if(ending.outcome!=='completed')errors.push(action+' ended: '+ending.outcome+' '+ending.message);
    await waitPacket('task_ended',p=>p.role==='alina'&&p.taskId===peer.taskId,10000);
    const current=files.load().relationship.evening;
    if(current?.phase!==phase)errors.push(action+' phase '+current?.phase+' expected '+phase);
    if(action==='eat'&&files.load().meals.omelette!==0)
      errors.push('Consumed dinner portions are still on the table');
    await sleep(700);
  }
  await page.locator('#phone-btn').click();
  await sleep(350);
  await snap('06-phone-after-evening');
  const finished=files.load();
  if(finished.relationship.memories.filter(m=>m.action==='homeEvening').length!==1)
    errors.push('Finished evening memory was not saved once');
  writeFileSync(join(out,'results.json'),JSON.stringify({
    errors,results,finishedEvening:finished.relationship.evening,
    memories:finished.relationship.memories.filter(m=>m.action==='homeEvening'),
  },null,2));
  if(errors.length)throw Error(errors.join('\n'));
} finally {
  try{buddy?.close();}catch{}
  try{await browser?.close();}catch{}
  try{await server?.close();}catch{}
  rmSync(saves,{recursive:true,force:true});
}
