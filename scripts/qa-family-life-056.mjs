import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {once} from 'node:events';
import {initialState} from '../src/shared/protocol.ts';
import {offerLifeEvent,creditHobby} from '../src/shared/familyLife.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const dir=mkdtempSync(join(tmpdir(),'family-life-056-')),out='/tmp/simlife-family-life-056';
mkdirSync(out,{recursive:true});let server,browser,buddy;const winter=process.argv.includes('winter'),goal=process.argv.includes('goal');
try{
 const s=initialState();s.clock=winter?{day:30,minute:1130}:{day:3,minute:600};s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 if(!winter)s.familyLife.event={id:goal?'budgetDinner':'refund',day:3,status:'open'};
 if(goal){s.money=1000;s.pantry.eggs=2;s.pantry.milk=1;}creditHobby(s,'vlad',{type:'read_book',book:'master'});
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:goal?.3:1,lifeClock:{now:()=>0,tickMs:600000}});
 const buddyPackets=[];buddy=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');buddy.on('message',x=>{try{buddyPackets.push(JSON.parse(x.toString()));}catch{}});
 await once(buddy,'open');buddy.send(JSON.stringify({type:'auth',role:'alina',code:'TEST-LOCAL-NO-CODES'}));
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=async(name)=>{const p=join(out,name+'.jpg');await page.screenshot({path:p,type:'jpeg',quality:80,timeout:20000});const b64=readFileSync(p).toString('base64');for(let i=0;i<b64.length;i+=6000)console.log('FAMILYQA_IMAGE '+name+' '+(i/6000)+' '+b64.slice(i,i+6000));};
 await page.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&holidayQA=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 if(winter){
  await page.waitForFunction(()=>document.querySelector('canvas[data-holiday-tree]')?.dataset.holidayTree==='true',undefined,{timeout:30000});
  await shot('04-winter-home');
  await page.locator('canvas[data-holiday-tree]').evaluate(c=>c.dataset.holidayView='tree');await page.waitForTimeout(1000);await shot('05-winter-tree');
  await page.locator('#phone-btn').click();await page.locator('[data-phone-app=holidays]').click();await page.getByText('31.12 · Можно праздновать!',{exact:true}).waitFor();await shot('06-new-year');
  assert.deepEqual(errors,[]);console.log('Winter decorations visible in actual home scene');
 }else if(goal){
  await page.locator('#phone-btn').click();await page.locator('[data-phone-app=events]').click();await page.getByRole('button',{name:'Приготовить дома',exact:true}).click();await page.getByText('В процессе',{exact:true}).waitFor();await shot('07-context-pending');
  assert.equal(openServerFiles(dir).load().familyLife.event.status,'accepted');
  buddy.send(JSON.stringify({type:'cook',recipe:'omelette'}));
  await page.getByText('Выполнено',{exact:true}).waitFor({timeout:60000});await shot('08-context-complete');
  const saved=openServerFiles(dir).load();assert.equal(saved.familyLife.event.status,'completed');assert.equal(saved.pantry.eggs,0);assert.equal(saved.pantry.milk,0);
  assert.ok(buddyPackets.some(p=>p.type==='task_ended'&&p.role==='alina'&&p.outcome==='completed'&&p.message.includes('Событие выполнено')));assert.deepEqual(errors,[]);console.log('Context event accepted by Vlad and completed by real cooking of Alina');
 }else{
 await page.locator('#phone-btn').click();
 await page.locator('[data-phone-app=holidays]').click();await page.getByText('Семейные праздники',{exact:false}).first().waitFor();
 const anniversary=page.locator('.family-life-phone article').filter({has:page.getByText('Годовщина отношений',{exact:true})}).last();
 await anniversary.locator('input').fill('25');await anniversary.locator('select').selectOption('3');await anniversary.getByRole('button',{name:'Сохранить'}).click();
 await page.getByText('25.03 · Можно праздновать!',{exact:true}).waitFor();await shot('01-holidays');
 await page.locator('[data-phone-back]').click();await page.locator('[data-phone-app=hobbies]').click();
 await page.getByText('Занятий: 1',{exact:false}).waitFor();await shot('02-hobbies');
 await page.locator('[data-phone-back]').click();await page.locator('[data-phone-app=events]').click();
 await page.getByRole('button',{name:'Получить 350 ₽'}).waitFor();await shot('03-event');
 await page.getByRole('button',{name:'Получить 350 ₽'}).click();await page.getByText('Принято',{exact:true}).waitFor();
 const snapshot=buddyPackets.findLast(p=>p.type==='snapshot'&&p.state.familyLife?.event?.status==='accepted');
 assert.ok(snapshot);assert.equal(snapshot.state.money,100350);assert.deepEqual(snapshot.state.familyLife.dates.anniversary,{day:25,month:3});
 buddy.send(JSON.stringify({type:'family_event',day:3,id:'refund',accept:true}));
 await new Promise(r=>setTimeout(r,500));assert.equal(openServerFiles(dir).load().money,100350);
 assert.deepEqual(errors,[]);console.log('Family calendar, hobby collection, shared event, actual UI and persisted single reward passed');
 }
}finally{await browser?.close();buddy?.terminate();await server?.close();rmSync(dir,{recursive:true,force:true});}
