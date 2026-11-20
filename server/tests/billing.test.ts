import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { initialState, type CharacterId, type GameState, type ServerPacket } from '../../src/shared/protocol';
import { BILLING_PERIOD, SERVICE_MESSAGES, serviceAvailable } from '../../src/shared/services';
import { clockMinutes, stationById, approachFor } from '../../src/shared/locations';
import { applyServiceCommand, settleFamilyServices } from '../services';
import { applyWorld } from '../locations';
import { evaluateTask, planTask } from '../tasks';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

const day = 1440;
const time = (state: GameState) => clockMinutes(state.clock);
function moveClock(state: GameState, minutes: number) {
  const absolute = time(state) + minutes;
  state.clock = {day: Math.floor(absolute/day)+1, minute:absolute%day};
}
function service(state: GameState, command: Record<string, unknown>, role: CharacterId = 'vlad') {
  const result = applyServiceCommand(state, role, command);
  assert.ok(result.ok, result.ok ? '' : result.reason);
  return result.state;
}
function connect(state: GameState, id: 'netflix' | 'youtube') {
  return service(state,{type:'service_connect',service:id});
}

test('Both subscriptions charge the catalogue price and renew on their original game deadline', () => {
  const state = initialState();
  state.money = 20000;
  const first = connect(state,'netflix');
  assert.equal(first.money,18500);
  const second = connect(first,'youtube');
  assert.equal(second.money,17200);
  const firstDue = time(state)+BILLING_PERIOD;
  assert.equal(second.billing.services.netflix.nextDue,firstDue);
  assert.equal(second.billing.services.youtube.nextDue,firstDue);
  moveClock(second,BILLING_PERIOD-1);
  settleFamilyServices(second,false);
  assert.equal(second.money,17200);
  moveClock(second,2);
  settleFamilyServices(second,false);
  assert.equal(second.billing.services.netflix.paidUntil,firstDue+BILLING_PERIOD);
  assert.equal(second.billing.services.youtube.paidUntil,firstDue+BILLING_PERIOD);
  assert.deepEqual(second.ledger.slice(-5).map(e=>e.amount).slice(1),[1200,1000,1500,1300]);
  assert.equal(second.ledger.length,7);
  assert.equal(settleFamilyServices(second,false).length,0);
  assert.equal(second.ledger.length,7);
});

test('Turning off renewal preserves paid days, and an overdue subscription can restart after payment', () => {
  const seed = initialState();
  assert.match((applyServiceCommand({...seed,money:200},'vlad',{type:'service_connect',service:'netflix'}) as {reason:string}).reason,/1.500/);
  let state = connect(seed,'netflix');
  const deadline = state.billing.services.netflix.paidUntil;
  state = service(state,{type:'service_renewal',service:'netflix',enabled:false});
  assert.equal(state.billing.services.netflix.paidUntil,deadline);
  assert.ok(serviceAvailable(state.billing,'netflix',time(state)));
  moveClock(state,BILLING_PERIOD);
  settleFamilyServices(state,false);
  assert.equal(state.billing.bills.filter(b=>b.service==='netflix').length,1);
  assert.equal(serviceAvailable(state.billing,'netflix',time(state)),false);
  state.money = 1500;
  state = connect(state,'netflix');
  moveClock(state,BILLING_PERIOD+60);
  settleFamilyServices(state,false);
  const bill = state.billing.bills.find(b=>b.service==='netflix' && b.paidAt===null)!;
  assert.ok(bill);
  state.money = 1500;
  state = service(state,{type:'service_pay',billId:bill.id},'alina');
  assert.equal(state.money,0);
  assert.equal(state.billing.services.netflix.paidUntil,time(state)+BILLING_PERIOD);
  assert.equal(applyServiceCommand(state,'vlad',{type:'service_pay',billId:bill.id}).ok,false);
});

test('Automatic renewals catch up across paid periods and suspend at the first unpaid period', () => {
  const seed=initialState();
  seed.money=90000;
  const active=connect(seed,'netflix');
  moveClock(active,3*BILLING_PERIOD);
  settleFamilyServices(active,false);
  assert.equal(active.billing.bills.filter(bill=>bill.service==='netflix').length,4);
  assert.equal(active.billing.services.netflix.paidUntil,time(active)+BILLING_PERIOD);
  active.money=0;
  moveClock(active,3*BILLING_PERIOD);
  settleFamilyServices(active,false);
  assert.equal(active.billing.bills.filter(bill=>bill.service==='netflix'&&bill.paidAt===null).length,1);
  assert.equal(active.billing.services.netflix.nextDue,null);
  assert.equal(active.billing.bills.filter(bill=>bill.service==='utilities'&&bill.paidAt===null).length,3);
});

