import assert from 'node:assert/strict';
import {test} from 'node:test';
import { initialState } from '../../src/shared/protocol';
import { addReadyFood } from '../../src/shared/readyFood';
import {FURNITURE_BY_ID,type PlacedFurniture} from '../../src/shared/furniture';
import {furnitureActionList,furnitureUseLocation,furnitureSource,canFurniturePerform,diningLocation} from '../../src/shared/furnitureUse';
import {planTask,evaluateTask} from '../tasks';
import {RECIPES} from '../../src/shared/food';
import {emptyFurnishing} from '../../src/shared/furniture';

function install(sku:string,id:number,x:number,z:number,rotation:0|1|2|3=0):PlacedFurniture{
 return {sku,id,x,z,rotation,finish:'sage'};
}
test('purchased sofa retains real relaxation, music, calls, TV and rotated seating',()=>{
 const s=initialState();
 s.furnishing.soldFixtures=['sofa'];
 s.furnishing.placed=[install('sofa-luna',1,-2.36,2.02)];
 s.furnishing.nextId=2;
 assert.deepEqual(furnitureActionList(s.furnishing.placed[0]).filter(a=>a.startsWith('sofa')),
   ['sofaRest','sofaMusic','sofaCall','sofaScroll']);
 const loc=furnitureUseLocation(s,'vlad',1,'sofaRest');
 assert.ok(loc,'must approach bought sofa safely');
 assert.notDeepEqual(loc.pose,{x:-2.36,y:0,z:2.02,yaw:0});
 assert.ok(loc.pose.x<0);
 const plan=planTask({type:'furniture_use',furnitureId:1,action:'sofaRest'});
 assert.ok(plan);
 const before=s.characters.vlad.energy;
 const result=evaluateTask(s,'vlad',plan.command);
 assert.ok(result.ok);
 assert.equal(result.state.characters.vlad.energy,Math.min(100,before+12));
 assert.deepEqual(result.state.furnishing.soldFixtures,['sofa']);
 assert.equal(s.characters.vlad.energy,before);
 const tv=evaluateTask(s,'vlad',{type:'furniture_use',furnitureId:1,action:'free_tv'});
 assert.ok(tv.ok);
 assert.ok(tv.state.characters.vlad.fun>s.characters.vlad.fun);
 const bad=evaluateTask(s,'vlad',{type:'furniture_use',furnitureId:999,action:'sofaRest'});
 assert.equal(bad.ok,false);
 assert.equal(furnitureSource(s,1,'deskJournal').ok,false);
 for(const rotation of [0,1,2,3] as const){
   s.furnishing.placed[0].rotation=rotation;
   const pose=furnitureUseLocation(s,'vlad',1,'sofaRest');
   if(pose)assert.ok(Number.isFinite(pose.pose.yaw));
 }
});
test('dining on a replacement table is real food consumption, never a ghost at sold table',()=>{
 const s=initialState();
 s.furnishing.soldFixtures=['table'];
 s.furnishing.placed=[install('table-family',1,2.39,-2.22)];
 s.furnishing.nextId=2;
 const table=diningLocation(s,'alina',1);
 assert.ok(table,'must find a replacement dining seat');
 assert.ok(canFurniturePerform(s.furnishing.placed[0],'tableRest'));
 const recipe=Object.keys(RECIPES)[0] as keyof typeof RECIPES;
 s.meals[recipe]=2;
 addReadyFood(s,'meal',recipe,2,'table');
 const hungerBefore=s.characters.alina.hunger;
 const plan=planTask({type:'eat',recipe,furnitureId:1});
 assert.ok(plan);
 const result=evaluateTask(s,'alina',plan.command);
 assert.ok(result.ok,'prepared food must be consumed at bought table');
 assert.equal(result.state.meals[recipe],1);
 assert.ok(result.state.characters.alina.hunger>hungerBefore);
 assert.equal(result.state.characters.alina.pose,'idle',
   'no chair was bought, so eating must be standing rather than sitting in mid-air');
 assert.equal(s.meals[recipe],2);
 const missing=evaluateTask(s,'alina',{type:'eat',recipe,furnitureId:999});
 assert.equal(missing.ok,false);
});
test('book shelves, armchairs, benches, desks and dining chairs have shape-specific gameplay',()=>{
 const specs=[
   ['shelf-wide','read_book',8.97,-4.49],
   ['chair-cloud','officeChairSit',6.47,-2.84],
   ['bench-mori','officeChairSit',-.25,3.5],
   ['desk-simple','deskJournal',7.18,-6.72],
   ['chair-dining','officeChairSit',-1.12,-1.52],
 ] as const;
 for(const [sku,action,x,z]of specs){
   const state=initialState();
   state.furnishing.soldFixtures=['bookcase','officeChair','desk'];
   state.furnishing.placed=[install(sku,1,x,z)];state.furnishing.nextId=2;
   assert.ok(furnitureActionList(state.furnishing.placed[0]).includes(action),sku);
   assert.ok(!canFurniturePerform(state.furnishing.placed[0],'movie'),sku+' must not pretend to be a TV');
   const target=furnitureUseLocation(state,'vlad',1,action);
   assert.ok(target,sku+' should have a walkable approach');
 }
});
test('access only belongs to installed matching SKUs, never stored or fake catalog items',()=>{
 const s=initialState();
 const item=install('chair-dining',1,-1.8,1.5);
 s.furnishing.stored=[{id:1,sku:'chair-dining',finish:'sage'}];
 assert.equal(furnitureSource(s,1,'officeChairSit').ok,false);
 s.furnishing.stored=[];s.furnishing.placed=[item];
 assert.equal(furnitureSource(s,1,'officeChairSit').ok,true);
 assert.equal(furnitureSource(s,1,'tablePlan').ok,false);
 assert.equal(furnitureSource(s,'1','officeChairSit').ok,false);
 assert.equal(furnitureSource(s,1,'unknown' as 'officeChairSit').ok,false);
 assert.equal(planTask({type:'furniture_use',furnitureId:1,action:'unknown'}),null);
 assert.equal(planTask({type:'furniture_use',furnitureId:1,action:'read_book',book:'not-a-book'}),null);
 assert.equal(planTask({type:'furniture_use',furnitureId:1,action:'movie',genre:'not-a-genre'}),null);
 assert.deepEqual(emptyFurnishing().placed,[]);
 assert.equal(FURNITURE_BY_ID.get('table-coffee')!.height<.63,true);
 assert.equal(canFurniturePerform(install('table-coffee',2,1,1),'tableRest'),false);
});

