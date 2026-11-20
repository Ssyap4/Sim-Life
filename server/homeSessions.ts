import { taskAccessError } from '../src/shared/serviceAccess';
import WebSocket from 'ws';
import { BATH_ACTIONS, BATH_FIXTURES, HOME_FLOOR, HOME_WALK_SPEED, homeSeat, LIBRARY_APPROACH } from '../src/shared/home';
import { GENRES, HOME_SEATS, YOUTUBE, type Genre, type HomePresentation, type HomeSeat } from '../src/shared/homeLife';
import { placeObstacles } from '../src/shared/locations';
import type { CharacterId, GameState, ServerPacket, TimedCommand } from '../src/shared/protocol';
import { planWalk, sampleWalk, type WalkRoute } from '../src/game/navigation';
import { otherRole } from './social';
import { entertainmentReward, evaluateTask, planTask, type TaskPlan } from './tasks';
import { gains } from './needs';

type Started = Extract<ServerPacket, { type: 'task_started' }>;
type Participant = { role: CharacterId; socket: WebSocket; packet: Started; arriveMs: number };
type Session = {
  plan: TaskPlan;
  participants: Participant[];
  started: number;
  activeAt: number | null;
  duration: number;
  timer: ReturnType<typeof setTimeout>;
};
type Invite = { id: number; from: CharacterId; genre: Genre; timer: ReturnType<typeof setTimeout> };
type Hooks = {
  state(): GameState;
  save(state: GameState): void;
  all(event: ServerPacket): void;
  send(socket: WebSocket, packet: ServerPacket): void;
  socket(role: CharacterId): WebSocket | undefined;
  busy(role: CharacterId): boolean;
  prepare(role: CharacterId, tv: boolean): void;
  nextId(): number;
  timeScale: number;
};
const obstacles = placeObstacles('home');
const readingSeats: HomeSeat[] = HOME_SEATS.filter(seat => seat !== 'spareSeat');
const length = (route: WalkRoute) => route.path.reduce((sum, point, i) => {
  const from = route.path[i - 1] ?? route.from;
  return sum + Math.hypot(point.x - from.x, point.z - from.z);
}, 0);
function sampled(home: HomePresentation, elapsed: number) {
  const route = home.route;
  if (home.pickup === undefined || home.pickupMs === undefined)
    return { route:sampleWalk(route,elapsed*HOME_WALK_SPEED/1000) };
  const toShelf = length({from:route.from,path:route.path.slice(0,home.pickup)})*1000/HOME_WALK_SPEED;
  const pause = elapsed<toShelf ? 0 : Math.min(home.pickupMs,elapsed-toShelf);
  const remaining = sampleWalk(route,(elapsed-pause)*HOME_WALK_SPEED/1000);
  return {route:remaining, pickup:Math.max(0,home.pickup-route.path.length+remaining.path.length),
    pickupMs:home.pickupMs-pause};
}
const isEntertainment = (c: TimedCommand) => c.type === 'movie' || c.type === 'youtube' || c.type === 'read_book' || c.type === 'free_tv';

export function usesHomeSession(command: TimedCommand): boolean {
  return isEntertainment(command) || command.type === 'act' &&
    (Object.hasOwn(BATH_ACTIONS, command.actionId) ||
      ['sofaRest','sofaMusic','sofaCall','tableRest','tableTalk','tablePlan'].includes(command.actionId));
}

