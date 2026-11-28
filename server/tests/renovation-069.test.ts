import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {ROOMS,COVERINGS,coveringById,renovationQuote,compatible,initialRenovation,validRenovation} from '../../src/shared/renovation';
import {STATIONS,stationById,approachFor,doorwayArrival,placeObstacles,floorFor} from '../../src/shared/locations';
import {applyWorld,validWorld} from '../locations';
import {planWalk,findRoute,pointIsClear} from '../../src/game/navigation';
import {decorateHome} from '../../src/game/HomeStyling';
import {buildHomeWing} from '../../src/game/HomeWing';
import {buildHomeSideWalls} from '../../src/game/HomeSideWalls';
import {collectRenovation,coveringMaterial} from '../../src/game/RenovationArt';
import {createLocation} from '../../src/game/LocationScene';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openServerFiles} from '../storage';
import {districtStation,districtArrival} from '../../src/shared/district';
test('every shop department has a real route and exits to the car or district',()=>{
 const s=initialState();s.money=100000;
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 const trip=applyWorld(s,'vlad',{type:'car_travel',place:'buildshop'});assert.ok(trip.ok);assert.ok(validWorld(trip.state.world));
 const obs=placeObstacles('buildshop'),floor=floorFor('buildshop'),arrive=doorwayArrival('buildshop','district','vlad');
 assert.ok(pointIsClear(arrive,obs,floor));
 for(const st of STATIONS.buildshop){
  assert.ok(pointIsClear(st.approach,obs,floor),st.id);
  assert.ok(planWalk(arrive,st.approach,obs,floor),st.id);
 }
 const exit=stationById('buildshop','build-exit')!;Object.assign(trip.state.characters.vlad,exit.approach);
 const back=applyWorld(trip.state,'vlad',{type:'travel',place:'district',via:exit.id});assert.ok(back.ok);assert.equal(back.state.world.places.vlad,'home');assert.equal(back.state.world.carDriver,undefined);
 const street=stationById('district',districtStation('buildshop'))!;assert.ok(street);
 assert.ok(findRoute(districtArrival('home','vlad'),street.approach,placeObstacles('district'),floorFor('district')),'district walk to store');
 const scene=createLocation('buildshop');assert.equal(scene.stations.size,STATIONS.buildshop.length);assert.ok(scene.root.children.length>5);scene.dispose();
});
test('samples are free, only the correct store stand grants them; quote/install is authoritative and stale or unaffordable attempts rejected',()=>{
 let s=initialState();s.money=100000;
 const sku='wall-linen-sage',floor='floor-tile-sand';
 assert.equal(applyWorld(s,'vlad',{type:'renovation_sample',sku}).ok,false);
 s.world.places.vlad='buildshop';Object.assign(s.characters.vlad,approachFor(stationById('buildshop','build-walls')!,'vlad'));
 assert.equal(applyWorld(s,'vlad',{type:'renovation_sample',sku:floor}).ok,false);
 let r=applyWorld(s,'vlad',{type:'renovation_sample',sku});assert.ok(r.ok);s=r.state;assert.equal(s.money,100000);assert.equal(s.ledger.length,0);
 assert.equal(applyWorld(s,'vlad',{type:'renovation_sample',sku}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('buildshop','build-floors')!,'vlad'));
 r=applyWorld(s,'vlad',{type:'renovation_sample',sku:floor});assert.ok(r.ok);s=r.state;
 assert.equal(applyWorld(s,'vlad',{type:'renovation_install',sku,room:'bedroom',expected:null,sequence:0}).ok,false);
 s.world.places.vlad='home';const before=s.money,quote=renovationQuote('bedroom',coveringById(sku)!);
 assert.equal(applyWorld(s,'vlad',{type:'renovation_install',sku,room:'bathroom',expected:null,sequence:0}).ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'renovation_install',sku:'unknown',room:'bedroom',expected:null,sequence:0}).ok,false);
 assert.equal(applyWorld({...s,money:1},'vlad',{type:'renovation_install',sku,room:'bedroom',expected:null,sequence:0}).ok,false);
 r=applyWorld(s,'vlad',{type:'renovation_install',sku,room:'bedroom',expected:null,sequence:0});assert.ok(r.ok);
 assert.equal(r.state.money,before-quote.total);assert.equal(r.state.ledger.at(-1)?.amount,quote.total);assert.deepEqual(r.state.world.renovation?.surfaces,{bedroom:{wall:sku}});
 assert.deepEqual(placeObstacles('home',r.state.furnishing),placeObstacles('home',s.furnishing));assert.equal(s.world.renovation?.surfaces.bedroom,undefined);
 assert.equal(applyWorld(r.state,'vlad',{type:'renovation_install',sku,room:'bedroom',expected:null,sequence:0}).ok,false);
 assert.equal(applyWorld(r.state,'alina',{type:'renovation_install',sku,room:'bedroom',expected:null,sequence:0}).ok,false);
 assert.ok(validWorld(r.state.world));
 const dir=mkdtempSync(join(tmpdir(),'renovation-069-'));
 try{const files=openServerFiles(dir);files.save(r.state);assert.deepEqual(files.load().world.renovation,r.state.world.renovation);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('ten rooms have separate actual surface meshes and preview cannot mutate shared state or original geometry',()=>{
 const scene=new THREE.Scene();decorateHome(scene);buildHomeWing(scene);const sides=buildHomeSideWalls(scene);
 const art=collectRenovation(scene),parts:THREE.Mesh[]=[];scene.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.renovation)parts.push(o);});
 assert.equal(art.count,parts.length);
 for(const room of ROOMS)for(const kind of ['wall','floor'] as const)assert.ok(parts.some(m=>m.userData.renovation.room===room.id&&m.userData.renovation.kind===kind),room.id+' '+kind);
 const state=initialRenovation();art.apply(state);assert.equal(parts.filter(p=>p.visible).length,0);
 art.apply(state,{room:'bedroom',sku:'wall-linen-sage'});
 const visible=parts.filter(p=>p.visible);assert.ok(visible.length>1);assert.ok(visible.every(p=>p.userData.renovation.room==='bedroom'&&p.userData.renovation.kind==='wall'&&p.material===coveringMaterial(coveringById('wall-linen-sage')!)));
 assert.deepEqual(state.surfaces,{});art.apply(state);assert.equal(parts.filter(p=>p.visible).length,0);
 state.surfaces.bedroom={wall:'wall-linen-sage'};art.apply(state,{room:'living',sku:'floor-oak-light'});
 assert.equal(parts.filter(p=>p.visible&&p.userData.renovation.kind==='floor').length,1);art.apply(state);assert.equal(parts.filter(p=>p.visible&&p.userData.renovation.kind==='floor').length,0);
 assert.ok(sides.walls.every(w=>w.upper.children.some(o=>o.name==='Room finish wall faces')));
 assert.equal(new Set(COVERINGS.map(p=>p.id)).size,COVERINGS.length);assert.equal(new Set(COVERINGS.map(p=>coveringMaterial(p))).size,COVERINGS.length);
 assert.ok(ROOMS.every(r=>COVERINGS.some(p=>p.kind==='floor'&&compatible(r.id,p))&&COVERINGS.some(p=>p.kind==='wall'&&compatible(r.id,p))));
 assert.equal(validRenovation({samples:[],surfaces:{bathroom:{floor:'floor-carpet-grey'}}}),false);
});

