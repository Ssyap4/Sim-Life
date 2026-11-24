import type {GameState,CharacterId} from './protocol';
import {bedPose,isSleepBed,type SleepBedId} from './bedSleep';
import {FURNITURE_BY_ID,type PlacedFurniture} from './furniture';
import {HOME_PLACEMENTS,HOME_FLOOR} from './home';
import {placeObstacles} from './locations';
import {pointIsClear,type FloorPoint} from '../game/navigation';
import {petNavigationGeometry,planPetRoute} from '../game/PetNavigation';
export const DOG_STAIRS='pet-bed-stairs';
export type DogBedSite={bed:SleepBedId;stairs:number;approach:FloorPoint;steps:{x:number;y:number;z:number}[];rest:{x:number;y:number;z:number};yaw:number;climbYaw:number;height:number};
const delta=(x:number,z:number,yaw:number)=>({x:x*Math.cos(yaw)+z*Math.sin(yaw),z:-x*Math.sin(yaw)+z*Math.cos(yaw)});
export function dogBedSites(s:GameState,stair:PlacedFurniture):DogBedSite[]{
 if(stair.sku!==DOG_STAIRS)return [];
 const sites:DogBedSite[]=[];
 const beds:SleepBedId[]=[...(s.furnishing.soldFixtures?.includes('bed')?[]:['starter' as const]),...s.furnishing.placed.filter(isSleepBed).map(i=>i.id)];
 const yaw=stair.rotation*Math.PI/2,forward=delta(0,-1,yaw);
 const top={x:stair.x+forward.x*.51,z:stair.z+forward.z*.51};
 const low=delta(0,1.02,yaw),approach={x:stair.x+low.x,z:stair.z+low.z};
 const geometry=petNavigationGeometry(placeObstacles('home',s.furnishing),HOME_FLOOR);
 if(!pointIsClear(approach,geometry.obstacles,geometry.floor))return sites;
 for(const bed of beds){
  const pose=bedPose(s,'vlad',bed);if(!pose)continue;
  const item=bed==='starter'?null:s.furnishing.placed.find(i=>i.id===bed)!;
  const info=item?FURNITURE_BY_ID.get(item.sku)!:null;
  const day=info?.shape==='daybed';
  const center=item??HOME_PLACEMENTS.bed;
  const width=day?info!.depth:info?.width??2.68,length=day?info!.width:info?.depth??2.70;
  const local=delta(top.x-center.x,top.z-center.z,-pose.yaw);
  const f=delta(forward.x,forward.z,-pose.yaw);
  // Top must face an actual mattress edge, not the headboard or a wall.
  const foot=local.z>=length/2-.015&&local.z<=length/2+.24&&Math.abs(local.x)<width/2-.18&&f.z<-.99;
  const side=Math.abs(local.x)>=width/2-.015&&Math.abs(local.x)<=width/2+.24&&local.z>=length*.15&&local.z<=length/2-.12&&f.x*Math.sign(local.x)<-.99;
  if(!foot&&!side)continue;
  const height=bed==='starter'?.91:pose.y-.11;
  const restLocal={x:0,z:length*.27};
  const r=delta(restLocal.x,restLocal.z,pose.yaw);
  const rest={x:center.x+r.x,z:center.z+r.z,y:height};
  const steps=Array.from({length:4},(_,i)=>{
    const p=delta(0,.3825-i*.255,yaw);
    return {x:stair.x+p.x,z:stair.z+p.z,y:height*(i+1)/4};
  });
  const entry=foot?{x:local.x,z:length*.37}:{x:Math.sign(local.x)*(width/2-.19),z:local.z};
  const e=delta(entry.x,entry.z,pose.yaw);
  steps.push({x:center.x+e.x,z:center.z+e.z,y:height},rest);
  sites.push({bed,stairs:stair.id,approach,steps,rest,yaw:pose.yaw+Math.PI,climbYaw:yaw+Math.PI,height});
 }
 return sites;
}
export function currentDogBed(s:GameState,stairs:number,bed:SleepBedId){
 const item=s.furnishing.placed.find(i=>i.id===stairs);
 return item?dogBedSites(s,item).find(site=>site.bed===bed):undefined;
}
export function dogBedSleeping(s:GameState,bed:SleepBedId){
 return (['vlad','alina'] as const).some(r=>s.world.places[r]==='home'&&s.characters[r].pose==='sleep'&&(s.characters[r].sleepingOn??'starter')===bed);
}
export function chooseDogBed(s:GameState,role:CharacterId){
 const p=s.pets.verdell,actor=s.characters[role],geometry=petNavigationGeometry(placeObstacles('home',s.furnishing),HOME_FLOOR);
 const cat=s.pets.simba.routine?.perch?.key;
 const sites=s.furnishing.placed.flatMap(i=>dogBedSites(s,i)).filter(site=>cat!==(site.bed==='starter'?'starter:bed':'placed:'+site.bed));
 sites.sort((a,b)=>Number(dogBedSleeping(s,b.bed))-Number(dogBedSleeping(s,a.bed))||Math.hypot(a.rest.x-actor.x,a.rest.z-actor.z)-Math.hypot(b.rest.x-actor.x,b.rest.z-actor.z));
 for(const site of sites){
  const route=planPetRoute(p.position,site.approach,geometry),end=route?.path.at(-1)??route?.from;
  if(route&&end&&route.path.length<=60&&Math.hypot(end.x-site.approach.x,end.z-site.approach.z)<.03)return {site,route};
 }
 return null;
}