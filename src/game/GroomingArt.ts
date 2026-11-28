import * as THREE from 'three';
import {cube,softCube,drum,orb,finish,batchRigidParts,type XYZ} from './ArtKit';
import {marketCashier} from './MarketArt';
import {lettering} from './LocationArt';
import {groomingStage,type GroomAction,type GroomStage} from '../shared/grooming';
import type {Station} from '../shared/locations';
type Resources={textures:THREE.Texture[];materials:THREE.Material[]};
const oak=0xc39c75,cream=0xf5ebda,teal=0x6da4a0,ink=0x38545c;
function kit(){const cache=new Map<number,THREE.MeshStandardMaterial>();return (p:THREE.Object3D,size:XYZ,pos:XYZ,color:number,geo:THREE.BufferGeometry=cube)=>{let mat=cache.get(color);if(!mat){mat=finish(color,'wood');cache.set(color,mat);}const mesh=new THREE.Mesh(geo,mat);mesh.scale.set(...size);mesh.position.set(...pos);mesh.receiveShadow=true;p.add(mesh);return mesh;};}
export const groomAnchor=(stage:GroomStage)=>stage==='wash'?{x:-.55,y:.75,z:-1.7}:{x:.48,y:.82,z:-1.7};
export function buildGrooming(root:THREE.Group,r:Resources){
 const g=new THREE.Group(),b=kit();root.add(g);g.name='Пушистый люкс';
 b(g,[12,.24,10],[0,-.13,0],cream);
 for(let i=0;i<12;i++)for(let j=0;j<10;j++)b(g,[.985,.012,.985],[-5.5+i,.005,-4.5+j],(i+j)%2?0xd9e8e3:0xe8efea);
 b(g,[12,2.85,.18],[0,1.42,-5],teal);b(g,[.18,2.85,10],[-6,1.42,0],cream);
 for(let i=0;i<20;i++)b(g,[.06,2.55,.09],[-5.7+i*.60,1.37,-4.85],oak);
 lettering(g,r,[0,2.42,-4.78],4.7,.52,'ПУШИСТЫЙ ЛЮКС',['#f5ebda','#38545c']);
 for(const x of [-4,0,4]){b(g,[2.1,1.12,.08],[x,1.35,-4.72],0xb8d7d4);b(g,[2.25,.12,.55],[x,.74,-4.53],oak);for(let j=0;j<7;j++){b(g,[.16,.27,.15],[x-.80+j*.26,.95,-4.51],[teal,cream,0xe5b68f][j%3],drum);b(g,[.07,.06,.07],[x-.80+j*.26,1.11,-4.51],ink,drum);}}
 b(g,[2.1,.75,.70],[3.6,.38,-3.3],oak,softCube);for(let j=0;j<5;j++)b(g,[.32,.09,.43],[2.9+j*.35,.79,-3.3],j%2?teal:cream,softCube);
 for(const x of [-4.7,4.7]){b(g,[.48,.46,.48],[x,.23,-2.8],cream,drum);for(let j=0;j<6;j++)b(g,[.18,.6,.16],[x+Math.sin(j)*.19,.67,-2.8+Math.cos(j)*.19],teal,orb);}
 batchRigidParts(g,true);
 const staff=marketCashier(r,{title:'Грумер',color:teal,shirt:cream,animated:true});staff.position.set(.48,0,-2.45);staff.rotation.y=0;root.add(staff);
 const motion=staff.userData.motion as {head:THREE.Group;arms:THREE.Group[]};
 const tools=new Map<GroomStage,THREE.Group>();for(const stage of ['wash','dry','brush','paws'] as const){const tool=new THREE.Group();tool.position.set(.172,-.236,.274);motion.arms[1].add(tool);tools.set(stage,tool);
 b(tool,[.055,.16,.055],[0,0,.03],ink,softCube);
 if(stage==='wash'){b(tool,[.10,.06,.10],[0,.08,.05],0xb3cacc,drum);}
 if(stage==='dry'){b(tool,[.17,.085,.075],[0,.08,.09],teal,softCube);b(tool,[.08,.055,.055],[0,.08,.21],ink);}
 if(stage==='brush'){b(tool,[.11,.045,.15],[0,.07,.07],oak,softCube);for(let i=0;i<5;i++)b(tool,[.01,.035,.01],[-.04+i*.02,.035,.09],ink);}
 if(stage==='paws')for(const x of [-.025,.025])b(tool,[.025,.08,.025],[x,.10,.045],0xb5c6c8,softCube);
 tool.visible=false;}
 const bubbles=new THREE.Group();root.add(bubbles);for(let i=0;i<16;i++){const m=b(bubbles,[.06,.06,.06],[-.7+(i%4)*.1,1.05,-1.85+Math.floor(i/4)*.1],0xe9f9ff,orb);m.material=new THREE.MeshStandardMaterial({color:0xe9f9ff,transparent:true,opacity:.65});r.materials.push(m.material);}
 return (t:number)=>{const a=root.userData.groomAction as {action:GroomAction;started:number}|undefined,stage=a?groomingStage(a.action,t-a.started):undefined;const anchor=stage?groomAnchor(stage):groomAnchor('brush');staff.position.set(anchor.x,0,-2.39);motion.head.rotation.x=stage?.19:0;for(const [i,arm] of motion.arms.entries()){arm.rotation.x=stage?-.25+.20*Math.sin(t*5+i):.03*Math.sin(t);arm.rotation.z=stage?(i?-.19:.19):0;}for(const [k,v] of tools)v.visible=stage===k;bubbles.visible=stage==='wash';for(const [i,p] of bubbles.children.entries())p.position.y=.95+((t*.27+i*.061)%1)*.52;};
}
export function groomingStation(s:Station,r:Resources){const g=new THREE.Group(),b=kit();g.position.set(s.center.x,0,s.center.z);g.name=s.name;
 if(s.id==='grooming-reception'){b(g,[2.1,.94,.85],[0,.47,0],oak,softCube);b(g,[2.18,.10,.9],[0,.98,0],cream);b(g,[.32,.29,.12],[.45,1.17,-.1],ink);lettering(g,r,[0,.64,.44],1.4,.24,'РЕСЕПШЕН',['#f5ebda','#38545c']);}
 if(s.id==='grooming-care'){b(g,[.94,.76,1.26],[-.55,.38,0],teal,softCube);b(g,[.80,.08,1.1],[-.55,.74,0],cream);for(const x of [-.99,-.11])b(g,[.10,.30,1.22],[x,.88,0],cream,softCube);b(g,[.83,.30,.10],[-.55,.88,-.58],cream,softCube);b(g,[.055,.55,.055],[-.90,1.1,-.54],ink,drum);
 b(g,[1.03,.10,1.22],[.48,.77,0],ink,softCube);b(g,[.98,.05,1.18],[.48,.845,0],teal,softCube);b(g,[.17,.68,.17],[.48,.36,0],ink,drum);b(g,[.82,.12,.82],[.48,.07,0],cream,softCube);}
 if(s.id==='grooming-wait'){b(g,[2.2,.36,.85],[0,.26,0],cream,softCube);b(g,[2.2,.49,.20],[0,.58,-.32],teal,softCube);for(const x of [-1,1])b(g,[.22,.47,.85],[x,.49,0],teal,softCube);}
 if(s.id==='grooming-exit'){for(const x of [-.62,.62])b(g,[.12,2.5,.14],[x,1.25,0],oak);b(g,[1.36,.18,.14],[0,2.5,0],oak);}
 batchRigidParts(g,true);return g;}
