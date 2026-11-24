import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {finish,batchRigidParts,cube} from '../../src/game/ArtKit';
import {polishFurniture} from '../../src/game/FurnitureSurfaceArt';
test('furniture maps preserve batches, transforms and original shared materials',()=>{
 const group=new THREE.Group(),original=finish(0x967856,'wood');
 for(let i=0;i<2;i++){const m=new THREE.Mesh(cube,original);m.position.x=i;group.add(m);}
 batchRigidParts(group,true);
 const mesh=group.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
 const geom=mesh.geometry,old=mesh.material,before=new THREE.Box3().setFromObject(group),tex=new THREE.Texture();
 polishFurniture(group,true,()=>tex);
 assert.equal(group.children.length,1);assert.equal(mesh.geometry,geom);assert.equal(mesh.material.map,tex);
 assert.equal(mesh.material.vertexColors,true);assert.equal(old.map,null);assert.equal(original.map,null);
 assert.ok(before.equals(new THREE.Box3().setFromObject(group)));
 const first=mesh.material;polishFurniture(group,true,()=>tex);assert.equal(mesh.material,first);
});
test('non-furniture materials and existing illustrations remain untouched',()=>{
 const root=new THREE.Group(),skin=finish(0xffccaa,'skin'),wood=finish(0xb8946e,'wood').clone(),fabric=finish(0x808080,'fabric');
 wood.map=new THREE.Texture();
 const meshes=[skin,wood,fabric].map(m=>new THREE.Mesh(cube,m));root.add(...meshes);
 polishFurniture(root,false,()=>new THREE.Texture());
 assert.equal(meshes[0].material,skin);assert.equal(meshes[1].material,wood);assert.equal(meshes[2].material,fabric);
});
