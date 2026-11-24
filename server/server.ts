import {isNotebookDesk} from '../src/shared/furniture';
import { isHomeJob } from "../src/shared/jobs";
import { computerDevice, computerResource } from "../src/shared/computer";
import { FURNITURE_BY_ID } from "../src/shared/furniture";
import { furnitureUseLocation,laptopWorkplace,laptopApproach,laptopDesk } from "../src/shared/furnitureUse";
import { diningLocation } from '../src/shared/furnitureUse';
import { PET_IDS, treatsRemaining } from '../src/shared/pets';
import { grantStarterPetFurniture } from './starterPets';
import { yieldSimbaFurniture } from './pets';
import { catSeatOverlap } from '../src/shared/catOccupancy';
import type { CatPerch } from '../src/shared/CatPerches';
import { inHomeGrounds } from '../src/shared/district';
import { applyServiceCommand, settleFamilyServices } from './services';
import { applyBudgetCommand } from './familyBudget';
import { changeComputerFavorite } from './computers';
import { applyEducation, awardActivity } from './education';
import { serviceAvailable } from '../src/shared/services';
import { taskAccessError } from '../src/shared/serviceAccess';
import { rewardCommand, wishAtStart, fulfillWish } from './happiness';
import type { Wish } from '../src/shared/wishes';
import { protectNeeds } from '../src/shared/happiness';
import {dogBathPlan} from '../src/shared/dogBath';
import {isTrainingAction} from '../src/shared/dogTraining';
import { applyWorld, setDogParkPosition, worldMessages } from './locations';
import { openDevices } from './devices';
import { clockMinutes, stationById, approachFor,placeObstacles,floorFor } from '../src/shared/locations';
import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import WebSocket, { WebSocketServer, type RawData } from 'ws';
import {
  ACTIONS, points, names, type CharacterId, type GameState, type ServerPacket,
} from '../src/shared/protocol';
import { applyFoodAction } from './food';
import { checkout } from './market';
import { applyFurnishing,layoutBlock,routeHitsLayout,settleLayout } from './furnishing';
import { applyPetAction, pausePetRoutine, petCarePoint, runPetRoutines } from './pets';
import { leisureDurationMs, planLeisure, urgentHomeAction } from './home';
import { autonomyCandidates, fullLeisureCandidates, AUTONOMY_MODES } from '../src/shared/autonomy';
import { homeHabitCommands } from '../src/shared/personalityHabits';
import { BATH_ACTIONS, HOME_WALK_SPEED, KITCHEN_ACTIONS, KITCHEN_WORK, homeSeat,
  type HomeLeisure } from '../src/shared/home';
import { otherRole } from './social';
import { openServerFiles } from './storage';
import { planTask, evaluateTask, type TaskPlan } from './tasks';
import { createHomeSessions, usesHomeSession } from './homeSessions';
import { gains } from './needs';
import { dirtyDishStops } from '../src/shared/dirtyDishes';
import { advanceLife } from './life';
import { expireReadyFood, readyFoodName } from '../src/shared/readyFood';
import { CLOCK_SYNC_MS, GAME_MINUTES_PER_REAL_SECOND } from '../src/shared/life';
import { timeMultiplier, sleepTarget, type SleepMode, type TimeStatus } from '../src/shared/timeControl';
import { selectSleepBed } from '../src/shared/bedSleep';
import { recoverSleep } from './timeControl';
import { PausableTimers } from './pausableTimers';
import type { PetId } from '../src/shared/pets';
import { beginShift, leaveShiftEarly, settleCompletedShifts, answerHomeQuest, expireHomeQuests } from './jobs';
import { advanceCareers, applyCareer, careerCommands } from './careers';
import { sampleWalk,planWalk, type WalkRoute } from '../src/game/navigation';

export interface ServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  distDir?: string;
  /** For fast deterministic integration tests; production defaults to real time. */
  taskTimeScale?: number;
  socialTtlMs?: number;
  /** Localhost-only, separate-save convenience mode for private previews. */
  testNoCodes?:boolean;
  /** Money only for a brand-new, isolated no-code preview household. */
  previewStartMoney?:number;
  /** The actual game entry point provisions free starter pet furniture. */
  starterPetFurniture?:boolean;
  /** Deterministic clock input and tick cadence for isolated integration tests. */
  lifeClock?: { now: () => number; tickMs: number };
  /** Isolated integration tests can shorten the real-world autonomy delays. */
  autonomyTiming?: { idleMs:number; careCooldownMs:number; leisureCooldownMs:number };
}
export interface RunningServer {
  httpServer: HttpServer;
  port: number;
  close(): Promise<void>;
}
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2',
};
const sameCode = (a: string, b: string): boolean => {
  const supplied = Buffer.from(a), expected = Buffer.from(b);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};
