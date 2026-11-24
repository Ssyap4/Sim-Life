import {initialDust} from '../src/shared/homeDust';
import { electronicsModel } from "../src/shared/electronics";
import {
  ACTIONS, points, names, type ActionId, type CharacterId,
  type GameState, type Needs,
} from '../src/shared/protocol';
import { KITCHEN_ACTIONS, KITCHEN_WORK, homeSeat } from '../src/shared/home';
import { stationById } from '../src/shared/locations';
import { dishCount, EMPTY_DIRTY_DISHES } from '../src/shared/dirtyDishes';
import { gameMinutes } from '../src/shared/life';
import { moveReadyFoodToFridge, moveReadyFoodToTable } from '../src/shared/readyFood';
import { storageCanFit } from '../src/shared/storageSpace';

export type ActionResult =
  | { ok: true; message: string; state: GameState }
  | { ok: false; reason: string };

const change = (state: GameState, id: CharacterId, key: keyof Needs, delta: number): void => {
  const next = state.characters[id][key] + delta;
  state.characters[id][key] = Math.max(0, Math.min(100, next));
};

export function applyAction(source: GameState, role: CharacterId, actionId: string,computer:'desktop'|'laptop'='desktop'): ActionResult {
  if (!(actionId in ACTIONS) || !Object.prototype.hasOwnProperty.call(ACTIONS, actionId)) {
    return { ok: false, reason: 'Неизвестное действие' };
  }
  const key = actionId as ActionId;
  const def = ACTIONS[key];
  if ('role' in def && def.role !== role) {
    return { ok: false, reason: 'Это действие доступно другому персонажу' };
  }
  const state = structuredClone(source);
  const name = names[role];
  let message = '';
  switch (key) {
    case 'windowOpen':case 'windowClose':{
      const open=key==='windowOpen';
      if(Boolean(state.kitchenWindowOpen)===open)return {ok:false,reason:open?'Окно уже открыто':'Окно уже закрыто'};
      state.kitchenWindowOpen=open;
      message=name+(open?': открыл(а) окно для проветривания':': закрыл(а) окно');
      break;
    }
    case 'curtainsOpen':case 'curtainsClose':{
      const closed=key==='curtainsClose';
      if(Boolean(state.kitchenCurtainsClosed)===closed)return {ok:false,reason:closed?'Шторы уже закрыты':'Шторы уже открыты'};
      state.kitchenCurtainsClosed=closed;
      message=name+(closed?': закрыл(а) шторы':': открыл(а) шторы');
      break;
    }
    case 'sofaRest':
    case 'officeChairSit':
      change(state, role, 'energy', 12); change(state, role, 'mood', 4);
      change(state, role, 'comfort', 12);
      message = name + (key === 'sofaRest' ? ': отдых на диване' : ': отдых в кресле'); break;
    case 'sofaMovie':
      change(state, role, 'mood', 15); change(state, role, 'energy', -3);
      change(state, role, 'fun', 23); change(state, role, 'comfort', 5);
      message = name + ': приятный вечер за фильмом'; break;
    case 'sofaRead':
      change(state, role, 'fun', 17); change(state, role, 'comfort', 7);
      change(state, role, 'mood', 4);
      message = name + ': почитал(а) книгу'; break;
    case 'sofaMusic':
      change(state, role, 'fun', 14); change(state, role, 'mood', 6);
      message = name + ': отдых под музыку'; break;
    case 'sofaCall':
      change(state, role, 'social', 22); change(state, role, 'mood', 4);
      message = name + ': приятный разговор по телефону'; break;
    case 'sofaScroll': {
      const phone=electronicsModel(state,role,'phone');
      change(state,role,'fun',18+phone.bonus);change(state,role,'mood',4+phone.comfort);
      message=name+': полистал(а) ленту';break;
    }
    case 'bedSleep':
      change(state, role, 'energy', 37); change(state, role, 'hunger', -6);
      change(state, role, 'comfort', 12);
      message = name + ': хороший сон'; break;
    case 'bedNap':
      change(state, role, 'energy', 15); change(state, role, 'hunger', -2);
      change(state, role, 'comfort', 5);
      message = name + ': короткий сон'; break;
    case 'bedMake':
      change(state, role, 'comfort', 13); change(state, role, 'mood', 3);
      message = name + ': заправлена кровать'; break;
    case 'bedStretch':
      change(state, role, 'energy', 5); change(state, role, 'mood', 5);
      change(state, role, 'hygiene', -2);
      message = name + ': утренняя зарядка'; break;
    // Legacy demo actions are now unpaid practice. Real shift payouts are server-clock based.
    case 'vladOrder':
      change(state,role,'skill',5);change(state,role,'energy',-6);
      message='Влад потренировался выполнять простые задания'; break;
    case 'vladStudy':
      change(state, role, 'skill', 11); change(state, role, 'energy', -7);
      message = 'Влад изучил приёмы разработки'; break;
    case 'deskGames':
      const pc=electronicsModel(state,role,computer);
      change(state, role, 'fun', 25+pc.bonus); change(state, role, 'comfort', pc.comfort); change(state, role, 'energy', -4);
      change(state, role, 'mood', 5);
      message = name + ': поиграл(а) на компьютере'; break;
    case 'deskJournal':
      change(state, role, 'mood', 8); change(state, role, 'comfort', 5);
      message = name + ': записал(а) свои мысли'; break;
    case 'alinaStudy':
      change(state, role, 'skill', 11); change(state, role, 'energy', -7);
      message = 'Алина изучила основы реконструкции волос'; break;
    case 'alinaConsult':
      change(state,role,'skill',4);change(state,role,'social',3);
      change(state,role,'energy',-4);
      message='Алина потренировалась общаться с клиентами'; break;
    case 'kitchenWash':
      change(state, role, 'hygiene', 30); change(state, role, 'mood', 3);
      message = name + ': умывание у раковины'; break;
    case 'kitchenDishes': {
      const count = dishCount(state.dirtyDishes);
      if (!count) return { ok: false, reason: 'Грязной посуды пока нет' };
      state.dirtyDishes = { ...EMPTY_DIRTY_DISHES };
      change(state, role, 'comfort', Math.min(12, count * 3));
      change(state, role, 'energy', -2);
      message = name + ': вымыта посуда — ' + count + ' шт.';
      break;
    }
    case 'kitchenServe': {
      // Lay the table with up to two real servings from the coldest/oldest
      // available batches, with the same freshness and table capacity rules
      // used by selecting an individual meal in the fridge UI.
      const now=gameMinutes(state.clock);
      const portions=state.readyFood.filter(batch=>batch.storage==='fridge' &&
        batch.portions>0 && batch.expiresAt>now)
        .sort((a,b)=>a.expiresAt-b.expiresAt);
      if(!portions.length)return {ok:false,reason:'В холодильнике нет готовых порций'};
      let moved=0,blocked='';
      for(const entry of portions){
        for(let i=0;i<entry.portions&&moved<2;i++){
          const candidate=structuredClone(state);
          if(!moveReadyFoodToTable(candidate,entry.kind,entry.item))break;
          const fit=storageCanFit(state,candidate);
          if(!fit.ok){blocked=fit.reason;break;}
          state.readyFood=candidate.readyFood;
          state.meals=candidate.meals;
          state.takeout=candidate.takeout;
          moved++;
        }
        if(moved===2||blocked)break;
      }
      if(!moved)return {ok:false,reason:blocked||'Не удалось накрыть стол'};
      change(state,role,'energy',-1);
      change(state,role,'comfort',2);
      message=name+': на стол поставлено '+moved+' порц.';
      break;
    }
    case 'kitchenLeftovers': {
      // Real kitchen chore: move at most four existing, fresh portions, oldest
      // first. A fridge without room is respected; nothing is conjured,
      // duplicated, revived after expiry, or charged to the household.
      const now = gameMinutes(state.clock);
      const portions = state.readyFood.filter(batch=>batch.storage==='table' &&
        batch.portions>0 && batch.expiresAt>now)
        .sort((a,b)=>a.expiresAt-b.expiresAt);
      if(!portions.length)return {ok:false,reason:'На столе нет свежих готовых порций'};
      let moved=0,blocked='';
      for(const entry of portions){
        for(let i=0;i<entry.portions && moved<4;i++){
          const candidate=structuredClone(state);
          if(!moveReadyFoodToFridge(candidate,entry.kind,entry.item))break;
          const fit=storageCanFit(state,candidate);
          if(!fit.ok){blocked=fit.reason;break;}
          state.readyFood=candidate.readyFood;
          state.meals=candidate.meals;
          state.takeout=candidate.takeout;
          moved++;
        }
        if(moved===4||blocked)break;
      }
      if(!moved)return {ok:false,reason:blocked||'Нечего убирать в холодильник'};
      change(state,role,'energy',-2);
      change(state,role,'comfort',Math.min(6,2+moved));
      message=name+': в холодильник убрано '+moved+' порц.'+
        (blocked?' Остальная еда пока осталась на столе.':'');
      break;
    }
    case 'kitchenTidy':
      state.homeDust={...(state.homeDust??initialDust()),kitchen:0};
      change(state, role, 'comfort', 16); change(state, role, 'hygiene', 4);
      change(state, role, 'energy', -4);
      message = name + ': кухня стала чище и уютнее'; break;
    case 'kitchenTea':
      change(state, role, 'fun', 8); change(state, role, 'energy', 3);
      change(state, role, 'mood', 4);
      message = name + ': заварил(а) чай'; break;
    case 'toiletUse':
      change(state, role, 'bladder', 100);
      message = name + ': нужда восстановлена'; break;
    case 'wcWash':
      change(state, role, 'hygiene', 12);
      message = name + ': руки вымыты'; break;
    case 'bathShower':
      change(state, role, 'hygiene', 80);
      message = name + ': освежился после душа'; break;
    case 'bathSoak':
      change(state, role, 'hygiene', 90); change(state, role, 'comfort', 24);
      change(state, role, 'mood', 5);
      message = name + ': отдохнул(а) в ванной'; break;
    case 'bathTeeth':
      change(state, role, 'hygiene', 20);
      message = name + ': почистил(а) зубы'; break;
    case 'bathFoam':
      change(state, role, 'hygiene', 100); change(state, role, 'comfort', 35); change(state,role,'mood',10);
      message = name + ': расслабился(-ась) в пенной ванне'; break;
    case 'bathWash':
      change(state, role, 'hygiene', 23);
      message = name + ': умывание в ванной'; break;
    case 'watchTv':
      change(state, role, 'mood', 13); change(state, role, 'energy', -2);
      change(state, role, 'fun', 19);
      message = name + ': посмотрел(а) телевизор'; break;
    case 'tvMusic':
      change(state, role, 'fun', 14); change(state, role, 'mood', 7);
      message = name + ': концерт по телевизору'; break;
    case 'tableRest':
      change(state, role, 'energy', 6); change(state, role, 'mood', 3);
      change(state, role, 'comfort', 5);
      message = name + ': отдых за столом'; break;
    case 'tableTalk':
      change(state, role, 'social', 14); change(state, role, 'fun', 5);
      message = name + ': переписка с близкими'; break;
    case 'tablePlan':
      change(state, role, 'comfort', 9); change(state, role, 'mood', 5);
      message = name + ': составлен план дня'; break;
  }
  const point=key==='kitchenLeftovers' ? stationById('home','fridge')!.approach :
    key==='kitchenServe' ? homeSeat('table',role).approach :
    actionId in KITCHEN_ACTIONS
      ? KITCHEN_WORK[KITCHEN_ACTIONS[actionId as keyof typeof KITCHEN_ACTIONS]].position : points[def.item];
  Object.assign(state.characters[role], { x: point.x, z: point.z, pose: def.pose });
  state.revision += 1;
  return { ok: true, message, state };
}
