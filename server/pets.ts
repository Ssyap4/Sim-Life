import { HOME_FLOOR } from '../src/shared/home';
import { catPerchCandidates, currentCatPerch, type CatPerch } from '../src/shared/CatPerches';
import {
  PETS, PET_IDS, PET_ROAM, PET_SPEED, PET_BOWL_CAPACITY, PET_AUTO_EAT_BELOW, PET_EAT_SATIETY_GAIN,
  PET_FOOD_MAX_REFILLS, petApproach, petDestination, type PetId, type PetAction, type PetRoutine,
} from '../src/shared/pets';
import { names, type CharacterId, type GameState } from '../src/shared/protocol';
import { addLedger } from '../src/shared/economy';
import { placeObstacles } from '../src/shared/locations';
import { GAME_MINUTES_PER_REAL_SECOND, gameMinutes } from '../src/shared/life';
import { sampleWalk, segmentIsClear, pointIsClear, type FloorPoint, type WalkRoute } from '../src/game/navigation';
import { petNavigationGeometry, planPetRoute } from '../src/game/PetNavigation';
import { preferredPetWanderTarget } from '../src/shared/petPersonality';
import {petBeds,petScratchers,petEquipmentRef,currentPetEquipment,
  type PetEquipmentRef} from '../src/shared/petFurniture';

export type PetResult =
  | { ok: true; state: GameState; message: string }
  | { ok: false; reason: string };

const clamp = (number: number): number => Math.max(0, Math.min(100, number));


export function petCarePoint(state: GameState, id: PetId, action?: PetAction) {
  return petApproach(action === 'feed' ? PETS[id].bowl : state.pets[id].position,
    placeObstacles('home',state.furnishing), HOME_FLOOR);
}

export function pausePetRoutine(state: GameState, id: PetId, now: number): void {
  const pet = state.pets[id];
  if (!pet.routine) return;
  pet.position = sampleWalk(pet.routine.route, Math.max(0, now - pet.routine.startedAt) * PET_SPEED[id] / GAME_MINUTES_PER_REAL_SECOND).from;
  delete pet.routine;
}


/** The length of a real obstacle-avoiding route, not a straight-line guess. */
function routeLength(route:WalkRoute):number {
  let distance=0,prev=route.from;
  for(const point of route.path){
    distance+=Math.hypot(point.x-prev.x,point.z-prev.z);
    prev=point;
  }
  return distance;
}
function arrivesAt(route:WalkRoute,point:FloorPoint):boolean {
  const end=route.path.at(-1)??route.from;
  return Math.hypot(end.x-point.x,end.z-point.z)<.035;
}
/** A call finds an unobstructed floor point near, but not INSIDE, the owner. */
function ownerPetPoint(state:GameState,id:PetId,role:CharacterId) {
  const actor=state.characters[role];
  const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
  const other=state.pets[id==='verdell'?'simba':'verdell'].position;
  const offsets=[[0,1],[1,0],[-1,0],[0,-1],[.8,.8],[-.8,.8],[.8,-.8],[-.8,-.8]];
  for(const [dx,dz] of offsets){
    const point={x:actor.x+dx,z:actor.z+dz};
    if(!pointIsClear(point,geometry.obstacles,geometry.floor)||
      Math.hypot(point.x-other.x,point.z-other.z)<.62)continue;
    const route=planPetRoute(state.pets[id].position,point,geometry);
    if(route&&arrivesAt(route,point))return {point,route,geometry};
  }
  return null;
}
/** Both automatic and manual climbs must have a real floor launch, empty
 * furniture, clear arc and an obstacle-safe floor route. */
function safeCatPerch(state:GameState,from:FloorPoint,nearest=false,first=0) {
  const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
  const places=catPerchCandidates(state.furnishing);
  const ordered=nearest
    ? [...places].sort((a,b)=>Math.hypot(a.approach.x-from.x,a.approach.z-from.z)-
      Math.hypot(b.approach.x-from.x,b.approach.z-from.z))
    : places.map((_,i)=>places[(i+first)%places.length]);
  for(const site of ordered){
    if((['vlad','alina'] as const).some(role=>{
      const person=state.characters[role];
      const bed=person.sleepingOn??'starter';
      return person.pose==='sleep' &&
        (site.key==='starter:bed'&&bed==='starter'||
          site.key.startsWith('placed:')&&typeof bed==='number'&&'placed:'+bed===site.key) ||
        person.pose!=='idle'&&Math.hypot(person.x-site.surface.x,person.z-site.surface.z)<2.25;
    }))continue;
    if(!pointIsClear(site.approach,geometry.obstacles,geometry.floor))continue;
    const other=placeObstacles('home',state.furnishing).filter(rect=>
      !(site.surface.x>=rect.minX-.02&&site.surface.x<=rect.maxX+.02&&
        site.surface.z>=rect.minZ-.02&&site.surface.z<=rect.maxZ+.02));
    if(!segmentIsClear(site.approach,site.surface,other,HOME_FLOOR))continue;
    const route=planPetRoute(from,site.approach,geometry);
    if(route&&arrivesAt(route,site.approach))return {site,route};
  }
  return null;
}
/** The ball must have a real two-leg route: dog -> toy -> owner.
 * A failed leg never triggers pretend fetching or rewards. */
