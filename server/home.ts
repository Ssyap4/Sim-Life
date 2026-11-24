import { catSeatError } from '../src/shared/catOccupancy';
import { homeSeat } from '../src/shared/home';
import { RECIPES, TAKEOUT, type RecipeId, type TakeoutId } from '../src/shared/food';
import { VITAL_NEEDS, type VitalNeed } from '../src/shared/life';
import { points, type ActionId, type CharacterId, type GameState, type TimedCommand } from '../src/shared/protocol';
import { HOME_FLOOR, HOME_STROLL_STOPS, HOME_WALK_SPEED, type HomeLeisure } from '../src/shared/home';
import { meeting, placeObstacles } from '../src/shared/locations';
import { planWalk, type WalkRoute } from '../src/game/navigation';
import { canFurniturePerform, furnitureUseLocation } from '../src/shared/furnitureUse';
import { petCarePoint } from './pets';
import { evaluateTask } from './tasks';

const selfCare: Record<Exclude<VitalNeed, 'hunger'>, ActionId> = {
  energy: 'bedSleep', hygiene: 'bathShower', bladder: 'toiletUse', social: 'sofaCall', fun: 'watchTv', comfort: 'sofaRest',
};


export function planLeisure(state: GameState, role: CharacterId, activity: HomeLeisure) {
  if(activity==='stroll'){
    if(state.autonomy[role]!=='full')return null;
    const obstacles=placeObstacles('home',state.furnishing),from=state.characters[role],offset=(Math.floor(state.clock.minute/95)+(role==='alina'?2:0))%HOME_STROLL_STOPS.length;
    for(let i=0;i<HOME_STROLL_STOPS.length;i++){const goal=HOME_STROLL_STOPS[(offset+i)%HOME_STROLL_STOPS.length];if(Math.hypot(goal.x-from.x,goal.z-from.z)<1.4)continue;const route=planWalk(from,goal,obstacles,HOME_FLOOR),end=route?.path.at(-1);if(route&&end&&Math.hypot(end.x-goal.x,end.z-goal.z)<.02)return route;}
    return null;
  }
  if(activity==='tv'||activity==='computer'){
    // Never use the coordinates of a sold starter sofa or desk.
    // Purchased replacements are real navigable seats.
    const fixture=activity==='tv'?'sofa':'desk';
    if(!state.furnishing.soldFixtures?.includes(fixture)&&
      !(activity==='tv'&&catSeatError(state,'starter:sofa',homeSeat('sofa',role).position))){
      const target=activity==='tv'?points.sofa:points.desk;
      const original=planWalk(state.characters[role],target,
        placeObstacles('home',state.furnishing),HOME_FLOOR);
      if(original)return original;
    }
    const action=activity==='tv'?'free_tv':'deskGames';
    for(const item of state.furnishing.placed){
      if(!canFurniturePerform(item,action))continue;
      const use=furnitureUseLocation(state,role,item.id,action);
      if(use&&!(activity==='tv'&&catSeatError(state,'placed:'+item.id,use.pose)))return use.route;
    }
    return null;
  }
  const target=activity==='chat'?meeting('home',role):petCarePoint(state,activity);
  return target && planWalk(state.characters[role],target,
    placeObstacles('home',state.furnishing),HOME_FLOOR);
}

/** Give residents enough time to walk across a large house AND actually
 * enjoy the activity after arriving; a fixed 16-second timeout is insufficient
 * for a distant purchased desk or sofa. */
export function leisureDurationMs(route:WalkRoute):number{
  let distance=0,previous=route.from;
  for(const point of route.path){
    distance+=Math.hypot(point.x-previous.x,point.z-previous.z);
    previous=point;
  }
  return Math.max(16_000,Math.ceil(distance/HOME_WALK_SPEED*1000)+10_000);
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
