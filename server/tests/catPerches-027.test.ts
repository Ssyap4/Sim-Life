import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {FURNITURE_CATALOG,FURNITURE_BY_ID} from '../../src/shared/furniture';
import {catPerchCandidates,catPerchable,currentCatPerch} from '../../src/shared/CatPerches';
import {HOME_FLOOR} from '../../src/shared/home';
import {placeObstacles} from '../../src/shared/locations';
import {petNavigationGeometry,planPetRoute} from '../../src/game/PetNavigation';
import {runPetRoutines} from '../pets';
import {PetActor} from '../../src/game/PetActor';
import {PET_SPEED} from '../../src/shared/pets';

test('0.27 v6: built-in sofas and beds provide real cushion spots, never sold ghosts',()=>{
  const state=initialState();
  const places=catPerchCandidates(state.furnishing);
  assert.deepEqual(places.map(p=>p.key),['starter:sofa','starter:bed']);
  for(const p of places){
    assert.ok(p.surface.y>.65 && p.surface.y<1.2);
    assert.ok(Math.hypot(p.surface.x-p.approach.x,p.surface.z-p.approach.z)>.5);
    assert.deepEqual(currentCatPerch(state.furnishing,p),p);
  }
  state.furnishing.soldFixtures=['sofa','bed'];
  assert.equal(catPerchCandidates(state.furnishing).length,0);
  assert.equal(currentCatPerch(state.furnishing,places[0]),null);
});

test('0.27 v6: future purchased sofas, beds and seats rotate their landing/launch coordinates',()=>{
  const state=initialState();
  state.furnishing.soldFixtures=['sofa','bed'];
  state.furnishing.placed=[
    {id:41,sku:'sofa-luna',finish:'oak',rotation:0,x:1,z:1},
    {id:42,sku:'bed-platform',finish:'sage',rotation:1,x:-5,z:2},
    {id:43,sku:'chair-cloud',finish:'slate',rotation:2,x:3,z:4},
    {id:44,sku:'table-family',finish:'oak',rotation:0,x:6,z:5},
    {id:45,sku:'wardrobe-wide',finish:'oak',rotation:0,x:5,z:-3},
  ];
  const initial=structuredClone(state.furnishing);
  const locations=catPerchCandidates(state.furnishing);
  assert.deepEqual(locations.map(p=>p.key),['placed:41','placed:42','placed:43']);
  assert.ok(locations[0].approach.z>1);
  assert.ok(locations[1].approach.x>-5,'90deg rotation changes approach side');
  assert.ok(locations[2].approach.z<4,'180deg changes facing');
  for(const candidate of locations)
    assert.ok(currentCatPerch(state.furnishing,candidate));
  state.furnishing.placed[0].x+=.5;
  assert.equal(currentCatPerch(state.furnishing,locations[0]),null);
  assert.deepEqual(initial.placed.map(p=>p.id),[41,42,43,44,45]);
  assert.equal(FURNITURE_CATALOG.filter(catPerchable).length>12,true);
  assert.equal(catPerchable(FURNITURE_BY_ID.get('pouf-joy')!),false);
  assert.equal(catPerchable(FURNITURE_BY_ID.get('bench-mori')!),false);
});

test('0.27 v6: a server-planned cat jump uses a reachable floor route and saved safe surface',()=>{
  const state=initialState();
  const spot=catPerchCandidates(state.furnishing)[0];
  const geometry=petNavigationGeometry(placeObstacles('home',state.furnishing),HOME_FLOOR);
  assert.ok(spot);
  assert.ok(planPetRoute(state.pets.simba.position,spot.approach,geometry));
  const before={money:state.money,pantry:structuredClone(state.pantry),petFood:structuredClone(state.petFood)};
  Object.assign(state.pets.simba,{satiety:89,energy:93,bladder:94,happiness:90,bond:82});
  const times=[.01,.1,.1,.1,.1,.1,.1,.1,.1,.1];
  let call=0;
  runPetRoutines(state,0,480,new Set(),()=>times[Math.min(call++,times.length-1)]);
  assert.equal(state.pets.verdell.routine?.kind,'wander');
  const routine=state.pets.simba.routine!;
  assert.equal(routine.kind,'perch');
  assert.equal(routine.perch?.key,spot.key);
  const end=routine.route.path.at(-1)??routine.route.from;
  assert.ok(Math.hypot(end.x-spot.approach.x,end.z-spot.approach.z)<.03);
  assert.deepEqual({money:state.money,pantry:state.pantry,petFood:state.petFood},before);
  // Removing its fixture invalidates the old landing point immediately.
  state.furnishing.soldFixtures=['sofa','bed'];
  assert.equal(currentCatPerch(state.furnishing,routine.perch!),null);
});

test('0.27 v6: physical cat animation clears furniture on a jump, returns to floor before another route',()=>{
  const spot={key:'test',approach:{x:0,z:0},surface:{x:0,y:.85,z:.82},yaw:0,kind:'curl' as const};
  const cat=new PetActor('simba');
  cat.root.position.set(0,0,0);
  cat.followRoute([],'perch',undefined,spot);
  let highest=-10;
  for(let i=0;i<40;i++){
    cat.update(.04);
    const mesh=cat.root.children[0];
    mesh.updateWorldMatrix(true,false);
    highest=Math.max(highest,mesh.getWorldPosition(new THREE.Vector3()).y);
  }
  assert.ok(highest>.95,'The jump must clear the cushion lip');
  // A real paw's lowest vertex must now land ON the cushion, rather than
  // staying high above it as the first software-WebGL film exposed.
  const paw=(cat as unknown as {paws:THREE.Group[]}).paws[0];
  const bounds=new THREE.Box3().setFromObject(paw,true);
  const cushionTop=spot.surface.y-.085;
  assert.ok(Math.abs(bounds.min.y-cushionTop)<.14,
    'Cat paw must physically touch sofa surface, not levitate: '+bounds.min.y);
  assert.ok(cat.root.position.y===0 && cat.root.position.x===0 && cat.root.position.z===0,
    'Navigation root remains on safe FLOOR point');
  cat.followRoute([new THREE.Vector3(.5,0,0)],'wander');
  cat.update(.08);
  assert.equal(cat.root.position.x,0,'Cannot start walking through a sofa during descent');
  for(let i=0;i<40;i++)cat.update(.04);
  assert.ok(cat.root.position.x>0,'After dismount the route continues');
  const body=cat.root.children[0];
  assert.ok(body.position.y>=0);
  assert.ok(body.position.toArray().every(Number.isFinite));
  assert.equal(PET_SPEED.simba>0,true);
});
