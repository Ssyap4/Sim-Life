import {CARE,careEffects,type CareId} from './vanity';
import {isCatchRecipe} from './lake';
import { residentEmotion, rankLeisure, PERSONALITIES } from './emotions';
import { isNotebookDesk } from './furniture';
import { RECIPES, TAKEOUT, isGrillRecipe, type RecipeId, type TakeoutId } from './food';
import { VITAL_NEEDS, dayPhase, gameMinutes, NEED_INFO, type VitalNeed } from './life';
import { recipeAvailability } from './recipeAvailability';
import { BOOKS, type BookId } from './homeLife';
import { COMPUTER_GAMES, VIDEO_CLIPS, type VideoClipId } from './computerGames';
import { furnitureComfort } from './furnitureComfort';
import { canFurniturePerform } from './furnitureUse';
import { CALM_VARIANTS, THOUGHT_VARIANTS } from './thoughtNarrative';
import type { CharacterId, GameState, TimedCommand } from './protocol';

export type AutonomyMode = 'off' | 'needs' | 'full';
export const AUTONOMY_MODES: readonly AutonomyMode[] = ['off', 'needs', 'full'];
export const AUTONOMY_LABELS: Record<AutonomyMode, string> = {
  off: 'Выключена', needs: 'Забота о потребностях', full: 'Полная',
};
export type AutonomySettings = Record<CharacterId, AutonomyMode>;
export const INITIAL_AUTONOMY: AutonomySettings = { vlad:'off', alina:'off' };
export function validAutonomy(value: unknown): value is AutonomySettings {
  if (!value || typeof value!=='object' || Array.isArray(value)) return false;
  const v=value as Record<string,unknown>;
  return Object.keys(v).length===2 && AUTONOMY_MODES.includes(v.vlad as AutonomyMode) &&
    AUTONOMY_MODES.includes(v.alina as AutonomyMode);
}
const PHYSICAL_NEEDS:readonly VitalNeed[]=['bladder','hunger','energy','hygiene'];
export function urgentPhysicalNeed(state:GameState,role:CharacterId):VitalNeed|undefined{
  const p=state.characters[role];
  if(p.bladder<=15)return 'bladder';
  return PHYSICAL_NEEDS.filter(n=>p[n]<=15).sort((a,b)=>p[a]-p[b])[0];
}
export interface AutoChoice {
  command: TimedCommand;
  need: VitalNeed;
  reason: string;
}
/** Never invent resources, buy groceries, travel to work, or charge household money.
 * Candidates are only suggestions. The authoritative server must still validate
 * each command, route, access and shared fixture reservation before execution. */
