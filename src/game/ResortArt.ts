import * as THREE from 'three';
import {cube,softCube,drum,batchRigidParts,finish,type XYZ} from './ArtKit';
import {PlantBatch,growTree,growShrub,growFlowers} from './LandscapePlants';
import {RESORT_MEAL_DISHES,RESORT_GRILL,type ResortGrill,type ResortMeal,resortService} from '../shared/resort';
import {marketCashier} from './MarketArt';
import {selectIndoorDish} from './MealArt';
import {makeWater,updateWater} from './WaterArt';
import type {Station} from '../shared/locations';
type Resources={textures:THREE.Texture[];materials:THREE.Material[]};
const oak=0xb99468,stone=0xe6dccc,ink=0x34484b,cream=0xf5ebd8,sage=0x789888,blue=0x438e9e;
function kit(){const cache=new Map<number,THREE.MeshStandardMaterial>();return (p:THREE.Object3D,size:XYZ,pos:XYZ,color:number,geo:THREE.BufferGeometry=cube)=>{let mat=cache.get(color);if(!mat){mat=finish(color,'wood');cache.set(color,mat);}const mesh=new THREE.Mesh(geo,mat);mesh.scale.set(...size);mesh.position.set(...pos);mesh.receiveShadow=true;p.add(mesh);return mesh;};}
export function buildResort(root:THREE.Group,r:Resources){
 const g=new THREE.Group(),b=kit();g.name='Azure Shore resort landscape';root.add(g);
 b(g,[40,.25,34],[0,-.17,0],0x819d68);b(g,[6,.07,12],[-14,-.01,10],stone);b(g,[14,.08,2],[-7,.01,12],stone);b(g,[2,.07,11],[3,.01,10],stone);
 // Cottage with open camera-facing side, panoramic glass, stone plinth and timber accents.
 b(g,[16,.18,12],[-8,.02,-8],stone);
 for(let i=0;i<32;i++)b(g,[.46,.025,11.8],[-15.75+i*.5,.125,-8],i%3===0?0xc6a279:0xd3b28b);
 b(g,[16,3,.18],[-8,1.58,-14],ink);b(g,[.18,3,12],[-16,1.58,-8],ink);
 for(let i=0;i<27;i++)b(g,[.09,2.85,.10],[-15.7+i*.59,1.55,-13.86],oak);
 b(g,[.13,3,7],[-.05,1.58,-10.5],ink);
 const glass=new THREE.MeshStandardMaterial({color:0xb8dce2,transparent:true,opacity:.22,roughness:.18,depthWrite:false});r.materials.push(glass);
 for(let i=0;i<4;i++){const p=new THREE.Mesh(cube,glass);p.scale.set(3.55,2.25,.04);p.position.set(-14+i*4,1.48,-2.05);g.add(p);b(g,[.10,2.55,.14],[-15.8+i*4,1.45,-2.06],ink);}
 b(g,[16,.14,.20],[-8,2.8,-2.06],ink);b(g,[16,.13,.20],[-8,.23,-2.06],ink);
 // Open cutaway roof outline and veranda deck.
 b(g,[16.5,.20,1.0],[-8,3.05,-14],oak);b(g,[.22,3.0,.22],[-15.9,1.5,-1.7],oak);b(g,[.22,3.0,.22],[-.2,1.5,-1.7],oak);
 b(g,[15,.17,5],[-8,.04,.5],oak);for(let i=0;i<30;i++)b(g,[.46,.025,4.9],[-15.25+i*.5,.14,.5],i%2?0xc9a57c:0xbe976e);
 // Interior partition accents, cabinets, kitchen worktop and bath screen.
 b(g,[.14,2.5,4.7],[-10,1.35,-11.6],cream);b(g,[.14,2.5,3.2],[-4,1.35,-12.4],cream);
 for(const x of [-3.5,-2.6,-1.7]){b(g,[.82,.9,.68],[x,.59,-13.3],sage);b(g,[.86,.09,.75],[x,1.08,-13.3],stone);}
 b(g,[2.8,.12,1.2],[-2.8,.98,-10],stone);b(g,[2.55,.78,.85],[-2.8,.48,-10],sage);
 for(const x of [-3.6,-2]){b(g,[.48,.10,.48],[x,.61,-8.8],oak,drum);b(g,[.08,.54,.08],[x,.30,-8.8],ink,drum);}
 // Resort perimeter, planted islands and warm path lanterns.
 for(let i=0;i<20;i++){const x=-18+i*1.9;for(const z of [-16,16]){b(g,[.18,.72,.18],[x,.36,z],oak);b(g,[1.78,.09,.10],[x+.83,.60,z],oak);}}
 const plants=new PlantBatch();let seed=314;
 for(const [x,z] of [[-18,-11],[-18,-6],[-18,1],[-18,6],[-18,13],[-10,15],[-4,15],[8,15],[16,14],[18,10],[18,-9],[16,-14],[8,-14],[3,-13]]){growTree(plants,x,z,seed%3?'spruce':'birch',.90+(seed%4)*.08,seed++,true);growShrub(plants,x+.45,0,z+.55,.85,.53,.85,0,seed++);}
 for(const [x,z] of [[-15,3],[-1,1],[6,11],[4,-9],[15,11]]){growFlowers(plants,x,0,z,1.3,.35,.65,0,seed++);}
 plants.attach(root,'Azure Shore planted landscaping');
 for(const [x,z] of [[-13,5],[-7,5],[-2,11],[5,11],[9,12],[17,7],[6,-7]]){b(g,[.13,.85,.13],[x,.43,z],ink);const glow=b(g,[.24,.20,.24],[x,.94,z],0xffe6ad,softCube);glow.material=new THREE.MeshStandardMaterial({color:0xffe6ad,emissive:0xffc475,emissiveIntensity:.75});r.materials.push(glow.material);}
 // Three distinct water surfaces use the existing world-space shader.
 const water:THREE.ShaderMaterial[]=[];
 function surface(kind:'home'|'jacuzzi'|'pond',w:number,d:number,x:number,z:number,y:number){const m=makeWater(kind);if(kind==='pond'){m.uniforms.shallow.value.set(.31,.79,.73);m.uniforms.deepColor.value.set(.04,.40,.55);}const mesh=new THREE.Mesh(kind==='pond'?new THREE.CircleGeometry(1,64):new THREE.PlaneGeometry(1,1),m);mesh.rotation.x=-Math.PI/2;mesh.scale.set(kind==='pond'?w/2:w,kind==='pond'?d/2:d,1);mesh.position.set(x,y,z);root.add(mesh);water.push(m);r.materials.push(m);}
 b(g,[9.8,.15,5.8],[1,.02,6],stone);b(g,[9.1,.10,5.1],[1,.10,6],blue);surface('home',9,5,1,6,.17);
 b(g,[3.5,.45,3.5],[-8,.22,6],stone,softCube);b(g,[2.95,.09,2.95],[-8,.45,6],blue);surface('jacuzzi',2.92,2.92,-8,6,.51);
 const shore=b(g,[7,.14,6],[12,.01,1],0xdccda4,drum);shore.scale.set(7,.14,6);surface('pond',13.5,11.5,12,1,.10);
 for(let i=0;i<20;i++){const a=i*Math.PI/10;b(g,[.4,.23,.5],[12+7.0*Math.cos(a),.12,1+6.05*Math.sin(a)],i%2?0xbdb6a1:stone,softCube);}
 batchRigidParts(g,true);
 const waiter=marketCashier(r,{title:'Официант',color:0x344c50,shirt:0xf8efdf,animated:true});waiter.visible=false;root.add(waiter);const tray=new THREE.Group();tray.position.set(0,.96,.36);waiter.add(tray);b(tray,[.58,.04,.35],[0,0,0],ink,softCube);for(const x of [-.15,.15]){b(tray,[.22,.025,.22],[x,.035,0],cream,drum);b(tray,[.18,.075,.18],[x,.075,0],stone,softCube);}batchRigidParts(tray,true);
 const plates=new Map<string,THREE.Group>();for(const meal of Object.keys(RESORT_MEAL_DISHES) as ResortMeal[])for(const role of ['vlad','alina'] as const){const group=new THREE.Group();group.name='Served '+meal+' '+role;group.visible=false;group.position.set(-8+(role==='vlad'?-.80:.80),1.01,.4);for(let i=0;i<3;i++){const dish=new THREE.Group();dish.position.set(i===0?0:i===1?-.30:.30,0,i===0?.12:-.22);selectIndoorDish(dish,RESORT_MEAL_DISHES[meal][i]);group.add(dish);}root.add(group);plates.set(meal+role,group);}
 const skewers=new Map<ResortGrill,THREE.Group>();for(const [id,d] of Object.entries(RESORT_GRILL)){const group=new THREE.Group();group.position.set(-13,1.10,.6);for(let i=0;i<4;i++){const x=-.48+i*.30;b(group,[.025,.025,.70],[x,0,0],stone);for(let j=0;j<4;j++){const z=-.21+j*.14;b(group,[.14,.085,.11],[x,.045,z],d.color,softCube);b(group,[.11,.008,.018],[x,.090,z],0x644331);}}batchRigidParts(group,true);group.visible=false;root.add(group);skewers.set(id as ResortGrill,group);}
 let night=0,lastProgress=-1,from=0,lastKey='';return {animate:(t:number)=>{water.forEach(m=>updateWater(m,t,night));const service=root.userData.resortService as ReturnType<typeof resortService>;const key=service?.key??'';if(key!==lastKey){lastProgress=-1;lastKey=key;}if(service&&service.progress!==lastProgress){lastProgress=service.progress;from=t;}waiter.visible=!!service&&!service.served; if(waiter.visible&&service){const p=Math.min(.99,service.progress+Math.max(0,t-from)/12);const x=-14+4.4*p,z=3.25-1.10*p;waiter.position.set(x,.04+Math.abs(Math.sin(t*7))*.035,z);waiter.rotation.y=Math.PI/2+.24;const arms=waiter.userData.motion.arms as THREE.Group[];for(const arm of arms)arm.rotation.x=-.19;}
 for(const [id,group] of plates)group.visible=!!service?.served&&service.remaining.some(role=>id===service.meal+role);const grilling=Object.values(root.userData.resortGrill??{});for(const [id,group] of skewers)group.visible=grilling.includes(id);},setNight:(n:boolean)=>{night=n?1:0;}};
}
export function resortStation(s:Station,r:Resources){
 const g=new THREE.Group(),b=kit();void r;g.position.set(s.center.x,0,s.center.z);g.name=s.name;
 const f=s.action.kind==='resort'?s.action.facility:'exit';
 if(f==='bar'){b(g,[4.3,.14,3.8],[0,.06,0],stone);b(g,[4.4,.15,3.8],[0,2.65,-.8],oak);for(const x of [-2,2])b(g,[.15,2.65,.15],[x,1.32,-1.7],ink);for(let i=0;i<3;i++){b(g,[3.0,.07,.45],[0,1.20+i*.42,-1.55],oak);for(let j=0;j<8;j++){const x=-1.24+j*.35,y=1.38+i*.42;b(g,[.16,.27,.15],[x,y,-1.55],[0x54765d,0x805241,0x9d8b63,0x476879][(i+j)%4],drum);b(g,[.065,.085,.065],[x,y+.16,-1.55],ink,drum);}}}
 if(f==='reception'||f==='bar'){b(g,[s.width,.98,s.depth],[0,.49,0],oak);b(g,[s.width+.12,.09,s.depth+.12],[0,1.04,0],stone);for(let i=0;i<7;i++)b(g,[.12,.29,.12],[-.9+i*.30,1.23,-.12],[0x698a68,0x966b4c,0x4e7893][i%3],drum);}
 if(f==='bed'){b(g,[2.8,.38,2.65],[0,.28,0],oak,softCube);b(g,[2.66,.25,2.5],[0,.60,0],cream,softCube);b(g,[2.7,.14,1.82],[0,.80,.29],sage,softCube);for(const x of [-.65,.65])b(g,[.95,.18,.52],[x,.81,-.83],cream,softCube);b(g,[2.9,1.18,.15],[0,.74,-1.35],oak,softCube);}
 if(f==='media'){b(g,[3.3,.52,.62],[0,.26,-.8],oak);b(g,[3.02,1.65,.13],[0,1.55,-.77],0x19262d,softCube);b(g,[2.85,1.49,.02],[0,1.55,-.68],0x466678);b(g,[.45,.12,.20],[.85,.59,-.60],ink);for(const x of [.55,1.15])b(g,[.09,.12,.20],[x,.59,-.60],x<1?0x3e9bc6:0xc86154,softCube);b(g,[3.2,.35,1.02],[0,.29,1.1],cream,softCube);b(g,[3.2,.53,.26],[0,.67,1.58],sage,softCube);for(const x of [-1.4,1.4])b(g,[.33,.55,.95],[x,.52,1.1],cream,softCube);}
 if(f==='terrace'){b(g,[2.8,.10,1.25],[0,.80,0],oak);for(const x of [-1.15,1.15])for(const z of [-.46,.46])b(g,[.09,.78,.09],[x,.39,z],ink);for(const x of [-.8,.8])for(const z of [-1.12,1.12]){b(g,[.65,.10,.64],[x,.45,z],cream,softCube);b(g,[.65,.48,.12],[x,.69,z+Math.sign(z)*.30],oak);for(const dx of [-.22,.22])b(g,[.06,.45,.06],[x+dx,.22,z],oak);}for(const x of [-.8,.8]){b(g,[.38,.025,.38],[x,.868,0],cream,drum);b(g,[.11,.16,.11],[x+.3,.93,-.2],blue,drum);}}
 if(f==='grill'){b(g,[1.45,.48,.75],[0,.8,0],ink,softCube);for(const x of [-.58,.58])b(g,[.09,.77,.09],[x,.39,0],ink);for(let i=0;i<10;i++)b(g,[.035,.035,.68],[-.62+i*.14,1.06,0],stone);b(g,[.65,.07,.74],[1.05,1.03,0],oak);}
 if(f==='bath'){b(g,[1.25,.85,.62],[0,.43,0],oak);b(g,[1.3,.16,.68],[0,.90,0],cream,softCube);b(g,[.08,.23,.08],[0,1.10,-.18],ink,drum);b(g,[.83,.80,.06],[0,1.65,-.31],blue);}
 if(f==='kitchen'){b(g,[2.1,.88,.65],[0,.44,0],sage);b(g,[2.2,.10,.72],[0,.92,0],stone);}
 if(f==='exit'){for(const x of [-1.4,1.4])b(g,[.22,2.8,.22],[x,1.4,0],oak);b(g,[3.1,.42,.24],[0,2.72,0],ink);}
 if(f==='pool'||f==='lake'||f==='jacuzzi'){b(g,[.32,.08,.32],[0,.08,s.depth/2+.1],cream);}
 batchRigidParts(g,true);return g;
}
