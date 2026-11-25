import * as THREE from 'three';
import {cube,drum,softCube,finish,batchRigidParts} from './ArtKit';
import {painted} from './LocationArt';
type Resources={textures:THREE.Texture[];materials:THREE.Material[]};
export function buildSpaWater(parent:THREE.Group,w:number,d:number,jacuzzi:boolean,resources:Resources){
 const root=new THREE.Group();root.name='SPA aquatic fixture';parent.add(root);
 const h=jacuzzi?.88:.34,waterY=h-.09,iw=w-.38,id=d-.38;
 const box=(size:number[],pos:number[],color:number,geom:THREE.BufferGeometry=cube)=>{const m=new THREE.Mesh(geom,finish(color,'ceramic'));m.scale.set(size[0],size[1],size[2]);m.position.set(pos[0],pos[1],pos[2]);root.add(m);return m;};
 box([w,.16,d],[0,.06,0],0x367b88);
 for(const side of [-1,1]){
  box([.18,h,d],[side*(w/2-.09),h/2,0],0x91bbc0);
  box([w,h,.18],[0,h/2,side*(d/2-.09)],0x91bbc0);
  box([.25,.075,d+.08],[side*(w/2-.10),h+.025,0],0xe9e0ca);
  box([w-.35,.075,.25],[0,h+.025,side*(d/2-.10)],0xe9e0ca);
 }
 const mosaic=painted(resources,256,256,ctx=>{
  ctx.fillStyle='#729fa6';ctx.fillRect(0,0,256,256);
  const tones=['#3797a6','#55a9b5','#70b8bd','#428d9d','#65a5b1'];
  for(let z=0;z<16;z++)for(let x=0;x<16;x++){ctx.fillStyle=tones[(x*17+z*13+x*z)%5];ctx.fillRect(x*16+1,z*16+1,14,14);}
 });
 if(mosaic){mosaic.wrapS=mosaic.wrapT=THREE.RepeatWrapping;mosaic.repeat.set(iw/2,id/2);}
 const bottomMat=new THREE.MeshStandardMaterial({map:mosaic,color:mosaic?0xffffff:0x50a8b4,roughness:.72});resources.materials.push(bottomMat);
 const bottom=new THREE.Mesh(new THREE.PlaneGeometry(iw,id),bottomMat);bottom.rotation.x=-Math.PI/2;bottom.position.y=.145;root.add(bottom);
 if(jacuzzi){for(const x of [-.70,.70]){box([.96,.14,.67],[x,.30,-.60],0xb8d9d8,softCube);box([.96,.34,.15],[x,.49,-.95],0xb8d9d8,softCube);}}
 else{
  // Entry steps are within the pool footprint, away from both swimming lanes.
  for(let i=0;i<3;i++)box([.88,.07+i*.07,.30],[0,.18+i*.035,d/2-.35-i*.30],0xc7d7cc);
  for(const x of [-.53,.53]){box([.045,.76,.045],[x,.58,d/2-.20],0xd3e0df,drum);box([.045,.045,.36],[x,.95,d/2-.25],0xd3e0df);}
 }
 const ripple=painted(resources,256,256,ctx=>{
  ctx.clearRect(0,0,256,256);ctx.lineWidth=1.6;
  for(let k=0;k<15;k++){ctx.strokeStyle='rgba(215,251,245,.18)';ctx.beginPath();for(let x=0;x<=256;x+=4){const y=k*18+5*Math.sin(x/256*Math.PI*4+k*1.7)+3*Math.sin(x/256*Math.PI*8+k);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
 });
 if(ripple){ripple.wrapS=ripple.wrapT=THREE.RepeatWrapping;ripple.repeat.set(iw/3,id/3);}
 const waterMat=new THREE.MeshStandardMaterial({color:0x7bcdd1,map:null,roughness:.25,metalness:.08,transparent:true,opacity:.43,depthWrite:false,emissive:0x286f79,emissiveIntensity:.17});resources.materials.push(waterMat);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(iw,id),waterMat);water.name='SPA water surface';water.rotation.x=-Math.PI/2;water.position.y=waterY;root.add(water);
 const ripMat=new THREE.MeshBasicMaterial({map:ripple,color:0xe1ffff,transparent:true,opacity:ripple?.75:.05,depthWrite:false});resources.materials.push(ripMat);
 const waves=new THREE.Mesh(new THREE.PlaneGeometry(iw,id),ripMat);waves.rotation.x=-Math.PI/2;waves.position.y=waterY+.004;root.add(waves);
 const bubbleMat=new THREE.MeshBasicMaterial({color:0xd9ffff,transparent:true,opacity:.45,depthWrite:false});resources.materials.push(bubbleMat);
 const bubbles=jacuzzi?new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),bubbleMat,56):null;
 if(bubbles){bubbles.name='SPA jacuzzi bubbles';bubbles.frustumCulled=false;root.add(bubbles);}
 const t=new THREE.Object3D();
 if(bubbles)bubbles.visible=false;
 root.userData.animate=(seconds:number,occupied:boolean)=>{
  if(ripple){ripple.offset.set((seconds*.025)%1,(seconds*.018)%1);}
  if(bubbles){bubbles.visible=occupied; if(occupied){for(let i=0;i<bubbles.count;i++){const p=(seconds*.85+i*.173)%1;const a=i*2.399963;const r=.25+(i%9)*.055;t.position.set((i%2?-.72:.72)+Math.cos(a)*r,waterY-.10+p*.22,-.13+Math.sin(a)*r);t.scale.setScalar(.024+p*.032);t.updateMatrix();bubbles.setMatrixAt(i,t.matrix);}bubbles.instanceMatrix.needsUpdate=true;}}
 };
 batchRigidParts(root,true);
 return root;
}
