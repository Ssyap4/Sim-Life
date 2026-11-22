import * as THREE from 'three';
import { NEIGHBORS, neighborPose, neighborDoorOpen, type NeighborAction, type NeighborProfile } from '../shared/neighbors';
import { GAME_MINUTES_PER_REAL_SECOND } from '../shared/life';
import { batchRigidParts, cube, drum, finish, orb, softCube, sculptedCurve } from './ArtKit';
import { makeEye } from './EyeArt';
import { loft, sculpt } from './SculptMesh';
import { NEIGHBOR_HOMES, REAR_WALK_Z } from '../shared/neighborHomes';

interface NeighborRig {
  root: THREE.Group;
  leftArm: THREE.Group; rightArm: THREE.Group;
  leftLeg: THREE.Group; rightLeg: THREE.Group;
  torso: THREE.Group; head: THREE.Group; eyelids: THREE.Mesh; phone: THREE.Mesh;
  leftElbow: THREE.Group; rightElbow: THREE.Group;
  leftKnee: THREE.Group; rightKnee: THREE.Group;
  leftFoot: THREE.Group; rightFoot: THREE.Group;
  wateringCan: THREE.Group; cup: THREE.Group; letter: THREE.Mesh;
  marketBag: THREE.Group; tote: THREE.Group;
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
      for(const side of [-1,1]) sculptedCurve(torso,[
        [side*.15,1.92,-.07],[side*.21,1.78,-.13],
        [side*.22,1.63,-.07],[side*.20,1.52,.006],
      ],.109,.044,h,.70,false);
      piece(torso,softCube,h,[.30,.082,.08],[0,1.856,.182]); break;
    case 'long':
      for(const side of [-1,1]) {
        sculptedCurve(torso,[
          [side*.16,1.94,-.10],[side*.22,1.74,-.17],
          [side*.19,1.48,-.16],[side*.20,1.25,-.15],
        ],.095,.022,h,.66,false);
        sculptedCurve(torso,[
          [side*.14,1.86,.10],[side*.18,1.69,.07],
          [side*.17,1.48,.10],[side*.19,1.30,.08],
        ],.060,.012,h,.62,false);
      }
      break;
    case 'ponytail':
      sculptedCurve(torso,[
        [0,1.86,-.15],[0,1.80,-.28],[.06,1.67,-.35],
        [.03,1.50,-.34],[-.035,1.38,-.28],
      ],.105,.018,h,.73,false);
      piece(torso,softCube,a,[.15,.065,.085],[0,1.81,-.28]); break;
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
      sculptedCurve(torso,[
        [-.085,1.88,-.13],[-.13,1.74,-.23],
        [-.17,1.56,-.27],[-.145,1.38,-.31],
        [-.115,1.23,-.27],
      ],.079,.014,h,.67,false);
      for(let n=0;n<5;n++)
        piece(torso,orb,h,[.045,.057,.05],
          [-.145+Math.sin(n*.7)*.024,1.67-n*.095,-.27-n*.01]);
      piece(torso,softCube,h,[.28,.08,.06],[0,1.858,.169]); break;
  }
}