function dogFetchRoute(state:GameState,role:CharacterId) {
  const near=ownerPetPoint(state,'verdell',role);
  if(!near)return null;
  const actor=state.characters[role];
  const offsets=[[0,2.3],[2.3,0],[-2.3,0],[0,-2.3],[1.7,1.7],[-1.7,1.7],[1.7,-1.7],[-1.7,-1.7]];
  for(const [dx,dz] of offsets){
    const point={x:actor.x+dx,z:actor.z+dz};
    if(!pointIsClear(point,near.geometry.obstacles,near.geometry.floor))continue;
    const out=planPetRoute(state.pets.verdell.position,point,near.geometry);
    const back=planPetRoute(point,near.point,near.geometry);
    if(!out||!back||!arrivesAt(out,point)||!arrivesAt(back,near.point))continue;
    const route:WalkRoute={from:out.from,path:[...out.path,...back.path]};
    const pickupDistance=routeLength(out);
    if(route.path.length>55||pickupDistance<.3||routeLength(route)>34)continue;
    return {route,goal:near.point,fetchPoint:point,fetchPickupDistance:pickupDistance};
  }
  return null;
}


/** A pet mat is a walkable, genuine placed object, not a hard-coded sleep point.
 * Favorite beds are preferred, but inaccessible spots must be skipped. */
function findPetBed(state:GameState,id:PetId) {
  const pet=state.pets[id];
  const beds=petBeds(state.furnishing,id).sort((a,b)=>
    Number(b.id===pet.favoriteBedId)-Number(a.id===pet.favoriteBedId) ||
    Math.hypot(a.x-pet.position.x,a.z-pet.position.z)-
      Math.hypot(b.x-pet.position.x,b.z-pet.position.z));
  const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
  const other=state.pets[id==='verdell'?'simba':'verdell'];
  for(const item of beds){
    const goal={x:item.x,z:item.z};
    if(Math.hypot(other.position.x-goal.x,other.position.z-goal.z)<.46)continue;
    if(other.routine?.equipment?.id===item.id)continue;
    if(!pointIsClear(goal,geometry.obstacles,geometry.floor))continue;
    const route=planPetRoute(pet.position,goal,geometry);
    if(route&&arrivesAt(route,goal))
      return {route,goal,equipment:petEquipmentRef(item)};
  }
  return null;
}
/** A cat walks to the OPEN side of an installed scratcher, not through the post. */
function findScratcher(state:GameState) {
  const pet=state.pets.simba;
  const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
  const points=[[0,.84],[.84,0],[-.84,0],[0,-.84],[.68,.68],[-.68,.68]];
  const posts=[...petScratchers(state.furnishing)].sort((a,b)=>
    Math.hypot(a.x-pet.position.x,a.z-pet.position.z)-
    Math.hypot(b.x-pet.position.x,b.z-pet.position.z));
  for(const post of posts){
    for(const [dx,dz] of points){
      const goal={x:post.x+dx,z:post.z+dz};
      if(!pointIsClear(goal,geometry.obstacles,geometry.floor))continue;
      const route=planPetRoute(pet.position,goal,geometry);
      if(route&&arrivesAt(route,goal))
        return {route,goal,equipment:petEquipmentRef(post)};
    }
  }
  return null;
}

