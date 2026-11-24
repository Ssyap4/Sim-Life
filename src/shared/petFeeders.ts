import {PETS,type PetId,type PetState,PET_BOWL_CAPACITY} from './pets';
import type {FurnishingState,PlacedFurniture} from './furniture';
import {pointIsClear,findRoute,type FloorRect,type FloorPoint} from '../game/navigation';
import type {GameState} from './protocol';
import {petFoodProduct} from './petShop';
export const FEEDING_MODELS=(['verdell','simba'] as const).flatMap(pet=>
 (['ceramic','steel','auto','plus'] as const).map(kind=>({
  id:'pet-feed-'+pet+'-'+kind,pet,kind,capacity:kind==='auto'?6:kind==='plus'?12:0,
  name:({ceramic:'Керамическая миска',steel:'Стальная миска',auto:'Автокормушка «Комфорт»',plus:'Автокормушка «Макс»'})[kind]+' · '+(pet==='verdell'?'для собак':'для кошек'),
  price:{ceramic:490,steel:890,auto:4990,plus:8990}[kind],
  width:kind==='plus'?.56:kind==='auto'?.49:.38,depth:kind==='plus'?.78:kind==='auto'?.69:.38,height:kind==='plus'?.68:kind==='auto'?.53:.13,
 })));
export const feederModel=(sku:unknown)=>FEEDING_MODELS.find(m=>m.id===sku);
export function feedingAnchor(item:PlacedFurniture){
 const m=feederModel(item.sku)!;const yaw=item.rotation*Math.PI/2;
 const offset=m.capacity?m.depth*.5-.19:0;
 const point={x:item.x+Math.sin(yaw)*offset,z:item.z+Math.cos(yaw)*offset};
 const distance=m.depth*.5+.48;
 return {point,goal:{x:item.x+Math.sin(yaw)*distance,z:item.z+Math.cos(yaw)*distance},yaw:yaw+Math.PI,foodY:.105};
}
export function feedingStation(f:FurnishingState,id:PetId){
 const item=f.placed.filter(i=>feederModel(i.sku)?.pet===id).sort((a,b)=>b.id-a.id)[0];
 if(item)return {...feedingAnchor(item),item,model:feederModel(item.sku)!};
 const point=PETS[id].bowl;return {point,goal:{x:point.x,z:point.z+.51},yaw:Math.PI,foodY:.118,item:undefined,model:undefined};
}
export function feedingOwnerPoint(station:ReturnType<typeof feedingStation>,from:FloorPoint,obstacles:readonly FloorRect[],floor:FloorRect){
 if(!station.item)return undefined;
 const a=station.yaw,side={x:Math.cos(a),z:-Math.sin(a)};
 const points=[-1,1].map(sign=>({x:station.point.x+side.x*.84*sign-Math.sin(a)*.22,z:station.point.z+side.z*.84*sign-Math.cos(a)*.22}));
 points.sort((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)-Math.hypot(b.x-from.x,b.z-from.z));
 return points.find(p=>pointIsClear(p,obstacles,floor)&&!!findRoute(from,p,obstacles,floor));
}
export const feederReserve=(p:PetState)=>p.feederReserve??[];
export function dryRefills(s:GameState,id:PetId){
 const q=s.pets[id].foodQueue??[];return s.petFood[id]-q.length+q.filter(k=>k.includes('-dry-')).length;
}
export function loadFeeder(s:GameState,id:PetId){
 const p=s.pets[id],capacity=feedingStation(s.furnishing,id).model?.capacity??0,reserve=p.feederReserve??=[];
 const q=p.foodQueue??=[];
 while(reserve.length<capacity&&s.petFood[id]>0){
  const i=q.findIndex(k=>k.includes('-dry-'));
  if(i>=0){reserve.push(q.splice(i,1)[0]);s.petFood[id]--;}
  else if(s.petFood[id]>q.length){reserve.push(null);s.petFood[id]--;}
  else break;
 }
 return reserve.length;
}
export function dispenseFeeder(s:GameState,id:PetId,automatic=true){
 const p=s.pets[id],r=p.feederReserve??[];
 if(s.petBowls[id]||!r.length||automatic&&!(feedingStation(s.furnishing,id).model?.capacity))return false;
 const food=r.shift();if(food)p.bowlFood=food;else delete p.bowlFood;
 s.petBowls[id]=PET_BOWL_CAPACITY;return true;
}
export function validFeeder(p:PetState,id:PetId){return p.feederReserve===undefined||Array.isArray(p.feederReserve)&&p.feederReserve.length<=12&&p.feederReserve.every(v=>v===null||typeof v==='string'&&v.includes('-dry-')&&petFoodProduct(v)?.pet===id);}
