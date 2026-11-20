import { taskAccessError } from '../src/shared/serviceAccess';
import WebSocket from 'ws';
import { BATH_ACTIONS, BATH_FIXTURES, GRILL_WORK, HOME_FLOOR, HOME_WALK_SPEED, homeSeat, LIBRARY_APPROACH } from '../src/shared/home';
import { isGrillRecipe } from '../src/shared/food';
import { GENRES, HOME_SEATS, YOUTUBE, type Genre, type HomePresentation, type HomeSeat } from '../src/shared/homeLife';
import { approachFor, floorFor, placeObstacles, stationById } from '../src/shared/locations';
import { points, type CharacterId, type GameState, type ServerPacket, type TimedCommand } from '../src/shared/protocol';
import { GAME_MINUTES_PER_REAL_SECOND } from '../src/shared/life';
import type { StudyMaterial } from '../src/shared/education';
import { MATERIAL_BY_ID, studyQuestions } from '../src/shared/educationCatalog';
import { answerMatches, awardActivity, completeStudy, saveBookMinutes, studyDenial, studyMinutes } from './education';
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
  study?: { material: StudyMaterial; start: number; previous: number; minutes: number;
    questions: string[]; correct: number; lastAnswer: number };
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
  gameTime(): number;
  resourceBusy(resource: string): boolean;
};
const obstacles = placeObstacles('home');
const readingSeats: HomeSeat[] = HOME_SEATS.filter(seat => seat !== 'officeChair');
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
  return command.type === 'study' || isEntertainment(command) || ((command.type === 'cook' || command.type === 'eat') && isGrillRecipe(command.recipe)) || command.type === 'act' &&
    (Object.hasOwn(BATH_ACTIONS, command.actionId) ||
      ['sofaRest','sofaMusic','sofaCall','tableRest','tableTalk','tablePlan','officeChairSit'].includes(command.actionId));
}

