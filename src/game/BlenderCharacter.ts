import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { CharacterId } from '../shared/protocol';
import { fitWardrobe } from './Wardrobe';
import type { CharacterModel } from './CharacterArt';

const assets: Record<CharacterId, string> = {
  vlad: new URL('../assets/characters/vlad.glb', import.meta.url).href,
  alina: new URL('../assets/characters/alina.glb', import.meta.url).href,
};
const cache = new Map<string, Promise<GLTF>>();

export function readAsset(url: string): Promise<GLTF> {
  const cached = cache.get(url);
  if (cached) return cached;
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
    } finally {
      clearTimeout(timeout);
    }
  })();
  cache.set(url, request);
  void request.catch(() => cache.delete(url));
  return request;
}

const boneNames = [
  'Chest', 'Head', 'Hair', 'EyeL', 'EyeR',
  'ArmL', 'ArmR', 'ElbowL', 'ElbowR', 'WristL', 'WristR',
  'ThighL', 'ThighR', 'KneeL', 'KneeR', 'AnkleL', 'AnkleR',
] as const;
type BoneName = typeof boneNames[number];

function collectBones(object: THREE.Object3D): Record<BoneName, THREE.Bone> {
  const bones = {} as Record<BoneName, THREE.Bone>;
  for (const name of boneNames) {
    const bone = object.getObjectByName(name);
    if (!(bone instanceof THREE.Bone)) throw new Error(`Missing bone ${name}`);
    bones[name] = bone;
  }
  return bones;
}

