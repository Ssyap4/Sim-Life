import { DISTRICT_OFFSET_Z } from '../shared/district';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { NEIGHBORS, neighborDoorOpen, neighborPose } from '../shared/neighbors';
import { NEIGHBOR_HOMES } from '../shared/neighborHomes';
import { GAME_MINUTES_PER_REAL_SECOND } from '../shared/life';
import type { NeighborAction } from '../shared/neighbors';
import { createNeighborModel, paintNeighborExpression, type NeighborRig } from './NeighborModel';
import type { TrafficBody } from './ResidentFlow';

export function neighborAsset(index:number):string {
  const file=String(index+1).padStart(2,'0');
  return new URL(`../assets/neighbors/neighbor-${file}.glb`,import.meta.url).href;
}

interface Entry {model:NeighborRig|null; mounted:THREE.Group; loading:boolean; failed:boolean; stamp:number; seen:number}

function setFade(rig:NeighborRig,alpha:number):void {
  const transparent=alpha<.995;
  for(const material of rig.materials) {
    if(material.transparent!==transparent) {
      material.transparent=transparent;
      material.depthWrite=!transparent;
      material.needsUpdate=true;
    }
    material.opacity=alpha;
  }
}

/** The schedule is shared with the server. GPU artwork only loads on a visit. */
export class NeighborPeople {
  readonly group=new THREE.Group();
  private readonly loader=new GLTFLoader();
  private readonly entries:Entry[]=NEIGHBORS.map(profile=>{
    const mounted=new THREE.Group();mounted.name=profile.name;
    return {mounted,model:null,loading:false,failed:false,stamp:-Infinity,seen:-Infinity};
  });
  private doors:THREE.Group[]=[];
  private pending=0;

  constructor(private readonly offset=DISTRICT_OFFSET_Z) {
    this.group.position.z=this.offset;
    this.group.name='Прогуливающиеся соседи';
    this.group.add(...this.entries.map(entry=>entry.mounted));
    this.group.visible=false;
  }

  bindDoors(scene:THREE.Object3D):void {
    this.doors=NEIGHBOR_HOMES.map(home=>{
      const door=scene.getObjectByName('neighbor-door-'+home.id);
      if(!(door instanceof THREE.Group))throw new Error('Missing neighbor door '+home.id);
      return door;
    });
  }

  private request(index:number,entry:Entry):void {
    if(typeof window==='undefined'||this.pending>=2||entry.loading||entry.failed)return;
    entry.loading=true;
    this.pending++;
    void this.loader.loadAsync(neighborAsset(index)).then(asset=>this.mount(index,asset)).catch(error=>{
      entry.failed=true;
      console.warn('Neighbor model failed to load', NEIGHBORS[index].name,error);
    }).finally(()=>{
      entry.loading=false;this.pending--;
    });
  }

  mount(index:number,asset:GLTF):void {
    const entry=this.entries[index];
    if(entry.model)this.dispose(entry);
    const model=createNeighborModel(asset,index);
    model.root.visible=false;
    entry.mounted.add(model.root);
    entry.model=model;
  }

  update(gameMinute:number,camera?:THREE.Camera):TrafficBody[] {
    const seconds=gameMinute/GAME_MINUTES_PER_REAL_SECOND;
    const traffic:TrafficBody[]=[];
    for(const [i,entry] of this.entries.entries()) {
      const pose=neighborPose(i,gameMinute);
      entry.mounted.visible=pose.visible;
      if(!pose.visible)continue;
      entry.seen=seconds;
      entry.mounted.position.set(pose.x,0,pose.z);
      entry.mounted.rotation.y=pose.yaw;
      if(pose.opacity>.35)traffic.push({position:{x:pose.x,z:pose.z+this.offset},clearance:.76,person:true,moving:pose.action==='walk'});
      const rig=entry.model;
      const distance=camera?Math.hypot(camera.position.x-pose.x,camera.position.z-pose.z-this.offset,camera.position.y*.40):0;
      if(!rig){if(distance<72)this.request(i,entry);continue;}
      rig.root.visible=true;
      const far=distance>29;
      if(far&&seconds-entry.stamp<.10&&seconds>=entry.stamp)continue;
      entry.stamp=seconds;
      setFade(rig,pose.opacity);
      this.animateRig(rig,pose.action,pose.gestureBlend,seconds,i,pose.gait??0,!!pose.carrying);
    }
    const loaded=this.entries.filter(entry=>entry.model);
    if(camera&&loaded.length>10) {
      loaded.sort((a,b)=>a.seen-b.seen);
      for(const entry of loaded.slice(0,loaded.length-10))if(!entry.mounted.visible)this.dispose(entry);
    }
    for(const [i,door] of this.doors.entries())door.rotation.y=-1.08*neighborDoorOpen(i,gameMinute,NEIGHBORS.length);
    return traffic;
  }

