import { districtArrival, districtStation } from '../../src/shared/district';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';
import { CAREERS, CAREER_IDS, CLINIC_MODULES, DETAIL_SERVICES, shiftWindow, type CareerId } from '../../src/shared/careers';
import { CAREER_STORIES, WORK_EVENTS, WORK_CHECKS, WORK_EVENT_BY_ID } from '../../src/shared/careerCatalog';
import { promotionNeeds } from '../../src/shared/careerPromotion';
import { floorFor, HOME_LAPTOP, placeObstacles, spawn, stationById, STATIONS, WORK_NPCS } from '../../src/shared/locations';
import { clockAt, gameMinutes } from '../../src/shared/life';
import { levelXP } from '../../src/shared/education';
import { initialState, type GameState, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { findRoute, pointIsClear } from '../../src/game/navigation';
import { createLocation } from '../../src/game/LocationScene';
import { applyCareer, advanceCareers } from '../careers';
import { beginShift } from '../jobs';
import { applyWorld } from '../locations';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

const now = (state: GameState) => gameMinutes(state.clock);
function tick(state: GameState, until: number) {
  const start = now(state);
  state.clock = clockAt(until);
  advanceCareers(state,start,until,['vlad','alina']);
}
function command(state: GameState, role: CharacterId, intent: Record<string,unknown>): GameState {
  const result = applyCareer(state,role,intent,now(state));
  if (!result.ok) assert.fail(result.reason);
  return result.state;
}
function hire(id: CareerId, day = 0, offset = 0) {
  const role = CAREERS[id].owner, state = initialState();
  state.clock = clockAt(shiftWindow(id,day).start+offset);
  return command(state,role,{type:'career_hire',career:id});
}
function start(id: CareerId, day = 0, offset = 0) {
  return command(hire(id,day,offset),CAREERS[id].owner,{type:'career_start'});
}
function finish(state: GameState, role: CharacterId, selection?: number, verification?: number) {
  let shift = state.careers.residents[role].shift!, task = shift.task!;
  const nonce = task.nonce;
  const event = WORK_EVENT_BY_ID.get(task.event)!;
  // Rank-zero regression fixtures have not unlocked skill-gated specialist choices.
  const best = event.choices.indexOf([...event.choices.filter(choice=>!choice.requires)].sort((a,b)=>b.quality-a.quality)[0]);
  state = command(state,role,{type:'career_approach',nonce});
  task = state.careers.residents[role].shift!.task!;
  tick(state,task.readyAt);
  state = command(state,role,{type:'career_choose',nonce,choice:selection??best});
  const checks = WORK_CHECKS[event.id] ?? [];
  for (let i=0;i<checks.length;i++) {
    const answer = i === 0 && verification !== undefined ? verification : checks[i].answer;
    state = command(state,role,{type:'career_verify',nonce,choice:answer,step:i});
    // If intentionally tested with a wrong answer, correct it before continuing.
    if (state.careers.residents[role].shift!.task!.phase === 'checking' &&
        (state.careers.residents[role].shift!.task!.checkStep ?? 0) === i) {
      state = command(state,role,{type:'career_verify',nonce,choice:checks[i].answer,step:i});
    }
  }
  tick(state,state.careers.residents[role].shift!.task!.readyAt);
  return state;
}

test('Each career has 45 distinct situations, five ranks and three four-part storylines', () => {
  const ids = new Set<string>();
  for (const id of CAREER_IDS) {
    const spec = CAREERS[id];
    assert.equal(spec.roles.length,5);
    assert.equal(new Set(spec.staff.map(n=>n.name)).size,3);
    assert.equal(WORK_EVENTS[id].length,45);
    assert.equal(new Set(WORK_EVENTS[id].map(e=>e.text)).size,45);
    assert.ok(WORK_EVENTS[id].every(e=>e.choices.length>=2&&e.choices.length<=4&&new Set(e.choices.map(c=>c.label)).size===e.choices.length));
    assert.ok(spec.roles.every((role,i)=>!i||role[1]>spec.roles[i-1][1]));
    for (const e of WORK_EVENTS[id]) ids.add(e.id);
    assert.equal(CAREER_STORIES[id].length,3);
    assert.ok(CAREER_STORIES[id].every(story=>story.events.length===4&&story.events.every(e=>WORK_EVENT_BY_ID.has(e))));
  }
  assert.equal(ids.size,180);
});

test('All four contracts are available only to their approved resident, persist on rehire and open their own scene', () => {
  const calendar = {it:0,detail:1,marketing:1,clinic:0};
  for (const id of CAREER_IDS) {
    const { owner,place }=CAREERS[id], partner = owner==='alina'?'vlad':'alina';
    let state = start(id,calendar[id]);
    assert.equal(state.world.places[owner],place);
    assert.equal(state.world.places[partner],'home');
    assert.equal(applyCareer(initialState(),partner,{type:'career_hire',career:id},0).ok,false);
    assert.equal(applyWorld(initialState(),owner,{type:'travel',place}).ok,false);
    assert.equal(applyWorld(state,owner,{type:'travel',place:'home'}).ok,false);
    assert.equal(beginShift(state,owner,'ozon').ok,false);
    state.careers.residents[owner].progress[id]!.rank=1;
    state = command(state,owner,{type:'career_leave'});
    assert.equal(state.world.places[owner],'home');
    state = command(state,owner,{type:'career_resign'});
    state = command(state,owner,{type:'career_hire',career:id});
    assert.equal(state.careers.residents[owner].progress[id]!.rank,1);
    assert.equal(state.money,10000);
    assert.equal(applyCareer(state,owner,{type:'career_start'},now(state)).ok,false);
  }
});

test('The four district workplaces open a real contracted shift at their door and return the worker to it',()=>{
  const calendar={it:0,detail:1,marketing:1,clinic:0};
  for(const id of CAREER_IDS){
    const {owner,place}=CAREERS[id];
    const via=districtStation(place);
    const contracted=hire(id,calendar[id]);
    assert.equal(applyCareer(contracted,owner,{type:'career_start',via},now(contracted)).ok,false);
    const approach=applyWorld(contracted,owner,{type:'approach',place:'home',station:via});
    assert.ok(approach.ok && approach.path?.length);
    const began=command(approach.state,owner,{type:'career_start',via});
    assert.equal(began.world.places[owner],place);
    const finished=command(began,owner,{type:'career_leave'});
    const {x,z}=finished.characters[owner];
    assert.deepEqual({x,z},districtArrival(place,owner));
    assert.equal(finished.world.places[owner],'home');
  }
});

test('Task choices, timed approach and interactive validation are server-owned and reward XP once', () => {
  let state=start('it');
  const shift=state.careers.residents.vlad.shift!, task=shift.task!, nonce=task.nonce;
  assert.equal(task.event,'it-1');
  assert.equal(applyCareer(state,'vlad',{type:'career_choose',nonce,choice:0},now(state)).ok,false);
  assert.equal(applyCareer(state,'alina',{type:'career_approach',nonce},now(state)).ok,false);
  state=command(state,'vlad',{type:'career_approach',nonce});
  assert.equal(state.careers.residents.vlad.shift!.task!.phase,'walking');
  tick(state,state.careers.residents.vlad.shift!.task!.readyAt);
  state=command(state,'vlad',{type:'career_choose',nonce,choice:0});
  assert.equal(state.careers.residents.vlad.shift!.task!.phase,'checking');
  assert.equal(state.education.characters.vlad.xp.technology,0);
  state=command(state,'vlad',{type:'career_verify',nonce,choice:2,step:0});
  assert.equal(state.careers.residents.vlad.shift!.task!.attempts,1);
  state=command(state,'vlad',{type:'career_verify',nonce,choice:0,step:0});
  const ready=state.careers.residents.vlad.shift!.task!.readyAt;
  tick(state,ready-1);
  assert.equal(state.education.characters.vlad.xp.technology,0);
  tick(state,ready);
  const xp=state.education.characters.vlad.xp.technology;
  assert.ok(xp>0);
  assert.equal(state.careers.residents.vlad.shift!.score,78);
  assert.equal(applyCareer(state,'vlad',{type:'career_verify',nonce,choice:0,step:0},now(state)).ok,false);
  tick(state,ready+2);
  assert.equal(state.education.characters.vlad.xp.technology,xp);
});

test('Time, outcome, priorities and overtime determine base pay and bonus exactly once', () => {
  let state=start('it');
  for (let i=0;i<4;i++) {
    const shift=state.careers.residents.vlad.shift!;
    const answer:Record<string,number>={'it-1':0,'it-2':1,'it-4':2};
    state=finish(state,'vlad',undefined,answer[shift.task!.event]??0);
    tick(state,state.careers.residents.vlad.shift!.nextTaskAt);
  }
  const regular=state.careers.residents.vlad.shift!.regularEnd;
  tick(state,regular-70);
  state=command(state,'vlad',{type:'career_overtime'});
  assert.equal(state.careers.residents.vlad.shift!.endsAt,regular+60);
  assert.equal(applyCareer(state,'vlad',{type:'career_overtime'},now(state)).ok,false);
  tick(state,regular+60);
  const p=state.careers.residents.vlad.progress.it!;
  assert.ok(p.productivity>=76);
  const payday=p.history.at(-1)!;
  assert.equal(payday.pay,3300);
  assert.ok(payday.bonus!>0);
  assert.equal(state.money,10000+payday.pay!+payday.bonus!);
  const paid=state.money;
  assert.equal(applyCareer(state,'vlad',{type:'career_leave'},now(state)).ok,false);
  tick(state,regular+61);
  assert.equal(state.money,paid);
  assert.equal(state.ledger.filter(item=>item.category==='work').length,2);
});

test('Weekend, late starts, absent days, partial pay and unpaid periods are enforced', () => {
  const weekend=hire('it',5);
  assert.equal(applyCareer(weekend,'vlad',{type:'career_start'},now(weekend)).ok,false);
  let state=start('it',0,51);
  assert.equal(state.careers.residents.vlad.progress.it!.reputation,48);
  tick(state,now(state)+29);
  state=command(state,'vlad',{type:'career_leave'});
  assert.equal(state.money,10000);
  tick(state,shiftWindow('it',1).start);
  state=command(state,'vlad',{type:'career_start'});
  tick(state,now(state)+90);
  state=command(state,'vlad',{type:'career_leave'});
  assert.equal(state.money,10600);
  const before=state.careers.residents.vlad.progress.it!.reputation;
  tick(state,shiftWindow('it',3).end);
  assert.equal(state.careers.residents.vlad.progress.it!.reputation,before-4);
});

test('Detailing reserves bays, stores the quote and settles a later customer handover without family revenue', () => {
  let state=start('detail',1);
  state=finish(state,'vlad',0);
  const order=state.careers.residents.vlad.progress.detail!.orders[0];
  assert.equal(order.agreed,DETAIL_SERVICES.trim.price);
  assert.equal(order.bay,1);
  tick(state,order.readyAt);
  assert.equal(state.careers.residents.vlad.shift!.task!.event,'detail-handover');
  state=finish(state,'vlad',0);
  const delivered=state.careers.residents.vlad.progress.detail!.orders[0];
  assert.ok(delivered.delivered && delivered.loyalty>85);
  assert.equal(state.money,10000);
});

test('Marketing switches between home and office, uses the laptop and calculates campaign results from decisions', () => {
  const run=(selection: number) => {
    let state=start('marketing',0);
    assert.equal(state.world.places.alina,'home');
    assert.equal(state.careers.residents.alina.shift!.mode,'remote');
    state=finish(state,'alina',0);
    const laptop=stationById('home',HOME_LAPTOP)!;
    assert.deepEqual({x:state.characters.alina.x,z:state.characters.alina.z},laptop.approach);
    tick(state,state.careers.residents.alina.shift!.nextTaskAt);
    state=finish(state,'alina',selection,1);
    return state.careers.residents.alina.progress.marketing!.campaign!;
  };
  const a=run(0), b=run(1);
  assert.ok(a.leads>0 && b.leads>0);
  assert.notDeepEqual(a,b);
  assert.equal(start('marketing',1).world.places.alina,'work-marketing');
});

test('Promotions use verified skills, certification, workplace education and a supervisor evaluation', () => {
  let state=hire('clinic'), p=state.careers.residents.alina.progress.clinic!;
  Object.assign(p,{rank:2,experience:42,qualityShifts:12,duties:70,reputation:90,evaluation:true});
  assert.ok(promotionNeeds(state,'alina','clinic',p).missing.includes('Клинический практикум'));
  assert.equal(applyCareer(state,'alina',{type:'career_promote'},now(state)).ok,false);
  for (const key of ['attention','communication','practical'] as const) state.education.characters.alina.xp[key]=levelXP(10);
  state.education.characters.alina.certificates.push('attention');
  p.clinicModules=CLINIC_MODULES.length;
  p.evaluation=false;
  state=command(state,'alina',{type:'career_start'});
  assert.equal(state.careers.residents.alina.shift!.task?.event,'clinic-review');
  state=finish(state,'alina',0);
  assert.equal(state.careers.residents.alina.progress.clinic!.evaluation,true);
  state=command(state,'alina',{type:'career_leave'});
  state=command(state,'alina',{type:'career_promote'});
  assert.equal(state.careers.residents.alina.progress.clinic!.rank,3);
  assert.ok(!state.careers.residents.alina.progress.clinic!.evaluation);
});

test('Clinical education accrues supervised modules across shifts and uses unrelated clinic patients', () => {
  let state=hire('clinic'), p=state.careers.residents.alina.progress.clinic!;
  Object.assign(p,{rank:1,qualityShifts:8,experience:19,duties:35,reputation:80,clinicModules:5});
  const pets=structuredClone(state.pets);
  state=command(state,'alina',{type:'career_start'});
  assert.equal(state.careers.residents.alina.shift!.task?.event,'clinical-5');
  state=finish(state,'alina',0);
  assert.equal(state.careers.residents.alina.progress.clinic!.clinicModules,6);
  assert.deepEqual(state.pets,pets);
});

test('A project continues in a later shift with its earlier decisions in a saved state', () => {
  let state=hire('it');
  Object.assign(state.careers.residents.vlad.progress.it!,{shifts:1});
  state=command(state,'vlad',{type:'career_start'});
  assert.equal(state.careers.residents.vlad.shift!.task!.story,'it-forms');
  state=finish(state,'vlad',0);
  const p=state.careers.residents.vlad.progress.it!;
  assert.equal(p.stories['it-forms'].stage,1);
  assert.equal(p.stories['it-forms'].outcome,-2);
  tick(state,state.careers.residents.vlad.shift!.nextTaskAt);
  assert.equal(state.careers.residents.vlad.shift!.task!.story,undefined);
  tick(state,state.careers.residents.vlad.shift!.endsAt);
  const dir=mkdtempSync(join(tmpdir(),'sim-life-careers-story-'));
  try {
    const files=openServerFiles(dir);
    files.save(state);
    state=files.load();
    tick(state,shiftWindow('it',1).start);
    state=command(state,'vlad',{type:'career_start'});
    assert.equal(state.careers.residents.vlad.shift!.task!.event,'it-1');
    assert.equal(state.careers.residents.vlad.shift!.task!.story,'it-forms');
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('Migration preserves the family and access, and rescues a resident from a closed work scene', () => {
  const dir=mkdtempSync(join(tmpdir(),'sim-life-careers-legacy-'));
  try {
    const files=openServerFiles(dir);
    const {careers:_,...stable}=initialState();
    stable.money=18512;
    stable.education.characters.alina.certificates=['logic'];
    stable.world.places.vlad='work-it';
    writeFileSync(join(dir,'household.json'),JSON.stringify(stable));
    const recovered=files.load();
    assert.equal(recovered.money,18512);
    assert.equal(recovered.careers.residents.vlad.shift,null);
    assert.equal(recovered.world.places.vlad,'home');
    assert.deepEqual(recovered.education,stable.education);
    assert.deepEqual(recovered.pets,stable.pets);
    assert.deepEqual(openServerFiles(dir).access,files.access);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('All 20 workstations connect, staff occupy safe blocked footprints and lightweight rig loops animate',()=>{
  for (const id of CAREER_IDS) {
    const place=CAREERS[id].place, floor=floorFor(place), obstacles=placeObstacles(place);
    const points=[spawn(place,CAREERS[id].owner),...STATIONS[place].map(p=>p.approach)];
    for(const start of points) for(const end of points) assert.ok(findRoute(start,end,obstacles,floor),JSON.stringify({place,start,end}));
    for(const position of WORK_NPCS[id]) assert.equal(pointIsClear(position,obstacles,floor),false);
    const location=createLocation(place);
    const npc=location.root.getObjectByName(CAREERS[id].staff[1].name)!;
    assert.ok(npc?.userData.motion);
    location.animate?.(.1);
    const previous=npc.userData.motion.head.rotation.y;
    location.animate?.(1.1);
    assert.notEqual(npc.userData.motion.head.rotation.y,previous);
    const visitor = location.root.children.find(item=>item.userData.careerVisitor);
    if(id!=='it') {
      assert.ok(visitor && !visitor.visible);
      location.animate?.(25);
      assert.ok(visitor.visible);
      location.animate?.(50);
      assert.ok(!visitor.visible);
    }
    location.dispose();
    assert.equal(location.root.children.length,0);
  }
});

async function connect(port:number, role:CharacterId, code:string) {
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  const inbox:ServerPacket[]=[];
  ws.on('message', data=>inbox.push(JSON.parse(data.toString())));
  await once(ws,'open');
  const send=(value:object)=>ws.send(JSON.stringify(value));
  async function take<T extends ServerPacket['type']>(type:T, accept:(p:Extract<ServerPacket,{type:T}>)=>boolean=()=>true) {
    for(let i=0;i<300;i++) {
      const index=inbox.findIndex(packet=>packet.type===type&&accept(packet as Extract<ServerPacket,{type:T}>));
      if(index>=0) return inbox.splice(index,1)[0] as Extract<ServerPacket,{type:T}>;
      await new Promise(r=>setTimeout(r,12));
    }
    throw new Error('Missing '+type+' for '+role);
  }
  send({type:'auth',role,code});
  const ready=await take('ready');
  return {ws,send,take,ready};
}

test('Two live residents share wages, keep their own tasks, vote on speed and resume an active shift after restart', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-careers-wire-'));
  const files=openServerFiles(dir);
  const session=hire('it',0,60);
  files.save(command(session,'alina',{type:'career_hire',career:'marketing'}));
  let ms=0;
  let server=await startServer({port:0,dataDir:dir,lifeClock:{now:()=>ms,tickMs:15}});
  try {
    const vlad=await connect(server.port,'vlad',files.access.vlad);
    const alina=await connect(server.port,'alina',files.access.alina);
    vlad.send({type:'career_start'}); alina.send({type:'career_start'});
    const both=await alina.take('snapshot',p=>Boolean(p.state.careers.residents.vlad.shift&&p.state.careers.residents.alina.shift));
    assert.deepEqual(both.state.world.places,{vlad:'work-it',alina:'home'});
    vlad.send({type:'shift_speed',enabled:true});
    await alina.take('time_status',p=>p.status.shiftVotes.includes('vlad')&&p.status.multiplier===1);
    alina.send({type:'shift_speed',enabled:true});
    await vlad.take('time_status',p=>p.status.multiplier===1.5);
    const alice=both.state.careers.residents.alina.shift!.task!;
    vlad.send({type:'career_approach',nonce:alice.nonce});
    await vlad.take('error');
    alina.send({type:'career_approach',nonce:alice.nonce});
    await alina.take('world_path',p=>p.place==='home'&&p.role==='alina');
    ms+=24_000;
    await alina.take('snapshot',p=>p.state.careers.residents.alina.shift?.task?.phase==='ready');
    await server.close();
    ms+=200_000;
    server=await startServer({port:0,dataDir:dir,lifeClock:{now:()=>ms,tickMs:15}});
    const back=await connect(server.port,'alina',files.access.alina);
    assert.equal(back.ready.state.careers.residents.alina.shift!.task!.nonce,alice.nonce);
    assert.equal(back.ready.state.money,10000);
    back.send({type:'career_choose',nonce:alice.nonce,choice:0});
    await back.take('snapshot',p=>p.state.careers.residents.alina.shift?.task?.phase==='checking');
    back.send({type:'career_verify',nonce:alice.nonce,choice:0,step:0});
    await back.take('snapshot',p=>p.state.careers.residents.alina.shift?.task?.phase==='working');
    for(let i=0;i<3;i++) {
      ms+=24_000;
      await back.take('snapshot',p=>gameMinutes(p.state.clock)>=gameMinutes(back.ready.state.clock)+(i+1)*12);
    }
    back.send({type:'career_leave'});
    const paid=await back.take('snapshot',p=>!p.state.careers.residents.alina.shift);
    assert.ok(paid.state.money>10000);
    assert.ok(paid.state.careers.residents.alina.progress.marketing!.duties>0);
    assert.ok(paid.state.careers.residents.vlad.shift);
  } finally { await server.close(); rmSync(dir,{recursive:true,force:true}); }
});