export function autonomyCandidates(state: GameState, role: CharacterId): AutoChoice[] {
  if(state.autonomy[role]==='off') return [];
  const person=state.characters[role], mode=state.autonomy[role];
  const threshold=50;
  const needy=VITAL_NEEDS.filter(need=>person[need]<=threshold)
    .sort((a,b)=>{
      const priority=(n:VitalNeed)=>n==='bladder'&&person[n]<=15?0:PHYSICAL_NEEDS.includes(n)&&person[n]<=15?1:2;
      return priority(a)-priority(b)||person[a]-person[b];
    });
  const candidates:AutoChoice[]=[];
  const offer=(need:VitalNeed,command:TimedCommand,reason:string)=>{
    candidates.push({need,command,reason});
  };
  const furnitureChoice=(need:VitalNeed,
    fixture:'sofa'|'desk'|'table',action:'sofaRest'|'sofaMusic'|'sofaCall'|'deskGames'|'tableTalk'|'tableRest',reason:string)=>{
    if(!state.furnishing.soldFixtures?.includes(fixture)){
      offer(need,{type:'act',actionId:action},reason);
    }
    // Installed replacements are real stations. No ghost use of a sold
    // starter couch, desk or table and no fixed number of purchased items.
    for(const item of [...state.furnishing.placed].sort((a,b)=>furnitureComfort(b.sku)-furnitureComfort(a.sku))){
      if(!isNotebookDesk(item.sku)&&canFurniturePerform(item,action))
        offer(need,{type:'furniture_use',furnitureId:item.id,action},reason);
    }
  };
  for(const need of needy){
    switch(need){
      case 'bladder':
        offer(need,{type:'act',actionId:'toiletUse'},'Хочу в туалет — лучше не откладывать.');
        break;
      case 'hunger':{
        const meals=(Object.keys(RECIPES) as RecipeId[]).filter(id=>state.meals[id]>0&&
          state.readyFood.some(batch=>batch.kind==='meal'&&batch.item===id&&
            batch.storage==='table'&&batch.portions>0&&batch.expiresAt>gameMinutes(state.clock)));
        // Prefer regular meals to grilled food when both exist, to avoid
        // leaving the house for the grill table on a casual snack.
        meals.sort((a,b)=>Number(isGrillRecipe(a))-Number(isGrillRecipe(b)));
        for(const recipe of meals)offer(need,{type:'eat',recipe},'Что-то я проголодался. Пора поесть.');
        for(const item of Object.keys(TAKEOUT) as TakeoutId[])
          if(state.readyFood.some(batch=>batch.kind==='takeout'&&batch.item===item&&
            batch.storage==='table'&&batch.portions>0&&batch.expiresAt>gameMinutes(state.clock)))
            offer(need,{type:'eat_takeout',item},'На столе есть готовая еда.');
        if(state.readyFood.some(batch=>batch.storage==='fridge'&&batch.portions>0&&batch.expiresAt>gameMinutes(state.clock)))
          offer(need,{type:'act',actionId:'kitchenServe'},'Достану готовую еду из холодильника.');
        // No purchase, delivery or money spending without a player's command.
        if(person.energy>=16)
          for(const recipe of Object.keys(RECIPES) as RecipeId[]){
            if(isCatchRecipe(recipe)||isGrillRecipe(recipe)||!recipeAvailability(state,role,recipe).available)continue;
            offer(need,{type:'cook',recipe},'Готового нет — приготовлю из домашних продуктов.');
          }
        break;
      }
      case 'energy':
        if(!state.furnishing.soldFixtures?.includes('bed'))
          offer(need,{type:'act',actionId:person.energy<=24?'bedSleep':'bedNap'},'Сил осталось мало. Нужно выспаться.');
        furnitureChoice(need,'sofa','sofaRest','Надо немного отдохнуть.');
        break;
      case 'hygiene':
        offer(need,{type:'act',actionId:'bathShower'},'Хочется освежиться и принять душ.');
        offer(need,{type:'act',actionId:'bathWash'},'Умоюсь, пока душ занят.');
        offer(need,{type:'act',actionId:'kitchenWash'},'Можно освежиться у раковины.');
        break;
      case 'social':
        furnitureChoice(need,'sofa','sofaCall','Давно ни с кем не разговаривал(а).');
        furnitureChoice(need,'table','tableTalk','Напишу близким пару тёплых слов.');
        break;
      case 'fun':
        if(mode==='full')offer(need,{type:'pet_action',pet:PERSONALITIES[role].pet,action:'pet'},
          role==='vlad'?'Интересно, как там Симба?':'Проведаю Верделла.');
        furnitureChoice(need,'desk','deskGames','Хочется отвлечься за компьютером.');
        if(role==='alina')offer(need,{type:'act',actionId:'deskGames',computer:'laptop'},'Можно немного поиграть на ноутбуке.');
        furnitureChoice(need,'sofa','sofaMusic','Хочется послушать что-нибудь приятное.');
        {
          if(!state.furnishing.soldFixtures?.includes('bookcase'))
            offer(need,{type:'read_book',book:'prince'},'Есть настроение почитать.');
          else for(const item of state.furnishing.placed){
            if(canFurniturePerform(item,'read_book'))
              offer(need,{type:'furniture_use',furnitureId:item.id,action:'read_book',book:'prince'},
                'Почитаю что-нибудь на свободном месте.');
          }
        }
        if(!state.furnishing.soldFixtures?.includes('sofa'))
          offer(need,{type:'free_tv'},'Хочется посмотреть телевизор.');
        else for(const item of state.furnishing.placed){
          if(canFurniturePerform(item,'free_tv'))
            offer(need,{type:'furniture_use',furnitureId:item.id,action:'free_tv'},
              'Можно посмотреть что-нибудь по телевизору.');
        }
        break;
      case 'comfort':
        furnitureChoice(need,'sofa','sofaRest','Посижу в уютном месте.');
        furnitureChoice(need,'table','tableRest','Посижу за столом.');
        for(const item of state.furnishing.placed)if(canFurniturePerform(item,'officeChairSit'))
          offer(need,{type:'furniture_use',furnitureId:item.id,action:'officeChairSit'},'Устроюсь в удобном кресле.');
        break;
    }
  }
  return candidates;
}

/** No fictional food or automatically purchased groceries. */
export function foodSupplyProblem(state:GameState,role:CharacterId):boolean{
  if(state.characters[role].hunger>50)return false;
  if(state.readyFood.some(b=>b.portions>0&&b.expiresAt>gameMinutes(state.clock)))return false;
  return !(Object.keys(RECIPES) as RecipeId[]).some(id=>
    !isCatchRecipe(id)&&!isGrillRecipe(id)&&recipeAvailability(state,role,id).available);
}

