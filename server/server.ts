import { applyWorld, setDogParkPosition, worldMessages } from './locations';
import { openDevices } from './devices';
import { clockMinutes, stationById, approachFor } from '../src/shared/locations';
import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import WebSocket, { WebSocketServer, type RawData } from 'ws';
import {
  ACTIONS, points, names, SOCIAL_LABELS, type CharacterId, type GameState, type ServerPacket,
} from '../src/shared/protocol';
import { applyFoodAction } from './food';
import { checkout } from './market';
import { applyPetAction, pausePetRoutine, petCarePoint, runPetRoutines } from './pets';
import { planLeisure, urgentHomeAction } from './home';
import { KITCHEN_ACTIONS, KITCHEN_WORK, type HomeLeisure } from '../src/shared/home';
import { applySocial, otherRole, SOCIAL_COOLDOWN_MS } from './social';
import { openServerFiles } from './storage';
import { planTask, evaluateTask, type TaskPlan } from './tasks';
import { advanceLife } from './life';
import { GAME_MINUTES_PER_REAL_SECOND } from '../src/shared/life';
import type { PetId } from '../src/shared/pets';
import { beginShift, leaveShiftEarly, settleCompletedShifts } from './jobs';
import { sampleWalk, type WalkRoute } from '../src/game/navigation';

