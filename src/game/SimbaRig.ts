import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function joint(model: THREE.Object3D, name: string): THREE.Bone {
  const bone = model.getObjectByName(name);
  if (!(bone instanceof THREE.Bone)) throw new Error('Missing Simba joint ' + name);
  return bone;
}

type Leg = ReturnType<typeof leg>;

function leg(model: THREE.Object3D, name: string, front: boolean, offset: number) {
  const hip = joint(model,name), knee = joint(model,name+'Knee'), paw = joint(model,name+'Paw');
  const upper = Math.hypot(knee.position.y,knee.position.z);
  const lower = Math.hypot(paw.position.y,paw.position.z);
  const upperRest = Math.atan2(-knee.position.z,-knee.position.y);
  const lowerRest = Math.atan2(-paw.position.z,-paw.position.y);
  const height = knee.position.y+paw.position.y;
  const depth = knee.position.z+paw.position.z;
  return {hip,knee,paw,upper,lower,upperRest,lowerRest,height,depth,front,offset};
}

function plantPaw(limb: Leg, y: number, z: number, pawTilt: number) {
  const {upper,lower} = limb;
  const distance = Math.min(upper+lower-.001,Math.hypot(y,z));
  const bend = Math.acos(THREE.MathUtils.clamp((distance*distance-upper*upper-lower*lower)/(2*upper*lower),-1,1))
    * (limb.front ? -1 : 1);
  const hip = Math.atan2(-z,-y)-Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend));
  limb.hip.rotation.x = hip-limb.upperRest;
  limb.knee.rotation.x = bend-limb.lowerRest+limb.upperRest;
  limb.paw.rotation.x = pawTilt-(hip+bend-limb.lowerRest);
}

export class SimbaRig {
  private readonly head: THREE.Bone;
  private readonly neck: THREE.Bone;
  private readonly chest: THREE.Bone;
  private readonly spine: THREE.Bone;
  private readonly jaw: THREE.Bone;
  private readonly ears: THREE.Bone[];
  private readonly eyes: THREE.Bone[];
  private readonly tail: THREE.Bone[];
  private readonly feet: Leg[];

  constructor(readonly model: THREE.Group) {
    this.head = joint(model,'Head');
    this.neck = joint(model,'Neck');
    this.chest = joint(model,'Chest');
    this.spine = joint(model,'Spine');
    this.jaw = joint(model,'Jaw');
    this.ears = ['L','R'].map(side=>joint(model,'Ear'+side));
    this.eyes = ['L','R'].map(side=>joint(model,'Eye'+side));
    this.tail = Array.from({length:6},(_,index)=>joint(model,'Tail'+index));
    this.feet = [leg(model,'ForeL',true,0),leg(model,'HindL',false,.72),
      leg(model,'ForeR',true,.5),leg(model,'HindR',false,.22)];
    model.traverse(object=>{
      if (object instanceof THREE.SkinnedMesh) {
        // The bounding sphere includes the extended tail and crouched limbs.
        object.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.42,-.27),1.4);
      }
    });
  }

  pose(time:number,distance:number,motion:number,crouch:number,reach:number,groom:number,eating:number,
    tailSwing:number,tailFold:number,head:THREE.Euler,ears:readonly THREE.Group[],eyes:readonly THREE.Group[],
    jump:number,rest:number) {
    const breath = Math.sin(time*2.4);
    this.head.rotation.set(head.x*.76,head.y*.74,head.z*.74);
    this.neck.rotation.set(head.x*.24,head.y*.26,head.z*.18);
    this.neck.position.y=.02-.095*eating-.05*rest;
    this.jaw.rotation.x=.12*eating*(.5+.5*Math.sin(time*12));
    this.spine.rotation.y=.050*motion*Math.sin(distance*12) + rest*.12;
    this.chest.rotation.x=(.014*breath-.07*reach)*(1-.6*rest);
    for(let i=0;i<this.tail.length;i++){
      const joint = this.tail[i];
      joint.rotation.y=tailSwing*.25+Math.sin(time*2-i*.55)*.048+tailFold*(i<5?.57:.26);
      joint.rotation.x=.095*jump-rest*.12+Math.sin(time*2.2-i*.32)*.037;
    }
    for(let i=0;i<2;i++){
      this.ears[i].rotation.copy(ears[i].rotation);
      this.eyes[i].scale.y=eyes[i].scale.y;
    }
    for(const [index,limb] of this.feet.entries()){
      const phase=THREE.MathUtils.euclideanModulo(distance/.49+limb.offset,1);
      const swing = phase>.64 ? (phase-.64)/.36 : 0;
      const lift = Math.sin(Math.PI*swing)*.074*motion;
      const stride=.29*(phase<.64 ? .5-phase/.64 : -.5+swing)*motion;
      const wash=index===0?groom:0;
      const scratch=limb.front?reach*(.72+.28*Math.sin(time*13+index*Math.PI/2)):0;
      plantPaw(limb, limb.height+crouch+lift+jump*.13+wash*.26+scratch*.30,
        limb.depth+stride+(limb.front?-.10:.045)*rest+wash*.16+scratch*.23,
        lift*.8-wash*.52-scratch*.45);
    }
  }
}

export async function loadSimbaRig(): Promise<SimbaRig> {
  const gltf = await new GLTFLoader().loadAsync(new URL('../assets/pets/simba.glb',import.meta.url).href);
  return new SimbaRig(gltf.scene);
}
