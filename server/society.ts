import { activityItems, needsItem, otherPerson, SOCIAL_BY_ID, socialRestriction,
  type PairMotion, type PairPresentation, type Relationship, type SocialActivity, type SocialIntent } from '../src/shared/socialLife';
import { HOME_PLACEMENTS, GRILL_WORK, homeSeat, KITCHEN_WORK, LIBRARY_APPROACH } from '../src/shared/home';
import { approachFor, floorFor, meeting, placeObstacles, stationById, type PlaceId, type Point } from '../src/shared/locations';
import { gameMinutes } from '../src/shared/life';
import { BOOKS, YOUTUBE, type Genre, type BookId, type HomePresentation, type HomeSeat, type Program, type NeedEffects } from '../src/shared/homeLife';
import type { CharacterId, GameState, TimedCommand } from '../src/shared/protocol';
import { PETS, type PetId, type PetAction } from '../src/shared/pets';
import { RECIPES, isGrillRecipe, type RecipeId } from '../src/shared/food';
import { MATERIAL_BY_ID } from '../src/shared/educationCatalog';
import { completeStudy, practiceXP, studyDenial } from './education';
import { evaluateTask, type EvaluatedTask } from './tasks';
import { dishCount, dirtyDishStops } from '../src/shared/dirtyDishes';
import { expireReadyFood, readyFoodTableUsage, TABLE_READY_CAPACITY } from '../src/shared/readyFood';
import { planWalk, pointIsClear } from '../src/game/navigation';
import { RESIDENT_CLEARANCE } from '../src/game/residentCollision';

export const BOND_WINDOW=240;
const MEMORY_LIMIT=40, RECENT_LIMIT=48;
const fail=(reason:string):EvaluatedTask=>({ok:false,reason});

export function validRelationship(value:unknown):value is Relationship {
  if (!value||typeof value!=='object') return false;
  const r=value as Partial<Relationship>;
  const stamp=(at:unknown)=>typeof at==='number'&&Number.isSafeInteger(at)&&at>=0;
  return (r.lastTogether===undefined||stamp(r.lastTogether))&&Array.isArray(r.memories)&&r.memories.length<=MEMORY_LIMIT&&
    r.memories.every(m=>m&&stamp(m.at)&&typeof m.action==='string'&&['talk','care','home','romance','fun'].includes(m.group)&&
      typeof m.title==='string'&&m.title.length<=120&&typeof m.description==='string'&&m.description.length<=240)&&
    Array.isArray(r.recent)&&r.recent.length<=RECENT_LIMIT&&r.recent.every(e=>e&&stamp(e.at)&&typeof e.action==='string');
}

