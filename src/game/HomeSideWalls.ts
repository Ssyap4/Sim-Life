import * as THREE from 'three';
import {freezeLocalTransforms} from './StaticTransforms';
import {HOUSE,HOUSE_WING} from '../shared/home';
import {batchRigidParts,cube,finish,colors as C} from './ArtKit';
import {timberWall} from './CottageArt';

export const HOME_WALL_HEIGHT=3.16;
export const SIDE_CUT_HEIGHT=.43;
export type SideWall='west'|'east';
const edge=(side:SideWall)=>side==='west'?HOUSE.minX:HOUSE_WING.maxX;
/** When the viewer is outside a side looking inward, keep the low cutaway.
 * The far side and a front/top view retain the full timber envelope. */
export function sideWallCutaway(side:SideWall,eyeX:number,targetX:number):boolean{
 const sign=side==='west'?-1:1;
 return sign*(eyeX-edge(side))>.12&&sign*(eyeX-targetX)>.01;
}
function trim(group:THREE.Group,x:number,y:number,z:number,span:number,color:number,h:number){
 const m=new THREE.Mesh(cube,finish(color,'wood'));
 m.scale.set(.30,h,span);m.position.set(x,y,z);m.receiveShadow=true;group.add(m);
}
export function buildHomeSideWalls(scene:THREE.Scene){
 const walls=(['west','east'] as const).map(side=>{
  const x=edge(side),start=HOUSE.minZ+.12,end=HOUSE.maxZ,span=end-start,z=(start+end)/2;
  const root=new THREE.Group();root.name='Timber side '+side;
  const low=new THREE.Group(),upper=new THREE.Group(),cutCap=new THREE.Group();
  low.name='Side base '+side;upper.name='Side upper '+side;cutCap.name='Side cut cap '+side;
  timberWall(low,[.24,SIDE_CUT_HEIGHT,span],[x,SIDE_CUT_HEIGHT/2,z]);
  trim(low,x,.05,z,span,C.walnut,.10);
  timberWall(upper,[.24,HOME_WALL_HEIGHT-SIDE_CUT_HEIGHT,span],[x,(HOME_WALL_HEIGHT+SIDE_CUT_HEIGHT)/2,z]);
  trim(upper,x,HOME_WALL_HEIGHT,z,span,C.paper,.10);
  trim(cutCap,x,SIDE_CUT_HEIGHT,z,span,C.walnut,.054);
  batchRigidParts(low,true);batchRigidParts(upper,true);
  root.add(low,upper,cutCap);freezeLocalTransforms(root);scene.add(root);cutCap.visible=false;
  return {side,root,upper,cutCap};
 });
 return {
  walls,
  update(eyeX:number,targetX:number){
   for(const w of walls){const cut=sideWallCutaway(w.side,eyeX,targetX);w.upper.visible=!cut;w.cutCap.visible=cut;}
  },
 };
}