function dressTorso(torso:THREE.Group,person:NeighborProfile):void {
  const {clothes:c,accent:a,outfit} = person;
  // Sculpted, gently tapered torso rather than a squared-off toy box.
  sculpt(torso,loft([
    [.755,.155,.123], [.85,.21,.143], [1.035,.245,.154],
    [1.285,outfit==='coat'?.285:.245,.163],
    [1.43,.192,.123], [1.49,.092,.075],
  ],20,18,(x,y,z,a)=>[x,y,z+.009*Math.cos(a*3+y*18)]),c,'fabric',false);
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

  // Wardrobe hardware and tailoring make silhouettes less interchangeable.
  // Batch the static details with the torso for stable mobile draw-call cost.
  if (['coat','jacket','vest','shirt'].includes(outfit)) {
    for (const y of [1.01,1.16,1.31]) {
      piece(torso,orb,0xd6bf92,[.013,.013,.010],[.019,y,.198]);
    }
    for (const s of [-1,1])
      piece(torso,softCube,a,[.065,.028,.019],[s*.154,1.13,.186]);
  }
  if(outfit==='sweater'||outfit==='hoodie') {
    for(const s of [-1,1])piece(torso,softCube,a,
      [.094,.041,.118],[s*.333,1.076,.014]);
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
  // Anatomical face profile, the same sculpt/eye technology as Vlad and
  // Alina. Each neighbor keeps a distinct skin, hair and iris palette.
  const face=new THREE.Group();
  face.position.set(0,1.695,0);
  headVisual.add(face);
  const cheek=new THREE.Color(p.skin).lerp(new THREE.Color(0xe7a18c),.18);
  const skin=new THREE.Color(p.skin);
  sculpt(face,loft([
    [-.238,.064,.085,.014],[-.185,.158,.126,.016],
    [-.102,.201,.178,.016],[-.014,.218,.212,.009],
    [.095,.198,.180,-.003],[.180,.151,.120,-.018],
    [.235,.072,.061,-.030],
  ],26,25,(x,y,z,a)=>{
    const front=Math.max(0,Math.cos(a));
    const bridge=Math.exp(-((x/.037)**2)-(((y+.045)/.072)**2));
    const jaw=Math.max(0,-y-.09)*.065*Math.abs(Math.sin(a));
    return [x+Math.sign(x)*jaw,y,z+front*bridge*.026];
  },(color,a,y)=>{
    const blush=Math.max(0,Math.cos(a))*.18*Math.exp(-(((y+.090)/.065)**2));
    color.copy(skin).lerp(cheek,blush);
  }),0xffffff,'skin',false);
  for(const side of [-1,1]) {
    piece(headVisual,orb,p.skin,[.035,.058,.028],[side*.202,1.634,.003]);
    const eye=new THREE.Group();
    eye.position.set(side*.080,1.710,.226);
    eye.rotation.y=side*.18;
    headVisual.add(eye);
    const iris=['#607970','#7b8764','#6c7a94','#987353','#70848c'][index%5];
    makeEye(eye,.040,.019,.017,{
      iris,edge:'#513c36',white:'#f5ebe0',pupil:.49,human:true,
    });
    const x=side*.080;
    sculptedCurve(headVisual,[
      [x-side*.040,1.760,.220],[x,1.769,.227],
      [x+side*.038,1.760,.218],
    ],.007,.0025,p.hair,.66,false);
    piece(headVisual,orb,0xdca18f,[.045,.021,.010],[side*.135,1.632,.192]);
    if(index%4===1) for(let f=0;f<2;f++)
      piece(headVisual,orb,0x987263,[.005,.004,.004],
        [side*(.125+f*.022),1.638+f*.010,.203]);
  }
  piece(headVisual,orb,p.skin,[.034,.045,.055],[0,1.637,.242]);
  sculptedCurve(headVisual,[
    [-.044,1.566,.194],[-.019,1.561,.220],[0,1.557,.225],
    [.019,1.561,.220],[.044,1.566,.194],
  ],.004,.0015,0x9b6158,.68,false);
  makeHair(headVisual,p);
  batchRigidParts(headVisual,true);
  // Blinking remains independent of face and eye batching.
  const eyelids=piece(headVisual,softCube,p.skin,[.242,.002,.022],[0,1.709,.270]);
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
    sculpt(arm,loft([
      [-.33,.072,.081],[-.29,.088,.093],[-.17,.094,.10],
      [-.04,.102,.110],[.035,.080,.082],
    ],14,13),p.clothes,'fabric',false);
    elbow.name='neighbor-'+joint;
    elbow.position.set(0,-.30,0);
    sculpt(elbow,loft([
      [-.26,.063,.071],[-.20,.076,.080],
      [-.09,.086,.088],[.04,.082,.09],
    ],14,12),p.clothes,'fabric',false);
    piece(elbow,orb,p.skin,[.085,.10,.095],[0,-.263,.017]);
    arm.add(elbow);
    torso.add(arm);
  }
  const tote=new THREE.Group();
  // The canvas bag is for social outings, not gardening or drinking tea.
  if(p.accessory==='tote') {
    piece(tote,softCube,p.accent,[.27,.29,.095],[-.065,-.44,.095]);
    for(const x of [-.16,.03])
      piece(tote,softCube,0x755d4f,[.035,.22,.045],[x,-.252,.095]);
  }
  tote.visible=false;
  elbows.leftElbow.add(tote);
  for(const [side,key,joint,footKey] of [
    [-1,'leftLeg','leftKnee','leftFoot'],[1,'rightLeg','rightKnee','rightFoot']
  ] as const) {
    const leg=limbs[key], knee=knees[joint], foot=feet[footKey];
    leg.name='neighbor-'+key;
    leg.position.set(side*.15,.76,0);
    sculpt(leg,loft([
      [-.38,.079,.091],[-.31,.087,.102],[-.15,.096,.105],
      [.02,.096,.114],[.105,.078,.083],
    ],16,15),p.trousers,'fabric',false);
    knee.name='neighbor-'+joint;
    knee.position.set(0,-.36,0);
    sculpt(knee,loft([
      [-.33,.076,.093],[-.25,.077,.092],[-.09,.083,.105],
      [.045,.087,.099],
    ],16,14),p.trousers,'fabric',false);
    foot.name='neighbor-'+footKey;
    foot.position.set(0,-.335,0);
    sculpt(foot,loft([
      [-.090,.073,.155,.058],[-.070,.089,.163,.060],
      [-.032,.084,.146,.054],[.015,.067,.108,.017],
      [.060,.055,.074,0],
    ],16,12),index%2?0x353537:0x675447,'leather',false);
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

  // Small, explicit action props, carried on the existing articulated joints.
  const wateringCan=new THREE.Group();
  wateringCan.position.set(.02,-.39,.095);
  piece(wateringCan,drum,0x799889,[.135,.165,.137],[0,.04,0]);
  piece(wateringCan,drum,0x799889,[.035,.20,.037],[.14,.10,.045]).rotation.z=1.03;
  piece(wateringCan,orb,0xd2d9b9,[.075,.041,.071],[.19,.14,.07]);
  wateringCan.visible=false;
  elbows.rightElbow.add(wateringCan);
  const cup=new THREE.Group();
  cup.position.set(.02,-.38,.13);
  piece(cup,drum,0xe9d7b9,[.088,.102,.088],[0,.04,0]);
  piece(cup,orb,0xc79b6e,[.025,.036,.025],[.09,.045,0]);
  cup.visible=false;
  elbows.rightElbow.add(cup);
  const letter=piece(elbows.rightElbow,cube,0xf5e5c8,[.15,.09,.017],[.04,-.345,.18]);
  letter.visible=false;
  const marketBag=new THREE.Group();
  marketBag.position.set(-.025,-.42,.1);
  piece(marketBag,softCube,0xc8ab7c,[.19,.27,.11],[0,-.035,0]);
  for(const x of [-.075,.075])piece(marketBag,softCube,0xe9d7b2,[.02,.19,.02],[x,.13,0]);
  marketBag.visible=false;
  elbows.leftElbow.add(marketBag);

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
  return {root,torso,head,eyelids,phone,wateringCan,cup,letter,marketBag,tote,materials,...limbs,...elbows,...knees,...feet};
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
  private doors: THREE.Group[]=[];

  bindDoors(scene: THREE.Scene):void {
    this.doors=NEIGHBOR_HOMES.map(home=>{
      const door=scene.getObjectByName('neighbor-door-'+home.id);
      if(!(door instanceof THREE.Group))
        throw new Error('Missing animated neighbor door '+home.id);
      return door;
    });
  }

  constructor() {
    this.group.name='Прогуливающиеся соседи';
    for(const rig of this.rigs)this.group.add(rig.root);
    this.group.visible=false;
  }

  update(gameMinute:number):void {
    const seconds=gameMinute/GAME_MINUTES_PER_REAL_SECOND;
    const poses=NEIGHBORS.map((_,i)=>neighborPose(i,gameMinute));
    for(const [i,rig] of this.rigs.entries()) {
      const pose=poses[i];
      rig.root.visible=pose.visible;
      if(!pose.visible)continue;
      // The public stone paving sits 13cm above the garden lawn. Blend their
      // elevations at each footpath instead of floating around the cottages.
      const pathDist=Math.abs(pose.z-REAR_WALK_Z);
      const lawn=THREE.MathUtils.smoothstep(pathDist,.9,2.5);
      rig.root.position.set(pose.x,.03-.136*lawn,pose.z);
      rig.root.rotation.y=pose.yaw;
      setFade(rig,pose.opacity);
      this.animateRig(rig,pose.action,pose.gestureBlend,seconds,i,!!pose.carrying);
    }
    // The hinge opens before a resident appears and closes once they are
    // safely away; no tiny twitch when their fade is near zero.
    for(const [i,door] of this.doors.entries()) {
      door.rotation.y=-1.08*neighborDoorOpen(i,gameMinute,NEIGHBORS.length);
    }
  }

  private animateRig(rig:NeighborRig,action:NeighborAction,blend:number,t:number,index:number,carrying=false):void {
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
    rig.eyelids.visible=blink>.035;
    rig.eyelids.scale.y=Math.max(.0005,.071*blink);
  }
}
