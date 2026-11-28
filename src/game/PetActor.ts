import * as THREE from 'three';
import {agilityHeight,type DogAgilityAction} from '../shared/dogAgility';
import type { SimbaRig } from './SimbaRig';
import type {DogBedSite} from '../shared/dogBed';
import type { CatPerch } from '../shared/CatPerches';
import { CAT_REST_POSES, chooseCatRestPose, type CatRestPoseId } from '../shared/CatRestPoses';
import {DOG_BATH_SURFACE} from '../shared/dogBath';
import { homeToysFor,homeToyApproach, PETS, PET_SPEED, type PetAction, type PetId, type PetRoutine, type PetHungerLevel } from '../shared/pets';
import { petHungerSprite, warningTexture } from './PetHungerMarker';
import { buildPetArt, simbaScale, verdellScale } from './PetArt';
import { createDogToy, createPetPlayToy,createShopToy } from './PetToys';
import { petTrafficStep, PET_PET_CLEARANCE } from './PetTraffic';
import { petStepPace, petPaceBlend, perchBodyYaw, petTurnMotion, petDreamMotion, samplePetStride, dogLegAngles } from './PetMotion';
import {newPetPerformance,samplePetPerformance,PET_PERFORMANCES} from './PetPerformance';
import {addPetReaction,petReactionSeconds,petReactionWeight,petSocialGesture} from './PetSocialMotion';
import {toyPhrase} from './PetToyMotion';
import { nearestClearPoint, pointIsClear } from './navigation';
import { petTemporaryDetour, planPetRoute } from './PetNavigation';
import type { FloorPoint, FloorRect } from './navigation';
import { PET_IDLE_SECONDS, choosePetIdle, petCanWelcome, petIdleWeight,
  type PetIdleContext, type PetIdleGesture } from './PetIdle';

