import { COURIER_INDEX, type CourierVisit } from '../shared/courier';
import { DISTRICT_OFFSET_Z } from '../shared/district';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { NEIGHBORS, neighborDoorOpen, neighborPose, parkNeighborPose } from '../shared/neighbors';
import { NEIGHBOR_BENCH_TOP, NEIGHBOR_HOMES } from '../shared/neighborHomes';
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

  update(gameMinute:number,camera?:THREE.Camera,excluded=-1):TrafficBody[] {
    this.group.visible=true;
    this.group.position.z=this.offset;
    const seconds=gameMinute/GAME_MINUTES_PER_REAL_SECOND;
    const traffic:TrafficBody[]=[];
    for(const [i,entry] of this.entries.entries()) {
      if(i===excluded){entry.mounted.visible=false;continue;}
      const pose=neighborPose(i,gameMinute);
      entry.mounted.visible=pose.visible;
      if(!pose.visible)continue;
      entry.seen=seconds;
      entry.mounted.position.set(pose.x,0,pose.z);
      entry.mounted.rotation.y=pose.yaw;
      if(pose.opacity>.35)traffic.push({position:{x:pose.x,z:pose.z+this.offset},
        clearance:.76,person:true,moving:pose.action==='walk'});
      const rig=entry.model;
      const distance=camera?Math.hypot(camera.position.x-pose.x,camera.position.z-pose.z-this.offset,camera.position.y*.40):0;
      if(!rig){if(distance<72)this.request(i,entry);continue;}
      rig.root.visible=true;
      const far=distance>29;
      if(far&&seconds-entry.stamp<.10&&seconds>=entry.stamp)continue;
      entry.stamp=seconds;
      setFade(rig,pose.opacity);
      this.animateRig(rig,pose.action,pose.gestureBlend,seconds,i,pose.gait??0,!!pose.carrying,pose.seat,pose.lookYaw);
    }
    const loaded=this.entries.filter(entry=>entry.model);
    if(camera&&loaded.length>10) {
      loaded.sort((a,b)=>a.seen-b.seen);
      for(const entry of loaded.slice(0,loaded.length-10))if(!entry.mounted.visible)this.dispose(entry);
    }
    for(const [i,door] of this.doors.entries())door.rotation.y=-1.08*neighborDoorOpen(i,gameMinute,NEIGHBORS.length);
    return traffic;
  }

  /** Four background park walkers when players enter the separate park
   * interior. The SAME GLB rigs are moved between scenes, never duplicated. */
  updatePark(gameMinute:number,camera?:THREE.Camera,excluded=-1):TrafficBody[] {
    this.group.visible=true;
    const seconds=gameMinute/GAME_MINUTES_PER_REAL_SECOND;
    const traffic:TrafficBody[]=[];
    this.group.position.z=0;
    for(const [i,entry] of this.entries.entries()){
      if(i===excluded){entry.mounted.visible=false;continue;}
      const pose=parkNeighborPose(i,gameMinute);
      entry.mounted.visible=pose.visible;
      if(!pose.visible)continue;
      entry.seen=seconds;
      entry.mounted.position.set(pose.x,0,pose.z);
      entry.mounted.rotation.y=pose.yaw;
      if(pose.opacity>.35)traffic.push({position:{x:pose.x,z:pose.z},
        clearance:.76,person:true,moving:pose.action==='walk'});
      const rig=entry.model;
      if(!rig){
        const d=camera?Math.hypot(camera.position.x-pose.x,camera.position.z-pose.z,camera.position.y*.35):0;
        if(d<42)this.request(i,entry);
        continue;
      }
      rig.root.visible=true;
      setFade(rig,pose.opacity);
      this.animateRig(rig,pose.action,pose.gestureBlend,seconds,i,pose.gait??0);
    }
    return traffic;
  }

  updateCourier(gameMinute:number,visit:CourierVisit|null):TrafficBody[]{
    this.group.visible=!!visit;this.group.position.z=0;
    for(const [i,entry] of this.entries.entries())entry.mounted.visible=!!visit&&i===COURIER_INDEX;
    if(!visit)return [];
    const entry=this.entries[COURIER_INDEX],seconds=gameMinute/GAME_MINUTES_PER_REAL_SECOND;
    entry.mounted.position.set(visit.x,0,visit.z);entry.mounted.rotation.y=visit.yaw;
    if(!entry.model)this.request(COURIER_INDEX,entry);
    else{
      const rig=entry.model;rig.root.visible=true;setFade(rig,1);
      this.animateRig(rig,visit.walking?'walk':'look',visit.waiting?.5:0,seconds,COURIER_INDEX,visit.walking?1:0,visit.carrying);
    }
    return [{position:{x:visit.x,z:visit.z},clearance:.68,person:true,moving:visit.walking}];
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

  private animateRig(rig:NeighborRig,action:NeighborAction,blend:number,t:number,index:number,walking:number,carrying=false,seated=0,lookYaw=0):void {
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

    // The rig's hip dimensions differ across the cast. Sit on the wood slats
    // and solve the shin angle from the floor, then level the feet.
    const hipHeight=rig.leftLeg.position.y;
    const seatedHip=NEIGHBOR_BENCH_TOP+.113;
    const thigh=Math.abs(rig.leftKnee.position.y);
    const shin=Math.abs(rig.leftFoot.position.y);
    const footHeight=hipHeight-thigh-shin;
    const hipAngle=-Math.acos(THREE.MathUtils.clamp((seatedHip-footHeight-shin*.98)/thigh,.02,.82));
    const shinAngle=Math.acos(THREE.MathUtils.clamp((seatedHip-footHeight-thigh*Math.cos(hipAngle))/shin,0,1));
    const kneeAngle=shinAngle-hipAngle;
    rig.root.position.y=(seatedHip-hipHeight)*seated;
    rig.root.position.z=.09*seated;
    rig.leftLeg.rotation.x=leftHip+hipAngle*seated;
    rig.rightLeg.rotation.x=rightHip+hipAngle*seated;
    rig.leftKnee.rotation.x=leftBend+kneeAngle*seated;
    rig.rightKnee.rotation.x=rightBend+kneeAngle*seated;
    rig.leftFoot.rotation.x=-leftBend*.65-leftHip*.28-shinAngle*seated;
    rig.rightFoot.rotation.x=-rightBend*.65-rightHip*.28-shinAngle*seated;

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
    } else if(action==='sitRead') {
      const pageTurn=Math.sin(t*.46+index)*.09;
      lx=THREE.MathUtils.lerp(lx,-.63,blend);
      rx=THREE.MathUtils.lerp(rx,-.69+pageTurn,blend);
      le=THREE.MathUtils.lerp(le,-1.12,blend);
      re=THREE.MathUtils.lerp(re,-1.08,blend);
      headX=THREE.MathUtils.lerp(headX,.13+Math.sin(t*.39+index)*.028,blend);
      headY=THREE.MathUtils.lerp(headY,.02,blend);
    } else if(action==='sitPhone') {
      rx=THREE.MathUtils.lerp(rx,-.67,blend);
      re=THREE.MathUtils.lerp(re,-1.16,blend);
      lx=THREE.MathUtils.lerp(lx,-.18,blend);
      le=THREE.MathUtils.lerp(le,-.23,blend);
      headX=THREE.MathUtils.lerp(headX,.18,blend);
      headY=THREE.MathUtils.lerp(headY,-.09+Math.sin(t*.27)*.025,blend);
    } else if(action==='sitSip') {
      const sip=(Math.sin(t*.62+index)+1)*.5;
      rx=THREE.MathUtils.lerp(rx,-.42-.16*sip,blend);
      re=THREE.MathUtils.lerp(re,-.85-.29*sip,blend);
      headX=THREE.MathUtils.lerp(headX,.08,blend);
    } else if(action==='sitChat') {
      const speaker=THREE.MathUtils.smoothstep(.5+.5*Math.sin(t*.51+index*2),.4,.67);
      const emphasis=speaker*Math.max(0,Math.sin(t*1.1+index));
      rx=THREE.MathUtils.lerp(rx,-.30-.26*emphasis,blend);
      re=THREE.MathUtils.lerp(re,-.44-.32*emphasis,blend);
      lx=THREE.MathUtils.lerp(lx,-.18,blend);
      le=THREE.MathUtils.lerp(le,-.25,blend);
      headX=THREE.MathUtils.lerp(headX,(1-speaker)*Math.sin(t*.71)*.033,blend);
      headY=THREE.MathUtils.lerp(headY,.15+Math.sin(t*.29)*.035,blend);
      rig.torso.rotation.x-=blend*.035;
    } else if(action==='sitRest') {
      lx=THREE.MathUtils.lerp(lx,.11,blend);
      rx=THREE.MathUtils.lerp(rx,.11,blend);
      headY=THREE.MathUtils.lerp(headY,Math.sin(t*.32+index)*.10,blend);
      rig.torso.rotation.x-=blend*.07;
    } else if(action==='prepareGrill'||action==='grill') {
      const flip=action==='grill'?Math.sin(t*1.18+index)*.23:0;
      rx=THREE.MathUtils.lerp(rx,-.58+flip,blend);
      re=THREE.MathUtils.lerp(re,-.75-.15*Math.abs(flip),blend);
      lx=THREE.MathUtils.lerp(lx,-.30,blend);
      le=THREE.MathUtils.lerp(le,-.35,blend);
      headX=THREE.MathUtils.lerp(headX,.15,blend);
      rig.torso.rotation.x+=blend*.034;
    } else if(action==='taste'){
      rx=THREE.MathUtils.lerp(rx,-.51,blend);
      re=THREE.MathUtils.lerp(re,-1.11,blend);
      headX=THREE.MathUtils.lerp(headX,.065,blend);
    } else if(action==='tend'||action==='prune'||action==='harvest'){
      const work=Math.sin(t*(action==='prune'?1.45:1.2)+index)*.11;
      rx=THREE.MathUtils.lerp(rx,-.72+work,blend);
      re=THREE.MathUtils.lerp(re,-.62,blend);
      lx=THREE.MathUtils.lerp(lx,-.32,blend);
      le=THREE.MathUtils.lerp(le,-.45,blend);
      headX=THREE.MathUtils.lerp(headX,.21,blend);
      rig.torso.rotation.x+=blend*.10;
    } else if(action==='photograph') {
      rx=THREE.MathUtils.lerp(rx,-.83,blend);
      lx=THREE.MathUtils.lerp(lx,-.82,blend);
      re=THREE.MathUtils.lerp(re,-1.36,blend);
      le=THREE.MathUtils.lerp(le,-1.33,blend);
      headX=THREE.MathUtils.lerp(headX,-.065,blend);
    } else if(action==='checkWatch') {
      lx=THREE.MathUtils.lerp(lx,-.80,blend);
      le=THREE.MathUtils.lerp(le,-.97,blend);
      headX=THREE.MathUtils.lerp(headX,.16,blend);
      headY=THREE.MathUtils.lerp(headY,.13,blend);
    } else if(action==='laugh'||action==='listen'){
      headX=THREE.MathUtils.lerp(headX,action==='laugh'?-.11:.06,blend);
      headY=THREE.MathUtils.lerp(headY,Math.sin(t*.92+index)*.07,blend);
      rig.torso.rotation.x-=blend*(action==='laugh'?.05:.013);
      rx=THREE.MathUtils.lerp(rx,-.19,blend);
      re=THREE.MathUtils.lerp(re,-.31,blend);
    } else if(action==='greet'){
      rx=THREE.MathUtils.lerp(rx,-.30,blend);
      rz=THREE.MathUtils.lerp(rz,-1.28,blend);
      re=THREE.MathUtils.lerp(re,-.38,blend);
      headY=THREE.MathUtils.lerp(headY,.06,blend);
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
    if (lookYaw) rig.head.rotation.y=THREE.MathUtils.clamp(rig.head.rotation.y+lookYaw,-.38,.38);

    rig.phone.visible=(action==='phone'||action==='sitPhone'||action==='photograph')&&blend>.10;
    rig.book.visible=action==='sitRead'&&blend>.12;
    rig.tongs.visible=(action==='grill'||action==='prepareGrill')&&blend>.12;
    rig.trowel.visible=(action==='tend'||action==='prune')&&blend>.12;
    rig.basket.visible=action==='harvest'&&blend>.12;
    rig.wateringCan.visible=action==='water'&&blend>.12;
    rig.wateringCan.rotation.z=-.25-.3*Math.sin(t*1.2);
    rig.cup.visible=(action==='sip'||action==='sitSip'||action==='taste')&&blend>.12;
    rig.letter.visible=action==='mail'&&blend>.12;
    rig.marketBag.visible=carrying||action==='carry'&&blend>.12;
    rig.tote.visible=profile.accessory==='tote' && (carrying||action==='chat'&&blend>.1);

    // A quick eyelid closure once every few seconds. No new geometries or
    // textures are allocated per frame.
    const blinkPeriod=3.45+(index%4)*.56;
    const blinkPhase=THREE.MathUtils.euclideanModulo(t+index*.87,blinkPeriod);
    const blink=blinkPhase<.155 ? Math.sin(Math.PI*blinkPhase/.155) : 0;
    paintNeighborExpression(rig.face,blink,
      action==='chat'||action==='sitChat'||action==='laugh'||action==='greet'?
        blend*(.42+.23*Math.sin(t*2.1+index)):action==='sitRead'?.08:.05);
  }
}
