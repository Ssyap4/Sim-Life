import * as THREE from 'three';
import {paintedMap} from './ArtKit';

export function hookahPhase(time:number,leads:boolean){
 const phase=((time+(leads?0:3))%12+12)%12;
 const raise=THREE.MathUtils.smoothstep(phase,1.8,3.7)*(1-THREE.MathUtils.smoothstep(phase,5.3,6.6));
 return {phase,raise,exhale:phase-6.7};
}
/** A small fixed pool of soft billboards. No physics, lights or geometry churn. */
export class LoungeSmoke extends THREE.Group{
 private readonly puffs:THREE.Sprite[]=[];
 private readonly origin=new THREE.Vector3();
 private readonly direction=new THREE.Vector3();
 constructor(){
  super();this.name='Lounge exhaled smoke';this.visible=false;
  const map=paintedMap('lounge-breath-smoke-0511',96,96,ctx=>{
   for(const [x,y,r,a] of [[48,48,42,.53],[29,46,23,.32],[59,29,25,.28],[65,61,23,.30]]){
    const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(239,244,246,'+a+')');g.addColorStop(.45,'rgba(239,244,246,'+(a*.65)+')');g.addColorStop(1,'rgba(239,244,246,0)');
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);
   }
  });
  for(let i=0;i<7;i++){
   const material=new THREE.SpriteMaterial({map,color:0xffffff,transparent:true,opacity:0,depthWrite:false});
   const puff=new THREE.Sprite(material);puff.visible=false;puff.raycast=()=>{};this.puffs.push(puff);this.add(puff);
  }
 }
 updateExhale(age:number,mouth:THREE.Vector3,forward:THREE.Vector3){
  this.visible=age>=0&&age<3.7;
  if(!this.visible)return;
  // Convert the live mouth location and direction to this actor's local space.
  this.origin.copy(mouth);this.direction.copy(mouth).add(forward);this.worldToLocal(this.origin);this.worldToLocal(this.direction);this.direction.sub(this.origin).normalize();
  for(let i=0;i<this.puffs.length;i++){
   const puff=this.puffs[i],t=age-i*.22;
   puff.visible=t>=0&&t<2.35;if(!puff.visible)continue;
   const fade=Math.min(1,t/.16)*(1-THREE.MathUtils.smoothstep(t,.65,2.35));
   puff.position.copy(this.origin).addScaledVector(this.direction,.055+t*.34);
   puff.position.y+=t*.18+.035*Math.sin(t*2+i);
   puff.position.x+=Math.sin(i*2.4+t*2)*t*.065;
   const size=.11+t*.23+(i%3)*.035;puff.scale.set(size*1.12,size,1);
   puff.material.opacity=.76*fade;puff.material.rotation=i*1.7+t*.27;
  }
 }
 get activePuffs(){return this.visible?this.puffs.filter(p=>p.visible).length:0;}
}
