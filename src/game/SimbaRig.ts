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
  private readonly scratchTarget = new THREE.Vector3();
  private readonly contactProbe = new THREE.Vector3();
  private readonly headRest: THREE.Vector3;

  constructor(readonly model: THREE.Group) {
    this.head = joint(model,'Head');
    this.headRest = this.head.position.clone();
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
    jump:number,rest:number,scratchContact?:THREE.Vector3,loaf=0,coil=0) {
    const breath = Math.sin(time*2.4);
    // A cat resting on a cushion lowers its head and folds the muzzle back
    // toward its chest. Bone targets are rebuilt each frame, never accumulated.
    this.head.position.y=this.headRest.y-.036*loaf;
    this.head.position.z=this.headRest.z-.055*coil;
    this.head.rotation.set(head.x*.76+.12*loaf,head.y*.74+.10*coil,head.z*.74);
    this.neck.rotation.set(head.x*.24+.11*loaf,head.y*.26,head.z*.18);
    this.neck.position.y=.02-.095*eating-.05*rest-.035*loaf;
    this.jaw.rotation.x=.12*eating*(.5+.5*Math.sin(time*12));
    this.spine.rotation.y=.050*motion*Math.sin(distance*12) + rest*.12;
    this.spine.rotation.x=.085*loaf;
    this.chest.rotation.x=(.014*breath-.07*reach)*(1-.6*rest)+.045*loaf;
    for(let i=0;i<this.tail.length;i++){
      const joint = this.tail[i];
      // Curl the long tail around the hip instead of leaving a rigid rod
      // hanging off a sofa or soft pet mat.
      joint.rotation.y=tailSwing*.25+Math.sin(time*2-i*.55)*.036+
        tailFold*(i<5?.42:.21)+coil*(i<3?.10:-.085);
      joint.rotation.x=.095*jump-rest*.12+Math.sin(time*2.2-i*.32)*.026-
        coil*(i>3?.10:.018);
    }
    for(let i=0;i<2;i++){
      this.ears[i].rotation.copy(ears[i].rotation);
      // Procedural facial controls remain active on the imported GLB rig.
      this.eyes[i].scale.y=THREE.MathUtils.clamp(eyes[i].scale.y*(1-.42*loaf),.05,1);
    }
    for(const [index,limb] of this.feet.entries()){
      const phase=THREE.MathUtils.euclideanModulo(distance/.49+limb.offset,1);
      const swing = phase>.64 ? (phase-.64)/.36 : 0;
      const lift = Math.sin(Math.PI*swing)*.074*motion*(1-.98*loaf);
      const stride=.29*(phase<.64 ? .5-phase/.64 : -.5+swing)*motion*(1-.98*loaf);
      const wash=index===0?groom:0;
      const stroke=Math.sin(time*13+index*Math.PI/2);
      let pawY=limb.height+crouch+lift+jump*.13+wash*.26;
      // The forepaws tuck under the breast and hind paws fold toward the
      // belly; knees are solved with the same two-bone IK as during walking.
      let pawZ=limb.depth+stride+(limb.front?-.10:.045)*rest+
        (limb.front?-.105:.12)*loaf+wash*.16;
      if(limb.front&&scratchContact){
        this.scratchTarget.copy(scratchContact);
        // The downward stroke follows the world-vertical column through
        // the reared body's local plane.
        this.scratchTarget.y+=stroke*.065;
        this.scratchTarget.z+=stroke*.050;
        this.model.localToWorld(this.scratchTarget);
        limb.hip.parent!.worldToLocal(this.scratchTarget).sub(limb.hip.position);
        pawY=THREE.MathUtils.lerp(pawY,this.scratchTarget.y,reach);
        pawZ=THREE.MathUtils.lerp(pawZ,this.scratchTarget.z,reach);
      }
      plantPaw(limb,pawY,pawZ,lift*.8-wash*.52-(limb.front?.60*reach:0));
    }
  }

  /** Rear ankle contact in world coordinates; used only when climbing the
   * scratching post to keep the hind paws planted on the real floor. */
  hindContactHeight(): number {
    this.model.updateWorldMatrix(true,true);
    return Math.min(this.feet[1].paw.getWorldPosition(this.contactProbe).y,
      this.feet[3].paw.getWorldPosition(this.contactProbe).y);
  }
}

export async function loadSimbaRig(): Promise<SimbaRig> {
  const gltf = await new GLTFLoader().loadAsync(new URL('../assets/pets/simba.glb',import.meta.url).href);
  return new SimbaRig(gltf.scene);
}
