import { CAFE_TALK_TOPICS, SOCIAL_BY_ID } from '../../src/shared/socialLife';
import { planTask } from '../tasks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, type GameState, type CharacterId } from '../../src/shared/protocol';
import { CAFE_MENU, STATIONS, approachFor, clockMinutes, type CafeItem } from '../../src/shared/locations';
import { RECIPES, TAKEOUT } from '../../src/shared/food';
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
  assert.equal(s.world.cafe.vlad!.readyAt,start+CAFE_MENU.tomYum.minutes);
  assert.equal(s.world.cafe.alina!.readyAt,start+CAFE_MENU.bbqRibs.minutes);
  assert.equal(validWorld(s.world),true);
  assert.equal(applyWorld(s,'vlad',order).ok,false);
  assert.equal(applyWorld(s,'vlad',{...order,sequence:1}).ok,false);
  assert.equal(localActivity(s,'vlad','dine','cafe-center').ok,false);
  s=advanceLife(s,CAFE_MENU.tomYum.minutes,['vlad','alina']);
  assert.equal(localActivity(s,'alina','dine','cafe-center').ok,false);
  const meal=localActivity(s,'vlad','dine','cafe-center');
  if(!meal.ok)assert.fail(meal.reason);
  s=meal.state;
  for(const need of ['hunger','comfort','mood'] as const)assert.equal(s.characters.vlad[need],100);
  assert.equal(s.world.cafe.vlad,undefined);
  assert.equal(s.world.cafe.alina!.item,'bbqRibs');
  s=advanceLife(s,CAFE_MENU.bbqRibs.minutes-CAFE_MENU.tomYum.minutes,['vlad','alina']);
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
    assert.ok(meal.minutes>=12&&meal.minutes<=30);
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

test('cafe conversation keeps both seated while cooking continues, consumes no orders',()=>{
  let s=guests();
  for(const role of ['vlad','alina'] as const){
    s=send(s,role,{type:'cafe_seat',station:'cafe-center'});
    s=send(s,role,{type:'cafe_order',table:'cafe-center',item:'bbqRibs',sequence:0});
  }
  const command={type:'together' as const,action:'cafeTalk'};
  assert.equal(cooperationDenial(s,'vlad',command),undefined);
  const scenes=pairScenes(s,'vlad',command)!;
  assert.equal(scenes.vlad.pair?.station,'cafe-center');
  assert.equal(scenes.alina.pair?.motion,'sitTalk');
  const r=completeTogether(s,'vlad',command,['vlad','alina'],0,scenes);
  if(!r.ok)assert.fail(r.reason);
  assert.deepEqual(r.state.world.cafe,s.world.cafe);
  assert.equal(r.state.money,s.money);
  assert.equal(r.state.characters.vlad.pose,'sit');
  assert.equal(r.state.characters.alina.pose,'sit');
  assert.ok(cooperationDenial({...s,characters:{...s.characters,alina:{...s.characters.alina,pose:'idle'}}},'vlad',command));
});

test('six distinct cafe topics require the same seated table and preserve paid orders',()=>{
  let s=guests();
  for(const role of ['vlad','alina'] as const){
    s=send(s,role,{type:'cafe_seat',station:'cafe-center'});
    s=send(s,role,{type:'cafe_order',table:'cafe-center',item:'bbqRibs',sequence:0});
  }
  assert.equal(CAFE_TALK_TOPICS.length,6);
  assert.equal(new Set(CAFE_TALK_TOPICS.map(t=>t.lines[0])).size,6);
  for(const topic of CAFE_TALK_TOPICS){
    const command={type:'together' as const,action:topic.id};
    assert.equal(cooperationDenial(s,'vlad',command),undefined);
    const scenes=pairScenes(s,'vlad',command)!;
    assert.equal(scenes.vlad.pair?.motion,'sitTalk');
    const r=completeTogether(s,'vlad',command,['vlad','alina'],0,scenes);
    if(!r.ok)assert.fail(r.reason);
    assert.deepEqual(r.state.world.cafe,s.world.cafe);
    assert.equal(r.state.characters.vlad.pose,'sit');
    assert.equal(r.state.characters.alina.pose,'sit');
    const separated={...s,characters:{...s.characters,alina:{...s.characters.alina,pose:'idle' as const}}};
    assert.ok(cooperationDenial(separated,'vlad',command));
  }
});
test('all home and cafe meal plans use a shared 32-second duration',()=>{
  for(const command of [{type:'eat',recipe:'omelette'},{type:'eat',recipe:'grillSteak'},{type:'eat_takeout',item:Object.keys(TAKEOUT)[0]},{type:'local_activity',station:'cafe-left',action:'dine'}]){
    assert.equal(planTask(command)?.durationMs,32000);
  }
  for(const action of ['eat','takeout','bring','cafeMeal'])assert.equal(SOCIAL_BY_ID.get(action)?.seconds,32);
  assert.equal(planTask({type:'cook',recipe:'omelette'})?.durationMs,30000);
});
