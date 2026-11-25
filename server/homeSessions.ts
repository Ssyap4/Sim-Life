import {fitnessTaskSpeed} from '../src/shared/fitness';
import {laptopDesk,laptopWorkplace,diningLocation} from '../src/shared/furnitureUse';
import {isNotebookDesk,RETIRED_DINING} from '../src/shared/furniture';
import { routeHitsLayout } from './furnishing';
import type { FloorRect } from '../src/game/navigation';
import { catHomeSeatError, catHomeSeatOverlap } from '../src/shared/catOccupancy';
import type { CatPerch } from '../src/shared/CatPerches';
import { HOME_WORLD_FLOOR } from '../src/shared/district';
import { taskAccessError } from '../src/shared/serviceAccess';
import { LEISURE, isLeisureAction } from '../src/shared/leisure';
import { furnitureUseLocation, FURNITURE_ACTIONS } from '../src/shared/furnitureUse';
import { FURNITURE_BY_ID } from '../src/shared/furniture';
import WebSocket from 'ws';
import { BATH_ACTIONS, BATH_FIXTURES, GRILL_WORK, HOME_WALK_SPEED, homeSeat, KITCHEN_WORK, LIBRARY_APPROACH } from '../src/shared/home';
import { isGrillRecipe } from '../src/shared/food';
import { GENRES, HOME_SEATS, YOUTUBE, type Genre, type HomePresentation, type HomeSeat } from '../src/shared/homeLife';
import { approachFor, floorFor, placeObstacles, stationById, HOME_LAPTOP } from '../src/shared/locations';
import { points, type CharacterId, type GameState, type ServerPacket, type TimedCommand } from '../src/shared/protocol';
import { GAME_MINUTES_PER_REAL_SECOND } from '../src/shared/life';
import type { StudyMaterial } from '../src/shared/education';
import { MATERIAL_BY_ID, studyQuestion, studyQuestions } from '../src/shared/educationCatalog';
import { answerMatches, awardActivity, completeStudy, saveBookMinutes, studyDenial, studyMinutes } from './education';
import { planWalk, sampleWalk, type WalkRoute } from '../src/game/navigation';
import { otherRole } from './social';
import { electronicsModel } from "../src/shared/electronics";
import { entertainmentReward, evaluateTask, planTask, type TaskPlan } from './tasks';
import {recordCompletedActivity} from '../src/shared/emotions';
import { wishAtStart, fulfillWish } from './happiness';
import type { Wish } from '../src/shared/wishes';
import { gains } from './needs';
import { familyMoments, momentReward, type FamilyMoment } from '../src/shared/familyMoments';
import {familyAutoTopics,familyAutoLeisure,familyAutonomyReady} from '../src/shared/familyAutonomy';
import { nearbyTalkDenial } from '../src/shared/nearbyTalk';
import { isNearbyTalk, needsItem, SOCIAL_BY_ID, SOCIAL_TTL_MS, socialText, contextAvailable, type SocialIntent, type SocialOffer, type SocialPhase } from '../src/shared/socialLife';
import { parkConversation, completeTogether, cooperationDenial, pairScenes, socialDuration, socialPet, socialResource, addRelationship } from './society';
import type { PetId } from '../src/shared/pets';

type Started = Extract<ServerPacket, { type: 'task_started' }>;
type Participant = { wish?:Wish; role: CharacterId; socket: WebSocket; packet: Started; arriveMs: number };
type Cooperation = { from:CharacterId; choice:number; moment?:FamilyMoment };
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
  conversationPosition?(role:CharacterId):{x:number;z:number}|undefined;
  prepare(role: CharacterId, tv: boolean): void;
  nextId(): number;
  timeScale: number;
  gameTime(): number;
  /** Virtual time and pausable delays supplied by the authoritative server. */
  now?: () => number;
  schedule?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
  resourceBusy(resource: string): boolean;
  pausePet?(pet:PetId):void;
  socialTtlMs?:number;
};

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
import {CONSOLE_GAMES,newConsoleMatch,consoleMatchWinner} from '../src/shared/consoleCatalog';
const isEntertainment = (c: TimedCommand) => c.type === 'movie' || c.type === 'youtube' || c.type === 'read_book' || c.type === 'free_tv' || c.type==='console_play';

