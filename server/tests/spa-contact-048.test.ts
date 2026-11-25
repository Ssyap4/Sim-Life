import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBlenderCharacter} from '../../src/game/BlenderCharacter';
import {Actor} from '../../src/game/Actor';
import {outfitChoices} from '../../src/game/Wardrobe';
test('both current resident skins fit above the SPA massage mattress, within the table footprint',async()=>{
 for(const role of ['vlad','alina'] as const){
  const bytes=await readFile(new URL('../../src/assets/characters/remake/'+role+'.glb',import.meta.url));
  const loader=new GLTFLoader().register(()=>({name:'HeadlessTexture',loadTexture:async()=>new THREE.Texture()}));
  const gltf=await loader.parseAsync(Uint8Array.from(bytes).buffer,'');
  const actor=new Actor(role,[0,0],createBlenderCharacter(gltf,role,outfitChoices(role==='vlad'?'home':'pink')));
  actor.setFurniturePose('idle',new THREE.Vector3(0,1.06,.98),Math.PI);actor.playDomesticActivity('spaMassage');
  for(let f=0;f<90;f++)actor.update(1/30);
  actor.root.updateMatrixWorld(true);
  const all=new THREE.Box3(),temp=new THREE.Vector3();
  for(const mesh of actor.root.getObjectsByProperty('isSkinnedMesh',true) as THREE.SkinnedMesh[]){
   if(!mesh.visible)continue;
   for(let i=0;i<mesh.geometry.attributes.position.count;i+=8){mesh.getVertexPosition(i,temp);mesh.localToWorld(temp);all.expandByPoint(temp);}
  }
  assert.ok(all.min.y>=.825,role+' mattress penetration '+all.min.y);
  assert.ok(all.min.y<=.91,role+' floating '+all.min.y);
  assert.ok(all.min.z>=-1.06&&all.max.z<=1.06,role+' overhang');
  assert.ok(all.min.x>=-.45&&all.max.x<=.45,role+' side overhang');
  actor.finishActivity();actor.setPose('idle');
 }
});
