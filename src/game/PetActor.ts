import * as THREE from 'three';
import type { SimbaRig } from './SimbaRig';
import type { CatPerch } from '../shared/CatPerches';
import { CAT_REST_POSES, chooseCatRestPose, type CatRestPoseId } from '../shared/CatRestPoses';
import { DOG_TOYS, PETS, PET_SPEED, type PetAction, type PetId, type PetRoutine, type PetHungerLevel } from '../shared/pets';
import { petHungerSprite, warningTexture } from './PetHungerMarker';
import { buildPetArt, simbaScale, verdellScale } from './PetArt';
import { createDogToy, createPetPlayToy } from './PetToys';
import { petTrafficStep, PET_PET_CLEARANCE } from './PetTraffic';
import { nearestClearPoint, pointIsClear } from './navigation';
import { petTemporaryDetour, planPetRoute } from './PetNavigation';
import type { FloorPoint, FloorRect } from './navigation';
import { PET_IDLE_SECONDS, choosePetIdle, petCanWelcome, petIdleWeight,
  type PetIdleContext, type PetIdleGesture } from './PetIdle';

export class PetActor {
  readonly root = new THREE.Group();
  readonly homeToys=new THREE.Group();
  private toyIndex:number|undefined;
  private readonly toyContact=new THREE.Vector3();
  private readonly body = new THREE.Group();
  private perch:CatPerch|null=null;
  private leavingPerch:CatPerch|null=null;
  private perchRestPose:CatRestPoseId='sofa_loaf';
  private leavingRestPose:CatRestPoseId='sofa_loaf';
  private perchProgress=0;
  private perchHeight: number | undefined;
  private leavingPerchHeight: number | undefined;
  private readonly pendingGround = new THREE.Vector3();
  private hasPendingGround = false;
  private readonly perchLocal=new THREE.Vector3();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly paws: THREE.Group[] = [];
  private readonly rig: ReturnType<typeof buildPetArt>;
  private clock = 0;
  private tailPhase = 0;
  private reaction: PetAction | null = null;
  private reactionTime = 0;
  private route: THREE.Vector3[] = [];
  private routine: PetRoutine['kind'] | null = null;
  private facing: number | undefined;
  private distance = 0;
  private settled = 0;
  private stuckFor = 0;
  private lastProgressGap = Infinity;
  private rerouteCooldown = 0;
  private yieldingTo: FloorPoint | null = null;
  private readonly hungerMarker = petHungerSprite();
  private readonly playToy: THREE.Group;
  private readonly fetchTargetToy: THREE.Group;
  private fetchSpot:FloorPoint|null=null;
  private fetchPickedUp=false;
  private onPetBed=false;
  private petBedHeight=0;
  private scratchPost:FloorPoint | undefined;
  private hungerLevel: PetHungerLevel = 'normal';
  private ambient: PetIdleContext = {
    satiety: 80, energy: 80, happiness: 80, bond: 40, bowl: 0, personNearby: false,
  };
  private idleGesture: PetIdleGesture | null = null;
  private idleTime = 0;
  private idleCooldown: number;
  private idleTurn = 0;
  private welcomeUntil = -1;
  private nextWelcome = 0;

  constructor(readonly id: PetId, private readonly simbaRig?: SimbaRig) {
    const { x, z } = PETS[id].home;
    this.root.position.set(x, 0, z);
    this.root.add(this.body);
    this.playToy=createPetPlayToy(id);
    this.fetchTargetToy=this.playToy.clone(true);
    this.fetchTargetToy.visible=false;
    this.root.add(this.playToy,this.fetchTargetToy);
    const dog = id === 'verdell';
    if(dog)for(const toy of DOG_TOYS){
      const model=createDogToy(toy.kind);
      model.position.set(toy.x,.015,toy.z);
      this.homeToys.add(model);
    }
    this.idleCooldown = dog ? 3.5 : 5;
    if (simbaRig) {
      this.rig={ears:[new THREE.Group(),new THREE.Group()],eyes:[new THREE.Group(),new THREE.Group()],jaw:new THREE.Group()};
      this.body.add(simbaRig.model);
    } else {
      this.rig = buildPetArt(this.body, this.head, this.tail, this.paws, id);
    }
    this.body.add(this.head, this.tail);
    this.root.scale.setScalar(dog ? verdellScale : simbaScale);
    // Real Simba: fine, narrow face, short coat and a longer ginger body.
    if (!dog) this.head.scale.set(.76, .80, .84);
    this.head.position.set(0, dog ? .728 : .525, dog ? .241 : .44);
    this.tail.position.set(0, dog ? .523 : .422, dog ? -.454 : -.645);
    this.root.rotation.y = dog ? 0.20 : 0.21;
    if (this.hungerMarker) {
      // The dog and cat use different model scales: keep both icons readable
      // in world-space, and above their actual heads, not at the floor origin.
      const size = 0.64 / this.root.scale.x;
      this.hungerMarker.scale.set(size, size, 1);
      this.hungerMarker.position.set(0, dog ? 1.43 : 1.44, 0);
      this.root.add(this.hungerMarker);
    }
  }

