import { activeReward, gameReward, initialHappiness, protectNeeds, REWARDS, wishAvailable, type RewardId } from '../src/shared/happiness';
import {bathCare} from '../src/shared/vanity';
import { isSkillId, skillRank } from '../src/shared/education';
import { MATERIAL_BY_ID } from '../src/shared/educationCatalog';
import { gameMinutes } from '../src/shared/life';
import { wishesFor, type Wish } from '../src/shared/wishes';
import type { CharacterId, GameState, TimedCommand } from '../src/shared/protocol';

export function rewardCommand(source:GameState,role:CharacterId,type:unknown,id:unknown){
  if(typeof id!=='string'||!Object.hasOwn(REWARDS,id))return {ok:false as const,reason:'Неизвестная награда'};
  const key=id as RewardId, reward=REWARDS[key],state=structuredClone(source),p=state.happiness[role];
  if(type==='happiness_buy'){
    if(p.points<reward.price)return {ok:false as const,reason:'Не хватает очков счастья'};
    if((p.stock[key]??0)>=99)return {ok:false as const,reason:'Запас наград заполнен'};
    p.points-=reward.price;p.stock[key]=(p.stock[key]??0)+1;
  }else if(type==='happiness_activate'){
    if(!(p.stock[key]??0))return {ok:false as const,reason:'Сначала купи награду'};
    if(activeReward(state,role,key))return {ok:false as const,reason:'Эта награда уже действует'};
    p.stock[key]!--;p.until[key]=gameMinutes(state.clock)+1440;
    state.characters[role][key]=100;
  }else return {ok:false as const,reason:'Неизвестная команда'};
  state.revision++;protectNeeds(state);
  return {ok:true as const,state,message:reward.icon+' '+reward.title+(type==='happiness_buy'?' · куплено':' · действует 24 часа')};
}
type CompletedCommand=TimedCommand|{type:'sleep_start';mode:'half'|'full'};
export function wishAtStart(state:GameState,role:CharacterId,command:CompletedCommand):Wish|undefined {
  const action=command.type==='act'?command.actionId:command.type==='furniture_use'?command.action:command.type;
  return wishesFor(state,role).find(w=>{
    // Real education sessions are valid ways to satisfy the existing personal
    // learning wishes, not just the old short desktop activity.
    if(command.type==='study'){
      const material=MATERIAL_BY_ID.get(command.material);
      if(!material)return false;
      if(w.id.startsWith('goal-'))return w.id.split('-')[1]===material.skill;
      if(w.id==='learn-dev')return material.skill==='technology';
      if(w.id==='learn-hair')return material.skill==='practical';
      return false;
    }
    if(w.id==='learn-dev'||w.id==='goal-technology-'+(skillRank(state.education.characters[role].xp.technology).level+1))
      if(command.type==='act'&&command.actionId==='vladStudy')return true;
    if(w.id==='learn-hair'||w.id==='goal-practical-'+(skillRank(state.education.characters[role].xp.practical).level+1))
      if(command.type==='act'&&command.actionId==='alinaStudy')return true;
    if(w.need==='hunger')return ['eat','eat_takeout'].includes(command.type);
    if(w.need==='energy')return command.type==='sleep_start'||['bedSleep','bedNap','sofaRest'].includes(action);
    if(w.need==='hygiene')return (command.type==='vanity_care'&&bathCare(command.care))||['bathShower','bathSoak','bathFoam','bathWash','bathTeeth'].includes(action);
    if(w.id==='dog-walk')return command.type==='local_activity'&&command.action==='dog';
    if(w.id==='together-time')return command.type==='together'&&(['sofaTalk','yardRest','musicTogether','breakfastCare','breakfastBed','yardCoffee','teaTogether','yardTea','bedRest','cuddle'].includes(command.action)||command.action.startsWith('nearTalk:'));
    if(w.id==='game-break'&&(command.type==='play_game'||action==='deskGames'))return true;
    if(w.id==='reading'&&(command.type==='read_book'||action==='read_book'||action==='sofaRead'))return true;
    const c=w.command;
    if(!c)return false;
    if(c.type==='vanity_care')return command.type==='vanity_care'&&command.care===c.care;
    if(w.id==='vanity-compliment')return command.type==='together'&&command.action==='nearTalk:careLook';
    if(c.type==='act'||c.type==='furniture_use')return (c.type==='act'?c.actionId:c.action)===action;
    if(c.type==='cook'||c.type==='eat')return command.type===c.type&&'recipe' in command&&command.recipe===c.recipe;
    if(c.type==='pet_action')return command.type==='pet_action'&&command.pet===c.pet&&command.action===c.action;
    return false;
  });
}
export function fulfillWish(state:GameState,role:CharacterId,wish:Wish|undefined,before:GameState):string {
  if(!wish||!wishAvailable(state,role,wish.id))return '';
  if(wish.id.startsWith('goal-')){const [,skill,level]=wish.id.split('-');if(!isSkillId(skill)||skillRank(state.education.characters[role].xp[skill]).level<Number(level)||skillRank(before.education.characters[role].xp[skill]).level>=Number(level))return '';}
  // A repeated course which grants no experience must not farm a learning wish.
  if(wish.id==='learn-dev'||wish.id==='learn-hair'){
    const skill=wish.id==='learn-dev'?'technology':'practical';
    if(state.education.characters[role].xp[skill]<=before.education.characters[role].xp[skill])return '';
  }
  if(wish.need&&state.characters[role][wish.need]<=before.characters[role][wish.need]&&wish.need!=='energy')return '';
  const p=state.happiness[role]??(state.happiness[role]=initialHappiness()),reward=gameReward(wish.id);
  const now=gameMinutes(state.clock);
  for(const id of Object.keys(p.fulfilled))if(now-p.fulfilled[id]>=1440)delete p.fulfilled[id];
  p.points+=reward.points;p.count++;p.fulfilled[wish.id]=now;
  state.characters[role].mood=Math.min(100,state.characters[role].mood+reward.mood);
  return ' · ✨ Желание исполнено: +'+reward.points+' счастья, +'+reward.mood+'% настроения';
}
