import {sharedCoffeeOptions} from '../src/shared/coffee';
import {brewCoffee} from './coffee';
import { badmintonWinner } from '../src/shared/badminton';
import { picnicPortions } from '../src/shared/picnic';
import { LEISURE, leisureAction } from '../src/shared/leisure';
import { furnitureUseLocation } from '../src/shared/furnitureUse';
import { cafeSeatAt } from '../src/shared/locations';
import { activityItems, eveningDinnerAction, eveningDishId, eveningMealName, eveningSelection, needsItem, otherPerson, SOCIAL_BY_ID, socialRestriction,
  type PairMotion, type PairPresentation, type Relationship, type SocialActivity, type SocialIntent } from '../src/shared/socialLife';
import { familyMoments, momentDenial, momentReward } from '../src/shared/familyMoments';
import { HOME_PLACEMENTS, GRILL_WORK, homeSeat, KITCHEN_WORK, LIBRARY_APPROACH } from '../src/shared/home';
import { approachFor, floorFor, meeting, placeObstacles, stationById, type PlaceId, type Point } from '../src/shared/locations';
import { gameMinutes } from '../src/shared/life';
import { BOOKS, YOUTUBE, type Genre, type BookId, type HomePresentation, type HomeSeat, type Program, type NeedEffects } from '../src/shared/homeLife';
import type { CharacterId, GameState, TimedCommand } from '../src/shared/protocol';
import { PETS, type PetId, type PetAction } from '../src/shared/pets';
import { RECIPES, TAKEOUT, isGrillRecipe, type RecipeId } from '../src/shared/food';
import { MATERIAL_BY_ID } from '../src/shared/educationCatalog';
import { awardCooking, completeStudy, practiceXP, studyDenial } from './education';
import { evaluateTask, type EvaluatedTask } from './tasks';
import { dishCount, dirtyDishStops } from '../src/shared/dirtyDishes';
import { expireReadyFood, moveReadyFoodToTable, readyFoodTableUsage, TABLE_READY_CAPACITY } from '../src/shared/readyFood';
import { planWalk, pointIsClear } from '../src/game/navigation';
import { FURNITURE_BY_ID } from '../src/shared/furniture';
import { bedCapacity, selectSleepBed } from '../src/shared/bedSleep';
import { RESIDENT_CLEARANCE } from '../src/game/residentCollision';

export const BOND_WINDOW=240;
const MEMORY_LIMIT=40, RECENT_LIMIT=48;
const fail=(reason:string):EvaluatedTask=>({ok:false,reason});

export function validRelationship(value:unknown):value is Relationship {
  if (!value||typeof value!=='object') return false;
  const r=value as Partial<Relationship>;
  const stamp=(at:unknown)=>typeof at==='number'&&Number.isSafeInteger(at)&&at>=0;
  const evening=r.evening;
  const kind=evening?.kind??'cook';
  const validMeal=kind==='takeout'
    ? typeof evening?.takeoutItem==='string'&&Object.hasOwn(TAKEOUT,evening.takeoutItem)&&evening.recipe===undefined
    : (kind==='cook'||kind==='leftovers')&&typeof evening?.recipe==='string'&&
      Object.hasOwn(RECIPES,evening.recipe)&&evening.takeoutItem===undefined;
  const validEvening=evening===undefined||(typeof evening==='object'&&evening!==null&&
    validMeal&&['prepare','dine','unwind','complete'].includes(evening.phase)&&
    (kind!=='takeout'&&kind!=='leftovers'||evening.phase!=='prepare')&&
    (evening.occasion===undefined||['comfort','rest','ordinary'].includes(evening.occasion))&&
    (evening.attentionTo===undefined||['vlad','alina'].includes(evening.attentionTo))&&
    stamp(evening.startedAt)&&
    (evening.phase==='complete' ? stamp(evening.completedAt)&&evening.completedAt!==undefined&&evening.completedAt>=evening.startedAt :
      evening.completedAt===undefined));
  return validEvening&&(r.lastTogether===undefined||stamp(r.lastTogether))&&Array.isArray(r.memories)&&r.memories.length<=MEMORY_LIMIT&&
    r.memories.every(m=>m&&stamp(m.at)&&typeof m.action==='string'&&['talk','care','home','romance','fun'].includes(m.group)&&
      typeof m.title==='string'&&m.title.length<=120&&typeof m.description==='string'&&m.description.length<=240)&&
    Array.isArray(r.recent)&&r.recent.length<=RECENT_LIMIT&&r.recent.every(e=>e&&stamp(e.at)&&typeof e.action==='string');
}