export function createBlenderCharacter(gltf: GLTF, id: CharacterId, outfit:readonly string[]=[]): CharacterModel {
  const rigRoot = gltf.scene.getObjectByName('Resident');
  const waistY: unknown = rigRoot?.userData.waistY;
  const blink = THREE.AnimationClip.findByName(gltf.animations, 'Blink');
  if (rigRoot?.userData.character !== id || typeof waistY !== 'number' || !Number.isFinite(waistY) || !blink) {
    throw new Error('Invalid character metadata or facial animation');
  }
  const bones = collectBones(gltf.scene);
  // The runtime solves contacts in this bind pose. Verify export axes and the
  // chains before giving the gameplay controller ownership of these bones.
  for (const name of boneNames) {
    const b = bones[name];
    if (b.quaternion.angleTo(new THREE.Quaternion()) > 0.001 || b.scale.distanceToSquared(new THREE.Vector3(1, 1, 1)) > 0.000001) {
      throw new Error(`Unexpected bind axes in ${name}`);
    }
  }
  const chains = [
    [bones.ArmL, bones.ElbowL, bones.WristL], [bones.ArmR, bones.ElbowR, bones.WristR],
    [bones.ThighL, bones.KneeL, bones.AnkleL], [bones.ThighR, bones.KneeR, bones.AnkleR],
  ] as const;
  for (const [upper, lower, end] of chains) {
    if (lower.parent !== upper || end.parent !== lower || lower.position.y >= 0 || end.position.y >= 0) {
      throw new Error('Invalid limb chain');
    }
  }
  const skins = gltf.scene.getObjectsByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh[];
  const skin = skins[0]?.skeleton;
  if (!skin || skins.some(mesh => mesh.skeleton !== skin)) throw new Error('Expected one shared character skin');
  const face = skins.find(mesh => mesh.morphTargetDictionary?.CloseLids !== undefined);
  const lids = face?.morphTargetDictionary?.CloseLids;
  const smile = face?.morphTargetDictionary?.Smile;
  const blinkTrack = blink.tracks.find(track => track.name === `${face?.name}.morphTargetInfluences`);
  if (!face || lids === undefined || smile === undefined || !blinkTrack || blink.duration <= 0 ||
      blinkTrack.getValueSize() <= lids) {
    throw new Error('Missing face shape keys or eyelid track');
  }
  const faceName = face.name;

  return (figure) => {
    const model = clone(gltf.scene);
    const joints = collectBones(model);
    fitWardrobe(model,id,outfit);
    const parts = model.getObjectsByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh[];
    const skeleton = parts[0].skeleton;
    const finishes=new Map<THREE.Material,THREE.Material>();
    for (const child of parts) {
      // SkeletonUtils gives each part its own copy. These parts use the same
      // joints and inverse bind matrices, so upload one bone texture per resident.
      child.skeleton = skeleton;
      const material = child.material as THREE.MeshStandardMaterial;
      let tailored=finishes.get(material) as THREE.MeshStandardMaterial | undefined;
      if (!tailored) {
        tailored=material.clone();
        // Refine hair sheen, natural skin response and crisp fabric separation
        // without increasing skinned meshes, bones, textures or draw calls.
        if(material.name.includes('Hair')) {tailored.roughness=.71;tailored.metalness=0;}
        else if(material.name.includes('Skin')||material.name.includes('Complexion')) {tailored.roughness=.87;tailored.metalness=0;}
        else if(material.name.includes('Eyes')) {tailored.roughness=.23;tailored.metalness=0;}
        else if(material.name.includes('Cloth')) {tailored.roughness=.91;tailored.metalness=0;}
        finishes.set(material,tailored);
      }
      child.material=tailored;
      // Hair and clothing carry the shadow silhouette. The dense eyelids,
      // lips and finger surfaces still receive light and shadow in the main pass.
      child.castShadow = material.name === 'Hair pigment' || material.name === 'Cloth pigment';
      child.receiveShadow = material.name !== 'Eyes';
      // The rest-pose bound is too small for reaching limbs. The character is
      // one scene unit, and this bound covers all supported furniture poses.
      child.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1.6);
    }
    // Rig-attached personal details follow the existing bones. No extra skin,
    // skeleton, morph target, textures or per-frame mesh updates.
    const watch = new THREE.Mesh(new THREE.TorusGeometry(.047,.008,6,18),
      new THREE.MeshStandardMaterial({color:id==='vlad'?0x506c62:0xc9ac84,
        metalness:.34,roughness:.52}));
    watch.rotation.x=Math.PI/2;
    watch.position.y=.015;
    joints.WristL.add(watch);
    if(id==='alina'){
      const earringGeometry=new THREE.TorusGeometry(.017,.004,5,12);
      const earringFinish=new THREE.MeshStandardMaterial({
        color:0xc8ae79,metalness:.52,roughness:.35,
      });
      for(const side of [-1,1]){
        const earring=new THREE.Mesh(earringGeometry,earringFinish);
        earring.position.set(side*.163,-.084,.006);
        earring.rotation.y=side*.30;
        joints.Head.add(earring);
      }
    }
    figure.add(model);
    const weights = (model.getObjectByName(faceName) as THREE.SkinnedMesh).morphTargetInfluences!;
    const sampleBlink = new THREE.LinearInterpolant(blinkTrack.times, blinkTrack.values, blinkTrack.getValueSize());
    const eyes = [joints.EyeL, joints.EyeR];
    let time = id === 'vlad' ? 0 : 0.22;
    let rest = 0;
    let glance = 0;
    return {
      joints: { leftArm: joints.ArmL, rightArm: joints.ArmR, leftLeg: joints.ThighL, rightLeg: joints.ThighR },
      rig: {
        chest: joints.Chest, head: joints.Head, hair: joints.Hair, eyes,
        elbows: [joints.ElbowL, joints.ElbowR], wrists: [joints.WristL, joints.WristR],
        knees: [joints.KneeL, joints.KneeR], ankles: [joints.AnkleL, joints.AnkleR],
        waistY, thighLength: -joints.KneeL.position.y, shinLength: -joints.AnkleL.position.y,
        upperArm: -joints.ElbowL.position.y, lowerArm: -joints.WristL.position.y,
        animateFace(dt, asleep, expression, eyeYaw, eyePitch) {
          const blend = 1 - Math.exp(-dt * 8);
          time = (time + dt) % blink.duration;
          rest = THREE.MathUtils.lerp(rest, Number(asleep), blend);
          weights[lids] = THREE.MathUtils.lerp(sampleBlink.evaluate(time)[lids], 1, rest);
          weights[smile] = THREE.MathUtils.lerp(weights[smile], expression, blend);
          // The eyes make occasional tiny, synchronized focus shifts; their
          // original player/pet look direction retains priority.
          glance += dt;
          const fineYaw = Math.sin(glance*.91+(id==='vlad'?0:1.7))*.008;
          for (const eye of eyes) {
            eye.rotation.y = THREE.MathUtils.lerp(eye.rotation.y, eyeYaw+fineYaw, blend);
            eye.rotation.x = THREE.MathUtils.lerp(eye.rotation.x, eyePitch, blend);
          }
        },
      },
    };
  };
}

export async function loadResidents(outfit:readonly string[]=[]): Promise<Partial<Record<CharacterId, CharacterModel>>> {
  const entries = await Promise.all((Object.entries(assets) as [CharacterId, string][]).map(async ([id, url]) => {
    try {
      return [id, createBlenderCharacter(await readAsset(url), id, outfit)] as const;
    } catch (error) {
      console.warn(`Using built-in character for ${id}`, error);
      return null;
    }
  }));
  return Object.fromEntries(entries.filter(entry => entry !== null));
}