export interface ServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  distDir?: string;
  /** For fast deterministic integration tests; production defaults to real time. */
  taskTimeScale?: number;
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
  if (state.world.dogWalker) {
    state.world.dogWalker = null;
    setDogParkPosition(state);
  }
  const active = new Map<CharacterId, WebSocket>();
  const lastAction = new Map<CharacterId, number>();
  const lastSocial = new Map<CharacterId, number>();
  const lastIntent = new Map<CharacterId, number>();
  const lastAutoCare = new Map<CharacterId, number>();
  const leisure = new Map<CharacterId, { activity: HomeLeisure; startedAt: number; until: number; route: WalkRoute }>();
  const storageOpen = new Map<CharacterId, string>();
  interface RunningTask { id: number; role: CharacterId; plan: TaskPlan; timer: ReturnType<typeof setTimeout>; automatic: boolean }
  const running = new Map<CharacterId, RunningTask>();
  let nextTaskId = 0;
  const scale = options.taskTimeScale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) throw new Error('Invalid task time scale');
  const online = (): CharacterId[] => Array.from(active.keys());
  const all = (event: ServerPacket): void => {
    for (const socket of active.values()) packet(socket, event);
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
  let lastLifeTick = Date.now();
  let minuteCarry = 0;
  const liveGameTime = () => clockMinutes(state.clock) + minuteCarry + (Date.now() - lastLifeTick) / 1000 * GAME_MINUTES_PER_REAL_SECOND;
  // Only the authoritative server moves the clock. With nobody online the
  // household is paused; reconnects never drain the absent player's needs.
  const lifeTicker = setInterval(() => {
    const now = Date.now();
    const elapsed = Math.min(10_000, Math.max(0, now - lastLifeTick));
    lastLifeTick = now;
    if (!active.size) { minuteCarry = 0; return; }
    minuteCarry += elapsed / 1000 * GAME_MINUTES_PER_REAL_SECOND;
    const gameMinutes = Math.floor(minuteCarry);
    if (gameMinutes < 1) return;
    minuteCarry -= gameMinutes;
    for (const [role, activity] of leisure) {
      if (activity.until <= now) stopLeisure(role, now);
      else {
        const { from, path } = leisureRoute(role, now);
        const pose = path.length ? 'idle' : activity.activity === 'tv' ? 'sit' : activity.activity === 'computer' ? 'work' : 'idle';
        Object.assign(state.characters[role], from, { pose });
      }
    }
    const next = settleCompletedShifts(advanceLife(state, gameMinutes, online()));
    const occupiedPets = new Set<PetId>();
    for (const { plan } of running.values()) if (plan.command.type === 'pet_action') occupiedPets.add(plan.command.pet);
    for (const { activity } of leisure.values()) if (activity === 'verdell' || activity === 'simba') occupiedPets.add(activity);
    runPetRoutines(next.state, gameMinutes, clockMinutes(next.state.clock), occupiedPets);
    try { files.save(next.state); }
    catch (error) { console.error('Could not save daily-life clock:', error); return; }
    const arrived = state.world.deliveries.some(d => d.readyAt > clockMinutes(state.clock) &&
      d.readyAt <= clockMinutes(next.state.clock));
    state = next.state;
    all({ type: 'snapshot', state });
    if (arrived) all({ type: 'delivery_arrived' });
    for (const done of next.completed) all({type:'job_event',role:done.role,outcome:'finished',message:done.message});
    const available: CharacterId[] = [];
    for (const [role, socket] of active) {
      if (state.world.places[role] !== 'home' || running.has(role) || state.activeShifts[role] || storageOpen.has(role) ||
          now - (lastIntent.get(role) ?? now) < 18_000) continue;
      const command = now - (lastAutoCare.get(role) ?? 0) >= 70_000 && urgentHomeAction(state, role);
      const plan = command && planTask(command);
      if (plan && ![...running.values()].some(task => plan.resource && task.plan.resource === plan.resource)) {
        stopLeisure(role);
        lastAutoCare.set(role, now);
        beginTask(role, socket, plan, true);
      } else if (!leisure.has(role)) {
        available.push(role);
      }
    }
    if (!available.length) return;
    const options: HomeLeisure[] = ['tv', 'computer', 'simba'];
    if (!state.world.dogWalker) options.push('verdell');
    if (available.length === 2) options.push('chat', 'chat');
    const choices = options.filter(activity => ![...leisure.values()].some(current => current.activity === activity) &&
      ![...running.values()].some(task => task.plan.resource === (activity === 'computer' ? 'desk' : 'pet:' + activity)));
    const activity = choices[Math.floor(Math.random() * choices.length)];
    if (!activity) return;
    const roles = activity === 'chat' ? available : [available[Math.floor(Math.random() * available.length)]];
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
  }, 10_000);
  lifeTicker.unref();
  const stopTask = (role: CharacterId, reason: string): void => {
    const task = running.get(role);
    if (!task) return;
    clearTimeout(task.timer);
    running.delete(role);
    all({ type: 'task_ended', role, taskId: task.id, outcome: 'cancelled', message: reason });
  };
  const beginTask = (role: CharacterId, socket: WebSocket, plan: TaskPlan, automatic = false): void => {
    if (state.activeShifts[role] || running.has(role)) {
      packet(socket, { type: 'error', reason: 'Персонаж занят. Сначала заверши или отмени текущее действие' });
      return;
    }
    const occupied = plan.resource && [...running.values()].find(task => task.plan.resource === plan.resource);
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
    if (plan.command.type === 'pet_action' && state.pets[plan.command.pet].routine) {
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
        : points[ACTIONS[plan.command.actionId].item]
      : plan.command.type === 'pet_action' ? petCarePoint(state, plan.command.pet) ?? state.characters[role]
        : plan.command.type === 'cook' ? points.kitchen : points.table;
    const position = state.characters[role];
    const travelBudgetMs = Math.round(Math.hypot(position.x - destination.x,
      position.z - destination.z) * 1200 + 4200);
    const cookBudget = plan.command.type === 'cook' ? 19_000 : 0;
    const durationMs = Math.max(15, Math.round(Math.max(plan.durationMs, travelBudgetMs, cookBudget) * scale));
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
      try { files.save(result.state); }
      catch (error) {
        console.error('Could not persist completed task:', error);
        all({ type: 'task_ended', role, taskId: id, outcome: 'failed', message: 'Не удалось сохранить результат' });
        return;
      }
      state = result.state;
      lastAction.set(role, Date.now());
      all({ type: 'task_ended', role, taskId: id, outcome: 'completed', message: result.message });
      if (plan.command.type === 'local_activity') {
        all({ type: 'world_event', role, message: result.message });
      } else if (plan.command.type === 'act') {
        all({ type: 'action', role, actionId: plan.command.actionId, message: result.message });
      } else if (plan.command.type === 'pet_action') {
        all({ type: 'pet_event', role, pet: plan.command.pet, action: plan.command.action, message: result.message });
      } else {
        all({ type: 'food_event', role, action: plan.command.type === 'eat_takeout' ? 'eat' : plan.command.type, message: result.message });
      }
      all({ type: 'snapshot', state });
    }, durationMs);
    running.set(role, { id, role, plan, timer, automatic });
    all({ type: 'task_started', role, taskId: id, label: plan.label,
      durationMs, command: plan.command, automatic });
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
        if (active.size === 0) { lastLifeTick = Date.now(); minuteCarry = 0; }
        active.set(role, socket);
        lastIntent.set(role, Date.now());
        packet(socket, { type: 'ready', role, state, online: online() });
        if (state.world.places[role] === 'home') sendLeisure(socket);
        if (deviceToken && message.type === 'auth') packet(socket, { type: 'device_token', role, token: deviceToken });
        all({ type: 'online', online: online() });
        return;
      }

      if (message.type === 'forget_device') {
        try { if (deviceToken) devices.revoke(deviceToken); }
        catch { packet(socket, { type: 'error', reason: 'Не удалось забыть устройство' }); return; }
        deviceToken = null;
        socket.close(1000, 'Signed out');
        return;
      }
      if (message.type === 'close_storage') {
        closeStorage(role);
        lastIntent.set(role, Date.now());
        return;
      }
      if (message.type === 'cancel_task') {
        lastIntent.set(role, Date.now());
        const current = running.get(role);
        if (!current || message.taskId !== current.id) {
          packet(socket, { type: 'error', reason: 'Это действие уже завершено или не существует' });
        } else {
          stopTask(role, names[role] + ': действие прервано');
        }
        return;
      }
      lastIntent.set(role, Date.now());
      closeStorage(role);
      stopLeisure(role);
      if (running.get(role)?.automatic) stopTask(role, 'Управление возвращено игроку');
      if (message.type === 'job_cancel' || message.type === 'job_leave_early') {
        // Legacy job_cancel messages are treated as early departure with fair partial pay.
        const result=leaveShiftEarly(state,role);
        if(!result.ok){packet(socket,{type:'error',reason:result.reason});return;}
        try{files.save(result.state);}catch{packet(socket,{type:'error',reason:'Не удалось сохранить досрочный уход'});return;}
        state=result.state;
        all({type:'job_event',role,outcome:'left_early',message:result.message});
        all({type:'snapshot',state});
        return;
      }
      if (running.has(role)) {
        packet(socket, { type: 'error', reason: 'Персонаж сейчас занят — заверши или отмени действие' });
        return;
      }
      if (typeof message.type === 'string' && worldMessages.has(message.type)) {
        const result = applyWorld(state, role, message);
        if (!result.ok) { packet(socket, { type: 'error', reason: result.reason }); return; }
        try { files.save(result.state); }
        catch { packet(socket, { type: 'error', reason: 'Не удалось сохранить действие в локации' }); return; }
        state = result.state;
        all({ type: 'snapshot', state });
        if (message.type === 'travel' && state.world.places[role] === 'home') sendLeisure(socket);
        if (result.path) {
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
        all({type:'job_event',role,outcome:'started',message:result.message});
        all({type:'snapshot',state});
        return;
      }
      if (state.activeShifts[role]) {
        packet(socket,{type:'error',reason:'Ты сейчас на подработке. Дождись окончания или прерви смену'});
        return;
      }

      if (message.type === 'social_offer') {
        if (message.kind !== 'hug' && message.kind !== 'highFive') {
          packet(socket, { type: 'error', reason: 'Неизвестное совместное действие' });
          return;
        }
        const partner = otherRole(role);
        if (!active.has(partner)) {
          packet(socket, { type: 'error', reason: names[partner] + ' пока не в игре' });
          return;
        }
        if (state.world.places[partner] !== state.world.places[role]) {
          packet(socket, { type: 'error', reason: 'Сначала встретьтесь в одной локации' });
          return;
        }
        if ((running.has(partner) && !running.get(partner)?.automatic) || state.activeShifts[partner]) {
          packet(socket, { type: 'error', reason: names[partner] + ' занят(а) другим действием' });
          return;
        }
        const now = Date.now();
        if (now - Math.max(lastSocial.get(role) ?? 0, lastSocial.get(partner) ?? 0) < SOCIAL_COOLDOWN_MS) {
          packet(socket, { type: 'error', reason: 'Подожди немного до следующего совместного действия' });
          return;
        }
        const next = applySocial(state, message.kind);
        if (next.world.dogWalker) setDogParkPosition(next);
        try { files.save(next); }
        catch (error) {
          console.error('Failed to persist social action:', error);
          packet(socket, { type: 'error', reason: 'Не удалось сохранить совместное действие' });
          return;
        }
        state = next;
        stopLeisure(partner);
        if (running.get(partner)?.automatic) stopTask(partner, 'Началось совместное действие');
        lastIntent.set(partner, now);
        lastSocial.set(role, now);
        lastSocial.set(partner, now);
        all({ type: 'social_start', kind: message.kind,
          message: 'Влад и Алина: ' + SOCIAL_LABELS[message.kind].toLowerCase() + ' ❤️' });
        all({ type: 'snapshot', state });
        return;
      }

      if (message.type === 'local_activity' || message.type === 'act' || message.type === 'cook' || message.type === 'eat' || message.type === 'eat_takeout' ||
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
        closeStorage(role);
        stopLeisure(role);
        stopTask(role, names[role] + ': действие отменено из-за отключения');
        active.delete(role);
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
      clearInterval(heartbeat);
      clearInterval(lifeTicker);
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>((resolveClose) => wss.close(() => resolveClose()));
      await new Promise<void>((resolveClose) => httpServer.close(() => resolveClose()));
    },
  };
}
