import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {CONSOLES,CONSOLE_GAMES,consoleLibrary,consoleInstalled,validConsoleLibrary} from '../../src/shared/consoleCatalog';
import {applyWorld} from '../locations';
import {applyFurnishing} from '../furnishing';
import {STATIONS,approachFor,stationById,doorwayArrival,floorFor,placeObstacles} from '../../src/shared/locations';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {createLocation} from '../../src/game/LocationScene';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {HOME_PLACEMENTS} from '../../src/shared/home';
import {speakerMountAt} from '../../src/shared/speakerPlacement';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('Expanded electronics department keeps all previous stands and both new routes',()=>{
 const floor=floorFor('electronics'),obs=placeObstacles('electronics');
 for(const role of ['vlad','alina'] as const){
  const spawn=doorwayArrival('electronics','district',role);
  assert.ok(pointIsClear(spawn,obs,floor));
  for(const station of STATIONS.electronics){const target=approachFor(station,role);assert.ok(pointIsClear(target,obs,floor),station.id);assert.ok(findRoute(spawn,target,obs,floor),station.id);assert.ok(findRoute(target,spawn,obs,floor),station.id);}
 }
 const scene=createLocation('electronics');try{assert.equal(scene.stations.size,11);assert.ok(scene.stations.has('tech-ps5'));assert.ok(scene.stations.has('tech-switch'));}finally{scene.dispose();}
});
test('Both consoles must be paid at cashier, placed on supported furniture and unlock their own shared games',()=>{
 let s=initialState();s.money=200000;
 const send=(command:Record<string,unknown>,role:'vlad'|'alina'='vlad')=>{const r=applyWorld(s,role,command);if(!r.ok)assert.fail(r.reason);s=r.state;};
 assert.equal(applyWorld(s,'vlad',{type:'console_buy',sku:'console-ps5'}).ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'console_game_buy',game:'ufc6'}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 send({type:'car_travel',place:'electronics'});send({type:'approach',place:'electronics',station:'tech-cash'});
 for(const sku of ['console-ps5','console-switch2'] as const){send({type:'console_buy',sku});assert.equal(applyWorld(s,'vlad',{type:'console_buy',sku}).ok,false);}
 assert.equal(s.money,85020);
 send({type:'approach',place:'electronics',station:'tech-exit'});send({type:'travel',place:'district',via:'tech-exit'});assert.equal(s.world.places.vlad,'home');
 assert.equal(applyWorld(s,'vlad',{type:'console_game_buy',game:'ufc6'}).ok,false);
 const nav=placeObstacles('home',s.furnishing),tv=HOME_PLACEMENTS.tv;
 for(const [sku,offset] of [['console-ps5',-.60],['console-switch2',.60]] as const){
  const item=s.furnishing.stored.find(i=>i.sku===sku)!;
  assert.equal(applyFurnishing(s,'vlad',{type:'furniture_place',id:item.id,x:13,z:-4,rotation:0},0).ok,false);
  const r=applyFurnishing(s,'vlad',{type:'furniture_place',id:item.id,x:tv.x+offset,z:tv.z+.04,rotation:0},0);
  if(!r.ok)assert.fail(r.reason);s=r.state;assert.ok(consoleInstalled(s,sku));
  const placed=s.furnishing.placed.find(p=>p.id===item.id)!;assert.ok(placed.mount?.support.startsWith('static:tv:'));assert.equal(speakerMountAt(s.furnishing,{...placed,id:99}),null);
 }
 assert.deepEqual(placeObstacles('home',s.furnishing),nav);
 send({type:'console_game_buy',game:'ufc6'},'alina');assert.ok(consoleLibrary(s).includes('ufc6'));
 assert.equal(applyWorld(s,'vlad',{type:'console_game_buy',game:'ufc6'}).ok,false);
 send({type:'console_game_buy',game:'marioKart'});
 assert.equal(s.money,85020-CONSOLE_GAMES.ufc6.price-CONSOLE_GAMES.marioKart.price);
 const dir=mkdtempSync(join(tmpdir(),'console-save-'));try{const f=openServerFiles(dir);f.save(s);const loaded=f.load();assert.deepEqual(loaded.consoleLibrary,s.consoleLibrary);assert.ok(consoleInstalled(loaded,'console-ps5'));}finally{rmSync(dir,{recursive:true,force:true});}
 assert.equal(validConsoleLibrary(['ufc6','ufc6']),false);assert.equal(validConsoleLibrary(['fake']),false);
});
test('Both actual 3D console models remain inside declared footprint',()=>{
 for(const sku of ['console-ps5','console-switch2'] as const){
  const g=buildFurnishingModel(sku,'ivory'),box=new THREE.Box3().setFromObject(g),size=box.getSize(new THREE.Vector3()),m=CONSOLES[sku];
  assert.ok(size.x<=m.width+.001&&size.y<=m.height+.001&&size.z<=m.depth+.001);assert.ok(Math.abs(box.min.y)<.001);
 }
});
