import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const dir='/tmp/simlife-025-visual';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader',
]});
const errors=[];
const report={};
try{
  const page=await browser.newPage({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,
  });
  page.on('pageerror',err=>errors.push('finance: '+err.message));
  await page.goto('http://127.0.0.1:4173/qa-budget-025.html',
    {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:18000});
  report.finance=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,
    controls:Number(document.body.dataset.phoneControls),
    savings:Number(document.body.dataset.savings),
    inputs:document.querySelectorAll('#phone-content [data-budget-limit]').length,
    goals:document.querySelectorAll('#phone-content [data-budget-goal] option').length,
  }));
  if(report.finance.width>390||report.finance.controls!==1||
     report.finance.inputs!==3||report.finance.goals!==5)
    errors.push('Phone finance UI regression '+JSON.stringify(report.finance));
  await page.locator('#phone').screenshot({path:path.join(dir,'iphone-finance-budget.png')});
  const limit=page.locator('#phone-content [data-budget-limit="takeout"]');
  await limit.fill('2000');
  await limit.locator('..').locator('button').click();
  await page.locator('#phone-content [data-budget-quick="1000"]').click();
  await page.locator('#phone-content [data-budget-goal]').selectOption('vladStudio');
  const commands=await page.evaluate(()=>JSON.parse(document.body.dataset.sent||'[]'));
  report.commands=commands;
  if(!commands.some(c=>c.type==='budget_limit'&&c.category==='takeout'&&c.amount===2000))
    errors.push('No spending limit update sent');
  if(!commands.some(c=>c.type==='budget_deposit'&&c.amount===1000))
    errors.push('No deposit event');
  if(!commands.some(c=>c.type==='budget_goal'&&c.goal==='vladStudio'))
    errors.push('Goal selector not wired');
  await page.setViewportSize({width:1024,height:1200});
  await page.locator('#computer').screenshot({path:path.join(dir,'desktop-finance-budget.png')});
  const petPage=await browser.newPage({
    viewport:{width:390,height:850},isMobile:true,hasTouch:true,deviceScaleFactor:1,
  });
  petPage.on('pageerror',err=>errors.push('pets: '+err.message));
  await petPage.goto('http://127.0.0.1:4173/qa-pets-024.html',
    {waitUntil:'domcontentloaded',timeout:30000});
  await petPage.waitForFunction(()=>document.body.dataset.ready==='true',{timeout:30000});
  report.pets=await petPage.evaluate(()=>({
    begging:document.body.dataset.begging,
    paws:document.body.dataset.bothPaws,
    head:Number(document.body.dataset.catHead),
    unique:Number(document.body.dataset.unique),
    width:document.documentElement.scrollWidth,
  }));
  if(report.pets.begging!=='true'||report.pets.paws!=='true'||
      report.pets.head>.82||report.pets.unique!==4||report.pets.width>390)
    errors.push('Pet model regression '+JSON.stringify(report.pets));
  await petPage.locator('#scene').screenshot({path:path.join(dir,'simba-flat-nose-verdell-bunny.png')});
  fs.writeFileSync(path.join(dir,'qa-results.json'),JSON.stringify({report,errors},null,2));
  if(errors.length)throw new Error(errors.join('; '));
}finally{await browser.close();}
