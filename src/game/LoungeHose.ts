import * as THREE from 'three';
const RINGS=25,SIDES=6,RADIUS=.014;
// One reusable mesh, no geometry allocations in the animation loop.
export class LoungeHose extends THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>{
 private readonly curve=new THREE.CubicBezierCurve3();
 private readonly center=new THREE.Vector3();
 private readonly tangent=new THREE.Vector3();
 private readonly normal=new THREE.Vector3();
 private readonly binormal=new THREE.Vector3();
 private readonly axis=new THREE.Vector3(0,1,0);
 constructor(){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(RINGS*SIDES*3),3).setUsage(THREE.DynamicDrawUsage));
  const indices:number[]=[];
  for(let i=0;i<RINGS-1;i++)for(let j=0;j<SIDES;j++){
   const a=i*SIDES+j,b=i*SIDES+(j+1)%SIDES,c=a+SIDES,d=b+SIDES;indices.push(a,b,c,b,d,c);
  }
  g.setIndex(indices);super(g,new THREE.MeshBasicMaterial({color:0x303638,side:THREE.DoubleSide}));
  this.name='Lounge flexible hose';this.frustumCulled=false;this.visible=false;this.raycast=()=>{};
 }
 updatePath(start:THREE.Vector3,lowA:THREE.Vector3,lowB:THREE.Vector3,end:THREE.Vector3){
  this.curve.v0.copy(start);this.curve.v1.copy(lowA);this.curve.v2.copy(lowB);this.curve.v3.copy(end);
  const pos=this.geometry.attributes.position;
  for(let i=0;i<RINGS;i++){
   const t=i/(RINGS-1);this.curve.getPoint(t,this.center);this.curve.getTangent(t,this.tangent);
   this.normal.crossVectors(this.tangent,this.axis);
   if(this.normal.lengthSq()<.00001)this.normal.set(1,0,0);
   this.normal.normalize();this.binormal.crossVectors(this.tangent,this.normal).normalize();
   for(let j=0;j<SIDES;j++){
    const a=2*Math.PI*j/SIDES,cs=Math.cos(a)*RADIUS,sn=Math.sin(a)*RADIUS;
    pos.setXYZ(i*SIDES+j,this.center.x+cs*this.normal.x+sn*this.binormal.x,this.center.y+cs*this.normal.y+sn*this.binormal.y,this.center.z+cs*this.normal.z+sn*this.binormal.z);
   }
  }
  pos.needsUpdate=true;
 }
}