  setHomeToyAvailability(obstacles:readonly FloorRect[],floor:FloorRect):void{
    for(let i=0;i<DOG_TOYS.length;i++){
      const model=this.homeToys.children[i];
      if(model)model.visible=pointIsClear(DOG_TOYS[i],obstacles,floor);
    }
  }
  private animateHouseToys(weight:number,time:number):void{
    for(let i=0;i<DOG_TOYS.length;i++){
      const model=this.homeToys.children[i],toy=DOG_TOYS[i];
      if(!model)continue;
      model.position.set(toy.x,.015,toy.z);
      model.rotation.set(0,0,0);
      if(i!==this.toyIndex||!weight||!model.visible)continue;
      if(toy.kind==='ball'){
        const nudge=Math.max(0,Math.sin(time*4))*weight;
        model.position.z+=nudge*.16;
        model.position.x+=Math.sin(time*4)*weight*.065;
        model.rotation.x=nudge*1.7;
      }else if(toy.kind==='rope'){
        const hold=THREE.MathUtils.smoothstep(Math.sin(time*1.6),-.1,.45)*weight;
        this.head.updateWorldMatrix(true,false);
        this.toyContact.copy(this.head.localToWorld(this.perchLocal.set(0,-.15,.34)));
        model.position.lerp(this.toyContact,hold);
        model.rotation.y=this.root.rotation.y+Math.sin(time*8)*hold*.55;
        model.rotation.z=Math.sin(time*8)*hold*.18;
      }else{
        // Soft toy stays on the ground while the dog noses and paws at it.
        model.position.x+=Math.sin(time*2.4)*weight*.045;
        model.rotation.y=Math.sin(time*2.4)*weight*.24;
        model.rotation.z=Math.sin(time*3.2)*weight*.10;
      }
    }
  }
  setHungerLevel(level: PetHungerLevel): void {
    if (level === this.hungerLevel) return;
    this.hungerLevel = level;
    if (!this.hungerMarker) return;
    this.hungerMarker.visible = level !== 'normal';
    if (level !== 'normal') this.hungerMarker.material.map = warningTexture(level);
    this.hungerMarker.material.needsUpdate = true;
  }

  setAmbient(context: PetIdleContext): void {
    // React once when an owner *arrives* within view, not every frame
    // they remain nearby. The real pet routine is still authoritative.
    if (context.personNearby && !this.ambient.personNearby &&
        this.clock >= this.nextWelcome && petCanWelcome(context)) {
      this.welcomeUntil = this.clock + 6;
      // Owner arrival outranks *only* an old cosmetic loop.
      if(!this.route.length && !this.reaction &&
        (this.routine===null || this.routine==='wander')){
        this.idleGesture=null;
        this.idleTime=0;
        this.idleCooldown=0;
      }
    }
    this.ambient = context;
  }

  coatContact(target: THREE.Vector3): THREE.Vector3 {
    return this.body.localToWorld(target.set(0,this.id==='verdell'?.59:.58,.17));
  }

  syncGround(x: number, z: number): void {
    if (this.perchProgress>0) {
      this.pendingGround.set(x,0,z);
      this.hasPendingGround=true;
      return;
    }
    this.root.position.set(x,0,z);
  }

  currentIdleGesture(): PetIdleGesture | null { return this.idleGesture; }

  react(action: PetAction): void {
    this.stop();
    this.idleGesture = null;
    this.idleTime = 0;
    this.reaction = action;
    this.reactionTime = 0;
    this.playToy.visible = false;
  }

  followRoute(route: THREE.Vector3[], routine: PetRoutine['kind'], facing?: number,
    perch?:CatPerch,fetch?:{point:FloorPoint;pickupRemaining:number},onPetBed=false,supportHeight?:number,
    scratchPost?:FloorPoint,restSeed=0,toyIndex?:number): void {
    if(this.perch?.key!==perch?.key)this.releasePerch();
    if(this.id==='simba' && routine==='perch' && perch){
      this.perch=perch;
      this.perchHeight=supportHeight;
      this.perchRestPose=chooseCatRestPose(perch.catAnchor?.poses,perch.key,restSeed,perch.kind);
    }
    // A scheduled meal, sleep or walk always overrides a temporary play prop.
    this.reaction = null;
    this.reactionTime = 0;
    this.playToy.visible = false;
    this.fetchTargetToy.visible=false;
    this.onPetBed=onPetBed;
    this.petBedHeight=onPetBed?(supportHeight??0):0;
    this.scratchPost=scratchPost;
    this.toyIndex=routine==='toy'?toyIndex:undefined;
    this.fetchSpot=fetch?.point??null;
    this.fetchPickedUp=!!fetch&&fetch.pickupRemaining<.01;
    this.idleGesture = null;
    this.idleTime = 0;
    this.distance=0;
    this.route = route;
    this.routine = routine;
    this.facing = facing;
    this.settled = 0;
    this.stuckFor = 0;
    this.lastProgressGap = Infinity;
    this.rerouteCooldown = 0;
    this.yieldingTo = null;
  }

  private releasePerch(): void {
    if(this.perch && !this.leavingPerch && this.perchProgress>0){
      this.leavingPerch=this.perch;
      this.leavingRestPose=this.perchRestPose;
      this.leavingPerchHeight=this.perchHeight;
    }
    this.perch=null;
  }

