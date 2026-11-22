import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { cube, drum, finish, orb, softCube } from './ArtKit';
import { NEIGHBORS } from '../shared/neighbors';

export interface NeighborRig {
  root:THREE.Group;
  leftArm:THREE.Bone; rightArm:THREE.Bone;
  leftLeg:THREE.Bone; rightLeg:THREE.Bone;
  torso:THREE.Bone; head:THREE.Bone;
  leftElbow:THREE.Bone; rightElbow:THREE.Bone;
  leftKnee:THREE.Bone; rightKnee:THREE.Bone;
  leftFoot:THREE.Bone; rightFoot:THREE.Bone;
  phone:THREE.Mesh; wateringCan:THREE.Group; cup:THREE.Group;
  letter:THREE.Mesh; marketBag:THREE.Group; tote:THREE.Group;
  face:THREE.SkinnedMesh;
  materials:THREE.MeshStandardMaterial[];
}

function detail(parent:THREE.Object3D,geometry:THREE.BufferGeometry,color:number,
  dimensions:readonly [number,number,number],position:readonly [number,number,number]) {
  const mesh=new THREE.Mesh(geometry,finish(color));
  mesh.scale.set(...dimensions);mesh.position.set(...position);parent.add(mesh);
  mesh.visible=true;
  return mesh;
}

export function createNeighborModel(asset:GLTF,index:number):NeighborRig {
  const {scene}=asset;
  if(scene.getObjectByName('Resident')?.userData.neighborIndex!==index)throw new Error('Neighbor GLB identity mismatch');
  const joint=(name:string)=>{
    const found=scene.getObjectByName(name);
    if(!(found instanceof THREE.Bone))throw new Error('Missing neighbor bone '+name);
    return found;
  };
  const skins=scene.getObjectsByProperty('isSkinnedMesh',true) as THREE.SkinnedMesh[];
  const face=skins.find(mesh=>mesh.morphTargetDictionary?.CloseLids!==undefined);
  if(!face||!skins[0].skeleton||skins.some(mesh=>mesh.skeleton!==skins[0].skeleton))throw new Error('Invalid neighbor skin');
  const root=new THREE.Group();
  root.name=NEIGHBORS[index].name;
  root.add(scene);
  const hands=[joint('WristL'),joint('WristR')] as const;
  const phone=detail(hands[1],cube,0x354446,[.058,.109,.013],[.017,-.067,.051]);
  const letter=detail(hands[1],cube,0xe9dbc5,[.107,.073,.011],[.024,-.049,.083]);
  const wateringCan=new THREE.Group();
  wateringCan.position.set(.017,-.117,.051);hands[1].add(wateringCan);
  detail(wateringCan,drum,0x829886,[.089,.103,.093],[0,-.043,0]);
  detail(wateringCan,drum,0x829886,[.021,.121,.021],[.089,-.021,.04]).rotation.z=1.03;
  detail(wateringCan,orb,0xd2d9b9,[.041,.022,.041],[.148,.012,.04]);
  const cup=new THREE.Group();
  cup.position.set(.02,-.075,.055);hands[1].add(cup);
  detail(cup,drum,0xe9d7b9,[.043,.062,.043],[0,.022,0]);
  detail(cup,orb,0xb99374,[.020,.021,.015],[.037,.025,0]);
  const marketBag=new THREE.Group();
  marketBag.position.set(-.039,-.077,.029);hands[0].add(marketBag);
  detail(marketBag,softCube,0xc6a276,[.155,.191,.102],[0,-.094,0]);
  for(const x of [-.062,.061])detail(marketBag,softCube,0xe9d8b7,[.019,.087,.018],[x,.021,0]);
  const tote=new THREE.Group();
  tote.position.set(-.029,-.06,-.015);
  hands[0].add(tote);
  detail(tote,softCube,NEIGHBORS[index].accent,[.183,.193,.085],[-.004,-.116,.033]);
  detail(tote,softCube,0x928679,[.023,.14,.024],[-.079,-.034,.034]);
  const materials:THREE.MeshStandardMaterial[]=[];
  for(const mesh of skins){
    if(mesh.material instanceof THREE.MeshStandardMaterial) materials.push(mesh.material);
    mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1,0),1.76);
  }
  return {root, face, materials,phone,letter,wateringCan,cup,marketBag,tote,
    leftArm:joint('ArmL'),rightArm:joint('ArmR'),leftLeg:joint('ThighL'),rightLeg:joint('ThighR'),
    leftElbow:joint('ElbowL'),rightElbow:joint('ElbowR'),leftKnee:joint('KneeL'),rightKnee:joint('KneeR'),
    leftFoot:joint('AnkleL'),rightFoot:joint('AnkleR'),torso:joint('Chest'),head:joint('Head')};
}

export function paintNeighborExpression(face:THREE.SkinnedMesh,blink:number,smile:number) {
  const dictionary=face.morphTargetDictionary!, weights=face.morphTargetInfluences!;
  weights[dictionary.CloseLids]=blink;
  if(dictionary.Smile!==undefined) weights[dictionary.Smile]=smile;
}
