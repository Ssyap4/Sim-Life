import { electronicsModel } from '../src/shared/electronics';
import { COMPUTER_GAMES, GAME_BY_ID, VIDEO_CLIPS, gamePreference, isComputerGameId,
  isVideoClipId } from '../src/shared/computerGames';
import { computerDevice } from '../src/shared/computer';
import { serviceAvailable } from '../src/shared/services';
import { gameMinutes } from '../src/shared/life';
import { laptopApproach,laptopDesk,laptopWorkplace } from '../src/shared/furnitureUse';
import { points, type CharacterId, type GameState } from '../src/shared/protocol';

type Result = {ok:true;state:GameState;message:string} | {ok:false;reason:string};
const fail=(reason:string):Result=>({ok:false,reason});
const adjust=(state:GameState,role:CharacterId,key:'fun'|'mood'|'energy'|'comfort'|'skill',delta:number)=>{
  state.characters[role][key]=Math.max(0,Math.min(100,state.characters[role][key]+delta));
};
const pose=(state:GameState,role:CharacterId,device:unknown)=>{
  const spot=device==='laptop' ? laptopApproach(state,role) : points.desk;
  Object.assign(state.characters[role],spot,{pose:'work'});
};

export function completeComputerGame(source:GameState,role:CharacterId,id:unknown,device:unknown):Result {
  if (!isComputerGameId(id) || !computerDevice(device)) return fail('Игра или компьютер не найдены');
  if(device==='laptop'&&laptopDesk(source)&&!laptopWorkplace(source,role))return fail('Освободи подход к ноутбуку');
  if (source.world.places[role]!=='home') return fail('Играть можно за домашним компьютером');
  const game=GAME_BY_ID.get(id)!;
  const state=structuredClone(source),profile=state.computerLibrary[role];
  const hardware=electronicsModel(state,role,device);
  adjust(state,role,'fun',game.fun+gamePreference(role,game.genre)+hardware.bonus);
  adjust(state,role,'mood',game.mood);
  adjust(state,role,'energy',game.energy);
  adjust(state,role,'comfort',game.comfort+hardware.comfort);
  if (game.skill) adjust(state,role,'skill',game.skill);
  profile.recent=[id,...profile.recent.filter(other=>other!==id)].slice(0,5);
  profile.last=id;
  profile.sessions=Math.min(1000000,profile.sessions+1);
  pose(state,role,device);
  state.revision++;
  return {ok:true,state,message:'🎮 '+game.title+' · сыграна партия'};
}

export function completeComputerVideo(source:GameState,role:CharacterId,id:unknown,device:unknown):Result {
  if (!isVideoClipId(id) || !computerDevice(device)) return fail('Ролик или компьютер не найдены');
  if(device==='laptop'&&laptopDesk(source)&&!laptopWorkplace(source,role))return fail('Освободи подход к ноутбуку');
  if (source.world.places[role]!=='home') return fail('Смотреть ролики можно дома');
  if (!serviceAvailable(source.billing,'internet',gameMinutes(source.clock))) return fail('Для ролика нужен действующий интернет');
  const state=structuredClone(source),clip=VIDEO_CLIPS[id];
  const hardware=electronicsModel(state,role,device);
  adjust(state,role,'fun',clip.fun+hardware.bonus);
  adjust(state,role,'comfort',hardware.comfort);
  adjust(state,role,'mood',clip.mood);
  adjust(state,role,'energy',-2);
  pose(state,role,device);
  state.revision++;
  return {ok:true,state,message:'▶ '+clip.title+' · просмотрено'};
}

export function changeComputerFavorite(source:GameState,role:CharacterId,id:unknown,on:unknown):Result {
  if (!isComputerGameId(id) || typeof on!=='boolean') return fail('Неизвестная игра или действие');
  if (source.world.places[role]!=='home') return fail('Каталог игр доступен дома');
  const old=source.computerLibrary[role].favorites;
  if (old.includes(id)===on) return {ok:true,state:source,message:'Список избранного без изменений'};
  const state=structuredClone(source);
  const favorites=state.computerLibrary[role].favorites;
  state.computerLibrary[role].favorites=on?[...favorites,id]:favorites.filter(entry=>entry!==id);
  state.revision++;
  return {ok:true,state,message:(on?'⭐ В избранное: ':'☆ Удалено из избранного: ')+
    (GAME_BY_ID.get(id)?.title??COMPUTER_GAMES[0].title)};
}
