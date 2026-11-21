import { taskAccessError } from '../src/shared/serviceAccess';
import WebSocket from 'ws';
import { BATH_ACTIONS, BATH_FIXTURES, GRILL_WORK, HOME_FLOOR, HOME_WALK_SPEED, homeSeat, KITCHEN_WORK, LIBRARY_APPROACH } from '../src/shared/home';
import { isGrillRecipe } from '../src/shared/food';
import { GENRES, HOME_SEATS, YOUTUBE, type Genre, type HomePresentation, type HomeSeat } from '../src/shared/homeLife';
import { approachFor, floorFor, placeObstacles, stationById } from '../src/shared/locations';
import { points, type CharacterId, type GameState, type ServerPacket, type TimedCommand } from '../src/shared/protocol';
import { GAME_MINUTES_PER_REAL_SECOND } from '../src/shared/life';
import type { StudyMaterial } from '../src/shared/education';
import { MATERIAL_BY_ID, studyQuestion, studyQuestions } from '../src/shared/educationCatalog';
import { answerMatches, awardActivity, completeStudy, saveBookMinutes, studyDenial, studyMinutes } from './education';
import { planWalk, sampleWalk, type WalkRoute } from '../src/game/navigation';
import { otherRole } from './social';
import { entertainmentReward, evaluateTask, planTask, type TaskPlan } from './tasks';
import { gains } from './needs';
import { needsItem, SOCIAL_BY_ID, SOCIAL_TTL_MS, socialText, type SocialIntent, type SocialOffer, type SocialPhase } from '../src/shared/socialLife';
import { completeTogether, cooperationDenial, pairScenes, socialDuration, socialPet, socialResource, addRelationship } from './society';
import type { PetId } from '../src/shared/pets';

type Started = Extract<ServerPacket, { type: 'task_started' }>;
type Participant = { role: CharacterId; socket: WebSocket; packet: Started; arriveMs: number };
type Cooperation = { from:CharacterId; choice:number };
type Session = {
  plan: TaskPlan;
  participants: Participant[];
  started: number;
  activeAt: number | null;
  duration: number;
  timer: ReturnType<typeof setTimeout>;
  cooperation?: Cooperation;
  finishedTogether?: boolean;
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
  pausePet?(pet:PetId):void;
  socialTtlMs?:number;
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
  return command.type === 'study' || isEntertainment(command) || command.type === 'cook' ||
    (command.type === 'eat' && isGrillRecipe(command.recipe)) || command.type === 'act' &&
    (Object.hasOwn(BATH_ACTIONS, command.actionId) ||
      ['sofaRest','sofaMusic','sofaCall','tableRest','tableTalk','tablePlan','officeChairSit'].includes(command.actionId));
}

