import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLocation} from '../../src/game/LocationScene';
import {detailedRemaining} from '../../src/game/WorkOutdoorDetail061';
import {STATIONS} from '../../src/shared/locations';
test('all remaining locations retain the existing station anchors and bounded, noninteractive decoration',()=>{
 for(const place of detailedRemaining){
  const scene=createLocation(place);
  try{
   assert.deepEqual([...scene.stations.keys()],STATIONS[place].map(s=>s.id));
   for(const s of STATIONS[place]){
    const p=scene.stations.get(s.id)!.position;
    assert.equal(p.x,s.center.x);assert.equal(p.z,s.center.z);
   }
   const detail=scene.root.getObjectByName('Remaining detail 061 '+place)!;assert.ok(detail);
   let meshes=0;
   detail.traverse(o=>{assert.ok(!(o instanceof THREE.Light));if(o instanceof THREE.Mesh){meshes++;assert.equal(o.castShadow,false);const hits:THREE.Intersection[]=[];o.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);}});
   assert.ok(meshes>0&&meshes<=2,place+' '+meshes);
   scene.animate?.(2);scene.setNight(true);
  }finally{scene.dispose();}
 }
});