/** Called on the clock's isolated state. Routes are cosmetic, supplies are authoritative. */
export function runPetRoutines(state: GameState, minutes: number, now: number,
  occupied: ReadonlySet<PetId>, random = Math.random): void {
  for (const id of PET_IDS) {
    const pet = state.pets[id];
    const drain = (value: number, rate: number) => Math.round(clamp(value - minutes * rate / 60) * 100) / 100;
    pet.satiety = drain(pet.satiety, 4);
    pet.energy = drain(pet.energy, 5);
    pet.bladder = drain(pet.bladder, 7);
    const previous = pet.routine;
    if(pet.favoriteBedId!==undefined && !petBeds(state.furnishing,id)
      .some(item=>item.id===pet.favoriteBedId))delete pet.favoriteBedId;
    if (previous) pet.position = sampleWalk(previous.route, (now - previous.startedAt) * PET_SPEED[id] / GAME_MINUTES_PER_REAL_SECOND).from;
    if ((id === 'verdell' && state.world.dogWalker) || occupied.has(id)) {
      delete pet.routine;
      continue;
    }
    // Furniture can be moved/sold while Simba is up on it: abandon that
    // contact immediately. Never let an obsolete surface survive the tick.
    const invalidPerch=previous?.kind==='perch' &&
      (id!=='simba'||!previous.perch||!currentCatPerch(state.furnishing,previous.perch));
    const invalidEquipment=previous?.equipment &&
      !currentPetEquipment(state.furnishing,previous.equipment);
    // A pre-update saved 'eat' route cannot mime eating from an empty bowl.
    const urgentInterrupt=previous && ['come','fetch','perch','scratch'].includes(previous.kind) &&
      (pet.satiety<20||pet.energy<15||pet.bladder<18);
    if (previous && previous.until > now && !invalidPerch && !invalidEquipment && !urgentInterrupt &&
        !(previous.kind === 'eat' && state.petBowls[id] === 0)) continue;
    if (previous?.kind === 'eat' && state.petBowls[id] > 0) {
      // The bowl — not a packet in household storage — pays for each meal.
      state.petBowls[id]--;
      pet.satiety = clamp(pet.satiety + PET_EAT_SATIETY_GAIN);
      pet.happiness = clamp(pet.happiness + 3);
    } else if (previous?.kind === 'toilet') {
      pet.bladder = 100;
    } else if (previous?.kind === 'sleep' && !invalidEquipment) {
      pet.energy = clamp(pet.energy + 33);
      if(previous.equipment)pet.favoriteBedId=previous.equipment.id;
    } else if (previous?.kind==='scratch' && !invalidEquipment && previous.until<=now) {
      pet.happiness=clamp(pet.happiness+9);
      pet.bond=clamp(pet.bond+2);
    } else if (previous?.kind==='come' && previous.until<=now) {
      pet.bond=clamp(pet.bond+3);
      pet.happiness=clamp(pet.happiness+2);
    } else if (previous?.kind==='fetch' && previous.until<=now) {
      pet.bond=clamp(pet.bond+5);
      pet.happiness=clamp(pet.happiness+10);
      pet.energy=clamp(pet.energy-5);
    } else if (previous?.kind==='perch' && !invalidPerch && previous.until<=now) {
      // Real completed resting on an installed sofa/bed restores a modest
      // amount of energy. An invalidated/sold cushion gives no reward.
      pet.energy=clamp(pet.energy+10);
      pet.happiness=clamp(pet.happiness+2);
    }
    let kind: PetRoutine['kind'] = 'wander';
    if (pet.satiety <= PET_AUTO_EAT_BELOW && state.petBowls[id] > 0) kind = 'eat';
    else if (pet.bladder <= 63) kind = 'toilet';
    else if (pet.energy <= 63) kind = 'sleep';
    let target = kind === 'wander' ? preferredPetWanderTarget(id,now,random)
      : Math.floor(random() * PET_ROAM.length);
    if (previous?.kind === 'wander' && previous.target === target) target = (target + 1) % PET_ROAM.length;
    let chosenPerch:CatPerch|undefined;
    let chosenRoute:PetRoutine['route']|undefined;
    let chosenGoal:FloorPoint|undefined;
    let chosenEquipment:PetEquipmentRef|undefined;
    if(kind==='sleep'){
      const bed=findPetBed(state,id);
      if(bed){chosenRoute=bed.route;chosenGoal=bed.goal;chosenEquipment=bed.equipment;}
    }
    // Occasional voluntary scratching is only a real action if there is
    // an installed and reachable scratcher; no virtual scratchers.
    if(id==='simba'&&kind==='wander'&&previous?.kind!=='scratch'&&
      pet.energy>=45&&pet.satiety>=45&&pet.bladder>=55&&random()<.16){
      const post=findScratcher(state);
      if(post){kind='scratch';target=0;chosenRoute=post.route;
        chosenGoal=post.goal;chosenEquipment=post.equipment;}
    }
    // Real, server-owned little feline excursions. Never during hunger,
    // fatigue, toilet trips, play, or immediately after another perching.
    if(id==='simba' && kind==='wander' && previous?.kind!=='perch' &&
      pet.energy>=66 && pet.satiety>=50 && pet.bladder>=66 && random()<.42){
      const sites=catPerchCandidates(state.furnishing);
      const first=sites.length?Math.floor(random()*sites.length):0;
      const picked=safeCatPerch(state,pet.position,false,first);
      if(picked){
        chosenPerch=picked.site;
        chosenRoute=picked.route;
        kind='perch';
        target=0;
      }
    }
    // Two pets must not reserve the exact same roaming destination.
    // Keep real feeding/sleep/toilet destinations unchanged.
    const otherId = id === 'verdell' ? 'simba' : 'verdell';
    const other = state.pets[otherId].routine;
    if (kind === 'wander' && other?.kind === 'wander' && other.target === target) {
      // The last four roam points are on the lawn. If both wanted the lawn,
      // keep them outside but at different destinations.
      const lawnStart = PET_ROAM.length - 4;
      target = target >= lawnStart
        ? lawnStart + (target - lawnStart + 2) % 4
        : (target + Math.floor(PET_ROAM.length / 2)) % PET_ROAM.length;
    }
    const duration = kind === 'perch' ? 24 + Math.floor(random()*8)
      : kind === 'sleep' ? 16 : kind === 'scratch'?10 : kind === 'wander' ? 8 + Math.floor(random() * 5) : 10;
    const route = chosenRoute ?? planPetRoute(pet.position, petDestination(id, { kind, target,goal:chosenGoal }),
      petNavigationGeometry(placeObstacles('home',state.furnishing), HOME_FLOOR));
    const travel=route&& (chosenEquipment||chosenPerch)
      ? Math.ceil(routeLength(route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]) : 0;
    pet.routine = route ? { kind, target, startedAt: now, until: now + duration+travel, route,
      ...(chosenPerch?{perch:chosenPerch}:{}),
      ...(chosenGoal?{goal:chosenGoal}:{}),
      ...(chosenEquipment?{equipment:chosenEquipment}:{}) } : undefined;
  }
}
/** Pets are family members. No real-time health penalties or forced purchases. */
export function applyPetAction(
  source: GameState,
  role: CharacterId,
  pet: string,
  action: string,
): PetResult {
  if (!PET_IDS.some((id) => id === pet)) return { ok: false, reason: 'Неизвестный питомец' };
  if (!['buyFood', 'feed', 'play', 'pet', 'brush', 'call', 'perch', 'fetch', 'mat', 'scratch'].includes(action))
    return { ok: false, reason: 'Неизвестное действие питомца' };
  const id = pet as PetId;
  const kind = action as PetAction;
  const next = structuredClone(source);
  const data = next.pets[id];
  const spec = PETS[id];
  const actor = next.characters[role];
  let message = '';

  // Commands are issued while the player stays put. They MUST NOT call
  // petCarePoint / teleport the human beside the animal.
  if(kind==='call'||kind==='perch'||kind==='fetch'||kind==='mat'||kind==='scratch'){
    if(next.world.places[role]!=='home')
      return {ok:false,reason:'Позвать питомца можно только из дома или своего двора'};
    if(actor.pose==='sleep'||actor.pose==='work')
      return {ok:false,reason:'Сначала закончи текущие дела'};
    if(data.satiety<40||data.bladder<35||data.energy<20)
      return {ok:false,reason:spec.name+' сейчас нуждается в еде, отдыхе или туалете'};
    if(data.routine?.kind==='eat'||data.routine?.kind==='toilet')
      return {ok:false,reason:'Не будем отвлекать '+spec.name+' от важного дела'};
    const now=Math.floor(gameMinutes(next.clock));
    if(kind==='mat'){
      const chosen=findPetBed(next,id);
      if(!chosen)return {ok:false,reason:'Сначала купи и поставь подходящую лежанку для '+spec.name};
      const travel=Math.ceil(routeLength(chosen.route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]);
      data.routine={kind:'sleep',target:0,startedAt:now,until:now+travel+19,
        route:chosen.route,goal:chosen.goal,equipment:chosen.equipment};
      message=spec.name+' идёт на настоящую лежанку отдыхать';
    }else if(kind==='scratch'){
      if(id!=='simba')return {ok:false,reason:'Когтеточка предназначена для Симбы'};
      const chosen=findScratcher(next);
      if(!chosen)return {ok:false,reason:'Сначала купи и установи когтеточку в доступном месте'};
      const travel=Math.ceil(routeLength(chosen.route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]);
      data.routine={kind:'scratch',target:0,startedAt:now,until:now+travel+13,
        route:chosen.route,goal:chosen.goal,equipment:chosen.equipment};
      message='Симба идёт к своей когтеточке и точит коготки';
    }else if(kind==='perch'){
      if(id!=='simba')return {ok:false,reason:'Верделл предпочитает отдыхать на полу'};
      const chosen=safeCatPerch(next,data.position,true);
      if(!chosen)return {ok:false,reason:'Нет свободной доступной мягкой мебели для Симбы'};
      const travel=Math.ceil(routeLength(chosen.route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]);
      data.routine={kind:'perch',target:0,startedAt:now,until:now+travel+27,
        route:chosen.route,perch:chosen.site};
      message='Симба идёт к '+(chosen.site.key.startsWith('starter:')?'домашней мебели':'купленной мебели')+
        ', чтобы запрыгнуть и отдохнуть';
    }else if(kind==='call'){
      const chosen=ownerPetPoint(next,id,role);
      if(!chosen)return {ok:false,reason:'Нет безопасного пути от питомца к хозяину'};
      const travel=Math.ceil(routeLength(chosen.route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]);
      data.routine={kind:'come',target:0,startedAt:now,until:now+travel+8,
        goal:chosen.point,route:chosen.route};
      message=names[role]+' зовёт '+spec.name+': питомец идёт по дому к хозяину';
    }else{
      if(id!=='verdell')return {ok:false,reason:'Симба предпочитает играть с мышкой'};
      if(data.energy<42)return {ok:false,reason:'Верделл устал — сначала пусть отдохнёт'};
      const chosen=dogFetchRoute(next,role);
      if(!chosen)return {ok:false,reason:'Для броска мячика нет свободного безопасного места'};
      const travel=Math.ceil(routeLength(chosen.route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]);
      data.routine={kind:'fetch',target:0,startedAt:now,until:now+travel+9,...chosen};
      message=names[role]+' бросает мячик — Верделл бежит за ним и несёт обратно!';
    }
    next.revision++;
    return {ok:true,state:next,message};
  }

  switch (kind) {
    case 'buyFood':
      if (next.money < spec.foodPrice)
        return { ok: false, reason: 'В семейном бюджете не хватает денег на корм' };
      if (next.petFood[id] > PET_FOOD_MAX_REFILLS - spec.foodAmount)
        return { ok: false, reason: 'Корма уже достаточно, сначала используйте запасы' };
      next.money -= spec.foodPrice;
      next.petFood[id] += spec.foodAmount;
      addLedger(next,role,'expense','pets',spec.foodPrice,spec.foodName);
      message = names[role] + ': куплена пачка ' + spec.foodName + ' (+' + spec.foodAmount + ' насыпаний по 3 порции)';
      break;
    case 'feed':
      if (next.petBowls[id] > 0)
        return { ok: false, reason: 'В миске ' + spec.name + ' ещё есть корм. Дождись, пока питомец его съест' };
      if (next.petFood[id] <= 0)
        return { ok: false, reason: 'Корм для ' + spec.name + ' закончился — купи ещё одну пачку' };
      next.petFood[id]--;
      next.petBowls[id] += PET_BOWL_CAPACITY;
      message = names[role] + ': насыпано ' + PET_BOWL_CAPACITY + ' порции в миску ' + spec.name +
        ' · осталось насыпаний в запасе: ' + next.petFood[id];
      break;
    case 'play':
      if (actor.energy < 5) return { ok: false, reason: 'Для игры с питомцем нужно немного отдохнуть' };
      if (data.satiety < 8) return { ok: false, reason: spec.name + ' проголодался — сначала покорми' };
      data.satiety = clamp(data.satiety - 7);
      data.happiness = clamp(data.happiness + 18);
      data.bond = clamp(data.bond + 9);
      actor.energy = clamp(actor.energy - 5);
      actor.mood = clamp(actor.mood + 5);
      actor.fun = clamp(actor.fun + 12);
      actor.social = clamp(actor.social + 8);
      message = names[role] + ' играет с ' + spec.name;
      break;
    case 'pet':
      data.happiness = clamp(data.happiness + 9);
      data.bond = clamp(data.bond + 6);
      actor.mood = clamp(actor.mood + 3);
      actor.social = clamp(actor.social + 7);
      message = names[role] + ' гладит ' + spec.name;
      break;
    case 'brush':
      data.happiness = clamp(data.happiness + 7);
      data.bond = clamp(data.bond + 11);
      actor.mood = clamp(actor.mood + 2);
      actor.social = clamp(actor.social + 4);
      message = names[role] + ' ухаживает за шерстью ' + spec.name;
      break;
  }
  // The pet stays at its shared position while the household cares for it.
  if (kind !== 'buyFood') {
    const point = petCarePoint(next, id, kind);
    if (point) Object.assign(actor, point, { pose: 'idle' });
  }
  next.revision++;
  return { ok: true, state: next, message };
}
