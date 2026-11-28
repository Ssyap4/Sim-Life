import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {freezeLocalTransforms} from '../../src/game/StaticTransforms';
import {decorateHome} from '../../src/game/HomeStyling';
import {buildHomeWing} from '../../src/game/HomeWing';
import {buildHomeSideWalls} from '../../src/game/HomeSideWalls';

test('immutable local matrices preserve exact child positions and moving parents',()=>{
 const scene=new THREE.Scene(),parent=new THREE.Group(),root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
 scene.add(parent);parent.add(root);root.add(mesh);root.position.set(1,2,3);root.rotation.y=.5;mesh.position.set(2,0,1);mesh.scale.set(2,1,3);
 scene.updateMatrixWorld(true);const before=mesh.matrixWorld.clone();assert.equal(freezeLocalTransforms(root),2);
 scene.updateMatrixWorld(true);assert.deepEqual(mesh.matrixWorld.elements,before.elements);
 parent.position.x=5;scene.updateMatrixWorld();assert.equal(mesh.matrixWorld.elements[12],before.elements[12]+5);
 assert.equal(root.matrixAutoUpdate,false);assert.equal(mesh.matrixWorldAutoUpdate,true);
});
test('home shell freezes only static parts and leaves doors and window pivots dynamic',()=>{
 const scene=new THREE.Scene(),entry=decorateHome(scene);buildHomeWing(scene);const sides=buildHomeSideWalls(scene);
 const curtains=scene.getObjectByName('KitchenWindowCurtains')!,sash=curtains.getObjectByName('WindowSash')!,leaf=curtains.getObjectByName('CurtainLeft')!;
 assert.ok(entry.matrixAutoUpdate&&sash.matrixAutoUpdate&&leaf.matrixAutoUpdate);
 scene.updateMatrixWorld(true);const before=sash.matrixWorld.clone();sash.rotation.y=.5;leaf.scale.x=1;scene.updateMatrixWorld();
 assert.notDeepEqual(sash.matrixWorld.elements,before.elements);
 const frozen:THREE.Object3D[]=[];scene.traverse(o=>{if(!o.matrixAutoUpdate)frozen.push(o);});assert.ok(frozen.length>25);
 for(const side of sides.walls)assert.equal(side.root.matrixAutoUpdate,false);
 sides.update(-21,-5);assert.equal(sides.walls[0].upper.visible,false);assert.equal(sides.walls[1].upper.visible,true);
});
