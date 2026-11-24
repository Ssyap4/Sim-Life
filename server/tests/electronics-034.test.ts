
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../src/shared/protocol';
import { applyWorld,validWorld } from '../locations';
import { approachFor,stationById,placeObstacles,floorFor,spawn,STATIONS } from '../../src/shared/locations';
import { districtArrival } from '../../src/shared/district';
import { findRoute,pointIsClear } from '../../src/game/navigation';
import { ELECTRONICS,initialElectronics,installedElectronics,validElectronics,electronicsFor,ELECTRONICS_KINDS } from '../../src/shared/electronics';
import { beginShift,settleCompletedShifts } from '../jobs';
import { validHomeQuests } from '../../src/shared/homeJobQuests';
import { clockAt } from '../../src/shared/life';
import { evaluateTask } from '../tasks';
import { applyAction } from '../logic';
test('electronics shop has reachable entrance, exit, cashier and five display routes',()=>{
 for(const role of ['vlad','alina'] as const){
  assert.ok(findRoute(districtArrival('home',role),districtArrival('electronics',role),placeObstacles('district'),floorFor('district')));
  for(const st of STATIONS.electronics){const p=approachFor(st,role);assert.ok(pointIsClear(p,placeObstacles('electronics'),floorFor('electronics')),st.id);assert.ok(findRoute(spawn('electronics',role),p,placeObstacles('electronics'),floorFor('electronics')),st.id);}
 }
});
test('only cashier can sell electronics; personal phones, shared hardware, real prices and ledger',()=>{
 let s=initialState();s.money=100000;
 assert.equal(applyWorld(s,'vlad',{type:'electronics_buy',model:'pcOffice'}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 const travel=applyWorld(s,'vlad',{type:'car_travel',place:'electronics'});assert.ok(travel.ok);s=travel.state;
 assert.ok(validWorld(s.world));
 Object.assign(s.characters.vlad,approachFor(stationById('electronics','tech-cash')!,'vlad'));
 for(const model of ['fake','pcStart'])assert.equal(applyWorld(s,'vlad',{type:'electronics_buy',model}).ok,false);
 const pc=applyWorld(s,'vlad',{type:'electronics_buy',model:'pcOffice'});assert.ok(pc.ok);s=pc.state;
 assert.equal(s.money,100000-ELECTRONICS.pcOffice.price);assert.equal(installedElectronics(s,'alina','desktop'),'pcOffice');
 assert.equal(applyWorld(s,'vlad',{type:'electronics_buy',model:'pcOffice'}).ok,false);
 const phone=applyWorld(s,'vlad',{type:'electronics_buy',model:'phoneLite'});assert.ok(phone.ok);s=phone.state;
 assert.equal(installedElectronics(s,'vlad','phone'),'phoneLite');assert.equal(installedElectronics(s,'alina','phone'),'phoneStart');
 assert.equal(s.ledger.at(-1)?.category,'electronics');
 assert.equal(applyWorld(s,'vlad',{type:'electronics_buy',model:'pcPro'}).ok,false);
 assert.ok(validWorld(s.world));assert.ok(!validElectronics({...initialElectronics(),desktop:'tvHD'}));
 Object.assign(s.characters.vlad,approachFor(stationById('electronics','tech-exit')!,'vlad'));
 const home=applyWorld(s,'vlad',{type:'travel',place:'district',via:'tech-exit'});assert.ok(home.ok);assert.equal(home.state.world.places.vlad,'home');
 for(const kind of ELECTRONICS_KINDS)assert.equal(electronicsFor(kind).length,3);
});
test('upgraded computers shorten actual order time, retain quest count and full pay',()=>{
 for(const [role,device,job] of [['vlad','desktop','vibeSite'],['alina','laptop','wbCards']] as const){
  const state=initialState();state.world.electronics={...initialElectronics(),desktop:'pcPro',laptop:'laptopPro'};
  for(let n=0;n<12;n++){
   const r=beginShift(state,role,job,device,5);assert.ok(r.ok);
   const shift=r.state.activeShifts[role]!,speed=device==='desktop'?25:22;
   assert.equal(shift.homeSpeed,speed);assert.equal(shift.endsAt-shift.startedAt,Math.round(shift.hours*60*(100-speed)/100));
   assert.equal(shift.quests?.length,shift.hours);assert.ok(validHomeQuests(shift as unknown as Record<string,unknown>));
   r.state.clock=clockAt(shift.endsAt);const settled=settleCompletedShifts(r.state);
   assert.equal(settled.completed[0].payment,shift.targetPay);
  }
 }
});
test('upgraded TV and personal phones have measurable effects without changing basic equipment',()=>{
 const s=initialState();s.world.electronics={...initialElectronics(),tv:'tvOLED',phones:{vlad:'phonePro',alina:'phoneStart'}};
 Object.assign(s.characters.vlad,{fun:20,mood:20,social:20});Object.assign(s.characters.alina,{fun:20,mood:20,social:20});
 const tv=evaluateTask(s,'vlad',{type:'free_tv'});assert.ok(tv.ok);assert.equal(tv.state.characters.vlad.fun,37);assert.equal(tv.state.characters.vlad.mood,20);assert.equal(tv.state.characters.vlad.comfort,Math.min(100,s.characters.vlad.comfort+9));
 for(const role of ['vlad','alina'] as const){const call=applyAction(s,role,'sofaCall');assert.ok(call.ok);assert.equal(call.state.characters[role].social,42);const feed=applyAction(s,role,'sofaScroll');assert.ok(feed.ok);assert.equal(feed.state.characters[role].fun,role==='vlad'?50:38);assert.equal(feed.state.characters[role].mood,role==='vlad'?30:24);}
});

import { completeComputerGame, completeComputerVideo } from '../computers';
import { COMPUTER_GAMES, VIDEO_CLIPS } from '../../src/shared/computerGames';
import { MATERIALS } from '../../src/shared/educationCatalog';
import { educationalXP } from '../../src/shared/education';
import { completeStudy } from '../education';
import { planTask } from '../tasks';
test('PC and laptop upgrades grant device-specific entertainment and comfort gains',()=>{
 const base=initialState();Object.assign(base.characters.vlad,{fun:0,comfort:20});
 const upgraded=structuredClone(base);upgraded.world.electronics={...initialElectronics(),desktop:'pcPro',laptop:'laptopAir'};
 for(const device of ['desktop','laptop'] as const){
  const game=COMPUTER_GAMES[0].id;
  const a=completeComputerGame(base,'vlad',game,device),b=completeComputerGame(upgraded,'vlad',game,device);
  assert.ok(a.ok&&b.ok);assert.equal(b.state.characters.vlad.fun-a.state.characters.vlad.fun,device==='desktop'?9:3);
  assert.equal(b.state.characters.vlad.comfort-a.state.characters.vlad.comfort,device==='desktop'?6:2);
  const clip=Object.keys(VIDEO_CLIPS)[0];const c=completeComputerVideo(base,'vlad',clip,device),d=completeComputerVideo(upgraded,'vlad',clip,device);
  assert.ok(c.ok&&d.ok);assert.equal(d.state.characters.vlad.fun-c.state.characters.vlad.fun,device==='desktop'?9:3);
  assert.equal(d.state.characters.vlad.comfort-c.state.characters.vlad.comfort,device==='desktop'?6:2);
 }
});
test('Educational TV XP bonus applies only to completed TV materials',()=>{
 const a=initialState(),b=structuredClone(a);b.world.electronics={...initialElectronics(),tv:'tvOLED'};
 const item=MATERIALS.find(m=>m.channel==='tv'&&educationalXP(m,'vlad',a.education.characters.vlad)>10)!;assert.ok(item);
 const xp=educationalXP(item,'vlad',a.education.characters.vlad);completeStudy(a,'vlad',item,0);completeStudy(b,'vlad',item,0);
 assert.equal(b.education.characters.vlad.xp[item.skill]-a.education.characters.vlad.xp[item.skill],Math.round(xp*1.15)-xp);
});
test('Phone feed is a real timed activity, not a menu-open reward',()=>{
 const s=initialState();const plan=planTask({type:'act',actionId:'sofaScroll'});assert.ok(plan);assert.equal(plan.durationMs,20000);
 const r=evaluateTask(s,'vlad',plan.command);assert.ok(r.ok);
 s.world.places.vlad='district';assert.equal(evaluateTask(s,'vlad',plan.command).ok,false);
});
