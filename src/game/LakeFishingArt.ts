import * as THREE from 'three';
import {drum,orb,finish} from './ArtKit';
import {LAKE_RODS,type LakeRod,type LakeFish} from '../shared/lake';
const specs={crucian:[.30,.16,.08,0xa99c53],perch:[.33,.115,.065,0x82904e],roach:[.28,.09,.055,0xb5c4ba],bream:[.39,.19,.075,0xb3a47e],carp:[.48,.20,.10,0xa48e52],pike:[.55,.09,.06,0x718051],trout:[.43,.12,.07,0x9ca8a4],zander:[.48,.115,.065,0x89968b],catfish:[.62,.12,.09,0x696b60]} as const;
const fishResources=new WeakMap<THREE.Group,{geometry:THREE.BufferGeometry;material:THREE.Material}>();
/** A catch owns one fin buffer and one material shared by its tail and dorsal fin.
 * The body uses globally cached ArtKit geometry and finishes. */
export function disposeLakeFish(group:THREE.Group):void {
 group.removeFromParent();
 const owned=fishResources.get(group);
 if(!owned)return;
 fishResources.delete(group);
 owned.geometry.dispose();owned.material.dispose();
 group.clear();
}
export function buildLakeFish(id:LakeFish){
 const [l,h,w,c]=specs[id],g=new THREE.Group();g.name='Lake fish '+id;
 function part(geo:THREE.BufferGeometry,color:number,scale:number[],pos:number[]){const m=new THREE.Mesh(geo,finish(color,'skin'));m.scale.set(scale[0],scale[1],scale[2]);m.position.set(pos[0],pos[1],pos[2]);g.add(m);return m;}
 part(orb,c,[l*.45,h*.5,w*.5],[0,0,0]);part(orb,0xd4cab0,[l*.33,h*.24,w*.42],[-.015,-h*.19,0]);
 const fin=new THREE.BufferGeometry();fin.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.13,.09,0,.105,0,0,.13,-.09,0],3));fin.setIndex([0,1,2,0,2,3]);fin.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({color:c,side:THREE.DoubleSide,roughness:.7});fishResources.set(g,{geometry:fin,material:mat});const tail=new THREE.Mesh(fin,mat);tail.position.x=l*.40;tail.scale.setScalar(l/.43);g.add(tail);
 const dorsal=new THREE.Mesh(fin,mat);dorsal.rotation.z=Math.PI/2;dorsal.position.set(.03,h*.34,0);dorsal.scale.setScalar(.6);g.add(dorsal);
 for(const side of [-1,1]){part(orb,0xe0d5aa,[.013,.013,.008],[-l*.31,h*.13,side*w*.43]);part(orb,0x222522,[.007,.008,.006],[-l*.314,h*.13,side*w*.49]);}
 if(['perch','pike','trout','zander'].includes(id))for(let i=0;i<6;i++)for(const side of [-1,1])part(orb,id==='trout'?0x7d4c43:0x54664a,[.012,.025,.004],[-l*.20+i*l*.075,h*.15,side*w*.43]);
 return g;
}
export class FishingProp{
 readonly group=new THREE.Group();
 readonly rod=new THREE.Group();
 private readonly segments:THREE.Mesh[]=[];
 private readonly line:THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>;
 private readonly bob:THREE.Group;
 private readonly points=new Float32Array(24);
 private readonly tip=new THREE.Vector3();
 private readonly dest=new THREE.Vector3();
 private readonly v=new THREE.Vector3();
 private readonly axis=new THREE.Vector3(0,1,0);
 constructor(readonly kind:LakeRod){
  this.group.add(this.rod);const length=kind==='float'?2.15:kind==='spin'?1.80:2.40;
  for(let i=0;i<8;i++){const m=new THREE.Mesh(drum,finish(i===0?0x665342:i%2?0x405549:0x343b38,'wood'));m.userData.length=length/8;this.rod.add(m);this.segments.push(m);}
  if(kind!=='float'){const reel=new THREE.Mesh(drum,finish(0x69716d,'metal'));reel.scale.set(.075,.055,.075);reel.rotation.z=Math.PI/2;reel.position.set(0,-.08,.22);this.rod.add(reel);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.points,3));this.line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xe6e1d3,transparent:true,opacity:.75}));this.line.frustumCulled=false;this.group.add(this.line);
  this.bob=new THREE.Group();for(const [y,c] of [[.025,0xe45b3a],[-.025,0xf4e8d1]]){const m=new THREE.Mesh(orb,finish(c,'wood'));m.position.y=y;m.scale.set(.026,.043,.026);this.bob.add(m);}this.group.add(this.bob);
 }
 frame(t:number,root:THREE.Object3D,grip:THREE.Vector3){
  const seconds=LAKE_RODS[this.kind].seconds,p=Math.min(1,t/seconds);
  const cast=Math.sin(Math.PI*Math.min(1,t/2.1)),reel=THREE.MathUtils.smoothstep(p,.79,.92),pull=Math.sin(t*5)*reel;
  this.rod.position.copy(this.group.worldToLocal(grip.clone()));this.rod.rotation.set(-.31-cast*.95-reel*.42+pull*.10,0,0);
  let prev=new THREE.Vector3(0,0,0);
  for(let i=0;i<this.segments.length;i++){const m=this.segments[i],len=m.userData.length,k=(i+1)/8;
   const next=new THREE.Vector3(0,-(.07+reel*.30)*k*k,len*(i+1));this.v.copy(next).sub(prev);m.position.copy(prev).addScaledVector(this.v,.5);m.quaternion.setFromUnitVectors(this.axis,this.v.clone().normalize());const r=i===0?.025:.014*(1-k)+.004;m.scale.set(r,this.v.length(),r);prev=next;}
  this.rod.updateWorldMatrix(true,false);this.tip.copy(this.rod.localToWorld(prev));const distance=THREE.MathUtils.lerp(3.1+(this.kind==='feeder'?1:0),1.25,reel);this.dest.set(0,.036+Math.sin(t*3)*.008,distance*Math.min(1,t/2.1));root.localToWorld(this.dest);this.dest.y=.036-(p>.74&&p<.81?.04*Math.sin(t*7)**2:0);
  this.group.worldToLocal(this.tip);this.group.worldToLocal(this.dest);for(let i=0;i<8;i++){const k=i/7;this.v.copy(this.tip).lerp(this.dest,k);this.v.y-=Math.sin(k*Math.PI)*.17*(1-reel);this.v.toArray(this.points,i*3);}
  this.line.geometry.attributes.position.needsUpdate=true;this.bob.position.copy(this.dest);this.bob.visible=this.kind==='float'&&t>1;
 }
 dispose(){this.group.removeFromParent();this.line.geometry.dispose();this.line.material.dispose();}
}