test('Reminder and rejection are emitted once per deadline', () => {
  const state=initialState();
  state.money=0;
  moveClock(state,BILLING_PERIOD-day);
  assert.equal(settleFamilyServices(state,false).filter(m=>m.includes('Скоро')).length,3);
  assert.deepEqual(settleFamilyServices(state,false),[]);
  moveClock(state,day);
  assert.equal(settleFamilyServices(state,false).filter(m=>m.includes('недостаточно')).length,3);
  assert.deepEqual(settleFamilyServices(state,true),[]);
});

test('An old save at midnight keeps all progress and credentials and migrates once', () => {
  const dir=mkdtempSync(join(tmpdir(),'sim-life-billing-migrate-'));
  try {
    const files=openServerFiles(dir);
    const saved=initialState();
    saved.clock={day:38,minute:1439};
    saved.money=54321;
    saved.pantry.bread=11;
    saved.pets.simba.bond=77;
    saved.characters.alina.skill=41;
    const {billing,...old}=saved;
    assert.ok(billing);
    const original=JSON.stringify(old);
    const path=join(dir,'household.json');
    writeFileSync(path,original);
    const migrated=files.load();
    assert.deepEqual(migrated,{...old,billing:migrated.billing});
    assert.equal(migrated.billing.services.internet.paidUntil,time(saved)+BILLING_PERIOD);
    assert.equal(migrated.billing.bills.length,0);
    assert.equal(readFileSync(join(dir,'household.pre-billing.json'),'utf8'),original);
    assert.deepEqual(openServerFiles(dir).access,files.access);
    assert.deepEqual(openServerFiles(dir).load().billing,migrated.billing);
    migrated.money=0;
    moveClock(migrated,BILLING_PERIOD);
    settleFamilyServices(migrated,false);
    files.save(migrated);
    assert.deepEqual(openServerFiles(dir).load().billing,migrated.billing,'including the exact utility charge');
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('Access covers legacy media, computer tasks, mobile communication and free television', () => {
  const seed=initialState();
  seed.money=8500;
  const start=(state: GameState, body: Record<string, unknown>) => evaluateTask(state,'vlad',planTask(body)!.command);
  assert.deepEqual(start(seed,{type:'act',actionId:'sofaMovie'}),{ok:false,reason:SERVICE_MESSAGES.netflix});
  assert.deepEqual(start(seed,{type:'youtube'}),{ok:false,reason:SERVICE_MESSAGES.youtube});
  const state=connect(connect(seed,'netflix'),'youtube');
  state.billing.services.internet.paidUntil=time(state);
  state.billing.services.mobile.paidUntil=time(state);
  for (const command of [{type:'movie',genre:'comedy'},{type:'youtube'}]) {
    assert.deepEqual(start(state,command),{ok:false,reason:SERVICE_MESSAGES.internet});
  }
  for (const actionId of ['vladOrder','vladStudy','deskGames']) {
    assert.deepEqual(start(state,{type:'act',actionId}),{ok:false,reason:SERVICE_MESSAGES.computer});
  }
  for (const actionId of ['sofaCall','tableTalk']) {
    assert.deepEqual(start(state,{type:'act',actionId}),{ok:false,reason:SERVICE_MESSAGES.mobile});
  }
  for (const command of [{type:'free_tv'},{type:'act',actionId:'watchTv'},{type:'act',actionId:'tvMusic'}]) {
    const plan = planTask(command)!;
    assert.equal(plan.durationMs,60000);
    const result = evaluateTask(state,'vlad',plan.command);
    assert.ok(result.ok);
    assert.equal(result.state.characters.vlad.fun,state.characters.vlad.fun+5);
    assert.equal(result.state.characters.vlad.comfort,state.characters.vlad.comfort);
  }
  assert.ok(start(state,{type:'act',actionId:'deskJournal'}).ok);
});

test('Overdue mobile blocks new delivery while a paid parcel can still be collected', () => {
  let state=initialState();
  const command={type:'delivery_order',lines:[{id:'grocery:bread',quantity:1}],sequence:0};
  const order=applyWorld(state,'vlad',command);
  assert.ok(order.ok);
  state=order.state;
  state.money=0;
  moveClock(state,BILLING_PERIOD);
  settleFamilyServices(state,false);
  assert.deepEqual(applyWorld(state,'vlad',{...command,sequence:1}),{ok:false,reason:SERVICE_MESSAGES.mobile});
  const parcel=state.world.deliveries[0];
  Object.assign(state.characters.vlad,approachFor(stationById('home','parcel')!,'vlad'));
  const collected=applyWorld(state,'vlad',{type:'delivery_claim',id:parcel.id});
  assert.ok(collected.ok);
  assert.equal(collected.state.world.deliveries.length,0);
  state.money=1200;
  const bill=state.billing.bills.find(b=>b.service==='mobile')!;
  state=service(state,{type:'service_pay',billId:bill.id});
  state.money=600;
  assert.ok(applyWorld(state,'vlad',{...command,sequence:1}).ok);
});

type PacketKind = ServerPacket['type'];
async function player(port: number, role: CharacterId, code: string) {
  const socket = new WebSocket('ws://127.0.0.1:'+port+'/sync');
  const inbox: ServerPacket[] = [];
  socket.on('message', raw => inbox.push(JSON.parse(raw.toString()) as ServerPacket));
  await once(socket,'open');
  function send(packet: object) { socket.send(JSON.stringify(packet)); }
  async function take<K extends PacketKind>(type: K,
    matches: (packet: Extract<ServerPacket,{type:K}>) => boolean = () => true) {
    for(let attempt=0;attempt<350;attempt++) {
      const index=inbox.findIndex(p=>p.type===type&&matches(p as Extract<ServerPacket,{type:K}>));
      if(index>=0) return inbox.splice(index,1)[0] as Extract<ServerPacket,{type:K}>;
      await new Promise(resolve=>setTimeout(resolve,8));
    }
    throw new Error(role+' never received '+type);
  }
  send({type:'auth',role,code});
  const ready=await take('ready');
  return {socket,send,take,ready};
}

async function household(seed: GameState, profile: { taskTimeScale?:number } = {}) {
  const dir=mkdtempSync(join(tmpdir(),'sim-life-billing-live-'));
  const files=openServerFiles(dir);
  files.save(seed);
  let now=0;
  const server=await startServer({dataDir:dir,port:0,taskTimeScale:profile.taskTimeScale??0.02,
    lifeClock:{now:()=>now,tickMs:15}});
  return {
    files,server,
    open:(role:CharacterId)=>player(server.port,role,files.access[role]),
    advance(ms:number) {now+=ms;},
    async close() {await server.close();rmSync(dir,{recursive:true,force:true});},
  };
}

test('Two connected players share subscriptions, racing payments and reconnect state', async () => {
  const seed=initialState();
  seed.money=0;
  moveClock(seed,BILLING_PERIOD);
  settleFamilyServices(seed,false);
  seed.money=3000;
  const session=await household(seed);
  try {
    const vlad=await session.open('vlad');
    const alina=await session.open('alina');
    vlad.send({type:'movie_invite',genre:'comedy'});
    assert.match((await vlad.take('error')).reason,/Netflix/);
    const bill=seed.billing.bills.find(row=>row.service==='internet')!;
    vlad.send({type:'service_pay',billId:bill.id});
    alina.send({type:'service_pay',billId:bill.id});
    const after=await Promise.all([vlad.take('snapshot',p=>p.state.money===1800),alina.take('snapshot',p=>p.state.money===1800)]);
    assert.deepEqual(after[0].state,after[1].state);
    vlad.send({type:'service_connect',service:'netflix'});
    alina.send({type:'service_connect',service:'netflix'});
    const subscribed=await alina.take('snapshot',p=>p.state.money===300);
    assert.equal(subscribed.state.ledger.filter(e=>e.category==='services').length,2);
    alina.send({type:'movie_invite',genre:'comedy'});
    assert.equal((await vlad.take('movie_offer')).from,'alina');
    vlad.socket.close();
    await alina.take('online',p=>p.online.length===1);
    const reopened=await session.open('vlad');
    assert.deepEqual(reopened.ready.state.billing,subscribed.state.billing);
    assert.equal(reopened.ready.state.money,300);
    assert.equal(session.files.load().ledger.length,2);
  } finally {await session.close();}
});

test('Losing internet interrupts an agreed film for both players before rewards', async () => {
  const seed=initialState();
  seed.money=1500;
  const state=connect(seed,'netflix');
  const deadline=time(state)+1;
  Object.assign(state.billing.services.internet,{paidUntil:deadline,nextDue:deadline});
  const session=await household(state,{taskTimeScale:.05});
  try {
    const vlad=await session.open('vlad');
    const alina=await session.open('alina');
    vlad.send({type:'movie_invite',genre:'comedy'});
    const offer=await alina.take('movie_offer');
    alina.send({type:'movie_reply',inviteId:offer.inviteId,accept:true});
    await vlad.take('task_active');
    session.advance(2200);
    for(const role of ['vlad','alina'] as const) {
      const cancelled=await vlad.take('task_ended',p=>p.role===role);
      assert.equal(cancelled.outcome,'cancelled');
      assert.equal(cancelled.effects,undefined);
      assert.match(cancelled.message,/интернет/);
    }
    const saved=session.files.load();
    assert.ok(saved.characters.vlad.fun > 71.9 && saved.characters.vlad.fun < 72);
    assert.ok(saved.characters.alina.social<76);
    assert.equal(saved.billing.bills.filter(bill=>bill.service==='internet'&&bill.paidAt===null).length,1);
  } finally {await session.close();}
});

for (const multiplier of [1.5, 2, 3] as const) {
  test('The live billing deadline follows shared clock speed ×'+multiplier, async () => {
    const seed=initialState();
    seed.money=10000;
    seed.characters.vlad.energy=30;
    seed.characters.alina.energy=30;
    const now=time(seed);
    const due=now+3;
    for(const id of ['utilities','internet','mobile'] as const) {
      seed.billing.services[id].nextDue=due;
      seed.billing.services[id].paidUntil=due;
    }
    const session=await household(seed);
    try {
      const vlad=await session.open('vlad');
      const alina=await session.open('alina');
      if(multiplier===1.5) {
        vlad.send({type:'job_start',job:'courier'});
        const job=await vlad.take('snapshot',p=>!!p.state.activeShifts.vlad);
        assert.ok(job.state.activeShifts.vlad);
        vlad.send({type:'shift_speed',enabled:true});
        alina.send({type:'shift_speed',enabled:true});
      } else {
        const mode=multiplier===2?'full':'half';
        vlad.send({type:'sleep_start',mode});
        alina.send({type:'sleep_start',mode});
      }
      await vlad.take('time_status',p=>p.status.multiplier===multiplier);
      const untilDue=Math.ceil(6000/multiplier);
      session.advance(untilDue-50);
      const before=await vlad.take('snapshot',p=>time(p.state)===now+2);
      assert.equal(before.state.billing.bills.length,0);
      session.advance(100);
      const after=await alina.take('snapshot',p=>time(p.state)===due);
      assert.deepEqual(after.state.billing.bills.map(b=>b.issuedAt),[due,due,due]);
      assert.deepEqual(after.state.ledger.map(row=>row.amount).slice(1),[1200,1000]);
      assert.equal(after.state.billing.services.internet.nextDue,due+BILLING_PERIOD);
      session.advance(3000);
      const next=await vlad.take('snapshot',p=>time(p.state)>due);
      assert.equal(next.state.ledger.length,3);
      assert.equal(next.state.money,after.state.money);
    } finally {await session.close();}
  });
}

test('A completed paid shift retries mandatory debt in its salary transaction', async () => {
  const seed=initialState();
  seed.money=0;
  moveClock(seed,BILLING_PERIOD);
  settleFamilyServices(seed,false);
  const now=time(seed);
  const {JOBS}=await import('../../src/shared/jobs');
  const {hoursMin,payMax}=JOBS.courier;
  seed.activeShifts.vlad={job:'courier',startedAt:now+1-hoursMin*60,endsAt:now+1,hours:hoursMin,targetPay:payMax};
  const session=await household(seed);
  try {
    const vlad=await session.open('vlad');
    session.advance(2000);
    const after=await vlad.take('snapshot',p=>!p.state.activeShifts.vlad);
    assert.equal(after.state.ledger[0].category,'work');
    const payments=after.state.ledger.slice(1);
    assert.ok(payments.length>0);
    assert.ok(payments.every(row=>row.category==='services'));
    assert.equal(after.state.money,payMax-payments.reduce((sum,row)=>sum+row.amount,0));
    assert.ok(after.state.money>=0);
    assert.deepEqual(session.files.load().billing,after.state.billing);
  } finally {await session.close();}
});

test('Restart retains unpaid balances and already-paid bill IDs', async () => {
  const dir=mkdtempSync(join(tmpdir(),'sim-life-billing-restart-'));
  try {
    const files=openServerFiles(dir);
    const seed=initialState();
    seed.money=0;
    moveClock(seed,BILLING_PERIOD*2);
    settleFamilyServices(seed,false);
    seed.money=1200;
    files.save(seed);
    const bill=seed.billing.bills.find(row=>row.service==='internet')!;
    const first=await startServer({dataDir:dir,port:0});
    try {
      const vlad=await player(first.port,'vlad',files.access.vlad);
      vlad.send({type:'service_pay',billId:bill.id});
      await vlad.take('snapshot',p=>p.state.money===0);
    } finally {await first.close();}
    const saved=files.load();
    const second=await startServer({dataDir:dir,port:0});
    try {
      const alina=await player(second.port,'alina',files.access.alina);
      assert.deepEqual(alina.ready.state.billing,saved.billing);
      assert.equal(alina.ready.state.ledger.length,1);
      alina.send({type:'service_pay',billId:bill.id});
      assert.match((await alina.take('error')).reason,/уже оплачен/);
      assert.deepEqual(files.load().billing,saved.billing);
    } finally {await second.close();}
  } finally {rmSync(dir,{recursive:true,force:true});}
});