import {buildRoomCeilings,buildCeilingModel,ceilingAnchors} from '../../src/game/RenovationLights';
import {buildCottageLights} from '../../src/game/CottageLights';
import {renovationLampSpots} from '../../src/shared/renovationPlacement';
import {FURNITURE_BY_ID,FURNITURE_CATALOG,FURNITURE_DELIVERY} from '../../src/shared/furniture';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {applyFurnishing} from '../furnishing';
test('all six ceiling fixtures fit fixed overhead anchors, are isolated in preview, and preserve the stock lighting when cancelled',()=>{
 const scene=new THREE.Scene(),stock=buildCottageLights(scene),ceilings=buildRoomCeilings(scene),state=initialRenovation();
 const items=COVERINGS.filter(p=>p.kind==='ceiling');assert.equal(items.length,6);
 for(const p of items){
  const model=buildCeilingModel(p),b=new THREE.Box3().setFromObject(model);
  assert.ok(b.max.y<=.46&&b.min.y>=-.15&&b.max.x-b.min.x<1.6&&b.max.z-b.min.z<1.6,p.id);
  ceilings.apply(state,{room:'bedroom',sku:p.id},0);stock.setLevel(1);stock.setReplaced(ceilings.has);
  assert.equal(ceilings.active.get('bedroom')?.level,1);assert.equal(stock.bedroom.intensity,0);
  assert.deepEqual(state.surfaces,{});assert.equal(ceilings.root.children.length,2);
  ceilings.camera(new THREE.Vector3(-6,8,2),new THREE.Vector3(-6,0,-4),{room:'bedroom',sku:p.id});assert.ok(ceilings.root.children[0].visible);
  ceilings.apply(state,undefined,1);stock.setReplaced(ceilings.has);assert.equal(ceilings.root.children.length,0);assert.equal(stock.bedroom.intensity,10);
 }
 state.surfaces.bedroom={ceiling:'ceiling-ring'};state.lights={bedroom:'off'};ceilings.apply(state,undefined,1);assert.equal(ceilings.active.get('bedroom')?.level,0);
 ceilings.camera(new THREE.Vector3(-6,8,2),new THREE.Vector3(-6,0,-4));assert.equal(ceilings.root.children[0].visible,false);
 state.lights.bedroom='soft';ceilings.apply(state,undefined,0);assert.equal(ceilings.active.get('bedroom')?.level,.45);
 for(const r of ROOMS){const [x,z]=ceilingAnchors[r.id];assert.ok(x>r.x1&&x<r.x2&&z>r.z1&&z<r.z2);}
});
test('ceiling selection, installation and four light modes are shared, affordable and validated',()=>{
 let s=initialState();s.money=100000;s.world.places.vlad='buildshop';Object.assign(s.characters.vlad,approachFor(stationById('buildshop','build-light')!,'vlad'));
 for(const p of COVERINGS.filter(p=>p.kind==='ceiling')){const r=applyWorld(s,'vlad',{type:'renovation_sample',sku:p.id});assert.ok(r.ok);s=r.state;}
 s.world.places.vlad='home';const sku='ceiling-ring';assert.equal(applyWorld(s,'vlad',{type:'renovation_install',sku,room:'bathroom',expected:null,sequence:0}).ok,false);
 let r=applyWorld(s,'vlad',{type:'renovation_install',sku,room:'bedroom',expected:null,sequence:0});assert.ok(r.ok);s=r.state;
 assert.equal(s.money,100000-renovationQuote('bedroom',coveringById(sku)!).total);
 for(const mode of ['off','soft','warm','auto']){r=applyWorld(s,'alina',{type:'renovation_light',room:'bedroom',mode});assert.ok(r.ok);assert.equal(r.state.world.renovation?.lights?.bedroom,mode);assert.equal(r.state.money,s.money);assert.ok(validWorld(r.state.world));s=r.state;}
 assert.equal(applyWorld(s,'vlad',{type:'renovation_light',room:'living',mode:'warm'}).ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'renovation_light',room:'bedroom',mode:['warm']}).ok,false);
});
test('all twelve portable lights are in DomStroy; preview finds safe floor or mounted positions, order charges once and enters normal delivery',()=>{
 let s=initialState();s.money=150000;s.world.places.vlad='buildshop';Object.assign(s.characters.vlad,approachFor(stationById('buildshop','build-portable')!,'vlad'));
 const lamps=COVERINGS.filter(p=>p.kind==='portable');assert.equal(lamps.length,12);assert.deepEqual(lamps.map(p=>p.id),FURNITURE_CATALOG.filter(p=>p.category==='lighting').map(p=>p.id));
 for(const p of lamps){const r=applyWorld(s,'vlad',{type:'renovation_sample',sku:p.id});assert.ok(r.ok,p.id);s=r.state;const def=FURNITURE_BY_ID.get(p.id)!;const b=new THREE.Box3().setFromObject(buildFurnishingModel(p.id,'oak'));assert.ok(b.max.y<=def.height+.001,p.id);}
 s.world.places.vlad='home';s.furnishing.placed.push({id:1,sku:'dresser-nora',finish:'oak',x:14,z:-6,rotation:0});s.furnishing.nextId=2;
 for(const sku of ['lamp-table-linen','lamp-table-globe','lamp-table-ceramic','lamp-lantern','lamp-arc']){
  const spots=renovationLampSpots(s,'wing1',sku);assert.ok(spots.length,sku);assert.ok(spots.every(p=>sku.startsWith('lamp-table-')?p.y>0:p.y===0));assert.equal(renovationLampSpots(s,'bathroom',sku).length,0);
 }
 const sku='lamp-table-globe',spot=renovationLampSpots(s,'wing1',sku)[0];
 assert.equal(applyWorld(s,'vlad',{type:'renovation_lamp_order',sku,room:'wing1',x:0,z:0,sequence:0}).ok,false);
 const r=applyWorld(s,'vlad',{type:'renovation_lamp_order',sku,room:'wing1',x:spot.x,z:spot.z,sequence:0});assert.ok(r.ok);
 assert.equal(r.state.money,s.money-FURNITURE_BY_ID.get(sku)!.price-FURNITURE_DELIVERY.regular.fee);assert.equal(r.state.furnishing.orders.length,1);assert.equal(s.furnishing.orders.length,0);
 assert.equal(applyWorld(r.state,'vlad',{type:'renovation_lamp_order',sku,room:'wing1',x:spot.x,z:spot.z,sequence:0}).ok,false);
 const order=r.state.furnishing.orders[0],unbox=applyFurnishing(r.state,'alina',{type:'furniture_unbox',id:order.id},order.readyAt);assert.ok(unbox.ok);
 const placed=applyFurnishing(unbox.state,'alina',{type:'furniture_place',id:order.id,x:spot.x,z:spot.z,rotation:0},order.readyAt);assert.ok(placed.ok);assert.ok(placed.state.furnishing.placed.find(p=>p.id===order.id)?.mount);
});