export function cooperationDenial(state:GameState,from:CharacterId,command:SocialIntent,individual=false):string|undefined {
  const a=SOCIAL_BY_ID.get(command.action);
  if (!a) return 'Неизвестное совместное занятие';
  const restriction=socialRestriction(a,state,from,individual);
  if(restriction) return restriction;
  // Early individual finishing of a legitimately accepted shared meal happens
  // after the first portion is consumed, when the original two-portion trigger
  // is naturally gone. The server already validated its story on invitation.
  if(!individual){
    const momentProblem=momentDenial(state,from,command);
    if(momentProblem)return momentProblem;
  }
  const onePortion=individual&&(a.object==='eat'&&state.meals[command.item as RecipeId]>=1||
    a.object==='takeout'&&state.takeout[command.item as keyof GameState["takeout"]]>=1);
  if(needsItem(a)&&!onePortion&&!activityItems(a,state,from).some(item=>item.id===command.item)) return 'Выбранное блюдо, питомец или материал больше недоступны';
  if(a.object==='lesson') {
    const material=MATERIAL_BY_ID.get(command.item!)!;
    for(const member of [from,otherPerson(from)]) {
      const denial=studyDenial(state,member,material,gameMinutes(state.clock));
      if(denial) return denial;
    }
  }
  if(a.object==='serve'&&readyFoodTableUsage(state)>=TABLE_READY_CAPACITY) return 'На столе нет свободного места';
}

const petActions:Record<string,Exclude<PetAction,'buyFood'|'call'|'perch'|'fetch'|'mat'|'scratch'|'toy'|import('../src/shared/dogTraining').DogTrainingAction>>={petPlay:'play',petFeed:'feed',petPet:'pet',petBrush:'brush'};
export function socialResource(a:SocialActivity,item?:string) { return a.object==='leisure'?'furniture:'+item:petActions[a.id]?'pet:'+item:a.resource??null; }
export function socialDuration(a:SocialActivity,command:SocialIntent,state?:GameState){
  if(a.object==='leisure'&&state){const item=state.furnishing.placed.find(i=>String(i.id)===command.item),action=item&&leisureAction(item.sku);if(action)return LEISURE[action].seconds*1000;}
  return 1000*(a.object==='lesson'?Math.max(10,(MATERIAL_BY_ID.get(command.item!)?.minutes??10)*2):a.seconds);
}
export const socialPet=(command:SocialIntent)=>petActions[command.action]&&command.action!=='petFeed'?command.item as PetId:undefined;

