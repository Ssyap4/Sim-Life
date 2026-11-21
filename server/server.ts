import { applyServiceCommand, settleFamilyServices } from './services';
import { changeComputerFavorite } from './computers';
import { applyEducation, awardActivity } from './education';
import { serviceAvailable } from '../src/shared/services';
import { taskAccessError } from '../src/shared/serviceAccess';
import { applyWorld, setDogParkPosition, worldMessages } from './locations';
import { openDevices } from './devices';
import { clockMinutes, stationById, approachFor } from '../src/shared/locations';
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
import { applyPetAction, pausePetRoutine, petCarePoint, runPetRoutines } from './pets';
import { planLeisure, urgentHomeAction } from './home';
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
import { recoverSleep } from './timeControl';
import type { PetId } from '../src/shared/pets';
import { beginShift, leaveShiftEarly, settleCompletedShifts } from './jobs';
import { advanceCareers, applyCareer, careerCommands } from './careers';
import { sampleWalk, type WalkRoute } from '../src/game/navigation';

export interface ServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  distDir?: string;
  /** For fast deterministic integration tests; production defaults to real time. */
  taskTimeScale?: number;
  socialTtlMs?: number;
  /** Deterministic clock input and tick cadence for isolated integration tests. */
  lifeClock?: { now: () => number; tickMs: number };
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
  const files = openServerFiles(options.dataDir ?? resolve('server-data'));
  const devices = openDevices(files.dataDir);
  const distDir = resolve(options.distDir ?? resolve('dist'));
  let state: GameState = files.load();
  const spoiledOnBoot = expireReadyFood(state);
  const serviceUpdatesOnBoot = settleFamilyServices(state, false, false);
  if (spoiledOnBoot.length || serviceUpdatesOnBoot.length) {
    state.revision++;
    files.save(state);
  }
  // Interrupted sleep sessions do not keep earning energy after a server restart.
  for (const id of ['vlad', 'alina'] as const)
    if (state.characters[id].pose === 'sleep') state.characters[id].pose = 'idle';
  if (state.world.dogWalker) {
    state.world.dogWalker = null;
    setDogParkPosition(state);
  }
  const active = new Map<CharacterId, WebSocket>();
  const lastAction = new Map<CharacterId, number>();
  const lastIntent = new Map<CharacterId, number>();
  const lastAutoCare = new Map<CharacterId, number>();
  const leisure = new Map<CharacterId, { activity: HomeLeisure; startedAt: number; until: number; route: WalkRoute }>();
  const walkingHome = new Map<CharacterId, { route: WalkRoute; started: number }>();
  const storageOpen = new Map<CharacterId, string>();
  interface RunningTask { id: number; role: CharacterId; plan: TaskPlan; timer: ReturnType<typeof setTimeout>; automatic: boolean }
  const running = new Map<CharacterId, RunningTask>();
  let nextTaskId = 0;
  const scale = options.taskTimeScale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) throw new Error('Invalid task time scale');
  const online = (): CharacterId[] => Array.from(active.keys());
  const sleepers = new Map<CharacterId, SleepMode>();
  const shiftVotes = new Set<CharacterId>();
  const timeStatus = (): TimeStatus => ({
    multiplier: timeMultiplier(online(), { vlad: state.activeShifts.vlad || state.careers.residents.vlad.shift,
      alina: state.activeShifts.alina || state.careers.residents.alina.shift }, sleepers, shiftVotes),
    shiftVotes: [...shiftVotes],
    sleepers: Object.fromEntries(sleepers) as TimeStatus['sleepers'],
  });
  const all = (event: ServerPacket): void => {
    for (const socket of active.values()) packet(socket, event);
  };
  const announceTime = () => {
    all({ type: 'time_status', status: timeStatus() });
    sendClock();
  };
  const leisureRoute = (role: CharacterId, now: number) => {
    const task = leisure.get(role)!;
    return sampleWalk(task.route, Math.max(0, Math.min(task.until, now) - task.startedAt) / 1000 * 1.8);
  };
  const sendLeisure = (socket: WebSocket): void => {
    const now = Date.now();
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
  const stopLeisure = (role: CharacterId, now = Date.now()): void => {
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
  };
  const stopSleep = (role: CharacterId): void => {
    if (!sleepers.has(role)) return;
    accountTime();
    if (state.characters[role].pose === 'sleep') {
      const next = structuredClone(state);
      next.characters[role].pose = 'idle';
      next.revision++;
      try { files.save(next); state = next; }
      catch (error) { console.error('Could not save wake-up:', error); return; }
      all({ type: 'snapshot', state });
    }
    sleepers.delete(role);
    announceTime();
  };
  const homeTasks = createHomeSessions({
    state: () => state, save(next) { files.save(next); state = next; },
    all, send: packet, socket: role => active.get(role),
    busy: role => running.has(role) || sleepers.has(role) || Boolean(state.activeShifts[role] || state.careers.residents[role].shift),
    gameTime: () => liveGameTime(),
    pausePet: pet => {
      if(state.pets[pet].routine){
        pausePetRoutine(state,pet,liveGameTime());
        all({type:'snapshot',state});
      }
    }, socialTtlMs:options.socialTtlMs,
    resourceBusy: resource => [...running.values()].some(task => task.plan.resource === resource),
    prepare(role, tv) {
      if (tv) for (const [other,routine] of leisure) if (routine.activity === 'tv') stopLeisure(other);
      closeStorage(role);
      stopLeisure(role);
      const walk = walkingHome.get(role);
      if (walk) {
        const distance = (Date.now()-walk.started)/1000*HOME_WALK_SPEED;
        Object.assign(state.characters[role],sampleWalk(walk.route,distance).from,{pose:'idle'});
        walkingHome.delete(role);
      }
      lastIntent.set(role, Date.now());
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
    if (active.size) minuteCarry += elapsed / 1000 * GAME_MINUTES_PER_REAL_SECOND * timeStatus().multiplier;
  };
  const liveGameTime = (multiplier = timeStatus().multiplier) => clockMinutes(state.clock) + minuteCarry +
    timeSinceTick(lifeNow()) / 1000 * GAME_MINUTES_PER_REAL_SECOND * multiplier;
  const sendClock = () => {
    if (!active.size) return;
    const { multiplier } = timeStatus();
    all({ type: 'clock_sync', sample: { minutes: liveGameTime(multiplier), multiplier } });
  };
  const clockSync = setInterval(sendClock, CLOCK_SYNC_MS);
  clockSync.unref();
  // Only the authoritative server moves the clock. With nobody online the
  // household is paused; reconnects never drain the absent player's needs.
  const commitLife = (): boolean => {
    const now = Date.now();
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
    const next = settleCompletedShifts(advanceLife(state, gameMinutes, online()));
    advanceCareers(next.state, clockMinutes(state.clock), clockMinutes(next.state.clock), online());
    homeTasks.checkpoint(next.state);
    const spoiled = expireReadyFood(next.state);
    const sleepBefore = sleepers.size ? structuredClone(next.state) : null;
    const finishedSleeping = recoverSleep(next.state, gameMinutes, sleepers);
    const occupiedPets = new Set<PetId>();
    for (const { plan } of running.values()) if (plan.command.type === 'pet_action') occupiedPets.add(plan.command.pet);
    for (const { activity } of leisure.values()) if (activity === 'verdell' || activity === 'simba') occupiedPets.add(activity);
    for(const pet of ['simba','verdell'] as const) if(homeTasks.reserved('pet:'+pet))occupiedPets.add(pet);
    runPetRoutines(next.state, gameMinutes, clockMinutes(next.state.clock), occupiedPets);
    const billingMessages = settleFamilyServices(next.state, next.state.money > state.money);
    try { files.save(next.state); }
    catch (error) { console.error('Could not save daily-life clock:', error); return false; }
    minuteCarry -= gameMinutes;
    if (sleepBefore) for (const role of sleepers.keys()) needsEvent(role,'🌙 Сон',sleepBefore,next.state);
    for (const role of finishedSleeping) sleepers.delete(role);
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
  const lifeTicker = setInterval(() => {
    if (!commitLife()) return;
    const now = Date.now();
    const available: CharacterId[] = [];
    for (const [role, socket] of active) {
      if (state.world.places[role] !== 'home' || sleepers.has(role) || running.has(role) || homeTasks.busy(role) || state.activeShifts[role] || state.careers.residents[role].shift || storageOpen.has(role) ||
          now - (lastIntent.get(role) ?? now) < 18_000) continue;
      const command = now - (lastAutoCare.get(role) ?? 0) >= 70_000 && urgentHomeAction(state, role);
      const plan = command && planTask(command);
      if (plan && !taskAccessError(state, plan.command) && ![...running.values()].some(task => plan.resource && task.plan.resource === plan.resource)) {
        stopLeisure(role);
        lastAutoCare.set(role, now);
        beginTask(role, socket, plan, true);
      } else if (!leisure.has(role)) {
        available.push(role);
      }
    }
    if (!available.length) return;
    const options: HomeLeisure[] = ['tv', 'computer', 'simba'];
    if (!serviceAvailable(state.billing, 'internet', clockMinutes(state.clock))) options.splice(options.indexOf('computer'), 1);
    if (!state.world.dogWalker) options.push('verdell');
    const choices = options.filter(activity => ![...leisure.values()].some(current => current.activity === activity) &&
      !homeTasks.reserved(activity==='tv'?'tv':activity==='computer'?'desk':'pet:'+activity) &&
      ![...running.values()].some(task => task.plan.resource === (activity === 'computer' ? 'desk' : 'pet:' + activity)));
    const activity = choices[Math.floor(Math.random() * choices.length)];
    if (!activity) return;
    const roles = [available[Math.floor(Math.random() * available.length)]];
    const routes: Partial<Record<CharacterId, WalkRoute>> = {};
    if (activity === 'verdell' || activity === 'simba') {
      pausePetRoutine(state, activity, liveGameTime());
      state.revision++;
      all({ type: 'snapshot', state });
    }
    for (const role of roles) {
      const route = planLeisure(state, role, activity);
      if (!route) return;
      routes[role] = route;
    }
    for (const role of roles) leisure.set(role, { activity, startedAt: now, until: now + 16_000, route: routes[role]! });
    all({ type: 'home_leisure', roles, activity, routes });
  }, options.lifeClock?.tickMs ?? 10_000);
  lifeTicker.unref();
  const stopTask = (role: CharacterId, reason: string): void => {
    if (homeTasks.cancel(role, reason)) return;
    const task = running.get(role);
    if (!task) return;
    clearTimeout(task.timer);
    running.delete(role);
    all({ type: 'task_ended', role, taskId: task.id, outcome: 'cancelled', message: reason });
  };
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
    if (plan.command.type === 'pet_action' && plan.command.action !== 'feed' &&
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
          ? stationById('home','career-laptop')!.approach : points[ACTIONS[plan.command.actionId].item]
      : plan.command.type === 'play_game' || plan.command.type === 'computer_video'
        ? plan.command.device === 'laptop' ? stationById('home','career-laptop')!.approach : points.desk
      : plan.command.type === 'brew_coffee' ? KITCHEN_WORK.coffee.position
      : plan.command.type === 'pet_action' ? petCarePoint(state, plan.command.pet, plan.command.action) ?? state.characters[role]
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
    const duration = personalCare ? plan.durationMs + travelBudgetMs
      : Math.max(plan.durationMs, travelBudgetMs, cookBudget, dishBudget);
    const durationMs = Math.max(15, Math.round(duration * scale));
    const id = ++nextTaskId;
    const timer = setTimeout(() => {
      const current = running.get(role);
      if (!current || current.id !== id || active.get(role) !== socket) return;
      running.delete(role);
      // Revalidate against the freshest household snapshot, so two simultaneous
      // players cannot create food, rewards or inventory from stale resources.
      const result = evaluateTask(state, role, plan.command);
      if (!result.ok) {
        all({ type: 'task_ended', role, taskId: id, outcome: 'failed', message: result.reason });
        return;
      }
      if (!automatic) awardActivity(result.state, role, plan.command, plan.label);
      try { files.save(result.state); }
      catch (error) {
        console.error('Could not persist completed task:', error);
        all({ type: 'task_ended', role, taskId: id, outcome: 'failed', message: 'Не удалось сохранить результат' });
        return;
      }
      const effects = gains(state,result.state,role);
      state = result.state;
      lastAction.set(role, Date.now());
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
    all({ type: 'task_started', role, taskId: id, label: plan.label,
      durationMs, command: plan.command, automatic, effects: gains(state,validation.state,role) });
  };
  const httpServer = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end(); return;
    }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }

    if (pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, version: 2, online: online().length }));
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
          : typeof message.code === 'string' && sameCode(message.code, files.access[requested]);
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
        lastIntent.set(role, Date.now());
        packet(socket, { type: 'ready', role, state, online: online() });
        if (state.world.places[role] === 'home') sendLeisure(socket);
        homeTasks.replay(socket);
        announceTime();
        if (deviceToken && message.type === 'auth') packet(socket, { type: 'device_token', role, token: deviceToken });
        all({ type: 'online', online: online() });
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
        if (message.mode !== 'full' && message.mode !== 'half') {
          packet(socket, { type: 'error', reason: 'Неизвестная длительность сна' }); return;
        }
        if (state.world.places[role] !== 'home' || state.activeShifts[role] || state.careers.residents[role].shift ||
            (running.has(role) && !running.get(role)?.automatic) || (homeTasks.busy(role) && !homeTasks.automatic(role))) {
          packet(socket, { type: 'error', reason: 'Для сна нужно находиться дома и закончить текущее дело' }); return;
        }
        const mode = message.mode as SleepMode;
        if (state.characters[role].energy >= sleepTarget(mode)) {
          packet(socket, { type: 'error', reason: 'Энергия уже достигла выбранной отметки' }); return;
        }
        closeStorage(role);
        stopLeisure(role);
        if (running.get(role)?.automatic || homeTasks.automatic(role)) stopTask(role, 'Время спать');
        const next = structuredClone(state);
        Object.assign(next.characters[role], points.bed, { pose: 'sleep' });
        next.revision++;
        try { files.save(next); }
        catch { packet(socket, { type: 'error', reason: 'Не удалось сохранить начало сна' }); return; }
        accountTime();
        state = next;
        sleepers.set(role, mode);
        shiftVotes.delete(role);
        lastIntent.set(role, Date.now());
        all({ type: 'snapshot', state });
        announceTime();
        return;
      }
      if (message.type === 'sleep_stop') {
        if (!sleepers.has(role)) { packet(socket, { type: 'error', reason: 'Персонаж не спит' }); return; }
        stopSleep(role);
        lastIntent.set(role, Date.now());
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
        lastIntent.set(role, Date.now());
        return;
      }
      const careerShift = state.careers.residents[role].shift;
      if (typeof message.type === 'string' && careerCommands.has(message.type)) {
        commitLife();
        const time = Math.floor(liveGameTime());
        const occupied = running.has(role) || homeTasks.busy(role) || sleepers.has(role);
        if (message.type === 'career_start' && !occupied) { closeStorage(role); stopLeisure(role); }
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
        lastIntent.set(role,Date.now());
        all({type:'snapshot',state});
        if (result.path) all({type:'world_path',place:state.world.places[role],role,path:result.path});
        packet(socket,{type:'world_event',role,message:result.message});
        if (billingMessages.length) all({type:'billing_event',messages:billingMessages});
        return;
      }
      if (careerShift && message.type !== 'walk' && !['service_connect','service_renewal','service_pay','education_goal'].includes(String(message.type))) {
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
        lastIntent.set(role,Date.now());
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
      if (message.type === 'cancel_task') {
        lastIntent.set(role, Date.now());
        if (typeof message.taskId === 'number' && homeTasks.cancel(role, names[role] + ': занятие прервано', message.taskId)) return;
        const current = running.get(role);
        if (!current || message.taskId !== current.id) {
          packet(socket, { type: 'error', reason: 'Это действие уже завершено или не существует' });
        } else {
          stopTask(role, names[role] + ': действие прервано');
        }
        return;
      }
      // Walking, starting work, using a station or any other manual action wakes the sleeper.
      stopSleep(role);
      lastIntent.set(role, Date.now());
      closeStorage(role);
      stopLeisure(role);
      if (running.get(role)?.automatic) stopTask(role, 'Управление возвращено игроку');
      if (homeTasks.automatic(role)) homeTasks.cancel(role, 'Управление возвращено игроку');
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
      if (running.has(role) || homeTasks.busy(role)) {
        packet(socket, { type: 'error', reason: 'Персонаж сейчас занят — заверши или отмени действие' });
        return;
      }
      if (typeof message.type === 'string' && worldMessages.has(message.type)) {
        const from = state.characters[role];
        const result = applyWorld(state, role, message, active.has(otherRole(role)));
        if (!result.ok) { packet(socket, { type: 'error', reason: result.reason }); return; }
        try { files.save(result.state); }
        catch { packet(socket, { type: 'error', reason: 'Не удалось сохранить действие в локации' }); return; }
        state = result.state;
        all({ type: 'snapshot', state });
        if (message.type === 'travel') {
          walkingHome.delete(role);
          if (state.world.places[role] === 'home') sendLeisure(socket);
          homeTasks.replay(socket);
        }
        if (result.path) {
          if (state.world.places[role] === 'home') walkingHome.set(role,{
            route:{from:{x:from.x,z:from.z},path:result.path},started:Date.now(),
          });
          if (state.world.places[role] === 'home' && (result.station === 'fridge' || result.station === 'cupboard')) {
            storageOpen.set(role, result.station);
          }
          all({ type: 'world_path', place: state.world.places[role], role, path: result.path, station: result.station });
        } else all({ type: 'world_event', role, message: result.message });
        return;
      }
      if (message.type === 'job_start') {
        const result=beginShift(state,role,message.job);
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        if (result.state.world.dogWalker === role) {
          result.state.world.dogWalker = null;
          setDogParkPosition(result.state);
        }
        try{files.save(result.state);}catch{packet(socket,{type:'error',reason:'Не удалось сохранить начало смены'});return;}
        state=result.state;
        shiftVotes.clear();
        announceTime();
        all({type:'job_event',role,outcome:'started',message:result.message});
        all({type:'snapshot',state});
        return;
      }
      if (state.activeShifts[role]) {
        packet(socket,{type:'error',reason:'Ты сейчас на подработке. Дождись окончания или прерви смену'});
        return;
      }

      if (message.type === 'play_game' || message.type === 'computer_video' || message.type === 'study' || message.type === 'local_activity' || message.type === 'act' || message.type === 'brew_coffee' || message.type === 'cook' || message.type === 'eat' || message.type === 'eat_takeout' || message.type === 'movie' || message.type === 'youtube' || message.type === 'free_tv' || message.type === 'read_book' ||
          (message.type === 'pet_action' && message.action !== 'buyFood')) {
        const plan = planTask(message);
        if (!plan) { packet(socket, { type: 'error', reason: 'Неизвестное действие' }); return; }
        beginTask(role, socket, plan);
        return;
      }

      if (message.type === 'buy' || message.type === 'checkout' || (message.type === 'pet_action' && message.action === 'buyFood')) {
        const now = Date.now();
        if (now - (lastAction.get(role) ?? 0) < 1500) {
          packet(socket, { type: 'error', reason: 'Немного подожди перед следующей покупкой' });
          return;
        }
        const result = message.type === 'checkout'
          ? checkout(state, role, message.lines)
          : message.type === 'buy'
            ? applyFoodAction(state, role, { type: 'buy',
                item: typeof message.item === 'string' ? message.item : '' })
            : applyPetAction(state, role,
                typeof message.pet === 'string' ? message.pet : '',
                typeof message.action === 'string' ? message.action : '');
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
            action: 'buyFood', message: result.message });
        }
        all({ type: 'snapshot', state });
        return;
      }
      packet(socket, { type: 'error', reason: 'Неизвестная команда' });
    });
    socket.on('close', () => {
      if (role && active.get(role) === socket) {
        walkingHome.delete(role);
        closeStorage(role);
        stopLeisure(role);
        stopTask(role, names[role] + ': действие отменено из-за отключения');
        homeTasks.closeInvite('Игрок отключился');
        if (active.size === 1) commitLife(); else accountTime();
        active.delete(role);
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
      for (const task of running.values()) clearTimeout(task.timer);
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
