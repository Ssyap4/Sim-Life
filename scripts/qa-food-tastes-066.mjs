
import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {changeFoodFavorite,favoriteFood} from '../src/shared/foodTastes.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const dir=mkdtempSync(join(tmpdir(),'taste-066-ui-')),out='/tmp/simourhome-066-tastes';
mkdirSync(out,{recursive:true});let server,browser,page;
try{
 let s=initialState();s.autonomy={vlad:'off',alina:'off'};
 s=changeFoodFavorite(s,'alina','meal','blackTeaCup',true).state;
 s=changeFoodFavorite(s,'alina','coffee','Латте',true).state;
 s=changeFoodFavorite(s,'alina','cafe','cappuccino',true).state;
 s=changeFoodFavorite(s,'alina','takeout','milkChocolate',true).state;
 s.pantry.eggs=0;s.pantry.milk=0;
 const files=openServerFiles(dir);files.save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!!document.querySelector('.enter-button')&&!document.querySelector('.enter-button').disabled,undefined,{timeout:70000});
 await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 await page.locator('#phone-btn').click();await page.locator('[data-phone-app=profiles]').click();await page.locator('[data-profile-collection=taste]').click();
 const profile=page.locator('.resident-profile');
 await profile.getByRole('button',{name:'Показать весь ассортимент'}).click();
 await profile.getByRole('searchbox').fill('омлет');
 const row=profile.locator('.collection-entry').filter({hasText:'Домашний омлет'});
 await row.getByRole('button',{name:'♡ В избранное'}).click();
 await row.getByRole('button',{name:'♥ В избранном'}).waitFor();
 for(let i=0;i<30&&!favoriteFood(files.load(),'vlad','meal','omelette');i++)await page.waitForTimeout(100);
 assert.ok(favoriteFood(files.load(),'vlad','meal','omelette'));
 await profile.getByRole('searchbox').fill('');await profile.getByLabel('Категория вкусов').selectOption('coffee');await profile.getByRole('searchbox').fill('латте');
 await profile.locator('.taste-row').filter({hasText:'Латте'}).getByRole('button',{name:'♡ В избранное'}).click();
 await profile.locator('.taste-row').filter({hasText:'Латте'}).getByRole('button',{name:'♥ В избранном'}).waitFor();
 for(let i=0;i<30&&!favoriteFood(files.load(),'vlad','coffee','Латте');i++)await page.waitForTimeout(100);assert.ok(favoriteFood(files.load(),'vlad','coffee','Латте'));
 await profile.getByLabel('Категория вкусов').selectOption('all');await profile.getByRole('searchbox').fill('');await profile.getByRole('button',{name:'Показать только любимое'}).click();
 for(let i=0;i<8;i++){const close=page.locator('.notice-close').first();if(!await close.isVisible())break;await close.evaluate(el=>el.click());}
 for(const [width,height] of [[320,568],[360,780],[390,844],[430,932]]){
  await page.setViewportSize({width,height});assert.ok(await profile.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'profile overflow '+width);
  const bytes=await page.screenshot({path:join(out,'own-'+width+'.jpg'),type:'jpeg',quality:75});
  if(width===390||width===320){const b=bytes.toString('base64');for(let i=0;i<b.length;i+=3000)console.log('QA_IMAGE own-'+width+' '+b.slice(i,i+3000));}
 }
 await page.locator('[data-profile-role=alina]').click();await profile.getByText('Чёрный чай',{exact:false}).waitFor();assert.equal(await profile.locator('.taste-favorite').count(),0);
 await profile.getByText('Капучино',{exact:false}).waitFor();await profile.getByText('Латте',{exact:false}).waitFor();
 const partner=await page.screenshot({path:join(out,'partner.jpg'),type:'jpeg',quality:75});const encoded=partner.toString('base64');for(let i=0;i<encoded.length;i+=3000)console.log('QA_IMAGE partner '+encoded.slice(i,i+3000));
 await page.locator('[data-phone-back]').click();await page.locator('[data-phone-app=delivery]').click();
 const market=page.locator('.market-card').filter({visible:true});
 await market.getByRole('button',{name:'♡ Любит партнёр',exact:true}).click();
 const chocolate=market.locator('.market-product').filter({hasText:'Молочный шоколад'});
 await chocolate.waitFor();assert.equal(await market.locator('.market-product').count(),1);
 await chocolate.getByRole('button',{name:'♡ В избранное'}).click();
 for(let i=0;i<30&&!favoriteFood(files.load(),'vlad','takeout','milkChocolate');i++)await page.waitForTimeout(100);
 assert.ok(favoriteFood(files.load(),'vlad','takeout','milkChocolate'));
 await market.getByRole('button',{name:'♥ Моё любимое',exact:true}).click();await chocolate.waitFor();
 await market.locator('.market-search-input').fill('шоколад');assert.equal(await market.locator('.market-product').count(),1);
 await chocolate.getByRole('button',{name:'+',exact:true}).click();
 assert.match(await market.locator('.market-summary').innerText(),/1 уп/);
 await market.getByRole('button',{name:'Для любимых блюд',exact:true}).click();
 assert.equal(await market.locator('.market-product').count(),2);
 assert.match(await market.locator('.market-products').innerText(),/Молоко/);
 assert.match(await market.locator('.market-products').innerText(),/Яйца/);
 assert.match(await market.locator('.market-summary').innerText(),/1 уп/);
 for(const [width,height] of [[320,568],[390,844]]){
  await page.setViewportSize({width,height});assert.ok(await market.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  const shot=await page.screenshot({path:join(out,'delivery-'+width+'.jpg'),type:'jpeg',quality:75});const b=shot.toString('base64');for(let i=0;i<b.length;i+=3000)console.log('QA_IMAGE delivery-'+width+' '+b.slice(i,i+3000));
 }
 assert.deepEqual(errors,[]);console.log('Mobile taste profiles and delivery OK');
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
