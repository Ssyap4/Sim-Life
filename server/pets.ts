import { HOUSE_ENTRY } from '../src/shared/home';
import {discoverFurniture,furniturePreference,housePreferenceKey,type PetEvent} from '../src/shared/petPreferences';
import {feedingStation,feedingOwnerPoint,loadFeeder,dispenseFeeder,dryRefills,feederReserve} from '../src/shared/petFeeders';
import {dogBathPlan,DOG_BATH_APPROACH,DOG_BATH_OWNER} from '../src/shared/dogBath';
import {trainingCommand,trainingChance,finishTraining,DOG_COMMAND_NAMES} from '../src/shared/dogTraining';
import { toyOwned,toyPreference } from '../src/shared/petToys';
import { petFoodProduct,discoverFoodPreference,nextPetFood } from "../src/shared/petShop";
import { catOccupiedPerch } from '../src/shared/catOccupancy';
import { HOME_FLOOR } from '../src/shared/home';
import { catPerchCandidates, currentCatPerch, type CatPerch } from '../src/shared/CatPerches';
import {
  homeToysFor, homeToyApproach, treatsRemaining,PET_TREAT_REWARD,PETS, PET_IDS, PET_ROAM, PET_SPEED, PET_BOWL_CAPACITY, PET_AUTO_EAT_BELOW, PET_EAT_SATIETY_GAIN,
  petApproach, petDestination, type PetId, type PetAction, type PetRoutine,
} from '../src/shared/pets';
import { names, type CharacterId, type GameState } from '../src/shared/protocol';

import { placeObstacles } from '../src/shared/locations';
import { GAME_MINUTES_PER_REAL_SECOND, gameMinutes } from '../src/shared/life';
import { sampleWalk, segmentIsClear, pointIsClear, type FloorPoint, type WalkRoute } from '../src/game/navigation';
import { petNavigationGeometry, planPetRoute } from '../src/game/PetNavigation';
import { preferredPetWanderTarget } from '../src/shared/petPersonality';
import {petBeds,petScratchers,petEquipmentRef,currentPetEquipment,petScratchPoint,
  type PetEquipmentRef} from '../src/shared/petFurniture';

export type PetResult =
  | { ok: true; state: GameState; message: string }
  | { ok: false; reason: string };

const clamp = (number: number): number => Math.max(0, Math.min(100, number));


export function petCarePoint(state: GameState, id: PetId, action?: PetAction, role:CharacterId='vlad') {
  if(action==='bathe')return id==='verdell'?DOG_BATH_OWNER:undefined;
  if(action==='feed'||action==='loadFeeder'){const station=feedingStation(state.furnishing,id);return station.item?feedingOwnerPoint(station,state.characters[role],placeObstacles('home',state.furnishing),HOME_FLOOR):petApproach(station.point,placeObstacles('home',state.furnishing),HOME_FLOOR);}
  return petApproach(state.pets[id].position,
    placeObstacles('home',state.furnishing), HOME_FLOOR);
}