export function createHomeSessions(hooks: Hooks) {
  const sessions = new Map<CharacterId, Session>();
  let invite: Invite | null = null;
  let nextInviteId = 0;
  const busy = (role: CharacterId) => sessions.has(role);
  const available = (role: CharacterId) => hooks.socket(role)?.readyState === WebSocket.OPEN &&
    hooks.state().world.places[role] === 'home' && !busy(role) && !hooks.busy(role);
  const error = (socket: WebSocket, reason: string) => hooks.send(socket, { type: 'error', reason });
  const broadcastSnapshot = () => hooks.all({ type: 'snapshot', state: hooks.state() });
  const closeInvite = (message: string) => {
    if (!invite) return;
    clearTimeout(invite.timer);
    hooks.all({ type: 'movie_offer_closed', inviteId: invite.id, message });
    invite = null;
  };
  const reserved = (resource: string | null) => resource !== null &&
    [...sessions.values()].some(session => session.plan.resource === resource);

  function presentation(role: CharacterId, command: TimedCommand): HomePresentation | null {
    const from = hooks.state().characters[role];
    const walk = (origin: typeof from | WalkRoute['from'], to: WalkRoute['from']) => planWalk(origin, to, obstacles, HOME_FLOOR);
    if (command.type === 'act' && command.actionId in BATH_ACTIONS) {
      const station = BATH_ACTIONS[command.actionId as keyof typeof BATH_ACTIONS];
      const route = walk(from, BATH_FIXTURES[station].approach);
      return route && { route, station };
    }
    if (command.type === 'read_book') {
      const pickup = walk(from, LIBRARY_APPROACH);
      if (!pickup) return null;
      const index = Math.floor(Math.random() * readingSeats.length);
      const order = [...readingSeats.slice(index), ...readingSeats.slice(0,index), 'spareSeat' as const];
      for (const station of order) {
        // Each resident has their own spot on every seat. All activity modes
        // reserve the resident for the entire route and their own seat identity.
        const route = walk(pickup.path.at(-1) ?? pickup.from, homeSeat(station, role).approach);
        if (route) return { route: { from: pickup.from, path: [...pickup.path, ...route.path] },
          pickup: pickup.path.length, pickupMs: 720, station };
      }
      return null;
    }
    const station = command.type === 'act' && command.actionId.startsWith('table') ? 'table' : 'sofa';
    const route = walk(from, homeSeat(station, role).approach);
    if (!route) return null;
    const program = command.type === 'free_tv' ? 'broadcast' : command.type === 'movie' ? command.genre
      : command.type === 'youtube' ? YOUTUBE[Math.floor(Math.random() * YOUTUBE.length)]
      : undefined;
    return { route, station, program };
  }

  function end(session: Session, outcome: 'cancelled' | 'failed', message: string) {
    clearTimeout(session.timer);
    for (const {role,packet} of session.participants) {
      sessions.delete(role);
      hooks.all({ type: 'task_ended', role, taskId: packet.taskId, outcome, message });
    }
  }

  function complete(session: Session) {
    if (session.participants.some(({role,socket}) => sessions.get(role) !== session ||
        hooks.socket(role) !== socket || socket.readyState !== WebSocket.OPEN)) {
      end(session, 'cancelled', 'Просмотр или занятие прервано'); return;
    }
    const before = hooks.state();
    let next = before;
    const results: { message: string }[] = [];
    for (const { role, packet } of session.participants) {
      const result = evaluateTask(next, role, session.plan.command, session.participants.length === 2);
      if (!result.ok) { end(session, 'failed', result.reason); return; }
      const route = packet.home!.route;
      const seated = HOME_SEATS.some(seat => seat === packet.home!.station);
      Object.assign(result.state.characters[role], route.path.at(-1) ?? route.from, { pose: seated ? 'sit' : 'idle' });
      next = result.state;
      results.push(result);
    }
    try { hooks.save(next); }
    catch { end(session, 'failed', 'Не удалось сохранить результат'); return; }
    broadcastSnapshot();
    session.participants.forEach(({role,packet},i) => {
      sessions.delete(role);
      hooks.all({ type: 'task_ended', role, taskId: packet.taskId, outcome: 'completed',
        message: results[i].message, effects: gains(before,next,role) });
    });
  }

  function start(roles: CharacterId[], plan: TaskPlan, initiator: WebSocket, automatic = false) {
    const command = plan.command;
    const denial = taskAccessError(hooks.state(), command);
    if (denial) { if (!automatic) error(initiator, denial); return; }
    const resource = plan.resource;
    const occupant = [...sessions.values()].find(session => resource && session.plan.resource === resource);
    if (occupant && (automatic || !occupant.participants[0].packet.automatic)) {
      if (!automatic) error(initiator, 'Это место сейчас занято вторым игроком');
      return;
    }
    if (roles.some(role => !available(role))) {
      if (!automatic) error(initiator, 'Для занятия нужно находиться дома и быть свободным'); return;
    }
    const duration = Math.max(15, Math.round(plan.durationMs * hooks.timeScale));
    const participants: Participant[] = [];
    for (const role of roles) {
      hooks.prepare(role, resource === 'tv');
      const home = presentation(role, command);
      if (!home) { if (!automatic) error(initiator, 'Не удалось найти свободный маршрут'); return; }
      const before = hooks.state();
      const result = evaluateTask(before, role, command, roles.length === 2);
      if (!result.ok) { if (!automatic) error(initiator, result.reason); return; }
      const effects = isEntertainment(command) ? entertainmentReward(command, roles.length === 2)
        : command.type === 'act' && command.actionId === 'bathTeeth' ? {hygiene:20}
        : command.type === 'act' && command.actionId === 'bathShower' ? {hygiene:75}
        : gains(before,result.state,role);
      participants.push({ role, socket: hooks.socket(role)!, arriveMs: 1000*length(home.route)/HOME_WALK_SPEED+(home.pickupMs??0),
        packet: { type: 'task_started', role, taskId: hooks.nextId(), command, label: plan.label,
          durationMs: duration, home, effects, automatic } });
    }
    if (occupant) cancel(occupant.participants[0].role,'Место освободилось для игрока');
    const travel = Math.max(0,...participants.map(p => p.arriveMs));
    const session: Session = { plan: { ...plan, resource }, participants, started: Date.now(), activeAt: null,
      duration, timer: setTimeout(() => {
        session.activeAt = Date.now();
        for (const {role,packet} of participants) {
          hooks.all({ type: 'task_active', role, taskId: packet.taskId, elapsedMs: 0 });
        }
        session.timer = setTimeout(() => complete(session), session.duration);
      }, Math.round(travel * hooks.timeScale)) };
    for (const participant of participants) {
      sessions.set(participant.role, session);
      hooks.all(participant.packet);
    }
  }

  function cancel(role: CharacterId, message: string, taskId?: number): boolean {
    const session = sessions.get(role);
    if (!session || (taskId !== undefined && !session.participants.some(p => p.role === role && p.packet.taskId === taskId))) return false;
    const next = structuredClone(hooks.state());
    for (const {role,packet} of session.participants) {
      const elapsed = session.activeAt === null ? (Date.now()-session.started)/hooks.timeScale : Infinity;
      Object.assign(next.characters[role], sampled(packet.home!,elapsed).route.from, { pose: 'idle' });
    }
    next.revision++;
    try { hooks.save(next); broadcastSnapshot(); }
    catch { /* Cancellation still releases every resource if disk writes fail. */ }
    end(session,'cancelled',message);
    return true;
  }

  function replay(socket: WebSocket) {
    for (const [role,session] of sessions) {
      const original = session.participants.find(p => p.role === role)!.packet;
      const home = original.home!;
      const elapsed = session.activeAt === null ? (Date.now()-session.started)/hooks.timeScale : Infinity;
      hooks.send(socket,{ ...original, home: { ...home, ...sampled(home,elapsed) } });
      if (session.activeAt !== null)
        hooks.send(socket,{ type:'task_active', role, taskId:original.taskId, elapsedMs:Date.now()-session.activeAt });
    }
  }

  function invitation(role: CharacterId, socket: WebSocket, message: Record<string, unknown>) {
    if (message.type === 'movie_invite') {
      const genre = message.genre;
      if (typeof genre !== 'string' || !Object.hasOwn(GENRES, genre)) return error(socket,'Неизвестный жанр');
      const denial = taskAccessError(hooks.state(), { type: 'movie', genre: genre as Genre });
      if (denial) return error(socket, denial);
      if (!hooks.socket(otherRole(role))) return error(socket,'Второй игрок пока не в сети');
      if (invite) return error(socket,'Уже есть приглашение на фильм');
      if (!available(role) || !available(otherRole(role)) || reserved('tv'))
        return error(socket,'Для просмотра оба должны быть свободны дома, а телевизор — выключен');
      const id = ++nextInviteId;
      invite = { id,from:role,genre:genre as Genre,timer:setTimeout(() => closeInvite('Время ответа истекло'),30_000) };
      hooks.all({ type:'movie_offer',inviteId:id,from:role,genre:invite.genre });
      return;
    }
    if (!invite || message.inviteId !== invite.id) return error(socket,'Это приглашение уже закрыто');
    if (message.type === 'movie_withdraw' && invite.from === role) return closeInvite('Приглашение отозвано');
    if (message.type !== 'movie_reply' || role === invite.from || typeof message.accept !== 'boolean')
      return error(socket,'Ответить может только приглашённый игрок');
    if (!message.accept) return closeInvite('Приглашение отклонено');
    const {from,genre} = invite;
    const denial = taskAccessError(hooks.state(), { type: 'movie', genre });
    if (denial) return closeInvite(denial);
    if (!available(from) || !available(role) || reserved('tv')) {
      closeInvite('Кто-то занят или вышел из дома. Попробуйте ещё раз'); return;
    }
    closeInvite('Приглашение принято');
    start([from,role],planTask({type:'movie',genre})!,socket);
  }

  function recheckAccess() {
    for (const session of new Set(sessions.values())) {
      const reason = taskAccessError(hooks.state(), session.plan.command);
      if (reason) cancel(session.participants[0].role, reason);
    }
    if (invite) {
      const reason = taskAccessError(hooks.state(), { type: 'movie', genre: invite.genre });
      if (reason) closeInvite(reason);
    }
  }

  return { busy, reserved, start, cancel, replay, invitation, recheckAccess,
    automatic: (role: CharacterId) => sessions.get(role)?.participants[0]?.packet.automatic === true,
    closeInvite,
    dispose() {
      for (const session of sessions.values()) clearTimeout(session.timer);
      sessions.clear();
      if (invite) clearTimeout(invite.timer);
      invite = null;
    },
  };
}