export function createHomeSessions(hooks: Hooks) {
  const sessions = new Map<CharacterId, Session>();
  let invite: Invite | null = null;
  let nextInviteId = 0;
  const busy = (role: CharacterId) => sessions.has(role);
  const available = (role: CharacterId) => hooks.socket(role)?.readyState === WebSocket.OPEN &&
    !busy(role) && !hooks.busy(role);
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
    const { x, z } = hooks.state().characters[role];
    const from = { x, z };
    const walk = (origin: WalkRoute['from'], to: WalkRoute['from']) => planWalk(origin, to, obstacles, HOME_FLOOR);
    if (command.type === 'study') {
      const material = MATERIAL_BY_ID.get(command.material)!;
      if (material.station) {
        const site = stationById('education', material.station)!;
        const route = planWalk(from, approachFor(site, role), placeObstacles('education'), floorFor('education'));
        return route && { route, station: material.station };
      }
      if (material.channel === 'book') {
        const pickup = walk(from, LIBRARY_APPROACH);
        const station = 'table';
        const seat = pickup && walk(pickup.path.at(-1) ?? pickup.from, homeSeat(station, role).approach);
        return pickup && seat && { station, route: { from: pickup.from, path: [...pickup.path, ...seat.path] },
          pickup: pickup.path.length, pickupMs: 720 };
      }
      if (material.channel === 'tv') {
        const route = walk(from, homeSeat('sofa', role).approach);
        return route && { route, station: 'sofa', program: 'lesson', lesson: material.id };
      }
      if (material.channel === 'academy') {
        const route = walk(from, points.desk);
        return route && { route, station: 'studyDesk' };
      }
      if (material.skill === 'fitness') {
        const route = walk(from, { x: role === 'vlad' ? -1.59 : -.77, z: 8.68 });
        return route && { route, station: 'studyPractice' };
      }
      const route = walk(from, homeSeat('table', role).approach);
      return route && { route, station: 'table' };
    }
    if (command.type === 'act' && command.actionId in BATH_ACTIONS) {
      const station = BATH_ACTIONS[command.actionId as keyof typeof BATH_ACTIONS];
      const route = walk(from, BATH_FIXTURES[station].approach);
      return route && { route, station };
    }
    if (command.type === 'cook' || command.type === 'eat') {
      const station = command.type === 'cook' ? 'grill' : 'yardTable';
      const route = walk(from, station === 'grill' ? GRILL_WORK.position : homeSeat(station, role).approach);
      return route && { route, station };
    }
    if (command.type === 'read_book') {
      const pickup = walk(from, LIBRARY_APPROACH);
      if (!pickup) return null;
      const index = Math.floor(Math.random() * readingSeats.length);
      const order = command.seat ? [command.seat] : [...readingSeats.slice(index), ...readingSeats.slice(0,index)];
      for (const station of order) {
        const route = walk(pickup.path.at(-1) ?? pickup.from, homeSeat(station, role).approach);
        if (route) return { route: { from: pickup.from, path: [...pickup.path, ...route.path] },
          pickup: pickup.path.length, pickupMs: 720, station };
      }
      return null;
    }
    const station = command.type === 'act' && command.actionId === 'officeChairSit' ? 'officeChair'
      : command.type === 'act' && command.actionId.startsWith('table') ? 'table' : 'sofa';
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
      const result = session.study ? (() => {
        const state = structuredClone(next);
        const message = completeStudy(state, role, session.study!.material, Math.floor(hooks.gameTime()));
        state.revision++;
        return { ok: true as const, state, message };
      })() : evaluateTask(next, role, session.plan.command, session.participants.length === 2);
      if (!result.ok) { end(session, 'failed', result.reason); return; }
      const route = packet.home!.route;
      const seat = packet.home!.station;
      const seated = seat !== 'officeChair' && HOME_SEATS.some(item => item === seat);
      Object.assign(result.state.characters[role], route.path.at(-1) ?? route.from, { pose: seated ? 'sit' : 'idle' });
      if (!session.study && !packet.automatic) awardActivity(result.state, role, session.plan.command, session.plan.label);
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
    const command = session.plan.command;
    if (command.type === 'act' && command.actionId === 'toiletUse') {
      const { role, socket } = session.participants[0];
      start([role], planTask({ type: 'act', actionId: 'wcWash' })!, socket, true);
    }
  }

  function start(roles: CharacterId[], plan: TaskPlan, initiator: WebSocket, automatic = false) {
    const command = plan.command;
    const material = command.type === 'study' ? MATERIAL_BY_ID.get(command.material) : undefined;
    const denial = taskAccessError(hooks.state(), command);
    if (denial) { if (!automatic) error(initiator, denial); return; }
    const resource = plan.resource;
    const occupant = [...sessions.values()].find(session => resource && session.plan.resource === resource);
    if ((occupant && (automatic || !occupant.participants[0].packet.automatic)) ||
        (resource !== null && hooks.resourceBusy(resource))) {
      if (!automatic) error(initiator, 'Это место сейчас занято вторым игроком');
      return;
    }
    if (roles.some(role => !available(role) || !material && hooks.state().world.places[role] !== 'home')) {
      if (!automatic) error(initiator, 'Для занятия нужно быть свободным и находиться в нужной локации'); return;
    }
    const profile = hooks.state().education.characters[roles[0]];
    const study = material && { material, start: 0, previous: profile.studied[material.id]?.minutes ?? 0,
      minutes: studyMinutes(profile, material),
      questions: studyQuestions(material, profile.enrollments[material.id]?.attended), correct: 0, lastAnswer: 0 };
    const duration = Math.max(15, Math.round((study ? study.minutes / GAME_MINUTES_PER_REAL_SECOND * 1000 : plan.durationMs) * hooks.timeScale));
    const participants: Participant[] = [];
    for (const role of roles) {
      const reason = material && studyDenial(hooks.state(), role, material, hooks.gameTime());
      if (reason) { error(initiator, reason); return; }
      hooks.prepare(role, resource === 'tv');
      const home = presentation(role, command);
      if (!home) { if (!automatic) error(initiator, 'Не удалось найти свободный маршрут'); return; }
      if (study?.questions[0]) home.question = study.questions[0];
      const before = hooks.state();
      const result = material ? undefined : evaluateTask(before, role, command, roles.length === 2);
      if (result && !result.ok) { if (!automatic) error(initiator, result.reason); return; }
      const effects = !result ? undefined : isEntertainment(command) ? entertainmentReward(command, roles.length === 2)
        : command.type === 'act' && command.actionId === 'bathTeeth' ? {hygiene:20}
        : command.type === 'act' && command.actionId === 'bathShower' ? {hygiene:75}
        : gains(before,result.state,role);
      participants.push({ role, socket: hooks.socket(role)!, arriveMs: 1000*length(home.route)/HOME_WALK_SPEED+(home.pickupMs??0),
        packet: { type: 'task_started', role, taskId: hooks.nextId(), command, label: plan.label,
          durationMs: duration, home, effects, automatic } });
    }
    if (occupant) cancel(occupant.participants[0].role,'Место освободилось для игрока');
    const travel = Math.max(0,...participants.map(p => p.arriveMs));
    const session: Session = { plan: { ...plan, resource }, participants, started: Date.now(), activeAt: null, study,
      duration, timer: setTimeout(() => {
        session.activeAt = Date.now();
        for (const {role,packet} of participants) {
          hooks.all({ type: 'task_active', role, taskId: packet.taskId, elapsedMs: 0 });
        }
        if (study) {
          study.start = hooks.gameTime();
          const tick = () => {
            const elapsed = studyElapsed(session);
            sendProgress(session, elapsed);
            if (elapsed >= study.minutes && study.correct === study.questions.length) complete(session);
            else if (elapsed > study.minutes + 8) end(session, 'failed', 'Занятие закончено. Для зачёта нужен ответ');
            else session.timer = setTimeout(tick, 500);
          };
          tick();
        } else session.timer = setTimeout(() => complete(session), session.duration);
      }, Math.round(travel * hooks.timeScale)) };
    for (const participant of participants) {
      sessions.set(participant.role, session);
      hooks.all(participant.packet);
    }
  }

  const studyElapsed = (session: Session) => (hooks.gameTime() - session.study!.start) / hooks.timeScale;
  function sendProgress(session: Session, elapsed: number, socket?: WebSocket) {
    for (const { role, packet } of session.participants) {
      const progress: ServerPacket = { type: 'study_progress', role, taskId: packet.taskId,
        elapsed: Math.floor(Math.min(session.study!.minutes, Math.max(0, elapsed)) * 10) / 10, total: session.study!.minutes };
      if (socket) hooks.send(socket, progress); else hooks.all(progress);
    }
  }
  function checkpoint(state: GameState, progress?: Session) {
    for (const session of progress ? [progress] : new Set(sessions.values())) {
      if (!session.study || session.activeAt === null) continue;
      const { role } = session.participants[0];
      saveBookMinutes(state, role, session.study.material, session.study.previous + studyElapsed(session));
    }
  }
  function answer(role: CharacterId, socket: WebSocket, taskId: unknown, choice: unknown) {
    const session = sessions.get(role);
    const study = session?.study;
    if (!session || !study?.questions.length || session.activeAt === null || typeof choice !== 'number' ||
        !Number.isInteger(choice) || choice < 0 || choice > 2 ||
        !session.participants.some(person => person.role === role && person.packet.taskId === taskId))
      return error(socket, 'Сейчас нет активного задания для ответа');
    if (study.correct === study.questions.length) return;
    if (Date.now() - study.lastAnswer < 900) return;
    study.lastAnswer = Date.now();
    const correct = answerMatches(study.questions[study.correct], choice);
    if (correct) study.correct++;
    const question = study.questions[study.correct];
    hooks.send(socket, { type: 'education_feedback', taskId: taskId as number, correct, question,
      message: correct ? question ? 'Верно. Следующий вопрос' : 'Верно. Задание зачтено после занятия'
        : 'Ответ не подходит. ' + study.material.description });
    if (study.material.channel === 'exam' && !correct)
      end(session, 'failed', 'Аттестация пока не сдана. Повтори тему и попробуй ещё раз');
  }

  function cancel(role: CharacterId, message: string, taskId?: number): boolean {
    const session = sessions.get(role);
    if (!session || (taskId !== undefined && !session.participants.some(p => p.role === role && p.packet.taskId === taskId))) return false;
    const next = structuredClone(hooks.state());
    checkpoint(next, session);
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
      hooks.send(socket,{ ...original, home: { ...home, ...sampled(home,elapsed),
        question: session.study?.questions[session.study.correct] } });
      if (session.activeAt !== null)
        hooks.send(socket,{ type:'task_active', role, taskId:original.taskId, elapsedMs:Date.now()-session.activeAt });
      if (session.study && session.activeAt !== null) sendProgress(session, studyElapsed(session), socket);
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
      const member = session.participants[0].role;
      const reason = session.study?.material.channel === 'academy'
        ? studyDenial(hooks.state(), member, session.study.material, hooks.gameTime())
        : taskAccessError(hooks.state(), session.plan.command);
      if (reason) cancel(session.participants[0].role, reason);
    }
    if (invite) {
      const reason = taskAccessError(hooks.state(), { type: 'movie', genre: invite.genre });
      if (reason) closeInvite(reason);
    }
  }

  return { busy, reserved, start, cancel, replay, invitation, recheckAccess, answer, checkpoint,
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
