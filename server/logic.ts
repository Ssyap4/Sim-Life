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
      change(state, role, 'comfort', 12);
      message = name + ': отдых на диване'; break;
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
    // Legacy small orders are preserved for compatibility; realistic salaries
    // will be balanced in the dedicated Moscow-region economy milestone.
    case 'vladOrder':
      if (state.characters.vlad.energy < 10) return { ok: false, reason: 'Владу сначала нужно отдохнуть' };
      state.money += 120; change(state, role, 'skill', 6);
      change(state, role, 'energy', -11); change(state, role, 'hunger', -7);
      message = 'Влад выполнил заказ: +120 ₽'; break;
    case 'vladStudy':
      change(state, role, 'skill', 11); change(state, role, 'energy', -7);
      message = 'Влад изучил приёмы разработки'; break;
    case 'deskGames':
      change(state, role, 'fun', 25); change(state, role, 'energy', -4);
      change(state, role, 'mood', 5);
      message = name + ': поиграл(а) на компьютере'; break;
    case 'deskJournal':
      change(state, role, 'mood', 8); change(state, role, 'comfort', 5);
      message = name + ': записал(а) свои мысли'; break;
    case 'alinaStudy':
      change(state, role, 'skill', 11); change(state, role, 'energy', -7);
      message = 'Алина изучила основы реконструкции волос'; break;
    case 'alinaConsult':
      if (state.characters.alina.skill < 15) return { ok: false, reason: 'Сначала пройди обучение (навык 15)' };
      if (state.characters.alina.energy < 10) return { ok: false, reason: 'Алине сначала нужно отдохнуть' };
      state.money += 80; change(state, role, 'skill', 5);
      change(state, role, 'energy', -8); change(state, role, 'mood', 3);
      message = 'Алина провела консультацию: +80 ₽'; break;
    case 'kitchenWash':
      change(state, role, 'hygiene', 30); change(state, role, 'mood', 3);
      message = name + ': умывание у раковины'; break;
    case 'kitchenTidy':
      change(state, role, 'comfort', 16); change(state, role, 'hygiene', 4);
      change(state, role, 'energy', -4);
      message = name + ': кухня стала чище и уютнее'; break;
    case 'kitchenTea':
      change(state, role, 'fun', 8); change(state, role, 'energy', 3);
      change(state, role, 'mood', 4);
      message = name + ': заварил(а) чай'; break;
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
  const point = points[def.item];
  Object.assign(state.characters[role], { x: point.x, z: point.z, pose: def.pose });
  state.revision += 1;
  return { ok: true, message, state };
}
