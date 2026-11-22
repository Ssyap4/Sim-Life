import { RECIPES, TAKEOUT, ingredientList, isGrillRecipe, type RecipeId, type TakeoutId } from './food';
import { VITAL_NEEDS, dayPhase, gameMinutes, NEED_INFO, type VitalNeed } from './life';
import { canFurniturePerform } from './furnitureUse';
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
  const threshold: Record<VitalNeed,number> = {
    bladder:38,hunger:46,energy:42,hygiene:43,
    social:mode==='full'?52:30,
    fun:mode==='full'?54:30,
    comfort:mode==='full'?50:30,
  };
  const needy=VITAL_NEEDS.filter(need=>person[need]<=threshold[need])
    .sort((a,b)=>(person[a]-threshold[a])/(threshold[a]+1)-
      (person[b]-threshold[b])/(threshold[b]+1));
  const candidates:AutoChoice[]=[];
  const offer=(need:VitalNeed,command:TimedCommand,reason:string)=>{
    candidates.push({need,command,reason});
  };
  const furnitureChoice=(need:VitalNeed,
    fixture:'sofa'|'desk'|'table',action:'sofaRest'|'sofaMusic'|'sofaCall'|'deskGames'|'tableTalk',reason:string)=>{
    if(!state.furnishing.soldFixtures?.includes(fixture)){
      offer(need,{type:'act',actionId:action},reason);
      return;
    }
    // Installed replacements are real stations. No ghost use of a sold
    // starter couch, desk or table and no fixed number of purchased items.
    for(const item of state.furnishing.placed){
      if(canFurniturePerform(item,action))
        offer(need,{type:'furniture_use',furnitureId:item.id,action},reason);
    }
  };
  for(const need of needy){
    switch(need){
      case 'bladder':
        offer(need,{type:'act',actionId:'toiletUse'},'Хочу в туалет — лучше не откладывать.');
        break;
      case 'hunger':{
        const meals=(Object.keys(RECIPES) as RecipeId[]).filter(id=>state.meals[id]>0);
        // Prefer regular meals to grilled food when both exist, to avoid
        // leaving the house for the grill table on a casual snack.
        meals.sort((a,b)=>Number(isGrillRecipe(a))-Number(isGrillRecipe(b)));
        for(const recipe of meals)offer(need,{type:'eat',recipe},'Что-то я проголодался. Пора поесть.');
        for(const item of Object.keys(TAKEOUT) as TakeoutId[])
          if(state.takeout[item]>0)offer(need,{type:'eat_takeout',item},'В холодильнике есть готовая еда.');
        // No purchase, delivery or money spending without a player's command.
        if(person.energy>=16)
          for(const recipe of Object.keys(RECIPES) as RecipeId[]){
            if(isGrillRecipe(recipe)||!ingredientList(recipe).every(([ing,n])=>state.pantry[ing]>=n))continue;
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
        break;
      case 'social':
        furnitureChoice(need,'sofa','sofaCall','Давно ни с кем не разговаривал(а).');
        furnitureChoice(need,'table','tableTalk','Напишу близким пару тёплых слов.');
        break;
      case 'fun':
        if(mode==='full')offer(need,{type:'pet_action',pet:role==='vlad'?'verdell':'simba',action:'pet'},
          role==='vlad'?'Проведаю Верделла.':'Интересно, как там Симба?');
        if(role==='vlad')furnitureChoice(need,'desk','deskGames','Хочется отвлечься за компьютером.');
        furnitureChoice(need,'sofa',role==='alina'?'sofaMusic':'sofaRest',
          role==='alina'?'Хочется послушать что-нибудь приятное.':'Немного отдыха не помешает.');
        if(role==='alina'){
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
        offer(need,{type:'act',actionId:'kitchenTidy'},'Хочу немного привести дом в порядок.');
        break;
    }
  }
  return candidates;
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
  const cycle=Math.floor(gameMinutes(state.clock)/110)+(role==='alina'?1:0);
  if(lowest.value<=57)
    return {need:lowest.need,emoji:NEED_INFO[lowest.need].emoji,
      text:expressions[lowest.need][role][cycle%expressions[lowest.need][role].length]};
  const time=dayPhase(state.clock);
  const phrase=time==='night'
    ? role==='vlad'?'Тихий вечер. Хорошо бы отдохнуть перед новым днём.':
      'Вечер дома — лучшее время для спокойствия.'
    : calm[role][cycle%calm[role].length];
  return {text:phrase,emoji:time==='night'?'🌙':'💭'};
}
