import * as THREE from 'three';
import {orb,finish} from './ArtKit';
import type {CharacterRig,Pivots} from './CharacterArt';
import type {CharacterId} from '../shared/protocol';

const block=new THREE.BoxGeometry(1,1,1);
// Authored, opaque mosaic: no framebuffer readback, alpha blend, or uncensored body.
const pixels=new Uint8Array(8*8*4);
for(let i=0;i<64;i++){
 const c=[0xb8a99d,0xcabcb0,0x9c9b96,0xd7c9bc,0xb5b7b3,0xaea49b][(i*17+Math.floor(i/8)*3+(i%5)*7)%6];
 pixels.set([c>>16,(c>>8)&255,c&255,255],i*4);
}
const texture=new THREE.DataTexture(pixels,8,8,THREE.RGBAFormat);
texture.colorSpace=THREE.SRGBColorSpace;
texture.minFilter=texture.magFilter=THREE.NearestFilter;
texture.needsUpdate=true;
const mosaic=new THREE.MeshBasicMaterial({map:texture,transparent:false,opacity:1,depthWrite:true});
const isBelow=(o:THREE.Object3D,parent:THREE.Object3D)=>{for(let p:THREE.Object3D|null=o;p;p=p.parent)if(p===parent)return true;return false;};

/** Presentation-only bathing look. The rig, state, purchased outfits and
 * animation contacts stay untouched. There is deliberately no naked body asset. */
export class BathPrivacy{
 private readonly parts:THREE.Object3D[]=[];
 private readonly originals:THREE.Object3D[]=[];
 private readonly saved=new Map<THREE.Object3D,boolean>();
 private active=false;
 private built=false;
 constructor(private figure:THREE.Group,private rig:CharacterRig,private joints:Pivots,private role:CharacterId,private authored:boolean){
  figure.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   if(authored){
    if(o.userData.garmentId||o.userData.bathAccessory||o.name==='Small gold hoops')this.originals.push(o);
   }else if(!isBelow(o,rig.head)&&!rig.wrists.some(w=>isBelow(o,w)))this.originals.push(o);
  });
 }
 private build(){
  if(this.built)return;this.built=true;
  const {rig,joints}=this;
  const skin=finish(this.role==='vlad'?0xdca789:0xe9b79b,'skin');
  const add=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,position:number[],scale:number[],name:string)=>{
   const m=new THREE.Mesh(geometry,material);m.name=name;m.userData.bathPrivacy=true;
   m.position.set(position[0],position[1],position[2]);m.scale.set(scale[0],scale[1],scale[2]);
   m.visible=false;parent.add(m);this.parts.push(m);
  };
  // Only an opaque non-anatomical block exists where the torso would be.
  add(rig.chest,block,mosaic,[0,rig.waistY+.24,.015],[.65,.78,.46],'Bath mosaic torso');
  // Individual opaque lap blocks follow the animated thighs, including seated poses.
  for(const leg of [joints.leftLeg,joints.rightLeg])
   add(leg,block,mosaic,[0,-rig.thighLength*.40,0],[.32,rig.thighLength+.16,.39],'Bath mosaic lap');
  // Neutral, stylized limb surfaces preserve the silhouette and hand contacts
  // where the approved clothing assets also provide limb geometry.
  for(const arm of [joints.leftArm,joints.rightArm])
   add(arm,orb,skin,[0,-rig.upperArm*.47,0],[.076,rig.upperArm*.58,.073],'Bath upper arm');
  if(!this.authored)for(const elbow of rig.elbows)
   add(elbow,orb,skin,[0,-rig.lowerArm*.48,0],[.056,rig.lowerArm*.57,.054],'Bath forearm');
  for(const knee of rig.knees)
   add(knee,orb,skin,[0,-rig.shinLength*.47,0],[.068,rig.shinLength*.59,.069],'Bath shin');
  for(const ankle of rig.ankles)
   add(ankle,orb,skin,[0,-.035,.051],[.074,.052,.118],'Bath bare foot');
 }
 set(enabled:boolean){
  if(enabled===this.active)return;
  if(enabled){
   this.build();
   this.active=true;
   // Conceal actual clothes and temporary SPA feet. Keep exact prior flags.
   const hide=(o:THREE.Object3D)=>{if(!this.saved.has(o))this.saved.set(o,o.visible);o.visible=false;};
   for(const o of this.originals)hide(o);
   this.figure.traverse(o=>{
    if(o.userData.spaFoot||o.userData.garmentId)hide(o);
    if(o.userData.bodyRegion==='forearms'){
     if(!this.saved.has(o))this.saved.set(o,o.visible);
     o.visible=true;
    }
   });
   for(const o of this.parts)o.visible=true;
  }else{
   // Restore before the next render; no geometry or outfit ownership changes.
   for(const [o,visible] of this.saved)o.visible=visible;
   this.saved.clear();
   for(const o of this.parts)o.visible=false;
   this.active=false;
  }
 }
 qa(){return {active:this.active,covered:this.parts.filter(o=>o.visible&&o.name.startsWith('Bath mosaic')).length,garments:this.originals.filter(o=>o.visible).length,parts:this.parts.length};}
}
