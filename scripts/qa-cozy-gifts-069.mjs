import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
import {applyFurnishing} from '../server/furnishing.ts';
const out='/tmp/simourhome-069-cozy';mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'cozy-mobile-069-'));let browser,server;const pages=[];
try{
 let s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};s.clock={day:1,minute:1180};
 s.furnishing.placed=[{id:1,sku:'lamp-amber',finish:'oak',x:13.5,z:-5.5,rotation:0,lightMode:'off'},{id:2,sku:'sofa-cozy',finish:'sage',x:14.23,z:-7,rotation:0},{id:3,sku:'dresser-nora',finish:'oak',x:10.7,z:-6,rotation:0}];s.furnishing.stored=[{id:4,sku:'lamp-table-linen',finish:'ivory'}];s.furnishing.nextId=5;s.gifts={giftBear:1};
 let result=applyFurnishing(s,'vlad',{type:'furniture_place',id:4,x:10.7,z:-6,rotation:0},1180);assert.ok(result.ok);s=result.state;
 result=applyFurnishing(s,'vlad',{type:'furniture_light',id:4,mode:'off'},1180);assert.ok(result.ok);s=result.state;
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,taskTimeScale:1,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});const errors=[];
 async function login(role,width,height){const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const Native=window.WebSocket;window.__qaPackets=[];window.WebSocket=class extends Native{constructor(...a){super(...a);window.__qaSocket=this;this.addEventListener('message',e=>{try{window.__qaPackets.push(JSON.parse(e.data));}catch{}});}};});await p.goto('http://127.0.0.1:'+server.port+'/?cameraQA=1&cozyQA=1',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});await p.locator('[data-role='+role+']').first().tap();await p.locator('.enter-button').tap();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;}
 const shot=(p,name)=>p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:85});
 const v=await login('vlad',390,844),a=await login('alina',320,568);
 async function focus(p,id){await p.locator('#game-canvas').evaluate((c,id)=>c.dataset.cozyView=String(id),id);await p.waitForTimeout(500);}
 async function lampTap(p,mode){const canvas=p.locator('#game-canvas'),box=await canvas.boundingBox();await canvas.tap({position:{x:box.width/2,y:box.height/2}});await p.locator('[data-light-mode='+mode+']').tap({timeout:15000});}
 async function expectLamp(p,id,level){await p.waitForFunction(({id,level})=>{const x=JSON.parse(document.querySelector('#game-canvas').dataset.ownedLamp||'{}');return x.id===id&&Math.abs(x.level-level)<.001;},{id,level},{timeout:20000});}
 for(const p of [v,a])await focus(p,1);
 await lampTap(v,'warm');for(const p of [v,a])await expectLamp(p,1,1);await shot(v,'warm-390');await shot(a,'warm-320');
 await lampTap(a,'soft');for(const p of [v,a])await expectLamp(p,1,.45);await shot(v,'soft-390');
 await lampTap(v,'off');for(const p of [v,a])await expectLamp(p,null,0);await shot(a,'off-320');
 for(const p of [v,a])await focus(p,4);await lampTap(a,'warm');for(const p of [v,a])await expectLamp(p,4,1);await shot(v,'table-lamp-390');await shot(a,'table-lamp-320');
 await lampTap(a,'off');for(const p of [v,a])await expectLamp(p,null,0);
 for(const p of [v,a])await focus(p,2);await shot(v,'cozy-sofa-390');await shot(a,'cozy-sofa-320');
 for(const p of [v,a])await p.locator('#game-canvas').evaluate(c=>delete c.dataset.cozyView);
 await v.locator('#phone-btn').tap();await v.locator('[data-phone-app=relationship]').tap();
 await v.locator('[data-gift-shortcut]').tap();await v.locator('[data-social-action=giftBear]').waitFor();await shot(v,'gift-menu-390');
 await v.locator('[data-social-propose=giftBear]').tap();await a.locator('[data-social-reply="0"]').tap({timeout:20000});
 for(const p of [v,a])await p.waitForFunction(()=>{const d=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}');return d.actors?.vlad?.care?.gift?.id==='giftBear'&&d.actors.vlad.care.gift.visible;},undefined,{timeout:45000});
 await shot(v,'giving-390');await shot(a,'giving-320');
 for(const p of [v,a])await p.waitForFunction(()=>{const d=JSON.parse(document.querySelector('#game-canvas').dataset.yardQA||'{}');return d.actors?.alina?.care?.gift?.id==='giftBear'&&d.actors.alina.care.gift.visible;},undefined,{timeout:25000});
 await shot(v,'received-390');await shot(a,'received-320');
 for(const p of [v,a])await p.waitForFunction(()=>window.__qaPackets.some(p=>p.type==='snapshot'&&p.state.gifts?.giftBear===0),undefined,{timeout:30000});
 assert.equal(files.load().gifts?.giftBear,0);assert.equal(files.load().money,100000);assert.deepEqual(errors,[]);
 console.log('COZY GIFTS 069 MOBILE OK');
}catch(e){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:join(out,'failure-'+i+'.jpg')}).catch(()=>{});throw e;}
finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
