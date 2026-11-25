import {BEAN_COFFEE,INSTANT_COFFEE,coffeeMachineTier,coffeeCupsToday,COFFEE_CUPS_PER_DAY,validCoffeeOrder,type CoffeeBlend,type CoffeeDrink} from './coffee';
import {gameMinutes} from './life';
import {HOME_PLACEMENTS,KITCHEN_WORK,homeSeat} from './home';
import {HOME_WORLD_FLOOR} from './district';
import {placeObstacles} from './locations';
import {planWalk} from '../game/navigation';
import type {CharacterId,GameState,TimedCommand} from './protocol';

export type WorkCoffeeCommand={type:'serve_work_coffee';shiftStart:number;blend:CoffeeBlend;drink?:CoffeeDrink};
export const otherResident=(role:CharacterId):CharacterId=>role==='vlad'?'alina':'vlad';
export function activeHomeWork(s:GameState,role:CharacterId){
 const shift=s.activeShifts[role],now=gameMinutes(s.clock);
 return shift?.homeDevice&&s.world.places[role]==='home'&&s.characters[role].pose==='work'&&shift.startedAt<=now&&now<shift.endsAt?shift:undefined;
}
/** Ordinary company uses a real free seat, never the active computer.
 * For a relocated laptop only choose a seat near its actual saved work spot. */
export function workCompanionChoices(s:GameState,role:CharacterId):TimedCommand[]{
 const other=otherResident(role),shift=activeHomeWork(s,other),p=s.characters[role];
 if(!shift||s.autonomy[role]!=='full'||s.world.places[role]!=='home'||Math.min(p.hunger,p.energy,p.hygiene,p.bladder)<=50)return [];
 const worker=s.characters[other],near=(seat:'officeChair'|'table'|'sofa')=>{
  const a=homeSeat(seat,role).approach;
  return !s.furnishing.soldFixtures?.includes(seat)&&Math.hypot(a.x-worker.x,a.z-worker.z)<=3;
 };
 if(shift.homeDevice==='desktop'&&near('officeChair'))return [
  ...(!s.furnishing.soldFixtures?.includes('bookcase')?[{type:'read_book' as const,book:'prince' as const,seat:'officeChair' as const}]:[]),
  {type:'act',actionId:'officeChairSit'}];
 if(near('table'))return [{type:'act',actionId:'tablePlan'},{type:'act',actionId:'tableRest'}];
 if(near('sofa'))return [{type:'act',actionId:'sofaScroll'},{type:'act',actionId:'sofaRest'}];
 return [];
}
// The initial coffee choreography targets the starter desktop only. Custom
// desks and laptop placements need distinct calibrated surface anchors.
export const WORK_COFFEE_DROP={x:HOME_PLACEMENTS.desk.x-.98,y:1.053,z:HOME_PLACEMENTS.desk.z+.38};
export const WORK_COFFEE_APPROACH={x:HOME_PLACEMENTS.desk.x-1.54,z:HOME_PLACEMENTS.desk.z+.38};
export function workCoffeeDenial(s:GameState,giver:CharacterId,c:WorkCoffeeCommand):string|undefined{
 const recipient=otherResident(giver),shift=activeHomeWork(s,recipient);
 if(s.world.places[giver]!=='home'||s.characters[giver].pose==='sleep'||s.activeShifts[giver]||s.careers.residents[giver].shift)return 'Сейчас нельзя принести кофе';
 if(!shift||shift.homeDevice!=='desktop'||shift.startedAt!==c.shiftStart||shift.coffeeServed||s.furnishing.soldFixtures?.includes('desk'))return 'Рабочее место изменилось или кофе уже подан';
 if(s.characters[recipient].energy>=85||coffeeCupsToday(s,recipient)>=COFFEE_CUPS_PER_DAY)return 'Партнёру сейчас не нужен кофе';
 if(!validCoffeeOrder(c.blend,c.drink)||s.pantry[c.blend]<1||c.drink!==undefined&&!coffeeMachineTier(s,recipient))return 'Нет подходящего кофе';
}
export function workCoffeeRoute(s:GameState,giver:CharacterId){
 const from=s.characters[giver],other=s.characters[otherResident(giver)];
 const obstacles=[...placeObstacles('home',s.furnishing),{minX:other.x-.36,maxX:other.x+.36,minZ:other.z-.36,maxZ:other.z+.36}];
 const first=planWalk(from,KITCHEN_WORK.coffee.position,obstacles,HOME_WORLD_FLOOR);
 if(!first)return null;
 const pickup=first.path.at(-1)??first.from;
 if(Math.hypot(pickup.x-KITCHEN_WORK.coffee.position.x,pickup.z-KITCHEN_WORK.coffee.position.z)>.05)return null;
 const next=planWalk(pickup,WORK_COFFEE_APPROACH,obstacles,HOME_WORLD_FLOOR);
 const end=next&&(next.path.at(-1)??next.from);
 if(!end||Math.hypot(end.x-WORK_COFFEE_APPROACH.x,end.z-WORK_COFFEE_APPROACH.z)>.05)return null;
 return next?{route:{from:first.from,path:[...first.path,...next.path]},pickup:first.path.length,pickupMs:6500}:null;
}
export function workCoffeeChoices(s:GameState,giver:CharacterId):WorkCoffeeCommand[]{
 const other=otherResident(giver),shift=activeHomeWork(s,other),p=s.characters[giver];
 if(!shift||s.autonomy[giver]!=='full'||Math.min(p.hunger,p.energy,p.hygiene,p.bladder)<=50)return [];
 const tier=coffeeMachineTier(s,other),beans=BEAN_COFFEE.find(b=>s.pantry[b]>0),instant=INSTANT_COFFEE.find(b=>s.pantry[b]>0);
 const c:WorkCoffeeCommand|undefined=tier&&beans?{type:'serve_work_coffee',shiftStart:shift.startedAt,blend:beans,drink:'Американо'}:
  instant?{type:'serve_work_coffee',shiftStart:shift.startedAt,blend:instant}:undefined;
 return c&&!workCoffeeDenial(s,giver,c)?[c]:[];
}
