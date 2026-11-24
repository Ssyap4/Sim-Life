import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../../src/shared/protocol';
import {COFFEE_DRINKS,BEAN_COFFEE,coffeeCupsToday,coffeeMachineTier} from '../../src/shared/coffee';
import {ELECTRONICS,initialElectronics,installedElectronics,validElectronics} from '../../src/shared/electronics';
import {approachFor,stationById} from '../../src/shared/locations';
import {applyWorld} from '../locations';
import {brewCoffee} from '../coffee';
import {planTask,evaluateTask} from '../tasks';
import {openServerFiles} from '../storage';
import {buildFurniture} from '../../src/game/InteriorArt';
import {buildElectronicsModel} from '../../src/game/ElectronicsArt';

const ids=['coffeeBasic','coffeeCapsule','coffeePremium'] as const;
test('three shared appliance purchases cost real money, replace the old unit, and persist',()=>{
 let s=initialState();s.money=150000;
 assert.equal(brewCoffee(s,'vlad','beansJardin',COFFEE_DRINKS[0]).ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'electronics_buy',model:'coffeeBasic'}).ok,false);
 s.world.places.vlad='electronics';
 Object.assign(s.characters.vlad,approachFor(stationById('electronics','tech-cash')!,'vlad'));
 for(const [i,id] of ids.entries()){
  const before=s.money,r=applyWorld(s,'vlad',{type:'electronics_buy',model:id});assert.ok(r.ok);s=r.state;
  assert.equal(s.money,before-ELECTRONICS[id].price);
  assert.equal(installedElectronics(s,'alina','coffee'),id);
  assert.equal(coffeeMachineTier(s,'alina')?.energy,15+i*5);
  assert.equal(applyWorld(s,'vlad',{type:'electronics_buy',model:id}).ok,false);
  assert.equal(s.ledger.at(-1)?.category,'electronics');
 }
 const dir=mkdtempSync(join(tmpdir(),'coffee-machine-'));
 try{openServerFiles(dir).save(s);const saved=openServerFiles(dir).load();assert.equal(saved.world.electronics?.coffee,'coffeePremium');}
 finally{rmSync(dir,{recursive:true,force:true});}
 const legacy=initialElectronics();delete legacy.coffee;assert.ok(validElectronics(legacy));assert.ok(!validElectronics({...legacy,coffee:'pcOffice'}));
});
test('all seven drinks and three beans on each tier spend one portion and restore exactly the tier energy',()=>{
 for(const [i,id] of ids.entries())for(const blend of BEAN_COFFEE)for(const drink of COFFEE_DRINKS){
  const s=initialState();s.world.electronics={...initialElectronics(),coffee:id};s.pantry[blend]=1;s.characters.vlad.energy=30;
  const p=planTask({type:'brew_coffee',blend,drink});assert.ok(p);assert.equal(p.resource,'kitchen');assert.equal(p.durationMs,18000);
  const result=evaluateTask(s,'vlad',p.command);assert.ok(result.ok);
  assert.equal(result.state.characters.vlad.energy,45+i*5);assert.equal(result.state.pantry[blend],0);assert.equal(s.pantry[blend],1);
  assert.equal(coffeeCupsToday(result.state,'vlad'),1);assert.equal(coffeeCupsToday(result.state,'alina'),0);
  assert.equal(brewCoffee(result.state,'vlad',blend,drink).ok,false);
 }
 assert.equal(planTask({type:'brew_coffee',blend:'beansJardin'}),null);
 assert.equal(planTask({type:'brew_coffee',blend:'coffeeEgoiste',drink:'Латте'}),null);
 assert.equal(planTask({type:'brew_coffee',blend:'beansJardin',drink:'fake'}),null);
});
test('instant and beans share the same daily cap, reset on next game day, no energy overflow',()=>{
 let s=initialState();s.world.electronics={...initialElectronics(),coffee:'coffeePremium'};s.pantry.beansJardin=4;s.pantry.coffeeEgoiste=1;s.characters.vlad.energy=95;
 for(const [blend,drink] of [['coffeeEgoiste',undefined],['beansJardin',COFFEE_DRINKS[0]],['beansJardin',COFFEE_DRINKS[1]]] as const){
  const r=brewCoffee(s,'vlad',blend,drink);assert.ok(r.ok);s=r.state;
 }
 assert.equal(s.characters.vlad.energy,100);assert.equal(brewCoffee(s,'vlad','beansJardin',COFFEE_DRINKS[2]).ok,false);
 assert.ok(brewCoffee(s,'alina','beansJardin',COFFEE_DRINKS[0]).ok);
 s.clock.day++;assert.ok(brewCoffee(s,'vlad','beansJardin',COFFEE_DRINKS[0]).ok);
});
test('home countertop variants use the same geometry as showroom, and keep kettle clear',()=>{
 let coffee:THREE.Group|undefined,kettle:THREE.Group|undefined;
 buildFurniture((id,group)=>{if(id==='coffeeMaker')coffee=group;if(id==='kettle')kettle=group;});
 assert.ok(coffee&&kettle);
 coffee.updateMatrixWorld(true);kettle.updateMatrixWorld(true);const variants=coffee.children[0];assert.equal(variants.children.filter(m=>m.visible).length,1);
 for(const id of ids){
  const model=variants.children.find(m=>m.userData.electronicsId===id)!;assert.ok(model);
  model.updateMatrixWorld(true);
  const local=new THREE.Box3().setFromObject(buildElectronicsModel(id));
  const box=new THREE.Box3().setFromObject(model);
  assert.ok(box.getSize(new THREE.Vector3()).distanceTo(local.getSize(new THREE.Vector3()))<.0001);
  assert.ok(!box.intersectsBox(new THREE.Box3().setFromObject(kettle!)));
  assert.ok(box.min.y>=1.02&&box.max.y<1.6);
 }
});