export function cooperationDenial(state:GameState,from:CharacterId,command:SocialIntent,individual=false):string|undefined {
  const a=SOCIAL_BY_ID.get(command.action);
  if (!a) return 'Неизвестное совместное занятие';
  const restriction=socialRestriction(a,state,from,individual);
  if(restriction) return restriction;
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

const petActions:Record<string,Exclude<PetAction,'buyFood'>>={petPlay:'play',petFeed:'feed',petPet:'pet',petBrush:'brush'};
export function socialResource(a:SocialActivity,item?:string) { return petActions[a.id]?'pet:'+item:a.resource??null; }
export function socialDuration(a:SocialActivity,command:SocialIntent){
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
    ['takeout','read','table'].includes(a.object??'')?'table':undefined;
  const work:Partial<Record<CharacterId,{motion:PairMotion; destination:Point; target?:Point; stops?:Point[]}>>={};
  let seats:Partial<Record<CharacterId,HomeSeat>>=seated?{vlad:seated,alina:seated}:{};
  const table=(role:CharacterId)=>homeSeat('table',role).approach;
  const yard=(role:CharacterId)=>homeSeat('yardTable',role).approach;
  const prep=KITCHEN_WORK.tidy;
  const fridge=stationById('home','fridge')!.approach;
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
  const localStation=a.object==='parkRest'?'park-bench':a.object==='cafeMeal'?'cafe-left':null;
  const program:Program|undefined=a.object==='tv'?'broadcast':a.object==='film'?p as Genre:
    a.object==='youtube'?YOUTUBE[(state.relationship.recent.length)%YOUTUBE.length]:a.object==='lesson'?'lesson':undefined;
  for(const role of ['vlad','alina'] as const){
    const seat=seats[role],entry=work[role];
    const station=localStation&&stationById(place,localStation);
    const stroll=a.object==='walk'?walkStops(place,role):undefined;
    const localApproach=station?approachFor(station,role):null;
    if(localApproach)localApproach.x+=role==='vlad'?-.045:.045;
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
    const pair:PairPresentation={motion:entry?.motion??(a.object==='petFeed'&&role!==from?'listen':a.motion),
      place,from,target:focus,seat,station:localStation??undefined,pet,item:p,stroll:onward,
      offsetMs:a.object==='read'&&role!==from?900:0,carry};
    result[role]={route,station:seat??'studyPractice',program,lesson:a.object==='lesson'?p:undefined,
      pickup:picked,pickupMs:picked!==undefined?600:undefined,pair};
  }
  return result as Record<CharacterId,HomePresentation>;
}

export function addRelationship(state:GameState,a:SocialActivity,choice:number) {
  const profile=state.relationship, now=gameMinutes(state.clock);
  const recent=profile.recent.filter(e=>now-e.at<BOND_WINDOW);
  const same=recent.filter(e=>e.action===a.id).length;
  const strength=same===0&&recent.length<3?1:same<2&&recent.length<5?.32:0;
  profile.recent=[...recent,{action:a.id,at:now}].slice(-RECENT_LIMIT);
  profile.lastTogether=now;
  const quiz=a.id==='riddle'?choice===0:a.id==='homelyQuiz'?choice===1:false;
  if (a.memorable&&(strength===1||!profile.memories.some(m=>m.action===a.id))&&
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

export function completeTogether(source:GameState,from:CharacterId,command:SocialIntent,
  roles:CharacterId[],choice:number,homes:Record<CharacterId,HomePresentation>,remember=true):EvaluatedTask{
  const a=SOCIAL_BY_ID.get(command.action)!;
  const denial=cooperationDenial(source,roles.length===1?roles[0]:from,command,roles.length===1);
  if(denial) return fail(denial);
  let state=structuredClone(source);
  let message=a.title+' · готово';
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
    case 'cook':case 'grill': {
      rejected=run(from,{type:'cook',recipe:id as RecipeId});
      if(rejected.ok) {
        change(state,from,{energy:1}); // one less point of effort with a helper
        change(state,to,{energy:-1});
        practiceXP(state,to,'coop:prep:'+id,'cooking','Подготовка продуктов · '+RECIPES[id as RecipeId].name,7,8);
        practiceXP(state,from,'coop:cook:'+id,'cooking','Совместная готовка · '+RECIPES[id as RecipeId].name,12,12);
      }
      break;
    }
    case 'eat':rejected=each({type:'eat',recipe:id as RecipeId});break;
    case 'takeout':rejected=each({type:'eat_takeout',item:id as keyof GameState["takeout"]});break;
    case 'bring':rejected=run(to,{type:'eat',recipe:id as RecipeId});break;
    case 'serve': {
      expireReadyFood(state);
      const batch=state.readyFood.filter(b=>b.kind==='meal'&&b.item===id&&b.storage==='fridge').sort((a,b)=>a.expiresAt-b.expiresAt)[0];
      if(!batch)return fail('Порция больше не хранится в холодильнике');
      batch.portions--;state.readyFood.push({...batch,storage:'table',portions:1});
      if(!batch.portions)state.readyFood.splice(state.readyFood.indexOf(batch),1);
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
    case 'parkRest':rejected=each({type:'local_activity',station:'park-bench',action:'rest'});break;
    case 'cafeMeal':rejected=each({type:'local_activity',station:'cafe-left',action:'dine'});break;
    case 'walk':for(const role of roles) change(state,role,{energy:-1,fun:4});break;
  }
  if(rejected&&!rejected.ok) return rejected;
  if(remember&&roles.length===2){
    const {strength,quiz}=addRelationship(state,a,choice);
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
    Object.assign(state.characters[role],end,{pose:home.pair?.seat||home.pair?.station?'sit':'idle'});
  }
  state.revision++;
  return {ok:true,state,message};
}
