import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const dir='/tmp/simlife-026-evening-visual';
fs.mkdirSync(dir,{recursive:true});
const errors=[];
const results=[];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
try{
  for(const width of [320,390,430]){
    const page=await browser.newPage({viewport:{width,height:844},
      isMobile:true,hasTouch:true,deviceScaleFactor:1});
    page.on('pageerror',error=>errors.push(width+': '+error.message));
    await page.goto('http://127.0.0.1:4173/qa-evening-026.html',
      {waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:20000});
    for(const [phase,file,buttonName,action] of [
      ['none','00-plan','Спланировать вечер вдвоём','eveningPlan'],
      ['prepare','01-prepare','Приготовить вместе','cook'],
      ['dine','02-dinner','Позвать к столу','eat'],
      ['dine:leftovers','02b-leftovers','Позвать к столу','eat'],
      ['dine:takeout','02c-takeout','Разделить доставку','takeout'],
      ['unwind','03-relax','Посмотреть ТВ вдвоём','tv'],
      ['unwind:takeout','03b-talk','Поговорить по душам','eveningHeartTalk'],
      ['complete','04-memories','Спланировать вечер вдвоём','eveningPlan'],
    ]){
      const [stage,mealKind='cook']=phase.split(':');
      await page.evaluate(([stage,mealKind])=>window.testStage(stage,mealKind),[stage,mealKind]);
      const button=page.locator('#relationship button').filter({hasText:buttonName}).first();
      if(await button.count()!==1){
        errors.push('Missing step button '+width+' '+phase);
        continue;
      }
      await button.click();
      const expanded=page.locator('#social [data-social-action="'+action+'"]');
      if(await expanded.count()!==1 || await expanded.getAttribute('aria-expanded')!=='true')
        errors.push('Expected expanded action '+width+' '+phase+' '+action);
      if(stage==='prepare'||stage==='dine'){
        const picker=page.locator('#social [data-social-item="'+action+'"]');
        const expected=mealKind==='takeout'?'pizzaCheese':'omelette';
        if(await picker.count()!==1||await picker.inputValue()!==expected)
          errors.push('Evening food was not preselected '+width+' '+phase);
      }
      await page.locator('#phone').screenshot({
        path:path.join(dir,width+'-'+file+'.png')});
      const sizes=await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
        storyText:document.querySelector('#relationship')?.textContent,
      }));
      results.push({width,phase,action,...sizes});
      if(sizes.scrollWidth>width+1)
        errors.push('Horizontal overflow '+width+' '+phase+' '+JSON.stringify(sizes));
      if(phase==='complete'&&!sizes.storyText.includes('Наш вечер вдвоём'))
        errors.push('Completed memory absent '+width);
    }
    await page.close();
  }
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({results,errors},null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
