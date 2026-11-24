import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { fitWardrobe, outfitChoices } from './Wardrobe';
import { inspectionFrame } from './InspectionFrame';
import type { CharacterId } from '../shared/protocol';

/** Isolated fitting display, shares model geometry/materials and the existing renderer. */
export class FittingStage {
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.PerspectiveCamera(40,1,.05,30);
 private readonly model:THREE.Object3D;
 private readonly bounds=new THREE.Box3();
 private angle=0;
 constructor(source:THREE.Object3D,private readonly role:CharacterId){
  this.scene.background=new THREE.Color(0xe2ded7);
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x8c817a,2.1));
  const key=new THREE.DirectionalLight(0xfff3e5,2.6);key.position.set(3,5,4);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xdde9ff,1.25);fill.position.set(-4,3,-3);this.scene.add(fill);
  this.model=clone(source);this.model.position.set(0,0,0);this.model.rotation.set(0,0,0);this.model.visible=true;
  this.scene.add(this.model);
 }
 wear(look:string){
  fitWardrobe(this.model,this.role,outfitChoices(look));
  this.scene.updateMatrixWorld(true);
  this.bounds.makeEmpty();
  this.model.traverseVisible(o=>{
   if(o instanceof THREE.Mesh){
    if(o instanceof THREE.SkinnedMesh){o.skeleton.update();o.computeBoundingBox();}
    else if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
    const b=o instanceof THREE.SkinnedMesh?o.boundingBox:o.geometry.boundingBox;
    if(b)this.bounds.union(b.clone().applyMatrix4(o.matrixWorld));
   }
  });
  if(this.bounds.isEmpty())this.bounds.set(new THREE.Vector3(-.3,0,-.3),new THREE.Vector3(.3,1.8,.3));
 }
 rotate(angle:number){this.angle=angle;}
 frame(width:number,height:number,bottom:number){
  this.camera.aspect=Math.max(.1,width/Math.max(1,height));
  this.camera.updateProjectionMatrix();
  const direction=new THREE.Vector3(Math.sin(this.angle),.07,Math.cos(this.angle));
  const f=inspectionFrame(this.bounds,direction,this.camera.fov,this.camera.aspect,{top:.035,bottom:THREE.MathUtils.clamp(bottom,.35,.95)});
  this.camera.position.copy(f.position);this.camera.lookAt(f.target);this.camera.updateMatrixWorld(true);
 }
 dispose(){
  const skeletons=new Set<THREE.Skeleton>();
  this.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skeletons.add(o.skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();
  this.scene.clear();
 }
}