export function createHomeSessions(hooks: Hooks) {
  const sessions = new Map<CharacterId, Session>();
  let invite: Invite | null = null;
  let nextInviteId = 0;
  let socialInvite: { offer:SocialOffer; command:SocialIntent; timer:ReturnType<typeof setTimeout>; cookTask?:number } | null=null;
  const lastProposal: Partial<Record<CharacterId,number>>={};
  function closeSocial(phase:SocialPhase,message:string,reply?:string) {
    if(!socialInvite)return;
    const {offer,timer}=socialInvite;
    clearTimeout(timer);
    socialInvite=null;
    hooks.all({type:'social_closed',inviteId:offer.id,phase,message,reply});
  }
  const busy = (role: CharacterId) => sessions.has(role);
  const available = (role: CharacterId) => hooks.socket(role)?.readyState === WebSocket.OPEN &&
    !busy(role) && !hooks.busy(role);
  const error = (socket: WebSocket, reason: string) => hooks.send(socket, { type: 'error', reason });
  const broadcastSnapshot = () => hooks.all({ type: 'snapshot', state: hooks.state() });
  const closeInvite = (message: string) => {
    closeSocial('interrupted',message);
    if (!invite) return;
    clearTimeout(invite.timer);
    hooks.all({ type: 'movie_offer_closed', inviteId: invite.id, message });
    invite = null;
  };
  const reserved = (resource: string | null) => resource !== null &&
    [...sessions.values()].some(session => session.plan.resource === resource);
  const cookFor=(role:CharacterId)=>{
    const session=sessions.get(role);
    const command=session?.plan.command;
    return session?.participants.length===1&&command?.type==='cook'?{ command,id:session.participants[0].packet.taskId }:undefined;
  };

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
      if(command.type==='cook'&&!isGrillRecipe(command.recipe)){
        const pantry=walk(from,stationById('home','fridge')!.approach);
        const stove=pantry&&walk(pantry.path.at(-1)??pantry.from,KITCHEN_WORK.stove.position);
        return pantry&&stove&&{station:'kitchenCook',route:{from:pantry.from,path:[...pantry.path,...stove.path]},
          pickup:pantry.path.length,pickupMs:950};
      }
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
    if(session.cooperation){completeSocial(session);return;}
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

  function socialHomes(session:Session):Record<CharacterId,HomePresentation> {
    return Object.fromEntries(session.participants.map(p=>[p.role,p.packet.home!])) as Record<CharacterId,HomePresentation>;
  }
  function completeSocial(session:Session) {
    const before=hooks.state(), roles=session.participants.map(p=>p.role);
    const command=session.plan.command as SocialIntent;
    const {from,choice}=session.cooperation!;
    const result=completeTogether(before,from,command,roles,choice,socialHomes(session));
    if(!result.ok){end(session,'failed',result.reason);return;}
    if(session.finishedTogether&&roles.length===1) addRelationship(result.state,SOCIAL_BY_ID.get(command.action)!,choice);
    try{hooks.save(result.state);}
    catch{end(session,'failed','Не удалось сохранить совместное занятие');return;}
    broadcastSnapshot();
    for(const {role,packet} of session.participants){
      sessions.delete(role);
      hooks.all({type:'task_ended',role,taskId:packet.taskId,outcome:'completed',message:result.message,effects:gains(before,result.state,role)});
    }
  }

  function start(roles: CharacterId[], plan: TaskPlan, initiator: WebSocket, automatic = false, cooperation?:Cooperation) {
    const command = plan.command;
    const material = command.type === 'study' ? MATERIAL_BY_ID.get(command.material) : undefined;
    const denial = command.type==='together'&&cooperation?cooperationDenial(hooks.state(),cooperation.from,command):taskAccessError(hooks.state(), command);
    if (denial) { if (!automatic) error(initiator, denial); return; }
    const resource = plan.resource;
    const occupant = [...sessions.values()].find(session => resource && session.plan.resource === resource);
    if ((occupant && (automatic || !occupant.participants[0].packet.automatic)) ||
        (resource !== null && hooks.resourceBusy(resource))) {
      if (!automatic) error(initiator, 'Это место сейчас занято вторым игроком');
      return;
    }
    if (roles.some(role => !available(role) || !material && !cooperation && hooks.state().world.places[role] !== 'home')) {
      if (!automatic) error(initiator, 'Для занятия нужно быть свободным и находиться в нужной локации'); return;
    }
    const profile = hooks.state().education.characters[roles[0]];
    const study = material && { material, start: 0, previous: profile.studied[material.id]?.minutes ?? 0,
      minutes: studyMinutes(profile, material),
      questions: studyQuestions(material, profile.enrollments[material.id]?.attended ??
        profile.studied[material.id]?.completions ?? 0), correct: 0, lastAnswer: 0 };
    const duration = Math.max(15, Math.round((study ? study.minutes / GAME_MINUTES_PER_REAL_SECOND * 1000 : plan.durationMs) * hooks.timeScale));
    const participants: Participant[] = [];
    for(const role of roles) hooks.prepare(role,resource==='tv');
    if(cooperation&&command.type==='together'){
      const pet=socialPet(command);
      if(pet)hooks.pausePet?.(pet);
    }
    const pair=command.type==='together'&&cooperation?pairScenes(hooks.state(),cooperation.from,command):undefined;
    if(cooperation&&!pair){error(initiator,'Не удалось найти два свободных подхода');return;}
    for (const role of roles) {
      const reason = material && studyDenial(hooks.state(), role, material, hooks.gameTime());
      if (reason) { error(initiator, reason); return; }
      const home = pair?.[role]??presentation(role, command);
      if (!home) { if (!automatic) error(initiator, 'Не удалось найти свободный маршрут'); return; }
      if (study?.questions[0]) home.question = study.questions[0];
      const before = hooks.state();
      const result = material || cooperation ? undefined : evaluateTask(before, role, command, roles.length === 2);
      if (result && !result.ok) { if (!automatic) error(initiator, result.reason); return; }
      const effects = !result ? undefined : isEntertainment(command) ? entertainmentReward(command, roles.length === 2)
        : command.type === 'act' && command.actionId === 'bathTeeth' ? {hygiene:20}
        : command.type === 'act' && command.actionId === 'bathShower' ? {hygiene:75}
        : gains(before,result.state,role);
      participants.push({ role, socket: hooks.socket(role)!, arriveMs: 1000*length(home.route)/HOME_WALK_SPEED+(home.pickupMs??0)+(home.pair?.offsetMs??0),
        packet: { type: 'task_started', role, taskId: hooks.nextId(), command, label: plan.label,
          durationMs: duration, home, effects, automatic } });
    }
    if (occupant) cancel(occupant.participants[0].role,'Место освободилось для игрока');
    const travel = Math.max(0,...participants.map(p => p.arriveMs));
    const session: Session = { plan: { ...plan, resource }, participants, started: Date.now(), activeAt: null, study, cooperation,
      duration, timer: setTimeout(() => {
        if(cooperation&&command.type==='together'){
          const reason=cooperationDenial(hooks.state(),cooperation.from,command);
          if(reason){cancel(cooperation.from,reason);return;}
        }
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
    return true;
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
    const current = study.questions[study.correct];
    const correct = answerMatches(current, choice);
    const insight = studyQuestion(current)?.explanation ?? study.material.description;
    if (correct) study.correct++;
    const question = study.questions[study.correct];
    hooks.send(socket, { type: 'education_feedback', taskId: taskId as number, correct, question,
      message: correct
        ? (question ? 'Верно! ' : 'Все задания решены. ') + insight
        : 'Пока неверно. Разбор: ' + insight });
    if (study.material.channel === 'exam' && !correct)
      end(session, 'failed', 'Аттестация пока не сдана. Повтори тему и попробуй ещё раз');
  }

  function cancel(role: CharacterId, message: string, taskId?: number): boolean {
    const session = sessions.get(role);
    if (!session || (taskId !== undefined && !session.participants.some(p => p.role === role && p.packet.taskId === taskId))) return false;
    const independent=session.cooperation&&session.plan.command.type==='together'&&
      SOCIAL_BY_ID.get(session.plan.command.action)?.independent&&session.activeAt!==null&&session.participants.length===2;
    const members=independent?session.participants.filter(p=>p.role===role):session.participants;
    const next = structuredClone(hooks.state());
    checkpoint(next, session);
    for (const {role,packet} of members) {
      const elapsed = session.activeAt === null ? (Date.now()-session.started)/hooks.timeScale : Infinity;
      const home=packet.home!;
      const end=home.route.path.at(-1)??home.route.from;
      const position=home.pair?.stroll&&session.activeAt!==null?
        sampleWalk({from:end,path:home.pair.stroll},HOME_WALK_SPEED*(Date.now()-session.activeAt)/1000).from:sampled(home,elapsed).route.from;
      Object.assign(next.characters[role],position,{pose:'idle'});
    }
    next.revision++;
    try { hooks.save(next); broadcastSnapshot(); }
    catch { /* Cancellation still releases every resource if disk writes fail. */ }
    if(independent){
      session.participants=session.participants.filter(p=>p.role!==role);
      sessions.delete(role);
      hooks.all({type:'task_ended',role,taskId:members[0].packet.taskId,outcome:'cancelled',message});
    }else end(session,'cancelled',message);
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

  function finishSocial(role:CharacterId,socket:WebSocket,taskId:unknown) {
    const s=sessions.get(role);
    const command=s?.plan.command;
    const member=s?.participants.find(p=>p.role===role&&p.packet.taskId===taskId);
    if(!s?.cooperation||command?.type!=='together'||!member||s.activeAt===null||s.participants.length!==2||
      !['eat','takeout','cafeMeal'].includes(command.action)||Date.now()-s.activeAt<s.duration*.72)
      return error(socket,'Дайте персонажу время закончить свою порцию');
    const before=hooks.state();
    const result=completeTogether(before,role,command,[role],s.cooperation.choice,socialHomes(s),false);
    if(!result.ok)return error(socket,result.reason);
    try{hooks.save(result.state);}catch{return error(socket,'Не удалось сохранить порцию');}
    s.finishedTogether=true;
    s.participants=s.participants.filter(p=>p!==member);
    sessions.delete(role);
    broadcastSnapshot();
    hooks.all({type:'task_ended',role,taskId:member.packet.taskId,outcome:'completed',message:result.message,effects:gains(before,result.state,role)});
  }

  function social(role:CharacterId,socket:WebSocket,message:Record<string,unknown>) {
    if(message.type==='social_finish'){finishSocial(role,socket,message.taskId);return;}
    if(message.type==='social_propose'){
      if(invite||socialInvite)return error(socket,'Другое приглашение уже ждёт ответа');
      const partner=otherRole(role), helper=message.action==='joinCook', cook=helper?cookFor(partner):undefined;
      if(helper&&!cook)return error(socket,'Партнёр сейчас не готовит');
      if(!available(role)||(!cook&&!available(partner)))return error(socket,'Оба игрока должны быть в сети и свободны');
      if(Date.now()-(lastProposal[role]??0)<600)return error(socket,'Подожди перед следующим приглашением');
      const a=cook?SOCIAL_BY_ID.get(isGrillRecipe(cook.command.recipe)?'grill':'cook'):
        typeof message.action==='string'?SOCIAL_BY_ID.get(message.action):undefined;
      if(!a)return error(socket,'Неизвестное совместное занятие');
      const cmd:SocialIntent={type:'together',action:a.id,
        item:cook?.command.recipe??(needsItem(a)&&typeof message.item==='string'?message.item:undefined)};
      const reason=cooperationDenial(hooks.state(),role,cmd);
      if(reason)return error(socket,reason);
      const resource=socialResource(a,cmd.item);
      if(!cook&&resource&&(reserved(resource)||hooks.resourceBusy(resource)))return error(socket,'Объект уже используется');
      const ttl=hooks.socialTtlMs??SOCIAL_TTL_MS;
      const offer:SocialOffer={id:++nextInviteId,from:role,action:a.id,title:cook?'Помочь с готовкой':a.title,
        text:cook?'Я могу подготовить продукты или помочь с подачей. Присоединиться?':socialText(a,hooks.state(),role),
        replies:cook?['Да, продолжим вместе.','Да, мне пригодится помощь с подачей.']:a.replies,expiresAt:Date.now()+ttl};
      socialInvite={offer,command:cmd,cookTask:cook?.id,timer:setTimeout(()=>closeSocial('expired','Время ответа истекло'),ttl)};
      lastProposal[role]=Date.now();
      hooks.all({type:'social_pending',offer});
      return;
    }
    if(!socialInvite||message.inviteId!==socialInvite.offer.id)return error(socket,'Это приглашение уже закрыто');
    const {offer,command,cookTask}=socialInvite;
    if(Date.now()>=offer.expiresAt)return closeSocial('expired','Время ответа истекло');
    if(message.type==='social_withdraw'&&offer.from===role)return closeSocial('cancelled','Приглашение отозвано');
    if(message.type!=='social_reply'||offer.from===role)return error(socket,'Ответить может только приглашённый игрок');
    if(message.choice===null)return closeSocial('declined','Приглашение отклонено');
    if(typeof message.choice!=='number'||!Number.isInteger(message.choice)||message.choice<0||message.choice>=offer.replies.length)
      return error(socket,'Выбери один из ответов');
    if(cookTask&&cookFor(role)?.id!==cookTask)return closeSocial('interrupted','Эта готовка уже завершена');
    if((!cookTask&&!available(role))||!available(offer.from))return closeSocial('interrupted','Кто-то уже занят или вышел из игры');
    const reason=cooperationDenial(hooks.state(),offer.from,command);
    if(reason)return closeSocial('interrupted',reason);
    const a=SOCIAL_BY_ID.get(offer.action)!;
    const plan={command,label:a.title,durationMs:socialDuration(a,command),resource:socialResource(a,command.item)};
    if(cookTask){
      if(!pairScenes(hooks.state(),role,command))return closeSocial('interrupted','У столешницы нет двух свободных подходов');
      cancel(role,'Готовка продолжится вдвоём',cookTask);
    }
    if(!start([offer.from,role],plan,socket,false,{from:cookTask?role:offer.from,choice:message.choice}))
      return closeSocial('interrupted','Не удалось начать занятие');
    closeSocial('accepted','Приглашение принято',offer.replies[message.choice]);
  }

  function invitation(role: CharacterId, socket: WebSocket, message: Record<string, unknown>) {
    if (message.type === 'movie_invite') {
      const genre = message.genre;
      if (typeof genre !== 'string' || !Object.hasOwn(GENRES, genre)) return error(socket,'Неизвестный жанр');
      const denial = taskAccessError(hooks.state(), { type: 'movie', genre: genre as Genre });
      if (denial) return error(socket, denial);
      if (!hooks.socket(otherRole(role))) return error(socket,'Второй игрок пока не в сети');
      if (invite||socialInvite) return error(socket,'Другое приглашение уже ждёт ответа');
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
      const command=session.plan.command;
      if(command.type==='together'&&session.cooperation){
        const individual=session.participants.length===1;
        const reason=cooperationDenial(hooks.state(),individual?member:session.cooperation.from,command,individual);
        if(reason)for(const participant of [...session.participants])cancel(participant.role,reason);
        continue;
      }
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

  return { busy, reserved, start, cancel, replay, invitation, social, recheckAccess, answer, checkpoint,
    automatic: (role: CharacterId) => sessions.get(role)?.participants[0]?.packet.automatic === true,
    closeInvite,
    dispose() {
      for (const session of sessions.values()) clearTimeout(session.timer);
      sessions.clear();
      if (invite) clearTimeout(invite.timer);
      if(socialInvite)clearTimeout(socialInvite.timer);
      socialInvite=null;
      invite = null;
    },
  };
}
