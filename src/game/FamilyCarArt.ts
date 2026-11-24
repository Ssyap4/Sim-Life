import * as THREE from 'three';
import { CAR_PARKING } from '../shared/locations';
import { batchRigidParts, cube, softCube, drum, finish } from './ArtKit';

/** One lightweight family hatchback: body, glass, bumpers, lamps, tyres and mirrors. */
export function buildFamilyCar():THREE.Group{
  const group=new THREE.Group();group.name='Семейный автомобиль';
  group.position.set(CAR_PARKING.x,0,CAR_PARKING.z);
  function part(w:number,h:number,d:number,x:number,y:number,z:number,color:number,geometry:THREE.BufferGeometry=softCube){
    const mesh=new THREE.Mesh(geometry,finish(color,'metal'));
    mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  const paint=0x526e7a,glass=0x263e4c,trim=0x252b30;
  part(1.82,.57,4.06,0,.65,0,paint);
  part(1.74,.28,1.22,0,.99,1.25,paint);
  part(1.66,.54,2.02,0,1.18,-.32,paint);
  part(1.46,.09,1.78,0,1.48,-.34,paint);
  part(1.45,.48,.09,0,1.22,.66,glass).rotation.x=-.40;
  part(1.45,.40,.09,0,1.19,-1.32,glass).rotation.x=.32;
  for(const side of [-1,1]){
    for(const z of [.17,-.78]){
      part(.045,.38,.83,side*.835,1.21,z,glass,cube);
      part(.06,.04,.24,side*.92,.90,z-.21,trim,cube);
    }
    part(.24,.14,.29,side*.98,1.15,.68,paint);
    part(.10,.10,3.55,side*.87,.42,0,trim);
    for(const z of [-1.30,1.30]){
      const tyre=part(.36,.29,.36,side*.88,.38,z,0x202326,drum);tyre.rotation.z=Math.PI/2;
      const hub=part(.195,.32,.195,side*.90,.38,z,0xbac1c3,drum);hub.rotation.z=Math.PI/2;
    }
    part(.48,.18,.13,side*.58,.87,1.98,0xe6e9dd);
    part(.46,.19,.13,side*.59,.82,-1.99,0xb73536);
  }
  part(1.76,.19,.16,0,.45,2.03,trim);
  part(1.76,.19,.16,0,.45,-2.03,trim);
  part(.87,.20,.10,0,.69,2.04,trim,cube);
  part(.51,.12,.025,0,.43,2.13,0xe8e5d8,cube);
  part(.51,.12,.025,0,.56,-2.13,0xe8e5d8,cube);
  batchRigidParts(group,true);
  return group;
}
