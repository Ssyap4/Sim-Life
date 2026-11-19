import {
  ACTIONS, points, names, type ActionId, type CharacterId,
  type GameState, type Needs,
} from '../src/shared/protocol';

export type ActionResult =
  | { ok: true; message: string; state: GameState }
  | { ok: false; reason: string };

const change = (state: GameState, id: CharacterId, key: keyof Needs, delta: number): void => {
  const next = state.characters[id][key] + delta;
  state.characters[id][key] = Math.max(0, Math.min(100, next));
};

export function applyAction(source: GameState, role: CharacterId, actionId: string): ActionResult {
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
    case 'sofaRest':
      change(state, role, 'energy', 12); change(state, role, 'mood', 4);
      message = name + ': отдых на диване'; break;
    case 'sofaMovie':
      change(state, role, 'mood', 15); change(state, role, 'energy', -3);
      message = name + ': приятный вечер за фильмом'; break;
    case 'bedSleep':
      change(state, role, 'energy', 37); change(state, role, 'hunger', -6);
      message = name + ': хороший сон'; break;
    case 'bedNap':
      change(state, role, 'energy', 15); change(state, role, 'hunger', -2);
      message = name + ': короткий сон'; break;
    case 'vladOrder':
      if (state.characters.vlad.energy < 10) return { ok: false, reason: 'Владу сначала нужно отдохнуть' };
      state.money += 120; change(state, role, 'skill', 6);
      change(state, role, 'energy', -11); change(state, role, 'hunger', -7);
      message = 'Влад выполнил заказ: +120 ₽'; break;
    case 'vladStudy':
      change(state, role, 'skill', 11); change(state, role, 'energy', -7);
      message = 'Влад изучил приёмы разработки'; break;
    case 'alinaStudy':
      change(state, role, 'skill', 11); change(state, role, 'energy', -7);
      message = 'Алина изучила основы реконструкции волос'; break;
    case 'alinaConsult':
      if (state.characters.alina.skill < 15) return { ok: false, reason: 'Сначала пройди обучение (навык 15)' };
      if (state.characters.alina.energy < 10) return { ok: false, reason: 'Алине сначала нужно отдохнуть' };
      state.money += 80; change(state, role, 'skill', 5);
      change(state, role, 'energy', -8); change(state, role, 'mood', 3);
      message = 'Алина провела консультацию: +80 ₽'; break;
    case 'omelette':
      if (state.pantry.eggs < 2) return { ok: false, reason: 'Для омлета не хватает двух яиц' };
      state.pantry.eggs -= 2; change(state, role, 'hunger', 32);
      change(state, role, 'mood', 5); change(state, role, 'energy', -4);
      message = name + ': омлет готов, осталось яиц: ' + state.pantry.eggs; break;
    case 'snack':
      if (state.pantry.bread < 1) return { ok: false, reason: 'Хлеб закончился' };
      state.pantry.bread -= 1; change(state, role, 'hunger', 13);
      message = name + ': хлеба осталось: ' + state.pantry.bread; break;
    case 'watchTv':
      change(state, role, 'mood', 13); change(state, role, 'energy', -2);
      message = name + ': посмотрел(а) телевизор'; break;
    case 'tableRest':
      change(state, role, 'energy', 6); change(state, role, 'mood', 3);
      message = name + ': отдых за столом'; break;
    case 'buyEggs':
      if (state.money < 30) return { ok: false, reason: 'В бюджете не хватает 30 ₽' };
      state.money -= 30; state.pantry.eggs += 2;
      message = name + ': куплено 2 яйца за 30 ₽ (демо-доставка)'; break;
    case 'buyBread':
      if (state.money < 20) return { ok: false, reason: 'В бюджете не хватает 20 ₽' };
      state.money -= 20; state.pantry.bread += 1;
      message = name + ': куплен хлеб за 20 ₽ (демо-доставка)'; break;
  }
  if (def.item !== 'delivery') {
    const point = points[def.item];
    Object.assign(state.characters[role], { x: point.x, z: point.z, pose: def.pose });
  }
  state.revision += 1;
  return { ok: true, message, state };
}
