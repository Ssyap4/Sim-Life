import * as THREE from 'three';
import { HOUSE, HOUSE_WING } from '../shared/home';
import { NEIGHBOR_PATH } from '../shared/neighbors';
import { batchRigidParts, colors as C, cube, drum, finish, orb, softCube } from './ArtKit';

// One data-driven public ring. All paths, lamps, planting and neighboring
// houses follow its coordinates when future house extensions need more space.
export function buildNeighborhood(scene: THREE.Scene): void {
  const root = new THREE.Group();
  root.name = 'Соседский квартал · дальний прогулочный контур';
  const add = (geometry: THREE.BufferGeometry, size: readonly [number,number,number],
    position: readonly [number,number,number], color: number,
    surface: Parameters<typeof finish>[1] = 'wood') => {
    const mesh = new THREE.Mesh(geometry,finish(color,surface));
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const path = (x:number,z:number,w:number,d:number) => {
    add(cube,[w+.19,.10,d+.19],[x,-.073,z],0xa08d76,'ceramic');
    add(cube,[w,.036,d],[x,-.005,z],0xc9b9a1,'ceramic');
  };
  const left = NEIGHBOR_PATH[0].x, right = NEIGHBOR_PATH[3].x;
  const back = NEIGHBOR_PATH[1].z, front = NEIGHBOR_PATH[0].z;
  const midZ = (back+front)/2, sideLength = front-back;
  const width = 1.80;
  path(left,midZ,width,sideLength+width);
  path(right,midZ,width,sideLength+width);
  path((left+right)/2,back,right-left+width,width);

  // Joint rhythm on the public pavement, calculated from the shifted ring.
  for (const x of [left,right]) for (let z=back+.3; z<front; z+=1.10)
    add(cube,[width-.07,.006,.024],[x,.017,z],0xa9917b);
  for (let x=left+.28; x<right; x+=1.10)
    add(cube,[.023,.006,width-.07],[x,.017,back],0xa9917b);

  const plant = (x:number,z:number,index:number) => {
    add(drum,[.080,.89,.080],[x,.43,z],0x80654c);
    for (let j=0;j<3;j++) add(orb,[.52-.07*j,.46,.46-.05*j],
      [x+(j-1)*.13,1.06+j*.19,z+(j%2-.5)*.20],
      [0x68845c,0x76916a,0x8da274][(index+j)%3]);
  };
  // Planting remains outside the new footpaths, leaving the entire inner
  // 7–8m band unoccupied for future domestic construction.
  for (const [i,z] of [back+2.0,back+7.7,back+14.3,front-2.5].entries()) {
    plant(left-2.24,z,i);
    plant(right+2.24,z,i+1);
  }
  const backyardTrees = 6;
  for (let i=0;i<backyardTrees;i++)
    plant(left+4.1+i*(right-left-8.2)/(backyardTrees-1),back-3.9,i+2);
  for (let i=0;i<24;i++) {
    const x=i%2 ? right+1.91 : left-1.91;
    const z=back+1.30+Math.floor(i/2)*1.83;
    add(orb,[.37,.26,.36],[x,.23,z],i%3===0?0x759463:0x6b8661);
  }
  for(let i=0;i<22;i++) {
    const x=left+1.45+i*(right-left-2.9)/21;
    add(orb,[.42,.24,.31],[x,.23,back-1.7],i%2?0x748c64:0x8aa077);
  }

  // Decorative, unshadowed lamp heads are far cheaper than extra point lights.
  for (const [x,z] of [[left-1.1,back+6.3],[right+1.1,back+6.3],
    [left+9.8,back-1.5],[right-9.8,back-1.5]]) {
    add(drum,[.063,2.39,.063],[x,1.21,z],C.ink,'metal');
    add(cube,[.22,.16,.20],[x,2.43,z],C.brass,'metal');
    add(orb,[.19,.13,.19],[x,2.57,z],0xf4d9aa,'ceramic');
  }

  // Background houses also follow the back pavement, leaving more land in
  // between the player's house and the public lane.
  for (const [i,x] of [left+5.8,left+15.3,right-15.3,right-5.8].entries()) {
    const z = back-8.25-(i%2)*.44;
    add(softCube,[5.1,2.3,2.8],[x,1.14,z],
      [0xbba995,0xc0b3a4,0xb2bca7,0xc4aa98][i]);
    add(cube,[5.6,.23,3.22],[x,2.42,z],
      [0x7d665b,0x786d6b,0x686f6b,0x7f6d63][i]);
    for (const dx of [-1.4,1.4]) {
      add(cube,[.74,.85,.05],[x+dx,1.55,z+1.43],0x9fbdbe,'ceramic');
      add(cube,[.06,.91,.08],[x+dx,1.55,z+1.48],C.paper);
    }
    add(cube,[.9,1.27,.09],[x,.64,z+1.43],C.walnut);
  }

  const reserveLeft = HOUSE.minX - left;
  const reserveRight = right - HOUSE_WING.maxX;
  const reserveRear = HOUSE.minZ - back;
  if (Math.min(reserveLeft,reserveRight,reserveRear) < 7.5) {
    throw new Error('The public sidewalk must leave a future house extension reserve');
  }
  batchRigidParts(root,true);
  scene.add(root);
}