  private dispose(entry:Entry):void {
    const model=entry.model;
    if(!model)return;
    const skins=model.root.getObjectsByProperty('isSkinnedMesh',true) as THREE.SkinnedMesh[];
    skins[0]?.skeleton.dispose();
    for(const mesh of skins)mesh.geometry.dispose();
    for(const material of model.materials)material.dispose();
    model.root.removeFromParent();entry.model=null;
  }

  private animateRig(rig:NeighborRig,action:NeighborAction,blend:number,t:number,index:number,walking:number,carrying=false):void {
    // A smaller stride plus knee flex and ankle roll replaces the old rigid,
    // marching legs. Every angle is computed from the shared game clock.
    const profile=NEIGHBORS[index];
    const phase=t*(6.0+.36*profile.speed)+index*1.37;
    const leftStep=Math.sin(phase);
    const rightStep=-leftStep;
    const sway=Math.sin(phase*.5);
    const leftHip=-leftStep*.27*walking;
    const rightHip=-rightStep*.27*walking;
    const leftBend=Math.max(0,leftStep)*.40*walking;
    const rightBend=Math.max(0,rightStep)*.40*walking;

    rig.leftLeg.rotation.x=leftHip;
    rig.rightLeg.rotation.x=rightHip;
    rig.leftKnee.rotation.x=leftBend;
    rig.rightKnee.rotation.x=rightBend;
    rig.leftFoot.rotation.x=-leftBend*.65-leftHip*.28;
    rig.rightFoot.rotation.x=-rightBend*.65-rightHip*.28;

    // Small spinal counter-rotation and breathing prevent a rigid full-body
    // shuffle while keeping the avatar vertical and the feet near the ground.
    rig.torso.position.y=Math.abs(leftStep)*.012*walking+
      Math.sin(t*1.65+index*.7)*.004;
    rig.torso.rotation.x=-.014*walking+Math.sin(t*.9+index)*.008;
    rig.torso.rotation.z=sway*.015*walking+Math.sin(t*.55+index)*.006;
    rig.torso.rotation.y=Math.sin(phase)*.018*walking;
    // Slight weight shifts during conversation, barely perceptible at distance.
    rig.torso.rotation.y+=blend*.022*Math.sin(t*.7+index*1.7);

    const leftSwing=leftStep*.17*walking;
    const rightSwing=rightStep*.17*walking;
    let lx=leftSwing,rx=rightSwing,lz=.045,rz=-.045;
    let le=.045,re=.045,lez=0,rez=0;
    let headX=Math.sin(t*.69+index)*.018;
    let headY=Math.sin(t*.44+index*.91)*.052;
    let headZ=Math.sin(t*.62+index)*.014;
    headX+=blend*.012*Math.sin(t*1.07+index*.73);
    headY+=blend*.025*Math.sin(t*.59+index);

    // Distinct, readable actions with nonexaggerated hand/head coordination.
    // All changes enter and exit through the deterministic gesture envelope.
    if(action==='phone') {
      rx=THREE.MathUtils.lerp(rx,-.70,blend);
      rz=THREE.MathUtils.lerp(rz,-.22,blend);
      re=THREE.MathUtils.lerp(re,-1.10,blend);
      lx=THREE.MathUtils.lerp(lx,-.44+Math.sin(t*3.1+index)*.055,blend);
      le=THREE.MathUtils.lerp(le,-.68,blend);
      headX=THREE.MathUtils.lerp(headX,.18,blend);
      headY=THREE.MathUtils.lerp(headY,-.10,blend);
    } else if(action==='chat') {
      // Take turns speaking and listening. Gesture bursts have a slow envelope
      // instead of every neighbor flapping both arms for half a minute.
      const turn=.5+.5*Math.sin(t*.42+index*2.1);
      const speaking=THREE.MathUtils.smoothstep(turn,.36,.67);
      const gesture=Math.max(0,Math.sin(t*1.45+index*1.9));
      const emphasis=speaking*(.20+.80*gesture);
      rx=THREE.MathUtils.lerp(rx,-.13-.39*emphasis,blend);
      re=THREE.MathUtils.lerp(re,-.24-.42*emphasis,blend);
      lx=THREE.MathUtils.lerp(lx,-.12-.19*emphasis,blend);
      le=THREE.MathUtils.lerp(le,-.17-.20*speaking,blend);
      rz=THREE.MathUtils.lerp(rz,-.06-.23*emphasis,blend);
      // Listener nods while the speaker leans in a little.
      const nod=(1-speaking)*Math.sin(t*1.04+index*.61)*.040;
      headX=THREE.MathUtils.lerp(headX,-.02+nod,blend);
      headY=THREE.MathUtils.lerp(headY,.050*Math.sin(t*.36+index),blend);
      rig.torso.rotation.x-=blend*(.012+.024*speaking);
      rig.torso.rotation.z+=blend*.018*Math.sin(t*.63+index);
    } else if(action==='admire') {
      // Quietly watch the water: relaxed shoulders, slow shifting stance and
      // a gentle sweep of the gaze; no phone or fake swimming animation.
      headY=THREE.MathUtils.lerp(headY,Math.sin(t*.26+index*.5)*.17,blend);
      headX=THREE.MathUtils.lerp(headX,-.06+Math.sin(t*.30+index)*.014,blend);
      lx=THREE.MathUtils.lerp(lx,-.09,blend);
      rx=THREE.MathUtils.lerp(rx,-.08,blend);
      lz=THREE.MathUtils.lerp(lz,.045,blend);
      rz=THREE.MathUtils.lerp(rz,-.045,blend);
      rig.torso.rotation.z+=blend*Math.sin(t*.27+index)*.012;
    } else if(action==='wave') {
      rx=THREE.MathUtils.lerp(rx,-.10,blend);
      rz=THREE.MathUtils.lerp(rz,-2.04,blend);
      re=THREE.MathUtils.lerp(re,-.30,blend);
      rez=THREE.MathUtils.lerp(rez,-.20+Math.sin(t*5.1)*.22,blend);
      headY=THREE.MathUtils.lerp(headY,-.10,blend);
      headZ=THREE.MathUtils.lerp(headZ,.045,blend);
    } else if(action==='look') {
      headY=THREE.MathUtils.lerp(headY,Math.sin(t*.76+index)*.33,blend);
      headX=THREE.MathUtils.lerp(headX,-.035,blend);
      lx=THREE.MathUtils.lerp(lx,-.12,blend);
      rx=THREE.MathUtils.lerp(rx,.08,blend);
    } else if(action==='adjust') {
      // One hand touches the opposite sleeve, as if fixing a cuff.
      lx=THREE.MathUtils.lerp(lx,-.42,blend);
      lz=THREE.MathUtils.lerp(lz,.44,blend);
      le=THREE.MathUtils.lerp(le,-.98+Math.sin(t*4)*.055,blend);
      rx=THREE.MathUtils.lerp(rx,-.20,blend);
      re=THREE.MathUtils.lerp(re,-.20,blend);
      headX=THREE.MathUtils.lerp(headX,.11,blend);
      headY=THREE.MathUtils.lerp(headY,.17,blend);
    } else if(action==='water') {
      // Lean toward the flowerbed and tip a real watering can.
      lx=THREE.MathUtils.lerp(lx,-.36,blend);
      rx=THREE.MathUtils.lerp(rx,-.60+Math.sin(t*1.3)*.065,blend);
      re=THREE.MathUtils.lerp(re,-.59,blend);
      rz=THREE.MathUtils.lerp(rz,-.32,blend);
      headX=THREE.MathUtils.lerp(headX,.19,blend);
      headY=THREE.MathUtils.lerp(headY,.13,blend);
    } else if(action==='sip') {
      // Cup rises to the mouth for a few sips, then relaxes slightly.
      const sip=.5+.5*Math.sin(t*.88+index);
      rx=THREE.MathUtils.lerp(rx,-.38-sip*.15,blend);
      re=THREE.MathUtils.lerp(re,-1.01-sip*.15,blend);
      rz=THREE.MathUtils.lerp(rz,-.22,blend);
      headX=THREE.MathUtils.lerp(headX,.08+sip*.025,blend);
      lx=THREE.MathUtils.lerp(lx,-.16,blend);
    } else if(action==='mail') {
      rx=THREE.MathUtils.lerp(rx,-.48,blend);
      re=THREE.MathUtils.lerp(re,-.83,blend);
      rz=THREE.MathUtils.lerp(rz,-.18,blend);
      headX=THREE.MathUtils.lerp(headX,.18,blend);
      headY=THREE.MathUtils.lerp(headY,.06*Math.sin(t*.6+index),blend);
    } else if(action==='carry') {
      lx=THREE.MathUtils.lerp(lx,-.19,blend);
      le=THREE.MathUtils.lerp(le,-.20,blend);
      headY=THREE.MathUtils.lerp(headY,-.13,blend);
    } else if(action==='stretch') {
      // Brief shoulder stretch, deliberately subtler than a workout animation.
      lz=THREE.MathUtils.lerp(lz,1.15,blend);
      rz=THREE.MathUtils.lerp(rz,-1.15,blend);
      lx=THREE.MathUtils.lerp(lx,-.14,blend);
      rx=THREE.MathUtils.lerp(rx,-.14,blend);
      le=THREE.MathUtils.lerp(le,-.18,blend);
      re=THREE.MathUtils.lerp(re,-.18,blend);
      headX=THREE.MathUtils.lerp(headX,-.09,blend);
      headZ=THREE.MathUtils.lerp(headZ,.055,blend);
      rig.torso.rotation.x-=blend*.025;
    }

    rig.leftArm.rotation.set(lx,0,lz);
    rig.rightArm.rotation.set(rx,0,rz);
    rig.leftElbow.rotation.set(le,0,lez);
    rig.rightElbow.rotation.set(re,0,rez);
    rig.head.rotation.set(headX,headY,headZ);
    rig.phone.visible=action==='phone'&&blend>.10;
    rig.wateringCan.visible=action==='water'&&blend>.12;
    rig.wateringCan.rotation.z=-.25-.3*Math.sin(t*1.2);
    rig.cup.visible=action==='sip'&&blend>.12;
    rig.letter.visible=action==='mail'&&blend>.12;
    rig.marketBag.visible=carrying||action==='carry'&&blend>.12;
    rig.tote.visible=profile.accessory==='tote' && (carrying||action==='chat'&&blend>.1);

    // A quick eyelid closure once every few seconds. No new geometries or
    // textures are allocated per frame.
    const blinkPeriod=3.45+(index%4)*.56;
    const blinkPhase=THREE.MathUtils.euclideanModulo(t+index*.87,blinkPeriod);
    const blink=blinkPhase<.155 ? Math.sin(Math.PI*blinkPhase/.155) : 0;
    paintNeighborExpression(rig.face,blink,action==='chat'?blend*(.44+.20*Math.sin(t*2.7+index)):.05);
  }
}