export function usesHomeSession(command: TimedCommand): boolean {
  return command.type === 'vanity_care' || command.type === 'furniture_use' || command.type === 'study' || isEntertainment(command) || command.type === 'cook' ||
    (command.type === 'eat' && isGrillRecipe(command.recipe)) || command.type === 'act' &&
    (Object.hasOwn(BATH_ACTIONS, command.actionId) ||
      ['sofaRest','sofaMusic','sofaCall','sofaScroll','tableRest','tableTalk','tablePlan','officeChairSit'].includes(command.actionId));
}

export function createHomeSessions(hooks: Hooks) {
  const now = hooks.now ?? Date.now;
  const schedule: (callback: () => void, ms: number) => ReturnType<typeof setTimeout> =
    hooks.schedule ?? ((callback, ms) => setTimeout(callback, ms) as ReturnType<typeof setTimeout>);
  const clearTimer = hooks.clearTimer ?? clearTimeout;
  const sessions = new Map<CharacterId, Session>();
  let invite: Invite | null = null;
  let nextInviteId = 0;
  let socialInvite: { offer:SocialOffer; command:SocialIntent; timer:ReturnType<typeof setTimeout>; cookTask?:number; parkSession?:Session } | null=null;
  const lastProposal: Partial<Record<CharacterId,number>>={};
  let conversation:{from:CharacterId;action:string;choice:number;automatic:boolean;wishes:Partial<Record<CharacterId,ReturnType<typeof wishAtStart>>>;until:number;timer:ReturnType<typeof setTimeout>}|null=null;
  function conversationReason(from:CharacterId):string|undefined {
    const s=hooks.state(),positions:Partial<Record<CharacterId,{x:number;z:number}>>={};
    for(const r of ['vlad','alina'] as const){
      if(hooks.socket(r)?.readyState!==WebSocket.OPEN)return 'Второй игрок не в сети';
      const session=sessions.get(r);
      if(session){
        const home=session.participants.find(p=>p.role===r)?.packet.home;
        const cmd=session.plan.command;
        // Contact, sports and private hygiene retain exclusive control of the rig.
        if(!home||session.activeAt===null||session.study?.questions.length||home.pair&&['kiss','cheek','hug','closeHug','hands','hair','shoulder','slowDance','highFive','badminton','leisure','cuddle','sofaLean','sofaHands','sofaKiss','sofaHug','bedRest'].includes(home.pair.motion)||
           cmd.type==='vanity_care'||cmd.type==='act'&&Object.hasOwn(BATH_ACTIONS,cmd.actionId)||
           cmd.type==='furniture_use'&&Object.hasOwn(BATH_ACTIONS,cmd.action))return 'Сейчас разговор будет мешать занятию';
        const end=home.route.path.at(-1)??home.route.from;
        positions[r]=home.pair?.stroll?sampleWalk({from:end,path:home.pair.stroll},HOME_WALK_SPEED*(now()-session.activeAt)/1000).from:end;
      }else positions[r]=hooks.conversationPosition?hooks.conversationPosition(r):hooks.busy(r)?undefined:s.characters[r];
    }
    return nearbyTalkDenial(s,from,positions);
  }
  function stopConversation(completed=false){
    if(!conversation)return;
    const c=conversation;conversation=null;clearTimer(c.timer);
    if(completed&&!conversationReason(c.from)&&(!c.automatic||familyAutonomyReady(hooks.state()))){
      const a=SOCIAL_BY_ID.get(c.action)!;
      try{const before=hooks.state(),next=parkConversation(before,c.from,a,c.choice);for(const r of ['vlad','alina'] as const){recordCompletedActivity(next,r,{type:'together',action:c.action});if(!c.automatic)fulfillWish(next,r,c.wishes[r],before);}hooks.save(next);broadcastSnapshot();}
      catch{/* No reward if persistence fails. */}
    }
    hooks.all({type:'conversation',from:c.from,remainingMs:0,title:''});
  }
  function startConversation(from:CharacterId,action:string,choice:number,automatic=false){
    const a=SOCIAL_BY_ID.get(action)!;
    const duration=Math.max(15,Math.round(a.seconds*1000*hooks.timeScale));
    const wishes:Partial<Record<CharacterId,ReturnType<typeof wishAtStart>>>={};if(!automatic)for(const r of ['vlad','alina'] as const)wishes[r]=wishAtStart(hooks.state(),r,{type:'together',action});
    conversation={from,action,choice,automatic,wishes,until:now()+duration,timer:schedule(()=>stopConversation(true),duration)};
    hooks.all({type:'conversation',from,remainingMs:duration,title:a.title});
  }
  let lastAutoFamily=-Infinity;
  function autoConversation(from:CharacterId):boolean{
    if(conversation||socialInvite||invite||now()-lastAutoFamily<60000||conversationReason(from))return false;
    const topic=familyAutoTopics(hooks.state(),from)[0];
    if(!topic)return false;
    lastAutoFamily=now();startConversation(from,topic,0,true);return true;
  }
  function autoFamilyLeisure(from:CharacterId):boolean{
    if(conversation||socialInvite||invite||now()-lastAutoFamily<60000)return false;
    const socket=hooks.socket(from);if(!socket)return false;
    for(const action of familyAutoLeisure(hooks.state(),from)){
      const a=SOCIAL_BY_ID.get(action)!,command:SocialIntent={type:'together',action};
      if(!pairScenes(hooks.state(),from,command))continue;
      if(start(['vlad','alina'],{command,label:a.title,durationMs:socialDuration(a,command,hooks.state()),resource:socialResource(a)},socket,true,{from,choice:0})){
        lastAutoFamily=now();return true;
      }
    }
    return false;
  }
  function stopAutoConversation(){if(conversation?.automatic)stopConversation();}
  function closeSocial(phase:SocialPhase,message:string,reply?:string) {
    if(!socialInvite)return;
    const {offer,timer}=socialInvite;
    clearTimer(timer);
    socialInvite=null;
    hooks.all({type:'social_closed',inviteId:offer.id,phase,message,reply});
  }
  const busy = (role: CharacterId) => sessions.has(role);
  const available = (role: CharacterId) => hooks.socket(role)?.readyState === WebSocket.OPEN &&
    !busy(role) && !hooks.busy(role);
  const error = (socket: WebSocket, reason: string) => hooks.send(socket, { type: 'error', reason });
  const broadcastSnapshot = () => hooks.all({ type: 'snapshot', state: hooks.state() });
  const closeInvite = (message: string) => {
    stopConversation();
    closeSocial('interrupted',message);
    if (!invite) return;
    clearTimer(invite.timer);
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
    const walk = (origin: WalkRoute['from'], to: WalkRoute['from']) =>
      planWalk(origin, to, placeObstacles('home',hooks.state().furnishing), HOME_WORLD_FLOOR);
    if(command.type==='vanity_care'){if(role!=='alina')return null;const route=walk(from,points.vanity);return route&&{route,station:'furniture',vanityCare:command.care,furniturePose:{x:points.vanity.x-.88,y:-.28,z:points.vanity.z,yaw:-Math.PI/2},furnitureSeat:true};}
    if(command.type==='furniture_use'){
      if(!Object.hasOwn(FURNITURE_ACTIONS,command.action))return null;
      const table=hooks.state().furnishing.placed.find(p=>p.id===command.furnitureId);
      const dining=table&&['tableRest','tableTalk','tablePlan'].includes(command.action)&&!RETIRED_DINING.some(p=>p.id===table.sku)?diningLocation(hooks.state(),role,table.id):null;
      if(dining&&!dining.seated)return null;
      const choice=dining??furnitureUseLocation(hooks.state(),role,command.furnitureId,command.action);
      if(!choice)return null;
      const seated=(isLeisureAction(command.action)&&LEISURE[command.action].seated)||['sofaRest','sofaMusic','sofaCall','sofaScroll','officeChairSit','tableRest','tableTalk',
        'tablePlan','youtube','movie','free_tv'].includes(command.action)||
        (command.action==='read_book'&&FURNITURE_BY_ID.get(choice.item.sku)?.shape!=='shelves');
      return {route:choice.route,station:'furniture',furnitureId:choice.item.id,
        furniturePose:choice.pose,furnitureSeat:seated,
        program:command.action==='movie'?command.genre:command.action==='youtube'?'vlog':
          command.action==='free_tv'?'broadcast':undefined};
    }
    if (command.type === 'study') {
      const material = MATERIAL_BY_ID.get(command.material)!;
      if (material.station) {
        const site = stationById('education', material.station)!;
        const route = planWalk(from, approachFor(site, role), placeObstacles('education'), floorFor('education'));
        return route && { route, station: material.station };
      }
      if (material.channel === 'book') {
        if(hooks.state().furnishing.soldFixtures?.includes('bookcase')){
          const shelfId=hooks.state().furnishing.placed.find(item=>
            FURNITURE_BY_ID.get(item.sku)?.shape==='shelves')?.id;
          const shelf=shelfId!==undefined?
            furnitureUseLocation(hooks.state(),role,shelfId,'read_book'):null;
          return shelf&&{station:'furniture',route:shelf.route,furnitureId:shelfId,
            furniturePose:shelf.pose,furnitureSeat:false};
        }
        const pickup = walk(from, LIBRARY_APPROACH);
        const station = 'table';
        const seat = pickup && walk(pickup.path.at(-1) ?? pickup.from, homeSeat(station, role).approach);
        return pickup && seat && { station, route: { from: pickup.from, path: [...pickup.path, ...seat.path] },
          pickup: pickup.path.length, pickupMs: 720 };
      }
      if (material.channel === 'tv') {
        if(hooks.state().furnishing.soldFixtures?.includes('sofa')){
          const sofaId=hooks.state().furnishing.placed.find(item=>
            ['sofa','corner'].includes(FURNITURE_BY_ID.get(item.sku)?.shape??''))?.id;
          const sofa=sofaId!==undefined?
            furnitureUseLocation(hooks.state(),role,sofaId,'free_tv'):null;
          return sofa&&{station:'furniture',route:sofa.route,furnitureId:sofaId,
            furniturePose:sofa.pose,furnitureSeat:true,program:'lesson',lesson:material.id};
        }
        const route = walk(from, homeSeat('sofa', role).approach);
        return route && { route, station: 'sofa', program: 'lesson', lesson: material.id };
      }
      if (material.channel === 'academy') {
        if (command.computer === 'laptop') {
          const notebook=laptopDesk(hooks.state());
          const route=notebook?(laptopWorkplace(hooks.state(),role)?.route??null):walk(from, stationById('home',HOME_LAPTOP)!.approach);
          return route && { route, station: 'studyLaptop' };
        }
        if(hooks.state().furnishing.soldFixtures?.includes('desk')){
          const deskId=hooks.state().furnishing.placed.find(item=>
            FURNITURE_BY_ID.get(item.sku)?.shape==='desk'&&!isNotebookDesk(item.sku))?.id;
          const desk=deskId!==undefined?
            furnitureUseLocation(hooks.state(),role,deskId,'deskJournal'):null;
          return desk&&{route:desk.route,station:'studyDesk',furnitureId:deskId,
            furniturePose:desk.pose};
        }
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
      if(hooks.state().furnishing.soldFixtures?.includes('bookcase')){
        const shelfId=hooks.state().furnishing.placed.find(item=>
          FURNITURE_BY_ID.get(item.sku)?.shape==='shelves')?.id;
        const shelf=shelfId!==undefined?
          furnitureUseLocation(hooks.state(),role,shelfId,'read_book'):null;
        return shelf&&{station:'furniture',route:shelf.route,furnitureId:shelfId,
          furniturePose:shelf.pose,furnitureSeat:false};
      }
      const pickup = walk(from, LIBRARY_APPROACH);
      if (!pickup) return null;
      const index = Math.floor(Math.random() * readingSeats.length);
      const order = command.seat ? [command.seat] : [...readingSeats.slice(index), ...readingSeats.slice(0,index)];
      for (const station of order) {
        const route = walk(pickup.path.at(-1) ?? pickup.from, homeSeat(station, role).approach);
        if (route && !catHomeSeatError(hooks.state(),role,{route,station})) return { route: { from: pickup.from, path: [...pickup.path, ...route.path] },
          pickup: pickup.path.length, pickupMs: 720, station };
      }
      return null;
    }
    if((command.type==='movie'||command.type==='youtube'||command.type==='free_tv')&&
      hooks.state().furnishing.soldFixtures?.includes('sofa')){
      const sofaId=hooks.state().furnishing.placed.find(item=>
        ['sofa','corner'].includes(FURNITURE_BY_ID.get(item.sku)?.shape??''))?.id;
      const sofa=sofaId!==undefined?
        furnitureUseLocation(hooks.state(),role,sofaId,'free_tv'):null;
      return sofa&&{station:'furniture',route:sofa.route,furnitureId:sofaId,
        furniturePose:sofa.pose,furnitureSeat:true,
        program:command.type==='movie'?command.genre:
          command.type==='youtube'?'vlog':'broadcast'};
    }
    const station = command.type === 'act' && command.actionId === 'officeChairSit' ? 'officeChair'
      : command.type === 'act' && command.actionId.startsWith('table') ? 'table' : 'sofa';
    const route = walk(from, homeSeat(station, role).approach);
    if (!route) return null;
    const program = command.type === 'free_tv' ? 'broadcast' : command.type === 'movie' ? command.genre
      : command.type === 'youtube' ? YOUTUBE[Math.floor(Math.random() * YOUTUBE.length)]
      : undefined;
    return { route, station, program,consoleGame:command.type==='console_play'?command.game:undefined,consoleMatch:command.type==='console_play'&&CONSOLE_GAMES[command.game].mode==='versus'?newConsoleMatch(false,role):undefined };
  }

  function end(session: Session, outcome: 'cancelled' | 'failed', message: string) {
    clearTimer(session.timer);
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
    for (const { role, packet, wish } of session.participants) {
      const result = session.study ? (() => {
        const state = structuredClone(next);
        const message = completeStudy(state, role, session.study!.material, Math.floor(hooks.gameTime()));
        state.revision++;
        return { ok: true as const, state, message };
      })() : evaluateTask(next, role, session.plan.command, session.participants.length === 2);
      if (!result.ok) { end(session, 'failed', result.reason); return; }
      const route = packet.home!.route;
      const seat = packet.home!.station;
      const seated = seat==='furniture' ? packet.home!.furnitureSeat===true&&session.plan.command.type!=='vanity_care':
        seat !== 'officeChair' && HOME_SEATS.some(item => item === seat);
      Object.assign(result.state.characters[role], route.path.at(-1) ?? route.from,
        { pose: seated ? 'sit' : 'idle' });
      if (!session.study && (!packet.automatic||session.plan.command.type==='cook'))
        awardActivity(result.state, role, session.plan.command, session.plan.label);
      if(session.plan.command.type==='cook'){
        const earned=result.state.education.characters[role].xp.cooking -
          next.education.characters[role].xp.cooking;
        if(earned>0)result.message+=' · 🍲 Кулинария +'+earned+' XP';
      }
      recordCompletedActivity(result.state,role,session.plan.command);
      result.message+=fulfillWish(result.state,role,wish,next);
      next = result.state;
      if(session.plan.command.type==='console_play'&&packet.home?.consoleMatch)result.message+=' · Победитель: '+consoleMatchWinner(packet.home.consoleMatch);
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
    if(session.finishedTogether&&roles.length===1){
      const completedMoment=session.cooperation?.moment;
      addRelationship(result.state,SOCIAL_BY_ID.get(command.action)!,choice,!!completedMoment);
      if(completedMoment)result.message+=momentReward(result.state,from,completedMoment);
    }
    for(const {role,wish} of session.participants){recordCompletedActivity(result.state,role,command);result.message+=fulfillWish(result.state,role,wish,before);}
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
    // Reject impossible pair routes before touching ongoing leisure or pet routines.
    // A failed invitation must leave both residents and their animals undisturbed.
    let pair=command.type==='together'&&cooperation?pairScenes(hooks.state(),cooperation.from,command):undefined;
    if(cooperation&&!pair){
      error(initiator,'Не удалось найти два свободных подхода');
      return;
    }
    const profile = hooks.state().education.characters[roles[0]];
    const study = material && { material, start: 0, previous: profile.studied[material.id]?.minutes ?? 0,
      minutes: studyMinutes(profile, material),
      questions: studyQuestions(material, profile.enrollments[material.id]?.attended ??
        profile.studied[material.id]?.completions ?? 0), correct: 0, lastAnswer: 0 };
    const duration = Math.max(15, Math.round((study ? study.minutes / GAME_MINUTES_PER_REAL_SECOND * 1000 : plan.durationMs/fitnessTaskSpeed(hooks.state(),roles[0],command)) * hooks.timeScale));
    const participants: Participant[] = [];
    const beforePreparation=roles.map(role=>({x:hooks.state().characters[role].x,z:hooks.state().characters[role].z}));
    for(const role of roles) hooks.prepare(role,resource==='tv');
    // Stopping a manually ordered walk advances the resident to their actual
    // position. A pair route planned before that must not start from a stale
    // waypoint. Recompute only when one of those positions really changed.
    if(cooperation&&command.type==='together'&&roles.some((role,i)=>{
      const current=hooks.state().characters[role];
      return current.x!==beforePreparation[i].x||current.z!==beforePreparation[i].z;
    })){
      pair=pairScenes(hooks.state(),cooperation.from,command)??undefined;
      if(!pair){error(initiator,'Не удалось найти подход после остановки движения');return;}
    }
    for (const role of roles) {
      const reason = material && studyDenial(hooks.state(), role, material, hooks.gameTime());
      if (reason) { error(initiator, reason); return; }
      const home = pair?.[role]??presentation(role, command);
      if (!home) { if (!automatic) error(initiator, 'Не удалось найти свободный маршрут'); return; }
      const catReason=catHomeSeatError(hooks.state(),role,home);
      if(catReason){if(!automatic)error(initiator,catReason);return;}
      if (study?.questions[0]) home.question = study.questions[0];
      const before = hooks.state();
      const result = material || cooperation ? undefined : evaluateTask(before, role, command, roles.length === 2);
      if (result && !result.ok) { if (!automatic) error(initiator, result.reason); return; }
      const effects = !result ? undefined : isEntertainment(command) ? entertainmentReward(command, roles.length === 2,electronicsModel(before,role,"tv").bonus,electronicsModel(before,role,"tv").comfort)
        : command.type === 'act' && command.actionId === 'bathTeeth' ? {hygiene:20}
        : command.type === 'act' && command.actionId === 'bathShower' ? {hygiene:75}
        : gains(before,result.state,role);
      participants.push({ wish:automatic?undefined:wishAtStart(before,role,command), role, socket: hooks.socket(role)!, arriveMs: 1000*length(home.route)/HOME_WALK_SPEED+(home.pickupMs??0)+(home.pair?.offsetMs??0),
        packet: { type: 'task_started', role, taskId: hooks.nextId(), command, label: plan.label,
          durationMs: duration, home, effects, automatic } });
    }
    if (occupant) cancel(occupant.participants[0].role,'Место освободилось для игрока');
    // Pause a pet only after both routes and all participant checks are valid.
    if (cooperation && command.type === 'together') {
      const pet = socialPet(command);
      if (pet) hooks.pausePet?.(pet);
    }
    const travel = Math.max(0,...participants.map(p => p.arriveMs));
    const story=command.type==='together'&&cooperation&&command.moment
      ?familyMoments(hooks.state(),cooperation.from).find(m=>m.id===command.moment):undefined;
    const session: Session = { plan: { ...plan, resource }, participants, started: now(), activeAt: null, study,
      cooperation:cooperation?{...cooperation,moment:story}:undefined,
      duration, timer: schedule(() => {
        if(cooperation&&command.type==='together'){
          const reason=cooperationDenial(hooks.state(),cooperation.from,command);
          if(reason){cancel(cooperation.from,reason);return;}
        }
        session.activeAt = now();
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
            else session.timer = schedule(tick, 500);
          };
          tick();
        } else session.timer = schedule(() => complete(session), session.duration);
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
    if (now() - study.lastAnswer < 900) return;
    study.lastAnswer = now();
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
      const elapsed = session.activeAt === null ? (now()-session.started)/hooks.timeScale : Infinity;
      const home=packet.home!;
      const end=home.route.path.at(-1)??home.route.from;
      const position=home.pair?.stroll&&session.activeAt!==null?
        sampleWalk({from:end,path:home.pair.stroll},HOME_WALK_SPEED*(now()-session.activeAt)/1000).from:sampled(home,elapsed).route.from;
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
    if(conversation)hooks.send(socket,{type:'conversation',from:conversation.from,remainingMs:Math.max(0,conversation.until-now()),title:SOCIAL_BY_ID.get(conversation.action)!.title});
    for (const [role,session] of sessions) {
      const original = session.participants.find(p => p.role === role)!.packet;
      const home = original.home!;
      const elapsed = session.activeAt === null ? (now()-session.started)/hooks.timeScale : Infinity;
      hooks.send(socket,{ ...original, home: { ...home, ...sampled(home,elapsed),
        question: session.study?.questions[session.study.correct] } });
      if (session.activeAt !== null)
        hooks.send(socket,{ type:'task_active', role, taskId:original.taskId, elapsedMs:now()-session.activeAt });
      if (session.study && session.activeAt !== null) sendProgress(session, studyElapsed(session), socket);
    }
  }

  function finishSocial(role:CharacterId,socket:WebSocket,taskId:unknown) {
    const s=sessions.get(role);
    const command=s?.plan.command;
    const member=s?.participants.find(p=>p.role===role&&p.packet.taskId===taskId);
    if(!s?.cooperation||command?.type!=='together'||!member||s.activeAt===null||s.participants.length!==2||
      !['eat','takeout','cafeMeal'].includes(command.action)||now()-s.activeAt<s.duration*.72)
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

  const parkSessionFor=(role:CharacterId):Session|undefined=>{
    const session=sessions.get(role),command=session?.plan.command;
    return session&&session.activeAt!==null&&session.participants.length===2&&sessions.get(otherRole(role))===session&&command?.type==='together'&&['picnic','parkSwing'].includes(SOCIAL_BY_ID.get(command.action)?.object??'')&&hooks.state().world.places[role]==='park'&&hooks.state().world.places[otherRole(role)]==='park'?session:undefined;
  };
  function social(role:CharacterId,socket:WebSocket,message:Record<string,unknown>) {
    if(message.type==='social_finish'){finishSocial(role,socket,message.taskId);return;}
    if(message.type==='social_propose'){
      if(invite||socialInvite)return error(socket,'Другое приглашение уже ждёт ответа');
      const partner=otherRole(role), helper=message.action==='joinCook', cook=helper?cookFor(partner):undefined;
      if(helper&&!cook)return error(socket,'Партнёр сейчас не готовит');
      const parkSession=typeof message.action==='string'&&SOCIAL_BY_ID.get(message.action)?.object==='parkTalk'?parkSessionFor(role):undefined;
      const near=typeof message.action==='string'&&isNearbyTalk(message.action);
      if(near){const reason=conversation? 'Разговор уже идёт':conversationReason(role);if(reason)return error(socket,reason);}
      if(!near&&!parkSession&&(!available(role)||(!cook&&!available(partner))))return error(socket,'Оба игрока должны быть в сети и свободны');
      if(now()-(lastProposal[role]??0)<600)return error(socket,'Подожди перед следующим приглашением');
      const a=cook?SOCIAL_BY_ID.get(isGrillRecipe(cook.command.recipe)?'grill':'cook'):
        typeof message.action==='string'?SOCIAL_BY_ID.get(message.action):undefined;
      if(!a)return error(socket,'Неизвестное совместное занятие');
      if('moment' in message&&typeof message.moment!=='string')return error(socket,'Неверный семейный момент');
      const cmd:SocialIntent={type:'together',action:a.id,
        item:cook?.command.recipe??(needsItem(a)&&typeof message.item==='string'?message.item:undefined),
        ...(typeof message.moment==='string'?{moment:message.moment}:{})};
      const reason=near?cooperationDenial(hooks.state(),role,cmd):parkSession?(contextAvailable(a,hooks.state(),role)?undefined:'Тема пока не подходит к ситуации'):cooperationDenial(hooks.state(),role,cmd);
      if(reason)return error(socket,reason);
      const resource=socialResource(a,cmd.item);
      if(!cook&&resource&&(reserved(resource)||hooks.resourceBusy(resource)))return error(socket,'Объект уже используется');
      const ttl=hooks.socialTtlMs??SOCIAL_TTL_MS;
      const story=cmd.moment?familyMoments(hooks.state(),role).find(m=>m.id===cmd.moment):undefined;
      const offer:SocialOffer={id:++nextInviteId,from:role,action:a.id,title:cook?'Помочь с готовкой':story?.title??a.title,
        text:cook?'Я могу подготовить продукты или помочь с подачей. Присоединиться?':story?.description??socialText(a,hooks.state(),role),
        replies:cook?['Да, продолжим вместе.','Да, мне пригодится помощь с подачей.']:a.replies,expiresAt:now()+ttl,remainingMs:ttl};
      socialInvite={offer,command:cmd,cookTask:cook?.id,parkSession,timer:schedule(()=>closeSocial('expired','Время ответа истекло'),ttl)};
      lastProposal[role]=now();
      hooks.all({type:'social_pending',offer});
      return;
    }
    if(!socialInvite||message.inviteId!==socialInvite.offer.id)return error(socket,'Это приглашение уже закрыто');
    const {offer,command,cookTask,parkSession}=socialInvite;
    if(now()>=offer.expiresAt)return closeSocial('expired','Время ответа истекло');
    if(message.type==='social_withdraw'&&offer.from===role)return closeSocial('cancelled','Приглашение отозвано');
    if(message.type!=='social_reply'||offer.from===role)return error(socket,'Ответить может только приглашённый игрок');
    if(message.choice===null)return closeSocial('declined','Приглашение отклонено');
    if(typeof message.choice!=='number'||!Number.isInteger(message.choice)||message.choice<0||message.choice>=offer.replies.length)
      return error(socket,'Выбери один из ответов');
    if(isNearbyTalk(offer.action)){
      const reason=conversationReason(offer.from)??cooperationDenial(hooks.state(),offer.from,command);
      if(reason||conversation)return closeSocial('interrupted',reason??'Разговор уже идёт');
      startConversation(offer.from,offer.action,message.choice);
      closeSocial('accepted','Разговор начался',offer.replies[message.choice]);return;
    }
    if(parkSession){
      const a=SOCIAL_BY_ID.get(offer.action)!;
      if(parkSessionFor(role)!==parkSession||!contextAvailable(a,hooks.state(),offer.from))return closeSocial('interrupted','Совместный отдых закончился');
      try{hooks.save(parkConversation(hooks.state(),offer.from,a,message.choice));}catch{return closeSocial('interrupted','Не удалось сохранить разговор');}
      broadcastSnapshot();closeSocial('accepted','Разговор во время отдыха',offer.replies[message.choice]);return;
    }
    if(cookTask&&cookFor(role)?.id!==cookTask)return closeSocial('interrupted','Эта готовка уже завершена');
    if((!cookTask&&!available(role))||!available(offer.from))return closeSocial('interrupted','Кто-то уже занят или вышел из игры');
    const reason=cooperationDenial(hooks.state(),offer.from,command);
    if(reason)return closeSocial('interrupted',reason);
    const a=SOCIAL_BY_ID.get(offer.action)!;
    const plan={command,label:a.title,durationMs:socialDuration(a,command,hooks.state()),resource:socialResource(a,command.item)};
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
      invite = { id,from:role,genre:genre as Genre,timer:schedule(() => closeInvite('Время ответа истекло'),30_000) };
      hooks.all({ type:'movie_offer',inviteId:id,from:role,genre:invite!.genre });
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
    if(conversation&&(conversationReason(conversation.from)||conversation.automatic&&!familyAutonomyReady(hooks.state())))stopConversation();
    for (const session of new Set(sessions.values())) {
      const member = session.participants[0].role;
      const command=session.plan.command;
      if(command.type==='together'&&session.cooperation){
        if(session.participants[0].packet.automatic&&!familyAutonomyReady(hooks.state())){cancel(member,'Нужен отдых или управление игрока');continue;}
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

  function interruptLayout(block:FloorRect|undefined,moved:number|undefined,fixture:string|undefined){
    for(const session of new Set(sessions.values())){
      for(const participant of [...session.participants]){
        const home=participant.packet.home;
        if(!home||hooks.state().world.places[participant.role]!=='home')continue;
        const elapsed=session.activeAt===null?Math.max(0,now()-session.started)/hooks.timeScale:Infinity;
        const remaining=sampled(home,elapsed).route;
        const direct=moved!==undefined&&(home.furnitureId===moved||session.plan.resource==='furniture:'+moved)
          ||fixture!==undefined&&(home.station===fixture||home.pair?.seat===fixture||fixture==='bed'&&home.pair?.bed==='starter');
        const stroll=home.pair?.stroll;
        const crossing=routeHitsLayout(remaining,block)||!!stroll?.length&&routeHitsLayout({from:remaining.path.at(-1)??remaining.from,path:stroll},block)
          ||!!home.furniturePose&&routeHitsLayout({from:home.furniturePose,path:[]},block);
        if(direct||crossing)cancel(participant.role,'Мебель переставлена — место занятия изменилось');
      }
    }
  }
  return { autoConversation,autoFamilyLeisure,stopAutoConversation,conversationActive:()=>!!conversation, diners:()=>new Map([...sessions.entries()].filter(([,session])=>session.activeAt!==null&&(session.plan.command.type==='eat'||session.plan.command.type==='eat_takeout'||session.plan.command.type==='together'&&['eat','takeout','bring'].includes(session.plan.command.action))).map(([role,session])=>{const route=session.participants.find(p=>p.role===role)!.packet.home!.route;return [role,route.path.at(-1)??route.from] as const;})),interruptLayout,busy, reserved, blocksCat:(site:CatPerch)=>[...sessions.values()].some(session=>session.participants.some(p=>p.packet.home&&catHomeSeatOverlap(site,p.role,p.packet.home))), start, cancel, replay, invitation, social, recheckAccess, answer, checkpoint,
    automatic: (role: CharacterId) => sessions.get(role)?.participants[0]?.packet.automatic === true,
    closeInvite,
    dispose() {
      for (const session of sessions.values()) clearTimer(session.timer);
      sessions.clear();
      if(conversation)clearTimer(conversation.timer);
      conversation=null;
      if (invite) clearTimer(invite.timer);
      if(socialInvite)clearTimer(socialInvite.timer);
      socialInvite=null;
      invite = null;
    },
  };
}
