import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {Actor} from '../../src/game/Actor';
import {RESIDENT_CLEARANCE} from '../../src/game/residentCollision';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';
async function residents(){
 return Promise.all((['vlad','alina'] as const).map(async role=>{
  const bytes=await readFile(new URL('../../src/assets/characters/remake/'+role+'.glb',import.meta.url));
  const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
  return new Actor(role,[0,0],createBlenderCharacter(await loader.parseAsync(Uint8Array.from(bytes).buffer,''),role));
 }));
}
const head=(a:Actor)=>a.root.getObjectByName('Head')!;
function lips(a:Actor,role:'vlad'|'alina'){
 const eye=head(a).worldToLocal(a.root.getObjectByName('EyeR')!.getWorldPosition(new THREE.Vector3()));
 return head(a).localToWorld(new THREE.Vector3(0,eye.y-(role==='vlad'?.110:.103),.116));
}
test('kiss and embrace contact keeps approved portraits and navigation roots stable',async()=>{
 const [v,a]=await residents();
 for(const motion of ['kiss','sofaKiss','hug','closeHug'] as const){
  const sofa=motion==='sofaKiss';
  v.setPose('idle');a.setPose('idle');
  if(sofa){
   v.root.position.set(-.5,0,0);a.root.position.set(.5,0,0);
   v.setFurniturePose('sit',new THREE.Vector3(-.5,.057,0),0);a.setFurniturePose('sit',new THREE.Vector3(.5,.106,0),0);
   v.snapFurnitureOffset();a.snapFurnitureOffset();
  }else{
   v.root.position.set(0,0,0);a.root.position.set(0,0,RESIDENT_CLEARANCE+.05);
   v.faceTowards(a.root.position);a.faceTowards(v.root.position);
  }
  v.playPartnerGesture(motion,true,undefined,a);a.playPartnerGesture(motion,false,undefined,v);
  const roots=[v.root.position.clone(),a.root.position.clone()];
  for(let f=0;f<75;f++){v.update(1/30);a.update(1/30);}
  const l=lips(v,'vlad'),r=lips(a,'alina');
  console.log(motion,'lips',l.toArray(),r.toArray(),'gap',l.distanceTo(r),'body gap',v.bodyPosition(new THREE.Vector3()).distanceTo(a.bodyPosition(new THREE.Vector3())));
  assert.ok(v.root.position.equals(roots[0])&&a.root.position.equals(roots[1]));
  if(motion==='kiss'||motion==='sofaKiss'){
   assert.ok(l.distanceTo(r)<.045,'lip anchor gap');
   for(const actor of [v,a]){
    let closed=0;
    actor.root.traverse(n=>{
     const mesh=n as THREE.Mesh;
     const lid=mesh.morphTargetDictionary?.CloseLids;
     if(lid!==undefined)closed=Math.max(closed,mesh.morphTargetInfluences?.[lid]??0);
    });
    assert.ok(closed>.9,'eyes close during contact');
   }
  }else{
   const distance=v.bodyPosition(new THREE.Vector3()).distanceTo(a.bodyPosition(new THREE.Vector3()));
   assert.ok(distance>.48&&distance<.60,'safe embrace anchor spacing');
  }
  for(let f=0;f<180;f++){v.update(1/30);a.update(1/30);}
  assert.ok(v.root.position.equals(roots[0])&&a.root.position.equals(roots[1]));
  v.finishActivity();a.finishActivity();
 }
});
