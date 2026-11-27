import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {homeSeat} from '../src/shared/home.ts';
import {applyServiceCommand} from '../server/services.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const out='/tmp/simourhome-068-media-games';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'media068-'));let browser,server;const pages=[];
try{
 let s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 const paid=applyServiceCommand(s,'vlad',{type:'service_connect',service:'netflix'});assert.ok(paid.ok);s=paid.state;
 for(const role of ['vlad','alina'])Object.assign(s.characters[role],homeSeat('sofa',role).approach,{pose:'idle',energy:100});
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:.12,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const errors=[];
 async function login(role,width,height){const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}};});await p.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});await p.locator('[data-role='+role+']').first().click();await p.locator('.enter-button').click();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;}
 const send=(p,c)=>p.evaluate(c=>window.__qaSocket.send(JSON.stringify(c)),c);
 async function shot(p,name){const bytes=await p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:75});const b=bytes.toString('base64');for(let i=0;i<b.length;i+=3000)console.log('QA_IMAGE '+name+' '+b.slice(i,i+3000));}
 async function catalog(p){await p.locator('#phone-btn').click();await p.locator('[data-phone-app=media]').click();await p.locator('.media-catalog-card').first().waitFor();}
 const v=await login('vlad',390,844),a=await login('alina',320,568);
 await catalog(v);await shot(v,'catalog-390');await catalog(a);await shot(a,'catalog-320');
 await a.getByRole('button',{name:'Закрыть меню',exact:true}).click();
 await v.getByRole('searchbox',{name:'Поиск в медиатеке'}).fill('Рыцарь');
 await v.locator('.media-catalog-card').getByRole('button',{name:'Выбрать серию'}).click();
 await v.getByRole('button',{name:'＋ Посмотреть вместе',exact:true}).click();
 await v.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.mediaLibrary?.together.includes('knight')));
 await v.getByRole('button',{name:'Продолжить · С1 Э1',exact:true}).click();
 await v.getByRole('button',{name:'Смотреть вместе',exact:true}).click();
 await a.locator('#movie-invite').getByRole('button',{name:'Принять',exact:true}).click();
 await v.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.mediaLibrary?.history.vlad.some(h=>h.id==='knight'&&h.episode===1)),undefined,{timeout:30000});
 assert.equal(files.load().mediaLibrary.history.alina[0].episode,1);
 await catalog(v);await v.getByRole('button',{name:'Продолжить',exact:true}).click();await v.getByRole('button',{name:'Продолжить · С1 Э2',exact:true}).waitFor();await shot(v,'series-progress');await v.getByRole('button',{name:'Закрыть меню',exact:true}).click();
 await send(v,{type:'venue_trip'});await send(a,{type:'venue_trip'});
 await v.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.world.places.vlad==='venue'&&p.state.world.places.alina==='venue'),undefined,{timeout:30000});
 await send(v,{type:'social_propose',action:'venueBowling',manual:true});
 await a.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='social_pending'&&p.offer.action==='venueBowling'));
 const offer=await a.evaluate(()=>window.__qaPackets.findLast(p=>p.type==='social_pending'&&p.offer.action==='venueBowling').offer.id);
 await send(a,{type:'social_reply',inviteId:offer,choice:0});
 await v.locator('#manual-bowling').waitFor({timeout:30000});await a.locator('#manual-bowling').waitFor();
 await shot(v,'bowling-vlad-390');await shot(a,'bowling-alina-320');
 let m=await v.evaluate(()=>window.__qaPackets.findLast(p=>p.type==='bowling_state').match);
 for(let i=0;i<30&&!m.finished;i++){
 const p=m.turn==='vlad'?v:a;const aim=m.sequence%2===0?.12:-.12;
 for(const [label,value] of [['Направление',aim],['Сила броска',m.turn==='vlad'?.78:0]])await p.getByRole('slider',{name:label}).evaluate((e,val)=>{e.value=String(val);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
 await p.getByRole('button',{name:'Бросить шар',exact:true}).click();const seq=m.sequence+1;
 await v.waitForFunction(seq=>window.__qaPackets.some(p=>p.type==='bowling_state'&&p.match.sequence===seq),seq);
 m=await v.evaluate(seq=>window.__qaPackets.findLast(p=>p.type==='bowling_state'&&p.match.sequence===seq).match,seq);
 }
 assert.ok(m.finished);await v.getByRole('button',{name:'Реванш',exact:true}).waitFor();assert.equal(files.load().bowlingHistory.length,1);assert.equal(files.load().bowlingHistory[0].vlad,150);
 await shot(v,'bowling-finish');
 await v.locator('#manual-bowling').getByRole('button',{name:'Закрыть',exact:true}).click();await a.locator('#manual-bowling').getByRole('button',{name:'Закрыть',exact:true}).click();
 const beforeHockey=files.load().money;
 await send(v,{type:'social_propose',action:'venueHockey',manual:true});await a.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='social_pending'&&p.offer.action==='venueHockey'));
 const hockeyOffer=await a.evaluate(()=>window.__qaPackets.findLast(p=>p.type==='social_pending'&&p.offer.action==='venueHockey').offer.id);await send(a,{type:'social_reply',inviteId:hockeyOffer,choice:0});
 await v.locator('#manual-hockey').waitFor({timeout:30000});await a.locator('#manual-hockey').waitFor();
 for(const p of [v,a]){const field=await p.locator('.hockey-table').boundingBox();assert.ok(field);await p.touchscreen.tap(field.x+field.width*.8,field.y+field.height*.65);}
 await v.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='hockey_state'&&p.match.pads.vlad.x>.12&&p.match.pads.alina.x<-.12));
 await shot(v,'hockey-vlad-390');await shot(a,'hockey-alina-320');
 await a.locator('#manual-hockey').getByRole('button',{name:'Отменить партию',exact:true}).click();await v.locator('#manual-hockey').waitFor({state:'hidden'});assert.equal(files.load().money,beforeHockey);assert.deepEqual(errors,[]);
 const beforePool=files.load().money;
 await send(v,{type:'social_propose',action:'venueBilliards',manual:true});await a.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='social_pending'&&p.offer.action==='venueBilliards'));
 const poolOffer=await a.evaluate(()=>window.__qaPackets.findLast(p=>p.type==='social_pending'&&p.offer.action==='venueBilliards').offer.id);await send(a,{type:'social_reply',inviteId:poolOffer,choice:0});
 await v.locator('#manual-pool').waitFor({timeout:30000});await a.locator('#manual-pool').waitFor();
 assert.equal(await a.getByRole('button',{name:'Ударить кием'}).isDisabled(),true);
 const felt=await v.locator('.pool-table').boundingBox();assert.ok(felt);await v.touchscreen.tap(felt.x+felt.width*.5,felt.y+felt.height*.24);
 await shot(v,'pool-vlad-390');await shot(a,'pool-alina-320');
 await v.getByRole('button',{name:'Ударить кием'}).click();await a.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='pool_state'&&p.match.sequence===1&&p.match.moving));
 await a.locator('#manual-pool').getByRole('button',{name:'Отменить партию',exact:true}).click();await v.locator('#manual-pool').waitFor({state:'hidden'});assert.equal(files.load().money,beforePool);assert.deepEqual(errors,[]);
 console.log('068 media, bowling, hockey and pool mobile QA passed');
}catch(e){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:join(out,'failure-'+i+'.jpg')}).catch(()=>{});throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
