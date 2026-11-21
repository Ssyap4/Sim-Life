import * as THREE from 'three';
import { NEIGHBORS, neighborPose, type NeighborAction } from '../shared/neighbors';
import { batchRigidParts, cube, drum, finish, orb, softCube } from './ArtKit';

interface NeighborRig {
  root: THREE.Group;
  leftArm: THREE.Group; rightArm: THREE.Group;
  leftLeg: THREE.Group; rightLeg: THREE.Group;
  torso: THREE.Group; phone: THREE.Mesh;
}

function piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry,
  color: number, scale: readonly [number,number,number], pos: readonly [number,number,number]) {
  const mesh = new THREE.Mesh(geometry, finish(color));
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function resident(index: number): NeighborRig {
  const resident = NEIGHBORS[index];
  const root = new THREE.Group();
  root.name = 'Сосед: ' + resident.name;
  root.scale.setScalar(resident.height);
  const torso = new THREE.Group();
  root.add(torso);
  piece(torso, softCube, resident.clothes, [.54,.62,.31], [0,1.12,0]);
  piece(torso, softCube, resident.trousers, [.45,.20,.29], [0,.78,0]);
  const neck = piece(torso, drum, resident.skin, [.105,.15,.105], [0,1.51,0]);
  neck.rotation.x = .1;
  piece(torso, orb, resident.skin, [.225,.268,.225], [0,1.69,.012]);
  piece(torso, orb, resident.hair, [.232,.145,.235], [0,1.884,-.016]);
  const bangs = index % 3 === 0 ? .17 : .075;
  piece(torso, softCube, resident.hair, [.29,bangs,.08], [-.052,1.85,.180]);
  if (index % 4 === 0) {
    piece(torso, orb, resident.hair, [.13,.22,.13], [-.20,1.74,-.06]);
    piece(torso, orb, resident.hair, [.13,.22,.13], [.20,1.74,-.06]);
  }
  for (const x of [-.080,.080]) piece(torso, orb, 0x302d2b,
    [.019,.023,.013], [x,1.704,.223]);
  piece(torso, orb, resident.skin, [.032,.035,.046], [0,1.63,.243]);
  const mouth = piece(torso, softCube, 0x8b5850, [.057,.010,.008], [0,1.557,.22]);
  mouth.rotation.z = index % 2 ? .05 : -.05;
  const limbs: {leftArm:THREE.Group;rightArm:THREE.Group;leftLeg:THREE.Group;rightLeg:THREE.Group} = {
    leftArm: new THREE.Group(), rightArm:new THREE.Group(),
    leftLeg: new THREE.Group(), rightLeg:new THREE.Group(),
  };
  for (const [side, key] of [[-1,'leftArm'],[1,'rightArm']] as const) {
    const arm = limbs[key];
    arm.position.set(side * .333,1.40,0);
    piece(arm, softCube, resident.clothes, [.16,.38,.19], [0,-.18,0]);
    piece(arm, orb, resident.skin, [.085,.10,.095], [0,-.43,.02]);
    torso.add(arm);
  }
  for (const [side, key] of [[-1,'leftLeg'],[1,'rightLeg']] as const) {
    const leg = limbs[key];
    leg.position.set(side * .15,.76,0);
    piece(leg, softCube, resident.trousers, [.18,.55,.205], [0,-.265,0]);
    piece(leg, softCube, index % 2 ? 0x353537 : 0x675447, [.20,.10,.34], [0,-.565,.074]);
    root.add(leg);
  }
  // Merge each rigid limb/torso into a single colored mesh. Joints remain
  // independent so walking and gestures cost only a few draw calls per NPC.
  for (const limb of Object.values(limbs)) batchRigidParts(limb, true);
  batchRigidParts(torso, true);
  const phone = piece(limbs.rightArm, cube, 0x3a474c, [.095,.165,.022], [0,-.46,.07]);
  phone.visible = false;
  return { root, torso, phone, ...limbs };
}

/** A lightweight and deliberately non-interactive crowd. No network packets
 * or saved state are needed: both clients evaluate the same household clock. */
export class NeighborPeople {
  readonly group = new THREE.Group();
  private readonly rigs = NEIGHBORS.map((_, i) => resident(i));
  constructor() {
    this.group.name = 'Прогуливающиеся соседи';
    for (const rig of this.rigs) this.group.add(rig.root);
    this.group.visible = false;
  }
  update(gameMinute: number): void {
    const seconds = gameMinute * 2;
    for (const [i, rig] of this.rigs.entries()) {
      const pose = neighborPose(i, gameMinute);
      rig.root.visible = pose.visible;
      if (!pose.visible) continue;
      rig.root.position.set(pose.x, .03, pose.z);
      rig.root.rotation.y = pose.yaw;
      this.animateRig(rig, pose.action, seconds, i);
    }
  }
  private animateRig(rig: NeighborRig, action: NeighborAction, t: number, index: number): void {
    const stride = action === 'walk' ? .40 : .04;
    const cadence = t * (5.8 + index % 3 * .24) + index * .7;
    const wave = Math.sin(cadence);
    rig.leftLeg.rotation.x = wave * stride;
    rig.rightLeg.rotation.x = -wave * stride;
    rig.leftArm.rotation.x = -wave * stride * .65;
    rig.rightArm.rotation.x = wave * stride * .65;
    rig.leftArm.rotation.z = -.04;
    rig.rightArm.rotation.z = .04;
    rig.torso.position.y = action === 'walk' ? Math.abs(wave) * .019 : Math.sin(t * 1.2 + index) * .009;
    rig.torso.rotation.z = Math.sin(t * .63 + index) * .015;
    rig.phone.visible = action === 'phone';
    if (action === 'phone') {
      rig.rightArm.rotation.x = -1.09;
      rig.rightArm.rotation.z = -.30;
    } else if (action === 'chat' || action === 'wave') {
      rig.rightArm.rotation.z = -.48 + Math.sin(t * 4 + index) * .25;
      rig.rightArm.rotation.x = -.53;
      rig.leftArm.rotation.x = Math.sin(t * 2 + index) * .15;
    } else if (action === 'look') {
      rig.leftArm.rotation.x = -.15;
      rig.rightArm.rotation.x = .12;
    }
  }
}