test('a bought dining chair supplies a physical seat beside the replacement table',()=>{
 const s=initialState();
 s.furnishing.soldFixtures=['table'];
 s.furnishing.placed=[
   install('table-family',1,2.39,-2.22),
   install('chair-dining',2,2.39,-.91),
 ];
 s.furnishing.nextId=3;
 const chair=diningLocation(s,'vlad',1);
 assert.ok(chair);
 assert.equal(chair.seated,true,'actual purchased chair is selected');
 assert.equal('chairId' in chair?chair.chairId:undefined,2);
 const recipe=Object.keys(RECIPES)[0] as keyof typeof RECIPES;
 s.meals[recipe]=2;
 addReadyFood(s,'meal',recipe,2,'table');
 const result=evaluateTask(s,'vlad',{type:'eat',recipe,furnitureId:1});
 assert.ok(result.ok);
 assert.equal(result.state.characters.vlad.pose,'sit');
 assert.equal(result.state.meals[recipe],1);
});

test('replacement desk powers desktop games and creative work without old invisible computer',()=>{
 const s=initialState();
 s.furnishing.soldFixtures=['desk'];
 s.furnishing.placed=[install('desk-simple',1,7.18,-6.72)];
 s.furnishing.nextId=2;
 s.characters.vlad.fun=24;
 const work=planTask({type:'furniture_use',furnitureId:1,action:'deskJournal'});
 assert.ok(work);
 const recorded=evaluateTask(s,'vlad',work.command);
 assert.ok(recorded.ok,'notes work on a purchased desk');
 assert.ok(recorded.state.characters.vlad.mood>s.characters.vlad.mood);
 const game=planTask({type:'play_game',game:'green-valley',device:'desktop',furnitureId:1});
 assert.ok(game);
 const played=evaluateTask(s,'vlad',game.command);
 assert.ok(played.ok,'game must run on installed desk when old desk is sold');
 assert.ok(played.state.characters.vlad.fun>s.characters.vlad.fun);
 assert.ok(Math.hypot(played.state.characters.vlad.x-7.18,played.state.characters.vlad.z+6.72)<2);
 const video=planTask({type:'computer_video',clip:'pets',device:'desktop',furnitureId:1});
 assert.ok(video);
 assert.ok(evaluateTask(s,'alina',video.command).ok);
 s.furnishing.placed=[];
 assert.equal(evaluateTask(s,'vlad',game.command).ok,false,'cannot play on uninstalled desk');
 assert.equal(evaluateTask(s,'vlad',work.command).ok,false,'cannot work on a sold desk');
});
