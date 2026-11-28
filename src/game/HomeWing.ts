import * as THREE from 'three';
import {freezeLocalTransforms} from './StaticTransforms';
import { HOUSE_WING, HOUSE } from '../shared/home';
import { batchRigidParts, colors as C, cube, finish, panel } from './ArtKit';
import {gardenView} from './ArtTextures';
import {cottageFloor,timberWall} from './CottageArt';
import {HOME_WALL_HEIGHT} from './HomeSideWalls';
import {addPassageFinish,batchPassageFinishes} from './HomeFinish';

// A future-ready three-room wing. The established rooms, props, action anchors,
// and old wall coordinates are deliberately left alone.
export function buildHomeWing(scene: THREE.Scene): void {
  const wing = new THREE.Group();
  const add = (w: number, h: number, d: number, x: number, y: number, z: number,
    color: number, material: Parameters<typeof finish>[1] = 'wood') => {
    const part = new THREE.Mesh(cube, finish(color, material));
    part.scale.set(w, h, d);
    part.position.set(x, y, z);
    part.receiveShadow = true;
    wing.add(part);
  };
  const { minX, maxX, minZ, maxZ } = HOUSE_WING;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  // Continuation of the home's foundation and a flush, navigable wooden floor.
  add(width + .32, .39, depth + .31, centerX, -.42, centerZ, 0xa5725a, 'ceramic');
  add(width + .10, .15, depth + .08, centerX, -.16, centerZ, 0x815841);
  for (const [i, [z0, z1]] of [
    [minZ, HOUSE_WING.crossWalls[0]],
    [HOUSE_WING.crossWalls[0], HOUSE_WING.crossWalls[1]],
    [HOUSE_WING.crossWalls[1], maxZ],
  ].entries()) {
    const z = (z0 + z1) / 2;
    add(width - .25, .065, z1 - z0 - .14, centerX, -.013, z,
      [0xc39f78, 0xd7b68e, 0xbfa083][i]);
    // Restrained parquet strips give the empty rooms scale without clutter.

    // A low door-side marker reserved for a future room label or furniture edit.
    add(.68, .025, .085, maxX - .58, .033, z0 + .46, C.oat);
  }
  cottageFloor(wing,true);
  // Rear exterior behind the new rooms, with a tall window and a light sill.
  const windows=[11.28,13.72],half=.90,bottom=1.30,top=2.78,height=HOME_WALL_HEIGHT;
  let edge=minX;
  for(const x of windows){
    const left=x-half,right=x+half;
    timberWall(wing,[left-edge,height,.24],[(edge+left)/2,height/2,minZ]);
    timberWall(wing,[half*2,bottom,.24],[x,bottom/2,minZ]);
    timberWall(wing,[half*2,height-top,.24],[x,(top+height)/2,minZ]);
    panel(wing,[x,2.04,minZ-.12],[1.84,1.52],gardenView(),C.sky,.20);
    for(const side of [-1,0,1])add(.09,1.53,.15,x+side*half,2.04,minZ+.10,C.paper);
    add(1.88,.075,.15,x,2.13,minZ+.10,C.paper);
    add(1.98,.10,.30,x,bottom,minZ+.14,C.oat);
    add(1.95,.09,.20,x,top,minZ+.14,C.paper);
    add(2.05,.035,.035,x,2.81,minZ+.23,C.brass,'metal');
    for(const side of [-1,1])for(let i=0;i<3;i++)
      add(.085,1.46,.075,x+side*(.86-i*.075),2.04,minZ+.27+.023*(i%2),i%2?0xe7c5a1:0xd7ab80,'fabric');
    edge=right;
  }
  timberWall(wing,[maxX-edge,height,.24],[(edge+maxX)/2,height/2,minZ]);
  add(width,.10,.30,centerX,HOME_WALL_HEIGHT,minZ,C.paper);
  for(const z of HOUSE_WING.crossWalls)
    addPassageFinish(wing,{x:HOUSE_WING.crossDoor.x,z,width:HOUSE_WING.crossDoor.width},'z');
  addPassageFinish(wing,{x:HOUSE.maxX,...HOUSE_WING.connector},'x');
  batchPassageFinishes(wing);
  batchRigidParts(wing, true);
  freezeLocalTransforms(wing);
  scene.add(wing);
}
