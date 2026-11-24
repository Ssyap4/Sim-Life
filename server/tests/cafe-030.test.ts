import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, type GameState, type CharacterId } from '../../src/shared/protocol';
import { CAFE_MENU, STATIONS, approachFor, clockMinutes, type CafeItem } from '../../src/shared/locations';
import { RECIPES } from '../../src/shared/food';
import { applyWorld, localActivity, validWorld } from '../locations';
import { advanceLife } from '../life';
import { cooperationDenial, pairScenes, completeTogether } from '../society';
import { Group, Mesh } from 'three';
import { selectIndoorDish } from '../../src/game/MealArt';

function send(s:GameState,role:CharacterId,command:Record<string,unknown>){
  const r=applyWorld(s,role,command);
  if(!r.ok)assert.fail(r.reason);
  return r.state;
}
function guests(){
  const s=initialState();
  const table=STATIONS.cafe.find(t=>t.id==='cafe-center')!;
  for(const role of ['vlad','alina'] as const){
    s.world.places[role]='cafe';
    Object.assign(s.characters[role],approachFor(table,role),{pose:'idle',hunger:20,mood:20,comfort:20});
  }
  return s;
}
test('cafe table service requires seating; separate guest orders prepare independently, no repeated debit',()=>{
  let s=guests();
  const order={type:'cafe_order',item:'tomYum',table:'cafe-center',sequence:0};
  assert.equal(applyWorld(s,'vlad',order).ok,false);
  s=send(s,'vlad',{type:'cafe_seat',station:'cafe-center'});
  s=send(s,'alina',{type:'cafe_seat',station:'cafe-center'});
  const start=clockMinutes(s.clock),money=s.money;
  s=send(s,'vlad',order);
  s=send(s,'alina',{...order,item:'bbqRibs'});
  assert.equal(s.money,money-CAFE_MENU.tomYum.price-CAFE_MENU.bbqRibs.price);
  assert.equal(s.world.cafe.vlad!.readyAt,start+75);
  assert.equal(s.world.cafe.alina!.readyAt,start+90);
  assert.equal(validWorld(s.world),true);
  assert.equal(applyWorld(s,'vlad',order).ok,false);
  assert.equal(applyWorld(s,'vlad',{...order,sequence:1}).ok,false);
  assert.equal(localActivity(s,'vlad','dine','cafe-center').ok,false);
  s=advanceLife(s,75,['vlad','alina']);
  assert.equal(localActivity(s,'alina','dine','cafe-center').ok,false);
  const meal=localActivity(s,'vlad','dine','cafe-center');
  if(!meal.ok)assert.fail(meal.reason);
  s=meal.state;
  for(const need of ['hunger','comfort','mood'] as const)assert.equal(s.characters.vlad[need],100);
  assert.equal(s.world.cafe.vlad,undefined);
  assert.equal(s.world.cafe.alina!.item,'bbqRibs');
  s=advanceLife(s,15,['vlad','alina']);
  const other=localActivity(s,'alina','dine','cafe-center');
  if(!other.ok)assert.fail(other.reason);
  for(const need of ['hunger','comfort','mood'] as const)assert.equal(other.state.characters.alina[need],100);
  assert.equal(other.state.world.cafe.alina,undefined);
  assert.equal(other.state.money,money-CAFE_MENU.tomYum.price-CAFE_MENU.bbqRibs.price);
});
test('cafe meals cannot be ordered from the terminal or consumed at another table; legacy order remains valid',()=>{
  let s=guests();
  s=send(s,'vlad',{type:'cafe_seat',station:'cafe-center'});
  s=send(s,'vlad',{type:'cafe_order',item:'caesar',table:'cafe-center',sequence:0});
  s=advanceLife(s,70,['vlad']);
  const other=STATIONS.cafe.find(t=>t.id==='cafe-left')!;
  Object.assign(s.characters.vlad,approachFor(other,'vlad'));
  assert.equal(localActivity(s,'vlad','dine','cafe-left').ok,false);
  assert.equal(applyWorld(s,'alina',{type:'cafe_order',item:'tomYum',sequence:0}).ok,false);
  assert.equal(s.world.cafe.vlad!.item,'caesar');
  s.world.cafe.alina={item:'tea',readyAt:0,pickedUp:false};
  assert.equal(validWorld(s.world),true);
});
test('three tables and eight cafe servings have distinct batched visible art and no exact home recipe overlap',()=>{
  assert.equal(STATIONS.cafe.filter(t=>t.action.kind==='dine').length,3);
  const signatures=new Set<string>();
  for(const [id,meal] of Object.entries(CAFE_MENU)){
    assert.ok(meal.minutes>=60&&meal.minutes<=90);
    assert.ok(!Object.values(RECIPES).some(r=>String(r.name)===String(meal.name)));
    const g=new Group();selectIndoorDish(g,id as CafeItem);
    const signature:string[]=[];
    g.traverse(o=>{if(o instanceof Mesh){const p=o.geometry.getAttribute('position');signature.push(p.count+':'+Array.from(p.array).slice(0,12).join(',')+':'+JSON.stringify(o.material));}});
    assert.ok(signature.length);
    signatures.add(signature.join('|'));
  }
  assert.equal(signatures.size,Object.keys(CAFE_MENU).length);
});

test('a real shared cafe meal uses each ready dish at its own table and creates one relationship memory',()=>{
  let s=guests();
  for(const role of ['vlad','alina'] as const){
    s=send(s,role,{type:'cafe_seat',station:'cafe-center'});
    s=send(s,role,{type:'cafe_order',table:'cafe-center',item:role==='vlad'?'tomYum':'bbqRibs',sequence:0});
  }
  const command={type:'together' as const,action:'cafeMeal'};
  assert.ok(cooperationDenial(s,'vlad',command));
  s=advanceLife(s,90,['vlad','alina']);
  assert.equal(cooperationDenial(s,'vlad',command),undefined);
  const scenes=pairScenes(s,'vlad',command);
  assert.ok(scenes);
  assert.equal(scenes.vlad.pair?.station,'cafe-center');
  assert.equal(scenes.vlad.pair?.item,'tomYum');
  assert.equal(scenes.alina.pair?.item,'bbqRibs');
  const result=completeTogether(s,'vlad',command,['vlad','alina'],0,scenes);
  if(!result.ok)assert.fail(result.reason);
  assert.equal(result.state.world.cafe.vlad,undefined);
  assert.equal(result.state.world.cafe.alina,undefined);
  assert.equal(result.state.relationship.memories.filter(m=>m.action==='cafeMeal').length,1);
});
