import * as THREE from 'three';
import {cube,drum,finish,paintedMap,batchRigidParts} from './ArtKit';
import {ROOMS,coveringById,type Covering,type RenovationState,type RenovationPreview,type RoomId} from '../shared/renovation';
import {lampLevel} from '../shared/furniture';
export const ceilingAnchors:Record<RoomId,[number,number]>={bedroom:[-6.5,-3.95],spare:[-7,.2],wc:[-7.3,3.35],kitchen:[2.39,-2.22],living:[-2.36,1],office:[7.1,-4.4],bathroom:[7.6,2.5],wing1:[12.62,-5.35],wing2:[12.62,-1.3],wing3:[12.62,3.1]};
export function buildCeilingModel(p:Covering){
 const root=new THREE.Group(),metal=finish(p.pattern==='globe'||p.pattern==='crystal'?0xb59360:0x454947,'metal');
 const glass=new THREE.MeshStandardMaterial({color:p.color,emissive:p.color,emissiveIntensity:.3,roughness:.65});
 const piece=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const a=new THREE.Mesh(g,m);a.position.set(x,y,z);a.scale.set(g===drum?w*.5:w,h,g===drum?d*.5:d);root.add(a);return a;};
 const sphere=p.pattern==='globe'||p.pattern==='crystal'?new THREE.SphereGeometry(.5,12,8):cube,ring=p.pattern==='ring'?new THREE.TorusGeometry(.36,.028,8,32):cube;
 piece(drum,metal,0,.39,0,.30,.055,.30);
 if(p.pattern==='flush'){piece(drum,metal,0,.31,0,.72,.10,.72);piece(drum,glass,0,.24,0,.65,.085,.65);}
 if(p.pattern==='ring'){for(const x of [-.24,.24]){piece(drum,metal,x,.26,0,.018,.25,.018);const t=piece(ring,glass,x,.13,0,1.1,1.1,1.1);t.rotation.x=Math.PI/2;}}
 if(p.pattern==='pendant'){piece(cube,metal,0,.37,0,1.15,.06,.12);for(const [i,x] of [-.43,0,.43].entries()){const y=.12-i*.045;piece(drum,metal,x,(.35+y)/2,0,.018,.35-y,.018);piece(drum,glass,x,y,0,.28,.20,.28);piece(drum,metal,x,y+.10,0,.13,.06,.13);}}
 if(p.pattern==='globe'){piece(drum,metal,0,.18,0,.035,.30,.035);for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.cos(a)*.37,z=Math.sin(a)*.37;const rod=piece(cube,metal,x/2,.12,z/2,.40,.025,.025);rod.rotation.y=-a;piece(sphere,glass,x,.10,z,.25,.25,.25);}}
 if(p.pattern==='rail'){piece(cube,metal,0,.32,0,1.08,.09,.13);for(const x of [-.36,0,.36]){const m=piece(drum,metal,x,.20,0,.16,.20,.16);m.rotation.z=x*.6;const l=piece(drum,glass,x,.10,0,.14,.035,.14);l.rotation.z=x*.6;}}
 if(p.pattern==='crystal'){piece(drum,metal,0,.25,0,.72,.05,.72);for(let i=0;i<12;i++){const a=i*Math.PI*2/12;piece(new THREE.OctahedronGeometry(.5),glass,Math.cos(a)*.30,.09+(i%2)*.05,Math.sin(a)*.30,.095,.24,.095);}piece(sphere,glass,0,.08,0,.25,.25,.25);}
 const sources=new Set(root.children.filter(o=>o instanceof THREE.Mesh).map(o=>(o as THREE.Mesh).geometry));
 batchRigidParts(root);const kept=new Set(root.children.filter(o=>o instanceof THREE.Mesh).map(o=>(o as THREE.Mesh).geometry));
 for(const g of sources)if(g!==cube&&g!==drum&&!kept.has(g))g.dispose();
 root.userData.glass=glass;root.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});return root;
}
export function buildRoomCeilings(scene:THREE.Scene){
 const root=new THREE.Group();root.name='Room ceiling replacements';scene.add(root);
 const models=new Map<RoomId,{sku:string;model:THREE.Group;pool:THREE.Mesh;material:THREE.MeshBasicMaterial}>();
 const map=paintedMap('room-ceiling-pool',64,64,ctx=>{const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,215,146,.65)');g.addColorStop(1,'rgba(255,215,146,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);});
 const active=new Map<RoomId,{level:number;x:number;z:number}>();
 function dispose(m:THREE.Group){m.removeFromParent();const glass=m.userData.glass as THREE.Material;glass.dispose();const geos=new Set<THREE.BufferGeometry>();m.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry!==cube&&o.geometry!==drum)geos.add(o.geometry);});geos.forEach(g=>g.dispose());}
 let signature='';
 return {root,active,apply(state:RenovationState|undefined,preview:RenovationPreview|undefined,night:number){
 const key=JSON.stringify([state?.surfaces,state?.lights,preview,Math.round(night*100)]);if(key===signature)return;signature=key;active.clear();
 for(const r of ROOMS){const p=coveringById(preview?.room===r.id&&coveringById(preview.sku)?.kind==='ceiling'?preview.sku:state?.surfaces[r.id]?.ceiling);let m=models.get(r.id);
 if(!p||p.kind!=='ceiling'){if(m){dispose(m.model);m.pool.removeFromParent();m.pool.geometry.dispose();m.material.dispose();models.delete(r.id);}continue;}
 const [x,z]=ceilingAnchors[r.id];
 if(!m||m.sku!==p.id){if(m){dispose(m.model);m.pool.removeFromParent();m.pool.geometry.dispose();m.material.dispose();}
 const model=buildCeilingModel(p);model.position.set(x,2.65,z);root.add(model);
 const material=new THREE.MeshBasicMaterial({map,transparent:true,opacity:0,depthWrite:false,color:p.color});const pool=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(4.5,r.x2-r.x1-.25),Math.min(4.5,r.z2-r.z1-.25)),material);pool.position.set(x,.045,z);pool.rotation.x=-Math.PI/2;pool.raycast=()=>{};root.add(pool);m={sku:p.id,model,pool,material};models.set(r.id,m);}
 const level=preview?.room===r.id&&preview.sku===p.id?1:lampLevel(state?.lights?.[r.id],night);m.model.userData.glass.emissiveIntensity=level*1.35;m.material.opacity=level*.65;m.pool.visible=level>.04;active.set(r.id,{level,x,z});
 }
 },has:(room:RoomId)=>models.has(room),camera(eye:THREE.Vector3,target:THREE.Vector3,preview?:RenovationPreview){for(const [id,m] of models){const r=ROOMS.find(r=>r.id===id)!;m.model.visible=preview?.room===id&&coveringById(preview.sku)?.kind==='ceiling'||!(eye.y>4.5&&target.y<1.6&&target.x>=r.x1&&target.x<=r.x2&&target.z>=r.z1&&target.z<=r.z2);}}};
}