function twoSpots(state:GameState,place:PlaceId,origins:Record<CharacterId,Point>,gap:number,target?:Point){
  const obstacles=placeObstacles(place,state.furnishing),floor=floorFor(place);
  const midpoint={x:(origins.vlad.x+origins.alina.x)/2,z:(origins.vlad.z+origins.alina.z)/2};
  const centers=target ? [
    ...[.77,1.02,1.22,1.52].flatMap(distance=>[0,Math.PI/2,Math.PI,Math.PI*1.5,.6,2.2,3.8,5.4].map(a=>
      ({x:target.x+Math.cos(a)*distance,z:target.z+Math.sin(a)*distance}))),
  ] : [midpoint,meeting(place,'vlad'),{x:.45,z:2.9},{x:1.0,z:3.65}];
  const half=gap/2;
  for(const middle of centers) {
    const axis=target?Math.atan2(middle.x-target.x,target.z-middle.z):Math.atan2(origins.alina.z-origins.vlad.z,origins.alina.x-origins.vlad.x);
    for(const angle of [axis,axis+Math.PI,axis+Math.PI/2,0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const dx=Math.cos(angle)*half,dz=Math.sin(angle)*half;
      const v={x:middle.x-dx,z:middle.z-dz},a={x:middle.x+dx,z:middle.z+dz};
      if(pointIsClear(v,obstacles,floor)&&pointIsClear(a,obstacles,floor)&&
        planWalk(origins.vlad,v,obstacles,floor)&&planWalk(origins.alina,a,obstacles,floor)) return {vlad:v,alina:a};
    }
  }
}

function walkStops(place:PlaceId,role:CharacterId) {
  const lane=role==='vlad'?-.47:.47;
  return place==='park'?
    [{x:-2.75+lane,z:3.0},{x:-2.75+lane,z:-2.5},{x:-2.75+lane,z:3.1},{x:2.1+lane,z:3.25}]:
    [{x:.48+lane,z:6.25},{x:.48+lane,z:11.13},{x:.48+lane,z:6.8},{x:.48+lane,z:10.72}];
}

export function pairScenes(state:GameState,from:CharacterId,command:SocialIntent):Record<CharacterId,HomePresentation>|null {
  const a=SOCIAL_BY_ID.get(command.action)!;
  const place=state.world.places[from],obstacles=placeObstacles(place,state.furnishing),floor=floorFor(place);
  const to=otherPerson(from),p=command.item;
  if(a.object==='leisure'){
    const item=state.furnishing.placed.find(i=>String(i.id)===p),action=item&&leisureAction(item.sku);
    if(!item||!action||!LEISURE[action].paired)return null;
    const v=furnitureUseLocation(state,'vlad',item.id,action),al=furnitureUseLocation(state,'alina',item.id,action);
    if(!v||!al)return null;
    const tennisWinner=action==='pingPong'?badmintonWinner():undefined;
    const build=(l:typeof v):HomePresentation=>({route:l.route,station:'furniture',furnitureId:item.id,furniturePose:l.pose,furnitureSeat:LEISURE[action].seated,pair:{motion:'leisure',place,from,item:action,target:{x:item.x,z:item.z},tennisWinner}});
    return {vlad:build(v),alina:build(al)};
  }
  if(a.object==='bedRest'){
    if(place!=='home')return null;
    const candidates=state.furnishing.soldFixtures?.includes('bed')?state.furnishing.placed.filter(item=>bedCapacity(item)===2).map(item=>item.id):[undefined];
    for(const id of candidates){
      const v=selectSleepBed(state,'vlad',id),al=selectSleepBed(state,'alina',id);
      if(!v.ok||!al.ok||v.bed.id!==al.bed.id||v.bed.capacity!==2)continue;
      const result={} as Record<CharacterId,HomePresentation>;
      for(const [role,bed] of [['vlad',v.bed],['alina',al.bed]] as const){
        const side=role==='vlad'?-1:1,yaw=bed.pose.yaw;
        const alternatives=[{x:bed.approach.x+side*.55*Math.cos(yaw),z:bed.approach.z-side*.55*Math.sin(yaw)},bed.approach,
          {x:bed.pose.x+side*1.15*Math.cos(yaw),z:bed.pose.z-side*1.15*Math.sin(yaw)}];
        const route=alternatives.filter(p=>pointIsClear(p,obstacles,floor)).map(p=>planWalk(state.characters[role],p,obstacles,floor)).find(r=>r&&(!result.vlad||Math.hypot((r.path.at(-1)??r.from).x-(result.vlad.route.path.at(-1)??result.vlad.route.from).x,(r.path.at(-1)??r.from).z-(result.vlad.route.path.at(-1)??result.vlad.route.from).z)>=RESIDENT_CLEARANCE));
        if(!route)break;
        result[role]={route,station:'furniture',furnitureId:typeof bed.id==='number'?bed.id:undefined,furniturePose:bed.pose,pair:{motion:'bedRest',place,from,bed:bed.id}};
      }
      if(result.vlad&&result.alina)return result;
    }
    return null;
  }
  const intimateSeat=['sofaLean','sofaHands','sofaKiss','sofaHug','cuddle'].includes(a.motion);
  const compactSeat=(own:{x:number;y:number;z:number;yaw:number},other:{x:number;z:number})=>{
    const gap=Math.hypot(other.x-own.x,other.z-own.z);
    const ratio=gap>.58?(gap-.58)/(2*gap):0;
    return {...own,x:own.x+(other.x-own.x)*ratio,z:own.z+(other.z-own.z)*ratio};
  };
  if(a.object==='sofa'&&state.furnishing.soldFixtures?.includes('sofa')){
    for(const item of state.furnishing.placed){
      const spec=FURNITURE_BY_ID.get(item.sku);
      if(!spec||!['sofa','corner'].includes(spec.shape)||spec.width<1.8)continue;
      const v=furnitureUseLocation(state,'vlad',item.id,'sofaRest'),al=furnitureUseLocation(state,'alina',item.id,'sofaRest');
      if(!v||!al)continue;
      const yaw=item.rotation*Math.PI/2;
      const local=(x:number,z:number)=>({x:item.x+x*Math.cos(yaw)+z*Math.sin(yaw),z:item.z-x*Math.sin(yaw)+z*Math.cos(yaw)});
      const routes=(role:CharacterId,l:typeof v)=>{
        const side=role==='vlad'?-1:1;
        const options=[l.route,...[[-side*spec.width*.20,spec.depth/2+.75],[side*spec.width*.20,spec.depth/2+.75],
          [side*spec.width*.20,-spec.depth/2-.75],[0,-spec.depth/2-.75],[side*(spec.width/2+.75),0],
          [-side*(spec.width/2+.75),0],[side*(spec.width/2+.75),.85],[side*(spec.width/2+.75),-.85]].map(([x,z])=>local(x,z))
          .filter(p=>pointIsClear(p,obstacles,floor)).map(p=>planWalk(state.characters[role],p,obstacles,floor))];
        return options.filter((r):r is NonNullable<typeof r>=>!!r);
      };
      const build=(l:typeof v,route:typeof v.route):HomePresentation=>({route,station:'furniture',furnitureId:item.id,furniturePose:intimateSeat?compactSeat(l.pose,l===v?al.pose:v.pose):l.pose,furnitureSeat:true,pair:{motion:a.motion,place,from}});
      for(const vr of routes('vlad',v))for(const ar of routes('alina',al)){
        const ve=vr.path.at(-1)??vr.from,ae=ar.path.at(-1)??ar.from;
        if(Math.hypot(ve.x-ae.x,ve.z-ae.z)>=RESIDENT_CLEARANCE)return {vlad:build(v,vr),alina:build(al,ar)};
      }
    }
    return null;
  }
  const walk=(src:Point,destination:Point)=>planWalk(src,destination,obstacles,floor);
  const chain=(src:Point,stops:Point[])=>{
    let origin:Point|undefined, path:Point[]=[];
    for(const goal of stops){
      const part=walk(src,goal); if(!part) return null;
      origin??=part.from; path.push(...part.path); src=part.path.at(-1)??part.from;
    }
    return origin?{from:origin,path}:null;
  };
  const origins=state.characters;
  const seated:HomeSeat|undefined=
    ['tv','film','youtube','lesson','sofa'].includes(a.object??'')?'sofa':
    a.object==='eat'||a.object==='bring'?isGrillRecipe(p as RecipeId)?'yardTable':'table':
    ['takeout','read','table','teaTogether'].includes(a.object??'')?'table':['yardTea','yardRest','yardCoffee'].includes(a.object??'')?'yardTable':undefined;
  const work:Partial<Record<CharacterId,{motion:PairMotion; destination:Point; target?:Point; stops?:Point[]}>>={};
  let seats:Partial<Record<CharacterId,HomeSeat>>=seated?{vlad:seated,alina:seated}:{};
  const table=(role:CharacterId)=>homeSeat('table',role).approach;
  const yard=(role:CharacterId)=>homeSeat('yardTable',role).approach;
  const prep=KITCHEN_WORK.tidy;
  const fridge=stationById('home','fridge')!.approach;
  if(a.object==='breakfastCare'){
    seats={[to]:'table'};
    work[from]={motion:'cook',destination:KITCHEN_WORK.stove.position,target:KITCHEN_WORK.stove.target};
    work[to]={motion:'sitTalk',destination:table(to),target:KITCHEN_WORK.stove.target};
  }
  if(a.object==='cook'||a.object==='grill'){
    const grill=a.object==='grill', unit=grill?GRILL_WORK:KITCHEN_WORK.stove;
    work[from]={motion:grill?'grill':'cook',destination:unit.position,target:unit.target};
    work[to]=grill?{motion:'prep',destination:yard(to),target:HOME_PLACEMENTS.yardTable}:
      {motion:'prep',destination:KITCHEN_WORK.wash.position,target:KITCHEN_WORK.wash.target};
  }
  if(a.object==='dishes'){
    work[from]={motion:'wash',destination:KITCHEN_WORK.dishes.position,target:KITCHEN_WORK.dishes.target};
    work[to]={motion:'serve',destination:prep.position,target:prep.target,stops:dirtyDishStops(state.dirtyDishes,to,state)};
  }
  if(a.object==='unpack'){
    work[from]={motion:'unpack',destination:table(from),target:HOME_PLACEMENTS.table};
    work[to]={motion:'unpack',destination:table(to),target:HOME_PLACEMENTS.table};
  }
  if(a.object==='serve'||a.object==='bring'){
    if(a.object==='serve') {
      work[from]={motion:'serve',destination:table(from),target:HOME_PLACEMENTS.table,stops:[fridge]};
      work[to]={motion:'unpack',destination:table(to),target:HOME_PLACEMENTS.table};
    } else {
      const seat=seated!;
      seats={[to]:seat};
      const target=seat==='yardTable'?HOME_PLACEMENTS.yardTable:HOME_PLACEMENTS.table;
      work[from]={motion:'serve',destination:homeSeat(seat,from).approach,target,stops:[fridge]};
      work[to]={motion:'eat',destination:homeSeat(seat,to).approach,target};
    }
  }
  const pet=petActions[a.id]?p as PetId:undefined;
  const petTarget=pet?(a.object==='petFeed'?PETS[pet].bowl:state.pets[pet].position):undefined;
  const contact=['kiss','cheek','hug','closeHug','hands','hair','shoulder','highFive','slowDance'].includes(a.motion);
  const spot=petTarget||(!a.object&&!seated)?twoSpots(state,place,origins,
    contact?RESIDENT_CLEARANCE+.05:1.10,petTarget):undefined;
  const result:Partial<Record<CharacterId,HomePresentation>>={};
  const cafeSeat=cafeSeatAt(state,from);
  const sameCafeSeat=cafeSeat&&cafeSeat.id===cafeSeatAt(state,to)?.id;
  const seatedChat=sameCafeSeat&&!a.object&&['talk','listen','explain','laugh','sitTalk'].includes(a.motion);
  const localStation=a.object==='parkRest'?'park-bench':a.object==='parkBadminton'?'park-badminton':a.object==='parkTalk'?(['park-swing','park-picnic'].find(id=>{const s=stationById('park',id)!,p=approachFor(s,from);return Math.hypot(p.x-state.characters[from].x,p.z-state.characters[from].z)<.28;})??null):a.object==='parkSwing'?'park-swing':a.object==='picnic'?'park-picnic':a.object==='cafeMeal'?(state.world.cafe[from]?.table??'cafe-left'):a.object==='cafeTalk'||seatedChat?cafeSeat?.id??null:null;
  const program:Program|undefined=a.object==='tv'?'broadcast':a.object==='film'?p as Genre:
    a.object==='youtube'?YOUTUBE[(state.relationship.recent.length)%YOUTUBE.length]:a.object==='lesson'?'lesson':undefined;
  const matchWinner=a.object==='parkBadminton'?badmintonWinner():undefined;
  for(const role of ['vlad','alina'] as const){
    const seat=seats[role],entry=work[role];
    const station=localStation&&stationById(place,localStation);
    const stroll=a.object==='walk'?walkStops(place,role):undefined;
    const localApproach=station?approachFor(station,role):null;
    if(localApproach&&place!=='cafe')localApproach.x+=role==='vlad'?-.045:.045;
    const destination=entry?.destination??(seat?homeSeat(seat,role).approach:localApproach??stroll?.[0]??spot?.[role]);
    if(!destination) return null;
    const stops=entry?.stops??(a.object==='read'?[LIBRARY_APPROACH]:[]);
    const route=chain(origins[role],[...stops,destination]);
    if(!route) return null;
    let onward:Point[]|undefined;
    if(stroll){
      const loop=chain(destination,stroll.slice(1));
      if(!loop) return null;
      onward=loop.path;
    }
    const focus=entry?.target??petTarget??(station?station.center:spot?.[otherPerson(role)]);
    const carry=a.object==='read'?'book':entry?.stops?.length?'plate':undefined;
    const picked=carry&&stops.length?walk(origins[role],stops[0])?.path.length:undefined;
    const pair:PairPresentation={motion:entry?.motion??(seatedChat?'sitTalk':a.object==='petFeed'&&role!==from?'listen':a.motion),
      place,from,target:focus,seat,station:localStation??undefined,pet,item:a.object==='cafeMeal'?state.world.cafe[role]?.item:a.object==='picnic'?picnicPortions(state,role)[0]?.item:p,stroll:onward,
      offsetMs:a.object==='read'&&role!==from?900:0,carry,badmintonWinner:matchWinner};
    result[role]={route,station:seat??'studyPractice',program,lesson:a.object==='lesson'?p:undefined,
      pickup:picked,pickupMs:picked!==undefined?600:undefined,pair};
    if(intimateSeat&&seat==='sofa'){
      const own=homeSeat(seat,role),other=homeSeat(seat,otherPerson(role));
      result[role]!.furniturePose=compactSeat({...own.position,yaw:own.yaw},other.position);
      result[role]!.furnitureSeat=true;
    }
  }
  return result as Record<CharacterId,HomePresentation>;
}

export function addRelationship(state:GameState,a:SocialActivity,choice:number,storyOnly=false) {
  const profile=state.relationship, now=gameMinutes(state.clock);
  const recent=profile.recent.filter(e=>now-e.at<BOND_WINDOW);
  const same=recent.filter(e=>e.action===a.id).length;
  const strength=same===0&&recent.length<3?1:same<2&&recent.length<5?.32:0;
  profile.recent=[...recent,{action:a.id,at:now}].slice(-RECENT_LIMIT);
  profile.lastTogether=now;
  const quiz=a.id==='riddle'?choice===0:a.id==='homelyQuiz'?choice===1:false;
  if (a.memorable&&!storyOnly&&(strength===1||!profile.memories.some(m=>m.action===a.id))&&
      !profile.memories.some(m=>m.action===a.id&&now-m.at<1440)){
    profile.memories.push({action:a.id,group:a.group,at:now,title:a.title,description:a.replies[choice]??a.lines[0]});
    profile.memories=profile.memories.slice(-MEMORY_LIMIT);
  }
  return {strength,quiz};
}
function change(state:GameState,role:CharacterId,effects:NeedEffects,strength=1){
  for(const [key,value] of Object.entries(effects)){
    const needs=state.characters[role],need=key as keyof NeedEffects;
    needs[need]=Math.max(0,Math.min(100,needs[need]+Math.round(value*strength)));
  }
}
const socialEffects:Record<SocialActivity['group'],NeedEffects>={
  talk:{social:5,mood:2},care:{social:5,mood:4,comfort:3},home:{social:4,comfort:2},
  romance:{social:6,mood:3,comfort:3},fun:{social:3,fun:5,mood:2},
};

export function parkConversation(source:GameState,from:CharacterId,topic:SocialActivity,choice:number):GameState{
  const next=structuredClone(source);const {strength}=addRelationship(next,topic,choice);
  for(const role of [from,otherPerson(from)])change(next,role,socialEffects[topic.group],strength);
  next.revision++;return next;
}

export function completeTogether(source:GameState,from:CharacterId,command:SocialIntent,
  roles:CharacterId[],choice:number,homes:Record<CharacterId,HomePresentation>,remember=true):EvaluatedTask{
  const a=SOCIAL_BY_ID.get(command.action)!;
  const denial=cooperationDenial(source,roles.length===1?roles[0]:from,command,roles.length===1);
  if(denial) return fail(denial);
  let state=structuredClone(source);
  let message=a.title+' · готово';
  // Capture the legitimate opportunity now, before any real task changes pantry,
  // pet bowls, dirty plates or needs. A forged id was rejected above.
  const moment=command.moment?familyMoments(source,from).find(m=>m.id===command.moment):undefined;
  const id=command.item!,to=otherPerson(from);
  const run=(role:CharacterId,c:TimedCommand)=>{
    const home=homes[role],end=home.route.path.at(-1)??home.route.from;
    Object.assign(state.characters[role],end);
    const result=evaluateTask(state,role,c,false);
    if(result.ok){state=result.state;message=result.message;}
    return result;
  };
  const each=(c:TimedCommand)=>{
    for(const role of roles){const result=run(role,c);if(!result.ok)return result;}
  };
  let rejected:EvaluatedTask|undefined;
  switch(a.object){
    case 'breakfastCare':{
      if(roles.length!==2)return fail('Для заботы нужен второй участник');
      rejected=run(from,{type:'cook',recipe:id as RecipeId});
      if(rejected.ok){
        awardCooking(state,from,id as RecipeId);
        message='Завтрак готов: '+RECIPES[id as RecipeId].name+' · '+RECIPES[id as RecipeId].servings+' порц. на столе';
      }
      break;
    }
    case 'cook':case 'grill': {
      rejected=run(from,{type:'cook',recipe:id as RecipeId});
      if(rejected.ok) {
        change(state,from,{energy:1}); // one less point of effort with a helper
        change(state,to,{energy:-1});
        awardCooking(state,to,id as RecipeId,true);
        awardCooking(state,from,id as RecipeId);
        const gainA=state.education.characters[from].xp.cooking -
          source.education.characters[from].xp.cooking;
        const gainB=state.education.characters[to].xp.cooking -
          source.education.characters[to].xp.cooking;
        message+=' · 🍲 Кулинария: +'+gainA+' / +'+gainB+' XP';
      }
      break;
    }
    case 'eat':rejected=each({type:'eat',recipe:id as RecipeId});break;
    case 'takeout':rejected=each({type:'eat_takeout',item:id as keyof GameState["takeout"]});break;
    case 'bring':rejected=run(to,{type:'eat',recipe:id as RecipeId});break;
    case 'serve': {
      expireReadyFood(state);
      if(!moveReadyFoodToTable(state,'meal',id))return fail('В холодильнике нет свежих порций');
      message='На стол подана одна порция · '+RECIPES[id as RecipeId].name;
      break;
    }
    case 'dishes':{
      const count=dishCount(state.dirtyDishes);
      rejected=run(from,{type:'act',actionId:'kitchenDishes'});
      if(rejected.ok){change(state,from,{energy:1});change(state,to,{energy:-1,comfort:Math.min(7,count*2)});}
      break;
    }
    case 'unpack': {
      const packs=state.world.tableBags;
      state.world.tableBags=0; // Stock was already added by checkout/delivery.
      message='Разобрано пакетов · '+packs;
      break;
    }
    case 'tv':rejected=each({type:'free_tv'}); break;
    case 'film':rejected=each({type:'movie',genre:id as Genre}); break;
    case 'youtube':rejected=each({type:'youtube'}); break;
    case 'lesson': {
      const material=MATERIAL_BY_ID.get(id)!;
      for(const role of roles) completeStudy(state,role,material,gameMinutes(state.clock));
      message='Короткий урок завершён · '+material.title;break;
    }
    case 'read':{
      for(const role of roles) {
        const first=!state.readBooks[role].includes(id as BookId);
        rejected=run(role,{type:'read_book',book:id as BookId});
        if(!rejected.ok)break;
        if(first)practiceXP(state,role,'coop:reading:'+id,'logic',BOOKS[id as BookId][0],5,6);
      }
      break;
    }
    case 'petPet':case 'petPlay':case 'petFeed':case 'petBrush':
      rejected=run(from,{type:'pet_action',pet:id as PetId,action:petActions[a.id]});break;
    case 'parkSwing':rejected=each({type:'local_activity',station:'park-swing',action:'swing'});break;
    case 'parkBadminton':
      rejected=each({type:'local_activity',station:'park-badminton',action:'badminton'});
      if(!rejected||rejected.ok){
        for(const role of roles)practiceXP(state,role,'coop:parkBadminton','fitness',a.title,12,8);
        if(roles.length===2){const winner=homes.vlad?.pair?.badmintonWinner??badmintonWinner();message=winner==='vlad'?'🏆 Влад победил в бадминтоне!':'🏆 Алина победила в бадминтоне!';change(state,winner,{mood:5});}
      }
      break;
    case 'leisure': {
      const item=state.furnishing.placed.find(i=>String(i.id)===id),action=item&&leisureAction(item.sku);
      if(!item||!action||!LEISURE[action].paired)return fail('Предмет для досуга недоступен');
      rejected=each({type:'furniture_use',furnitureId:item.id,action});
      const skill=LEISURE[action].skill;
      if((!rejected||rejected.ok)&&skill)for(const role of roles)practiceXP(state,role,'coop:leisure:'+action,skill,a.title,12,8);
      if(action==='pingPong'&&roles.length===2&&(!rejected||rejected.ok)){const winner=homes.vlad?.pair?.tennisWinner??badmintonWinner();message=winner==='vlad'?'🏆 Влад победил в настольном теннисе!':'🏆 Алина победила в настольном теннисе!';change(state,winner,{mood:5});}
      break;
    }
    case 'picnic':rejected=each({type:'local_activity',station:'park-picnic',action:'picnic'});break;
    case 'parkRest':rejected=each({type:'local_activity',station:'park-bench',action:'rest'});break;
    case 'cafeMeal':{
      for(const role of roles){
        rejected=run(role,{type:'local_activity',station:state.world.cafe[role]?.table??'cafe-left',action:'dine'});
        if(!rejected.ok)break;
      }
      break;
    }
    case 'yardCoffee':{
      const option=sharedCoffeeOptions(source,from).find(o=>o.id===id);
      if(!option||roles.length!==2)return fail('Кофе или дневной лимит закончился');
      for(const role of roles){
        const result=brewCoffee(state,role,option.blend,option.drink);
        if(!result.ok)return result;
        state=result.state;
        change(state,role,{fun:5,comfort:5});
      }
      break;
    }
    case 'teaTogether':case 'yardTea':{
      if(state.pantry.tea<roles.length)return fail('Закончился чай');
      state.pantry.tea-=roles.length;
      for(const role of roles)change(state,role,{fun:8,energy:3,mood:4,comfort:4});
      break;
    }
    case 'yardRest':for(const role of roles)change(state,role,{comfort:9,fun:4});break;
    case 'sofa':if(a.id==='musicTogether')for(const role of roles)change(state,role,{fun:14,comfort:6});break;
    case 'walk':for(const role of roles) change(state,role,{energy:-1,fun:4});break;
  }
  if(rejected&&!rejected.ok) return rejected;
  if(roles.length===2&&['kiss','cheek','hug','closeHug','sofaKiss','sofaHug','cuddle'].includes(a.motion))healthContact(state);
  if(remember&&roles.length===2){
    const {strength,quiz}=addRelationship(state,a,choice,!!moment);
    const now=gameMinutes(state.clock);
    if(moment)message+=momentReward(state,from,moment);
    if(a.id==='eveningPlan'){
      // Every proposed option was revalidated against REAL food and stock in cooperationDenial.
      const choice=eveningSelection(id)!;
      const partner=otherPerson(from),responseTo=state.characters[partner];
      const focus=responseTo.mood<45?'comfort':responseTo.energy<40?'rest':'ordinary';
      state.relationship.evening={...choice,phase:choice.kind==='cook'?'prepare':'dine',
        startedAt:now,occasion:focus,attentionTo:focus==='ordinary'?undefined:partner};
      message='Вечер запланирован · '+eveningMealName(state.relationship.evening)+
        (choice.kind==='cook'?' · приготовьте вместе':' · уже на столе, зовите друг друга ужинать');
    } else {
      const evening=state.relationship.evening;
      if(evening?.phase==='prepare'&&a.id==='cook'&&id===evening.recipe){
        evening.phase='dine';
        message+=' · 🍽️ Ужин готов: пригласите друг друга к столу';
      } else if(evening?.phase==='dine'&&a.id===eveningDinnerAction(evening)&&id===eveningDishId(evening)){
        evening.phase='unwind';
        message+=' · ✨ Теперь можно отдохнуть вдвоём';
      } else if(evening?.phase==='unwind'&&[
        'film','tv','youtube','cuddle','sofaTalk','slowDance','eveningHeartTalk','read','petPlay','petPet',
      ].includes(a.id)){
        evening.phase='complete';
        evening.completedAt=now;
        const meal=eveningMealName(evening).toLowerCase();
        const opening=evening.kind==='takeout'?'разделили доставку':
          evening.kind==='leftovers'?'поужинали готовым блюдом':'приготовили ужин';
        const ending=a.id==='film'?'посмотрели фильм':a.id==='tv'?'посмотрели телевизор':
          a.id==='youtube'?'посмотрели видео':a.id==='slowDance'?'потанцевали':
          a.id==='cuddle'?'посидели в обнимку':
          a.id==='eveningHeartTalk'?'поговорили по душам':
          a.id==='read'?'почитали рядом':
          a.id==='petPlay'||a.id==='petPet'?'провели время с '+(PETS[id as PetId]?.name??'питомцем'):
          'поговорили на диване';
        // One lasting memory and extra reward per 240 game minutes; ordinary activities still work.
        const recent=state.relationship.memories.some(m=>m.action==='homeEvening'&&now-m.at<BOND_WINDOW);
        if(!recent) {
          const occasion=evening.occasion==='comfort'&&evening.attentionTo?
            ' Было важно поддержать '+(evening.attentionTo==='alina'?'Алину':'Влада')+'.':
            evening.occasion==='rest'?' Удалось отвлечься и восстановить силы.':'';
          state.relationship.memories.push({action:'homeEvening',group:'romance',at:now,
            title:evening.occasion==='comfort'?'Вечер заботы':'Наш вечер вдвоём',
            description:'Вместе '+opening+' — '+meal+', а потом '+ending+'.'+occasion});
          state.relationship.memories=state.relationship.memories.slice(-MEMORY_LIMIT);
          for(const member of roles)change(state,member,{mood:5,social:4,comfort:4});
          if(evening.attentionTo==='vlad'||evening.attentionTo==='alina') {
            if(evening.occasion==='comfort')change(state,evening.attentionTo,{mood:4,social:3});
            if(evening.occasion==='rest')change(state,evening.attentionTo,{energy:4,comfort:3});
          }
        }
        message+=recent?' · 💛 Ещё один хороший вечер вместе':' · 💛 Тёплый вечер сохранён в воспоминаниях';
      }
    }
    for(const role of roles) {
      const response=role===to&&a.group==='care'?
        choice===1?{social:5,mood:2,comfort:5}:choice===2?{social:2,comfort:3}:socialEffects.care:
        socialEffects[a.group];
      change(state,role,response,strength);
    }
    if(quiz){for(const role of roles)change(state,role,{fun:3},strength);message='Угадали! '+a.replies[choice];}
    else if(a.id==='riddle'||a.id==='homelyQuiz')message='Ответ · '+a.replies[a.id==='riddle'?0:1];
    if(!a.object&&strength===1&&a.group==='talk'){
      const key='coop:talk:'+a.id;
      for(const role of roles)if((state.education.characters[role].studied['life:'+key]?.completions??0)<3)
        practiceXP(state,role,key,'communication',a.title,3,5);
    }
  }
  for(const role of roles){
    const home=homes[role], end=home.pair?.stroll?.at(-1)??home.route.path.at(-1)??home.route.from;
    Object.assign(state.characters[role],end,{pose:home.pair?.motion==='badminton'?'idle':home.furnitureSeat||home.pair?.seat||home.pair?.station?'sit':'idle'});
  }
  state.revision++;
  return {ok:true,state,message};
}

import {healthContact} from '../src/shared/health';