export function pausePetRoutine(state: GameState, id: PetId, now: number): void {
  const pet = state.pets[id];
  if (!pet.routine) return;
  pet.position = sampleWalk(pet.routine.route, Math.max(0, now - pet.routine.startedAt) * PET_SPEED[id] / GAME_MINUTES_PER_REAL_SECOND).from;
  if(id==='simba'&&pet.routine.kind==='perch'&&pet.routine.perch){
    const site=currentCatPerch(state.furnishing,pet.routine.perch);
    if(site)pet.furnitureYield={perch:site,clearAt:Math.floor(now)+2,cooldownUntil:Math.floor(now)+14};
  }
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
function ownerPetPoint(state:GameState,id:PetId,role:CharacterId,position?:FloorPoint) {
  const actor=position??state.characters[role];
  const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
  const otherPet=state.pets[id==='verdell'?'simba':'verdell'];
  const other=otherPet.routine?.kind==='beg'&&otherPet.routine.goal?otherPet.routine.goal:otherPet.position;
  const offsets=[[0,1],[1,0],[-1,0],[0,-1],[.8,.8],[-.8,.8],[.8,-.8],[-.8,-.8],[0,1.65],[1.65,0],[-1.65,0],[0,-1.65],[1.2,1.2],[-1.2,1.2],[1.2,-1.2],[-1.2,-1.2]];
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
function safeCatPerch(state:GameState,from:FloorPoint,nearest=false,first=0,blocked?:(site:CatPerch)=>boolean,prefer=false) {
  const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
  const places=catPerchCandidates(state.furnishing);
  const ordered=nearest
    ? [...places].sort((a,b)=>Math.hypot(a.approach.x-from.x,a.approach.z-from.z)-
      Math.hypot(b.approach.x-from.x,b.approach.z-from.z))
    : places.map((_,i)=>places[(i+first)%places.length]);
  if(prefer&&!nearest)ordered.sort((a,b)=>{const ka=housePreferenceKey(state.furnishing,a),kb=housePreferenceKey(state.furnishing,b);return (kb?furniturePreference(state.pets.simba,kb):1)-(ka?furniturePreference(state.pets.simba,ka):1);});
  for(const site of ordered){
    const yielded=state.pets.simba.furnitureYield;
    if(blocked?.(site)||yielded&&yielded.perch.key===site.key&&gameMinutes(state.clock)<yielded.cooldownUntil)continue;
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
function findPetBed(state:GameState,id:PetId,explore=false) {
  const pet=state.pets[id];
  const beds=petBeds(state.furnishing,id).sort((a,b)=>
    (explore?Number(pet.furniturePreferences?.[a.sku]!==undefined)-Number(pet.furniturePreferences?.[b.sku]!==undefined):furniturePreference(pet,b.sku)-furniturePreference(pet,a.sku)||Number(b.id===pet.favoriteBedId)-Number(a.id===pet.favoriteBedId)) ||
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
function findScratcher(state:GameState,explore=false) {
  const pet=state.pets.simba;
  const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
  const points=[[0,.84],[.84,0],[-.84,0],[0,-.84],[.68,.68],[-.68,.68]];
  const posts=[...petScratchers(state.furnishing)].sort((a,b)=>
    (explore?Number(pet.furniturePreferences?.[a.sku]!==undefined)-Number(pet.furniturePreferences?.[b.sku]!==undefined):furniturePreference(pet,b.sku)-furniturePreference(pet,a.sku))||
    Math.hypot(a.x-pet.position.x,a.z-pet.position.z)-
    Math.hypot(b.x-pet.position.x,b.z-pet.position.z));
  for(const post of posts){
    for(const [dx,dz] of points){
      const center=petScratchPoint(post);
      const goal={x:center.x+dx,z:center.z+dz};
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
  occupied: ReadonlySet<PetId>, random = Math.random, blocked?:(site:CatPerch)=>boolean, diners:ReadonlyMap<CharacterId,FloorPoint>=new Map()): void {
  for (const id of PET_IDS) {
    const pet = state.pets[id];
    const drain = (value: number, rate: number) => Math.round(clamp(value - minutes * rate / 60) * 100) / 100;
    pet.satiety = drain(pet.satiety, pet.foodFullUntil && pet.foodFullUntil>now ? 2.6 : 4);
    pet.energy = drain(pet.energy, 5);
    pet.bladder = drain(pet.bladder, 7);
    if(id==='verdell')pet.cleanliness=drain(pet.cleanliness??100,state.world.dogWalker?5:pet.routine?.kind==='toy'?3:1.8);
    const station=feedingStation(state.furnishing,id);
    if(!occupied.has(id))dispenseFeeder(state,id);
    const previous = pet.routine;
    if(pet.furnitureYield && (now>=pet.furnitureYield.cooldownUntil||!currentCatPerch(state.furnishing,pet.furnitureYield.perch)))delete pet.furnitureYield;
    if(pet.favoriteBedId!==undefined && !petBeds(state.furnishing,id)
      .some(item=>item.id===pet.favoriteBedId))delete pet.favoriteBedId;
    if (previous) pet.position = sampleWalk(previous.route, (now - previous.startedAt) * PET_SPEED[id] / GAME_MINUTES_PER_REAL_SECOND).from;
    if ((id === 'verdell' && state.world.dogWalker) || occupied.has(id)) {
      if(!(id==='verdell'&&occupied.has(id)&&pet.routine?.kind==='bath'))delete pet.routine;
      continue;
    }
    // Furniture can be moved/sold while Simba is up on it: abandon that
    // contact immediately. Never let an obsolete surface survive the tick.
    const invalidPerch=previous?.kind==='perch' &&
      (id!=='simba'||!previous.perch||!currentCatPerch(state.furnishing,previous.perch));
    const invalidEquipment=previous?.equipment &&
      !currentPetEquipment(state.furnishing,previous.equipment);
    // A pre-update saved 'eat' route cannot mime eating from an empty bowl.
    const invalidToy=previous?.kind==='toy'&&(()=>{
      const toy=homeToysFor(id)[previous.target];
      if(!toy||'id' in toy&&!toyOwned(pet,toy.id))return true;
      const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
      return !pointIsClear(toy,geometry.obstacles,geometry.floor)||!pointIsClear(homeToyApproach(id,previous.target),geometry.obstacles,geometry.floor);
    })();
    const diningOwner=(['vlad','alina'] as const).find(role=>diners.has(role)&&state.world.places[role]==='home');
    const wantBeg=!!diningOwner&&treatsRemaining(pet,state.clock.day)>0&&pet.energy>=28&&pet.bladder>=25;
    const begRoute=wantBeg&&(!previous||['wander','toy','beg'].includes(previous.kind))&&
      (previous?.kind!=='beg'||previous.until<=now)?ownerPetPoint(state,id,diningOwner!,diners.get(diningOwner!)):null;
    const invalidBeg=previous?.kind==='beg'&&(!wantBeg||!diners.has(previous.target===0?'vlad':'alina'));
    const invalidBowl=previous?.kind==='eat'&&(()=>{const target=previous.goal??petDestination(id,previous);return Math.hypot(target.x-station.goal.x,target.z-station.goal.z)>.035;})();
    const invalidTraining=previous?.training&&(state.world.places[previous.training.role]!=='home'||!previous.goal||!pointIsClear(previous.goal,petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR).obstacles,HOME_FLOOR));
    const invalidEvent=previous?.kind==='event'&&(previous.event==='welcome'||previous.event==='blink')&&(state.world.places[previous.target===0?'vlad':'alina']!=='home'||!previous.goal||Math.hypot(state.characters[previous.target===0?'vlad':'alina'].x-previous.goal.x,state.characters[previous.target===0?'vlad':'alina'].z-previous.goal.z)>2.4);
    const urgentInterrupt=previous && ['come','fetch','perch','scratch','toy','train','event'].includes(previous.kind) &&
      (pet.satiety<20||pet.energy<15||pet.bladder<18);
    if (previous && previous.until > now && !invalidPerch && !invalidEquipment && !invalidToy && !invalidBeg && !invalidTraining && !invalidBowl && !invalidEvent && !begRoute && !urgentInterrupt &&
        !(previous.kind === 'eat' && state.petBowls[id] === 0)) continue;
    if(previous?.training){
      if(id==='verdell'&&!invalidTraining&&!urgentInterrupt&&previous.until<=now&&previous.goal&&Math.hypot(pet.position.x-previous.goal.x,pet.position.z-previous.goal.z)<.08)finishTraining(pet,previous.training);
    }else if (previous?.kind === 'eat' && !invalidBowl && state.petBowls[id] > 0&&(!station.item||Math.hypot(pet.position.x-station.goal.x,pet.position.z-station.goal.z)<.08)) {
      // The bowl — not a packet in household storage — pays for each meal.
      state.petBowls[id]--;
      const food=petFoodProduct(pet.bowlFood);
      if(food){
        const preference=discoverFoodPreference(pet,food.id,random);
        pet.satiety=clamp(pet.satiety+food.satiety);
        pet.happiness=clamp(pet.happiness+food.happiness+[-5,0,3,7][preference]);
        if(food.lasting)pet.foodFullUntil=Math.floor(now)+food.lasting;
      }else{pet.satiety=clamp(pet.satiety+PET_EAT_SATIETY_GAIN);pet.happiness=clamp(pet.happiness+3);}
      if(!state.petBowls[id])delete pet.bowlFood;
    } else if (previous?.kind === 'toilet') {
      pet.bladder = 100;
    } else if (previous?.kind === 'sleep' && !invalidEquipment) {
      pet.energy = clamp(pet.energy + 33);
      if(previous.equipment&&previous.until<=now){const value=discoverFurniture(pet,previous.equipment.sku,random);pet.happiness=clamp(pet.happiness+[-2,0,2,5][value]);pet.energy=clamp(pet.energy+[-3,0,3,6][value]);const old=state.furnishing.placed.find(i=>i.id===pet.favoriteBedId);if(!old||value>=furniturePreference(pet,old.sku))pet.favoriteBedId=previous.equipment.id;}
    } else if (previous?.kind==='scratch' && !invalidEquipment && previous.until<=now) {
      const value=previous.equipment?discoverFurniture(pet,previous.equipment.sku,random):1;
      pet.happiness=clamp(pet.happiness+9+[-3,0,2,5][value]);
      pet.bond=clamp(pet.bond+2);
    } else if (previous?.kind==='come' && previous.until<=now && !pet.furnitureYield) {
      pet.bond=clamp(pet.bond+3);
      pet.happiness=clamp(pet.happiness+2);
    } else if (previous?.kind==='fetch' && previous.until<=now) {
      pet.bond=clamp(pet.bond+5);
      pet.happiness=clamp(pet.happiness+10);
      pet.energy=clamp(pet.energy-5);
    } else if(previous?.kind==='toy'&&!invalidToy&&previous.until<=now){
      const toy=homeToysFor(id)[previous.target];
      if(toy&&'id' in toy){const preference=toyPreference(pet,toy.id,random);pet.happiness=clamp(pet.happiness+toy.joy+[-5,0,3,6][preference]);}
      else pet.happiness=clamp(pet.happiness+6);
      pet.energy=clamp(pet.energy-3);
    } else if (previous?.kind==='perch' && !invalidPerch && previous.until<=now) {
      // Real completed resting on an installed sofa/bed restores a modest
      // amount of energy. An invalidated/sold cushion gives no reward.
      pet.energy=clamp(pet.energy+10);
      const key=previous.perch?housePreferenceKey(state.furnishing,previous.perch):undefined;
      const value=key?discoverFurniture(pet,key,random):1;pet.happiness=clamp(pet.happiness+2+[-2,0,2,5][value]);
      if(key)pet.energy=clamp(pet.energy+[-2,0,2,5][value]);
    }else if(previous?.kind==='event'&&!invalidEvent&&!urgentInterrupt&&previous.until<=now&&previous.goal&&Math.hypot(pet.position.x-previous.goal.x,pet.position.z-previous.goal.z)<.08){
      pet.happiness=clamp(pet.happiness+3);if(previous.event==='welcome'||previous.event==='blink')pet.bond=clamp(pet.bond+2);
    }
    if(id==='simba'&&previous?.kind==='perch'&&!invalidPerch&&previous.perch){
      pet.furnitureYield={perch:previous.perch,clearAt:now+2,cooldownUntil:now+14};
    }
    if(!occupied.has(id))dispenseFeeder(state,id);
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
    let chosenEvent:PetEvent|undefined;
    if(kind==='sleep'&&id==='simba'&&pet.energy>=22&&previous?.kind!=='perch'){
      const houses=catPerchCandidates(state.furnishing).filter(site=>site.entry==='inside'||site.entry==='jump');
      if(houses.length){
        const entry=random()<.70?'jump':'inside',prefer=random()<.7&&houses.some(site=>{const key=housePreferenceKey(state.furnishing,site);return key&&pet.furniturePreferences?.[key]!==undefined;});
        const picked=safeCatPerch(state,pet.position,false,Math.floor(random()*houses.length),
          site=>!site.entry||!prefer&&site.entry!==entry||Boolean(blocked?.(site)),prefer);
        if(picked){chosenPerch=picked.site;chosenRoute=picked.route;kind='perch';target=0;}
      }
    }
    if(kind==='sleep'){
      const bed=findPetBed(state,id,petBeds(state.furnishing,id).length>1&&random()<.30);
      if(bed){chosenRoute=bed.route;chosenGoal=bed.goal;chosenEquipment=bed.equipment;}
    }
    if(begRoute&&diningOwner&&pet.bladder>=25&&pet.energy>=28&&!(pet.satiety<=PET_AUTO_EAT_BELOW&&state.petBowls[id]>0)){
      kind='beg';target=diningOwner==='vlad'?0:1;chosenRoute=begRoute.route;chosenGoal=begRoute.point;
    }
    // Occasional voluntary scratching is only a real action if there is
    // an installed and reachable scratcher; no virtual scratchers.
    if(id==='simba'&&kind==='wander'&&previous?.kind!=='scratch'&&
      pet.energy>=45&&pet.satiety>=45&&pet.bladder>=55&&random()<.16){
      const post=findScratcher(state,petScratchers(state.furnishing).length>1&&random()<.30);
      if(post){kind='scratch';target=0;chosenRoute=post.route;
        chosenGoal=post.goal;chosenEquipment=post.equipment;}
    }
    // Purchased cat toys compete with furniture play, but never basic needs.
    if(id==='simba'&&kind==='wander'&&previous?.kind!=='toy'&&pet.ownedToys?.length&&pet.energy>=65&&pet.satiety>=45&&pet.bladder>=64&&random()<.55){
      const toys=homeToysFor(id),geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
      const start=Math.floor(random()*toys.length);
      const indices=toys.map((_,i)=>(start+i)%toys.length);
      if(random()<.64)indices.sort((a,b)=>(pet.toyPreferences?.[(toys[b] as import('../src/shared/petToys').ToyProduct).id]??2)-(pet.toyPreferences?.[(toys[a] as import('../src/shared/petToys').ToyProduct).id]??2));
      for(const index of indices){const toy=toys[index],goal=homeToyApproach(id,index);if(!('id' in toy)||!toyOwned(pet,toy.id)||!pointIsClear(toy,geometry.obstacles,geometry.floor)||!pointIsClear(goal,geometry.obstacles,geometry.floor))continue;const route=planPetRoute(pet.position,goal,geometry);if(route&&arrivesAt(route,goal)&&route.path.length<=60){kind='toy';target=index;chosenRoute=route;chosenGoal=goal;break;}}
    }
    // Real, server-owned little feline excursions. Never during hunger,
    // fatigue, toilet trips, play, or immediately after another perching.
    if(id==='simba' && kind==='wander' && previous?.kind!=='perch' &&
      pet.energy>=66 && pet.satiety>=50 && pet.bladder>=66 && random()<.42){
      const sites=catPerchCandidates(state.furnishing);
      const first=sites.length?Math.floor(random()*sites.length):0;
      const picked=safeCatPerch(state,pet.position,false,first,blocked,random()<.65);
      if(picked){
        chosenPerch=picked.site;
        chosenRoute=picked.route;
        kind='perch';
        target=0;
      }
    }
    // Play independently with the real household toys, indoors and on the lawn.
    if(id==='verdell'&&kind==='wander'&&previous?.kind!=='toy'&&pet.energy>=45&&pet.satiety>=45&&pet.bladder>=64&&random()<.45){
      const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
      const toys=homeToysFor(id).map((toy,index)=>({toy,index})).filter(({toy})=>!('id' in toy)||toyOwned(pet,toy.id));
      const start=Math.floor(random()*toys.length)%toys.length;
      const choices=toys.map((_,i)=>toys[(start+i)%toys.length]);
      if(pet.ownedToys?.length&&random()<.68)choices.sort((a,b)=>('id' in b.toy?(pet.toyPreferences?.[b.toy.id]??2):1)-('id' in a.toy?(pet.toyPreferences?.[a.toy.id]??2):1));
      for(const {index,toy} of choices){
        const goal=homeToyApproach(id,index);
        if(!pointIsClear(toy,geometry.obstacles,geometry.floor)||!pointIsClear(goal,geometry.obstacles,geometry.floor))continue;
        const route=planPetRoute(pet.position,goal,geometry);
        if(route&&arrivesAt(route,goal)&&route.path.length<=60){
          kind='toy';target=index;chosenRoute=route;chosenGoal=goal;break;
        }
      }
    }
    // Rare shared events, only between ordinary activities and never instead of needs.
    if(kind==='wander'&&previous?.kind==='wander'&&now>=600&&now-(pet.lastEventAt??0)>=180&&pet.satiety>=55&&pet.energy>=65&&pet.bladder>=70&&random()<.12){
      const owner=(['vlad','alina'] as const).find(role=>state.world.places[role]==='home'&&state.characters[role].pose==='idle'&&Math.hypot(state.characters[role].x-pet.position.x,state.characters[role].z-pet.position.z)<4);
      const near=owner&&pet.bond>=45&&random()<.60?ownerPetPoint(state,id,owner):null;
      if(near&&routeLength(near.route)<6){chosenGoal=near.point;chosenRoute=near.route;target=owner==='vlad'?0:1;chosenEvent=id==='verdell'?'welcome':'blink';}
      else{const g=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);if(pointIsClear(pet.position,g.obstacles,g.floor)){chosenGoal={...pet.position};chosenRoute={from:chosenGoal,path:[]};target=0;chosenEvent=id==='verdell'?'sniff':'groom';}}
      if(chosenEvent){kind='event';pet.lastEventAt=Math.floor(now);}
    }
    // Two pets must not reserve the exact same roaming destination.
    // Keep real feeding/sleep/toilet destinations unchanged.
    const otherId = id === 'verdell' ? 'simba' : 'verdell';
    const other = state.pets[otherId].routine;
    if(kind==='wander'){
      const nav=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
      const outdoor=PET_ROAM[target].z>HOUSE_ENTRY.z;
      const candidates=PET_ROAM.map((_,i)=>(target+i)%PET_ROAM.length).sort((a,b)=>Number((PET_ROAM[b].z>HOUSE_ENTRY.z)===outdoor)-Number((PET_ROAM[a].z>HOUSE_ENTRY.z)===outdoor));
      for(const i of candidates){
        const goal=PET_ROAM[i];
        if((previous?.kind==='wander'&&previous.target===i)||(other?.kind==='wander'&&other.target===i)||Math.hypot(goal.x-pet.position.x,goal.z-pet.position.z)<.65||!pointIsClear(goal,nav.obstacles,nav.floor))continue;
        const route=planPetRoute(pet.position,goal,nav);
        if(route&&arrivesAt(route,goal)){target=i;chosenRoute=route;chosenGoal=goal;break;}
      }
    }
    const duration = kind === 'perch' ? 24 + Math.floor(random()*8)
      : kind === 'sleep' ? 16 : kind === 'scratch'?10 : kind==='toy'?12:kind==='beg'?16:kind==='event'?12:kind === 'wander' ? 8 + Math.floor(random() * 5) : 10;
    if(kind==='eat')chosenGoal=station.goal;
    const route = chosenRoute ?? (kind==='wander'?null:planPetRoute(pet.position, petDestination(id, { kind, target,goal:chosenGoal }),
      petNavigationGeometry(placeObstacles('home',state.furnishing), HOME_FLOOR)));
    const travel=route&& (chosenEquipment||chosenPerch||kind==='wander'||kind==='toy'||kind==='beg'||kind==='event'||kind==='eat'&&!!station.item)
      ? Math.ceil(routeLength(route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]) : 0;
    pet.routine = route&&(kind!=='eat'||arrivesAt(route,station.goal)) ? { kind, target, startedAt: now, until: now + duration+travel, route,
      ...(chosenEvent?{event:chosenEvent}:{}),
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
  blocked?:(site:CatPerch)=>boolean, random=Math.random,
): PetResult {
  if (!PET_IDS.some((id) => id === pet)) return { ok: false, reason: 'Неизвестный питомец' };
  const training=trainingCommand(action);
  if (!training&&!['buyFood', 'feed', 'play', 'pet', 'brush', 'call', 'perch', 'fetch', 'mat', 'scratch','treat','toy','bathe','loadFeeder'].includes(action))
    return { ok: false, reason: 'Неизвестное действие питомца' };
  const id = pet as PetId;
  const kind = action as PetAction;
  const next = structuredClone(source);
  const data = next.pets[id];
  const spec = PETS[id];
  const actor = next.characters[role];
  let message = '';

  if(kind==='bathe'){
    if(id!=='verdell')return {ok:false,reason:'Симба сам ухаживает за шерстью'};
    if(next.world.places[role]!=='home'||next.world.dogWalker)return {ok:false,reason:'Купать Верделла можно только дома'};
    if(data.satiety<20||data.energy<15||data.bladder<18)return {ok:false,reason:'Сначала позаботься об основных потребностях Верделла'};
    if(!dogBathPlan(next,role))return {ok:false,reason:'Нет свободного подхода к ванной'};
    data.cleanliness=100;data.happiness=clamp(data.happiness+5);data.bond=clamp(data.bond+7);data.energy=clamp(data.energy-4);
    data.position={...DOG_BATH_APPROACH};delete data.routine;Object.assign(actor,DOG_BATH_OWNER,{pose:'idle'});actor.energy=clamp(actor.energy-3);
    next.revision++;return {ok:true,state:next,message:'Верделл искупан · чистота 100%'};
  }
  if(training){
    if(id!=='verdell')return {ok:false,reason:'Эти команды предназначены для Верделла'};
    if(next.world.places[role]!=='home'||next.world.dogWalker||actor.pose!=='idle')return {ok:false,reason:'Тренироваться можно дома или во дворе, когда хозяин свободен'};
    if(data.routine?.training)return {ok:false,reason:'Дождись окончания команды'};
    if(data.satiety<45||data.energy<40||data.bladder<45||data.routine?.kind==='eat'||data.routine?.kind==='toilet')return {ok:false,reason:'Верделлу сначала нужно поесть, отдохнуть или сходить в туалет'};
    const now=Math.floor(gameMinutes(next.clock));
    if(data.routine)data.position=sampleWalk(data.routine.route,Math.max(0,now-data.routine.startedAt)*PET_SPEED[id]/GAME_MINUTES_PER_REAL_SECOND).from;
    const success=random()<trainingChance(data,training);
    const near=ownerPetPoint(next,id,role);if(!near)return {ok:false,reason:'Нет свободного места рядом с хозяином'};
    const fetch=training==='fetch'&&success?dogFetchRoute(next,role):null;if(training==='fetch'&&success&&!fetch)return {ok:false,reason:'Нет безопасного места для броска мяча'};
    const goal=fetch?.goal??near.point,route=fetch?.route??near.route;
    const yaw=Math.atan2(actor.x-goal.x,actor.z-goal.z);
    const travel=Math.ceil(routeLength(route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]);
    data.routine={kind:fetch?'fetch':'train',target:0,route,goal,startedAt:now,until:now+travel+(training==='stay'?23:14),...(fetch??{}),training:{command:training,success,role,yaw,practice:true}};
    next.revision++;return {ok:true,state:next,message:'Верделл тренирует команду «'+DOG_COMMAND_NAMES[training]+'»'};
  }
  // Commands are issued while the player stays put. They MUST NOT call
  // petCarePoint / teleport the human beside the animal.
  if(kind==='call'||kind==='perch'||kind==='fetch'||kind==='mat'||kind==='scratch'||kind==='toy'){
    if(next.world.places[role]!=='home')
      return {ok:false,reason:'Позвать питомца можно только из дома или своего двора'};
    if(actor.pose==='sleep'||actor.pose==='work')
      return {ok:false,reason:'Сначала закончи текущие дела'};
    if(data.satiety<40||data.bladder<35||data.energy<20)
      return {ok:false,reason:spec.name+' сейчас нуждается в еде, отдыхе или туалете'};
    if(data.routine?.kind==='eat'||data.routine?.kind==='toilet')
      return {ok:false,reason:'Не будем отвлекать '+spec.name+' от важного дела'};
    const now=Math.floor(gameMinutes(next.clock));
    if(data.furnitureYield&&now<data.furnitureYield.clearAt)return {ok:false,reason:'Симба ещё спускается с мебели'};
    if(data.routine?.kind==='perch'&&kind!=='perch'){
      const site=catOccupiedPerch(next);
      if(site){
        data.position=sampleWalk(data.routine.route,Math.max(0,now-data.routine.startedAt)*PET_SPEED[id]/GAME_MINUTES_PER_REAL_SECOND).from;
        data.furnitureYield={perch:site,clearAt:now+2,cooldownUntil:now+14};
      }
    }
    if(kind==='perch'&&data.routine?.kind==='perch')return {ok:false,reason:'Симба уже устроился на мебели'};
    if(kind==='toy'){
      if(id==='verdell'&&next.world.dogWalker)return {ok:false,reason:'Верделл на прогулке'};
      if(data.energy<45)return {ok:false,reason:spec.name+' сначала нужно отдохнуть'};
      const geometry=petNavigationGeometry(placeObstacles('home',next.furnishing),HOME_FLOOR);
      const choices=homeToysFor(id).map((toy,index)=>({toy,index})).filter(({toy})=>'id' in toy&&toyOwned(data,toy.id));
      if(!choices.length)return {ok:false,reason:'Сначала купи игрушку в зоомагазине'};
      const previous=data.routine?.kind==='toy'?data.routine.target:-1;
      const start=choices.findIndex(c=>c.index===previous)+1;
      let selected=false;
      for(let i=0;i<choices.length;i++){const {toy,index}=choices[(start+i)%choices.length],goal=homeToyApproach(id,index);if(!pointIsClear(toy,geometry.obstacles,geometry.floor)||!pointIsClear(goal,geometry.obstacles,geometry.floor))continue;const route=planPetRoute(data.position,goal,geometry);if(!route||!arrivesAt(route,goal)||route.path.length>60)continue;const travel=Math.ceil(routeLength(route)*GAME_MINUTES_PER_REAL_SECOND/PET_SPEED[id]);data.routine={kind:'toy',target:index,goal,route,startedAt:now,until:now+travel+12};message=spec.name+' играет: '+toy.name;selected=true;break;}
      if(!selected)return {ok:false,reason:'Нет доступного места у игрушек'};
    }else if(kind==='mat'){
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
      const chosen=safeCatPerch(next,data.position,true,0,blocked);
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
    case 'treat':
      if(next.world.places[role]!=='home'||id==='verdell'&&next.world.dogWalker)return {ok:false,reason:'Лакомство можно дать питомцу дома'};
      if(treatsRemaining(data,next.clock.day)<=0)return {ok:false,reason:'Сегодня все три лакомства уже получены'};
      data.treats={day:next.clock.day,used:(data.treats?.day===next.clock.day?data.treats.used:0)+1};
      for(const key of ['satiety','happiness','bond'] as const)data[key]=clamp(data[key]+PET_TREAT_REWARD[key]);
      delete data.routine;
      actor.mood=clamp(actor.mood+3);
      message=spec.name+' получил лакомство! Осталось сегодня: '+treatsRemaining(data,next.clock.day)+'/3';
      break;
    case 'buyFood':
      return {ok:false,reason:'Корм продаётся в супермаркете и через доставку продуктов'};
    case 'loadFeeder': {
      if(next.world.places[role]!=='home')return {ok:false,reason:'Кормушка находится дома'};
      const capacity=feedingStation(next.furnishing,id).model?.capacity??0;
      if(!capacity)return {ok:false,reason:'Сначала установи автоматическую кормушку'};
      const before=feederReserve(data).length;if(before>=capacity)return {ok:false,reason:'Бункер уже заполнен'};
      if(!dryRefills(next,id))return {ok:false,reason:'Для кормушки нужен сухой корм'};
      const count=loadFeeder(next,id)-before;message='В кормушку загружено '+count+' насыпаний';break;
    }
    case 'feed':
      if (next.petBowls[id] > 0)
        return { ok: false, reason: 'В миске ' + spec.name + ' ещё есть корм. Дождись, пока питомец его съест' };
      if(next.petFood[id]<=0&&dispenseFeeder(next,id,false)){message='Корм выдан из запаса кормушки';break;}
      if (next.petFood[id] <= 0)
        return { ok: false, reason: 'Корм для ' + spec.name + ' закончился — купи ещё одну пачку' };
      const food=nextPetFood(data);
      if(food){data.foodQueue!.shift();data.bowlFood=food.id;}else delete data.bowlFood;
      next.petFood[id]--;
      next.petBowls[id] += PET_BOWL_CAPACITY;
      message = names[role] + ': насыпано ' + PET_BOWL_CAPACITY + ' порции в миску ' + spec.name +
        ' · осталось насыпаний в запасе: ' + next.petFood[id]+(food?' · '+food.name:'');
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
  const point = petCarePoint(next, id, kind,role);
  if (point) Object.assign(actor, point, { pose: 'idle' });
  next.revision++;
  return { ok: true, state: next, message };
}

/** Cancel a reserved climb/rest and give the existing rig time to descend. */
export function yieldSimbaFurniture(source:GameState,role:CharacterId,key:string,now:number):PetResult {
  if(source.world.places[role]!=='home')return {ok:false,reason:'Убрать Симбу можно из дома'};
  const site=catOccupiedPerch(source);
  if(!site||site.key!==key)return {ok:true,state:source,message:'Симба уже освободил место'};
  const next=structuredClone(source),pet=next.pets.simba,routine=pet.routine!;
  const position=sampleWalk(routine.route,Math.max(0,now-routine.startedAt)*PET_SPEED.simba/GAME_MINUTES_PER_REAL_SECOND).from;
  const start=Math.floor(now);
  pet.position=position;
  pet.furnitureYield={perch:site,clearAt:start+4,cooldownUntil:start+14};
  // A stationary floor routine releases the existing client perch, without teleporting.
  pet.routine={kind:'come',target:0,startedAt:start,until:start+4,route:{from:position,path:[]},goal:position};
  next.revision++;
  return {ok:true,state:next,message:'Симба освобождает место'};
}
