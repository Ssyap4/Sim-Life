import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {holidayTheme,buildHolidayTree,buildHolidayGarlands} from '../../src/game/HolidayArt';
import {HOME_YARD,HOME_STRUCTURE_OBSTACLES} from '../../src/shared/home';
import {creditCelebration,occasionsAhead} from '../../src/shared/familyLife';
import {SOCIAL_BY_ID,socialRestriction} from '../../src/shared/socialLife';
import {cooperationDenial,pairScenes,completeTogether} from '../society';
import {ingredientList} from '../../src/shared/food';
import {holidayRecipeOpen} from '../../src/shared/recipeAvailability';
import {applyFoodAction} from '../food';
import {levelXP} from '../../src/shared/education';
test('seasonal decorations use the fixed planter and existing canopy, with no persistent visibility',()=>{
 const s=initialState(),tree=buildHolidayTree(),decor=buildHolidayGarlands();
 assert.equal(tree.visible,false);
 const bounds=new THREE.Box3().setFromObject(tree),p=HOME_YARD.planter;
 const footprint=HOME_STRUCTURE_OBSTACLES.find(r=>r.minX===p.x-.45&&r.maxX===p.x+.5)!;
 assert.ok(footprint);assert.ok(bounds.min.x>=footprint.minX-1e-5&&bounds.max.x<=footprint.maxX+1e-5);
 assert.ok(bounds.min.z>=footprint.minZ&&bounds.max.z<=footprint.maxZ);assert.ok(bounds.max.y<2.6);
 assert.equal(holidayTheme(28,s),'winter');assert.equal(holidayTheme(31,s),'winter');
 assert.equal(holidayTheme(32,s),'none');assert.equal(holidayTheme(33,s),'birthday');assert.equal(holidayTheme(34,s),'birthday');
 assert.equal(holidayTheme(5,s),'easter');assert.equal(holidayTheme(10,s),'none');
 for(const day of [30,33,5,1,10,31,32]){
   const theme=decor.update(day,s);assert.equal(Object.values(decor.groups).filter(g=>g.visible).length,theme==='none'?0:1);
   if(theme!=='none'){const g=decor.groups[theme];const box=new THREE.Box3().setFromObject(g);assert.ok(box.min.y>1.9);let draws=0;g.traverse(o=>{if(o instanceof THREE.Mesh)draws++});assert.ok(draws<=8);}
 }
});
test('birthday cake consumes real stock, with birthday windows unchanged by display dates',()=>{
 const s=initialState();s.education.characters.vlad.xp.cooking=levelXP(2);
 for(const [id,n] of ingredientList('birthdayCake'))s.pantry[id]=n;
 assert.equal(holidayRecipeOpen(s,'birthdayCake'),false);assert.equal(applyFoodAction(s,'vlad',{type:'cook',recipe:'birthdayCake'}).ok,false);
 s.clock.day=33;assert.equal(holidayRecipeOpen(s,'birthdayCake'),true);
 const r=applyFoodAction(s,'vlad',{type:'cook',recipe:'birthdayCake'},()=>.99);assert.ok(r.ok,r.ok?'':r.reason);assert.equal(r.state.meals.birthdayCake,4);
 for(const [id] of ingredientList('birthdayCake'))assert.equal(r.state.pantry[id],0);
 assert.equal(holidayRecipeOpen({...s,clock:{day:34,minute:1439}},'birthdayCake'),true);
 assert.equal(holidayRecipeOpen({...s,clock:{day:35,minute:0}},'birthdayCake'),false);
});
test('holiday congratulations require both at home and cannot be replayed for reward',()=>{
 const s=initialState(),a=SOCIAL_BY_ID.get('holidayWish')!,command={type:'together' as const,action:'holidayWish'};
 s.clock.day=10;assert.ok(socialRestriction(a,s,'vlad'));
 s.clock.day=30;assert.ok(cooperationDenial(s,'vlad',command,true));assert.equal(cooperationDenial(s,'vlad',command),undefined);
 const homes=pairScenes(s,'vlad',command);assert.ok(homes);
 const r=completeTogether(s,'vlad',command,['vlad','alina'],0,homes);assert.ok(r.ok,r.ok?'':r.reason);
 assert.deepEqual(creditCelebration(r.state,'holidayWish'),['Новый год']);
 assert.deepEqual(creditCelebration(r.state,'holidayWish'),[]);assert.ok(cooperationDenial(r.state,'vlad',command));
 assert.ok(occasionsAhead(r.state,0).every(o=>o.celebrated));
});
