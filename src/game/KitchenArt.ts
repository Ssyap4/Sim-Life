import * as THREE from 'three';
import { softCube, orb, drum, batchRigidParts } from './ArtKit';
import { KITCHEN_WORK } from '../shared/home';
import { selectIndoorDish } from './MealArt';
import { kitchenMove } from './CookingChoreography';
import type { RecipeId } from '../shared/food';

/** Small reusable effects anchored to the EXISTING cooker. No extra textures. */
export function buildCookingStation(scene: THREE.Scene) {
  const root=new THREE.Group();
  const pan=KITCHEN_WORK.stove.target;
  const dark=new THREE.MeshStandardMaterial({color:0x364347,roughness:.75,metalness:.21});
  const wood=new THREE.MeshStandardMaterial({color:0xb88754,roughness:.85});
  const vegetable=new THREE.MeshStandardMaterial({color:0xd79748,roughness:1});
  const leaf=new THREE.MeshStandardMaterial({color:0x688558,roughness:1});
  const skillet=new THREE.Mesh(drum,dark);
  skillet.scale.set(.220,.026,.208);
  skillet.position.set(pan.x,pan.y+.026,pan.z);
  root.add(skillet);
  const cookingFood=new THREE.Group();
  cookingFood.position.set(pan.x,pan.y+.062,pan.z);
  cookingFood.scale.setScalar(.89);
  root.add(cookingFood);
  const board=new THREE.Group();
  const base=new THREE.Mesh(softCube,wood);
  base.scale.set(.34,.024,.235);
  board.add(base);
  const diced=new THREE.Group();
  for(let i=0;i<6;i++) {
    const piece=new THREE.Mesh(softCube,i%3?vegetable:leaf);
    piece.scale.set(.033,.020,.035);
    piece.position.set(-.10+(i%3)*.078,.024,Math.floor(i/3)*.075-.035);
    diced.add(piece);
  }
  batchRigidParts(diced,true);
  board.add(diced);
  const dough=new THREE.Mesh(orb,new THREE.MeshStandardMaterial({color:0xe6c992,roughness:1}));
  dough.scale.set(.121,.018,.087);
  dough.position.y=.025;
  board.add(dough);
  // Put the relevant ingredient *under the hand's actual IK target*. Egg
  // recipes use the pan directly, pastry uses dough, salads use chopped food.
  board.position.set(pan.x-.23,1.088,pan.z+.10);
  root.add(board);
  // A shallow steel rim and turning wooden utensil read clearly in closeups.
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.213,.008,5,20),
    new THREE.MeshStandardMaterial({color:0x9aa6a1,metalness:.63,roughness:.32}));
  rim.rotation.x=Math.PI/2;
  rim.position.set(pan.x,pan.y+.053,pan.z);
  root.add(rim);
  const spoon=new THREE.Group();
  const handle=new THREE.Mesh(softCube,wood);
  handle.scale.set(.028,.025,.29);
  handle.position.set(0,.02,.14);
  const bowl=new THREE.Mesh(orb,wood);
  bowl.scale.set(.061,.018,.071);
  spoon.add(handle,bowl);
  spoon.position.set(pan.x+.07,pan.y+.105,pan.z-.065);
  spoon.rotation.z=.16;
  root.add(spoon);
  const steam=new THREE.Group();
  const puffs:THREE.Mesh[]=[];
  for(let i=0;i<4;i++){
    const fog=new THREE.Mesh(orb,new THREE.MeshBasicMaterial({
      color:0xdadcd0,transparent:true,opacity:.17,depthWrite:false
    }));
    fog.scale.set(.045+i*.012,.06+i*.015,.045+i*.010);
    steam.add(fog);
    puffs.push(fog);
  }
  steam.position.set(pan.x,pan.y+.08,pan.z);
  root.add(steam);
  root.visible=false;
  scene.add(root);
  return {
    root, board, steam, puffs,
    recipe(id:RecipeId){
      selectIndoorDish(cookingFood,id);
      const preparation=kitchenMove(id,0);
      board.visible=preparation!=='whisk';
      diced.visible=preparation==='chop';
      dough.visible=preparation==='knead';
    },
    update(seconds:number){
      const cycle=Math.max(0,seconds);
      spoon.rotation.y=Math.sin(cycle*2.15)*.18;
      spoon.rotation.z=.16+Math.sin(cycle*3.15)*.06;
      for(let i=0;i<puffs.length;i++){
        const progress=(cycle*.37+i/4)%1;
        const puff=puffs[i];
        puff.position.set(Math.sin(cycle*.9+i)*.037,progress*.33,Math.cos(i+cycle*.7)*.025);
        const material=puff.material as THREE.MeshBasicMaterial;
        material.opacity=.16*(1-progress);
        puff.scale.setScalar(.045+.080*progress);
      }
    }
  };
}
