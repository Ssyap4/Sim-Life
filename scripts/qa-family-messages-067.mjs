
import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {albumFor} from '../src/shared/familyAlbum.ts';
import {messagesFor} from '../src/shared/familyMessages.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const dir=mkdtempSync(join(tmpdir(),'chat067-')),out='/tmp/simourhome-067-chat';mkdirSync(out,{recursive:true});
let server,browser;const pages=[];
try{
 const s=initialState();s.autonomy={vlad:'off',alina:'off'};const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const errors=[];
 async function login(role,width,height){const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});await p.locator('[data-role='+role+']').first().click();await p.locator('.enter-button').click();await p.locator('#auth').waitFor({state:'hidden',timeout:30000});return p;}
 async function open(p){await p.locator('#phone-btn').click();await p.locator('[data-phone-app=messages]').click();await p.locator('.family-chat').waitFor();}
 async function send(p,text){await p.getByRole('textbox',{name:'Сообщение',exact:true}).fill(text);await p.getByRole('button',{name:'Отправить',exact:true}).click();await p.locator('.chat-bubble.mine').getByText(text,{exact:true}).waitFor();await p.waitForFunction(()=>document.querySelector('.family-chat-compose textarea').value==='');}
 async function shot(p,name){for(let i=0;i<8;i++){const close=p.locator('.notice-close').first();if(!await close.isVisible())break;await close.evaluate(el=>el.click());}assert.ok(await p.locator('.family-chat').evaluate(el=>el.scrollWidth<=el.clientWidth+1));const bytes=await p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:75});const b=bytes.toString('base64');for(let i=0;i<b.length;i+=3000)console.log('QA_IMAGE '+name+' '+b.slice(i,i+3000));}
 const v=await login('vlad',390,844);await open(v);await send(v,'Алин, захвати по дороге молоко ♡');
 const a=await login('alina',320,568);await a.locator('#phone-btn').click();await a.locator('[data-chat-unread]').getByText('1',{exact:true}).waitFor();await a.locator('[data-phone-app=messages]').click();await a.locator('.chat-bubble.theirs').getByText('Алин, захвати по дороге молоко ♡',{exact:true}).waitFor();await v.getByText('Прочитано',{exact:false}).waitFor();
 await send(a,'Хорошо! Буду дома скоро :)');
 await v.locator('.chat-bubble.theirs').getByText('Хорошо! Буду дома скоро :)',{exact:true}).waitFor();
 assert.equal(messagesFor(files.load()).items.length,2);
 await a.getByRole('textbox',{name:'Сообщение',exact:true}).fill('Черновик');await a.locator('[data-phone-back]').click();await a.locator('[data-phone-app=messages]').click();assert.equal(await a.getByRole('textbox',{name:'Сообщение',exact:true}).inputValue(),'Черновик');
 await shot(v,'vlad-390');await shot(a,'alina-320');assert.deepEqual(errors,[]);
 console.log('Two mobile clients: chat, offline delivery, receipt, draft passed');
 await v.locator('[data-phone-back]').click();await v.locator('[data-phone-app=album]').click();await v.getByRole('button',{name:'📷 Сделать фото',exact:true}).click();
 await v.locator('.photo-mode').waitFor({state:'visible'});await v.getByRole('button',{name:'📷 Снять',exact:true}).click();
 await v.getByRole('textbox',{name:'Подпись к фото'}).waitFor();
 const picture=v.locator('.family-album img').first();
 await picture.evaluate(img=>img.decode());
 const stats=await picture.evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let min=255,max=0;for(let i=0;i<data.length;i+=16){const x=(data[i]+data[i+1]+data[i+2])/3;min=Math.min(min,x);max=Math.max(max,x);}return {width:c.width,height:c.height,contrast:max-min,src:img.src};});
 assert.ok(Math.max(stats.width,stats.height)<=640&&stats.contrast>25,'Real nonblank world image');
 await v.getByRole('textbox',{name:'Подпись к фото'}).fill('Наш первый кадр');
 await v.getByRole('button',{name:'Сохранить в альбом',exact:true}).click();
 await v.locator('.album-tile').getByText('Наш первый кадр',{exact:true}).waitFor();assert.equal(albumFor(files.load()).length,1);
 await a.locator('[data-phone-back]').click();await a.locator('[data-phone-app=album]').click();await a.locator('.album-tile').getByText('Наш первый кадр',{exact:true}).click();
 await a.locator('.family-album img').waitFor();assert.equal(await a.locator('.family-album img').getAttribute('src'),stats.src);
 assert.equal(await a.getByText('Удалить мой снимок',{exact:true}).count(),0);
 for(const [p,name] of [[a,'album-alina-320'],[v,'album-vlad-390']]){
  for(let i=0;i<8;i++){const close=p.locator('.notice-close').first();if(!await close.isVisible())break;await close.evaluate(el=>el.click());}
  assert.ok(await p.locator('.family-album').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  const bytes=await p.screenshot({path:join(out,name+'.jpg'),type:'jpeg',quality:75}),b=bytes.toString('base64');
  for(let i=0;i<b.length;i+=3000)console.log('QA_IMAGE '+name+' '+b.slice(i,i+3000));
 }
 await v.locator('.album-tile').getByText('Наш первый кадр',{exact:true}).click();await v.getByText('Удалить мой снимок',{exact:true}).click();await v.getByRole('button',{name:'Подтвердить удаление'}).click();await a.getByText('Наш первый кадр',{exact:false}).waitFor({state:'hidden'});
 assert.equal(albumFor(files.load()).length,0);assert.deepEqual(errors,[]);
 console.log('Real WebGL frame capture and shared album passed');
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