export class PetActor {
  readonly root = new THREE.Group();
  readonly homeToys=new THREE.Group();
  private dogBed:DogBedSite|null=null;
  private dogBedLeaving=false;
  private pendingDogBed:DogBedSite|null=null;
  private napWeight=0;
  private previousYaw:number|undefined;
  private turnMotion=0;
  private turnDistance=0;
  private nextCompanion=0;
  private companionYaw=0;
  private companionActive=false;
  private readonly performance=newPetPerformance();
  private readonly walkStride={y:0,z:0,swing:0};
  private readonly gripOffset=new THREE.Vector3();
  private readonly legAngles={hip:0,knee:0};
  private animatedToyIndex:number|undefined;
  private dogBedProgress=0;
  private groomingHeld=false;
  setGroomingHeld(active:boolean){if(active&&!this.groomingHeld){this.stop();this.idleGesture=null;this.idleTime=0;this.reaction=null;}this.groomingHeld=active;}
  groomingPaw(target:THREE.Vector3){return this.simbaRig?this.simbaRig.groomingPaw(target):this.paws[2].localToWorld(target.set(0,-.12,.02));}
  private bathActive=false;
  private bathLift=0;
  private bathElapsed=0;
  setBath(active:boolean){if(this.id!=='verdell')return;if(active&&!this.bathActive)this.bathElapsed=0;this.bathActive=active;}
  audioMotion(){return {routine:this.routine,settled:this.settled,walking:this.route.length>0,training:this.training,toy:this.toyIndex===undefined?undefined:this.toys[this.toyIndex]?.kind,reaction:this.reaction};}
  get bathPhase(){return this.bathLift<.95?'lift':this.bathElapsed<6?'wet':this.bathElapsed<16?'soap':'rinse';}
  private event:import('../shared/petPreferences').PetEvent|undefined;
  private training:import('../shared/dogTraining').TrainingAttempt|undefined;
  private toyIndex:number|undefined;
  private manualToyPoint:FloorPoint|undefined;
  private manualToyVisual:FloorPoint|undefined;
  private readonly toys:ReturnType<typeof homeToysFor>;
  private readonly toyContact=new THREE.Vector3();
  private readonly body = new THREE.Group();
  private perch:CatPerch|null=null;
  private leavingPerch:CatPerch|null=null;
  private leavingPerchWasSettled=false;
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
  private reactionOwner:'vlad'|'alina'|undefined;
  private ownerLook:FloorPoint|undefined;
  private parkRollTime=0;
  private agility?:DogAgilityAction;
  setAgility(action:DogAgilityAction){this.agility=action;}
  private parkStick=false;
  setParkStick():void{this.parkStick=true;}
  parkRoll():void{this.stop();this.parkRollTime=6;}
  private route: THREE.Vector3[] = [];
  private routine: PetRoutine['kind'] | null = null;
  private facing: number | undefined;
  private distance = 0;
  private externalTravel = 0;
  private gaitPace = 0;
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
  private bedLift=0;
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
    if(id==='verdell')for(const group of [this.playToy,this.fetchTargetToy]){
      const stick=new THREE.Group();stick.name='Park stick';stick.visible=false;
      const mat=new THREE.MeshStandardMaterial({color:0x89613d,roughness:1});
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.021,.027,.48,7),mat);shaft.rotation.z=Math.PI/2;stick.add(shaft);
      const twig=new THREE.Mesh(new THREE.CylinderGeometry(.011,.016,.15,6),mat);twig.position.set(.12,.045,0);twig.rotation.z=-.65;stick.add(twig);group.add(stick);
    }
    this.fetchTargetToy.visible=false;
    this.root.add(this.playToy,this.fetchTargetToy);
    const dog = id === 'verdell';
    this.toys=homeToysFor(id);
    for(const toy of this.toys){
      const model='id' in toy?createShopToy(toy.kind,toy.manual,true):createDogToy(toy.kind);
      model.visible=!('id' in toy);
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
      const size = 0.38 / this.root.scale.x;
      this.hungerMarker.scale.set(size, size, 1);
      this.hungerMarker.position.set(0, dog ? 1.43 : 1.44, 0);
      this.root.add(this.hungerMarker);
    }
  }

  setHomeToyAvailability(obstacles:readonly FloorRect[],floor:FloorRect,owned:readonly string[]=[]):void{
    for(let i=0;i<this.toys.length;i++){
      const model=this.homeToys.children[i],toy=this.toys[i];
      if(model)model.visible='manual' in toy&&toy.manual?i===this.toyIndex&&!!this.manualToyPoint&&owned.includes(toy.id):(!('id' in toy)||owned.includes(toy.id))&&pointIsClear(toy,obstacles,floor)&&pointIsClear(homeToyApproach(this.id,i),obstacles,floor);
    }
  }
  manualToyContact(target:THREE.Vector3){if(!this.manualToyPoint||this.toyIndex===undefined)return;const toy=this.toys[this.toyIndex],model=this.homeToys.children[this.toyIndex];if(!('manual' in toy)||!toy.manual||!model?.visible)return;model.getWorldPosition(target);target.y+=toy.manual==='wand'?.20:toy.manual==='laser'?.015:.07;return toy.manual;}
  private animateHouseToys(weight:number,time:number):void{
    // Only the active prop and the one just released need transform writes.
    const active=weight>0||this.manualToyPoint?this.toyIndex:undefined;
    if(active===undefined&&this.animatedToyIndex===undefined)return;
    const indices=new Set([this.animatedToyIndex,active]);
    this.animatedToyIndex=active;
    for(const i of indices){
      if(i===undefined)continue;
      const model=this.homeToys.children[i],toy=this.toys[i];
      if(!model)continue;
      const point=i===this.toyIndex?this.manualToyVisual??this.manualToyPoint:undefined;model.position.set(point?.x??toy.x,.015,point?.z??toy.z);
      if('manual' in toy&&toy.manual)model.visible=!!point;
      model.rotation.set(0,0,0);
      model.scale.setScalar(1);
      for(const child of model.children){if(child.name==='Puzzle lid'){child.position.z=0;child.rotation.x=0;}if(child.name==='Feather stalk')child.rotation.set(0,0,0);}
      if(i!==this.toyIndex||!weight||!model.visible)continue;
      const phrase=toyPhrase(time,toy.kind);
      if(toy.kind==='ball'){
        const nudge=phrase.displaced*weight;
        model.position.z+=nudge*.18;
        model.position.x+=nudge*.055;
        model.rotation.x=nudge*1.9;
      }else if(toy.kind==='rope'||toy.kind==='bone'||toy.kind==='ring'||toy.kind==='marfa'){
        const hold=phrase.grip*weight;
        this.muzzleContact(this.toyContact);
        model.rotation.y=(this.root.rotation.y+(toy.kind==='rope'?0:Math.PI/2))*hold+phrase.shake*.30*weight;
        model.rotation.x=toy.kind==='ring'?Math.PI*.46*hold:0;
        model.rotation.z=phrase.shake*.16*weight;
        // A rope is held by its knot, a ring by its rim, not by their center.
        if(toy.kind==='rope')this.gripOffset.set(-.165,.04,0);
        else if(toy.kind==='ring')this.gripOffset.set(0,.04,-.115);
        else if(toy.kind==='marfa')this.gripOffset.set(0,.085,.07);
        else this.gripOffset.set(0,.055,0);
        this.gripOffset.applyEuler(model.rotation);
        this.toyContact.sub(this.gripOffset);
        model.position.lerp(this.toyContact,hold);
        model.scale.y=1-(toy.kind==='bone'?.10*hold*Math.max(0,Math.sin(time*13)):0);
      }else if(toy.kind==='puzzle'){
        const lids=model.children.filter(c=>c.name==='Puzzle lid');lids.forEach((lid,j)=>{lid.position.z=weight*.09*Math.max(0,Math.sin(time*2+j*Math.PI));lid.rotation.x=weight*.4*Math.max(0,Math.sin(time*2+j*Math.PI));});
      }else if('manual' in toy&&toy.manual==='laser'){
        model.position.x+=Math.sin(time*5)*weight*.055;model.position.z+=Math.cos(time*4)*weight*.035;
      }else if('manual' in toy&&toy.manual==='bell'){
        model.position.x+=weight*.16*phrase.displaced;model.rotation.z=-weight*phrase.displaced*2.7;
      }else if(toy.kind==='mouse'){
        const hit=phrase.displaced*weight;model.position.x+=hit*.11;model.position.z+=hit*.09;model.rotation.y=hit*.8;
      }else if(toy.kind==='spring'){
        const hit=phrase.displaced;model.position.x+=weight*.13*hit;model.position.y+=weight*.10*hit;model.rotation.x=weight*hit*2.6;model.rotation.z=weight*hit*.5;
      }else if(toy.kind==='feather'){
        const stalk=model.getObjectByName('Feather stalk');if(stalk){stalk.rotation.x=weight*.48*phrase.displaced;stalk.rotation.z=weight*.38*phrase.displaced*Math.sin(time*7);}
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

  muzzleContact(target:THREE.Vector3):THREE.Vector3{
    if(this.simbaRig)return this.simbaRig.muzzleContact(target);
    return this.head.localToWorld(target.set(0,-.139,.365));
  }

  coatContact(target: THREE.Vector3,stroke=0): THREE.Vector3 {
    const s=THREE.MathUtils.clamp(stroke,-1,1);
    // Stroke along the pet's back, not the resident's facing axis.
    return this.body.localToWorld(target.set(0,(this.id==='verdell'?.59:.58)+.012*(1-s*s),.17+.12*s));
  }

  syncGround(x: number, z: number): void {
    if (this.perchProgress>0||this.dogBedProgress>0) {
      this.pendingGround.set(x,0,z);
      this.hasPendingGround=true;
      return;
    }
    this.root.position.set(x,0,z);
  }

  currentIdleGesture(): PetIdleGesture | null { return this.idleGesture; }

  /** Isolated visual QA, used only by the explicit camera QA URL. */
  previewPerformanceQA(gesture:string):boolean{
    if(!(PET_PERFORMANCES[this.id] as readonly string[]).includes(gesture)||
      this.route.length||this.reaction||this.perchProgress||this.dogBedProgress||
      (this.routine!==null&&this.routine!=='wander'))return false;
    this.idleGesture=gesture as PetIdleGesture;this.idleTime=0;
    this.idleCooldown=4;return true;
  }
  performanceQA(){return {gesture:this.idleGesture,time:this.idleTime,turn:this.turnMotion,routine:this.routine,settled:this.settled,gait:this.gaitPace,distance:this.distance};}
  canGreetCompanion():boolean{
    return this.clock>=this.nextCompanion&&!this.idleGesture&&!this.route.length&&!this.reaction&&
      !this.perchProgress&&!this.dogBedProgress&&!this.bathActive&&!this.bathLift&&!this.parkRollTime&&
      this.napWeight<.05&&this.gaitPace<.08&&(this.routine===null||this.routine==='wander')&&
      this.ambient.satiety>=35&&this.ambient.energy>=42&&this.ambient.happiness>=48;
  }
  greetCompanion(other:FloorPoint):void{
    if(!this.canGreetCompanion())return;
    this.idleGesture=this.id==='verdell'?'dogInvite':'catInspect';
    this.idleTime=0;this.nextCompanion=this.clock+55;this.companionActive=true;
    this.companionYaw=Math.atan2(other.x-this.root.position.x,other.z-this.root.position.z);
  }
  watchCompanion(other:FloorPoint,clear:boolean):void{
    if(!this.companionActive)return;
    const distance=Math.hypot(other.x-this.root.position.x,other.z-this.root.position.z);
    if(!clear||distance>2||distance<.65){
      this.companionActive=false;
      if(this.idleGesture==='dogInvite'||this.idleGesture==='catInspect')this.idleGesture=null;
      return;
    }
    this.companionYaw=Math.atan2(other.x-this.root.position.x,other.z-this.root.position.z);
  }

  lookAtOwner(point:FloorPoint|undefined):void{this.ownerLook=point;}
  endOwnerReaction(role:'vlad'|'alina'):void{
    if(this.reactionOwner!==role)return;
    this.reactionOwner=undefined;
    this.reaction=null;
  }
  react(action: PetAction,owner?:'vlad'|'alina'): void {
    this.stop();
    this.idleGesture = null;
    this.idleTime = 0;
    this.reaction = action;this.reactionOwner=owner;
    this.reactionTime = 0;
    this.playToy.visible = false;
  }

  followRoute(route: THREE.Vector3[], routine: PetRoutine['kind'], facing?: number,
    perch?:CatPerch,fetch?:{point:FloorPoint;pickupRemaining:number},onPetBed=false,supportHeight?:number,
    scratchPost?:FloorPoint,restSeed=0,toyIndex?:number,training?:import('../shared/dogTraining').TrainingAttempt,event?:import('../shared/petPreferences').PetEvent,dogBed?:DogBedSite,manualToyPoint?:FloorPoint): void {
    if(this.id==='verdell'){
      if(dogBed&&this.dogBed?.stairs===dogBed.stairs&&this.dogBed.bed===dogBed.bed){
        this.dogBedLeaving=false;this.pendingDogBed=null;
      }else if(this.dogBedProgress>0){
        this.dogBedLeaving=true;this.pendingDogBed=dogBed??null;
      }else {this.dogBed=dogBed??null;this.dogBedLeaving=false;this.pendingDogBed=null;}
    }
    this.event=event;
    this.training=training;
    if(this.perch?.key!==perch?.key)this.releasePerch();
    if(this.id==='simba' && routine==='perch' && perch){
      this.perch=perch;
      this.perchHeight=supportHeight;
      this.perchRestPose=chooseCatRestPose(perch.catAnchor?.poses,perch.key,restSeed,perch.kind);
    }
    // A scheduled meal, sleep or walk always overrides a temporary play prop.
    this.reaction = null;this.reactionOwner=undefined;
    this.reactionTime = 0;
    this.playToy.visible = false;
    this.fetchTargetToy.visible=false;
    this.onPetBed=onPetBed;
    this.petBedHeight=onPetBed?(supportHeight??0):0;
    this.scratchPost=scratchPost;
    const oldPoint=this.manualToyPoint,oldIndex=this.toyIndex;this.toyIndex=routine==='toy'?toyIndex:undefined;this.manualToyPoint=routine==='toy'?manualToyPoint:undefined;this.manualToyVisual=manualToyPoint&&oldPoint&&oldIndex===toyIndex&&Math.hypot(oldPoint.x-manualToyPoint.x,oldPoint.z-manualToyPoint.z)<.65?{...oldPoint}:manualToyPoint?{...manualToyPoint}:undefined;if(this.manualToyPoint&&this.toyIndex!==undefined){const model=this.homeToys.children[this.toyIndex];if(model){model.visible=true;const p=this.manualToyVisual??this.manualToyPoint;model.position.set(p.x,.015,p.z);}}
    this.agility=undefined;this.parkStick=false;this.fetchSpot=fetch?.point??null;
    this.fetchPickedUp=!!fetch&&fetch.pickupRemaining<.01;
    this.idleGesture = null;
    this.idleTime = 0;
    // Keep foot phase continuous through route replacement and fetch return.
    this.companionActive=false;this.route = route;
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
      this.leavingPerchWasSettled=this.perchProgress>=.99;
      this.leavingRestPose=this.perchRestPose;
      this.leavingPerchHeight=this.perchHeight;
    }
    this.perch=null;
  }

  resortCareQA(){return {routine:this.routine,settled:this.settled,bedLift:this.bedLift,walking:this.route.length>0};}
  stop(): void {
    this.pendingDogBed=null;
    if(this.dogBedProgress>0)this.dogBedLeaving=true;else this.dogBed=null;
    this.releasePerch();
    this.route = [];
    this.agility=undefined;this.parkStick=false;this.fetchSpot=null;
    this.onPetBed=false;
    this.scratchPost=undefined;
    this.toyIndex=undefined;this.manualToyPoint=undefined;this.manualToyVisual=undefined;
    this.training=undefined;
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
    const externalStep=Math.max(0,travel-this.externalTravel);
    this.externalTravel=travel;
    if(this.routine||this.route.length||traffic)pace=0;
    else if(pace>0)this.distance+=externalStep;
    this.parkRollTime=Math.max(0,this.parkRollTime-dt);
    this.rerouteCooldown = Math.max(0, this.rerouteCooldown - dt);
    // A person can physically close the courtyard doorway. Waiting without
    // walking in place is preferable to repeatedly rubbing along the walls.
    // Resume as soon as that *particular* blocker moves away.
    let waiting = !!this.yieldingTo && !!traffic &&
      traffic.blockers.some(b => Math.hypot(
        b.x - this.yieldingTo!.x, b.z - this.yieldingTo!.z) < .26);
    // A pet behind us is no longer blocking our next step. In a narrow
    // corridor this releases the leading pet before the follower, instead
    // of both waiting forever after a person has moved away.
    if(waiting&&traffic?.otherPet&&this.yieldingTo&&this.route.length&&
      Math.hypot(traffic.otherPet.x-this.yieldingTo.x,traffic.otherPet.z-this.yieldingTo.z)<.26&&
      !traffic.blockers.some(b=>b!==traffic.otherPet&&Math.hypot(b.x-this.root.position.x,b.z-this.root.position.z)<1.8)){
      const target=this.route[0],p=this.root.position,b=traffic.otherPet;
      if((target.x-p.x)*(b.x-p.x)+(target.z-p.z)*(b.z-p.z)<=0){waiting=false;this.stuckFor=0;this.lastProgressGap=Infinity;}
    }
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
    const dogDescending=this.dogBedLeaving&&this.dogBedProgress>0;
    if(dogDescending){
      this.dogBedProgress=Math.max(0,this.dogBedProgress-dt/3.4);
      if(this.dogBedProgress===0){
        this.dogBed=this.pendingDogBed;this.pendingDogBed=null;this.dogBedLeaving=false;
        if(this.hasPendingGround){this.root.position.copy(this.pendingGround);this.hasPendingGround=false;}
      }
    }
    if (this.route.length && !descending&&!dogDescending) {
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
          pace = petStepPace(traveled,dt,PET_SPEED[this.id],this.routine==='fetch'?.95:.76);
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
    } else if (this.routine && !descending&&!dogDescending) {
      this.settled += dt;
      if (this.facing !== undefined) {
        const delta = this.facing - this.root.rotation.y;
        this.root.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-dt * 8));
      }
    }
    travel = this.distance;
    this.gaitPace=petPaceBlend(this.gaitPace,pace,dt);
    pace=this.gaitPace;
    if(this.id==='simba' && this.perch && !this.route.length && !this.reaction && !descending){
      this.perchProgress=Math.min(1,this.perchProgress+dt/(this.perch.entry==='inside'?1.65:.95));
      const targetYaw=this.perch.yaw;
      const delta=THREE.MathUtils.euclideanModulo(targetYaw-this.root.rotation.y+Math.PI,2*Math.PI)-Math.PI;
      this.root.rotation.y+=delta*(1-Math.exp(-dt*4.5));
    }
    if(this.dogBed&&!this.dogBedLeaving&&!dogDescending&&!this.route.length&&!this.reaction){
      this.dogBedProgress=Math.min(1,this.dogBedProgress+dt/3.4);
      const yaw=this.dogBed.climbYaw;
      this.root.rotation.y+=Math.atan2(Math.sin(yaw-this.root.rotation.y),Math.cos(yaw-this.root.rotation.y))*(1-Math.exp(-dt*9));
    }
    if(this.dogBedProgress>0&&this.dogBedProgress<1){pace=.7*THREE.MathUtils.smoothstep(this.dogBedProgress,0,.10)*(1-THREE.MathUtils.smoothstep(this.dogBedProgress,.78,1));travel+=this.dogBedProgress*2;}
    this.clock += dt;
    if (this.hungerMarker?.visible) {
      this.hungerMarker.position.y = (this.id === 'verdell' ? 1.43 : 1.44) + Math.sin(this.clock * 3.1) * 0.045;
      this.hungerMarker.material.opacity = this.hungerLevel === 'critical'
        ? 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(this.clock * 4.2)) : 1;
    }
    this.reactionTime += dt;
    if(this.reaction&&this.reactionTime>=petReactionSeconds(this.reaction)){
      this.reaction=null;this.reactionOwner=undefined;
    }
    // Cosmetic personality gestures only when nothing meaningful is happening.
    // Server-owned routes, feeding, sleep, toilet and player interactions win.
    const canIdle = !this.groomingHeld&&!descending&&!dogDescending&&!this.bathActive&&!this.bathLift&&!this.parkRollTime&&!this.route.length &&
      (this.routine === null || this.routine === 'wander'||this.routine==='beg'||this.routine==='event') && !this.reaction && pace < .08;
    if (!canIdle) {this.companionActive=false;
      this.idleGesture = null;
      this.idleTime = 0;
      this.idleCooldown = Math.max(this.idleCooldown, 2.0);
    } else if(this.routine==='event'&&this.event){
      const gesture:PetIdleGesture=this.event==='welcome'||this.event==='blink'?petSocialGesture(this.id,'welcome',this.settled):this.event;
      if(this.idleGesture!==gesture){this.idleGesture=gesture;this.idleTime=0;}
      this.idleTime=(this.idleTime+dt)%PET_IDLE_SECONDS;
    } else if(this.routine==='beg'){
      const gesture=petSocialGesture(this.id,'beg',this.settled);
      if(this.idleGesture!==gesture){this.idleGesture=gesture;this.idleTime=0;}
      this.idleTime=(this.idleTime+dt)%PET_IDLE_SECONDS;
    } else if (this.idleGesture) {
      this.idleTime += dt;
      if (this.idleTime >= PET_IDLE_SECONDS) {
        this.idleGesture = null;
        this.idleTime = 0;
        this.idleCooldown = (this.id === 'verdell' ? 1.8 : 2.4) + ((this.idleTurn*7)%5)*.55 + (this.ambient.energy<40?3:0);
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
    if(this.companionActive){
      if(this.idleGesture!=='dogInvite'&&this.idleGesture!=='catInspect')this.companionActive=false;
      else{
        const delta=Math.atan2(Math.sin(this.companionYaw-this.root.rotation.y),Math.cos(this.companionYaw-this.root.rotation.y));
        this.root.rotation.y+=delta*(1-Math.exp(-dt*5));
      }
    }
    const turnAllowed=!this.groomingHeld&&!descending&&!dogDescending&&!this.perchProgress&&!this.dogBedProgress&&!this.bathActive&&!this.parkRollTime&&this.napWeight<.1&&this.routine!=='sleep';
    this.turnMotion=petTurnMotion(this.turnMotion,this.previousYaw??this.root.rotation.y,this.root.rotation.y,dt);
    this.previousYaw=this.root.rotation.y;
    const turn=turnAllowed?this.turnMotion:0;
    this.turnDistance+=Math.abs(turn)*dt*.48*(1-pace);
    const stepPace=Math.max(pace,Math.abs(turn)*.48);
    const gaitTravel=travel+this.turnDistance;
    const idleWeight = this.idleGesture ? petIdleWeight(this.idleTime) : 0;
    // Undo previous additive head motion before updating the smoothed base.
    this.head.rotation.x-=this.performance.headPitch;
    this.head.rotation.y-=this.performance.headYaw;
    this.head.rotation.z-=this.performance.headRoll;
    const performance=samplePetPerformance(this.performance,this.id,this.idleGesture,this.idleTime,idleWeight);
    const greeting = this.idleGesture === 'greet' ? idleWeight : 0;
    const grooming = this.idleGesture === 'groom' ? idleWeight : 0;
    const stretching = this.idleGesture === 'stretch' ? idleWeight : 0;
    const sniffing = this.idleGesture === 'sniff' ? idleWeight : 0;
    const watching = this.idleGesture === 'observe' ? idleWeight : 0;
    const foodLook = this.idleGesture === 'hungryLook' ? idleWeight : 0;
    const playBow = this.idleGesture === 'playBow' ? idleWeight : 0;
    const command=this.id==='verdell'&&this.routine==='train'&&!this.route.length?this.training:undefined;
    const commandWeight=command?Math.min(1,this.settled*2):0;const trained=command?.success?commandWeight:0;
    const sit=trained*(command?.command==='sit'||command?.command==='paw'?1:0);const lie=trained*(command?.command==='lie'?1:0);
    const bark=trained*(command?.command==='bark'?Math.max(0,Math.sin(this.settled*8))**2:0);
    const stay=trained*(command?.command==='stay'?1:0);const confused=command&&!command.success?commandWeight:0;
    const pawWave = (this.idleGesture === 'pawWave' ? idleWeight : 0)+trained*(command?.command==='paw'?1:0);
    const begging = (this.idleGesture === 'beg' ? idleWeight : 0)+trained*(command?.command==='beg'?1:0);
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
    addPetReaction(performance,this.id,this.reaction,r,petReactionWeight(r,this.reaction));
    const weight = petReactionWeight(r,this.reaction);
    // Head tracks a real nearby owner rather than staring in a random direction.
    // Only use this channel during social attention; never for food/sleep/routes.
    const socialLook=this.ownerLook&&!this.route.length&&!descending&&!dogDescending&&
      (this.routine==='beg'||this.routine==='event'&&(this.event==='welcome'||this.event==='blink')||
        this.idleGesture==='greet'||this.idleGesture==='happyHop'||this.idleGesture==='nuzzle')?this.ownerLook:undefined;
    if(socialLook){
      const yaw=Math.atan2(socialLook.x-this.root.position.x,socialLook.z-this.root.position.z)-this.root.rotation.y;
      performance.headYaw+=THREE.MathUtils.clamp(Math.atan2(Math.sin(yaw),Math.cos(yaw)),-.62,.62)*idleWeight;
      performance.headPitch-=.18*idleWeight;
    }
    const toy=this.toyIndex!==undefined?this.toys[this.toyIndex]:undefined;
    const toyApproach=this.manualToyPoint?{x:this.manualToyPoint.x,z:this.manualToyPoint.z-.39}:toy?homeToyApproach(this.id,this.toyIndex!):undefined;
    const toyPlay=toy&&toyApproach&&this.routine==='toy'&&!this.route.length&&this.homeToys.children[this.toyIndex!]?.visible
      &&Math.hypot(this.root.position.x-toyApproach.x,this.root.position.z-toyApproach.z)<.22
      ?Math.min(1,this.settled*2):0;
    const toyBeat=this.settled;
    const phrase=toy?toyPhrase(toyBeat,toy.kind):undefined;
    if(toyPlay&&phrase&&dog){
      performance.headDrop+=toyPlay*phrase.lower*.16;
      performance.headPitch+=toyPlay*phrase.lower*.24-toyPlay*phrase.grip*.18;
      performance.headYaw+=toyPlay*phrase.shake*.18;
      if(toy?.kind==='ball'){
        performance.headPitch+=toyPlay*phrase.strike*.16;
        performance.headDrop+=toyPlay*phrase.strike*.085;
      }
    }
    const playful = this.reaction === 'play' ? weight : toyPlay*(toy?.kind==='marfa'?.26:toy?.kind==='rope'?.48:toy?.kind==='bone'?.24:toy?.kind==='puzzle'?.12:toy?.kind==='spring'?.44:.74);
    const catToy=!dog?toyPlay:0;const catPounce=catToy*(toy?.kind==='mouse'?Math.max(0,Math.sin(toyBeat*2.5))**3:0);
    const catStrike=catToy*(phrase?.strike??0);
    const puzzle=toy?.kind==='puzzle'?toyPlay:0;
    const scratching=!dog && this.routine==='scratch' && !this.route.length
      ? Math.min(1,this.settled*2):0;
    const settled = Math.min(1, this.settled * 3);
    const pickup=dog&&this.routine==='fetch'&&this.fetchSpot&&!this.fetchPickedUp
      ? 1-THREE.MathUtils.smoothstep(Math.hypot(this.root.position.x-this.fetchSpot.x,
        this.root.position.z-this.fetchSpot.z),.22,.85) : 0;
    const eating = this.reaction==='feed'?weight:this.reaction==='treat'?weight*.25*THREE.MathUtils.smoothstep(r,1,1.6)*(1-THREE.MathUtils.smoothstep(r,3.8,4.55)):this.routine==='eat'?settled:0;
    const surface=(descending?this.leavingPerch:this.perch);
    const perched=this.id==='simba' && surface && (descending||!this.route.length) ?
      THREE.MathUtils.smoothstep(this.perchProgress,.67,1) : 0;
    const curled=perched*(surface?.kind==='curl'?1:0);
    const lookout=perched*(surface?.kind==='watch'?1:0);
    const dogBedNap=this.dogBed?THREE.MathUtils.smoothstep(this.dogBedProgress,.78,1):0;
    this.napWeight=THREE.MathUtils.damp(this.napWeight,this.routine==='sleep'?settled:0,7,dt);
    const sleeping = Math.max(this.napWeight,curled*.92,dogBedNap);
    const dream=petDreamMotion(this.clock,sleeping,this.id==='simba'?5:0);
    performance.ear+=dream*.055;performance.tail+=dream*.045;
    performance.pawPitch[0]+=dream*.055;performance.pawPitch[3]-=dream*.04;
    performance.pawY[0]+=Math.abs(dream)*.009;
    // Purchased soft mats need an unmistakably reclined pose, not a pet
    // standing upright with the sleep icon. Keep the old floor/sofa poses.
    const matNap=this.onPetBed&&this.routine==='sleep'?settled:0;
    const dogNap=dog?Math.max(this.napWeight,dogBedNap):0;
    const catNap=!dog&&!surface?this.napWeight:0;
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
    const mealBeat=this.routine==='eat'?this.settled:r;
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
    if(dog)for(const group of [this.playToy,this.fetchTargetToy])for(const child of group.children)child.visible=child.name==='Park stick'?this.parkStick:!this.parkStick;
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
      -sit*.085-lie*.235+bark*.035+ begging * .105 + happyHop * .142 * (0.5 + 0.5 * Math.sin(this.idleTime * 8.2));
    this.body.rotation.z = playBeat * playful * (dog ? 0.050 : 0.023) + sleeping * .13
      + dogNap*.045 + catNap*.025
      + greeting * .022 * Math.sin(t * 6.5) + happyHop * .075 * Math.sin(this.idleTime*8.2);
    if(this.parkRollTime>0&&dog){const progress=6-this.parkRollTime;const w=Math.min(1,progress/.6,this.parkRollTime/.6);this.body.rotation.z+=w*(Math.PI+.45*Math.sin(progress*5));this.body.position.y+=w*.32;}
    this.body.rotation.x = -.13 * toilet - scratching*.18 + dogNap*.16 + catNap*.08
      + (dog ? -.10 : .11) * stretching
      + greeting * .085 + playBow * .17 + pounce * -.11 - begging * .49 + curled*.04-sit*.30+lie*.055-bark*.12;
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
    if(dog&&this.dogBed&&this.dogBedProgress>0){
      const site=this.dogBed,points=[{...site.approach,y:0},...site.steps];
      const t=this.dogBedProgress*(points.length-1),i=Math.min(points.length-2,Math.floor(t));
      const p=points[i],q=points[i+1],k=THREE.MathUtils.smoothstep(t-i,0,1);
      this.root.updateWorldMatrix(true,false);
      this.perchLocal.set(THREE.MathUtils.lerp(p.x,q.x,k),THREE.MathUtils.lerp(p.y,q.y,k),THREE.MathUtils.lerp(p.z,q.z,k));
      this.root.worldToLocal(this.perchLocal);
      this.body.position.x=this.perchLocal.x;this.body.position.z=this.perchLocal.z;
      this.body.position.y+=this.perchLocal.y;
      const final=THREE.MathUtils.smoothstep(this.dogBedProgress,.78,1);
      const a=site.climbYaw-this.root.rotation.y,b=site.yaw-this.root.rotation.y;
      this.body.rotation.y=a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*final;
    }else if(dog)this.body.rotation.y=0;
    this.head.position.y = (dog ? .728 : .542) - dogNap*.17 - catNap*.11 +
      scratching*.08 + attention * (dog ? 0.038 : 0.057) - eating * (dog ? 0.056 : 0.073)
      - sniffing * .065 - grooming * .034 - stretching * .035
      - playBow * .065 + pawWave * .018 + pounce * .06 + begging * .032 + nuzzle*.018
      - curled*.12-sit*.035-lie*.15 - pickup*.33 - toyPlay*(toy?.kind==='marfa'?.15:.24);
    this.head.position.z = (dog ? .241 : .405) + dogNap*.06 - catNap*.08 +
      eating * (dog ? 0.027 : 0.053) + nuzzle*.065
      - curled*.075;
    this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x,
      pulse * 0.018 + eating * ((dog ? 0.61 : 0.49) + Math.sin(mealBeat * (dog ? 8 : 6)) * 0.09)
        - attention * (dog ? 0.13 : 0.26) + (dog ? 0 : 0.22 * playful)
        + sniffing * .43 + grooming * .35 - stretching * .24
         + toyPlay*(toy?.kind==='ball'?.55:.30)-bark*.28-lie*.10+confused*.10 + pickup*.72 + foodLook * .37 + greeting * -.15 + tiredHungry * .12, smooth);
    this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y,
      (dog ? 0.27 : 0.38) * Math.sin(t * (dog ? 0.54 : 0.41)) ** 5 * (1-.90*eating)*(1-.9*sleeping) +
        attention * (dog ? 0.15 : -0.24) + (dog ? 0 : playBeat * 0.15 * playful)
        + watching * .24 + lookout*.28 + foodLook * .16 * Math.sin(t * 2.2) + greeting * .10
        + catInterest * Math.sin(t * 1.25) + nuzzle*.26+confused*.58*Math.sin(this.settled*1.9)-stay*.1*Math.sin(t*.54)
      + pounce * .19 * Math.sin(this.idleTime*2.1) + curled*.26 + (toy?.kind==='rope'||toy?.kind==='ring'?toyPlay*Math.sin(toyBeat*7)*.38:0)+catToy*Math.sin(toyBeat*3)*.26, smooth);
    this.head.rotation.z = THREE.MathUtils.lerp(this.head.rotation.z,
      (dog ? 0.035 : 0.021) * Math.sin(t * 0.92) + attention * (dog ? 0.19 : -0.14)
      + greeting * .12 + grooming * -.16 + watching * .07
      + pawWave * .11 + begging * .07 * Math.sin(this.idleTime * 4.1)
      + nuzzle*.13*Math.sin(this.idleTime*3.0) + curled*.06+confused*.29, smooth);
    this.rig.jaw.position.y = (dog ? -0.007 * pulse : 0)-bark*.065 - eating * (0.010 + 0.012 * Math.sin(mealBeat * 12))-(toy?.kind==='bone'?toyPlay*.025*(.5+.5*Math.sin(toyBeat*13)):0);
    const ownerWag = dog && this.ambient.personNearby && this.ambient.satiety >= 25 &&
      this.routine !== 'sleep' && this.routine !== 'eat' && this.routine !== 'toilet' ? .48*(1-sleeping) : 0;
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
    // Blend into a planted gait only during real locomotion/turning. Rest,
    // trained poses, toys and the stairs retain their authored joint poses.
    const planted=dog&&!this.dogBedProgress&&!this.bathLift&&!this.parkRollTime&&!this.reaction
      ?THREE.MathUtils.smoothstep(stepPace,.04,.48):0;
    for (let i = 0; i < this.paws.length; i++) {
      const paw = this.paws[i];
      const front = i % 2 === 0;
      const pawLift = dog ? playBeat * (front ? 0.17 : -0.20) : front ? -0.21 : 0.072;
      const walkPhase=gaitTravel*(dog?19:15)+[0,Math.PI*.52,Math.PI,Math.PI*1.52][i];
      const trotPhase=gaitTravel*(dog?19:15)+(i===0||i===3?Math.PI:0);
      const trot=THREE.MathUtils.smoothstep(pace,.56,.88);
      const gait=THREE.MathUtils.lerp(Math.sin(walkPhase),Math.sin(trotPhase),trot);
      paw.rotation.x = pawLift * playful + (scratching&&front ? -.68*scratching*(.55+.45*Math.sin(t*12+i*Math.PI)) : 0) + gait * stepPace * .43 +
        sleeping * (front ? -.55 : .37) + dogNap*(front?-.43:.22) +
        catNap*(front?-.24:.10) + toilet * (front ? .02 : .31)
        + (!dog && perched ? (front?-.47:.24)*perched : 0)
        + (dog ? front && i === 0 ? -.42 * foodLook * (0.6 + .4 * Math.sin(t * 6))
          + greeting * -.23 * (0.5 + .5 * Math.sin(t * 9))
          - pawWave * .62 * (0.5 + .5 * Math.sin(this.idleTime * 6.5))
          + playBow * .13 - happyHop * .28 : 0
          : i === 0 ? -1.25 * grooming * (0.87 + .13 * Math.sin(t * 8))
          - .35 * pounce : 0)
        - (front ? .30 : -.10) * stretching+sit*(front?.27:.79)+lie*(front?-1.12:.55)-(dog&&i===0?puzzle*.85*Math.max(0,Math.sin(toyBeat*2)):0)-(!dog&&front?catStrike*.65*Math.max(0,Math.sin(toyBeat*4+i)):0)
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
        + (dog && front ? .47 * begging : 0)+sit*(front?.025:.10)+lie*.12+(dog&&i===0?puzzle*.15*Math.max(0,Math.sin(toyBeat*2)):0);
      if(dog){
        const phase=walkPhase;
        const swing=THREE.MathUtils.lerp(Math.max(0,-Math.cos(phase)),Math.max(0,-Math.cos(trotPhase)),trot);
        const flex=swing*stepPace*.60 + dogNap*.69 + sleeping*.37
          + (front ? .62*begging + .19*pawWave : .24*toilet)+sit*(front?.08:.78)+lie*(front?.65:.48);
        const knee=this.rig.knees?.[i];
        if(knee)knee.rotation.x=(flex+performance.knee[i])*(front?1:-1);
        paw.position.y+=swing*stepPace*.075;
        if(planted>0){
          const localDistance=gaitTravel/this.root.scale.x;
          const offset=THREE.MathUtils.lerp([0,.73,.5,.23][i],[0,.5,.5,0][i],trot);
          const stride=samplePetStride(localDistance,.46,THREE.MathUtils.lerp(.67,.52,trot),
            offset,THREE.MathUtils.lerp(.075,.12,trot),this.walkStride);
          const z=stride.z,h=stride.y;
          const len=front?.225:.268;
          const angle=dogLegAngles(-len+.055+h,z,len,front,this.legAngles);
          paw.rotation.x=THREE.MathUtils.lerp(paw.rotation.x,angle.hip,planted);
          if(knee)knee.rotation.x=THREE.MathUtils.lerp(knee.rotation.x,angle.knee,planted);
          paw.position.y=THREE.MathUtils.lerp(paw.position.y,len,planted);
        }
      }
      // A lifted paw reaches the cat's face, rather than twitching on the floor.
      paw.position.z = (dog ? (front ? .24 : -.32) : (front ? .285 : -.395)) +
        (!dog && curled ? (front?-.13:.09)*curled : 0) +
        (!dog && i === 0 ? grooming * .10 : 0) + (dog && front ? .075 * begging : 0)+sit*(front?.055:.13)+lie*(front?.24:.12);
      paw.position.x = (i < 2 ? -1 : 1) * (dog ? .16 : front ? .094 : .109) +
        (!dog && i === 0 ? grooming * .04 : 0)
        - (dog && front ? (i<2?-1:1)*.048*begging : 0);
    }
    // These are actual joint/body channels, rather than a collection of icons
    // or name-only idle variants. Keep the physics root fixed.
    this.head.rotation.x+=performance.headPitch;
    this.head.rotation.y+=performance.headYaw;
    this.head.rotation.z+=performance.headRoll;
    this.head.position.y-=performance.headDrop;
    this.tail.rotation.y+=performance.tail;
    for(const ear of this.rig.ears)ear.rotation.x+=performance.ear;
    for(const eye of this.rig.eyes)eye.scale.y*=1-performance.eye;
    if(dog||!this.simbaRig){
      this.body.position.y+=performance.y+Math.abs(Math.sin(travel*19))*pace*.014-.055*planted;
      this.body.position.z+=performance.z;
      this.body.rotation.x+=performance.pitch+.035*pace*Math.sin(travel*19);
      this.body.rotation.z+=performance.roll+.036*pace*Math.sin(travel*9.5)-turn*.115;
      this.rig.jaw.position.y-=performance.jaw;
      for(let i=0;i<this.paws.length;i++){
        const paw=this.paws[i];paw.position.y+=performance.pawY[i];
        paw.position.z+=performance.pawZ[i];paw.rotation.x+=performance.pawPitch[i];
      }
    }
    if(carrying){
      // The ball follows the animated muzzle through head turns, bobs and bends.
      this.head.updateWorldMatrix(true,false);
      this.playToy.position.copy(this.root.worldToLocal(this.head.localToWorld(this.perchLocal.set(0,-.139,.365))));
    }
    if(dog&&this.agility){const h=agilityHeight(this.agility,this.root.position);this.body.position.y+=h/this.root.scale.y;if(this.agility==='dogHurdle'&&h>.05){this.body.rotation.x-=.14*Math.sin(this.root.position.z*5);for(const paw of this.paws){paw.position.y+=h*.18;}}}
    if(this.manualToyVisual&&this.manualToyPoint){const p=this.manualToyVisual,t=this.manualToyPoint,k=1-Math.exp(-dt*12);p.x+=(t.x-p.x)*k;p.z+=(t.z-p.z)*k;}
    this.animateHouseToys(toyPlay,toyBeat);
    if(this.simbaRig){
      const rest=Math.max(sleeping*.94,catNap,lookout*.60);
      const phase=this.perchProgress;
      const entering=surface?.entry==='inside';
      const airborne=surface&&!entering?Math.sin(Math.PI*phase):0;
      const anticipation=surface?Math.sin(Math.PI*THREE.MathUtils.clamp(phase/.22,0,1))*.075:0;
      const loaf=Math.max(curled,lookout*.72,catNap);
      const coil=Math.max(curled,lookout*.36,catNap*.85);
      const crouch=.24*rest+.075*eating+.075*stretching+.105*toilet+.085*(playBow+pounce)+anticipation+catToy*(toy?.kind==='mouse'?.13*(1-catPounce):.04);
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
      const groundBodyY=-.025-crouch+lift*.022+.19*scratching+catPounce*.19;
      this.body.position.set(0,
        THREE.MathUtils.lerp(groundBodyY, -(restPreset?.sink??0),restWeight),
        step*scratching+catPounce*.16);
      this.body.position.y+=performance.y+pace*.018*Math.sin(travel*17);
      this.body.position.z+=performance.z;
      this.body.rotation.x+=performance.pitch;
      this.body.rotation.z+=performance.roll+.025*pace*Math.sin(travel*9)-turn*.08;
      if(surface&&phase>0){
        const horizontal=THREE.MathUtils.smootherstep(phase,entering?0:surface.entry==='jump'?.35:.25,1);
        const vertical=THREE.MathUtils.smootherstep(phase,.08,entering?.65:surface.entry==='jump'?.56:.82);
        const height=(descending?this.leavingPerchHeight:this.perchHeight)??surface.surface.y-.085;
        this.perchLocal.set(surface.surface.x,height,surface.surface.z);
        this.root.worldToLocal(this.perchLocal);
        this.body.position.x=this.perchLocal.x*horizontal;
        this.body.position.z=this.perchLocal.z*horizontal;
        this.body.position.y+=this.perchLocal.y*vertical+airborne*.31;
        const forward=surface.yaw-this.root.rotation.y;
        this.body.rotation.y=perchBodyYaw(phase,forward,restPreset?.yaw??(surface.kind==='curl'?Math.PI/2:0),descending&&this.leavingPerchWasSettled);
        this.body.rotation.x+=airborne*(.12-phase*.26);
      }
      const contact=post?this.body.worldToLocal(this.perchLocal.set(
        post.x-.135*Math.sin(this.root.rotation.y),.57,
        post.z-.135*Math.cos(this.root.rotation.y))):undefined;
      const toyModel=catToy?this.homeToys.children[this.toyIndex!]:undefined;
      const toyContact=toyModel?this.body.worldToLocal(
        toy?.kind==='feather'&&toyModel.getObjectByName('Feather stalk')
          ?toyModel.getObjectByName('Feather stalk')!.localToWorld(this.toyContact.set(0,.25,0))
          :toyModel.localToWorld(this.toyContact.set(0,.055,0))):undefined;
      const animate=(target?:THREE.Vector3)=>this.simbaRig!.pose(
        t,gaitTravel/this.root.scale.x+(entering?phase*1.4:0),entering&&phase>.02&&phase<.72?.48:stepPace,crouch,scratching,grooming+.54*playful+.85*pawWave,eating,
        this.tail.rotation.y-curled*2.50,rest,this.head.rotation,this.rig.ears,this.rig.eyes,
        airborne+catPounce,rest,target,loaf,coil,restPoseId,restWeight,toyContact,catStrike,toy?.kind==='spring',performance);
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
    this.bedLift=THREE.MathUtils.damp(this.bedLift,matNap*this.petBedHeight,9,dt);
    this.body.position.y+=this.bedLift/this.root.scale.y;
    if(dog&&(this.bathActive||this.bathLift>0)){
      this.bathLift=THREE.MathUtils.clamp(this.bathLift+dt*(this.bathActive?1:-1)/1.25,0,1);
      if(this.bathActive&&this.bathLift>=.95)this.bathElapsed+=dt;
      const w=THREE.MathUtils.smoothstep(this.bathLift,0,1),arc=Math.sin(Math.PI*this.bathLift);
      this.root.updateWorldMatrix(true,false);this.perchLocal.set(DOG_BATH_SURFACE.x,DOG_BATH_SURFACE.y,DOG_BATH_SURFACE.z);this.root.worldToLocal(this.perchLocal);
      this.body.position.x+=this.perchLocal.x*w;this.body.position.z+=this.perchLocal.z*w;this.body.position.y+=this.perchLocal.y*w+arc*.56;
      this.body.rotation.y=THREE.MathUtils.euclideanModulo(-this.root.rotation.y+Math.PI,2*Math.PI)-Math.PI;this.body.rotation.y*=w;
      this.head.rotation.x+=w*.055*Math.sin(this.bathElapsed*2);this.head.rotation.y+=w*.17*Math.sin(this.bathElapsed*1.8);
      this.tail.rotation.y+=w*.28*Math.sin(this.bathElapsed*5);
      if(this.bathElapsed>17){const shake=Math.max(0,Math.sin(this.bathElapsed*1.4))**4;this.body.rotation.z+=w*shake*.055*Math.sin(this.bathElapsed*18);}
    }else if(dog&&!this.dogBed){this.body.rotation.y=0;}
    if(this.hungerMarker?.visible){
      this.hungerMarker.position.x=this.body.position.x;
      this.hungerMarker.position.z=this.body.position.z;
      this.hungerMarker.position.y+=Math.max(0,this.body.position.y-.081);
    }

  }
}
