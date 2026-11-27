import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeWater,updateWater} from '../../src/game/WaterArt';
import {buildFurnishingModel,createPlacementGhost} from '../../src/game/FurnishingArt';
import {buildSpaWater} from '../../src/game/SpaWater';
import {buildDistrictPond} from '../../src/game/DistrictPond';
import {buildCampFire} from '../../src/game/LakeCampArt';
const resources=()=>({textures:[] as THREE.Texture[],materials:[] as THREE.Material[]});
test('pool and pond water share animated normals with independent material state',()=>{
 const home=makeWater('home'),spa=makeWater('spa'),pond=makeWater('pond');
 assert.equal(home.fragmentShader,spa.fragmentShader);assert.equal(spa.fragmentShader,pond.fragmentShader);
 assert.equal(home.transparent,true);assert.equal(spa.depthWrite,false);assert.equal(pond.depthWrite,true);
 updateWater(home,12,.8);assert.equal(home.uniforms.time.value,12);assert.equal(home.uniforms.night.value,.8);
 assert.equal(spa.uniforms.time.value,0);assert.equal(pond.uniforms.night.value,0);
});
test('home pool keeps its plane and placement ghost standard materials',()=>{
 const root=buildFurnishingModel('oasis-pool','oak');
 const surface=root.getObjectByName('Oasis water surface') as THREE.Mesh;
 assert.ok(surface.material instanceof THREE.ShaderMaterial);assert.equal(surface.geometry.type,'PlaneGeometry');
 const ghost=createPlacementGhost('oasis-pool','oak');
 ghost.traverse(part=>{if(part instanceof THREE.Mesh)assert.ok(part.material instanceof THREE.MeshStandardMaterial);});
});
test('SPA water and pond are actually wired to animation; SPA stays lit indoors',()=>{
 const parent=new THREE.Group(),fixture=buildSpaWater(parent,7.6,4.8,false,resources());
 const surface=fixture.getObjectByName('SPA water surface') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 fixture.userData.animate(3,false);assert.equal(surface.material.uniforms.time.value,3);assert.equal(surface.material.uniforms.indoor.value,1);
 const root=new THREE.Group(),pond=buildDistrictPond(root,resources());
 const p=root.getObjectByName('District pond water') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 pond.setNight(true);pond.animate(9);assert.equal(p.material.uniforms.night.value,1);assert.equal(p.material.uniforms.time.value,9);
});
test('park uses same flame shader, embers, smoke and light without unused lake food models',()=>{
 const park=buildCampFire(resources(),false),lake=buildCampFire(resources());
 const active=park.getObjectByName('Campfire active')!;assert.equal(active.visible,false);
 const flame=active.getObjectByName('Campfire flame tongue') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 const lakeFlame=lake.getObjectByName('Campfire flame tongue') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 assert.equal(flame.material.fragmentShader,lakeFlame.material.fragmentShader);
 assert.equal(active.children.filter(x=>x instanceof THREE.Sprite).length,5);
 assert.equal(active.children.filter(x=>x instanceof THREE.InstancedMesh).length,1);
 park.userData.setLit(true);park.userData.animate(4);assert.equal(active.visible,true);assert.equal(flame.material.uniforms.time.value,4);
 park.userData.setLit(false);assert.equal(active.visible,false);
 assert.equal(lake.children.length-park.children.length,7);
});
