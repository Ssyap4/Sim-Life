import {chromium} from 'playwright';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {initialState} from '../src/shared/protocol.ts';
import {openServerFiles} from '../server/storage.ts';
import {startServer} from '../server/server.ts';
const dir=mkdtempSync(join(tmpdir(),'family-story-062-')),out='/tmp/simlife-family-story-062';
mkdirSync(out,{recursive:true});let server,browser;
try{
 const s=initialState();s.clock={day:12,minute:480};s.autonomy={vlad:'off',alina:'off'};
 for(let i=0;i<30;i++)s.relationship.memories.push({at:i*480,action:i%2?'familyMoment:parkBreak':'film',group:i%2?'fun':'care',title:i%2?'Наш день в парке':'Вечер дома',description:'Провели время вдвоём.'});
 openServerFiles(dir).save(s);
 server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,distDir:resolve('dist'),testNoCodes:true,lifeClock:{now:()=>0,tickMs:600000}});
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.port+'/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.enter-button').waitFor({timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('.enter-button')?.disabled,undefined,{timeout:70000});
 await page.locator('[data-role=vlad]').first().click();await page.locator('.enter-button').click();await page.locator('#auth').waitFor({state:'hidden',timeout:30000});
 await page.locator('#phone-btn').click();await page.locator('[data-phone-app=relationship]').click();
 await page.getByRole('button',{name:'Семейный дневник ↓'}).click();
 const journal=page.locator('.family-journal');
 assert.equal(await journal.locator('.journal-list article').count(),12);
 await journal.getByRole('button',{name:'Показать ещё · 18'}).click();
 assert.equal(await journal.locator('.journal-list article').count(),24);
 await journal.getByRole('button',{name:'Особенные',exact:true}).click();
 assert.equal(await journal.locator('.journal-list article').count(),12);
 assert.equal(await journal.locator('.journal-list article strong').first().textContent(),'✦ Наш день в парке');
 for(const [width,height] of [[390,844],[320,568],[360,780],[430,932]]){
  await page.setViewportSize({width,height});await journal.scrollIntoViewIfNeeded();
  await page.screenshot({path:join(out,'journal-'+width+'.png')});
  assert.ok(await journal.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'journal horizontal overflow '+width);
 }
 await page.setViewportSize({width:390,height:844});
 const heritage=page.locator('.family-heritage');await heritage.locator('summary').click();
 await heritage.getByText('Наши прогулки',{exact:false}).waitFor();
 await heritage.getByText('Уже стало вашей традицией',{exact:true}).waitFor();
 await heritage.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,'traditions.png')});
 await page.locator('[data-phone-back]').click();await page.locator('[data-phone-app=weekends]').click();
 await page.locator('[data-weekend-preset=date]').click();
 await page.locator('[data-weekend-pick=dance]').waitFor();
 await page.locator('[data-weekend-propose]').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,'new-plans.png')});
 assert.deepEqual(errors,[]);console.log('Real mobile journal filters, pagination, and 4 viewport captures passed');
}finally{await browser?.close();await server?.close();rmSync(dir,{recursive:true,force:true});}
