import * as THREE from 'three';
import { NEIGHBORS, neighborPose, type NeighborAction, type NeighborProfile } from '../shared/neighbors';
import { GAME_MINUTES_PER_REAL_SECOND } from '../shared/life';
import { batchRigidParts, cube, drum, finish, orb, softCube } from './ArtKit';

interface NeighborRig {
  root: THREE.Group;
  leftArm: THREE.Group; rightArm: THREE.Group;
  leftLeg: THREE.Group; rightLeg: THREE.Group;
  torso: THREE.Group; phone: THREE.Mesh;
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
  piece(torso,orb,p.skin,[.225,.268,.225],[0,1.69,.012]);
  makeHair(torso,p);
  for(const x of [-.080,.080])
    piece(torso,orb,0x302d2b,[.019,.023,.013],[x,1.704,.223]);
  piece(torso,orb,p.skin,[.032,.035,.046],[0,1.63,.243]);
  piece(torso,softCube,0x8b5850,[.057,.010,.008],[0,1.557,.22]);

  const limbs={
    leftArm:new THREE.Group(),rightArm:new THREE.Group(),
    leftLeg:new THREE.Group(),rightLeg:new THREE.Group(),
  };
  for(const [side,key] of [[-1,'leftArm'],[1,'rightArm']] as const) {
    const arm=limbs[key];
    arm.position.set(side*.333,1.40,0);
    piece(arm,softCube,p.clothes,[.16,p.outfit==='coat'?.44:.38,.19],[0,-.18,0]);
    piece(arm,orb,p.skin,[.085,.10,.095],[0,-.43,.02]);
    torso.add(arm);
  }
  if(p.accessory==='tote') {
    // Fabric shopping bag swings naturally with its owner's walking arm.
    piece(limbs.leftArm,softCube,p.accent,[.27,.29,.095],[-.065,-.65,.095]);
    for(const x of [-.16,.03])
      piece(limbs.leftArm,softCube,0x755d4f,[.035,.22,.045],[x,-.44,.095]);
  }
  for(const [side,key] of [[-1,'leftLeg'],[1,'rightLeg']] as const) {
    const leg=limbs[key];
    leg.position.set(side*.15,.76,0);
    piece(leg,softCube,p.trousers,[.18,.55,.205],[0,-.265,0]);
    piece(leg,softCube,index%2?0x353537:0x675447,[.20,.10,.34],[0,-.565,.074]);
    root.add(leg);
  }
  for(const limb of Object.values(limbs))batchRigidParts(limb,true);
  batchRigidParts(torso,true);
  const phone=piece(limbs.rightArm,cube,0x3a474c,[.095,.165,.022],[0,-.46,.07]);
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
  return {root,torso,phone,materials,...limbs};
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
      this.animateRig(rig,pose.action,seconds,i);
    }
  }

  private animateRig(rig:NeighborRig,action:NeighborAction,t:number,index:number):void {
    const stride=action==='walk'?.40:.04;
    const cadence=t*(5.8+index%3*.24)+index*.7;
    const wave=Math.sin(cadence);
    rig.leftLeg.rotation.x=wave*stride;
    rig.rightLeg.rotation.x=-wave*stride;
    rig.leftArm.rotation.x=-wave*stride*.65;
    rig.rightArm.rotation.x=wave*stride*.65;
    rig.leftArm.rotation.z=-.04;
    rig.rightArm.rotation.z=.04;
    rig.torso.position.y=action==='walk'?Math.abs(wave)*.019:Math.sin(t*1.2+index)*.009;
    rig.torso.rotation.z=Math.sin(t*.63+index)*.015;
    rig.phone.visible=action==='phone';
    if(action==='phone') {
      rig.rightArm.rotation.x=-1.09;
      rig.rightArm.rotation.z=-.30;
    } else if(action==='chat'||action==='wave') {
      rig.rightArm.rotation.z=-.48+Math.sin(t*4+index)*.25;
      rig.rightArm.rotation.x=-.53;
      rig.leftArm.rotation.x=Math.sin(t*2+index)*.15;
    } else if(action==='look') {
      rig.leftArm.rotation.x=-.15;
      rig.rightArm.rotation.x=.12;
    }
  }
}
