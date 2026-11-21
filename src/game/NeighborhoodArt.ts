import * as THREE from 'three';
import { HOUSE_WING } from '../shared/home';
import { batchRigidParts, colors as C, cube, drum, finish, orb, softCube } from './ArtKit';
import { NEIGHBOR_PATH } from '../shared/neighbors';

// Paths sit outside the house and the fenced private yard. This decorative
// scenery is intentionally not added to the player's interactive pick list.
export function buildNeighborhood(scene: THREE.Scene): void {
  const root = new THREE.Group();
  root.name = 'Соседский квартал вокруг дома';
  const add = (geometry: THREE.BufferGeometry, size: readonly [number,number,number],
    position: readonly [number,number,number], color: number,
    material: Parameters<typeof finish>[1] = 'wood') => {
    const mesh = new THREE.Mesh(geometry, finish(color,material));
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const path = (x:number,z:number,w:number,d:number) => {
    add(cube, [w+.18,.10,d+.18],[x,-.073,z],0xa08d76,'ceramic');
    add(cube, [w,.036,d],[x,-.005,z],0xc9b9a1,'ceramic');
  };
  const left = NEIGHBOR_PATH[0].x, right = NEIGHBOR_PATH[3].x;
  const back = NEIGHBOR_PATH[1].z;
  path(left,-1.55,1.62,18.65);
  path(right,-1.55,1.62,18.65);
  path((left+right)/2,back,right-left+1.60,1.62);
  // A subtle repeatable joint rhythm makes long paths read as paving.
  for (const x of [left,right]) for(let z=-10.3;z<7;z+=1.07)
    add(cube,[1.55,.006,.024],[x,.017,z],0xa9917b);
  for (let x=left;x<right;x+=1.07)
    add(cube,[.023,.006,1.55],[x,.017,back],0xa9917b);

  // Side planting buffers visually separate neighbors from the private plot.
  const plant = (x:number,z:number,index:number) => {
    add(drum,[.077,.85,.077],[x,.42,z],0x80654c);
    for (let j=0;j<3;j++) add(orb,[.52-.07*j,.46,.46-.05*j],
      [x+(j-1)*.13,1.06+j*.19,z+(j%2-.5)*.20],
      [0x68845c,0x76916a,0x8da274][(index+j)%3]);
  };
  for (const [i,z] of [-8.3,-4.3,1.8,5.6].entries()) {
    plant(left-2.15,z,i);
    plant(right+2.15,z,i+1);
  }
  for (const [i,x] of [-8.5,-3.2,4.2,9.5,15.3].entries()) plant(x,back-3.0,i+3);
  // Shrubs never extend into the clear NPC corridor.
  for(let i=0;i<24;i++) {
    const side=i%2;
    const x=side? right+1.85 : left-1.83;
    const z=-8.7+Math.floor(i/2)*1.30;
    add(orb,[.37,.26,.36],[x,.23,z],i%3===0?0x759463:0x6b8661);
  }
  for(let i=0;i<16;i++) {
    const x=left+1.25+i*1.72;
    add(orb,[.42,.24,.31],[x,.23,back-1.50],i%2?0x748c64:0x8aa077);
  }

  // Four streetlights rely on emissive-looking material, never costly shadows
  // or point lights. Their shape is visible even at mobile camera distances.
  for (const [x,z] of [[left-1.10,-3.30],[right+1.10,-3.30],
    [-5.7,back-1.25],[9.5,back-1.25]]) {
    add(drum,[.063,2.39,.063],[x,1.21,z],C.ink,'metal');
    add(cube,[.22,.16,.20],[x,2.43,z],C.brass,'metal');
    add(orb,[.19,.13,.19],[x,2.57,z],0xf4d9aa,'ceramic');
  }

  // Simplified neighboring roofs beyond the walkable set, not extra scenes.
  for (const [i,x] of [-8.7,.5,10.8].entries()) {
    const z=-16.70+(i%2)*-.35;
    add(softCube,[5.1,2.3,2.8],[x,1.14,z], [0xbba995,0xc0b3a4,0xb2bca7][i]);
    add(cube,[5.6,.23,3.22],[x,2.42,z], [0x7d665b,0x786d6b,0x686f6b][i]);
    for (const dx of [-1.40,1.40]) {
      add(cube,[.74,.85,.05],[x+dx,1.55,z+1.43],0x9fbdbe,'ceramic');
      add(cube,[.06,.91,.08],[x+dx,1.55,z+1.48],C.paper);
    }
    add(cube,[.9,1.27,.09],[x,.64,z+1.43],C.walnut);
  }
  // The wing footprint is deliberately kept unobstructed. The rightmost
  // walkway sits more than 1.5m beyond the new exterior wall.
  if (HOUSE_WING.maxX >= right - 1) throw new Error('Neighbor path overlaps the house wing');
  batchRigidParts(root, true);
  scene.add(root);
}
