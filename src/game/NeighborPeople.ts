import * as THREE from 'three';
import { NEIGHBORS, neighborPose, type NeighborAction, type NeighborProfile } from '../shared/neighbors';
import { GAME_MINUTES_PER_REAL_SECOND } from '../shared/life';
import { batchRigidParts, cube, drum, finish, orb, softCube } from './ArtKit';

interface NeighborRig {
  root: THREE.Group;
  leftArm: THREE.Group; rightArm: THREE.Group;
  leftLeg: THREE.Group; rightLeg: THREE.Group;
  torso: THREE.Group; head: THREE.Group; eyelids: THREE.Mesh; phone: THREE.Mesh;
  leftElbow: THREE.Group; rightElbow: THREE.Group;
  leftKnee: THREE.Group; rightKnee: THREE.Group;
  leftFoot: THREE.Group; rightFoot: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

function piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry,
  color: number, scale: readonly [number,number,number],
  pos: readonly [number,number,number]) {
  const mesh = new THREE.Mesh(geometry,finish(color));
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function makeHair(torso: THREE.Group, person: NeighborProfile): void {
  const h=person.hair, a=person.accent;
  // All hairstyles are made from the same tiny procedural primitives; no
  // additional GLBs, texture downloads, bones or per-frame geometry rebuilds.
  piece(torso,orb,h,[.231,.132,.233],[0,1.881,-.020]);
  switch(person.hairStyle) {
    case 'buzz':
      piece(torso,orb,h,[.212,.047,.215],[0,1.867,.018]); break;
    case 'short':
      piece(torso,softCube,h,[.25,.092,.08],[.034,1.866,.170]); break;
    case 'swept':
      piece(torso,softCube,h,[.34,.115,.10],[-.052,1.866,.155]).rotation.z=.18;
      piece(torso,orb,h,[.13,.12,.09],[.18,1.86,-.02]); break;
    case 'bob':
      for(const x of [-.19,.19]) piece(torso,orb,h,[.135,.305,.15],[x,1.650,-.025]);
      piece(torso,softCube,h,[.30,.095,.08],[0,1.855,.184]); break;
    case 'long':
      piece(torso,softCube,h,[.36,.62,.115],[0,1.495,-.186]);
      for(const x of [-.19,.19]) piece(torso,orb,h,[.088,.35,.12],[x,1.586,-.06]);
      break;
    case 'ponytail':
      piece(torso,orb,h,[.18,.19,.18],[0,1.79,-.215]);
      piece(torso,orb,h,[.105,.27,.115],[0,1.56,-.31]);
      piece(torso,softCube,a,[.16,.05,.08],[0,1.76,-.31]); break;
    case 'bun':
      piece(torso,orb,h,[.168,.15,.17],[0,1.95,-.19]);
      piece(torso,softCube,h,[.24,.10,.08],[0,1.85,.17]); break;
    case 'curly':
      for(let n=0;n<7;n++) {
        const angle=n*Math.PI*2/7;
        piece(torso,orb,h,[.113,.135,.118],
          [Math.sin(angle)*.175,1.915+Math.cos(angle*2)*.025,Math.cos(angle)*.15]);
      }
      break;
    case 'cap':
      piece(torso,softCube,a,[.42,.135,.35],[0,1.899,.008]);
      piece(torso,softCube,a,[.36,.047,.18],[0,1.867,.25]); break;
    case 'braid':
      for(let n=0;n<4;n++)
        piece(torso,orb,h,[.083,.097,.097],[-.12,1.70-n*.16,-.25-n*.015]);
      piece(torso,softCube,h,[.28,.08,.06],[0,1.858,.169]); break;
  }
}

function dressTorso(torso:THREE.Group,person:NeighborProfile):void {
  const {clothes:c,accent:a,outfit} = person;
  piece(torso,softCube,c,[outfit==='coat'?.59:.54,.62,.31],[0,1.12,0]);
  piece(torso,softCube,person.trousers,[.45,.20,.29],[0,.78,0]);
  if (outfit==='dress') {
    piece(torso,drum,c,[.38,.30,.32],[0,.74,0]);
    piece(torso,softCube,a,[.44,.048,.33],[0,.86,0]);
  } else if(outfit==='coat') {
    piece(torso,softCube,c,[.61,.39,.36],[0,.73,0]);
    for(const side of [-1,1]) piece(torso,softCube,a,[.08,.45,.035],
      [side*.17,1.19,.179]).rotation.z=-side*.16;
  } else if(outfit==='hoodie') {
    piece(torso,orb,c,[.28,.25,.20],[0,1.50,-.14]);
    piece(torso,softCube,a,[.31,.17,.025],[0,.99,.174]);
    piece(torso,softCube,a,[.035,.21,.02],[0,1.36,.175]);
  } else if(outfit==='jacket') {
    for(const side of [-1,1]) piece(torso,softCube,a,[.10,.24,.025],
      [side*.115,1.36,.165]).rotation.z=side*.24;
    piece(torso,softCube,0xb5a692,[.025,.53,.022],[0,1.13,.177]);
  } else if(outfit==='sweater') {
    piece(torso,drum,a,[.17,.09,.16],[0,1.47,0]);
    piece(torso,softCube,a,[.48,.05,.31],[0,.86,0]);
  } else if(outfit==='shirt') {
    for(const side of [-1,1])
      piece(torso,softCube,a,[.15,.11,.025],[side*.083,1.42,.173]).rotation.z=side*.25;
    piece(torso,softCube,a,[.07,.07,.025],[.14,1.17,.173]);
  } else if(outfit==='vest') {
    piece(torso,softCube,a,[.40,.47,.335],[0,1.19,.018]);
    piece(torso,softCube,c,[.038,.47,.023],[0,1.19,.194]);
    piece(torso,softCube,c,[.28,.083,.022],[0,1.43,.199]);
  } else if(outfit==='overalls') {
    piece(torso,softCube,person.trousers,[.37,.32,.34],[0,1.02,.027]);
    for(const x of [-.15,.15])
      piece(torso,softCube,a,[.063,.45,.04],[x,1.34,.173]);
  }

  if(person.accessory==='backpack') {
    piece(torso,softCube,a,[.40,.52,.21],[0,1.12,-.245]);
    for(const x of [-.16,.16])
      piece(torso,softCube,person.trousers,[.05,.42,.055],[x,1.16,-.17]);
  }
}

function resident(index:number):NeighborRig {
  const p=NEIGHBORS[index];
  const root=new THREE.Group();
  root.name='Сосед: '+p.name;
  root.scale.setScalar(p.height);
  const torso=new THREE.Group();
  root.add(torso);
  dressTorso(torso,p);
  const neck=piece(torso,drum,p.skin,[.105,.15,.105],[0,1.51,0]);
  neck.rotation.x=.1;
  // Head pivots at the neck. Visuals retain their original facial positions
  // in a counter-translated group so rig proportions do not change.
  const head=new THREE.Group();
  head.name='neighbor-head';
  head.position.set(0,1.575,0);
  torso.add(head);
  const headVisual=new THREE.Group();
  headVisual.position.y=-1.575;
  head.add(headVisual);
  piece(headVisual,orb,p.skin,[.225,.268,.225],[0,1.69,.012]);
  makeHair(headVisual,p);
  for(const x of [-.080,.080])
    piece(headVisual,orb,0x302d2b,[.019,.023,.013],[x,1.704,.223]);
  piece(headVisual,orb,p.skin,[.032,.035,.046],[0,1.63,.243]);
  piece(headVisual,softCube,0x8b5850,[.057,.010,.008],[0,1.557,.22]);
  batchRigidParts(headVisual,true);
  // A movable skin-colored lid covers both eyes for brief natural blinks.
  const eyelids=piece(headVisual,softCube,p.skin,[.232,.002,.022],[0,1.705,.245]);
  eyelids.name='neighbor-eyelids';
  eyelids.visible=false;

  const limbs={
    leftArm:new THREE.Group(),rightArm:new THREE.Group(),
    leftLeg:new THREE.Group(),rightLeg:new THREE.Group(),
  };
  const elbows={ leftElbow:new THREE.Group(),rightElbow:new THREE.Group() };
  const knees={ leftKnee:new THREE.Group(),rightKnee:new THREE.Group() };
  const feet={ leftFoot:new THREE.Group(),rightFoot:new THREE.Group() };
  for(const [side,key,joint] of [
    [-1,'leftArm','leftElbow'],[1,'rightArm','rightElbow']
  ] as const) {
    const arm=limbs[key], elbow=elbows[joint];
    arm.name='neighbor-'+key;
    arm.position.set(side*.333,1.40,0);
    piece(arm,softCube,p.clothes,[.163,.345,.189],[0,-.155,0]);
    elbow.name='neighbor-'+joint;
    elbow.position.set(0,-.30,0);
    piece(elbow,softCube,p.clothes,[.147,.265,.175],[0,-.114,0]);
    piece(elbow,orb,p.skin,[.085,.10,.095],[0,-.263,.017]);
    arm.add(elbow);
    torso.add(arm);
  }
  if(p.accessory==='tote') {
    // Fabric shopping bag follows the swinging hand without clipping the torso.
    piece(elbows.leftElbow,softCube,p.accent,[.27,.29,.095],[-.065,-.44,.095]);
    for(const x of [-.16,.03])
      piece(elbows.leftElbow,softCube,0x755d4f,[.035,.22,.045],[x,-.252,.095]);
  }
  for(const [side,key,joint,footKey] of [
    [-1,'leftLeg','leftKnee','leftFoot'],[1,'rightLeg','rightKnee','rightFoot']
  ] as const) {
    const leg=limbs[key], knee=knees[joint], foot=feet[footKey];
    leg.name='neighbor-'+key;
    leg.position.set(side*.15,.76,0);
    piece(leg,softCube,p.trousers,[.178,.39,.20],[0,-.18,0]);
    knee.name='neighbor-'+joint;
    knee.position.set(0,-.36,0);
    piece(knee,softCube,p.trousers,[.164,.345,.19],[0,-.157,0]);
    foot.name='neighbor-'+footKey;
    foot.position.set(0,-.335,0);
    piece(foot,softCube,index%2?0x353537:0x675447,[.197,.10,.335],[0,-.035,.081]);
    knee.add(foot);
    leg.add(knee);
    root.add(leg);
  }
  for(const limb of Object.values(limbs))batchRigidParts(limb,true);
  for(const elbow of Object.values(elbows))batchRigidParts(elbow,true);
  for(const knee of Object.values(knees))batchRigidParts(knee,true);
  batchRigidParts(torso,true);
  const phone=piece(elbows.rightElbow,cube,0x3a474c,[.095,.165,.022],[0,-.275,.095]);
  phone.visible=false;

  // ArtKit.finish caches globally shared materials. Clone them ONCE for this
  // particular person before animating opacity; never fade household objects
  // or other neighbors that share the same material.
  const materials:THREE.MeshStandardMaterial[]=[];
  const copies=new Map<THREE.Material,THREE.MeshStandardMaterial>();
  root.traverse(child=>{
    if(!(child instanceof THREE.Mesh))return;
    const original=child.material as THREE.MeshStandardMaterial;
    let local=copies.get(original);
    if(!local) { local=original.clone(); copies.set(original,local); materials.push(local); }
    child.material=local;
  });
  return {root,torso,head,eyelids,phone,materials,...limbs,...elbows,...knees,...feet};
}

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

/** Visual-only neighborhood residents, synced from the shared game clock.
 * No physics pushes, task packets or saved progress are introduced. */
export class NeighborPeople {
  readonly group=new THREE.Group();
  private readonly rigs=NEIGHBORS.map((_,i)=>resident(i));

  constructor() {
    this.group.name='Прогуливающиеся соседи';
    for(const rig of this.rigs)this.group.add(rig.root);
    this.group.visible=false;
  }

  update(gameMinute:number):void {
    const seconds=gameMinute/GAME_MINUTES_PER_REAL_SECOND;
    for(const [i,rig] of this.rigs.entries()) {
      const pose=neighborPose(i,gameMinute);
      rig.root.visible=pose.visible;
      if(!pose.visible)continue;
      rig.root.position.set(pose.x,.03,pose.z);
      rig.root.rotation.y=pose.yaw;
      setFade(rig,pose.opacity);
      this.animateRig(rig,pose.action,pose.gestureBlend,seconds,i);
    }
  }

  private animateRig(rig:NeighborRig,action:NeighborAction,blend:number,t:number,index:number):void {
    // A smaller stride plus knee flex and ankle roll replaces the old rigid,
    // marching legs. Every angle is computed from the shared game clock.
    const profile=NEIGHBORS[index];
    const walking=1-blend;
    const phase=t*(5.35+.42*profile.speed)+index*1.37;
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

    const leftSwing=leftStep*.17*walking;
    const rightSwing=rightStep*.17*walking;
    let lx=leftSwing,rx=rightSwing,lz=.045,rz=-.045;
    let le=.045,re=.045,lez=0,rez=0;
    let headX=Math.sin(t*.69+index)*.018;
    let headY=Math.sin(t*.44+index*.91)*.052;
    let headZ=Math.sin(t*.62+index)*.014;

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
      const talk=Math.sin(t*2.7+index*1.65);
      rx=THREE.MathUtils.lerp(rx,-.24-.16*talk,blend);
      re=THREE.MathUtils.lerp(re,-.43-.22*Math.max(0,talk),blend);
      lx=THREE.MathUtils.lerp(lx,-.16+.11*talk,blend);
      le=THREE.MathUtils.lerp(le,-.28,blend);
      rz=THREE.MathUtils.lerp(rz,-.16-.10*Math.sin(t*.97+index),blend);
      headX=THREE.MathUtils.lerp(headX,.055*Math.sin(t*2.1+index),blend);
      headY=THREE.MathUtils.lerp(headY,.09*Math.sin(t*.8+index),blend);
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

    // A quick eyelid closure once every few seconds. No new geometries or
    // textures are allocated per frame.
    const blinkPeriod=3.45+(index%4)*.56;
    const blinkPhase=THREE.MathUtils.euclideanModulo(t+index*.87,blinkPeriod);
    const blink=blinkPhase<.155 ? Math.sin(Math.PI*blinkPhase/.155) : 0;
    rig.eyelids.visible=blink>.035;
    rig.eyelids.scale.y=Math.max(.0005,.071*blink);
  }
}