const packet = (socket: WebSocket, value: ServerPacket): void => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
};

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const port = options.port ?? 3101;
  const host = options.host ?? '127.0.0.1';
  // Explicit no-code previews must have separate saves and a non-production
  // port. Binding to 0.0.0.0 permits trusted home-LAN phone testing only.
  const previewNoCodes=options.testNoCodes===true &&
    (host==='127.0.0.1'||host==='0.0.0.0') &&
    (port===0&&host==='127.0.0.1'||port>=3120&&port<=3199) &&
    options.dataDir!==undefined &&
    resolve(options.dataDir).toLowerCase()!==resolve('server-data').toLowerCase() &&
    !resolve(options.dataDir).toLowerCase().endsWith('sim-life\\server-data');
  if(options.testNoCodes===true&&!previewNoCodes)
    throw new Error('Passwordless test mode requires a dedicated preview port and isolated household data');
  if(options.previewStartMoney!==undefined && (!previewNoCodes ||
    !Number.isSafeInteger(options.previewStartMoney) || options.previewStartMoney<0))
    throw new Error('Preview starting money requires a valid, isolated no-code test server');
  const files = openServerFiles(options.dataDir ?? resolve('server-data'));
  const devices = openDevices(files.dataDir);
  const distDir = resolve(options.distDir ?? resolve('dist'));
  // Fresh preview builds can start with test spending money without changing
  // the production economy or overwriting any existing household progress.
  const freshPreview = previewNoCodes && options.previewStartMoney!==undefined &&
    !existsSync(resolve(files.dataDir,'household.json'));
  let state: GameState = files.load();
  if(freshPreview){
    state.money=options.previewStartMoney!;
    files.save(state);
  }
  if(options.starterPetFurniture&&grantStarterPetFurniture(state))files.save(state);
  const spoiledOnBoot = expireReadyFood(state);
  const serviceUpdatesOnBoot = settleFamilyServices(state, false, false);
  if (spoiledOnBoot.length || serviceUpdatesOnBoot.length) {
    state.revision++;
    files.save(state);
  }
  // Sleepers are recovered from their saved bed and target below. No energy
  // is awarded while the server is offline; sleep resumes when players return.
  if (state.world.dogWalker) {
    state.world.dogWalker = null;
    setDogParkPosition(state);
  }
  const pauseTimers = new PausableTimers();
  let isPaused = false;
  let pauseRequestedBy: CharacterId | null = null;
  let pauseVoteTimer: ReturnType<typeof setTimeout> | null = null;
  const active = new Map<CharacterId, WebSocket>();
  const lastAction = new Map<CharacterId, number>();
  const lastIntent = new Map<CharacterId, number>();
  const lastAutoCare = new Map<CharacterId, number>();
  const idleAutonomyMs=options.autonomyTiming?.idleMs??3500;
  const legacyIdleMs=options.autonomyTiming?.idleMs??18000;
  const careCooldownMs=options.autonomyTiming?.careCooldownMs??3500;
  const leisureCooldownMs=options.autonomyTiming?.leisureCooldownMs??4500;
  const leisure = new Map<CharacterId, { activity: HomeLeisure; startedAt: number; until: number; route: WalkRoute }>();
  // Keep full autonomy from repeating the same entertainment at every idle tick.
  const recentLeisure = new Map<CharacterId, HomeLeisure>();
  const fullRoutineTurn=new Map<CharacterId,number>();
  // Ephemeral habit memory: never alter saved household state or manual queues.
  const recentHomeHabits=new Map<CharacterId,import('../src/shared/protocol').ActionId[]>();

  const walkingHome = new Map<CharacterId, { route: WalkRoute; started: number; station?:string }>();
  const storageOpen = new Map<CharacterId, string>();
  interface RunningTask { id: number; role: CharacterId; plan: TaskPlan; timer: ReturnType<typeof setTimeout>; automatic: boolean }
  const running = new Map<CharacterId, RunningTask>();
  // Only the owner can enqueue. Each queue is per resident, in memory, and
  // never serialized into the household save; revalidation happens at execution.
  type QueuedEntry={id:number;label:string;plan?:TaskPlan;sleep?:{mode:SleepMode;furnitureId?:number}};
  const queuedTasks = new Map<CharacterId, QueuedEntry[]>();
  let nextQueueId = 0;
  let nextTaskId = 0;
  const scale = options.taskTimeScale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) throw new Error('Invalid task time scale');
  const online = (): CharacterId[] => Array.from(active.keys());
  const sleepers = new Map<CharacterId, SleepMode>();
  const sleepWishes = new Map<CharacterId,Wish>();
  const autoSleeping = new Set<CharacterId>();
  // Active sleep was already persisted in the household. Resume it when the
  // server restarts instead of leaving a permanently sleeping visual with
  // no wake-up action or recovery timer.
  let repairedSleep=false;
  for(const resident of ['vlad','alina'] as const){
    const sleeper=state.characters[resident];
    if(sleeper.pose!=='sleep'||state.world.places[resident]!=='home')continue;
    const chosen=selectSleepBed(state,resident,
      typeof sleeper.sleepingOn==='number'?sleeper.sleepingOn:undefined);
    if(chosen.ok){
      sleeper.sleepingOn=chosen.bed.id;
      sleepers.set(resident,sleeper.sleepMode==='half'?'half':'full');
    }else{
      sleeper.pose='idle';
      delete sleeper.sleepingOn;
      delete sleeper.sleepMode;
      repairedSleep=true;
    }
  }
  if(repairedSleep){state.revision++;files.save(state);}
  const shiftVotes = new Set<CharacterId>();
  const timeStatus = (): TimeStatus => ({
    multiplier: timeMultiplier(online(), { vlad: state.activeShifts.vlad || state.careers.residents.vlad.shift,
      alina: state.activeShifts.alina || state.careers.residents.alina.shift }, sleepers, shiftVotes),
    shiftVotes: [...shiftVotes],
    sleepers: Object.fromEntries(sleepers) as TimeStatus['sleepers'],
    paused: isPaused,
    pauseRequestedBy,
  });
  const all = (event: ServerPacket): void => {
    for (const socket of active.values()) packet(socket, event);
    // Defer until all completion bookkeeping and saves have finished.
    // This also works for homeSessions (including toilet -> hand washing).
    if(event.type==='task_ended' && (queuedTasks.get(event.role)?.length??0)>0)
      setTimeout(()=>startNextQueued(event.role),0);
  };
  const queueSnapshot = (role:CharacterId) => ({
    type:'task_queue' as const,role,
    tasks:(queuedTasks.get(role)??[]).map(({id,label})=>({id,label})),
  });
  const publishQueue=(role:CharacterId)=>all(queueSnapshot(role));
  const clearQueue=(role:CharacterId)=>{
    if(!queuedTasks.has(role))return;
    queuedTasks.delete(role);
    publishQueue(role);
  };
  const announceTime = () => {
    all({ type: 'time_status', status: timeStatus() });
    sendClock();
  };
  const clearPauseRequest = () => {
    if (pauseVoteTimer) clearTimeout(pauseVoteTimer);
    pauseVoteTimer = null;
    pauseRequestedBy = null;
  };
  const setPaused = (value: boolean) => {
    if (value === isPaused) return;
    accountTime(); // settle the previous clock rate before freezing it
    clearPauseRequest();
    if (value) pauseTimers.pause(); else pauseTimers.resume();
    isPaused = value;
    lastLifeTick = lifeNow();
    announceTime();
  };
  const leisureRoute = (role: CharacterId, now: number) => {
    const task = leisure.get(role)!;
    return sampleWalk(task.route, Math.max(0, Math.min(task.until, now) - task.startedAt) / 1000 * 1.8);
  };
  const sendLeisure = (socket: WebSocket): void => {
    const now = pauseTimers.now();
    for (const [resident, current] of leisure) {
      if (current.until <= now || (current.activity === 'chat' && resident === 'alina')) continue;
      const roles: CharacterId[] = current.activity === 'chat' ? ['vlad', 'alina'] : [resident];
      const routes = Object.fromEntries(roles.map(id => [id, leisureRoute(id, now)]));
      packet(socket, { type: 'home_leisure', roles, activity: current.activity, routes });
    }
    for (const [role, station] of storageOpen) packet(socket, { type: 'storage_event', role, station });
  };
  const closeStorage = (role: CharacterId): void => {
    if (storageOpen.delete(role)) all({ type: 'storage_event', role });
  };
  const stopLeisure = (role: CharacterId, now = pauseTimers.now()): void => {
    const current = leisure.get(role);
    if (!current) return;
    const roles = current.activity === 'chat' ? [role, otherRole(role)] : [role];
    const routes: Partial<Record<CharacterId, WalkRoute>> = {};
    for (const resident of roles) {
      const point = leisureRoute(resident, now).from;
      Object.assign(state.characters[resident], point, { pose: 'idle' });
      routes[resident] = { from: point, path: [] };
      leisure.delete(resident);
    }
    all({ type: 'home_leisure', roles, activity: null, routes });
    if(current.activity==='chat'&&now>=current.until){
      const next=structuredClone(state);
      for(const resident of roles){
        next.characters[resident].social=Math.min(100,next.characters[resident].social+9);
        next.characters[resident].mood=Math.min(100,next.characters[resident].mood+2);
      }
      next.revision++;
      try{files.save(next);state=next;all({type:'snapshot',state});}
      catch(error){console.error('Could not save completed autonomous chat:',error);}
    }
  };
  const stopSleep = (role: CharacterId): void => {
    autoSleeping.delete(role);
    if (!sleepers.has(role)) return;
    accountTime();
    if (state.characters[role].pose === 'sleep') {
      const next = structuredClone(state);
      next.characters[role].pose = 'idle';
      delete next.characters[role].sleepingOn;
      delete next.characters[role].sleepMode;
      next.revision++;
      try { files.save(next); state = next; }
      catch (error) { console.error('Could not save wake-up:', error); return; }
      all({ type: 'snapshot', state });
    }
    sleepers.delete(role);
    sleepWishes.delete(role);
    announceTime();
    if(queuedTasks.get(role)?.length)setTimeout(()=>startNextQueued(role),0);
  };
  const homeTasks = createHomeSessions({
    state: () => state, save(next) { files.save(next); state = next; },
    all, send: packet, socket: role => active.get(role),
    busy: role => running.has(role) || sleepers.has(role) || Boolean(state.activeShifts[role] || state.careers.residents[role].shift),
    gameTime: () => liveGameTime(),
    now: () => pauseTimers.now(),
    schedule: (cb, ms) => pauseTimers.schedule(cb, ms),
    clearTimer: handle => pauseTimers.clear(handle),
    pausePet: pet => {
      if(state.pets[pet].routine){
        pausePetRoutine(state,pet,liveGameTime());
        all({type:'snapshot',state});
      }
    }, socialTtlMs:options.socialTtlMs,
    resourceBusy: resource => [...running.values()].some(task => task.plan.resource === resource||resource==='pet:verdell'&&task.plan.command.type==='pet_action'&&task.plan.command.action==='bathe')||Object.values(state.activeShifts).some(shift=>shift?.homeDevice&&computerResource(shift.homeDevice)===resource),
    prepare(role, tv) {
      if (tv) for (const [other,routine] of leisure) if (routine.activity === 'tv') stopLeisure(other);
      closeStorage(role);
      stopLeisure(role);
      const walk = walkingHome.get(role);
      if (walk) {
        const distance = (pauseTimers.now()-walk.started)/1000*HOME_WALK_SPEED;
        Object.assign(state.characters[role],sampleWalk(walk.route,distance).from,{pose:'idle'});
        walkingHome.delete(role);
      }
      lastIntent.set(role, pauseTimers.now());
    },
    nextId: () => ++nextTaskId, timeScale: scale,
  });
  const needsEvent = (role: CharacterId, label: string, before: GameState, after: GameState) => {
    const effects = gains(before, after, role);
    if (Object.keys(effects).length) all({ type: 'need_gain', role, label, effects });
  };
  const lifeNow = options.lifeClock?.now ?? (() => performance.now());
  let lastLifeTick = lifeNow();
  let minuteCarry = 0;
  const timeSinceTick = (now: number) => Math.min(30_000, Math.max(0, now - lastLifeTick));
  /** Charge elapsed real time at the OLD rate before any player changes the rate. */
  const accountTime = (): void => {
    const now = lifeNow();
    const elapsed = timeSinceTick(now);
    lastLifeTick = now;
    if (active.size && !isPaused) minuteCarry += elapsed / 1000 * GAME_MINUTES_PER_REAL_SECOND * timeStatus().multiplier;
  };
  const liveGameTime = (multiplier = timeStatus().multiplier) => clockMinutes(state.clock) + minuteCarry +
    (isPaused ? 0 : timeSinceTick(lifeNow()) / 1000 * GAME_MINUTES_PER_REAL_SECOND * multiplier);
  const sendClock = () => {
    if (!active.size) return;
    const { multiplier } = timeStatus();
    all({ type: 'clock_sync', sample: { minutes: liveGameTime(multiplier), multiplier: isPaused ? 0 : multiplier } });
  };
  const clockSync = setInterval(sendClock, CLOCK_SYNC_MS);
  clockSync.unref();
  // Only the authoritative server moves the clock. With nobody online the
  // household is paused; reconnects never drain the absent player's needs.
  const commitLife = (): boolean => {
    if (isPaused) return false;
    const now = pauseTimers.now();
    const speedBefore = timeStatus().multiplier;
    accountTime();
    if (!active.size) return false;
    const gameMinutes = Math.min(1440, Math.floor(minuteCarry));
    if (gameMinutes < 1) return false;
    for (const [role, activity] of leisure) {
      if (activity.until <= now) stopLeisure(role, now);
      else {
        const { from, path } = leisureRoute(role, now);
        const pose = path.length ? 'idle' : activity.activity === 'tv' ? 'sit' : activity.activity === 'computer' ? 'work' : 'idle';
        Object.assign(state.characters[role], from, { pose });
      }
    }
    const advanced=advanceLife(state, gameMinutes, online());
    expireHomeQuests(advanced);
    const next = settleCompletedShifts(advanced);
    for(const id of ["vlad","alina"] as const){const job=next.state.activeShifts[id];if(job?.homeDevice&&job.startedAt<=clockMinutes(next.state.clock))next.state.characters[id].pose="work";}
    advanceCareers(next.state, clockMinutes(state.clock), clockMinutes(next.state.clock), online());
    homeTasks.checkpoint(next.state);
    const spoiled = expireReadyFood(next.state);
    const sleepBefore = sleepers.size ? structuredClone(next.state) : null;
    const finishedSleeping = recoverSleep(next.state, gameMinutes, sleepers);
    for(const role of finishedSleeping){fulfillWish(next.state,role,sleepWishes.get(role),state);sleepWishes.delete(role);}
    protectNeeds(next.state);
    const occupiedPets = new Set<PetId>();
    for (const { plan } of running.values()) if (plan.command.type === 'pet_action') occupiedPets.add(plan.command.pet);
    for (const { activity } of leisure.values()) if (activity === 'verdell' || activity === 'simba') occupiedPets.add(activity);
    for(const pet of ['simba','verdell'] as const) if(homeTasks.reserved('pet:'+pet))occupiedPets.add(pet);
    const diners=homeTasks.diners();
    for(const [role,task] of running)if(task.plan.command.type==='eat'||task.plan.command.type==='eat_takeout'){const r=diningLocation(next.state,role,task.plan.command.furnitureId)?.route;diners.set(role,r?(r.path.at(-1)??r.from):homeSeat('table',role).approach);}
    runPetRoutines(next.state, gameMinutes, clockMinutes(next.state.clock), occupiedPets,Math.random,catReserved,diners);
    const billingMessages = settleFamilyServices(next.state, next.state.money > state.money);
    try { files.save(next.state); }
    catch (error) { console.error('Could not save daily-life clock:', error); return false; }
    minuteCarry -= gameMinutes;
    if (sleepBefore) for (const role of sleepers.keys()) needsEvent(role,'🌙 Сон',sleepBefore,next.state);
    for (const role of finishedSleeping) { sleepers.delete(role); autoSleeping.delete(role); }
    if (next.completed.length) shiftVotes.clear();
    const arrived = state.world.deliveries.some(d => d.readyAt > clockMinutes(state.clock) &&
      d.readyAt <= clockMinutes(next.state.clock));
    state = next.state;
    all({ type: 'snapshot', state });
    if (spoiled.length) {
      const portions = spoiled.reduce((count,batch)=>count+batch.portions,0);
      const samples = [...new Set(spoiled.map(batch=>readyFoodName(batch.kind,batch.item)))].slice(0,2);
      all({ type: 'ready_food_spoiled', message: '🥀 Испортилась готовая еда: '+samples.join(', ')+
        (spoiled.length>2?' и другое':'')+' · выброшено порций: '+portions });
    }
    if (finishedSleeping.length || next.completed.length || speedBefore !== timeStatus().multiplier) announceTime();
    for(const id of finishedSleeping)if(queuedTasks.get(id)?.length)setTimeout(()=>startNextQueued(id),0);
    if (arrived) all({ type: 'delivery_arrived' });
    homeTasks.recheckAccess();
    if (billingMessages.length) {
      all({ type: 'billing_event', messages: billingMessages });
      homeTasks.recheckAccess();
      for (const [role, task] of running) {
        const reason = taskAccessError(state, task.plan.command);
        if (reason) stopTask(role, reason);
      }
      if (!serviceAvailable(state.billing, 'internet', clockMinutes(state.clock)))
        for (const [role, task] of leisure) if (task.activity === 'computer') stopLeisure(role);
    }
    for (const done of next.completed) all({type:'job_event',role:done.role,outcome:'finished',message:done.message});
    return true;
  };
  const reapFinishedWalks = (now: number): void => {
    for(const [role,walk] of walkingHome){
      const length=walk.route.path.reduce((distance,point,index)=>{
        const prev=walk.route.path[index-1]??walk.route.from;
        return distance+Math.hypot(point.x-prev.x,point.z-prev.z);
      },0);
      // Leave a small grace period for mobile animation interpolation.
      const arrival=walk.started+length/HOME_WALK_SPEED*1000;
      if(now>=arrival+700){
        walkingHome.delete(role);
        lastIntent.set(role,Math.max(lastIntent.get(role)??0,arrival));
      }
    }
  };
  const lifeTicker = setInterval(() => {
    if (isPaused) return;
    reapFinishedWalks(pauseTimers.now());
    if (!commitLife()) return;
    const now = pauseTimers.now();
    const available: CharacterId[] = [];
    const legacyIdle: CharacterId[] = [];
    for (const [role, socket] of active) {
      const mode=state.autonomy[role];
      // Offline players, manual tasks, work, sleep, travelling and interactive
      // storage sessions are never taken over by the automatic decision engine.
      if(state.world.places[role]!=='home'||!inHomeGrounds(state.characters[role])||sleepers.has(role)||
        running.has(role)||homeTasks.busy(role)||(queuedTasks.get(role)?.length??0)>0||state.activeShifts[role]||
        state.careers.residents[role].shift||storageOpen.has(role)||
        walkingHome.has(role)||
        now-(lastIntent.get(role)??now)<(mode==='off'?legacyIdleMs:idleAutonomyMs))continue;
      // Off means the exact existing 0.16 background routine, not a frozen
      // resident: rare idle walks and rescue only when a vital need reaches 8%.
      if(mode==='off'){
        const oldCommand=now-(lastAutoCare.get(role)??0)>=
          (options.autonomyTiming?.careCooldownMs??70_000)&&urgentHomeAction(state,role);
        const oldPlan=oldCommand&&planTask(oldCommand);
        if(oldPlan&&!taskAccessError(state,oldPlan.command)&&
          ![...running.values()].some(task=>oldPlan.resource&&task.plan.resource===oldPlan.resource)){
          stopLeisure(role);
          lastAutoCare.set(role,now);
          beginTask(role,socket,oldPlan,true);
        }else if(!leisure.has(role))legacyIdle.push(role);
        continue;
      }
      // Real sleep uses the existing bed-reservation and time-control system,
      // including bought beds. Never lie down on a sold invisible starter bed.
      const resident=state.characters[role];
      const energyMostUrgent=resident.energy<=Math.min(
        resident.bladder,resident.hunger,resident.hygiene);
      if(resident.energy<=50&&energyMostUrgent){
        const chosen=selectSleepBed(state,role);
        if(chosen.ok){
          stopLeisure(role);
          const next=structuredClone(state);
          const sleepMode:SleepMode='full';
          Object.assign(next.characters[role],chosen.bed.approach,
            {pose:'sleep',sleepingOn:chosen.bed.id,sleepMode});
          next.revision++;
          try{
            files.save(next);
            state=next;
            sleepers.set(role,sleepMode);
            autoSleeping.add(role);
            lastAutoCare.set(role,now);
            all({type:'snapshot',state});
            announceTime();
            continue;
          }catch(error){console.error('Autonomous sleep could not be saved:',error);}
        }
      }
      let started=false;
      const mostCritical=Math.min(...(['bladder','hunger','energy','hygiene'] as const)
        .map(need=>state.characters[role][need]));
      if(now-(lastAutoCare.get(role)??0)>=careCooldownMs||mostCritical<=15){
        for(const candidate of autonomyCandidates(state,role)){
          const plan=planTask(candidate.command);
          if(!plan||taskAccessError(state,plan.command))continue;
          if((plan.resource&&homeTasks.reserved(plan.resource))||
            [...running.values()].some(task=>plan.resource&&task.plan.resource===plan.resource))continue;
          if(!evaluateTask(state,role,plan.command).ok)continue;
          stopLeisure(role);
          beginTask(role,socket,plan,true);
          if(!running.has(role)&&!homeTasks.busy(role))continue;
          lastAutoCare.set(role,now);
          started=true;
          break;
        }
      }
      if(started||mode==='needs')continue;
      if(!leisure.has(role)&&now-(lastAutoCare.get(role)??0)>=leisureCooldownMs) {
        if(mode==='full'){
          // Alternate ordinary household chores with leisure: without this
          // both residents could only repeat TV/computer/pet interactions.
          const turn=fullRoutineTurn.get(role)??0;
          fullRoutineTurn.set(role,turn+1);
          // Keep a short natural chat window from being consumed by a new
          // solo chore. Critical needs still execute before this block.
          const partner=otherRole(role);
          const sharedWindow=active.has(partner)&&state.autonomy[partner]==='full'&&
            Math.floor(clockMinutes(state.clock)/125)%3===0;
          if(turn%3===2&&!sharedWindow){
            for(const command of fullLeisureCandidates(state,role,Math.floor(turn/3))){
              const plan=planTask(command);
              if(!plan||taskAccessError(state,plan.command)||
                plan.resource&&(homeTasks.reserved(plan.resource)||[...running.values()].some(t=>t.plan.resource===plan.resource))||
                !evaluateTask(state,role,plan.command).ok)continue;
              beginTask(role,socket,plan,true);
              if(!running.has(role)&&!homeTasks.busy(role))continue;
              lastAutoCare.set(role,now);started=true;break;
            }
          }
          if(turn%3===1&&!sharedWindow){
            const recent=recentHomeHabits.get(role)??[];
            const chores=homeHabitCommands(state,role,Math.floor(turn/3),recent);
            for(const {habit,command} of chores){
              const plan=planTask(command);
              if(!plan || taskAccessError(state,plan.command) ||
                  plan.resource && (homeTasks.reserved(plan.resource) ||
                    [...running.values()].some(t=>t.plan.resource===plan.resource)))continue;
              if(!evaluateTask(state,role,plan.command).ok)continue;
              beginTask(role,socket,plan,true);
              if(!running.has(role)&&!homeTasks.busy(role))continue;
              lastAutoCare.set(role,now);
              // Remember *started* work, not an unavailable suggestion.
              recentHomeHabits.set(role,[...recent.filter(id=>id!==habit),habit].slice(-3));
              started=true;
              break;
            }
          }
        }
        if(!started)available.push(role);
      }
    }
    // Keep the original 0.16 idle entertainment in OFF mode as well. The
    // expanded planner must not replace it or invent new obligations.
    if(legacyIdle.length){
      const oldOptions:HomeLeisure[]=['tv','computer','simba'];
      if(!serviceAvailable(state.billing,'internet',clockMinutes(state.clock)))
        oldOptions.splice(oldOptions.indexOf('computer'),1);
      if(!state.world.dogWalker)oldOptions.push('verdell');
      const oldChoices=oldOptions.filter(activity=>
        ![...leisure.values()].some(current=>current.activity===activity)&&
        !(activity==='computer'&&Object.values(state.activeShifts).some(s=>s?.homeDevice==='desktop'))&&
        !homeTasks.reserved(activity==='tv'?'tv':activity==='computer'?'desk':'pet:'+activity)&&
        ![...running.values()].some(task=>task.plan.resource===
          (activity==='computer'?'desk':'pet:'+activity)));
      const activity=oldChoices[Math.floor(Math.random()*oldChoices.length)];
      if(activity){
        const role=legacyIdle[Math.floor(Math.random()*legacyIdle.length)];
        const route=planLeisure(state,role,activity);
        if(route){
          if(activity==='verdell'||activity==='simba'){
            pausePetRoutine(state,activity,liveGameTime());
            state.revision++;
            all({type:'snapshot',state});
          }
          leisure.set(role,{activity,startedAt:now,until:now+leisureDurationMs(route),route});
          all({type:'home_leisure',roles:[role],activity,routes:{[role]:route}});
        }
      }
    }
    if(!available.length)return;
    // A full-autonomy pair may become idle on adjacent 20ms ticks because
    // their login/manual-intent timestamps differ. Without a short pairing
    // grace the first player starts a 20-second solo activity and the shared
    // chat never happens. Wait only when the other FULL-mode player is
    // physically at home, unoccupied and about to clear their idle timer;
    // never commandeer a busy or manually controlled resident.
    if(available.length===1&&state.autonomy[available[0]]==='full'&&
        Math.floor(clockMinutes(state.clock)/125)%3===0){
      const other=otherRole(available[0]);
      const age=now-(lastIntent.get(other)??now);
      const otherIdleThreshold=idleAutonomyMs;
      if(active.has(other)&&state.autonomy[other]==='full'&&
          state.world.places[other]==='home'&&inHomeGrounds(state.characters[other])&&
          !sleepers.has(other)&&!running.has(other)&&!homeTasks.busy(other)&&
          (queuedTasks.get(other)?.length??0)===0&&!state.activeShifts[other]&&
          !state.careers.residents[other].shift&&!walkingHome.has(other)&&
          !storageOpen.has(other)&&!leisure.has(other)&&
          (age>=0&&age<otherIdleThreshold ||
           now-(lastAutoCare.get(other)??0)<leisureCooldownMs &&
           leisureCooldownMs-(now-(lastAutoCare.get(other)??0))<=3000)){
        return;
      }
    }
    // Only two idle residents who explicitly opted into FULL autonomy may
    // perform a shared spontaneous chat; neither character is commandeered
    // from manual control, study, sleep or any other task.
    if(available.length===2&&available.every(role=>state.autonomy[role]==='full')&&
        Math.floor(clockMinutes(state.clock)/125)%3===0){
      const routes:Partial<Record<CharacterId,WalkRoute>>={};
      for(const role of available){
        const route=planLeisure(state,role,'chat');
        if(!route)return;
        routes[role]=route;
      }
      const chatUntil=now+Math.max(...available.map(role=>leisureDurationMs(routes[role]!)));
      for(const role of available){
        leisure.set(role,{activity:'chat',startedAt:now,until:chatUntil,route:routes[role]!});
        lastAutoCare.set(role,now);
      }
      all({type:'home_leisure',roles:available,activity:'chat',routes});
      return;
    }
    for(const role of available){
      const preferences:HomeLeisure[]=role==='vlad'?['computer','tv','verdell','simba']
        : ['simba','tv','verdell','computer'];
      const start=Math.floor(clockMinutes(state.clock)/135)%preferences.length;
      const rotated=preferences.map((_,index)=>preferences[(start+index)%preferences.length]);
      const recent=recentLeisure.get(role);
      // Try a different activity first; reuse the previous one only when
      // another entertainment option has no reachable route or is occupied.
      const ordered=[...rotated.filter(activity=>activity!==recent),
        ...rotated.filter(activity=>activity===recent)];
      for(const activity of ordered){
        if(activity==='computer'&&(!serviceAvailable(state.billing,'internet',clockMinutes(state.clock))||Object.values(state.activeShifts).some(s=>s?.homeDevice==='desktop')))continue;
        if(activity==='verdell'&&state.world.dogWalker)continue;
        const resource=activity==='tv'?'tv':activity==='computer'?'desk':'pet:'+activity;
        if([...leisure.values()].some(current=>current.activity===activity)||
           homeTasks.reserved(resource)||
           [...running.values()].some(task=>task.plan.resource===resource))continue;
        const route=planLeisure(state,role,activity);
        if(!route)continue;
        if(activity==='verdell'||activity==='simba'){
          pausePetRoutine(state,activity,liveGameTime());
          state.revision++;
          all({type:'snapshot',state});
        }
        leisure.set(role,{activity,startedAt:now,until:now+leisureDurationMs(route),route});
        recentLeisure.set(role,activity);
        lastAutoCare.set(role,now);
        all({type:'home_leisure',roles:[role],activity,routes:{[role]:route}});
        break;
      }
    }
  }, options.lifeClock?.tickMs ?? 4000);
  lifeTicker.unref();
  const stopTask = (role: CharacterId, reason: string): void => {
    if (homeTasks.cancel(role, reason)) return;
    const task = running.get(role);
    if (!task) return;
    pauseTimers.clear(task.timer);
    running.delete(role);
    if(task.plan.command.type==='pet_action'&&task.plan.command.action==='bathe'){pausePetRoutine(state,'verdell',liveGameTime());state.revision++;all({type:'snapshot',state});}
    all({ type: 'task_ended', role, taskId: task.id, outcome: 'cancelled', message: reason });
  };
  function catReserved(site:CatPerch):boolean {
    if(homeTasks.blocksCat(site))return true;
    for(const [role,routine] of leisure)if(routine.activity==='tv'){
      if(site.key==='starter:sofa'&&catSeatOverlap(site,site.key,homeSeat('sofa',role).position))return true;
      if(site.key.startsWith('placed:')&&Math.hypot((routine.route.path.at(-1)??routine.route.from).x-site.approach.x,(routine.route.path.at(-1)??routine.route.from).z-site.approach.z)<1.6)return true;
    }
    return [...running.values()].some(t=>t.plan.command.type==='act'&&['bedSleep','bedNap','bedMake','bedStretch'].includes(t.plan.command.actionId)&&site.key==='starter:bed');
  }
  const beginTask = (role: CharacterId, socket: WebSocket, plan: TaskPlan, automatic = false): void => {
    if (usesHomeSession(plan.command)) {
      homeTasks.start([role], plan, socket, automatic);
      return;
    }
    if (state.activeShifts[role] || running.has(role) || homeTasks.busy(role)) {
      packet(socket, { type: 'error', reason: 'Персонаж занят. Сначала заверши или отмени текущее действие' });
      return;
    }
    walkingHome.delete(role);
    if(plan.resource && state.activeShifts[otherRole(role)]?.homeDevice && computerResource(state.activeShifts[otherRole(role)]!.homeDevice!)===plan.resource){packet(socket,{type:"error",reason:"Компьютер занят домашним заказом"});return;}
    const bath=plan.command.type==='pet_action'&&plan.command.action==='bathe';
    const dogCare=plan.command.type==='pet_action'&&plan.command.pet==='verdell';
    if(dogCare&&([...running.values()].some(t=>t.plan.command.type==='pet_action'&&t.plan.command.pet==='verdell'&&(bath||t.plan.command.action==='bathe'))||bath&&homeTasks.reserved('pet:verdell'))){packet(socket,{type:'error',reason:'Верделл сейчас занят'});return;}
    const occupied = plan.resource && [...running.values()].find(task => task.plan.resource === plan.resource);
    if ((plan.resource && homeTasks.reserved(plan.resource)) || (plan.command.type==='local_activity'&&
        plan.command.action==='unpack'&&homeTasks.reserved('shopping'))) {
      if (!automatic) packet(socket, { type: 'error', reason: 'Это место сейчас занято вторым игроком' });
      return;
    }
    if (occupied && (automatic || !occupied.automatic)) {
      packet(socket, { type: 'error', reason: 'Это место сейчас занято вторым игроком' });
      return;
    }
    const validation = evaluateTask(state, role, plan.command);
    if (!validation.ok) { packet(socket, { type: 'error', reason: validation.reason }); return; }
    if (occupied) stopTask(occupied.role, 'Место освободилось для игрока');
    for (const [resident, routine] of leisure) {
      const resource = routine.activity === 'computer' ? 'desk' : 'pet:' + routine.activity;
      if (resource === plan.resource) stopLeisure(resident);
    }
    // Filling the bowl must not interrupt a pet that is walking to eat.
    if (plan.command.type === 'pet_action' && plan.command.action !== 'feed' && plan.command.action !== 'loadFeeder' &&
        state.pets[plan.command.pet].routine) {
      pausePetRoutine(state, plan.command.pet, liveGameTime());
      state.revision++;
      all({ type: 'snapshot', state });
    }
    // A long walk through the room must not consume the entire activity timer.
    // This estimates travel conservatively without calculating a second path.
    const destination = plan.command.type === 'local_activity'
      ? approachFor(stationById(state.world.places[role], plan.command.station)!, role)
      : plan.command.type === 'act' ? plan.command.actionId in KITCHEN_ACTIONS
        ? KITCHEN_WORK[KITCHEN_ACTIONS[plan.command.actionId as keyof typeof KITCHEN_ACTIONS]].position
        : plan.command.computer === 'laptop' && ACTIONS[plan.command.actionId].item === 'desk'
          ? laptopApproach(state,role) : points[ACTIONS[plan.command.actionId].item]
      : plan.command.type === 'play_game' || plan.command.type === 'computer_video'
        ? plan.command.device === 'laptop' ? laptopApproach(state,role) : points.desk
      : plan.command.type === 'brew_coffee' ? KITCHEN_WORK.coffee.position
      : plan.command.type === 'pet_action' ? petCarePoint(state, plan.command.pet, plan.command.action,role) ?? state.characters[role]
        : plan.command.type === 'cook' ? points.kitchen
        : homeSeat('table', role).approach;
    const position = state.characters[role];
    const travelBudgetMs = Math.round(Math.hypot(position.x - destination.x,
      position.z - destination.z) * 1200 + 4200);
    const cookBudget = plan.command.type === 'cook' ? 19_000 : 0;
    // Dishwashing makes an actual collection trip past the dirty tables and
    // back to the kitchen. Never end the timer before the actor reaches sink.
    const dishStops = plan.command.type === 'act' && plan.command.actionId === 'kitchenDishes'
      ? dirtyDishStops(state.dirtyDishes, role) : [];
    const dishPath = [position, ...dishStops, KITCHEN_WORK.dishes.position];
    const dishDistance = dishPath.slice(1).reduce((sum, p, index) => {
      const prev = dishPath[index];
      return sum + Math.hypot(p.x - prev.x, p.z - prev.z);
    }, 0);
    const dishBudget = dishStops.length
      ? Math.round(dishDistance / HOME_WALK_SPEED * 1000 + dishStops.length * 1500 + 8500) : 0;
    const personalCare = plan.command.type === 'act' && Object.hasOwn(BATH_ACTIONS, plan.command.actionId);
    const bathRoute=bath?dogBathPlan(state,role):null;
    if(bath&&!bathRoute){packet(socket,{type:'error',reason:'Нет свободного подхода к ванной'});return;}
    const duration = bathRoute?plan.durationMs+bathRoute.travelMs+5000:personalCare ? plan.durationMs + travelBudgetMs
      : Math.max(plan.durationMs, travelBudgetMs, cookBudget, dishBudget);
    const durationMs = Math.max(15, Math.round(duration * scale));
    const id = ++nextTaskId;
    const wish=automatic?undefined:wishAtStart(state,role,plan.command);
    const timer = pauseTimers.schedule(() => {
      const current = running.get(role);
      if (!current || current.id !== id || active.get(role) !== socket) return;
      running.delete(role);
      // Revalidate against the freshest household snapshot, so two simultaneous
      // players cannot create food, rewards or inventory from stale resources.
      const result = evaluateTask(state, role, plan.command);
      if (!result.ok) {
        if(bath){pausePetRoutine(state,'verdell',liveGameTime());state.revision++;all({type:'snapshot',state});}
        all({ type: 'task_ended', role, taskId: id, outcome: 'failed', message: result.reason });
        return;
      }
      // Cooking is real practice even when initiated by household autonomy.
      if (!automatic || plan.command.type==='cook')
        awardActivity(result.state, role, plan.command, plan.label);
      if(plan.command.type==='cook'){
        const earned=result.state.education.characters[role].xp.cooking -
          state.education.characters[role].xp.cooking;
        if(earned>0)result.message+=' · 🍲 Кулинария +'+earned+' XP';
      }
      result.message+=fulfillWish(result.state,role,wish,state);
      try { files.save(result.state); }
      catch (error) {
        console.error('Could not persist completed task:', error);
        all({ type: 'task_ended', role, taskId: id, outcome: 'failed', message: 'Не удалось сохранить результат' });
        return;
      }
      const effects = gains(state,result.state,role);
      state = result.state;
      lastAction.set(role, pauseTimers.now());
      all({ type: 'task_ended', role, taskId: id, outcome: 'completed', message: result.message, effects });
      if (plan.command.type === 'local_activity') {
        all({ type: 'world_event', role, message: result.message });
      } else if (plan.command.type === 'act') {
        all({ type: 'action', role, actionId: plan.command.actionId, message: result.message });
      } else if (plan.command.type === 'pet_action') {
        all({ type: 'pet_event', role, pet: plan.command.pet, action: plan.command.action, message: result.message });
      } else if (plan.command.type === 'cook' || plan.command.type === 'eat' || plan.command.type === 'eat_takeout') {
        all({ type: 'food_event', role, action: plan.command.type === 'eat_takeout' ? 'eat' : plan.command.type, message: result.message });
      }
      all({ type: 'snapshot', state });
    }, durationMs);
    running.set(role, { id, role, plan, timer, automatic });
    if(bathRoute){const now=Math.floor(liveGameTime());state.pets.verdell.routine={kind:'bath',target:0,startedAt:now,until:now+Math.ceil(durationMs/1000*GAME_MINUTES_PER_REAL_SECOND)+2,goal:bathRoute.goal,route:bathRoute.route};state.revision++;all({type:'snapshot',state});}
    all({ type: 'task_started', role, taskId: id, label: plan.label,
      durationMs, command: plan.command, automatic, effects: gains(state,validation.state,role) });
  };
  /** Sleep is an authentic, long-running action: the next queued command
   * waits for recovery or explicit waking, just like other completed tasks. */
  function startSleepRequest(role:CharacterId,socket:WebSocket,
      command:{mode:SleepMode;furnitureId?:number}):void {
    if(state.world.places[role]!=='home'||state.activeShifts[role]||state.careers.residents[role].shift||
        (running.has(role)&&!running.get(role)?.automatic)||
        (homeTasks.busy(role)&&!homeTasks.automatic(role))){
      packet(socket,{type:'error',reason:'Для сна нужно находиться дома и закончить текущее дело'});return;
    }
    if(state.characters[role].energy>=sleepTarget(command.mode)){
      packet(socket,{type:'error',reason:'Энергия уже достигла выбранной отметки'});return;
    }
    const requestedBed=command.furnitureId;
    const chosen=selectSleepBed(state,role,requestedBed);
    if(!chosen.ok){packet(socket,{type:'error',reason:chosen.reason});return;}
    closeStorage(role);
    stopLeisure(role);
    if(running.get(role)?.automatic||homeTasks.automatic(role))stopTask(role,'Время спать');
    const next=structuredClone(state);
    Object.assign(next.characters[role],chosen.bed.approach,
      {pose:'sleep',sleepingOn:chosen.bed.id,sleepMode:command.mode});
    next.revision++;
    try{files.save(next)}
    catch{packet(socket,{type:'error',reason:'Не удалось сохранить начало сна'});return;}
    accountTime();
    state=next;
    sleepers.set(role,command.mode);
    const wish=wishAtStart(state,role,{type:'sleep_start',mode:command.mode});
    if(wish)sleepWishes.set(role,wish);
    autoSleeping.delete(role);
    shiftVotes.delete(role);
    lastIntent.set(role,pauseTimers.now());
    all({type:'snapshot',state});
    announceTime();
  }
  function startNextQueued(role: CharacterId): void {
    if (isPaused) return;
    if(running.has(role)||homeTasks.busy(role)||sleepers.has(role))return;
    const tasks=queuedTasks.get(role);
    if(!tasks?.length)return;
    const socket=active.get(role);
    const candidate=tasks[0];
    if(!socket||(state.world.places[role]!=='home'&&
        candidate.plan?.command.type!=='local_activity')||
        state.activeShifts[role]||state.careers.residents[role].shift){
      clearQueue(role);return;
    }
    const next=tasks.shift()!;
    if(!tasks.length)queuedTasks.delete(role);
    publishQueue(role);
    if(next.sleep)startSleepRequest(role,socket,next.sleep);
    else if(next.plan)beginTask(role,socket,next.plan);
    // Invalid or stale queued work never strands later valid requests.
    if(!running.has(role)&&!homeTasks.busy(role)&&!sleepers.has(role)&&
        (queuedTasks.get(role)?.length??0)>0)
      setTimeout(()=>startNextQueued(role),0);
  }
  function queueAction(role:CharacterId,socket:WebSocket,
    item:Omit<QueuedEntry,'id'>):boolean {
    const busy=running.has(role)||homeTasks.busy(role)||sleepers.has(role);
    const tasks=queuedTasks.get(role)??[];
    if(!busy&&!tasks.length)return false;
    if(tasks.length>= (busy?2:3)){
      packet(socket,{type:'error',reason:'Очередь заполнена: максимум 3 действия вместе с текущим'});
      return true;
    }
    tasks.push({id:++nextQueueId,...item});
    queuedTasks.set(role,tasks);
    lastIntent.set(role,pauseTimers.now());
    publishQueue(role);
    if(!busy)setTimeout(()=>startNextQueued(role),0);
    return true;
  }
  function submitTimed(role:CharacterId,socket:WebSocket,plan:TaskPlan):void {
    if(!queueAction(role,socket,{plan,label:plan.label}))beginTask(role,socket,plan);
  }

  const httpServer = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end(); return;
    }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }

    if (pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, version: 2, online: online().length,
        testNoCodes:previewNoCodes, paused:isPaused }));
      return;
    }
    if (pathname.includes('\\') || pathname.includes('\0')) {
      res.writeHead(400); res.end(); return;
    }
    const route = pathname === '/' || !extname(pathname) ? '/index.html' : pathname;
    const requested = resolve(distDir, '.' + route);
    const rel = relative(distDir, requested);
    if (rel.startsWith('..') || isAbsolute(rel)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(requested) || !statSync(requested).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found. Run npm run build first.'); return;
    }
    const content = readFileSync(requested);
    res.writeHead(200, {
      'content-type': types[extname(requested)] ?? 'application/octet-stream',
      'cache-control': extname(requested) === '.html' ? 'no-store' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end(); else res.end(content);
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      const tracked = socket as WebSocket & { isAlive?: boolean };
      if (tracked.isAlive === false) { socket.terminate(); continue; }
      tracked.isAlive = false;
      socket.ping();
    }
  }, 15000);
  heartbeat.unref();
  httpServer.on('upgrade', (req, socket, head) => {
    let url: URL;
    try { url = new URL(req.url ?? '', 'http://localhost'); }
    catch { socket.destroy(); return; }
    if (url.pathname !== '/sync') { socket.destroy(); return; }
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) { socket.destroy(); return; }
      } catch { socket.destroy(); return; }
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (socket: WebSocket) => {
    const tracked = socket as WebSocket & { isAlive?: boolean };
    tracked.isAlive = true;
    socket.on('pong', () => { tracked.isAlive = true; });
    let role: CharacterId | null = null;
    let invalidLogins = 0;
    let deviceToken: string | null = null;
    socket.on('message', (raw: RawData, isBinary: boolean) => {
      if (isBinary) { socket.close(1003, 'JSON only'); return; }
      let input: unknown;
      try { input = JSON.parse(raw.toString()); }
      catch { packet(socket, { type: 'error', reason: 'Повреждённое сообщение' }); return; }
      if (!input || typeof input !== 'object' || !('type' in input)) return;
      const message = input as Record<string, unknown>;

      if (!role) {
        if ((message.type !== 'auth' && message.type !== 'resume') ||
            (message.role !== 'vlad' && message.role !== 'alina')) {
          packet(socket, { type: 'error', reason: 'Нужна авторизация персонажа' }); return;
        }
        const requested = message.role;
        const valid = message.type === 'resume'
          ? devices.verify(requested, message.token)
          : typeof message.code === 'string' &&
            (previewNoCodes&&message.code==='TEST-LOCAL-NO-CODES'||sameCode(message.code, files.access[requested]));
        if (!valid) {
          invalidLogins++;
          packet(socket, { type: 'error', reason: message.type === 'resume'
            ? 'Доверие устройства истекло. Введи код доступа' : 'Неверный код доступа' });
          if (invalidLogins >= 5) socket.close(1008, 'Too many invalid logins');
          return;
        }
        if (active.has(requested)) {
          packet(socket, { type: 'error', reason: 'Этот персонаж уже занят на другом устройстве' });
          return;
        }
        if (message.type === 'resume') deviceToken = message.token as string;
        if (message.type === 'auth' && message.remember === true) {
          try { deviceToken = devices.issue(requested); }
          catch { packet(socket, { type: 'error', reason: 'Не удалось запомнить устройство. Войди без этой опции' }); return; }
        }
        role = requested;
        if (active.size === 0) lastLifeTick = lifeNow();
        else accountTime();
        active.set(role, socket);
        lastIntent.set(role, pauseTimers.now());
        packet(socket, { type: 'ready', role, state, online: online() });
        if (state.world.places[role] === 'home') sendLeisure(socket);
        homeTasks.replay(socket);
        for(const id of ['vlad','alina'] as const)packet(socket,queueSnapshot(id));
        announceTime();
        if (deviceToken && message.type === 'auth') packet(socket, { type: 'device_token', role, token: deviceToken });
        all({ type: 'online', online: online() });
        return;
      }

      if (message.type === 'pause_toggle') {
        if (isPaused) { setPaused(false); return; }
        if (pauseRequestedBy === role) { clearPauseRequest(); announceTime(); return; }
        if (pauseRequestedBy) { packet(socket,{type:'error',reason:'Другой игрок уже запросил паузу'}); return; }
        if (online().length === 1) { setPaused(true); return; }
        pauseRequestedBy = role;
        pauseVoteTimer = setTimeout(() => {
          clearPauseRequest();
          announceTime();
        }, 25000);
        announceTime();
        return;
      }
      if (message.type === 'pause_reply') {
        if (!pauseRequestedBy || pauseRequestedBy === role || typeof message.accept !== 'boolean') {
          packet(socket,{type:'error',reason:'Нет запроса паузы, ожидающего твоего ответа'});return;
        }
        if (message.accept) setPaused(true);
        else {clearPauseRequest();announceTime();}
        return;
      }
      if (isPaused) {
        packet(socket,{type:'error',reason:'Игра на паузе. Для продолжения нажми ▶'});
        return;
      }
      if(message.type==='happiness_buy'||message.type==='happiness_activate'){
        if(message.type==='happiness_activate'&&sleepers.has(role)&&message.reward==='energy'){packet(socket,{type:'error',reason:'Сначала разбуди персонажа'});return;}
        const result=rewardCommand(state,role,message.type,message.reward);
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        try{files.save(result.state);}catch{packet(socket,{type:'error',reason:'Не удалось сохранить награду'});return;}
        state=result.state;all({type:'snapshot',state});packet(socket,{type:'world_event',role,message:result.message});return;
      }
      if(message.type==='simba_yield'){
        if(typeof message.key!=='string')return;
        const result=yieldSimbaFurniture(state,role,message.key,liveGameTime());
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        if(result.state!==state){
          try{files.save(result.state);}catch{packet(socket,{type:'error',reason:'Не удалось освободить мебель'});return;}
          state=result.state;
          all({type:'snapshot',state});
          const release=state.pets.simba.furnitureYield!;
          // The rig's descent takes .88s; a short pause-aware grace period
          // keeps both clients clear without waiting for the 10s life tick.
          pauseTimers.schedule(()=>{
            const current=state.pets.simba.furnitureYield;
            if(!current||current.clearAt!==release.clearAt||current.perch.key!==release.perch.key)return;
            const next=structuredClone(state);
            next.pets.simba.furnitureYield!.clearAt=clockMinutes(next.clock);
            next.revision++;
            try{files.save(next);state=next;all({type:'snapshot',state});}
            catch(error){console.error('Could not save furniture release:',error);}
          },1700);
        }
        return;
      }
      if (message.type === 'autonomy_mode') {
        if (typeof message.mode !== 'string' || !AUTONOMY_MODES.includes(message.mode as typeof AUTONOMY_MODES[number])) {
          packet(socket,{type:'error',reason:'Неизвестный режим самостоятельности'});return;
        }
        if (state.autonomy[role] !== message.mode) {
          const previousMode=state.autonomy[role];
          const next=structuredClone(state);
          next.autonomy[role]=message.mode as typeof AUTONOMY_MODES[number];
          next.revision++;
          try {files.save(next);}catch{packet(socket,{type:'error',reason:'Не удалось сохранить режим самостоятельности'});return;}
          state=next;
          // The owner regains control immediately, even if the character was
          // in the middle of a previous autonomous chore or an idle walk.
          if(message.mode==='off'||(previousMode==='full'&&message.mode==='needs')) {
            // Dropping FULL must also stop full-only leisure and chats, while
            // preserving manual tasks and an already ongoing restorative sleep.
            if(message.mode==='off'&&autoSleeping.has(role))stopSleep(role);
            stopLeisure(role);
            if(running.get(role)?.automatic)stopTask(role,'Режим самостоятельности изменён');
            if(homeTasks.automatic(role))homeTasks.cancel(role,'Режим самостоятельности изменён');
          }
          lastIntent.set(role,pauseTimers.now()-idleAutonomyMs);
          lastAutoCare.set(role,0);
          all({type:'snapshot',state});
        }
        return;
      }
      if (message.type === 'shift_speed') {
        if (typeof message.enabled !== 'boolean') {
          packet(socket, { type: 'error', reason: 'Неверный режим скорости' }); return;
        }
        if (!Object.values(state.activeShifts).some(Boolean) && !Object.values(state.careers.residents).some(person => person.shift)) {
          packet(socket, { type: 'error', reason: 'Сейчас нет активной смены' }); return;
        }
        accountTime();
        if (message.enabled) shiftVotes.add(role); else shiftVotes.delete(role);
        announceTime();
        return;
      }
      if (message.type === 'sleep_start') {
        if(message.mode!=='full'&&message.mode!=='half'){
          packet(socket,{type:'error',reason:'Неизвестная длительность сна'});return;
        }
        const requested=message.furnitureId===undefined?undefined:
          typeof message.furnitureId==='number'?message.furnitureId:NaN;
        const command={mode:message.mode as SleepMode,furnitureId:requested};
        if(!queueAction(role,socket,{sleep:command,label:command.mode==='full'?'😴 Полноценный сон':'😴 Вздремнуть'}))
          startSleepRequest(role,socket,command);
        return;
      }
      if (message.type === 'sleep_stop') {
        if (!sleepers.has(role)) { packet(socket, { type: 'error', reason: 'Персонаж не спит' }); return; }
        stopSleep(role);
        lastIntent.set(role, pauseTimers.now());
        return;
      }
      if (message.type === 'forget_device') {
        try { if (deviceToken) devices.revoke(deviceToken); }
        catch { packet(socket, { type: 'error', reason: 'Не удалось забыть устройство' }); return; }
        deviceToken = null;
        socket.close(1000, 'Signed out');
        return;
      }
      if (typeof message.type==='string'&&['social_propose','social_reply','social_withdraw','social_finish'].includes(message.type)) {
        homeTasks.social(role,socket,message); return;
      }
      if (message.type==='social_offer') {
        homeTasks.social(role,socket,{type:'social_propose',action:message.kind==='hug'?'softHug':message.kind});return;
      }
      if (message.type === 'close_storage') {
        closeStorage(role);
        lastIntent.set(role, pauseTimers.now());
        return;
      }
      const careerShift = state.careers.residents[role].shift;
      if (typeof message.type === 'string' && careerCommands.has(message.type)) {
        commitLife();
        const time = Math.floor(liveGameTime());
        const occupied = running.has(role) || homeTasks.busy(role) || sleepers.has(role);
        if (message.type === 'career_start' && !occupied) { closeStorage(role); stopLeisure(role); }
        if(message.type==='career_approach'&&careerShift?.mode==='remote'&&state.activeShifts[otherRole(role)]?.homeDevice===(message.device??'laptop')){packet(socket,{type:'error',reason:'Компьютер занят домашним заказом'});return;}
        const result = applyCareer(state, role, message, time, occupied, active.has(otherRole(role)));
        if (!result.ok) { packet(socket,{type:'error',reason:result.reason}); return; }
        if (message.type === 'career_start' && result.state.world.dogWalker === role) {
          result.state.world.dogWalker = null;
          setDogParkPosition(result.state);
        }
        const billingMessages = settleFamilyServices(result.state, result.state.money > state.money);
        try { files.save(result.state); }
        catch { packet(socket,{type:'error',reason:'Не удалось сохранить рабочее действие'}); return; }
        state = result.state;
        if (message.type === 'career_start' || message.type === 'career_leave') {
          walkingHome.delete(role);
          shiftVotes.clear();
          announceTime();
        }
        lastIntent.set(role,pauseTimers.now());
        all({type:'snapshot',state});
        if (result.path) all({type:'world_path',place:state.world.places[role],role,path:result.path});
        packet(socket,{type:'world_event',role,message:result.message});
        if (billingMessages.length) all({type:'billing_event',messages:billingMessages});
        return;
      }
      if (careerShift && message.type !== 'walk' && !['service_connect','service_renewal','service_pay','budget_deposit','budget_withdraw','budget_goal','budget_limit','education_goal'].includes(String(message.type))) {
        packet(socket,{type:'error',reason:'Заверши рабочую смену через приложение «Работа и карьера»'});
        return;
      }
      if (message.type === 'computer_favorite') {
        const result=changeComputerFavorite(state,role,message.game,message.enabled);
        if (!result.ok) {packet(socket,{type:'error',reason:result.reason});return;}
        if (result.state!==state) {
          try {files.save(result.state);} catch {packet(socket,{type:'error',reason:'Не удалось сохранить избранное'});return;}
          state=result.state;
          all({type:'snapshot',state});
        }
        lastIntent.set(role,pauseTimers.now());
        return;
      }
      if (message.type === 'education_answer') {
        homeTasks.answer(role, socket, message.taskId, message.choice);
        return;
      }
      if (message.type === 'education_buy' || message.type === 'education_cancel' ||
          message.type === 'education_reschedule' || message.type === 'education_goal') {
        if (message.type !== 'education_goal' && homeTasks.busy(role)) {
          packet(socket, { type: 'error', reason: 'Сначала закончи текущее занятие' }); return;
        }
        const result = applyEducation(state, role, message, Math.floor(liveGameTime()));
        if (!result.ok) { packet(socket, { type: 'error', reason: result.reason }); return; }
        try { files.save(result.state); }
        catch { packet(socket, { type: 'error', reason: 'Не удалось сохранить учебную операцию' }); return; }
        state = result.state;
        all({ type: 'snapshot', state });
        packet(socket, { type: 'education_notice', role, message: result.message });
        return;
      }
      if (message.type==='budget_deposit'||message.type==='budget_withdraw'||
          message.type==='budget_goal'||message.type==='budget_limit'){
        // Transport packets are untrusted: the budget handler checks types,
        // bounds, ownership and funds before touching household state.
        const result=applyBudgetCommand(state,role,
          message as unknown as import('../src/shared/familyBudget').BudgetCommand);
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        try{files.save(result.state);}
        catch{packet(socket,{type:'error',reason:'Не удалось сохранить семейный бюджет'});return;}
        state=result.state;
        lastIntent.set(role,pauseTimers.now());
        all({type:'snapshot',state});
        all({type:'billing_event',messages:[result.message]});
        return;
      }
      if (message.type === 'service_connect' || message.type === 'service_renewal' || message.type === 'service_pay') {
        const result = applyServiceCommand(state, role, message);
        if (!result.ok) { packet(socket, { type: 'error', reason: result.reason }); return; }
        const retry = message.type === 'service_renewal' && message.enabled === true;
        const messages = [result.message, ...settleFamilyServices(result.state, retry)];
        try { files.save(result.state); }
        catch { packet(socket, { type: 'error', reason: 'Не удалось сохранить платёж' }); return; }
        state = result.state;
        all({ type: 'snapshot', state });
        all({ type: 'billing_event', messages });
        homeTasks.recheckAccess();
        return;
      }
      if (message.type === 'movie_invite' || message.type === 'movie_reply' || message.type === 'movie_withdraw') {
        homeTasks.invitation(role, socket, message);
        return;
      }
      if(message.type==='cancel_queued_task'){
        const tasks=queuedTasks.get(role)??[];
        const index=tasks.findIndex(item=>item.id===message.queueId);
        if(index<0){packet(socket,{type:'error',reason:'Задание уже вышло из очереди'});return;}
        tasks.splice(index,1);
        if(!tasks.length)queuedTasks.delete(role);
        publishQueue(role);
        return;
      }
      if(message.type==='clear_task_queue'){
        clearQueue(role);return;
      }
      if (message.type === 'cancel_task') {
        lastIntent.set(role, pauseTimers.now());
        if (typeof message.taskId === 'number' && homeTasks.cancel(role, names[role] + ': занятие прервано', message.taskId)) return;
        const current = running.get(role);
        if (!current || message.taskId !== current.id) {
          packet(socket, { type: 'error', reason: 'Это действие уже завершено или не существует' });
        } else {
          stopTask(role, names[role] + ': действие прервано');
        }
        return;
      }
      if (typeof message.type==='string' && [
        'furniture_order','furniture_unbox','furniture_place',
        'furniture_move','furniture_store','furniture_sell','furniture_sell_static',
      ].includes(message.type)) {
        // Editing the layout is independent of both residents' actions.
        const moved=typeof message.id==='number'&&['furniture_move','furniture_store','furniture_sell'].includes(message.type)
          ?state.furnishing.placed.find(item=>item.id===message.id):undefined;
        const fixture=message.type==='furniture_sell_static'&&typeof message.fixture==='string'?message.fixture:undefined;
        const spatial=!!moved||!!fixture||message.type==='furniture_place';
        const adding=message.type==='furniture_place'?state.furnishing.stored.find(p=>p.id===message.id):undefined;
        const deskEdit=fixture==='desk'||[moved,adding].some(p=>p&&FURNITURE_BY_ID.get(p.sku)?.shape==='desk');
        if(deskEdit&&(Object.values(state.activeShifts).some(s=>s?.homeDevice)||Object.values(state.careers.residents).some(r=>r.shift?.mode==='remote')||homeTasks.reserved('career-laptop')||homeTasks.reserved('desk')||[...running.values()].some(t=>['career-laptop','desk'].includes(t.plan.resource??'')))){packet(socket,{type:'error',reason:'Нельзя переставлять рабочий стол во время заказа'});return;}
        const before=state;
        const result=applyFurnishing(state,role,message as import('../src/shared/furniture').FurnishingCommand,
          Math.floor(liveGameTime()));
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        try{files.save(result.state);}
        catch{packet(socket,{type:'error',reason:'Не удалось сохранить мебель'});return;}
        state=result.state;
        if(spatial){
          const added=message.type==='furniture_place'||message.type==='furniture_move'
            ?state.furnishing.placed.find(item=>item.id===message.id):undefined;
          const block=layoutBlock(added),now=pauseTimers.now();
          const obstacles=placeObstacles('home',state.furnishing),floor=floorFor('home');
          homeTasks.interruptLayout(block,moved?.id,fixture);
          for(const resident of ['vlad','alina'] as const){
            if(state.world.places[resident]!=='home')continue;
            if(sleepers.has(resident)&&before.characters[resident].pose==='sleep'&&state.characters[resident].pose!=='sleep')stopSleep(resident);
            const task=running.get(resident);
            if(task){
              const c=task.plan.command;
              const direct=moved&&('furnitureId' in c&&c.furnitureId===moved.id||task.plan.resource==='furniture:'+moved.id);
              const crossing=routeHitsLayout({from:before.characters[resident],path:[]},block);
              if(direct||crossing||taskAccessError(state,c))stopTask(resident,'Мебель переставлена — место занятия изменилось');
            }
            const rest=leisure.get(resident);
            if(rest&&(routeHitsLayout(leisureRoute(resident,now),block)||fixture==='sofa'&&rest.activity==='tv'||fixture==='desk'&&rest.activity==='computer'))stopLeisure(resident,now);
          }
          const reroutes:{role:CharacterId;path:import('../src/game/navigation').FloorPoint[];station?:string}[]=[];
          for(const [resident,walk] of walkingHome){
            if(state.world.places[resident]!=='home')continue;
            const remaining=sampleWalk(walk.route,Math.max(0,now-walk.started)/1000*HOME_WALK_SPEED);
            if(!routeHitsLayout(remaining,block))continue;
            const target=remaining.path.at(-1)??remaining.from;
            const replacement=planWalk(remaining.from,target,obstacles,floor);
            if(replacement){
              walkingHome.set(resident,{route:replacement,started:now,station:walk.station});
              Object.assign(state.characters[resident],replacement.path.at(-1)??replacement.from,{pose:'idle'});
              reroutes.push({role:resident,path:[replacement.from,...replacement.path],station:walk.station});
            }else{
              walkingHome.delete(resident);
              Object.assign(state.characters[resident],remaining.from,{pose:'idle'});
            }
          }
          homeTasks.recheckAccess();
          settleLayout(state,added,Math.floor(liveGameTime()));
          try{files.save(state);}catch(error){console.error('Could not checkpoint adjusted furniture routes:',error);}
          all({type:'snapshot',state});
          for(const reroute of reroutes)all({type:'world_path',place:'home',...reroute});
        }else all({type:'snapshot',state});
        lastIntent.set(role,pauseTimers.now());
        all({type:'store_event',role,message:result.message});
        return;
      }
      // A snack handed to a begging pet at the table is a side interaction:
      // keep the owner's 32-second meal running and charge the shared limit once.
      if(message.type==='pet_action'&&message.pet==='verdell'&&[...running.values()].some(t=>t.plan.command.type==='pet_action'&&t.plan.command.action==='bathe')){packet(socket,{type:'error',reason:'Верделл сейчас купается'});return;}
      if(message.type==='pet_action'&&message.action==='treat'&&PET_IDS.some(id=>id===message.pet)){
        const pet=message.pet as PetId,animal=state.pets[pet];
        const ownerEating=homeTasks.diners().has(role)||['eat','eat_takeout'].includes(running.get(role)?.plan.command.type??'');
        if(ownerEating&&state.world.places[role]==='home'&&animal.routine?.kind==='beg'&&animal.routine.target===(role==='vlad'?0:1)){
          if(treatsRemaining(animal,state.clock.day)<=0){packet(socket,{type:'error',reason:'Сегодня уже получены три лакомства'});return;}
          const next=structuredClone(state);
          pausePetRoutine(next,pet,liveGameTime());
          const result=applyPetAction(next,role,pet,'treat');
          if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
          Object.assign(result.state.characters[role],{x:state.characters[role].x,z:state.characters[role].z,pose:state.characters[role].pose});
          try{files.save(result.state);}catch{packet(socket,{type:'error',reason:'Не удалось сохранить лакомство'});return;}
          state=result.state;
          all({type:'snapshot',state});
          all({type:'pet_event',role,pet,action:'treat',message:result.message});
          return;
        }
      }
      const queueable=typeof message.type==='string'&&[
        'play_game','computer_video','study','local_activity','act','furniture_use',
        'brew_coffee','cook','eat','eat_takeout','movie','youtube','free_tv','read_book',
        'pet_action',
      ].includes(message.type)&&!(message.type==='pet_action'&&
        (['buyFood','call','perch','fetch','mat','scratch','toy'].includes(String(message.action))||isTrainingAction(message.action)));
      if(sleepers.has(role)&&queueable){
        const plan=planTask(message);
        if(!plan){packet(socket,{type:'error',reason:'Неизвестное действие'});return;}
        submitTimed(role,socket,plan);
        return;
      }
      // Walking, starting work, using a station or any other manual action wakes the sleeper.
      stopSleep(role);
      lastIntent.set(role, pauseTimers.now());
      closeStorage(role);
      stopLeisure(role);
      if (running.get(role)?.automatic) stopTask(role, 'Управление возвращено игроку');
      if (homeTasks.automatic(role)) homeTasks.cancel(role, 'Управление возвращено игроку');
      if(message.type==='home_job_answer'){
        commitLife();
        const result=answerHomeQuest(state,role,message.nonce,message.choice);
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        try{files.save(result.state);}catch{packet(socket,{type:'error',reason:'Не удалось сохранить ответ'});return;}
        state=result.state;
        all({type:'snapshot',state});
        packet(socket,{type:'world_event',role,message:result.message});
        return;
      }
      if (message.type === 'job_cancel' || message.type === 'job_leave_early') {
        // Legacy job_cancel messages are treated as early departure with fair partial pay.
        accountTime();
        const result=leaveShiftEarly(state,role);
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        const billingMessages = settleFamilyServices(result.state, result.state.money > state.money);
        try{files.save(result.state);}catch{packet(socket,{type:'error',reason:'Не удалось сохранить досрочный уход'});return;}
        state=result.state;
        shiftVotes.clear();
        announceTime();
        all({type:'job_event',role,outcome:'left_early',message:result.message});
        all({type:'snapshot',state});
        if (billingMessages.length) all({type:'billing_event',messages:billingMessages});
        return;
      }
      if ((running.has(role) || homeTasks.busy(role)) && !queueable) {
        packet(socket, { type: 'error', reason: 'Персонаж сейчас занят — заверши или отмени действие' });
        return;
      }
      if(message.type==='dog_leash'&&[...running.values()].some(t=>t.plan.command.type==='pet_action'&&t.plan.command.action==='bathe')){packet(socket,{type:'error',reason:'Верделл сейчас купается'});return;}
      if (typeof message.type === 'string' && worldMessages.has(message.type)) {
        if(message.type==='travel'||message.type==='car_travel'||message.type==='walk')clearQueue(role);
        const interrupted = message.type==='walk'||message.type==='approach' ? walkingHome.get(role) : undefined;
        const travelSource=interrupted?structuredClone(state):state;
        if(interrupted){
          const distance=Math.max(0,pauseTimers.now()-interrupted.started)/1000*HOME_WALK_SPEED;
          Object.assign(travelSource.characters[role],sampleWalk(interrupted.route,distance).from,{pose:'idle'});
        }
        const from = travelSource.characters[role];
        const result = applyWorld(travelSource, role, message, active.has(otherRole(role)));
        if (!result.ok) { packet(socket, { type: 'error', reason: result.reason }); return; }
        try { files.save(result.state); }
        catch { packet(socket, { type: 'error', reason: 'Не удалось сохранить действие в локации' }); return; }
        state = result.state;
        all({ type: 'snapshot', state });
        if (message.type === 'travel'||message.type==='car_travel') {
          walkingHome.delete(role);
          if (state.world.places[role] === 'home') sendLeisure(socket);
          homeTasks.replay(socket);
        }
        if (result.path) {
          if (state.world.places[role] === 'home'||state.world.places[role]==='district') walkingHome.set(role,{
            route:{from:{x:from.x,z:from.z},path:result.path},started:pauseTimers.now(),station:result.station,
          });
          if (state.world.places[role] === 'home' && (result.station === 'fridge' || result.station === 'cupboard')) {
            storageOpen.set(role, result.station);
          }
          all({ type: 'world_path', place: state.world.places[role], role, path: result.path, station: result.station });
        } else all({ type: 'world_event', role, message: result.message });
        return;
      }
      if (message.type === 'job_start') {
        clearQueue(role);
        commitLife();
        const home=isHomeJob(message.job), device=message.device;
        let route:WalkRoute|null=null;
        if(home){
          if(!computerDevice(device)||state.world.places[role]!=='home'){packet(socket,{type:'error',reason:'Открой компьютер дома'});return;}
          const resource=computerResource(device),partner=otherRole(role);
          if(homeTasks.reserved(resource)||[...running.values()].some(t=>t.plan.resource===resource)||
            state.activeShifts[partner]?.homeDevice===device||(device==='desktop'&&leisure.get(partner)?.activity==='computer')||
            (state.careers.residents[partner].shift?.mode==='remote'&&(state.careers.residents[partner].shift?.homeDevice??'laptop')===device)){
            packet(socket,{type:'error',reason:'Компьютер занят вторым персонажем'});return;
          }
          const notebook=device==='laptop'?laptopDesk(state):undefined;
          const replacement=device==='desktop'&&state.furnishing.soldFixtures?.includes('desk')
            ?state.furnishing.placed.find(p=>FURNITURE_BY_ID.get(p.sku)?.shape==='desk'&&!isNotebookDesk(p.sku)):undefined;
          if(device==='desktop'&&state.furnishing.soldFixtures?.includes('desk')&&!replacement){packet(socket,{type:'error',reason:'Установи компьютерный стол'});return;}
          const target=device==='laptop'?laptopApproach(state,role):points.desk;
          route=notebook?laptopWorkplace(state,role)?.route??null:replacement?furnitureUseLocation(state,role,replacement.id,'deskJournal')?.route??null:
            planWalk(state.characters[role],target,placeObstacles('home',state.furnishing),floorFor('home'));
          if(!route){packet(socket,{type:'error',reason:'Освободи подход к компьютеру'});return;}
        }
        let last=route?.from,meters=0;
        for(const point of route?.path??[]){meters+=Math.hypot(point.x-last!.x,point.z-last!.z);last=point;}
        const travel=Math.ceil(meters/HOME_WALK_SPEED*GAME_MINUTES_PER_REAL_SECOND);
        const result=beginShift(state,role,message.job,device,travel);
        if(result.ok&&home&&last)Object.assign(result.state.characters[role],last,{pose:travel?'idle':'work'});
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        if (result.state.world.dogWalker === role) {
          result.state.world.dogWalker = null;
          setDogParkPosition(result.state);
        }
        try{files.save(result.state);}catch{packet(socket,{type:'error',reason:'Не удалось сохранить начало смены'});return;}
        state=result.state;
        shiftVotes.clear();
        announceTime();
        walkingHome.delete(role);
        all({type:'job_event',role,outcome:'started',message:result.message});
        all({type:'snapshot',state});
        if(route?.path.length)all({type:'world_path',place:'home',role,path:route.path});
        return;
      }
      if (state.activeShifts[role]) {
        packet(socket,{type:'error',reason:'Ты сейчас на подработке. Дождись окончания или прерви смену'});
        return;
      }

      if (message.type === 'play_game' || message.type === 'computer_video' || message.type === 'study' || message.type === 'local_activity' || message.type === 'act' || message.type === 'furniture_use' || message.type === 'brew_coffee' || message.type === 'cook' || message.type === 'eat' || message.type === 'eat_takeout' || message.type === 'movie' || message.type === 'youtube' || message.type === 'free_tv' || message.type === 'read_book' ||
          (message.type === 'pet_action' && !(['buyFood','call','perch','fetch','mat','scratch','toy'].includes(String(message.action))||isTrainingAction(message.action)))) {
        const plan = planTask(message);
        if (!plan) { packet(socket, { type: 'error', reason: 'Неизвестное действие' }); return; }
        submitTimed(role, socket, plan);
        return;
      }

      if (message.type === 'buy' || message.type === 'checkout' || (message.type === 'pet_action' && (['buyFood','call','perch','fetch','mat','scratch','toy'].includes(String(message.action))||isTrainingAction(message.action)))) {
        const now = pauseTimers.now();
        if (now - (lastAction.get(role) ?? 0) < 1500) {
          packet(socket, { type: 'error', reason: 'Немного подожди перед следующей командой' });
          return;
        }
        const result = message.type === 'checkout'
          ? checkout(state, role, message.lines)
          : message.type === 'buy'
            ? applyFoodAction(state, role, { type: 'buy',
                item: typeof message.item === 'string' ? message.item : '' })
            : applyPetAction(state, role,
                typeof message.pet === 'string' ? message.pet : '',
                typeof message.action === 'string' ? message.action : '',catReserved);
        if (!result.ok) { packet(socket, { type: 'error', reason: result.reason }); return; }
        try { files.save(result.state); }
        catch (error) {
          console.error('Could not persist purchase:', error);
          packet(socket, { type: 'error', reason: 'Не удалось сохранить покупку' });
          return;
        }
        state = result.state;
        lastAction.set(role, now);
        if (message.type === 'checkout') {
          all({ type: 'store_event', role, message: result.message });
        } else if (message.type === 'buy') {
          all({ type: 'food_event', role, action: 'buy', message: result.message });
        } else {
          all({ type: 'pet_event', role,
            pet: message.pet as import('../src/shared/pets').PetId,
            action: message.action as import('../src/shared/pets').PetAction, message: result.message });
        }
        all({ type: 'snapshot', state });
        return;
      }
      packet(socket, { type: 'error', reason: 'Неизвестная команда' });
    });
    socket.on('close', () => {
      if (role && active.get(role) === socket) {
        clearQueue(role);
        walkingHome.delete(role);
        closeStorage(role);
        stopLeisure(role);
        stopTask(role, names[role] + ': действие отменено из-за отключения');
        homeTasks.closeInvite('Игрок отключился');
        if (active.size === 1) commitLife(); else accountTime();
        active.delete(role);
        if (pauseRequestedBy === role) {clearPauseRequest();announceTime();}
        else if (pauseRequestedBy && active.size === 1) setPaused(true);
        if (isPaused && active.size === 0) setPaused(false);
        shiftVotes.delete(role);
        stopSleep(role);
        announceTime();
        if (state.world.dogWalker === role) {
          const home = structuredClone(state);
          home.world.dogWalker = null;
          setDogParkPosition(home);
          home.revision++;
          try { files.save(home); state = home; all({ type: 'snapshot', state }); }
          catch { console.error('Could not save return of Verdell'); }
        }
        all({ type: 'online', online: online() });
      }
    });
    socket.on('error', (error) => console.warn('WebSocket:', error.message));
  });

  await new Promise<void>((done, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.removeListener('error', reject);
      done();
    });
  });
  const addr = httpServer.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  return {
    httpServer, port: actualPort,
    async close(): Promise<void> {
      for (const task of running.values()) pauseTimers.clear(task.timer);
      pauseTimers.dispose();
      clearPauseRequest();
      running.clear();
      homeTasks.dispose();
      clearInterval(heartbeat);
      clearInterval(clockSync);
      clearInterval(lifeTicker);
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>((resolveClose) => wss.close(() => resolveClose()));
      await new Promise<void>((resolveClose) => httpServer.close(() => resolveClose()));
    },
  };
}