  stop(): void {
    this.releasePerch();
    this.route = [];
    this.fetchSpot=null;
    this.onPetBed=false;
    this.scratchPost=undefined;
    this.toyIndex=undefined;
    this.animateHouseToys(0,0);
    this.fetchTargetToy.visible=false;
    this.fetchPickedUp=false;
    this.playToy.visible=false;
    this.routine = null;
    this.facing = undefined;
    this.settled = 0;
    this.stuckFor = 0;
    this.lastProgressGap = Infinity;
    this.rerouteCooldown = 0;
    this.yieldingTo = null;
  }

  update(dt: number, travel = 0, pace = 0,
    traffic?: { blockers: readonly FloorPoint[]; otherPet?: FloorPoint; obstacles: readonly FloorRect[]; floor: FloorRect }): void {
    this.rerouteCooldown = Math.max(0, this.rerouteCooldown - dt);
    // A person can physically close the courtyard doorway. Waiting without
    // walking in place is preferable to repeatedly rubbing along the walls.
    // Resume as soon as that *particular* blocker moves away.
    let waiting = !!this.yieldingTo && !!traffic &&
      traffic.blockers.some(b => Math.hypot(
        b.x - this.yieldingTo!.x, b.z - this.yieldingTo!.z) < .26);
    if (!waiting) this.yieldingTo = null;
    // Two pets sometimes mutually wait when both had to stop for a human.
    // Once the person leaves, let the dog repath from his *current* spot
    // rather than following an obsolete corner waypoint. Simba keeps her
    // own safe distance until Verdell actually moves out of the way.
    if (waiting && this.id === 'verdell' && traffic?.otherPet &&
      this.yieldingTo && this.route.length &&
      Math.hypot(traffic.otherPet.x - this.yieldingTo.x,
        traffic.otherPet.z - this.yieldingTo.z) < .26 &&
      !traffic.blockers.some(b => b !== traffic.otherPet &&
        Math.hypot(b.x - this.root.position.x, b.z - this.root.position.z) < 1.8)) {
      const goal = this.route[this.route.length - 1];
      const fresh = planPetRoute(this.root.position, goal, traffic);
      if (fresh?.path.length) {
        this.route = fresh.path.map(p => new THREE.Vector3(p.x, 0, p.z));
        this.yieldingTo = null;
        this.lastProgressGap = Infinity;
        this.stuckFor = 0;
        waiting = false;
      }
    }
    // Old saves can place a pet a few centimetres inside a newly widened
    // collider. Escape once to the nearest clear tile, not in an endless
    // series of tiny oscillations through the wall.
    if (traffic && this.route.length && !pointIsClear(this.root.position, traffic.obstacles, traffic.floor)) {
      const escape = nearestClearPoint(this.root.position, traffic.obstacles, traffic.floor);
      if (escape) {
        this.root.position.set(escape.x, 0, escape.z);
        this.stuckFor = 0;
        this.lastProgressGap = Infinity;
      }
    }
    // Descend to the same clear FLOOR approach before any new route moves.
    // This prevents an instant disappearance through the sofa on cancellation.
    const descending=this.id==='simba' && !!this.leavingPerch && this.perchProgress>0;
    if(descending){
      this.perchProgress=Math.max(0,this.perchProgress-dt/(this.leavingPerch?.entry==='inside'?1.45:.88));
      if(this.perchProgress<=0){
        this.leavingPerch=null;
        this.leavingPerchHeight=undefined;
        if(this.hasPendingGround){
          this.root.position.copy(this.pendingGround);
          this.hasPendingGround=false;
        }
      }
    }
    if (this.route.length && !descending) {
      const target = this.route[0];
      const dx = target.x - this.root.position.x, dz = target.z - this.root.position.z;
      const distance = Math.hypot(dx, dz);
      const step = Math.min(distance, dt * PET_SPEED[this.id]);
      let traveled = 0;
      if (distance > .001 && !waiting) {
        const next = traffic
          ? petTrafficStep(this.root.position, target, traffic.blockers,
              traffic.obstacles, traffic.floor, step, PET_PET_CLEARANCE)
          : { x: this.root.position.x + dx * step / distance,
              z: this.root.position.z + dz * step / distance };
        const motionX = next.x - this.root.position.x;
        const motionZ = next.z - this.root.position.z;
        traveled = Math.hypot(motionX, motionZ);
        if (traveled > .0001) {
          const yaw = Math.atan2(motionX, motionZ);
          const delta = Math.atan2(Math.sin(yaw - this.root.rotation.y), Math.cos(yaw - this.root.rotation.y));
          this.root.rotation.y += delta * (1 - Math.exp(-dt * 13));
          this.root.position.set(next.x, 0, next.z);
          this.distance += traveled;
          pace = this.routine==='fetch'?.95:.76;
        }
      }
      const remaining = Math.hypot(target.x - this.root.position.x,
        target.z - this.root.position.z);
      if (traffic && distance > .04 && !waiting) {
        // Progress is measured toward the actual waypoint, not the distance
        // of sideways shuffling, which previously caused indefinite twitching.
        // Checkpoint distance rather than one frame's microstep: a pet
        // shuffling back and forth can briefly move toward the waypoint
        // without making meaningful overall progress.
        if (remaining < this.lastProgressGap - .075) {
          this.lastProgressGap = remaining;
          this.stuckFor = 0;
        } else this.stuckFor += dt;
        if (this.stuckFor > 1.10 && this.rerouteCooldown <= 0) {
          this.rerouteCooldown = 3.6;
          this.stuckFor = 0;
          this.lastProgressGap = Infinity;
          const destination = this.route[this.route.length - 1];
          const detour = petTemporaryDetour(this.root.position, destination,
            traffic.blockers, traffic);
          if (detour && detour.path.length) {
            this.route = detour.path.map(point => new THREE.Vector3(point.x, 0, point.z));
          } else {
            // A genuine temporary blockage: remember the closest obstructing
            // body and stand calmly instead of oscillating until it leaves.
            let best = 1.85;
            for (const body of traffic.blockers) {
              const gap = Math.hypot(body.x - this.root.position.x, body.z - this.root.position.z);
              if (gap < best) {
                best = gap;
                this.yieldingTo = { x: body.x, z: body.z };
              }
            }
          }
        }
      }
      if (remaining < .018) {
        this.route.shift();
        this.stuckFor = 0;
        this.lastProgressGap = Infinity;
        // Most idle moments happen at the destination of a real roaming
        // route. Give these short pauses a chance to show their personality.
        if (!this.route.length && this.routine === 'wander')
          this.idleCooldown = Math.min(this.idleCooldown, .65);
      }
    } else if (this.routine && !descending) {
      this.settled += dt;
      if (this.facing !== undefined) {
        const delta = this.facing - this.root.rotation.y;
        this.root.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-dt * 8));
      }
    }
    if (this.routine) travel = this.distance;
    if(this.id==='simba' && this.perch && !this.route.length && !this.reaction && !descending){
      this.perchProgress=Math.min(1,this.perchProgress+dt/(this.perch.entry==='inside'?1.65:.95));
      const targetYaw=this.perch.yaw;
      const delta=THREE.MathUtils.euclideanModulo(targetYaw-this.root.rotation.y+Math.PI,2*Math.PI)-Math.PI;
      this.root.rotation.y+=delta*(1-Math.exp(-dt*4.5));
    }
    this.clock += dt;
    if (this.hungerMarker?.visible) {
      this.hungerMarker.position.y = (this.id === 'verdell' ? 1.43 : 1.44) + Math.sin(this.clock * 3.1) * 0.045;
      this.hungerMarker.material.opacity = this.hungerLevel === 'critical'
        ? 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(this.clock * 4.2)) : 1;
    }
    this.reactionTime += dt;
    // Cosmetic personality gestures only when nothing meaningful is happening.
    // Server-owned routes, feeding, sleep, toilet and player interactions win.
    const canIdle = !this.route.length &&
      (this.routine === null || this.routine === 'wander'||this.routine==='beg') && !this.reaction && pace < .08;
    if (!canIdle) {
      this.idleGesture = null;
      this.idleTime = 0;
      this.idleCooldown = Math.max(this.idleCooldown, 2.0);
    } else if(this.routine==='beg'){
      const gesture=this.id==='verdell'?'beg':'pawWave';
      if(this.idleGesture!==gesture){this.idleGesture=gesture;this.idleTime=0;}
      this.idleTime=(this.idleTime+dt)%PET_IDLE_SECONDS;
    } else if (this.idleGesture) {
      this.idleTime += dt;
      if (this.idleTime >= PET_IDLE_SECONDS) {
        this.idleGesture = null;
        this.idleTime = 0;
        this.idleCooldown = (this.id === 'verdell' ? 3.4 : 4.5) + (this.idleTurn % 3) * 1.1;
      }
    } else {
      this.idleCooldown -= dt;
      if (this.clock <= this.welcomeUntil && petCanWelcome(this.ambient)) {
        // Dog: a joyful bounce; cat: a quieter, unmistakably feline nuzzle.
        this.idleGesture = this.id === 'verdell' ? 'happyHop' : 'nuzzle';
        this.idleTime = 0;
        this.welcomeUntil = -1;
        this.nextWelcome = this.clock + (this.id === 'verdell' ? 60 : 90);
      } else if (this.idleCooldown <= 0) {
        this.idleGesture = choosePetIdle(this.id, this.ambient, this.idleTurn++);
        this.idleTime = 0;
      }
    }
    const idleWeight = this.idleGesture ? petIdleWeight(this.idleTime) : 0;
    const greeting = this.idleGesture === 'greet' ? idleWeight : 0;
    const grooming = this.idleGesture === 'groom' ? idleWeight : 0;
    const stretching = this.idleGesture === 'stretch' ? idleWeight : 0;
    const sniffing = this.idleGesture === 'sniff' ? idleWeight : 0;
    const watching = this.idleGesture === 'observe' ? idleWeight : 0;
    const foodLook = this.idleGesture === 'hungryLook' ? idleWeight : 0;
    const playBow = this.idleGesture === 'playBow' ? idleWeight : 0;
    const pawWave = this.idleGesture === 'pawWave' ? idleWeight : 0;
    const begging = this.idleGesture === 'beg' ? idleWeight : 0;
    const slowBlink = this.idleGesture === 'slowBlink' ? idleWeight : 0;
    const pounce = this.idleGesture === 'pounce' ? idleWeight : 0;
    const happyHop = this.idleGesture === 'happyHop' ? idleWeight : 0;
    const nuzzle = this.idleGesture === 'nuzzle' ? idleWeight : 0;
    const tiredHungry = this.ambient.bowl === 0 && this.ambient.satiety < 35
      ? (35 - this.ambient.satiety) / 35 : 0;
    const dog = this.id === 'verdell';
    const catInterest = !dog && this.ambient.personNearby && this.routine !== 'sleep' &&
      this.routine !== 'perch' &&
      this.routine !== 'eat' && this.routine !== 'toilet' ? .22 : 0;
    const t = this.clock + (dog ? 0 : 1.75);
    const r = this.reactionTime;
    if (r > 2.75) this.reaction = null;
    const weight = this.reaction ? Math.sin(Math.PI * Math.min(1, r / 2.75)) : 0;
    const toy=this.toyIndex!==undefined?DOG_TOYS[this.toyIndex]:undefined;
    const toyPlay=dog&&toy&&this.routine==='toy'&&!this.route.length
      &&Math.hypot(this.root.position.x-toy.x,this.root.position.z-(toy.z-.48))<.22
      ?Math.min(1,this.settled*2):0;
    const toyBeat=this.settled;
    const playful = this.reaction === 'play' ? weight : toyPlay*(toy?.kind==='marfa'?.26:toy?.kind==='rope'?.48:.74);
    const scratching=!dog && this.routine==='scratch' && !this.route.length
      ? Math.min(1,this.settled*2):0;
    const settled = Math.min(1, this.settled * 3);
    const pickup=dog&&this.routine==='fetch'&&this.fetchSpot&&!this.fetchPickedUp
      ? 1-THREE.MathUtils.smoothstep(Math.hypot(this.root.position.x-this.fetchSpot.x,
        this.root.position.z-this.fetchSpot.z),.22,.85) : 0;
    const eating = (this.reaction === 'feed'||this.reaction==='treat') ? weight : this.routine === 'eat' ? settled : 0;
    const surface=(descending?this.leavingPerch:this.perch);
    const perched=this.id==='simba' && surface && (descending||!this.route.length) ?
      THREE.MathUtils.smoothstep(this.perchProgress,.67,1) : 0;
    const curled=perched*(surface?.kind==='curl'?1:0);
    const lookout=perched*(surface?.kind==='watch'?1:0);
    const sleeping = this.routine === 'sleep' ? settled : curled*.92;
    // Purchased soft mats need an unmistakably reclined pose, not a pet
    // standing upright with the sleep icon. Keep the old floor/sofa poses.
    const matNap=this.onPetBed&&this.routine==='sleep'?settled:0;
    const dogNap=dog?matNap:0;
    const catNap=!dog?matNap:0;
    // The furniture chooses the actual stable skeletal pose; no frame-to-frame
    // randomization, no generic standing posture on a cushion.
    const restPoseId:CatRestPoseId|undefined=surface
      ? (descending?this.leavingRestPose:this.perchRestPose)
      : catNap>0?'mat_curl':undefined;
    const restPreset=restPoseId?CAT_REST_POSES[restPoseId]:undefined;
    const restWeight=surface?perched:catNap;
    const toilet = this.routine === 'toilet' ? settled : 0;
    const attention = this.reaction === 'pet' || this.reaction === 'brush' ? weight : 0;
    const smooth = 1 - Math.exp(-dt * 12);
    const pulse = Math.sin(t * (dog ? 2.6 : 1.9));
    const playBeat = Math.sin((toyPlay?toyBeat:r) * (dog ? 8 : 5.9));
    const lift = Math.max(0, playBeat) * playful;
    // A fetched ball starts at an actual reachable spot in WORLD space.
    // It stays on the ground until the dog physically reaches it, then
    // travels with the mouth on the return leg (no second ghost ball).
    if(dog&&this.routine==='fetch'&&this.fetchSpot){
      if(!this.fetchPickedUp && Math.hypot(this.root.position.x-this.fetchSpot.x,
        this.root.position.z-this.fetchSpot.z)<.29)this.fetchPickedUp=true;
      this.fetchTargetToy.visible=!this.fetchPickedUp;
      if(!this.fetchPickedUp){
        this.root.updateWorldMatrix(true,false);
        this.fetchTargetToy.position.copy(this.root.worldToLocal(
          new THREE.Vector3(this.fetchSpot.x,.125,this.fetchSpot.z)));
        this.fetchTargetToy.rotation.set(0,0,0);
      }
    }else this.fetchTargetToy.visible=false;
    const carrying=dog&&this.routine==='fetch'&&this.fetchPickedUp;
    this.playToy.visible=(playful>.07&&!toyPlay)||carrying;
    if(this.playToy.visible){
      this.playToy.position.set(
        (dog ? .11 : .15)+Math.sin(r*(dog?4.4:5.5))*.095*playful,
        dog ? .092+Math.max(0,Math.sin(r*7))*.10*playful : .053,
        dog ? .79+Math.cos(r*4.4)*.08*playful : .73+Math.cos(r*5.8)*.06*playful,
      );
      this.playToy.rotation.y=r*(dog?4.6:2.1);
      this.playToy.rotation.z=(dog ? .22 : -.11)*Math.sin(r*5)*playful;
      if(carrying){
        this.playToy.position.set(0,.38,.51);
        this.playToy.rotation.set(0,0,0);
      }
    }
    const stretch = dog ? 0 : 0.66 * attention + 0.53 * playful - 0.30 * eating;
    if (this.rig.back?.morphTargetInfluences) {
      this.rig.back.morphTargetInfluences[0] = 0.17 + 0.15 * pulse + stretch + stretching * .45;
    }
    this.body.scale.y = 1 + pulse * (dog ? 0.016 : 0.011) - eating * 0.045 - curled*.21
      - dogNap*.23 - catNap*.10;
    this.body.position.y = 0.081 + (dog ? lift * 0.083 : lift * 0.031 - playful * 0.028) - sleeping * .15
      + matNap*.14 + scratching*.13
      + greeting * Math.max(0, Math.sin(t * 7.5)) * .044 - stretching * (dog ? .027 : .032)
      - tiredHungry * .024 + foodLook * .017 * Math.sin(t * 6)
      - playBow * .064 + pounce * (.026*Math.sin(Math.PI*this.idleTime/PET_IDLE_SECONDS)-.033)
      + begging * .105 + happyHop * .142 * (0.5 + 0.5 * Math.sin(this.idleTime * 8.2));
    this.body.rotation.z = playBeat * playful * (dog ? 0.050 : 0.023) + sleeping * .13
      + dogNap*.045 + catNap*.025
      + greeting * .022 * Math.sin(t * 6.5) + happyHop * .075 * Math.sin(this.idleTime*8.2);
    this.body.rotation.x = -.13 * toilet - scratching*.18 + dogNap*.16 + catNap*.08
      + (dog ? -.10 : .11) * stretching
      + greeting * .085 + playBow * .17 + pounce * -.11 - begging * .49 + curled*.04;
    this.body.scale.z = 1 + dogNap*.12 - catNap*.14 +
      (dog ? 0.006 * pulse : -0.033 * playful + 0.024 * attention)
      + stretching * (dog ? .055 : .09);
    // Only the lightweight render group moves onto the cushion. The root and
    // all pathfinding/collision points remain safely on the floor approach.
    // The first/last second is a visible parabolic jump or controlled descent.
    if(!dog && surface && this.perchProgress>0){
      this.root.updateWorldMatrix(true,false);
      // surface.y already includes a small clearance over the real cushion.
      // The paw meshes extend below their pivots; adding +.25 used to leave
      // Simba ~40 cm ABOVE the sofa in actual WebGL frames. Correct the
      // foot-to-surface offset instead of visually teleporting the root.
      this.perchLocal.set(surface.surface.x,surface.surface.y-.125,surface.surface.z);
      this.root.worldToLocal(this.perchLocal);
      const t=this.perchProgress;
      const fraction=t*t*(3-2*t);
      this.body.position.x=this.perchLocal.x*fraction;
      this.body.position.z=this.perchLocal.z*fraction;
      this.body.position.y+=this.perchLocal.y*fraction+
        Math.sin(Math.PI*t)*Math.max(.42,surface.surface.y*.67);
      this.body.scale.x=1-.09*curled;
      this.body.scale.z*=1-.37*curled;
    }else{
      this.body.position.x=0;
      this.body.position.z=0;
      this.body.scale.x=1;
    }
    this.head.position.y = (dog ? .728 : .542) - dogNap*.17 - catNap*.11 +
      scratching*.08 + attention * (dog ? 0.038 : 0.057) - eating * (dog ? 0.056 : 0.073)
      - sniffing * .065 - grooming * .034 - stretching * .035
      - playBow * .065 + pawWave * .018 + pounce * .06 + begging * .032 + nuzzle*.018
      - curled*.12 - pickup*.33 - toyPlay*(toy?.kind==='marfa'?.15:.24);
    this.head.position.z = (dog ? .241 : .405) + dogNap*.06 - catNap*.08 +
      eating * (dog ? 0.027 : 0.053) + nuzzle*.065
      - curled*.075;
    this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x,
      pulse * 0.018 + eating * ((dog ? 0.61 : 0.49) + Math.sin(r * (dog ? 8 : 6)) * 0.09)
        - attention * (dog ? 0.13 : 0.26) + (dog ? 0 : 0.22 * playful)
        + sniffing * .43 + grooming * .35 - stretching * .24
         + toyPlay*(toy?.kind==='ball'?.55:.30) + pickup*.72 + foodLook * .37 + greeting * -.15 + tiredHungry * .12, smooth);
    this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y,
      (dog ? 0.27 : 0.38) * Math.sin(t * (dog ? 0.54 : 0.41)) ** 5 +
        attention * (dog ? 0.15 : -0.24) + (dog ? 0 : playBeat * 0.15 * playful)
        + watching * .24 + lookout*.28 + foodLook * .16 * Math.sin(t * 2.2) + greeting * .10
        + catInterest * Math.sin(t * 1.25) + nuzzle*.26
      + pounce * .19 * Math.sin(this.idleTime*2.1) + curled*.26 + (toy?.kind==='rope'?toyPlay*Math.sin(toyBeat*7)*.38:0), smooth);
    this.head.rotation.z = THREE.MathUtils.lerp(this.head.rotation.z,
      (dog ? 0.035 : 0.021) * Math.sin(t * 0.92) + attention * (dog ? 0.19 : -0.14)
      + greeting * .12 + grooming * -.16 + watching * .07
      + pawWave * .11 + begging * .07 * Math.sin(this.idleTime * 4.1)
      + nuzzle*.13*Math.sin(this.idleTime*3.0) + curled*.06, smooth);
    this.rig.jaw.position.y = (dog ? -0.007 * pulse : 0) - eating * (0.010 + 0.012 * Math.sin(r * 12));
    const ownerWag = dog && this.ambient.personNearby && this.ambient.satiety >= 25 &&
      this.routine !== 'sleep' && this.routine !== 'eat' && this.routine !== 'toilet' ? .48 : 0;
    this.tailPhase = (this.tailPhase + dt * (dog ? 5.2 + 7.8 * playful + 4 * ownerWag
      : 1.7 + 2.2 * playful)) % (2 * Math.PI);
    const flick = Math.sin(this.tailPhase);
    this.tail.rotation.y = dog
      ? (0.09 + 0.47 * weight + greeting * .74 + ownerWag) * flick
      : (0.12 + 0.37 * playful + watching * .16 + catInterest) * flick + 0.038 * Math.sin(t * 3.5)
        - attention * 0.13 + grooming * .07 * Math.sin(t * 5) + nuzzle*.14*Math.sin(this.idleTime*3.1)
        + curled*2.50;
    this.tail.rotation.x = dog ? 0.025 * pulse - foodLook * .22 - tiredHungry * .11
      : 0.09 * pulse - attention * 0.10 - tiredHungry * .08 - curled*.82;
    // The lean cat's long tail relaxes along the seat instead of continuing
    // to stick straight up like a flagpole while he sleeps.
    if(!dog){
      this.tail.position.y=.422-curled*.14;
      this.tail.scale.y=1-curled*.36;
    }
    const blinkPhase = t % (dog ? 5.3 : 6.4);
    const blink = blinkPhase < 0.22 ? 1 - 0.9 * Math.sin(blinkPhase / 0.22 * Math.PI) : 1;
    for (let i = 0; i < 2; i++) {
      this.rig.eyes[i].scale.y = THREE.MathUtils.lerp(this.rig.eyes[i].scale.y,
        blink * (1 - (dog ? 0.22 : 0.50) * attention) *
        (1 - .91 * sleeping) * (1 - slowBlink * .86), smooth);
      const ear = this.rig.ears[i];
      const flick = Math.max(0, Math.sin(t * 1.19 + i * 2)) ** 12;
      ear.rotation.x = flick * (dog ? 0.055 : 0.20) + attention * 0.11
        + watching * .14 + greeting * .07;
      ear.rotation.y = (i === 0 ? 1 : -1) * flick * (dog ? 0.06 : 0.24);
    }
    for (let i = 0; i < this.paws.length; i++) {
      const paw = this.paws[i];
      const front = i % 2 === 0;
      const pawLift = dog ? playBeat * (front ? 0.17 : -0.20) : front ? -0.21 : 0.072;
      paw.rotation.x = pawLift * playful + (scratching&&front ? -.68*scratching*(.55+.45*Math.sin(t*12+i*Math.PI)) : 0) + Math.sin(travel * (dog ? 16 / verdellScale : 15) + (i === 0 || i === 3 ? Math.PI : 0)) * pace * .33 +
        sleeping * (front ? -.55 : .37) + dogNap*(front?-.43:.22) +
        catNap*(front?-.24:.10) + toilet * (front ? .02 : .31)
        + (!dog && perched ? (front?-.47:.24)*perched : 0)
        + (dog ? front && i === 0 ? -.42 * foodLook * (0.6 + .4 * Math.sin(t * 6))
          + greeting * -.23 * (0.5 + .5 * Math.sin(t * 9))
          - pawWave * .62 * (0.5 + .5 * Math.sin(this.idleTime * 6.5))
          + playBow * .13 - happyHop * .28 : 0
          : i === 0 ? -1.25 * grooming * (0.87 + .13 * Math.sin(t * 8))
          - .35 * pounce : 0)
        - (front ? .30 : -.10) * stretching
        - (dog && front ? 1.06 * begging + .14 * begging *
          Math.sin(this.idleTime * 8 + i * 2) : 0);
      paw.position.y = (dog ? (front ? .225 : .268) : front ? .245 : .27) +
        (dog ? 0 : .018 * playful * (front ? 1 : 0))
        + (!dog && i === 0 ? grooming * .36 : 0)
        + (!dog && curled ? .09*curled : 0)
        + (dog && i === 0 ? foodLook * .18 * (0.5 + .5 * Math.sin(t * 6))
          + greeting * .09 * (0.5 + .5 * Math.sin(t * 9))
          + pawWave * .21 * (0.5 + .5 * Math.sin(this.idleTime * 6.5))
          - playBow * .035 + happyHop * .11 : 0)
        + (!dog && i < 2 ? pounce * -.045 : 0)
        + (dog && front ? .47 * begging : 0);
      if(dog){
        const phase=travel*19+(i===0||i===3?Math.PI:0);
        const swing=Math.max(0,-Math.cos(phase));
        const flex=swing*pace*.60 + dogNap*.69 + sleeping*.37
          + (front ? .62*begging + .19*pawWave : .24*toilet);
        const knee=this.rig.knees?.[i];
        if(knee)knee.rotation.x=flex*(front?1:-1);
        paw.position.y+=swing*pace*.045;
      }
      // A lifted paw reaches the cat's face, rather than twitching on the floor.
      paw.position.z = (dog ? (front ? .24 : -.32) : (front ? .285 : -.395)) +
        (!dog && curled ? (front?-.13:.09)*curled : 0) +
        (!dog && i === 0 ? grooming * .10 : 0) + (dog && front ? .075 * begging : 0);
      paw.position.x = (i < 2 ? -1 : 1) * (dog ? .16 : front ? .094 : .109) +
        (!dog && i === 0 ? grooming * .04 : 0)
        - (dog && front ? (i<2?-1:1)*.048*begging : 0);
    }
    if(carrying){
      // The ball follows the animated muzzle through head turns, bobs and bends.
      this.head.updateWorldMatrix(true,false);
      this.playToy.position.copy(this.root.worldToLocal(this.head.localToWorld(this.perchLocal.set(0,-.139,.365))));
    }
    if(dog)this.animateHouseToys(toyPlay,toyBeat);
    if(this.simbaRig){
      const rest=Math.max(sleeping*.94,catNap,lookout*.60);
      const phase=this.perchProgress;
      const entering=surface?.entry==='inside';
      const airborne=surface&&!entering?Math.sin(Math.PI*phase):0;
      const anticipation=surface?Math.sin(Math.PI*THREE.MathUtils.clamp(phase/.22,0,1))*.075:0;
      const loaf=Math.max(curled,lookout*.72,catNap);
      const coil=Math.max(curled,lookout*.36,catNap*.85);
      const crouch=.24*rest+.075*eating+.075*stretching+.105*toilet+.085*(playBow+pounce)+anticipation;
      // A real curled cat is a skeletal pose, not a stretched walking mesh.
      // Keep the silhouette recognizable; the bones do the actual tucking.
      this.body.scale.set(1,
        1+((restPreset?.height??1)-1)*restWeight,
        1+((restPreset?.length??1)-1)*restWeight);
      // Rock back onto the hind paws so the forelegs can reach up the post.
      // Gentle spinal side-rest, not a full body roll: a 40° roll made
      // the skinned knees point upwards like a beetle when resting on mats.
      // Bend the IK legs below the breast while the belly stays supported.
      this.body.rotation.set(
        THREE.MathUtils.lerp(-.65*scratching+.16*stretching,restPreset?.pitch??0,restWeight),
        0,(restPreset?.roll??0)*restWeight);
      const post=scratching>0?this.scratchPost:undefined;
      const distance=post?Math.hypot(post.x-this.root.position.x,post.z-this.root.position.z):0;
      const step=post?Math.max(0,distance/this.root.scale.z-.35):.16;
      // Lift only enough to clear the upholstery after bending the knees.
      const groundBodyY=-.025-crouch+lift*.022+.19*scratching;
      this.body.position.set(0,
        THREE.MathUtils.lerp(groundBodyY, -(restPreset?.sink??0),restWeight),
        step*scratching);
      if(surface&&phase>0){
        const horizontal=THREE.MathUtils.smootherstep(phase,entering?0:surface.entry==='jump'?.35:.25,1);
        const vertical=THREE.MathUtils.smootherstep(phase,.08,entering?.65:surface.entry==='jump'?.56:.82);
        const height=(descending?this.leavingPerchHeight:this.perchHeight)??surface.surface.y-.085;
        this.perchLocal.set(surface.surface.x,height,surface.surface.z);
        this.root.worldToLocal(this.perchLocal);
        this.body.position.x=this.perchLocal.x*horizontal;
        this.body.position.z=this.perchLocal.z*horizontal;
        this.body.position.y+=this.perchLocal.y*vertical+airborne*.31;
        const turn=THREE.MathUtils.smootherstep(phase,.78,1);
        const forward=surface.yaw-this.root.rotation.y;
        const runUp=descending?forward:forward+Math.PI;
        const final=forward+(restPreset?.yaw??(surface.kind==='curl'?Math.PI/2:0));
        this.body.rotation.y=THREE.MathUtils.lerp(runUp,final,turn);
        this.body.rotation.x+=airborne*(.12-phase*.26);
      }
      const contact=post?this.body.worldToLocal(this.perchLocal.set(
        post.x-.135*Math.sin(this.root.rotation.y),.57,
        post.z-.135*Math.cos(this.root.rotation.y))):undefined;
      const animate=(target?:THREE.Vector3)=>this.simbaRig!.pose(
        t,travel/this.root.scale.x+(entering?phase*1.4:0),entering&&phase>.02&&phase<.72?.48:pace,crouch,scratching,grooming+.54*playful+.85*pawWave,eating,
        this.tail.rotation.y-curled*2.50,rest,this.head.rotation,this.rig.ears,this.rig.eyes,
        airborne,rest,target,loaf,coil,restPoseId,restWeight);
      animate(contact);
      if(post){
        // The scratch target is a fixed REAL post, not a hand-waved offset.
        // Keep both rear ankles at floor height even when the torso rears up.
        const error=.070-this.simbaRig.hindContactHeight();
        const correction=THREE.MathUtils.clamp(error,-.17,.095)*scratching;
        if(Math.abs(correction)>.002){
          this.body.position.y+=correction;
          this.body.updateWorldMatrix(true,true);
          const fixed=this.body.worldToLocal(this.perchLocal.set(
            post.x-.135*Math.sin(this.root.rotation.y),.57,
            post.z-.135*Math.cos(this.root.rotation.y)));
          animate(fixed);
        }
      }
    }
    this.body.position.y+=matNap*this.petBedHeight/this.root.scale.y;

  }
}
