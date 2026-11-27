import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLocation} from '../../src/game/LocationScene';
import {detailedLeisure} from '../../src/game/LeisureDetail061';
import {STATIONS} from '../../src/shared/locations';
import {VENUE_GAMES} from '../../src/shared/venue';
import {SPA_PASSES} from '../../src/shared/spa';
import {BARBER_SERVICES} from '../../src/shared/barber';
import {CLINIC_SERVICES} from '../../src/shared/health';
import {FITNESS_PASSES} from '../../src/shared/fitness';
test('five leisure interiors preserve stations, animation roots and use batched decoration',()=>{
 for(const place of detailedLeisure){
  const scene=createLocation(place);
  try{
   assert.deepEqual([...scene.stations.keys()],STATIONS[place].map(s=>s.id));
   for(const station of STATIONS[place]){
    const p=scene.stations.get(station.id)!.position;
    assert.equal(p.x,station.center.x);assert.equal(p.z,station.center.z);
   }
   const detail=scene.root.getObjectByName('Leisure detail 061 '+place)!;assert.ok(detail);
   const meshes:THREE.Mesh[]=[];detail.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);assert.ok(!(o instanceof THREE.Light));});
   assert.ok(meshes.length<=2,place+' '+meshes.length);
   for(const m of meshes){assert.equal(m.castShadow,false);const hits:THREE.Intersection[]=[];m.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);}
   const labels=detail.userData.labels as {title:string;lines:string[]}[];
   const prices=(p:number)=>p.toLocaleString('ru-RU')+' ₽';
   const entries=place==='venue'?Object.values(VENUE_GAMES):place==='spa'?Object.values(SPA_PASSES):place==='fitness'?Object.values(FITNESS_PASSES):place==='barber'?Object.values(BARBER_SERVICES):Object.values(CLINIC_SERVICES).filter(v=>v.price>0);
   for(const v of entries)assert.ok(labels.some(l=>l.lines.includes(v.name+'  '+prices(v.price))),place+' '+v.name);
   scene.animate?.(2);scene.setNight(true);
  }finally{scene.dispose();}
 }
});