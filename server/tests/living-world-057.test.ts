import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {weatherAt} from '../../src/shared/weather';
import {seasonalMaterial,applySeason} from '../../src/game/SeasonalPalette';
import {interiorLighting,polishShopInterior} from '../../src/game/InteriorAtmosphere';
import {createLocation} from '../../src/game/LocationScene';
import {STATIONS} from '../../src/shared/locations';
test('wet paving uses shared weather state, no material replacement and preserves prior shader',()=>{
 const base=new THREE.MeshStandardMaterial();let previous=false;base.onBeforeCompile=()=>{previous=true};
 const paving=seasonalMaterial(base,'paving');assert.equal(paving,base);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <roughnessmap_fragment>'} as any;
 paving.onBeforeCompile(shader,null as any);assert.ok(previous);
 assert.match(shader.fragmentShader,/roughnessFactor=mix/);assert.match(shader.vertexShader,/seasonalXZ/);
 const w=weatherAt({day:17,minute:720});applySeason(w,'rain');assert.equal(shader.uniforms.seasonWet.value,1);
 applySeason(w,'snow');assert.equal(shader.uniforms.seasonWet.value,0);assert.ok(shader.uniforms.snowCover.value>=.75);
 applySeason(w,'clear');assert.equal(shader.uniforms.snowCover.value,w.snow);
});
test('six old interiors use distinct stable light profiles, no new collision or actual lights',()=>{
 for(const place of ['market','cafe','petshop','electronics','clothing','education'] as const){
  assert.ok(interiorLighting(place));
  const g=new THREE.Group(),resources={textures:[],materials:[]};
  const interior=polishShopInterior(g,place,resources)!;
  let meshes=0,lights=0;interior.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;if(o instanceof THREE.Light)lights++;});
  assert.ok(meshes<=4);assert.equal(lights,0);
  const scene=createLocation(place);assert.deepEqual([...scene.stations.keys()],STATIONS[place].map(s=>s.id));scene.dispose();
 }
 assert.equal(interiorLighting('lake'),undefined);assert.equal(interiorLighting('spa'),undefined);
});
test('park pond is a single animated water plane and keeps all station identifiers',()=>{
 const park=createLocation('park');const water=park.root.getObjectByName('Park water surface') as THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 assert.ok(water?.material instanceof THREE.ShaderMaterial);assert.equal(water.material.uniforms.roundBank.value,0);
 park.animate?.(8);park.setNight(true);assert.equal(water.material.uniforms.time.value,8);assert.equal(water.material.uniforms.night.value,1);
 assert.deepEqual([...park.stations.keys()],STATIONS.park.map(s=>s.id));park.dispose();
});