/** Broad real full-mode actions, rotated by successful decision cycles. */
export function fullLeisureCandidates(state:GameState,role:CharacterId,turn:number):TimedCommand[]{
  if(state.autonomy[role]!=='full')return [];
  const books=Object.keys(BOOKS) as BookId[];
  const games=COMPUTER_GAMES;
  const clips=Object.keys(VIDEO_CLIPS) as VideoClipId[];
  const device=role==='alina'?'laptop':'desktop';
  const pet=PERSONALITIES[role].pet;
  const actions:TimedCommand[]=[
    {type:'play_game',game:games[turn%games.length].id,device},
    {type:'computer_video',clip:clips[turn%clips.length],device},
    {type:'read_book',book:books[turn%books.length]},
    {type:'free_tv'},
    {type:'pet_action',pet,action:'play'},
    {type:'pet_action',pet,action:'brush'},
    {type:'pet_action',pet:pet==='simba'?'verdell':'simba',action:'play'},
    {type:'act',actionId:'tableTalk'},
    {type:'act',actionId:'sofaCall'},
    {type:'act',actionId:'kitchenTidy'},
    {type:'act',actionId:role==='vlad'?'vladStudy':'alinaStudy',computer:device},
    {type:'act',actionId:role==='vlad'?'vladOrder':'alinaConsult',computer:device},
    {type:'act',actionId:'deskJournal',computer:device},
    {type:'act',actionId:'kitchenTea'},
    {type:'act',actionId:'sofaMusic'},
    {type:'act',actionId:'tablePlan'},
    {type:'act',actionId:'bathSoak'},
  ];
  if(role==='alina'&&state.world.places[role]==='home'&&Math.min(state.characters[role].hunger,state.characters[role].energy,state.characters[role].bladder,state.characters[role].hygiene)>50){
    const active=careEffects(state,role);
    for(const care of ['style','light','skin','perfume'] as CareId[])if(!active.some(e=>CARE[e.id].group===CARE[care].group))actions.push({type:'vanity_care',care});
  }
  const offset=turn%actions.length;
  return rankLeisure([...actions.slice(offset),...actions.slice(0,offset)],role,state.characters[role],turn,residentEmotion(state,role).id);
}

const expressions:Record<VitalNeed,Record<CharacterId,readonly string[]>>={
  hunger:{vlad:['Пора перекусить. Интересно, что у нас готово?','Может, приготовить что-нибудь вкусное?'],
    alina:['Кажется, я проголодалась. Что сегодня на обед?','Хочется чего-нибудь домашнего и вкусного.']},
  energy:{vlad:['Сегодня столько дел… Надо бы отдохнуть.','Неплохо бы немного поспать.'],
    alina:['Хочется укутаться в плед и отдохнуть.','Кажется, пора восстанавливать силы.']},
  bladder:{vlad:['Сначала нужно заглянуть в туалет.','Потом продолжу дела, а сейчас — в уборную.'],
    alina:['Надо ненадолго отлучиться.','Пожалуй, сначала зайду в туалет.']},
  hygiene:{vlad:['После всех дел хочется принять душ.','Самое время освежиться.'],
    alina:['Хочется расслабиться под тёплым душем.','Нужно немного привести себя в порядок.']},
  social:{vlad:['Интересно, как там Алина? Надо поболтать.','Хочется с кем-нибудь поговорить.'],
    alina:['Хочется поболтать с Владом.','Может, провести немного времени вместе?']},
  fun:{vlad:['Поиграть бы немного на компьютере.','Как насчёт спокойного вечера с игрой?'],
    alina:['Хочется включить музыку.','Может, посмотреть что-нибудь интересное?']},
  comfort:{vlad:['Пожалуй, наведу немного уюта.','Хочется устроиться поудобнее.'],
    alina:['Дома так приятно, когда всё на своих местах.','Посидеть бы в уютной комнате.']},
};
const calm:Record<CharacterId,readonly string[]>={
  vlad:['Всё спокойно. Можно немного насладиться моментом.','Хорошо дома, когда никуда не нужно спешить.',
    'Может, придумать что-нибудь интересное?'],
  alina:['Как приятно побыть дома.','Сегодня можно побаловать себя спокойным вечером.',
    'В доме так уютно, когда все рядом.'],
};
export function thoughtFor(state:GameState,role:CharacterId):{text:string;need?:VitalNeed;emoji:string}{
  const person=state.characters[role];
  const needs=VITAL_NEEDS.map(need=>({need,value:person[need]}))
    .sort((a,b)=>a.value-b.value);
  const lowest=needs[0];
  const cycle=Math.floor(gameMinutes(state.clock)/75)+(role==='alina'?3:0);
  if(lowest.value<=50){
    const phrases=[...expressions[lowest.need][role],...THOUGHT_VARIANTS[lowest.need][role]];
    return {need:lowest.need,emoji:NEED_INFO[lowest.need].emoji,
      text:phrases[cycle%phrases.length]};
  }
  const emotion=residentEmotion(state,role);
  if(emotion.id==='sad')return {text:role==='vlad'?'Что-то день не задался. Хочется переключиться.':'Хочется немного тепла и спокойствия.',emoji:emotion.emoji};
  if(emotion.id==='inspired')return {text:role==='vlad'?'Есть силы разобраться в новой задаче по разработке. Каждый маленький проект — шаг к своей студии.':'Хочется освоить ещё одну технику реконструкции волос. Это шаг к собственной студии!',emoji:emotion.emoji};
  const time=dayPhase(state.clock);
  const phrase=time==='night'
    ? role==='vlad'?'Тихий вечер. Хорошо бы отдохнуть перед новым днём.':
      'Вечер дома — лучшее время для спокойствия.'
    : [...calm[role],...CALM_VARIANTS[role]][cycle%(calm[role].length+CALM_VARIANTS[role].length)];
  return {text:phrase,emoji:time==='night'?'🌙':'💭'};
}
