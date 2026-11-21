import { RECIPES, TAKEOUT, type RecipeId, type TakeoutId } from '../src/shared/food';
import { VITAL_NEEDS, type VitalNeed } from '../src/shared/life';
import { points, type ActionId, type CharacterId, type GameState, type TimedCommand } from '../src/shared/protocol';
import { HOME_FLOOR, type HomeLeisure } from '../src/shared/home';
import { meeting, placeObstacles } from '../src/shared/locations';
import { planWalk } from '../src/game/navigation';
import { petCarePoint } from './pets';
import { evaluateTask } from './tasks';

const selfCare: Record<Exclude<VitalNeed, 'hunger'>, ActionId> = {
  energy: 'bedSleep', hygiene: 'bathShower', bladder: 'toiletUse', social: 'sofaCall', fun: 'watchTv', comfort: 'sofaRest',
};


export function planLeisure(state: GameState, role: CharacterId, activity: HomeLeisure) {
  if((activity==='tv'&&state.furnishing.soldFixtures?.includes('sofa'))||
     (activity==='computer'&&state.furnishing.soldFixtures?.includes('desk')))return null;
  const target = activity === 'chat' ? meeting('home', role)
    : activity === 'tv' ? points.sofa : activity === 'computer' ? points.desk
      : petCarePoint(state, activity);
  return target && planWalk(state.characters[role], target, placeObstacles('home',state.furnishing), HOME_FLOOR);
}

export function urgentHomeAction(state: GameState, role: CharacterId): TimedCommand | undefined {
  const character = state.characters[role];
  const urgent = VITAL_NEEDS.filter(need => character[need] <= 8)
    .sort((first, second) => character[first] - character[second]);
  for (const need of urgent) {
    if(need==='energy'&&state.furnishing.soldFixtures?.includes('bed'))continue;
    if(need==='comfort'&&state.furnishing.soldFixtures?.includes('sofa'))continue;
    if(need!=='hunger')return { type: 'act', actionId: selfCare[need] };
    const cooked = (Object.keys(RECIPES) as RecipeId[]).find(recipe => state.meals[recipe] > 0);
    if (cooked) return { type: 'eat', recipe: cooked };
    const takeout = (Object.keys(TAKEOUT) as TakeoutId[]).find(item => state.takeout[item] > 0);
    if (takeout) return { type: 'eat_takeout', item: takeout };
    const recipe = (Object.keys(RECIPES) as RecipeId[]).find(recipe => evaluateTask(state, role, { type: 'cook', recipe }).ok);
    if (recipe) return { type: 'cook', recipe };
  }
}
