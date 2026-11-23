import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {SOCIAL_ACTIVITIES,SOCIAL_BY_ID,contextAvailable,socialText} from '../../src/shared/socialLife';
import {chooseResidentIdle,residentIdleWeight,type ResidentIdleContext} from '../../src/game/ResidentIdle';
import {choosePetIdle,petIdleWeight,type PetIdleContext} from '../../src/game/PetIdle';
import {Actor} from '../../src/game/Actor';
import {PetActor} from '../../src/game/PetActor';

const noNearby:ResidentIdleContext={petYaw:null,partnerYaw:null};
const happy:PetIdleContext={
  satiety:80,energy:75,happiness:85,bond:70,bowl:1,personNearby:false,
};
test('Vlad and Alina receive different articulated personality habits without fake interaction',()=>{
  const vlad=new Set(Array.from({length:48},(_,turn)=>chooseResidentIdle('vlad',noNearby,turn)));
  const alina=new Set(Array.from({length:48},(_,turn)=>chooseResidentIdle('alina',noNearby,turn)));
  for(const action of ['studyPalm','rubShoulder','steadyBreath'] as const)assert.ok(vlad.has(action),action);
  for(const action of ['easeWrists','rubShoulder','steadyBreath'] as const)assert.ok(alina.has(action),action);
  assert.equal(vlad.has('fixHair'),false);
  assert.equal(alina.has('studyPalm'),false);
  for(const time of [-1,0,.25,1.8,3.79,3.8,4])
    assert.ok(Number.isFinite(residentIdleWeight(time)));
});
test('Pet habits are breed-specific and real hunger takes precedence',()=>{
  const dog=new Set(Array.from({length:24},(_,turn)=>choosePetIdle('verdell',happy,turn)));
  const cat=new Set(Array.from({length:24},(_,turn)=>choosePetIdle('simba',happy,turn)));
  assert.ok(dog.has('playBow')&&dog.has('pawWave'));
  assert.ok(cat.has('slowBlink')&&cat.has('pounce'));
  assert.ok(!dog.has('pounce')&&!cat.has('pawWave'));
  const hungry={...happy,satiety:9,bowl:0};
  assert.equal(choosePetIdle('verdell',hungry,0),'hungryLook');
  assert.equal(choosePetIdle('simba',hungry,0),'hungryLook');
  for(const time of [-1,0,.5,2,3.39,3.4,4])assert.ok(Number.isFinite(petIdleWeight(time)));
});
test('Existing animated actor rigs and pets keep safe navigation roots while idling',()=>{
  const vlad=new Actor('vlad',[2,-2]);
  const alina=new Actor('alina',[-2,2]);
  for(const actor of [vlad,alina]){
    actor.setNeeds({energy:90,hunger:90,bladder:90,hygiene:90,mood:90});
    const x=actor.root.position.x,z=actor.root.position.z;
    for(let i=0;i<320;i++)actor.update(1/12);
    assert.ok(Number.isFinite(actor.root.rotation.y));
    assert.equal(actor.root.position.x,x);
    assert.equal(actor.root.position.z,z);
  }
  for(const id of ['verdell','simba'] as const){
    const pet=new PetActor(id);
    pet.setAmbient(happy);
    const x=pet.root.position.x,z=pet.root.position.z;
    for(let i=0;i<320;i++)pet.update(1/12);
    assert.ok(Number.isFinite(pet.root.rotation.y));
    assert.equal(pet.root.position.x,x);
    assert.equal(pet.root.position.z,z);
    pet.react('pet');
    assert.equal(pet.currentIdleGesture(),null,'an actual interaction interrupts cosmetic habits');
  }
});
test('New couple conversations are complete and do not duplicate existing actions',()=>{
  const ids=SOCIAL_ACTIVITIES.map(a=>a.id);
  assert.equal(ids.length,new Set(ids).size,'unique social action identifiers');
  for(const id of ['shortBudget','ourSavings','petHungerHelp','readyDinner',
    'splitHousework','studioDreamAlina','studioDreamVlad','morningHello','petOlympics']){
    const a=SOCIAL_BY_ID.get(id);
    assert.ok(a,id);
    assert.ok(a.lines.length>=2,id);
    assert.ok(a.replies.length>=3,id);
    assert.ok(a.title.length>4,id);
  }
});
test('Finance, food and pet dialogue follow actual world state',()=>{
  const state=initialState();
  assert.equal(contextAvailable(SOCIAL_BY_ID.get('shortBudget')!,state,'vlad'),false);
  state.money=2300;
  assert.equal(contextAvailable(SOCIAL_BY_ID.get('shortBudget')!,state,'vlad'),true);
  assert.match(socialText(SOCIAL_BY_ID.get('shortBudget')!,state,'vlad'),/2.300|2 300|2 300/);
  assert.equal(contextAvailable(SOCIAL_BY_ID.get('petHungerHelp')!,state,'vlad'),false);
  state.pets.simba.satiety=15;
  assert.equal(contextAvailable(SOCIAL_BY_ID.get('petHungerHelp')!,state,'vlad'),true);
  assert.match(socialText(SOCIAL_BY_ID.get('petHungerHelp')!,state,'vlad'),/Симба/);
  assert.equal(contextAvailable(SOCIAL_BY_ID.get('readyDinner')!,state,'vlad'),false);
  state.readyFood.push({kind:'meal',item:'omelette',portions:1,storage:'fridge',expiresAt:900});
  assert.equal(contextAvailable(SOCIAL_BY_ID.get('readyDinner')!,state,'vlad'),true);
  assert.equal(socialText(SOCIAL_BY_ID.get('ourSavings')!,state,'vlad').includes('{balance}'),false);
});
