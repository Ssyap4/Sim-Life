import * as THREE from 'three';
import {cube,softCube,drum,orb,batchRigidParts,finish,type XYZ} from './ArtKit';
import {PlantBatch,growTree,growShrub,growFlowers} from './LandscapePlants';
import {RESORT_MEAL_DISHES,RESORT_GRILL,resortMedia,type ResortGrill,type ResortMeal,resortService} from '../shared/resort';
import {paintGround} from './LandscapeGround';
import {painted} from './LocationArt';
import {drawConsoleFrame} from './ConsoleFrames';
import {drawNamedMedia} from '../mediaArt';
import {buildConsoleModel} from './ConsoleArt';
import type {ConsoleMatch} from '../shared/consoleCatalog';
import {marketCashier} from './MarketArt';
import {selectIndoorDish} from './MealArt';
import {makeWater,updateWater} from './WaterArt';
import type {Station} from '../shared/locations';
type Resources={textures:THREE.Texture[];materials:THREE.Material[]};
const oak=0xb99468,stone=0xe6dccc,ink=0x34484b,cream=0xf5ebd8,sage=0x789888,blue=0x438e9e;
function kit(){const cache=new Map<number,THREE.MeshStandardMaterial>();return (p:THREE.Object3D,size:XYZ,pos:XYZ,color:number,geo:THREE.BufferGeometry=cube)=>{let mat=cache.get(color);if(!mat){mat=finish(color,'wood');cache.set(color,mat);}const mesh=new THREE.Mesh(geo,mat);mesh.scale.set(...size);mesh.position.set(...pos);mesh.receiveShadow=true;p.add(mesh);return mesh;};}
export function buildResort(root:THREE.Group,r:Resources){
 const g=new THREE.Group(),b=kit();g.name='Azure Shore resort landscape';root.add(g);
 b(g,[40,.25,34],[0,-.17,0],0x819d68);const groundMap=painted(r,1024,1024,ctx=>paintGround(ctx,{x:0,z:0,w:40,d:34},[{x:12,z:1,w:16,d:14,ink:[189,178,132],opacity:.60},{x:-18,z:0,w:4,d:30,ink:[58,104,61],opacity:.45},{x:0,z:13,w:30,d:6,ink:[114,145,72],opacity:.35}],8701,'lawn'));const groundMat=new THREE.MeshStandardMaterial({map:groundMap,color:groundMap?0xffffff:0x819d68,roughness:1});r.materials.push(groundMat);const lawn=new THREE.Mesh(new THREE.PlaneGeometry(40,34),groundMat);lawn.rotation.x=-Math.PI/2;lawn.position.y=-.018;lawn.receiveShadow=true;root.add(lawn);b(g,[6,.07,12],[-14,-.01,10],stone);b(g,[14,.08,2],[-7,.01,12],stone);b(g,[2,.07,11],[3,.01,10],stone);
 // Cottage with open camera-facing side, panoramic glass, stone plinth and timber accents.
 b(g,[16,.18,12],[-8,.02,-8],stone);
 for(let i=0;i<32;i++)b(g,[.46,.025,11.8],[-15.75+i*.5,.125,-8],i%3===0?0xc6a279:0xd3b28b);
 b(g,[16,3,.18],[-8,1.58,-14],ink);b(g,[.18,3,12],[-16,1.58,-8],ink);
 for(let i=0;i<27;i++)b(g,[.09,2.85,.10],[-15.7+i*.59,1.55,-13.86],oak);
 b(g,[.13,3,7],[-.05,1.58,-10.5],ink);
 // Interior fitted storage, wood headboard, textured rugs and indirect lighting.
 b(g,[3.2,.09,3.8],[-13,.15,-12.25],0xc1bba7);b(g,[3.9,.09,4.0],[-7,.16,-8.7],0xb3c3b9);for(let i=0;i<13;i++)b(g,[3.80,.008,.035],[-7,.212,-10.48+i*.30],0xcbd6ca);
 for(const x of [-15,-11]){b(g,[.68,.64,.65],[x,.44,-12.1],oak,softCube);b(g,[.38,.025,.025],[x,.51,-11.76],ink);b(g,[.10,.32,.10],[x,.92,-12.1],ink,drum);b(g,[.35,.22,.35],[x,1.13,-12.1],cream,drum);}
 b(g,[2.8,2.1,.68],[-13,1.18,-13.6],oak);for(let i=0;i<3;i++){b(g,[.88,1.94,.04],[-13.94+i*.94,1.2,-13.22],i===1?cream:oak);b(g,[.025,.34,.045],[-13.65+i*.94,1.23,-13.18],ink);}
 b(g,[2.4,.36,.78],[-7,.31,-12.9],oak,softCube);for(let i=0;i<4;i++)b(g,[.47,.10,.46],[-7.72+i*.48,.55,-12.9],sage,softCube);b(g,[.34,.83,.34],[-9.35,.54,-12.65],ink,drum);b(g,[.50,.33,.50],[-9.35,1.1,-12.65],cream,drum);
 b(g,[2.4,.16,1.4],[-2.2,.20,-6.5],0xb9c4c0,softCube);b(g,[1.6,.64,.86],[-2.2,.60,-6.5],cream,softCube);b(g,[1.5,.04,.68],[-2.2,.94,-6.5],0xd0c8b7,softCube);
 b(g,[.72,1.9,.70],[-.85,1.06,-13.28],0xabb9b8,softCube);b(g,[.025,.46,.045],[-.57,1.14,-12.90],ink);b(g,[.65,.035,.68],[-.85,.85,-13.28],ink);b(g,[.48,.055,.48],[-2.6,1.14,-13.30],ink);for(const x of [-2.73,-2.46])for(const z of [-13.43,-13.18])b(g,[.14,.018,.14],[x,1.177,z],0x617478,drum);
 const glass=new THREE.MeshStandardMaterial({color:0xb8dce2,transparent:true,opacity:.22,roughness:.18,depthWrite:false});r.materials.push(glass);
 for(let i=0;i<4;i++){const p=new THREE.Mesh(cube,glass);p.scale.set(3.55,2.25,.04);p.position.set(-14+i*4,1.48,-2.05);if(i%2===0)g.add(p);else{p.geometry=cube;p.scale.x=.84;p.position.x+=1.36;g.add(p);}b(g,[.10,2.55,.14],[-15.8+i*4,1.45,-2.06],ink);}
 b(g,[16,.14,.20],[-8,2.8,-2.06],ink);for(const x of [-14,-6])b(g,[3.55,.13,.20],[x,.23,-2.06],ink);for(const x of [-15.45,-11.45,-7.45,-3.45]){b(g,[.36,2.35,.13],[x,1.45,-1.96],cream,softCube);for(let j=0;j<4;j++)b(g,[.048,2.3,.04],[x-.12+j*.08,1.45,-1.87],0xd7cfba);}
 // Short pergola beams leave the cutaway view open.
 for(let i=0;i<9;i++)b(g,[.18,.18,2.9],[-15.3+i*1.82,3.02,-.75],oak);
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
 const ripples=new THREE.Group();root.add(ripples);const rippleGeo=new THREE.RingGeometry(.90,1,40);rippleGeo.rotateX(-Math.PI/2);const rippleMats:THREE.MeshBasicMaterial[]=[];for(let i=0;i<8;i++){const m=new THREE.MeshBasicMaterial({color:0xc2f4ee,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});r.materials.push(m);rippleMats.push(m);const mesh=new THREE.Mesh(rippleGeo,m);mesh.visible=false;ripples.add(mesh);}const jets=new THREE.Group();root.add(jets);const jetMat=new THREE.MeshBasicMaterial({color:0xe1faf5,transparent:true,opacity:.57,depthWrite:false});r.materials.push(jetMat);for(let i=0;i<16;i++){const mesh=new THREE.Mesh(orb,jetMat);mesh.scale.setScalar(.024+(i%3)*.008);mesh.visible=false;jets.add(mesh);}
 function surface(kind:'home'|'jacuzzi'|'pond',w:number,d:number,x:number,z:number,y:number){const m=makeWater(kind);if(kind==='pond'){m.uniforms.shallow.value.set(.29,.83,.76);m.uniforms.deepColor.value.set(.025,.43,.57);m.uniforms.amplitude.value=1.05;}else{m.uniforms.shallow.value.set(.29,.75,.80);m.uniforms.deepColor.value.set(.045,.38,.55);m.uniforms.indoor.value=0;}const mesh=new THREE.Mesh(kind==='pond'?new THREE.CircleGeometry(1,64):new THREE.PlaneGeometry(1,1),m);mesh.rotation.x=-Math.PI/2;mesh.scale.set(kind==='pond'?w/2:w,kind==='pond'?d/2:d,1);mesh.position.set(x,y,z);root.add(mesh);water.push(m);r.materials.push(m);}
 b(g,[11.7,.12,7.7],[1,.01,6],stone);b(g,[9.8,.16,5.8],[1,.08,6],0x8db5b8);b(g,[9.1,.10,5.1],[1,.10,6],blue);surface('home',9,5,1,6,.235);
 for(const z of [3.25,8.75])b(g,[9.75,.12,.36],[1,.25,z],cream);for(const x of [-3.72,5.72])b(g,[.36,.12,5.45],[x,.25,6],cream);
 for(let i=0;i<3;i++)b(g,[1.42,.09,.38],[-2.70,.14+i*.03,4.08-i*.34],0xc2ded9);for(const x of [-3.24,-2.12]){b(g,[.055,.70,.055],[x,.56,3.12],0xa7bab9,drum);b(g,[.055,.055,.62],[x,.88,3.35],0xa7bab9);}
 for(const x of [-1.6,1.0,3.6]){b(g,[.82,.20,1.85],[x,.24,11.65],oak,softCube);b(g,[.78,.16,1.75],[x,.42,11.65],cream,softCube);b(g,[.78,.15,.65],[x,.62,11.04],sage,softCube).rotation.x=.38;for(const dx of [-.30,.30])b(g,[.08,.22,.08],[x+dx,.14,12.3],ink);}
 for(const x of [-2.75,4.85]){b(g,[.12,2.1,.12],[x,1.12,12.25],oak,drum);const canopy=b(g,[1.05,.20,1.05],[x,2.22,12.25],cream,drum);canopy.scale.set(1.05,.20,1.05);}

 b(g,[4.9,.14,4.9],[-8,.03,6],oak);b(g,[3.5,.50,3.5],[-8,.25,6],stone,softCube);b(g,[2.95,.09,2.95],[-8,.45,6],blue);surface('jacuzzi',2.92,2.92,-8,6,.53);for(const x of [-9.56,-6.44])b(g,[.29,.12,3.28],[x,.51,6],cream,softCube);for(const z of [4.44,7.56])b(g,[3.28,.12,.29],[-8,.51,z],cream,softCube);for(let i=0;i<4;i++)b(g,[.10,.025,.10],[-9.2+i*.8,.52,5.0],0xb5c4c2,drum);
 b(g,[1.3,.18,.55],[-8,.10,8.0],oak,softCube);b(g,[1.3,.36,.36],[-8,.19,7.63],oak,softCube);
 const shore=b(g,[7.35,.14,6.35],[12,.01,1],0xdccda4,new THREE.CylinderGeometry(1,1,1,64));shore.scale.set(7.35,.14,6.35);surface('pond',13.5,11.5,12,1,.10);
 for(let i=0;i<42;i++){const a=i*Math.PI/21;if(a>2.65&&a<3.65)continue;b(g,[.25+(i%4)*.11,.14+(i%3)*.07,.35],[12+7.02*Math.cos(a),.10,1+6.03*Math.sin(a)],i%2?0xbdb6a1:stone,softCube).rotation.y=a;}
 const reeds=new PlantBatch();for(let i=0;i<32;i++){const a=i*Math.PI/16;if(a>2.65&&a<3.65)continue;const x=12+7.18*Math.cos(a),z=1+6.15*Math.sin(a);for(let j=0;j<4;j++){reeds.stem(0x68845b,[x,0,z],[x+.06*j,.28+.10*j,z+.03*j],.012);reeds.blade(0x839d64,[x,.14,z],[.045,.27,.04],a,.50);}}reeds.attach(root,'Azure shoreline reeds');
 b(g,[1.8,.12,2.4],[5.3,.12,1],oak);for(let i=0;i<8;i++)b(g,[1.76,.035,.26],[5.3,.20,-.03+i*.29],oak);for(const z of [-.02,2.02])b(g,[.12,.62,.12],[5.87,.42,z],oak);
 batchRigidParts(g,true);
 const screenCanvas=document.createElement('canvas');screenCanvas.width=256;screenCanvas.height=144;const ctx=screenCanvas.getContext('2d')!;const tex=new THREE.CanvasTexture(screenCanvas);tex.colorSpace=THREE.SRGBColorSpace;r.textures.push(tex);const screenMat=new THREE.MeshBasicMaterial({map:tex});r.materials.push(screenMat);const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.84,1.48),screenMat);screen.position.set(-7,1.55,-9.66);root.add(screen);let lastFrame=-2;
 const waiter=marketCashier(r,{title:'Официант',color:0x344c50,shirt:0xf8efdf,animated:true});waiter.visible=false;root.add(waiter);const tray=new THREE.Group();tray.position.set(0,.96,.36);waiter.add(tray);b(tray,[.58,.04,.35],[0,0,0],ink,softCube);for(const x of [-.15,.15]){b(tray,[.22,.025,.22],[x,.035,0],cream,drum);b(tray,[.18,.075,.18],[x,.075,0],stone,softCube);}batchRigidParts(tray,true);
 const plates=new Map<string,THREE.Group>();for(const meal of Object.keys(RESORT_MEAL_DISHES) as ResortMeal[])for(const role of ['vlad','alina'] as const){const group=new THREE.Group();group.name='Served '+meal+' '+role;group.visible=false;group.position.set(-8+(role==='vlad'?-.80:.80),1.01,.4);for(let i=0;i<3;i++){const dish=new THREE.Group();dish.position.set(i===0?0:i===1?-.30:.30,0,i===0?.12:-.22);selectIndoorDish(dish,RESORT_MEAL_DISHES[meal][i]);group.add(dish);}root.add(group);plates.set(meal+role,group);}
 const skewers=new Map<ResortGrill,THREE.Group>();for(const [id,d] of Object.entries(RESORT_GRILL)){const group=new THREE.Group();group.position.set(-13,1.10,.6);for(let i=0;i<4;i++){const x=-.48+i*.30;b(group,[.025,.025,.70],[x,0,0],stone);for(let j=0;j<4;j++){const z=-.21+j*.14;b(group,[.14,.085,.11],[x,.045,z],d.color,softCube);b(group,[.11,.008,.018],[x,.090,z],0x644331);}}batchRigidParts(group,true);group.visible=false;root.add(group);skewers.set(id as ResortGrill,group);}
 let night=0,lastProgress=-1,from=0,lastKey='';return {animate:(t:number)=>{water.forEach(m=>updateWater(m,t,night));const users=root.userData.resortWaterUsers as {x:number;z:number;y:number}[]|undefined;for(const [i,mesh] of ripples.children.entries()){const u=users?.[Math.floor(i/4)],p=(t*.69+i*.25)%1;mesh.visible=!!u;if(u){mesh.position.set(u.x,u.y+.008,u.z);mesh.scale.setScalar(.24+p*.73);rippleMats[i].opacity=.30*(1-p);}}const active=!!root.userData.resortJacuzzi;for(const [i,mesh] of jets.children.entries()){const p=(t*1.1+i*.061)%1,a=i*Math.PI/8;mesh.visible=active;mesh.position.set(-8+Math.cos(a)*(.75+p*.24),.536+p*.08,6+Math.sin(a)*(.75+p*.24));}const play=root.userData.resortMedia as {id:string;started:number;match?:ConsoleMatch}|undefined,media=resortMedia(play?.id),elapsed=play?Math.max(0,t-play.started):0,frame=media?Math.floor(elapsed*12):-1;if(frame!==lastFrame){lastFrame=frame;if(media?.game)drawConsoleFrame(ctx,media.game,elapsed,play?.match);else if(media?.selection)drawNamedMedia(ctx,media.selection,elapsed);else{ctx.fillStyle='#192b32';ctx.fillRect(0,0,256,144);ctx.fillStyle='#c8e3dc';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText('ЛАЗУРНЫЙ БЕРЕГ',128,61);ctx.font='12px sans-serif';ctx.fillText('NETFLIX  ·  NINTENDO',128,90);}tex.needsUpdate=true;}const service=root.userData.resortService as ReturnType<typeof resortService>;const key=service?.key??'';if(key!==lastKey){lastProgress=-1;lastKey=key;}if(service&&service.progress!==lastProgress){lastProgress=service.progress;from=t;}waiter.visible=!!service&&!service.served; if(waiter.visible&&service){const p=Math.min(.99,service.progress+Math.max(0,t-from)/12);const x=-14+4.4*p,z=3.25-1.10*p;waiter.position.set(x,.04+Math.abs(Math.sin(t*7))*.035,z);waiter.rotation.y=Math.PI/2+.24;const arms=waiter.userData.motion.arms as THREE.Group[];for(const arm of arms)arm.rotation.x=-.19;}
 for(const [id,group] of plates)group.visible=!!service?.served&&service.remaining.some(role=>id===service.meal+role);const grilling=Object.values(root.userData.resortGrill??{});for(const [id,group] of skewers)group.visible=grilling.includes(id);},setNight:(n:boolean)=>{night=n?1:0;}};
}
export function resortStation(s:Station,r:Resources){
 const g=new THREE.Group(),b=kit();void r;g.position.set(s.center.x,0,s.center.z);g.name=s.name;
 const f=s.action.kind==='resort'?s.action.facility:'exit';
 if(f==='bar'){b(g,[4.3,.14,3.8],[0,.06,0],stone);b(g,[4.4,.15,3.8],[0,2.65,-.8],oak);for(const x of [-2,2])b(g,[.15,2.65,.15],[x,1.32,-1.7],ink);for(let i=0;i<3;i++){b(g,[3.0,.07,.45],[0,1.20+i*.42,-1.55],oak);for(let j=0;j<8;j++){const x=-1.24+j*.35,y=1.38+i*.42;b(g,[.16,.27,.15],[x,y,-1.55],[0x54765d,0x805241,0x9d8b63,0x476879][(i+j)%4],drum);b(g,[.065,.085,.065],[x,y+.16,-1.55],ink,drum);}}}
 if(f==='reception'||f==='bar'){b(g,[s.width,.98,s.depth],[0,.49,0],oak);b(g,[s.width+.12,.09,s.depth+.12],[0,1.04,0],stone);for(let i=0;i<7;i++)b(g,[.12,.29,.12],[-.9+i*.30,1.23,-.12],[0x698a68,0x966b4c,0x4e7893][i%3],drum);}
 if(f==='pets'){for(const [i,x] of [-.60,.60].entries()){b(g,[.95,.11,.73],[x,.17,-.17],i?0xbcb2a0:oak,softCube);b(g,[.78,.09,.58],[x,.23,-.17],cream,softCube);b(g,[.23,.075,.23],[x-.18,.16,.47],ink,drum);b(g,[.23,.075,.23],[x+.18,.16,.47],blue,drum);}}
 if(f==='bed'){b(g,[2.8,.38,2.65],[0,.28,0],oak,softCube);b(g,[2.66,.25,2.5],[0,.60,0],cream,softCube);b(g,[2.7,.14,1.82],[0,.80,.29],sage,softCube);for(const x of [-.65,.65])b(g,[.95,.18,.52],[x,.81,-.83],cream,softCube);b(g,[2.9,1.18,.15],[0,.74,-1.35],oak,softCube);}
 if(f==='media'){b(g,[3.3,.52,.62],[0,.26,-.8],oak);b(g,[3.02,1.65,.13],[0,1.55,-.77],0x19262d,softCube);b(g,[2.85,1.49,.02],[0,1.55,-.68],0x466678);const console=buildConsoleModel('console-switch2');console.position.set(.9,.53,-.72);console.scale.setScalar(1.35);g.add(console);b(g,[3.2,.35,1.02],[0,.29,1.1],cream,softCube);b(g,[3.2,.53,.26],[0,.67,1.58],sage,softCube);for(const x of [-1.4,1.4])b(g,[.33,.55,.95],[x,.52,1.1],cream,softCube);}
 if(f==='terrace'){b(g,[2.8,.10,1.25],[0,.80,0],oak);for(const x of [-1.15,1.15])for(const z of [-.46,.46])b(g,[.09,.78,.09],[x,.39,z],ink);for(const x of [-.8,.8])for(const z of [-1.12,1.12]){b(g,[.65,.10,.64],[x,.45,z],cream,softCube);b(g,[.65,.48,.12],[x,.69,z+Math.sign(z)*.30],oak);for(const dx of [-.22,.22])b(g,[.06,.45,.06],[x+dx,.22,z],oak);}for(const x of [-.8,.8]){b(g,[.38,.025,.38],[x,.868,0],cream,drum);b(g,[.11,.16,.11],[x+.3,.93,-.2],blue,drum);}}
 if(f==='grill'){b(g,[1.45,.48,.75],[0,.8,0],ink,softCube);for(const x of [-.58,.58])b(g,[.09,.77,.09],[x,.39,0],ink);for(let i=0;i<10;i++)b(g,[.035,.035,.68],[-.62+i*.14,1.06,0],stone);b(g,[.65,.07,.74],[1.05,1.03,0],oak);}
 if(f==='bath'){b(g,[1.25,.85,.62],[0,.43,0],oak);b(g,[1.3,.16,.68],[0,.90,0],cream,softCube);b(g,[.08,.23,.08],[0,1.10,-.18],ink,drum);b(g,[.83,.80,.06],[0,1.65,-.31],blue);}
 if(f==='kitchen'){b(g,[2.1,.88,.65],[0,.44,0],sage);b(g,[2.2,.10,.72],[0,.92,0],stone);}
 if(f==='exit'){for(const x of [-1.4,1.4])b(g,[.22,2.8,.22],[x,1.4,0],oak);b(g,[3.1,.42,.24],[0,2.72,0],ink);}
 if(f==='pool'||f==='lake'||f==='jacuzzi'){b(g,[.32,.08,.32],[0,.08,s.depth/2+.1],cream);}
 batchRigidParts(g,true);return g;
}
