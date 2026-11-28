import {careFrame,usesCareContact} from './CareMotion';
import {seatTransfer,taskCadence,chewPulse,phoneStroke} from './MotionPolish';
import {FishingProp,buildLakeFish,disposeLakeFish} from './LakeFishingArt';
import type {LakeRod,FishCatch} from '../shared/lake';
import {venueHandFrame,type VenueGame} from '../shared/venue';
import type {ConsoleMatch} from '../shared/consoleCatalog';
import {buildGamepad,CONTROLLER_GRIP} from './GamepadArt';
import {CONSOLE_GAMES,type ConsoleGameId} from '../shared/consoleCatalog';
import { HOME_JOBS } from "../shared/jobs";
import * as THREE from 'three';
import {sleepPosture} from './SleepPosture';
import {BathPrivacy} from './BathPrivacy';
import type { CharacterId, SocialKind } from '../shared/protocol';
import type { PairMotion } from '../shared/socialLife';
import type { PetAction } from '../shared/pets';
import {HOME_DRINK_COLORS,isHomeDrink,type RecipeId,type TakeoutId} from '../shared/food';
import { kitchenMove, grillMove, helperChop, mealUtensil } from './CookingChoreography';
import { buildCharacterArt, type CharacterModel, type CharacterRig } from './CharacterArt';
import { HOME_WALK_SPEED, HOME_PLACEMENTS } from '../shared/home';
import {LoungeHose} from './LoungeHose';
import {LoungeSmoke,hookahPhase} from './LoungeSmoke';
import { activityProps } from './ActivityProps';
import { drum, finish, orb, batchRigidParts } from './ArtKit';
import type { FloorPoint } from './navigation';
import { walkStrideLength, walkPelvisDrop, walkFootTarget, walkMotionTarget } from './WalkingGait';
import { mealGesture } from './MealGesture';
import { stableElbowPlane, conversationEyeLead, conversationExpression } from './ContactMotion';
import { NEED_REACTION_DURATION, needReactionWeight, pickNeedReaction, reactionAllowed,
  type NeedReaction, type ReactionNeeds } from './NeedReactions';
import { expressiveDemeanor } from './CharacterDemeanor';
import type { EmotionId } from '../shared/emotions';
import { RESIDENT_IDLE_SECONDS, chooseResidentIdle, residentIdleAllowed, residentIdleWeight,
  residentIdleEase, residentIdleTouchWeight,
  type ResidentIdleContext, type ResidentIdleGesture } from './ResidentIdle';

type Pose = 'idle' | 'sit' | 'work' | 'sleep';
type Arrival = () => void;
type HandTargets = readonly [left: THREE.Vector3, right: THREE.Vector3, mouse?: THREE.Vector3];
type Steering = (from: FloorPoint, target: FloorPoint) => FloorPoint;
export type DomesticMotion = 'modeling'|'fishing' | 'venueCue'|'venueBowl'|'venueHockey'|'venueCards'|'venueJenga'| 'spaMassage' | 'spaRecline' | 'spaSwim' | 'vanity' | 'consolePlay' | import('../shared/fitness').FitnessMotion | 'dishes' | 'wash' | 'tidy' | 'tea' | 'read' | 'phone' | 'scrollPhone' | 'stretch' | 'music' | 'journal' | 'games' | 'chess' | 'darts' | 'pingPong' | 'badminton' | 'billiards' | 'reach' | 'chat' | 'shower' | 'bath' | 'toilet' | 'teeth' | 'watch' | 'grill' | 'washHands' | 'coffee' | 'prep';
const COUNTER_ACTIONS: ReadonlySet<DomesticMotion> = new Set([
  'dishes', 'wash', 'washHands', 'grill', 'tidy', 'coffee', 'tea', 'prep',
]);
const handAxis = new THREE.Vector3(0, -1, 0);
const forwardAxis = new THREE.Vector3(0, 0, 1);
const up = THREE.Object3D.DEFAULT_UP;
function heartShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.10);
  shape.bezierCurveTo(-0.19, 0.02, -0.24, 0.15, -0.11, 0.18);
  shape.bezierCurveTo(-0.04, 0.21, 0, 0.14, 0, 0.12);
  shape.bezierCurveTo(0, 0.14, 0.04, 0.21, 0.11, 0.18);
  shape.bezierCurveTo(0.24, 0.15, 0.19, 0.02, 0, -0.10);
  return shape;
}
const heartGeometry = new THREE.ShapeGeometry(heartShape());

export class Actor {
  readonly root = new THREE.Group();
  private readonly figure = new THREE.Group();
  private readonly leftLeg: THREE.Object3D;
  private readonly rightLeg: THREE.Object3D;
  private readonly leftArm: THREE.Object3D;
  private readonly rightArm: THREE.Object3D;
  private readonly rig: CharacterRig;
  private readonly bathPrivacy:BathPrivacy;
  bathPrivacyQA(){return this.bathPrivacy.qa();}
  suspendBathPrivacy(){this.bathPrivacy.set(false);}
  syncBathPrivacy(){this.bathPrivacy.set(this.activity==='bath'||this.activity==='shower');}
  private readonly figureBase = new THREE.Vector3();
  private catToyGrip?:THREE.Group;
  private catToyLine?:THREE.Line;
  private readonly catToyPalm=new THREE.Vector3();
  private readonly catToyAim=new THREE.Vector3();
  private readonly catToyTip=new THREE.Vector3();
  private readonly catToyAxis=new THREE.Vector3(0,0,1);
  private catToyKind?:import('../shared/petToys').ManualCatToy;
  manualCatToy(kind?:import('../shared/petToys').ManualCatToy,target?:THREE.Vector3,lineClear=false){
    const busy=this.isWalking()||this.pose!=='idle'||!!this.activity||!!this.gesture||!!this.partnerGesture;
    if(!kind||!target||busy){if(this.catToyGrip)this.catToyGrip.visible=false;if(this.catToyLine)this.catToyLine.visible=false;return;}
    this.faceTowards(target);
    this.root.localToWorld(this.catToyAim.set(.24,1.02,.37));this.reach(1,this.catToyAim,1,.65);
    this.handDirection.subVectors(target,this.catToyAim).normalize();this.aimHand(1,this.handDirection,1);
    if(!this.catToyGrip){const g=this.catToyGrip=new THREE.Group();g.name='Manual cat toy grip';this.root.add(g);
      for(const [name,r,length,color] of [['handle',.026,.13,0x405e60],['rod',.008,.43,0xc3a17d],['laser',.022,.115,0x495663],['reel',.036,.075,0xb48b62]] as const){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,10),finish(color,'metal'));m.name=name;m.rotation.x=Math.PI/2;m.position.z=name==='rod'?.26:0;g.add(m);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));this.catToyLine=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xbba885}));this.catToyLine.frustumCulled=false;this.root.add(this.catToyLine);
    }
    this.catToyKind=kind;const g=this.catToyGrip,line=this.catToyLine!;
    this.rig.wrists[1].localToWorld(this.catToyPalm.set(0,-.055,0));g.position.copy(this.root.worldToLocal(this.catToyPalm));
    this.catToyAim.copy(target);this.root.worldToLocal(this.catToyAim);this.catToyAim.sub(g.position).normalize();g.quaternion.setFromUnitVectors(this.catToyAxis,this.catToyAim);
    g.visible=kind!=='bell';for(const part of g.children)part.visible=kind==='wand'?(part.name==='rod'||part.name==='handle'):kind==='laser'?part.name==='laser':part.name==='reel';
    line.visible=lineClear&&(kind==='wand'||kind==='string');if(line.visible){g.localToWorld(this.catToyTip.set(0,0,kind==='wand'?.475:.045));this.root.worldToLocal(this.catToyTip);const end=this.root.worldToLocal(this.catToyAim.copy(target));const attr=line.geometry.getAttribute('position') as THREE.BufferAttribute;attr.setXYZ(0,this.catToyTip.x,this.catToyTip.y,this.catToyTip.z);attr.setXYZ(1,(this.catToyTip.x+end.x)/2,Math.max(.04,(this.catToyTip.y+end.y)/2-.12),(this.catToyTip.z+end.z)/2);attr.setXYZ(2,end.x,end.y,end.z);attr.needsUpdate=true;}
  }
  catToyQA(){return {kind:this.catToyGrip?.visible?this.catToyKind:undefined,held:!!this.catToyGrip?.visible,line:!!this.catToyLine?.visible};}
  private clock = 0;
  private gait = 0;
  private gaitBlend = 0;
  private crouchBlend = 0;
  private readonly spoon = new THREE.Group();
  private readonly mealBite=new THREE.Mesh(orb,finish(0xc69b61,'ceramic'));
  private resortDrinkTint:number|undefined;
  playResortDrink(color:number,hot:boolean){this.playActivity('eat',undefined,hot?'blackTeaCup':'mintLemonade',true);this.resortDrinkTint=color;}
  private readonly teaCup = new THREE.Group();
  private readonly cupCenter = new THREE.Vector3();
  private readonly cupHandleOffset = new THREE.Vector3();
  private readonly cupGripDirection = new THREE.Vector3();
  private readonly cupYaw = new THREE.Quaternion();

  /** The ceramic handle, not the cup center, belongs in the palm.
   * Keep the liquid horizontal and the handle facing the resident's right. */
  private gripCup(center: THREE.Vector3, alpha: number): void {
    this.cupYaw.setFromAxisAngle(up,this.root.rotation.y);
    const cold=['bananaShake','berrySmoothie','orangeJuice','mintLemonade'].includes(this.carriedDrink??(this.activity==='eat'?this.diningDish??'':''));
    this.cupHandleOffset.set(cold?.050:.051,0,0).applyQuaternion(this.cupYaw);
    this.cupGripDirection.set(0,-.5,.6).normalize().applyQuaternion(this.cupYaw);
    this.target.copy(center).add(this.cupHandleOffset).addScaledVector(this.cupGripDirection,-.055);
    this.reach(1,this.target,alpha,.42);
    this.aimHand(1,this.handDirection.copy(this.cupGripDirection),alpha);
    this.rig.wrists[1].getWorldQuaternion(this.parentRotation).invert();
    this.teaCup.quaternion.copy(this.parentRotation).multiply(this.cupYaw);
    this.teaCup.position.copy(this.cupHandleOffset).applyQuaternion(this.parentRotation).negate();
    this.teaCup.position.y-=.055;if(cold)this.teaCup.position.z+=.014;
  }
  private workCoffeeCarrying=false;
  private carriedDrink?:RecipeId;
  private workCoffeeTarget?:THREE.Vector3;
  private readonly loungeMouthpiece=new THREE.Group();
  private readonly loungeHose=new LoungeHose();
  private readonly loungeSmoke=new LoungeSmoke();
  private readonly loungeMouth=new THREE.Vector3();
  private readonly loungeForward=new THREE.Vector3();
  private readonly loungeGrip=new THREE.Vector3();
  private readonly loungeAxis=new THREE.Vector3();
  private readonly loungeRotation=new THREE.Quaternion();
  hookahQA(){const visible=this.loungeMouthpiece.visible,phase=this.partnerGesture?.motion==='yardHookah'?hookahPhase(this.partnerGesture.time,this.partnerGesture.leads):null;return {visible,puffs:this.loungeSmoke.activePuffs,raise:phase?.raise??0,tipGap:visible?this.loungeMouthpiece.localToWorld(new THREE.Vector3(0,0,.1395)).distanceTo(this.loungeMouth):null};}
  private readonly hoseLowA=new THREE.Vector3();
  private readonly hoseLowB=new THREE.Vector3();
  private readonly hoseStart=new THREE.Vector3();
  private readonly hoseEnd=new THREE.Vector3();
  private readonly dirtyPlate: THREE.Mesh;
  private readonly foodContainer = new THREE.Group();
  private readonly selectionRing: THREE.Mesh;
  private readonly heart: THREE.Mesh;
  private waypoints: THREE.Vector3[] = [];
  private callback: Arrival | null = null;
  private pose: Pose = 'idle';
  private restTime=0;
  private gesture: SocialKind | null = null;
  private gestureTime = 0;
  private partnerGesture: { motion:PairMotion; leads:boolean; target?:THREE.Vector3; partner?:Actor; time:number }|null=null;
  private activity: 'cook' | 'eat' | Exclude<PetAction, 'buyFood'> | DomesticMotion | null = null;
  private activityTime = 0;
  private venueFrame?:{game:VenueGame;center:FloorPoint;t:number;match:ConsoleMatch};
  private venueProp?:THREE.Group;
  private fishing?:FishingProp;
  private catchProp?:THREE.Group;
  private catchKey='';
  showLakeCatch(fish?:FishCatch){const key=fish?fish.species+':'+fish.grams:'';if(key===this.catchKey)return;this.catchKey=key;if(this.catchProp){disposeLakeFish(this.catchProp);this.catchProp=undefined;}if(fish){const g=buildLakeFish(fish.species);g.scale.setScalar(Math.min(1.7,.74+Math.sqrt(fish.grams/1000)*.24));g.rotation.z=Math.PI/2;g.position.set(.03,-.12,.025);this.rig.wrists[1].add(g);this.catchProp=g;}}
  playFishing(kind:LakeRod){this.playDomesticActivity('fishing');this.fishing=new FishingProp(kind);this.root.add(this.fishing.group);}
  private clearFishing(){this.fishing?.dispose();this.fishing=undefined;}
  private clearVenueProp(){this.clearFishing();this.venueFrame=undefined;if(this.venueProp){this.venueProp.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry!==orb&&o.geometry!==drum)o.geometry.dispose();});this.venueProp.removeFromParent();this.venueProp=undefined;}}
  setVenueFrame(game:VenueGame,center:FloorPoint,t:number,match:ConsoleMatch){this.venueFrame={game,center,t,match};}
  private gymDumbbells?:THREE.Group[];
  private gamepads?:Record<string,THREE.Group>;
  private activePad?:THREE.Group;
  private activeConsoleGame?:ConsoleGameId;
  private vanityKind?:import('../shared/vanity').CareId;
  private vanityProp?:THREE.Group;
  private hairTreatmentFoam?:THREE.InstancedMesh;
  private careContactError:number|null=null;
  private readonly careGoal=new THREE.Vector3();
  private readonly careDirection=new THREE.Vector3();
  drinkQA(){return {visible:this.teaCup.visible,cold:this.teaCup.getObjectByName('Cold glass')?.visible??false,liquid:(this.teaCup.getObjectByName('Drink liquid') as THREE.Mesh<THREE.CircleGeometry,THREE.MeshStandardMaterial>)?.material.color.getHex()};}
  careQA(){return {gift:this.vanityProp?.name.startsWith('Gift ')?{id:this.vanityProp.name.slice(5),visible:this.vanityProp.visible,elapsed:this.partnerGesture?.time??0}:null,id:this.vanityKind??null,phase:this.vanityKind?careFrame(this.vanityKind,this.activityTime).phase:null,elapsed:this.activityTime,prop:this.vanityProp?.visible??false,children:this.vanityProp?.visible?this.vanityProp.children.filter(c=>c.visible).map(c=>c.name):[],error:this.careContactError,blend:this.vanityKind?careFrame(this.vanityKind,this.activityTime).blend:0};}
  syncGiftElapsed(seconds:number){if(this.partnerGesture?.motion==='gift'&&Number.isFinite(seconds))this.partnerGesture.time=Math.max(0,seconds);}
  syncSanitaryElapsed(seconds:number){if((this.activity==='washHands'||this.activity==='wash'||this.activity==='teeth')&&Number.isFinite(seconds))this.activityTime=Math.max(this.activityTime,seconds,0);}
  syncCareElapsed(seconds:number){if(this.vanityKind&&Number.isFinite(seconds))this.activityTime=Math.max(0,seconds);}
  bathBombSample(point:THREE.Vector3):number|null{
    if(this.activity!=='bath'||!this.vanityKind?.startsWith('bath')||this.vanityKind.startsWith('bathHair')||!this.vanityProp)return null;
    this.vanityProp.getWorldPosition(point);return this.activityTime;
  }
  playBathCare(id:import('../shared/vanity').CareId){
    this.playDomesticActivity('bath');this.vanityKind=id;
    const g=new THREE.Group();g.name='Held bath care';const bomb=new THREE.Mesh(new THREE.IcosahedronGeometry(.042,1),finish(id==='bathLavender'?0xc2a5ed:id==='bathRose'?0xe8a3c2:0xf0dfc3,'wood'));
    bomb.name='bomb';if(id.startsWith('bathHair')){bomb.geometry.dispose();const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.026,.028,.09,12),finish(0xb6d4c6,'ceramic'));bottle.name='shampoo';bottle.position.y=-.02;g.add(bottle);
      const foam=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),finish(id==='bathHairWash'?0xf7f6ef:0xf0dfcf,'ceramic'),14),dummy=new THREE.Object3D();foam.name='Hair treatment foam';for(let i=0;i<14;i++){const angle=i*2.39996;dummy.position.set(Math.sin(angle)*(.08+(i%3)*.035),.104+(i%4)*.027,-.035+Math.cos(angle)*.10);const r=.014+(i%4)*.004;dummy.scale.set(r,r*.68,r);dummy.updateMatrix();foam.setMatrixAt(i,dummy.matrix);}foam.visible=false;this.rig.head.add(foam);this.hairTreatmentFoam=foam;}else g.add(bomb);
    if(id==='bathShave'||id==='bathRitual'){const razor=new THREE.Group();razor.name='razor';const handle=new THREE.Mesh(new THREE.BoxGeometry(.018,.083,.019),finish(0xd590b4,'wood'));handle.position.y=-.03;razor.add(handle);const head=new THREE.Mesh(new THREE.BoxGeometry(.05,.016,.026),finish(0xc9d2d7,'wood'));head.position.y=-.077;razor.add(head);razor.visible=false;g.add(razor);}
    if(id==='bathMilk'||id==='bathRitual'){const cream=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.06,12),finish(0xf1dfcb,'wood'));cream.name='cream';cream.visible=false;g.add(cream);}
    g.position.set(0,-.025,.018);this.rig.wrists[1].add(g);this.vanityProp=g;
  }
  playVanity(id:import('../shared/vanity').CareId){
    this.playDomesticActivity('vanity');this.vanityKind=id;
    const g=new THREE.Group();g.name='Held vanity care';const add=(w:number,h:number,d:number,x:number,y:number,z:number,color:number)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),finish(color,'wood'));m.position.set(x,y,z);g.add(m);};
    if(['brush','style','fancy','vladStyle'].includes(id)){add(.025,.105,.025,0,-.025,0,0x855845);add(.06,.075,.035,0,-.105,0,0xc89087);for(let i=0;i<4;i++)add(.008,.035,.009,(i-1.5)*.014,-.105,.024,0x6e4b40);}
    else if(id==='hairDry'){add(.083,.030,.037,.026,-.019,0,0x80617e);add(.052,.105,.054,0,-.053,0,0xad83a8);add(.033,.035,.036,0,-.115,0,0x4c414c);}
    else if(id==='hairStraight'){for(const x of [-.013,.013]){add(.021,.15,.025,x,-.07,0,0x3e3745);add(.009,.09,.024,x*.45,-.099,0,0xd4bac0);}}
    else if(id==='hairCurl'){add(.034,.085,.033,0,-.025,0,0x8e627e);add(.024,.135,.024,0,-.128,0,0xb7b5b4);add(.028,.017,.028,0,-.203,0,0x514552);}
    else if(id==='vladShave'){add(.022,.105,.026,0,-.035,0,0x34404b);add(.052,.02,.027,0,-.094,0,0xb9c6cf);}
    else if(id==='perfume'||id==='vladPerfume'){add(.065,.085,.042,0,-.035,0,0xd9a8b4);add(.028,.026,.025,0,.02,0,0xc5a36c);}
    else if(id==='serum'){add(.036,.077,.035,0,-.03,0,0x94b3aa);add(.02,.035,.02,0,.026,0,0xe8e0d1);}
    else if(id==='lipCare'){add(.019,.065,.019,0,-.027,0,0xd18d9f);add(.015,.019,.015,0,-.068,0,0xe4b3b0);}
    else if(id==='handCream'){add(.035,.09,.024,0,-.03,0,0xd6e8df);add(.027,.018,.021,0,-.079,0,0xeff4e9);}
    else if(['skin','hydrate','faceMask'].includes(id)){add(.055,.047,.055,0,-.03,0,0xf5e6d9);add(.06,.017,.06,0,.001,0,0xbc997a);}
    else{add(.018,.09,.018,0,-.03,0,0x825561);add(.043,.045,.035,0,-.095,0,0xd9b3a4);}
    g.position.set(0,-.025,.018);this.rig.wrists[1].add(g);this.vanityProp=g;
  }
  playGift(id:string,leads:boolean,target:THREE.Vector3){
    this.clearVanity();this.playPartnerGesture('gift',leads,target);const g=new THREE.Group();g.name='Gift '+id;
    const part=(w:number,h:number,d:number,x:number,y:number,z:number,color:number)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),finish(color,'wood'));m.position.set(x,y,z);g.add(m);};
    const round=(rx:number,ry:number,rz:number,x:number,y:number,z:number,color:number)=>{const m=new THREE.Mesh(orb.clone(),finish(color,'fabric'));m.scale.set(rx,ry,rz);m.position.set(x,y,z);g.add(m);};
    if(['giftFlowers','giftRoses','giftTulips'].includes(id)){
      const color=id==='giftRoses'?0xb92f48:id==='giftTulips'?0xf1ba59:0xd56d8c;
      part(.10,.19,.09,0,-.055,0,0xd7bd9d);
      for(let i=0;i<5;i++){const x=(i-2)*.037;part(.012,.16,.012,x,.03,0,0x527b47);round(.036,.039,.034,x,.12+Math.abs(i-2)*.012,0,color);if(id==='giftRoses')round(.019,.023,.019,x,.146+Math.abs(i-2)*.012,.003,0xe36f79);}
    }else if(id==='giftBear'){
      round(.085,.10,.055,0,-.045,0,0xb9855c);round(.065,.059,.055,0,.083,0,0xc79970);
      for(const side of [-1,1]){round(.027,.027,.02,side*.052,.13,0,0xb9855c);round(.032,.056,.03,side*.082,-.022,0,0xb9855c);round(.04,.04,.04,side*.044,-.12,.025,0xb9855c);round(.007,.009,.006,side*.023,.09,.05,0x302722);}
      round(.029,.02,.018,0,.064,.05,0xe9c5a0);round(.009,.007,.006,0,.071,.066,0x493326);
    }else if(id==='giftCard'){
      part(.13,.006,.095,0,-.043,.025,0xf2e5d4);part(.09,.008,.062,0,-.035,.025,0xd49b9d);
    }else if(id==='giftPerfume'){
      part(.085,.115,.065,0,-.015,0,0xb78d9e);part(.046,.032,.045,0,.058,0,0xd7bd85);part(.045,.043,.005,0,-.013,.035,0xf4e5cf);
    }else if(id==='giftBracelet'){
      part(.104,.047,.093,0,-.05,0,0x485d62);part(.109,.015,.096,0,-.017,0,0x77969a);part(.02,.017,.098,0,-.015,0,0xe7d2a4);
    }else{
      const color=id==='giftCare'?0x9aa99a:id==='giftDesserts'?0xe1bcb1:0x954a42;
      part(.16,.085,.13,0,-.055,0,color);part(.025,.089,.136,0,-.055,0,0xe8c37c);part(.164,.089,.025,0,-.055,0,0xe8c37c);
    }
    g.visible=leads;g.position.set(0,-.045,.025);this.rig.wrists[this.id==='vlad'?1:0].add(g);this.vanityProp=g;
  }
  private clearVanity(){if(this.hairTreatmentFoam){this.hairTreatmentFoam.removeFromParent();this.hairTreatmentFoam.geometry.dispose();this.hairTreatmentFoam.dispose();this.hairTreatmentFoam=undefined;}if(this.vanityProp){this.vanityProp.removeFromParent();this.vanityProp.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.vanityProp=undefined;}this.vanityKind=undefined;this.careContactError=null;}
  playConsole(game:ConsoleGameId){this.playDomesticActivity('consolePlay');const sku=CONSOLE_GAMES[game].console;this.gamepads??={};let pad=this.gamepads[sku];if(!pad){pad=buildGamepad(sku);this.figure.add(pad);this.gamepads[sku]=pad;}for(const p of Object.values(this.gamepads))p.visible=p===pad;this.activePad=pad;this.activeConsoleGame=game;}
  private hideGamepad(){if(this.activePad)this.activePad.visible=false;this.activePad=undefined;this.activeConsoleGame=undefined;}
  handheldQA(){
    const phone=this.props.phone,book=this.props.heldBook,page=this.props.bookPage;
    return {phone:phone.visible,book:book.visible,page:page.visible&&book.visible,
      pageAngle:page.rotation.z,elapsed:this.activityTime};
  }
  gamepadGripError(){if(!this.activePad)return null;const pad=this.activePad;return ([0,1] as const).map(i=>this.rig.wrists[i].getWorldPosition(new THREE.Vector3()).distanceTo(pad.localToWorld(new THREE.Vector3(i===0?-CONTROLLER_GRIP:CONTROLLER_GRIP,-.01,-.069))));}
  private mealSlow=false;
  private parkChatUntil=0;
  private swingHinge:THREE.Vector3|null=null;
  private swingAngle=0;
  parkSwing(angle:number):void{this.swingAngle=angle;}
  markParkSwing(hinge:THREE.Vector3,seatTop:number):void{
    this.swingHinge=this.root.worldToLocal(hinge.clone());
    this.poseOffset.y=seatTop-(this.rig.waistY-.035);
    this.swingAngle=0;this.snapFurnitureOffset();
  }
  isParkSwing():boolean{return this.swingHinge!==null&&this.pose==='sit';}
  parkConversation():void{this.parkChatUntil=this.clock+9;}
  private readonly racket=new THREE.Group();
  private readonly paddle=new THREE.Group();
  private tennisTarget:THREE.Vector3|null=null;
  private tennisHit=0;
  setTennisFrame(x:number,z:number,hit:number,target?:THREE.Vector3):void{
    if(this.activity!=='pingPong')return;
    const p=new THREE.Vector3(x-this.root.position.x,0,z-this.root.position.z).applyAxisAngle(up,-this.root.rotation.y);
    this.badmintonTravel=Math.hypot(p.x-this.poseOffset.x,p.z-this.poseOffset.z);this.poseOffset.copy(p);this.tennisHit=hit;this.tennisTarget=target??null;
  }
  private badmintonFrame:{hit:number;height:number;aim:number}|null=null;
  private badmintonTravel=0;
  setBadmintonFrame(x:number,z:number,hit:number,height:number,aim:number):void{
    if(this.activity!=='badminton')return;
    const p=new THREE.Vector3(x-this.root.position.x,0,z-this.root.position.z).applyAxisAngle(up,-this.root.rotation.y);
    this.badmintonTravel=Math.hypot(p.x-this.poseOffset.x,p.z-this.poseOffset.z);
    this.poseOffset.copy(p);this.badmintonFrame={hit,height,aim};
  }
  private cookingRecipe: RecipeId | undefined;
  private diningDish: RecipeId | TakeoutId | undefined;
  private readonly props: ReturnType<typeof activityProps>;
  private carryingBook = false;
  private closingBook = 0;
  private reaction = 0;
  private needs: ReactionNeeds | null = null;
  private needReaction: NeedReaction | null = null;
  private needReactionTime = 0;
  private needReactionCooldown: number;
  private needReactionTurn = 0;
  private readonly idleContext: ResidentIdleContext = { petYaw: null, partnerYaw: null };
  private idleGesture: ResidentIdleGesture | null = null;
  private idleGestureTime = 0;
  private idleCooldown: number;
  private idleTurn = 0;
  private arrivalUntil = -1;
  private greeting = false;
  private nextGreeting = 0;
  private petArrivalUntil = -1;
  private nextPetNotice = 0;

  /** Latest server-authoritative needs, used only to animate idle body language. */
  private emotion:EmotionId|null=null;
  private conversationYaw:number|null=null;
  private conversationSpeaking=false;
  private conversationBeat=0;
  setConversation(yaw:number|null,speaking:boolean):void{
    if(yaw===null||this.conversationYaw===null||speaking!==this.conversationSpeaking)this.conversationBeat=0;
    this.conversationYaw=yaw;this.conversationSpeaking=speaking;
  }
  setCareAppearance(hair:string,makeup:string){this.rig.setCareAppearance?.(hair,makeup);}
  setNeeds(needs: ReactionNeeds,emotion:EmotionId|null=null): void { this.needs = needs; this.emotion=emotion; }
  /** Local visual awareness only: no game state or social actions are changed. */
  setIdleSurroundings(petYaw: number | null, partnerYaw: number | null): void {
    // An approaching partner gets one friendly acknowledgement after a
    // genuine gap in proximity, never an automatic social task or kiss.
    if (partnerYaw !== null && this.idleContext.partnerYaw === null)
      this.noticePartnerArrival();
    if (petYaw !== null && this.idleContext.petYaw === null)
      this.noticePetArrival();
    this.idleContext.petYaw = petYaw;
    this.idleContext.partnerYaw = partnerYaw;
  }
  currentIdleGesture(): ResidentIdleGesture | null { return this.idleGesture; }
  needReactionQA(){return {kind:this.needReaction,time:this.needReactionTime};}
  noticePartnerArrival():void {
    if(this.clock<this.nextGreeting)return;
    // A meeting may supersede an existing purely decorative hair/idle gesture,
    // otherwise its next 8-second cooldown can swallow the entire hello.
    // Never interrupt a real action, route, need warning, or paired animation.
    this.arrivalUntil=this.clock+6;
    if(this.pose==='idle' && !this.activity && !this.waypoints.length &&
      !this.gesture && !this.partnerGesture && !this.needReaction &&
      !this.carryingBook && this.closingBook<=0){
      this.idleGesture=null;
      this.idleGestureTime=0;
      this.idleCooldown=0;
    }
  }
  private noticePetArrival():void {
    if(this.clock<this.nextPetNotice || this.greeting ||
      this.clock<=this.arrivalUntil || this.idleGesture==='noticePartner')return;
    this.petArrivalUntil=this.clock+4.5;
    // Never interrupt work, travel, contact or a real need reaction.
    if(this.pose==='idle' && !this.activity && !this.waypoints.length &&
      !this.gesture && !this.partnerGesture && !this.needReaction &&
      !this.carryingBook && this.closingBook<=0){
      this.idleGesture=null;
      this.idleGestureTime=0;
      this.idleCooldown=0;
    }
  }
  setPhoneModel(id:import('../shared/electronics').ElectronicsId){this.props.setPhone(id);}
  carryBook(color: string): void { this.carryingBook = true; this.props.color(color); }
  workCoffeeQA(){
    const visible=this.teaCup.visible&&this.workCoffeeCarrying;
    const position=visible?this.teaCup.getWorldPosition(new THREE.Vector3()):null;
    const handleError=visible?this.teaCup.localToWorld(new THREE.Vector3(.051,0,0))
      .distanceTo(this.rig.wrists[1].localToWorld(new THREE.Vector3(0,-.055,0))):null;
    const dropError=position&&this.workCoffeeTarget?position.distanceTo(this.workCoffeeTarget.clone().add(new THREE.Vector3(0,.0415,0))):null;
    return {visible,offering:!!this.workCoffeeTarget,settled:!!this.workCoffeeTarget&&this.activityTime>1.05,position:position?.toArray()??null,handleError,dropError};
  }
  workCoffeeModel(){const cup=this.teaCup.clone();cup.visible=true;cup.quaternion.identity();cup.getObjectByName('Cold glass')!.visible=false;cup.getObjectByName('Drink handle')!.visible=true;cup.getObjectByName('Drink vessel')!.visible=true;const liquid=cup.getObjectByName('Drink liquid') as THREE.Mesh<THREE.CircleGeometry,THREE.MeshStandardMaterial>;liquid.material=liquid.material.clone();liquid.material.color.setHex(0x9b6332);liquid.position.y=.0415;return cup;}
  carryWorkCoffee(target?:THREE.Vector3):void{this.workCoffeeCarrying=true;this.workCoffeeTarget=target?.clone();}
  carryHomeDrink(recipe:RecipeId,target?:THREE.Vector3){this.carryWorkCoffee(target);this.carriedDrink=recipe;}
  private clearWorkCoffee():void{this.carriedDrink=undefined;this.workCoffeeCarrying=false;this.workCoffeeTarget=undefined;this.teaCup.visible=false;}
  carryDirtyPlate(): void { this.dirtyPlate.visible = true; }
  carryFoodContainer(): void { this.foodContainer.visible = true; }
  hideFoodContainer(): void { this.foodContainer.visible = false; }
  hasFoodContainer(): boolean { return this.foodContainer.visible; }
  hasDirtyPlate(): boolean { return this.dirtyPlate.visible; }
  clearProps(): void {
    this.clearVanity();
    this.clearWorkCoffee();
    this.loungeMouthpiece.visible=this.loungeHose.visible=this.loungeSmoke.visible=false;
    this.carryingBook = false;
    this.closingBook = 0;
    this.props.hideBook();
    this.props.phone.visible=false;
    this.mealBite.visible=false;this.spoon.visible=false;
    this.dirtyPlate.visible = false;
    this.foodContainer.visible = false;
    this.props.brush.visible = this.props.tongs.visible = this.props.groomingBrush.visible = this.props.knife.visible = this.props.spatula.visible = this.props.fork.visible = false;
    this.cookingRecipe = undefined;
    this.diningDish = undefined;
    this.petContact = undefined;
  }
  watch(reaction: number): void { this.reaction = reaction; this.playDomesticActivity('watch'); }

  private readonly poseOffset = new THREE.Vector3();
  private seatBlend = 0;
  private keys: HandTargets | undefined;
  private pan: THREE.Vector3 | undefined;
  private gestureTarget: THREE.Vector3 | undefined;
  private petContact: THREE.Vector3 | ((target:THREE.Vector3,stroke?:number)=>THREE.Vector3) | undefined;
  private readonly target = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly elbowAxis = new THREE.Vector3();
  private readonly upperAxis = new THREE.Vector3();
  private readonly basisX = new THREE.Vector3();
  private readonly basisZ = new THREE.Vector3();
  private readonly handDirection = new THREE.Vector3();
  private readonly rotationBasis = new THREE.Matrix4();
  private readonly aimRotation = new THREE.Quaternion();
  private readonly parentRotation = new THREE.Quaternion();
  private readonly walkStep = new THREE.Vector3();
  bodyPosition(target: THREE.Vector3): THREE.Vector3 { return this.figure.getWorldPosition(target); }
  sanitaryQA(){return {privacy:this.bathPrivacyQA(),body:this.bodyPosition(new THREE.Vector3()).toArray(),root:this.root.position.toArray(),hands:this.rig.wrists.map(w=>w.getWorldPosition(new THREE.Vector3()).toArray()),head:this.rig.head.getWorldPosition(new THREE.Vector3()).toArray(),activity:this.activity,time:this.activityTime};}

  constructor(readonly id: CharacterId, start: [number, number], model?: CharacterModel) {
    this.root.position.set(start[0], 0, start[1]);
    this.needReactionCooldown = id === 'vlad' ? 5.5 : 8.0;
    this.idleCooldown = id === 'vlad' ? 4.8 : 6.3;
    this.root.add(this.figure);
    const vlad = id === 'vlad';
    const asset = model?.(this.figure);
    this.leftLeg = asset?.joints.leftLeg ?? new THREE.Group();
    this.rightLeg = asset?.joints.rightLeg ?? new THREE.Group();
    this.leftArm = asset?.joints.leftArm ?? new THREE.Group();
    this.rightArm = asset?.joints.rightArm ?? new THREE.Group();
    this.rig = asset?.rig ?? buildCharacterArt(this.figure, id, {
      leftLeg: this.leftLeg, rightLeg: this.rightLeg,
      leftArm: this.leftArm, rightArm: this.rightArm,
    });

    this.bathPrivacy=new BathPrivacy(this.figure,this.rig,{leftArm:this.leftArm,rightArm:this.rightArm,leftLeg:this.leftLeg,rightLeg:this.rightLeg},id,!!asset);
    this.props = activityProps(this.figure,this.rig.wrists);
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(.047,.036,.083,12),finish(id==='vlad'?0x87a79a:0xe2b7a4,'ceramic'));
    const liquid=new THREE.Mesh(new THREE.CircleGeometry(.039,12),finish(0x9b6332,'ceramic').clone());liquid.name='Drink liquid';liquid.rotation.x=-Math.PI/2;liquid.position.y=.0415;
    const cupHandle=new THREE.Mesh(new THREE.TorusGeometry(.026,.006,6,12),finish(id==='vlad'?0x87a79a:0xe2b7a4,'ceramic'));cupHandle.position.x=.051;
    cup.name='Drink vessel';cupHandle.name='Drink handle';const coldGlass=new THREE.Mesh(new THREE.CylinderGeometry(.041,.032,.124,16),finish(0xcfe3e6,'ceramic'));coldGlass.name='Cold glass';coldGlass.visible=false;this.teaCup.add(cup,liquid,cupHandle,coldGlass);this.teaCup.visible=false;this.rig.wrists[1].add(this.teaCup);
    const hoseHandle=(r:number,length:number,z:number,color:number)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,10),finish(color,'metal'));m.rotation.x=Math.PI/2;m.position.z=z;this.loungeMouthpiece.add(m);};
    hoseHandle(.015,.115,0,0x29383c);hoseHandle(.009,.065,.09,0x849396);hoseHandle(.012,.021,.129,0x344c50);hoseHandle(.014,.032,-.070,0x465b60);
    this.loungeMouthpiece.position.set(0,-.050,.024);this.loungeMouthpiece.visible=false;this.rig.wrists[1].add(this.loungeMouthpiece);this.root.add(this.loungeSmoke);
    this.loungeHose.frustumCulled=false;this.loungeHose.visible=false;this.root.add(this.loungeHose);
    const frameMat=finish(id==='vlad'?0x31495e:0x8b425e,'metal'),gripMat=finish(0x25282b,'fabric'),stringMat=finish(0xe8e7db,'fabric');
    const rod=(radius:number,length:number,z:number,mat:THREE.Material)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,10),mat);m.rotation.x=Math.PI/2;m.position.z=z;this.racket.add(m);};
    rod(.017,.155,0,gripMat);rod(.019,.012,-.079,frameMat);rod(.0065,.255,.205,frameMat);
    const frame=new THREE.Mesh(new THREE.TorusGeometry(.103,.009,8,44),frameMat);frame.rotation.x=Math.PI/2;frame.scale.y=1.30;frame.position.z=.455;this.racket.add(frame);
    for(let i=-5;i<=5;i++){const f=i/6;const a=new THREE.Mesh(new THREE.BoxGeometry(.0018,.0018,.25*Math.sqrt(1-f*f)),stringMat);a.position.set(f*.096,0,.455);this.racket.add(a);const b=new THREE.Mesh(new THREE.BoxGeometry(.192*Math.sqrt(1-f*f),.0018,.0018),stringMat);b.position.set(0,0,.455+f*.125);this.racket.add(b);}
    batchRigidParts(this.racket);this.racket.position.set(0,-.049,.021);
    this.racket.visible=false;this.rig.wrists[1].add(this.racket);
    const paddlePart=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Vector3)=>{const part=new THREE.Mesh(g,m);part.position.copy(p);this.paddle.add(part);return part;};
    paddlePart(new THREE.BoxGeometry(.030,.023,.105),finish(0xb88955,'wood'),new THREE.Vector3(0,0,.008));
    const core=paddlePart(new THREE.CylinderGeometry(.077,.077,.008,32),finish(0xc4a373,'wood'),new THREE.Vector3(0,0,.133));core.scale.z=1.12;
    for(const side of [-1,1]){const rubber=paddlePart(new THREE.CylinderGeometry(.075,.075,.003,32),finish(side===1?0xb33237:0x282a2a,'fabric'),new THREE.Vector3(0,side*.0055,.133));rubber.scale.z=1.12;}
    batchRigidParts(this.paddle);this.paddle.position.set(0,-.049,.021);this.paddle.visible=false;this.rig.wrists[1].add(this.paddle);
    const utensil = finish(0xb68354, 'wood');
    const handle = new THREE.Mesh(orb, utensil);
    handle.scale.set(0.011, 0.014, 0.122);
    handle.position.z = 0.085;
    const bowl = new THREE.Mesh(orb, utensil);
    bowl.scale.set(0.032, 0.011, 0.067);
    bowl.position.z = 0.203;
    this.spoon.add(handle, bowl);
    this.spoon.position.set(-0.012, -0.044, 0.024);
    this.spoon.rotation.x = 0.31;
    this.spoon.visible = false;
    this.teaCup.visible = false;
    this.spoon.name='Held spoon';
    this.rig.wrists[1].add(this.spoon);
    this.mealBite.name='Meal mouthful';this.mealBite.scale.set(.026,.015,.025);this.mealBite.visible=false;this.figure.add(this.mealBite);
    this.dirtyPlate = new THREE.Mesh(drum, finish(0xeee2ce, 'ceramic'));
    this.dirtyPlate.scale.set(.12, .013, .12);
    this.dirtyPlate.position.set(0, -.055, .02);
    this.dirtyPlate.visible = false;
    this.rig.wrists[1].add(this.dirtyPlate);
    // Small covered box, only displayed when a real leftover transfer runs.
    const tray=new THREE.Mesh(drum,finish(0xece5d9,'ceramic'));
    tray.scale.set(.13,.020,.098);
    const food=new THREE.Mesh(orb,finish(0xbd8051,'ceramic'));
    food.scale.set(.085,.023,.063);food.position.y=.023;
    const lid=new THREE.Mesh(drum,finish(0xc3d6d0,'ceramic'));
    lid.scale.set(.133,.012,.103);lid.position.y=.054;
    this.foodContainer.add(tray,food,lid);
    this.foodContainer.position.set(0,-.056,.020);
    this.foodContainer.visible=false;
    this.rig.wrists[1].add(this.foodContainer);

    const ringMat = new THREE.MeshBasicMaterial({
      color: vlad ? 0x6da38c : 0xe2a188, transparent: true, opacity: 0.78, side: THREE.DoubleSide,
    });
    this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 28), ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.012;
    this.root.add(this.selectionRing);
    this.selectionRing.visible = false;

    this.heart = new THREE.Mesh(heartGeometry, new THREE.MeshBasicMaterial({
      color: vlad ? 0xefaa9c : 0xd88d8a, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.heart.position.set(0, 2.17, 0.10);
    this.root.add(this.heart);
    this.heart.visible = false;this.racket.visible=false;
  }

  select(value: boolean): void { this.selectionRing.visible = value; }

  walkPath(points: readonly THREE.Vector3[], onArrive: Arrival): void {
    const carryingDishes = this.dirtyPlate.visible;
    const carryingFood = this.foodContainer.visible;
    // Keep a short vertical rise from a low seat, but never carry the
    // horizontal furniture offset onto the collision-aware walking route.
    const riseY=this.seatBlend>.15&&Math.abs(this.figure.rotation.x)<.2&&!this.authoredWaterAnchor?
      Math.min(0,this.figureBase.y):0;
    this.setPose('idle');
    if (carryingDishes) this.dirtyPlate.visible = true;
    if (carryingFood) this.foodContainer.visible = true;
    // Furniture poses offset only the rendered body from its navigation root.
    // If that offset eases away *during* a new walk, the visible person can
    // pass straight through a neighbor although their navigation roots don't.
    // Reattach the body to the collision-aware root before taking a step.
    this.figureBase.set(0,riseY,0);
    this.figure.position.set(0,riseY,0);
    this.waypoints = points.map((point) => point.clone());
    this.callback = onArrive;
  }

  /** The server has confirmed the route is finished. Recover a delayed visual client once, without replaying the arrival callback. */
  reconcileTimedArrival(goal:THREE.Vector3,arrive:Arrival):void {
    this.setPose('idle');this.root.position.copy(goal);arrive();
  }

  private homeWorkStyle:import("../shared/jobs").JobId|undefined;
  setHomeWorkStyle(style:import("../shared/jobs").JobId){this.homeWorkStyle=style;}
  setPose(pose: Pose): void {
    this.clearWorkCoffee();
    this.clearVanity();
    this.hideGamepad();
    this.homeWorkStyle=undefined;
    this.waypoints = [];
    this.callback = null;
    if(this.pose!==pose)this.restTime=0;
    this.authoredWaterAnchor=false;this.poolStepTravel=0;
    this.pose = pose;this.swingHinge=null;this.swingAngle=0;this.badmintonFrame=null;this.badmintonTravel=0;this.racket.visible=false;this.paddle.visible=false;this.tennisTarget=null;this.tennisHit=0;
    this.gesture = null;
    this.partnerGesture = null;
    this.loungeSmoke.visible=this.loungeMouthpiece.visible=this.loungeHose.visible=false;
    this.activity = null;
    this.bathPrivacy.set(false);
    this.clearVenueProp();
    if(this.gymDumbbells)for(const g of this.gymDumbbells)g.visible=false;
    this.cookingRecipe = undefined;
    this.diningDish = undefined;
    this.idleGesture = null;
    this.idleGestureTime = 0;
    this.idleCooldown = Math.max(this.idleCooldown, 4);
    this.keys = this.pan = this.gestureTarget = this.petContact = undefined;
    this.poseOffset.set(0, pose === 'sit' || pose === 'work' ? -0.26 : 0, 0);
    this.heart.visible = false;
    this.spoon.visible = false;
    this.mealBite.visible=false;
    this.teaCup.visible = false;
    this.dirtyPlate.visible = false;
    this.foodContainer.visible = false;
    this.props.brush.visible = false;
    this.props.groomingBrush.visible = false;
    this.props.tongs.visible = false;
    this.props.knife.visible = this.props.spatula.visible = false;
    this.props.fork.visible = false;
    this.props.phone.visible = false;
  }

  /** Pose the visible character on the furniture while the navigation root
   * stays in its safe, server-saved approach location. */
  setFurniturePose(pose: Pose, worldAnchor: THREE.Vector3, yaw: number, keys?: HandTargets): void {
    // Preserve the previous world-space body position when turning onto a
    // furniture anchor. Otherwise a nonzero offset swings around the root.
    this.target.copy(this.figureBase).applyAxisAngle(up,this.root.rotation.y);
    this.setPose(pose);
    this.root.rotation.y = yaw;
    this.figureBase.copy(this.target).applyAxisAngle(up,-yaw);
    const local = worldAnchor.clone().sub(this.root.position);
    local.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -yaw);
    this.poseOffset.copy(local);
    // Newly purchased desks do not supply explicit keyboard anchors. Generate
    // them from the actual chair and its yaw, rather than typing in mid-air.
    // The keyboard is at absolute desk height; the chair's negative Y is only
    // a visual sitting offset and must not be added to the key positions.
    if (pose === 'work' && !keys) {
      const keyAt = (x: number) => new THREE.Vector3(x, .80, .47)
        .applyAxisAngle(up, yaw)
        .add(new THREE.Vector3(worldAnchor.x, 0, worldAnchor.z));
      this.keys = [keyAt(-.15), keyAt(.15)];
    } else this.keys = keys;
  }

  /** Submerged seat uses the actual rig pelvis height, not the standing offset. */
  setSpaSeat(x:number,z:number,seatTop:number,yaw:number){this.setFurniturePose("sit",new THREE.Vector3(x,seatTop-(this.rig.waistY-.035),z),yaw);}
  private authoredWaterAnchor=false;
  private poolStepTravel=0;
  updateWaterAnchor(worldAnchor:THREE.Vector3,yaw:number,stepping=false):void{
    if(stepping){this.target.copy(this.figureBase).applyAxisAngle(up,this.root.rotation.y).add(this.root.position);this.poolStepTravel=Math.hypot(worldAnchor.x-this.target.x,worldAnchor.z-this.target.z);}
    else this.poolStepTravel=0;
    this.authoredWaterAnchor=true;this.root.rotation.y=yaw;this.poseOffset.copy(worldAnchor).sub(this.root.position).applyAxisAngle(up,-yaw);
    this.figureBase.copy(this.poseOffset);
  }
  snapFurnitureOffset():void { this.figureBase.copy(this.poseOffset); this.figure.position.copy(this.poseOffset); }
  isSleeping(): boolean { return this.pose==='sleep'; }
  audioMotion(){return {activity:this.activity,pose:this.pose,walking:this.gaitBlend>.18,activityTime:this.activityTime,gesture:this.gesture,gestureTime:this.gestureTime,partner:this.partnerGesture?{motion:this.partnerGesture.motion,leads:this.partnerGesture.leads,time:this.partnerGesture.time}:null};}
  isWalking(): boolean { return this.waypoints.length > 0; }
  eatingElapsed(): number | null { return this.activity === 'eat' ? this.activityTime : null; }

  playActivity(kind: 'cook' | 'eat', pan?: THREE.Vector3, recipe?: RecipeId|TakeoutId, slow=false): void {
    // World has already placed the actor at the visual station.
    this.clearVenueProp();this.clearVanity();this.hideGamepad();
    this.carryingBook=false;this.closingBook=0;this.props.hideBook();
    this.props.phone.visible=false;
    this.resortDrinkTint=undefined;this.activity = kind;this.bathPrivacy.set(false);this.mealSlow=slow;
    this.pan = pan?.clone();
    this.cookingRecipe = kind === 'cook' ? recipe as RecipeId : undefined;
    this.diningDish = kind === 'eat' ? recipe : undefined;
    this.activityTime = 0;
  }

  playDomesticActivity(kind: DomesticMotion, target?: THREE.Vector3, recipe?: RecipeId): void {
    this.clearVanity();
    if(kind!=='consolePlay')this.hideGamepad();
    if(kind==='read')this.carryingBook=true;
    else {this.carryingBook=false;this.closingBook=0;this.props.hideBook();}
    this.clearVenueProp();
    this.props.phone.visible=false;
    this.activity = kind;
    this.syncBathPrivacy();
    if(kind==='venueBowl'||kind==='venueCards'){const g=new THREE.Group(),prop=new THREE.Mesh(kind==='venueBowl'?orb:new THREE.BoxGeometry(1,1,1),finish(kind==='venueBowl'?(this.id==='vlad'?0x386f9c:0xc55354):0xd74c47));prop.scale.set(...(kind==='venueBowl'?[.12,.12,.12]:[.105,.014,.16]) as [number,number,number]);prop.position.set(0,-.045,.025);g.add(prop);g.visible=false;this.rig.wrists[1].add(g);this.venueProp=g;}
    if(kind==='modeling'){
      const g=new THREE.Group();g.name='Assembly piece';
      {const piece=new THREE.Mesh(new THREE.BoxGeometry(.045,.035,.065),finish(0xe4c49b,'wood'));piece.position.set(0,-.018,.04);g.add(piece);}
      this.rig.wrists[1].add(g);this.venueProp=g;
    }
    if(kind==='venueCue'){const g=new THREE.Group();const cue=new THREE.Mesh(drum,finish(0xb78b50,'wood'));cue.scale.set(.012,1.02,.012);cue.rotation.x=Math.PI/2;cue.position.z=.29;g.add(cue);const tip=new THREE.Mesh(drum,finish(0x385d82,'fabric'));tip.scale.set(.012,.035,.012);tip.rotation.x=Math.PI/2;tip.position.z=.805;g.add(tip);this.rig.wrists[1].add(g);this.venueProp=g;}
    if(kind==='gymCurl'&&!this.gymDumbbells){this.gymDumbbells=this.rig.wrists.map(wrist=>{const g=new THREE.Group();for(const [x,r,l] of [[0,.018,.17],[-.105,.052,.045],[.105,.052,.045]]){const m=new THREE.Mesh(drum,finish(x===0?0xb9c0c3:0x263139,'metal'));m.scale.set(r*2,l,r*2);m.rotation.z=Math.PI/2;m.position.x=x;g.add(m);}g.position.set(0,-.045,.02);wrist.add(g);return g;});}
    if(this.gymDumbbells)for(const g of this.gymDumbbells)g.visible=kind==='gymCurl';
    this.pan = target?.clone();
    this.cookingRecipe = kind === 'grill' || kind === 'prep' ? recipe : undefined;
    this.diningDish = undefined;
    this.activityTime = 0;
  }

  finishActivity(): void {
    this.clearWorkCoffee();
    this.clearVenueProp();
    this.clearVanity();
    this.hideGamepad();
    this.props.phone.visible=false;
    if(this.partnerGesture?.motion==='bedRest')this.setPose('idle');
    this.partnerGesture=null;
    this.loungeHose.visible=this.loungeMouthpiece.visible=this.loungeSmoke.visible=false;
    this.gesture=null;
    if(this.activity?.startsWith('gym'))this.setPose('idle');
    if(this.activity==='badminton'||this.activity==='pingPong'){this.poseOffset.set(0,0,0);this.badmintonFrame=null;this.badmintonTravel=0;this.racket.visible=false;this.paddle.visible=false;this.tennisTarget=null;this.tennisHit=0;}
    this.heart.visible=false;
    this.closingBook = this.activity === 'read' && this.carryingBook ? .36 : 0;
    this.carryingBook = false;
    this.props.brush.visible = false;
    this.props.groomingBrush.visible = false;
    this.props.tongs.visible = false;
    this.props.knife.visible = this.props.spatula.visible = false;
    this.props.fork.visible = false;
    this.cookingRecipe = undefined;
    this.diningDish = undefined;
    this.petContact = undefined;
    if (this.activity === 'cook' || this.activity === 'bath' || this.activity === 'toilet') this.setPose('idle');
    else this.activity = null;
    this.syncBathPrivacy();
    this.spoon.visible = false;
    this.mealBite.visible=false;
    this.teaCup.visible = false;
    this.dirtyPlate.visible = false;
    this.foodContainer.visible = false;
  }

  playPetActivity(kind: Exclude<PetAction, 'buyFood'>, petContact?: THREE.Vector3 | ((target:THREE.Vector3,stroke?:number)=>THREE.Vector3)): void {
    this.setPose('idle');
    this.activity = kind;
    this.syncBathPrivacy();
    this.petContact = petContact instanceof THREE.Vector3 ? petContact.clone() : petContact;
    this.activityTime = 0;
  }

  faceTowards(point: THREE.Vector3): void {
    const dx = point.x - this.root.position.x;
    const dz = point.z - this.root.position.z;
    if(Math.hypot(dx,dz)>.001)this.root.rotation.y = Math.atan2(dx, dz);
  }

  playGesture(kind: SocialKind, target?: THREE.Vector3): void {
    this.setPose('idle');
    this.gesture = kind;
    this.gestureTarget = target;
    this.gestureTime = 0;
    this.heart.visible = kind === 'hug';
  }

  playPartnerGesture(motion:PairMotion,leads:boolean,target?:THREE.Vector3,partner?:Actor):void {
    this.partnerGesture={motion,leads,target,partner,time:0};
    this.idleGesture=null;
  }

  private advance(dt: number, steer?: Steering): number {
    let budget = dt * HOME_WALK_SPEED;
    let traveled = 0;
    let heading = this.root.rotation.y;
    while (budget > 0 && this.waypoints.length) {
      const target = this.waypoints[0];
      const dx = target.x - this.root.position.x, dz = target.z - this.root.position.z;
      const distance = Math.hypot(dx, dz);
      const travel = Math.min(distance, budget);
      if (distance > .001) heading = Math.atan2(dx, dz);
      budget -= travel;
      const intended = travel === distance ? target : this.walkStep.copy(this.root.position).lerp(target, travel / distance);
      const next = steer ? steer(this.root.position, intended) : intended;
      if (next !== intended) {
        const sidestepX = next.x - this.root.position.x, sidestepZ = next.z - this.root.position.z;
        const sidestep = Math.hypot(sidestepX, sidestepZ);
        traveled += sidestep;
        if (sidestep > .001) heading = Math.atan2(sidestepX, sidestepZ);
        this.root.position.set(next.x, 0, next.z);
        break;
      }
      traveled += travel;
      this.root.position.copy(intended);
      if (travel < distance) break;
      this.waypoints.shift();
    }
    if (traveled > 0) {
      const turn = THREE.MathUtils.euclideanModulo(heading - this.root.rotation.y + Math.PI, 2 * Math.PI) - Math.PI;
      this.root.rotation.y += THREE.MathUtils.clamp(turn, -dt * 8, dt * 8);
    }
    if (!this.waypoints.length && this.callback) {
      const arrive = this.callback;
      this.callback = null;
      arrive();
    }
    return traveled;
  }

  private bend(upper: THREE.Object3D, lower: THREE.Object3D, l1: number, l2: number,
    y: number, z: number, direction: number, alpha: number): void {
    const d = THREE.MathUtils.clamp(Math.hypot(y, z), Math.abs(l1 - l2) + 0.003, l1 + l2 - 0.001);
    const shoulder = Math.acos(THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const flex = Math.PI - Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    upper.rotation.x = THREE.MathUtils.lerp(upper.rotation.x, Math.atan2(-z, -y) - direction * shoulder, alpha);
    lower.rotation.x = THREE.MathUtils.lerp(lower.rotation.x, direction * flex, alpha);
  }

  /** Solve the shoulder and elbow in the plane through the wrist target.
   * The elbow points down and gently out, so it clears the torso and worktop. */
  private reach(index: 0 | 1, goal: THREE.Vector3, alpha: number, lateralElbow = .44): void {
    const arm = index === 0 ? this.leftArm : this.rightArm;
    const { chest, elbows, upperArm, lowerArm } = this.rig;
    const offset = chest.worldToLocal(this.direction.copy(goal)).sub(arm.position);
    const extent = offset.length();
    if (extent < 0.001) return;
    const distance = THREE.MathUtils.clamp(extent, Math.abs(upperArm - lowerArm) + 0.003, upperArm + lowerArm - 0.002);
    const direction = offset.divideScalar(extent);
    const bend = this.elbowAxis.set(index === 0 ? -lateralElbow : lateralElbow, -1, -0.16);
    stableElbowPlane(bend,direction);
    const along = (upperArm * upperArm + distance * distance - lowerArm * lowerArm) / (2 * distance);
    const lift = Math.sqrt(Math.max(0, upperArm * upperArm - along * along));
    const joint = this.upperAxis.copy(direction).multiplyScalar(along).addScaledVector(bend, lift);
    const z = this.basisZ.copy(direction).multiplyScalar(distance).sub(joint);
    const y = joint.normalize().negate();
    z.addScaledVector(y, -z.dot(y)).normalize();
    this.basisX.crossVectors(y, z).normalize();
    this.rotationBasis.makeBasis(this.basisX, y, z);
    arm.quaternion.slerp(this.aimRotation.setFromRotationMatrix(this.rotationBasis), alpha);
    const flex = Math.PI - Math.acos(THREE.MathUtils.clamp(
      (upperArm * upperArm + lowerArm * lowerArm - distance * distance) / (2 * upperArm * lowerArm), -1, 1));
    elbows[index].rotation.x = THREE.MathUtils.lerp(elbows[index].rotation.x, -flex, alpha);
  }

  private aimHand(index: 0 | 1, direction: THREE.Vector3, alpha: number): void {
    const { elbows, wrists } = this.rig;
    elbows[index].getWorldQuaternion(this.parentRotation).invert();
    if(direction.lengthSq()<1e-10)return;
    direction.applyQuaternion(this.parentRotation).normalize();
    wrists[index].quaternion.slerp(this.aimRotation.setFromUnitVectors(handAxis, direction), alpha);
  }

  // A social contact is authored at the palm, not the wrist joint.
  // Leave the two palms a small clearance so both hand meshes remain visible.
  private reachPartnerPalm(hand:0|1,contact:THREE.Vector3,amount:number,clearance=.012):void{
    const shoulder=hand===0?this.leftArm:this.rightArm;
    shoulder.getWorldPosition(this.handDirection);
    this.handDirection.subVectors(contact,this.handDirection).normalize();
    contact.addScaledVector(this.handDirection,-(.055+clearance));
    this.reach(hand,contact,amount,.72);
    this.aimHand(hand,this.handDirection,amount);
  }

  private animateCareContact(a:number,alpha:number){
    const id=this.vanityKind!,d=this.rig,prop=this.vanityProp,f=careFrame(id,a);
    const blend=Math.min(1,f.blend*alpha*8),stroke=f.stroke;
    this.careContactError=null;
    if(prop&&id.startsWith('bathHair')){prop.visible=f.phase==='hold';if(this.hairTreatmentFoam)this.hairTreatmentFoam.visible=f.phase==='shampoo'||f.phase==='hairMask'||(id!=='bathHairWash'&&f.phase==='relax'&&a>=38);}else if(prop){prop.visible=f.phase!=='relax'&&f.phase!=='apply'&&(f.phase!=='bodyCream'||a<38);if(this.activity==='bath')for(const c of prop.children)c.visible=c.name===(f.phase==='bomb'&&a<3.15?'bomb':f.phase==='shave'?'razor':f.phase==='bodyCream'?'cream':'');}
    if(blend<.002)return;
    const touch=(hand:0|1,point:THREE.Vector3,axis:THREE.Vector3,offset=.055)=>{
      this.careGoal.copy(point);this.careDirection.copy(axis).normalize();
      this.target.copy(this.careGoal).addScaledVector(this.careDirection,-offset);
      this.reach(hand,this.target,blend,.70);
      this.aimHand(hand,this.handDirection.copy(this.careDirection),blend);
      const error=d.wrists[hand].localToWorld(this.toolTip.set(0,-offset,0)).distanceTo(this.careGoal);
      this.careContactError=Math.max(this.careContactError??0,error);
    };
    if(['shampoo','hairMask','rinse'].includes(f.phase)){
      for(const hand of [0,1] as const){const side=hand===0?-1:1;d.head.localToWorld(this.toolSurface.set(side*(.174+.014*stroke),.075+.05*stroke,.03+.035*Math.cos(a*2)));touch(hand,this.toolSurface,this.toolAxis.set(-side*.65,.70,-.16).applyAxisAngle(up,this.root.rotation.y));}
    }else if(f.phase==='dry'||f.phase==='straighten'||f.phase==='curl'){
      const p=.5+.5*stroke;d.head.localToWorld(this.toolSurface.set(.215+(f.phase==='dry'?.10:.02),.055-.17*p,.035+.025*Math.cos(a*2)));
      touch(1,this.toolSurface,this.toolAxis.set(-.35,.86,-.18).applyAxisAngle(up,this.root.rotation.y),f.phase==='dry'?.157:.145);
      if(prop&&f.blend>.75)this.careContactError=prop.localToWorld(this.toolTip.set(0,f.phase==='dry'?-.132:-.12,0)).distanceTo(this.careGoal);
      d.head.localToWorld(this.toolSurface.set(-.181,-.03-.09*p,.09));touch(0,this.toolSurface,this.toolAxis.set(.65,.60,-.24).applyAxisAngle(up,this.root.rotation.y));
    }else if(f.phase==='bomb'){
      d.chest.localToWorld(this.target.set(.13,this.rightArm.position.y-.28,.32+.11*f.stroke));
      this.reach(1,this.target,blend,.65);this.aimHand(1,this.handDirection.set(0,-.72,.60).applyAxisAngle(up,this.root.rotation.y),blend);
    }else if(f.phase==='shave'){
      // Follow the moving knee and thigh, not a fixed spot in the bathroom.
      const leg=this.rightLeg;
      leg.localToWorld(this.toolSurface.set(.015,-d.thighLength*(.68+.12*stroke),.09));
      const axis=this.toolAxis.set(0,-.86,.50).applyAxisAngle(up,this.root.rotation.y);
      touch(1,this.toolSurface,axis,.105);
      if(prop&&f.blend>.75)this.careContactError=prop.localToWorld(this.toolTip.set(0,-.085,0)).distanceTo(this.careGoal);
    }else if(f.phase==='lip'){
      d.head.localToWorld(this.toolSurface.set(.016+.020*stroke,-.134,.175));
      // Balm points towards the lip, not through the face.
      touch(1,this.toolSurface,this.toolAxis.set(-.10,.50,-.86).applyAxisAngle(up,this.root.rotation.y),.103);
      if(prop&&f.blend>.75)this.careContactError=prop.localToWorld(this.toolTip.set(0,-.0775,0)).distanceTo(this.careGoal);
    }else if(f.phase==='hold'){
      d.chest.localToWorld(this.target.set(.12,this.rightArm.position.y-.25,.31));
      this.reach(1,this.target,blend,.65);this.aimHand(1,this.handDirection.set(0,-.82,.38).applyAxisAngle(up,this.root.rotation.y),blend);
    }else if(f.phase==='dispense'||id==='handCream'||f.phase==='bodyCream'){
      d.chest.localToWorld(this.target.set(-.095,this.leftArm.position.y-.29,.33));
      this.reach(0,this.target,blend,.62);this.aimHand(0,this.handDirection.set(.42,.12,.90).applyAxisAngle(up,this.root.rotation.y),blend);
      d.wrists[0].localToWorld(this.toolSurface.set(0,-.052,.035));
      this.toolSurface.y+=.028+.014*stroke;
      touch(1,this.toolSurface,this.toolAxis.set(-.65,-.45,.38).applyAxisAngle(up,this.root.rotation.y),f.phase==='apply'||(f.phase==='bodyCream'&&a>=38)?.055:.07);
    }else if(f.phase==='apply'){
      // Container stays away from the face. Both bare palms follow cheek
      // targets relative to the live head, with a small surface clearance.
      for(const hand of [0,1] as const){
        const side=hand===0?-1:1;
        d.head.localToWorld(this.toolSurface.set(side*(.125+.018*stroke),-.095+.035*stroke,.166));
        touch(hand,this.toolSurface,this.toolAxis.set(-side*.28,.63,-.72).applyAxisAngle(up,this.root.rotation.y));
      }
    }
  }

  private readonly toolAxis=new THREE.Vector3();
  private readonly toolGoal=new THREE.Vector3();
  private readonly toolOffset=new THREE.Vector3();
  private readonly toolRotation=new THREE.Quaternion();
  private readonly toolHandRotation=new THREE.Quaternion();
  private readonly toolTip=new THREE.Vector3();
  private readonly toolSurface=new THREE.Vector3();
  private toolError:number|null=null;

  // Solve the wrist from the actual working end, not just point a utensil
  // toward a target after the wrist has been animated independently.
  private toolContact(tool:THREE.Object3D,point:THREE.Vector3,tipZ:number,tipY:number,yaw:number,pitch:number,bristlesDown=false):void{
    this.toolGoal.copy(point);
    this.toolAxis.set(Math.sin(yaw),pitch,Math.cos(yaw)).normalize().applyAxisAngle(up,this.root.rotation.y);
    this.basisX.crossVectors(up,this.toolAxis).normalize();
    this.basisZ.crossVectors(this.toolAxis,this.basisX).normalize();
    if(bristlesDown){this.basisX.negate();this.basisZ.negate();}
    this.toolRotation.setFromRotationMatrix(this.rotationBasis.makeBasis(this.basisX,this.basisZ,this.toolAxis));
    this.toolHandRotation.setFromUnitVectors(handAxis,this.toolAxis);
    // Handle center is 4.5 cm from the origin; keep it in the palm.
    this.toolOffset.set(0,tipY,tipZ-.045).applyQuaternion(this.toolRotation);
    this.target.copy(this.toolGoal).sub(this.toolOffset).addScaledVector(this.toolAxis,-.055);
    this.reach(1,this.target,1,.65);
    this.rig.elbows[1].getWorldQuaternion(this.parentRotation).invert();
    this.rig.wrists[1].quaternion.copy(this.parentRotation).multiply(this.toolHandRotation);
    this.rig.wrists[1].getWorldQuaternion(this.parentRotation).invert();
    tool.quaternion.copy(this.parentRotation).multiply(this.toolRotation);
    tool.position.set(0,0,.045).applyQuaternion(tool.quaternion).negate();
    tool.position.y-=.055;
    this.toolTip.copy(tool.localToWorld(this.target.set(0,tipY,tipZ)));
    this.toolError=this.toolTip.distanceTo(this.toolGoal);
  }
  kitchenQA(){return {tool:this.spoon.visible?'spoon':this.props.fork.visible?'fork':this.props.knife.visible?'knife':this.props.spatula.visible?'spatula':this.props.tongs.visible?'tongs':null,
    error:this.toolError,portion:this.mealBite.visible,elapsed:this.activityTime};}

  /** World-space station target with offsets in the actor's facing direction.
   * Reusing the scratch vectors avoids per-frame garbage on mobile. */
  private stationTarget(surface: THREE.Vector3, sideways: number, height: number, forward: number): THREE.Vector3 {
    return this.target.copy(surface).add(
      this.handDirection.set(sideways, height, forward).applyAxisAngle(up, this.root.rotation.y));
  }

  update(dt: number, steer?: Steering, pathDt = dt): void {
    this.clock += dt;
    this.syncBathPrivacy();
    this.gestureTime += dt;
    this.activityTime += dt;
    if(this.partnerGesture)this.partnerGesture.time+=dt;
    const poolStep=this.poolStepTravel;this.poolStepTravel=0;
    // Timed coffee delivery must keep up with the authoritative route clock.
    // Substep movement only, retaining the existing steering/obstacle checks.
    const firstStep=Math.min(pathDt,.20);
    let walked=this.advance(firstStep,steer);
    for(let remaining=pathDt-firstStep;remaining>1e-6&&this.isWalking();){
      const step=Math.min(remaining,.20);
      walked+=this.advance(step,steer);remaining-=step;
    }
    const traveled = walked+poolStep+(this.activity==='badminton'||this.activity==='pingPong'?this.badmintonTravel:0);this.badmintonTravel=0;
    const sport=this.activity==='badminton'||this.activity==='pingPong';
    const finishingStep=walked>.001&&this.pose==='idle'&&!this.activity&&!this.gesture&&!this.partnerGesture;
    const walking = (this.waypoints.length > 0 || sport || poolStep>0 || finishingStep) && traveled > .001;
    const alpha = 1 - Math.exp(-dt * 11);
    const targetMotion=walking?(sport?1:walkMotionTarget(traveled,poolStep>0?dt:pathDt,HOME_WALK_SPEED)):0;
    this.gaitBlend = THREE.MathUtils.lerp(this.gaitBlend,targetMotion,
      1-Math.exp(-dt*(targetMotion<this.gaitBlend?14:11)));
    const strideLength = walkStrideLength(this.id);
    this.gait = (this.gait + traveled / strideLength) % 1;
    const t = this.clock + (this.id === 'vlad' ? 0 : 1.9);
    const seated = this.pose === 'sit' || this.pose === 'work';
    const asleep = this.pose === 'sleep';
    const reclining=this.partnerGesture?.motion==='bedRest'||this.activity==='spaRecline'||this.activity==='spaMassage';
    const resting=asleep||reclining;
    this.restTime=resting?this.restTime+dt:0;
    const rest=resting?sleepPosture(this.id,this.restTime,reclining):null;
    if(rest&&(this.activity==='spaMassage'||this.activity==='spaRecline')){rest.roll=0;rest.lift=0;rest.headYaw=this.activity==='spaMassage'?.34:.08;rest.headRoll=0;rest.headPitch=0;rest.chestPitch=0;for(const arm of rest.arms)Object.assign(arm,{x:-.10,y:0,z:0,bend:-.20,end:0});for(const leg of rest.legs)Object.assign(leg,{x:0,y:0,z:0,bend:.06,end:0});}
    this.seatBlend = THREE.MathUtils.lerp(this.seatBlend,seated?1:0,1-Math.exp(-dt*(walking?18:9)));
    const weightTransfer = this.seatBlend*(1-this.seatBlend)*4;
    const transfer=seatTransfer(this.seatBlend,seated);
    const care = this.activity === 'pet' || this.activity === 'brush' || this.activity === 'feed'||this.activity==='treat'||this.activity==='bathe';
    const breath = Math.sin(t * (asleep ? 1.35 : 1.85));
    let lean = this.pose === 'work' ? 0.26 : this.activity === 'cook' ? 0.14 : care ? 0.48 : 0;
    if (this.pose === 'sit' && !this.activity) lean = -0.08;
    let gaze = asleep ? 0.04 : this.pose === 'work' ? 0.16 : this.activity === 'cook' ? 0.22 : care ? 0.33 : 0;
    const stridePhase = this.gait * Math.PI * 2;
    const motion = resting?0:this.gaitBlend*(1-this.seatBlend);
    // Idle-only, cosmetic reactions. Never steal control, stop a route or move
    // the navigation root. Reset immediately for every gameplay animation.
    const canReact = this.pose === 'idle' && !this.activity && !this.gesture && !this.partnerGesture &&
      !this.carryingBook && !this.workCoffeeCarrying && !this.catchProp && this.conversationYaw===null && this.closingBook <= 0 && !this.waypoints.length &&
      traveled < 0.0001 && motion < 0.08;
    if (!canReact) {
      this.needReaction = null;
      this.needReactionTime = 0;
      this.needReactionCooldown = Math.max(this.needReactionCooldown, 4);
    } else if (this.needReaction && !reactionAllowed(this.needs, this.needReaction)) {
      this.needReaction = null;
      this.needReactionTime = 0;
      this.needReactionCooldown = 2.5;
    } else if (this.needReaction) {
      this.needReactionTime += dt;
      if (this.needReactionTime >= NEED_REACTION_DURATION) {
        this.needReaction = null;
        this.needReactionCooldown = 15 + (this.needReactionTurn % 3) * 3.5 +
          (this.id === 'alina' ? 2.5 : 0);
      }
    } else {
      this.needReactionCooldown -= dt;
      if (this.needReactionCooldown <= 0) {
        this.needReaction = pickNeedReaction(this.needs, this.needReactionTurn++);
        this.needReactionTime = 0;
        if (!this.needReaction) this.needReactionCooldown = 2.5;
      }
    }
    // Natural habits fill quiet moments, but real need warnings take
    // precedence. In particular a yawn/urgent bladder gesture never gets
    // replaced by a cheery cosmetic action. Nothing here moves the root.
    const canIdle = canReact && !!this.needs && !this.needReaction &&
      !pickNeedReaction(this.needs, 0);
    if (!canIdle || (this.idleGesture && !residentIdleAllowed(this.idleGesture, this.idleContext))) {
      this.idleGesture = null;
      this.greeting=false;
      this.idleGestureTime = 0;
      this.idleCooldown = Math.max(this.idleCooldown, canReact ? 3 : 4);
    } else if (this.idleGesture) {
      this.idleGestureTime += dt;
      if (this.idleGestureTime >= RESIDENT_IDLE_SECONDS) {
        this.idleGesture = null;
        this.greeting=false;
        this.idleGestureTime = 0;
        this.idleCooldown = 6.8 + ((this.idleTurn * 7) % 5) * 1.45 +
          (this.id === 'alina' ? 1.3 : 0);
      }
    } else {
      this.idleCooldown -= dt;
      if(this.clock<=this.arrivalUntil&&residentIdleAllowed('noticePartner',this.idleContext)&&
        expressiveDemeanor(this.needs,'idle',this.emotion).friendly){
        this.idleGesture='noticePartner';
        this.idleGestureTime=0;
        this.greeting=true;
        this.arrivalUntil=-1;
        this.nextGreeting=this.clock+80;
      }else if(this.clock<=this.petArrivalUntil &&
        residentIdleAllowed('noticePet',this.idleContext) &&
        this.needs!.mood>=35 && this.needs!.energy>=24 && this.needs!.hunger>=20){
        this.idleGesture='noticePet';
        this.idleGestureTime=0;
        this.petArrivalUntil=-1;
        this.nextPetNotice=this.clock+70;
      }else if (this.idleCooldown <= 0) {
        this.idleGesture = chooseResidentIdle(this.id, this.idleContext, this.idleTurn++);
        this.idleGestureTime = 0;
      }
    }
    const next = this.waypoints[0];
    const turn = next ? THREE.MathUtils.euclideanModulo(
      Math.atan2(next.x - this.root.position.x, next.z - this.root.position.z) - this.root.rotation.y + Math.PI,
      2 * Math.PI,
    ) - Math.PI : 0;
    const lead = THREE.MathUtils.clamp(turn * 0.42, -0.19, 0.19) * motion;
    // Settle the arm swing near arrival without changing the stride or route.
    const settling = this.waypoints.length === 1 && next
      ? THREE.MathUtils.smoothstep(this.root.position.distanceTo(next), 0.02, 0.45) : 1;
    // Upright walking: very small, soft pelvis displacement instead of a
    // permanent 12 cm squat. Knee reach is solved with shorter foot arcs.
    const stanceDrop = walkPelvisDrop(this.gait, motion);
    const data = this.rig;
    const armA = this.leftArm, armB = this.rightArm;
    let leftY = -data.upperArm - data.lowerArm + 0.018;
    let rightY = leftY;
    const emotionMode=asleep?'sleep':this.activity||this.gesture||this.partnerGesture||seated||this.carryingBook||this.closingBook>0||this.foodContainer.visible?'busy':motion>.08?'walking':'idle';
    const demeanor=expressiveDemeanor(this.needs,emotionMode,this.emotion);
    let leftZ = -0.22 * demeanor.swing * Math.cos(stridePhase - 0.18) * motion * (0.38 + 0.62 * settling);
    let rightZ = -leftZ;
    let armSpread = -0.074 - motion * 0.009 * Math.sin(stridePhase);
    if (this.carryingBook && this.activity !== 'read') {
      rightY = -.38;
      rightZ = .23;
    }
    if (this.foodContainer.visible) {
      rightY = -.32;
      rightZ = .30;
    }
    let expression = asleep ? 0.07 : 0.055 + 0.055 * Math.max(0, Math.sin(t * 0.39)) ** 5;
    if (asleep||reclining) {
      // Relax the arms beside the torso. The old bent-chest pose rotated the
      // hands straight up into the air when the whole rig reclined in bed.
      leftY = -data.upperArm - data.lowerArm + 0.11;
      rightY = -data.upperArm - data.lowerArm + 0.13;
      leftZ = 0.04;
      rightZ = 0.06;
      armSpread = -0.11;
    }
    if (seated) {
      leftY = rightY = -0.44;
      leftZ = rightZ = 0.29;
    }
    if (this.pose === 'work') {
      // Existing keyboard placement is untouched. Add believable cycles:
      // bursts of typing, a short pause to check the monitor, then typing.
      const variant=this.homeWorkStyle?HOME_JOBS[this.homeWorkStyle as keyof typeof HOME_JOBS]?.animation??0:0;
      const cycle=(t*(1+variant*.035) + (this.id==='vlad'?0:2.8))%11.6;
      const pause=THREE.MathUtils.smoothstep(cycle,4.8,5.5) *
        (1-THREE.MathUtils.smoothstep(cycle,6.6,7.15));
      gaze += 0.032*Math.sin(t*1.18) - .10*pause;
      lean+=.035*pause+(this.homeWorkStyle?Math.sin(t*.36+variant)*(.012+variant*.003):0);
      if(this.homeWorkStyle)gaze+=Math.sin(t*.75+variant)*(.02+variant*.004);
      const beats=1-pause;
      const leftTap = beats * Math.max(0, Math.sin(t * 9.0)) ** 2;
      const rightTap = beats * Math.max(0, Math.sin(t * 11.4 + 1.3)) ** 2;
      leftY = 0.097 - leftTap * 0.022;
      rightY = 0.100 - rightTap * 0.022;
      leftZ = 0.48 + leftTap * 0.025;
      rightZ = 0.51 + rightTap * 0.027;
    }

    let crouch = 0;
    let bite = 0;
    const a = this.activityTime;
    const activityEase = this.activity ? THREE.MathUtils.smoothstep(a,.02,.42) : 0;
    const kitchenStep = this.activity === 'cook' ? kitchenMove(this.cookingRecipe,a) : undefined;
    const barbecueStep = this.activity === 'grill' ? grillMove(this.cookingRecipe,a) : undefined;
    if (this.activity) {
      switch (this.activity) {
        case 'cook':
          leftY = -.24;
          rightY = -.218 + Math.sin(a * (kitchenStep==='chop'?7:4.2))*.032;
          leftZ = .36;
          rightZ = .43 + Math.cos(a*4.2)*.053;
          lean = kitchenStep==='knead'?.17:.13;
          gaze = .20;
          break;
        case 'prep':
          leftY = -.24;
          rightY = -.19 + Math.sin(a*6.0)*.045;
          leftZ=.33; rightZ=.41;
          lean=.14; gaze=.20;
          break;
        case 'eat': {
          // Pick up a portion, bring it to the mouth, chew and rest between bites.
          // Each resident eats at a slightly different rhythm.
          const meal = mealGesture(this.mealSlow?a/2.8:a, this.id);
          if(isHomeDrink(this.diningDish)){meal.chew=0;meal.loaded=0;}
          bite = meal.lift;
          rightY = THREE.MathUtils.lerp(-0.40, 0.145, bite);
          rightZ = THREE.MathUtils.lerp(0.36, 0.12, bite);
          leftY = -0.43 + meal.settle * 0.025;
          leftZ = 0.30 + meal.settle * 0.018;
          gaze = .15 + .11 * bite - .035 * meal.chew + meal.glance;
          lean = .045 + .013 * meal.chew;
          expression = .065 + chewPulse(this.mealSlow?a/2.8:a,meal.chew,this.id) * .095;
          if(this.mealSlow&&this.parkChatUntil>this.clock&&bite<.15){leftY+=.11*Math.sin(a*2.8);leftZ+=.16;expression=.18+.10*Math.sin(a*5);gaze=.015;}
          break;
        }
        case 'dishes':
          // Both hands rinse the carried plate over the sink.
          leftY = -.11 + .04 * Math.sin(a * 4);
          rightY = -.09 - .04 * Math.sin(a * 4);
          leftZ = rightZ = .35;
          lean = .15;
          gaze = .22;
          break;
        case 'wash':
          leftY = -0.07 + 0.048 * Math.sin(a * 4.3);
          rightY = -0.08 - 0.048 * Math.sin(a * 4.3);
          leftZ = rightZ = 0.29;
          gaze = 0.10;
          break;
        case 'vanity': {
          const id=this.vanityKind,cycle=Math.sin(a*2.6),lift=.5+.5*Math.sin(a*1.7);
          if(id==='brush'||id==='style'||id==='fancy'||id==='vladStyle'){rightY=.19+.15*cycle;rightZ=.10+.045*Math.cos(a*2.6);leftY=-.22+.13*lift;leftZ=.22;armSpread=.22;gaze=.04;}
          else if(id==='perfume'||id==='vladPerfume'){rightY=-.02+.13*lift;rightZ=.26;leftY=-.23;gaze=.06;}
          else if(id==='vladShave'){rightY=.065+.07*cycle;rightZ=.18+.015*Math.cos(a*3);leftY=-.28;gaze=.04;}
          else if(id==='handCream'){rightY=-.12+.05*cycle;leftY=-.12-.05*cycle;leftZ=rightZ=.29;gaze=.16;}
          else if(id==='lipCare'){rightY=.055+.025*cycle;rightZ=.19;leftY=-.24;gaze=.05;}
          else if(id==='skin'||id==='hydrate'||id==='serum'||id==='faceMask'){rightY=.07+.08*cycle;rightZ=.18;leftY=.04-.08*cycle;leftZ=.18;gaze=.04;}
          else {rightY=.10+.055*cycle;rightZ=.17+.015*Math.cos(a*3.4);leftY=-.24;gaze=.02;}
          lean=.02;break;
        }
        case 'teeth': {
          // Keep the brush near the mouth, not above the eye/temple. Tiny
          // strokes are enough; the head should not intersect the forearm.
          const stroke = Math.sin(a*8.0);
          rightY = .075 + stroke*.018;
          rightZ = .19 + stroke*.020;
          leftY = -.31;
          gaze = .07;
          this.props.brush.visible = true;
          break;
        }
        case 'washHands':
          lean = .24;
          crouch = .08;
          gaze = .28;
          break;
        case 'fishing':
          lean=.04;gaze=.10;leftY=-.12;rightY=-.12;leftZ=.30;rightZ=.30;break;
        case 'grill':
          lean = .16;
          gaze = .18;
          break;
        case 'watch': {
          // Keep the established sofa pose. React with small gestures to the
          // genre, without popping up or resetting another character's seat.
          const beat=Math.max(0,Math.sin(a*.93));
          const laugh=this.reaction>0?beat*beat:0;
          const tense=this.reaction<0?Math.max(0,Math.sin(a*2.4)):0;
          const relax=.5+.5*Math.sin(a*.46+(this.id==='vlad'?0:1.4));
          gaze=-.05+Math.sin(a*1.22)*.047+.16*tense-.035*laugh;
          lean=-.07 + tense*.048 - laugh*.038;
          leftY=-.43 + laugh*.09 - tense*.04;
          rightY=-.40 + laugh*.19 - tense*.06;
          leftZ=.26 + laugh*.035;rightZ=.26 + laugh*.11;
          armSpread=-.06+relax*.025;
          expression=this.reaction>0?.15+laugh*.5:this.reaction<0?.035:.08;
          break;
        }
        case 'shower':
          leftY = .20 + Math.sin(a * 4) * .13;
          rightY = .23 - Math.sin(a * 4) * .14;
          leftZ = rightZ = .24;
          armSpread = .15;
          gaze = .10 + Math.sin(a * 2.1) * .08;
          break;
        case 'spaSwim': {
 const stroke=Math.sin(a*2.7);leftY=.05+.26*stroke;rightY=.05-.26*stroke;leftZ=.30+.12*stroke;rightZ=.30-.12*stroke;armSpread=.33;lean=.08;gaze=.04;break;
 }
        case 'bath':
          leftY = rightY = -.37;
          leftZ = .19;
          rightZ = .26;
          gaze = -.04 + Math.sin(a * 1.3) * .06;
          lean = -.13;
          if(this.vanityKind){const f=careFrame(this.vanityKind,a);lean=-.25;if(f.phase==='bomb'){rightY=-.12;rightZ=.30;leftY=-.22;gaze=.10;}else if(f.phase==='shave'){lean=.18*f.blend-.25*(1-f.blend);gaze=.27*f.blend;leftY=-.18;rightY=-.29;}else if(f.phase==='bodyCream'){lean=.04;gaze=.13;leftY=-.16;rightY=-.15;}}
          break;
        case 'toilet':
          leftY = rightY = -.43;
          leftZ = rightZ = .24;
          gaze = .12;
          lean = .08;
          break;
        case 'tidy':
          leftY = -0.27 + 0.11 * Math.sin(a * 3);
          rightY = -0.21 - 0.11 * Math.sin(a * 3);
          leftZ = 0.36; rightZ = 0.43;
          crouch = 0.055;
          lean = 0.15;
          break;
        case 'coffee':
          leftY = -.32 + .045 * Math.sin(a * 2.8);
          rightY = -.15 + .085 * Math.sin(a * 3.4);
          leftZ = .31;
          rightZ = .29 + .045 * Math.cos(a * 3.4);
          gaze = .18;
          lean = .10;
          break;
        case 'tea':
          leftY = -0.34;
          rightY = -0.10 + 0.11 * Math.sin(a * 2.8);
          leftZ = 0.27; rightZ = 0.21;
          gaze = 0.16;
          break;
        case 'reach': {
          const reach = Math.sin(Math.PI * Math.min(1, a / 1.45));
          rightY = -.52 + .46 * reach;
          rightZ = .16 + .38 * reach;
          lean = .14 * reach;
          gaze = .17;
          break;
        }
        case 'chat': {
          const speaking = Math.sin(a * 1.52 + (this.id === 'alina' ? Math.PI : 0));
          const gesture = Math.max(0, speaking) * (.72 + .28 * Math.sin(a * 5));
          leftY = -.49 + .25 * gesture;
          rightY = -.48 + .34 * gesture;
          rightZ = .26 + .15 * gesture;
          gaze = .07 - .08 * Math.sin(a * 3.1);
          expression = .14 + .37 * gesture;
          break;
        }
        case 'gymRun': {
          const beat=Math.sin(a*8);leftY=rightY=-.27;leftZ=.23+beat*.18;rightZ=.23-beat*.18;lean=.10;crouch=.025*(1+Math.cos(a*16));break;
        }
        case 'gymCycle':case 'gymStep': {
          leftY=rightY=-.20;leftZ=rightZ=.39;lean=this.activity==='gymCycle'?.18:.06;crouch=this.activity==='gymStep'?.025*(1+Math.sin(a*8)):0;break;
        }
        case 'gymRow': {
          const pull=(1+Math.cos(a*3))/2;leftY=rightY=-.22+.12*pull;leftZ=rightZ=.52-.30*pull;lean=.23-.29*pull;break;
        }
        case 'gymPress': {
          const push=(1+Math.sin(a*2.8))/2;leftY=rightY=-.12+.09*push;leftZ=rightZ=.24+.30*push;armSpread=.13;break;
        }
        case 'gymPull': {
          const pull=(1+Math.sin(a*2.6))/2;leftY=rightY=.42-.62*pull;leftZ=rightZ=.22;armSpread=.33;lean=.07;break;
        }
        case 'gymSquat': {
          const down=(1+Math.sin(a*2.7))/2;leftY=rightY=.13;leftZ=rightZ=.12;armSpread=.37;crouch=.19*down;lean=.15*down;break;
        }
        case 'gymCurl': {
          const curl=(1+Math.sin(a*3))/2;leftY=rightY=-.51+.55*curl;leftZ=rightZ=.11+.13*curl;armSpread=.08;break;
        }
        case 'gymStretch': {
          const wave=Math.sin(a*.85);leftY=rightY=.28+.12*wave;leftZ=rightZ=.12;armSpread=.38;lean=.10+.10*wave;break;
        }
        case 'gymLeg': {
          leftY=rightY=-.35;leftZ=rightZ=.15;lean=-.08;break;
        }
        case 'stretch':
          leftY = rightY = 0.28 + 0.06 * Math.sin(a * 2);
          leftZ = rightZ = 0.11;
          armSpread = 0.28;
          expression = 0.15;
          break;
        case 'read':
          leftY = -.23;
          rightY = -.23 + .079*Math.sin(Math.PI*THREE.MathUtils.smoothstep(a%10.5,8.15,9.10));
          leftZ = rightZ = .36;
          armSpread = .31;
          gaze = .26+.034*Math.sin(a*1.3);
          break;
        case 'scrollPhone':
          rightY=-.25+.027*Math.sin(a*3.3);rightZ=.36;
          leftY=-.26+.034*Math.sin(a*4.1);leftZ=.31;
          armSpread=.24;gaze=.29;lean=.05;expression=.07;break;
        case 'phone':
          rightY = 0.075 + 0.016 * Math.sin(a * 2.3);
          rightZ = 0.11;
          gaze = 0.04;
          expression = 0.16;
          break;
        case 'music':
          leftY = -0.36 + 0.045 * Math.sin(a * 2.5);
          rightY = -0.36 - 0.045 * Math.sin(a * 2.5);
          gaze = 0.065 * Math.sin(a * 1.4);
          expression = 0.12;
          break;
        case 'modeling':gaze=.30;lean=.14;rightY=-.31;rightZ=.44;leftY=-.33;leftZ=.40;break;
        case 'journal':
          leftY = -0.33;
          rightY = -0.31 + 0.025 * Math.sin(a * 7);
          leftZ = 0.35; rightZ = 0.37;
          gaze = 0.23;
          break;
        case 'venueBowl':{
          const cycle=(a+(this.id==='alina'?7:0))%14,p=cycle%7,active=cycle<7;
          const swing=active?Math.sin(Math.PI*Math.max(0,Math.min(1,(p-.3)/2.4))):0;
          rightY=-.48+.38*swing;rightZ=.15+.42*swing;leftY=-.42;leftZ=.18;lean=.10+.24*swing;crouch=.045*swing;break;
        }
        case 'venueHockey':{
          const beat=Math.sin(a*3.3+(this.id==='alina'?Math.PI:0));lean=.22;rightY=-.38;rightZ=.42+.10*beat;leftY=-.43;leftZ=.29;gaze=.30;break;
        }
        case 'venueCards':case 'venueJenga':{
          const cycle=(a+(this.id==='alina'?4.5:0))%9,p=cycle%4.5,reach=cycle<4.5?Math.sin(Math.PI*Math.min(1,p/2.2)):0;
          lean=.12+.22*reach;rightY=-.39+.22*reach;rightZ=.26+.26*reach;leftY=-.35;leftZ=.25;gaze=.32;expression=.15;break;
        }
        case 'darts': {
          const aim=(Math.sin(a*2.2)+1)/2;rightY=-.12+.28*aim;rightZ=.24+.35*aim;gaze=.04;expression=.20;break;
        }
        case 'badminton': {
          const hit=this.badmintonFrame?.hit??0;lean=.12+.12*hit;rightY=-.20+.32*hit;rightZ=.25;leftY=-.22;leftZ=.24+.08*hit;gaze=-.08;expression=.20;break;
        }
        case 'pingPong': {
          const hit=this.tennisTarget?this.tennisHit:Math.max(0,Math.sin(a*3));lean=.18+.08*hit;rightY=-.32+.13*hit;rightZ=.35+.13*hit;leftY=-.30;leftZ=.26;gaze=.18;break;
        }
        case 'venueCue':
        case 'billiards': {
          lean=.38+.10*Math.sin(a*1.5);gaze=.32;leftY=-.39;leftZ=.53;rightY=-.42+.08*Math.sin(a*3);rightZ=.30;break;
        }
        case 'chess': {
          const reach=Math.max(0,Math.sin(a*1.4));
          lean=.13+.13*reach;gaze=.28;leftY=-.42;leftZ=.26;
          rightY=-.36+.13*reach;rightZ=.28+.24*reach;expression=.14;break;
        }
        case 'consolePlay':lean=.13+.035*Math.sin(a*1.7);gaze=.015;expression=.24+.12*Math.sin(a*2.2);break;
        case 'games':
          // The existing reusable keyboard IK animates both hands.
          expression = 0.20;
          break;
        case 'bathe': {
          const stroke=Math.sin(a*4.7);crouch=.10;lean=.34+.018*stroke;gaze=.38;leftY=-.24;rightY=-.20+.045*stroke;leftZ=.40;rightZ=.45;expression=.17;break;
        }
        case 'brush': {
          // Short, repeatable strokes, with the body leaning toward the pet.
          // No navigation or physics movement: only bones and a held prop.
          const stroke = Math.sin(a * 6.2);
          crouch = .51;
          lean = .60 + .016 * stroke;
          gaze = .29;
          leftY = -.31;
          leftZ = .31;
          rightY = -.19 + .045 * stroke;
          rightZ = .40 + .055 * stroke;
          expression = .17;
          break;
        }
        case 'play':
          expression = 0.42;
          leftY = -0.29 + Math.sin(a * 5) * 0.11;
          rightY = -0.29 - Math.sin(a * 5) * 0.11;
          leftZ = rightZ = 0.42;
          crouch = 0.14;
          gaze = 0.24;
          break;
        default:
          crouch = this.activity === 'feed' ? 0.42 : this.activity==='pet'?.60:0.32;
          if(this.activity==='pet'){lean=.72;gaze=.40;expression=.28;}
          leftY = -0.49;
          rightY = -0.455 + Math.sin(a * 4) * 0.034;
          leftZ = 0.20;
          rightZ = 0.40 + Math.sin(a * 4 + 1) * 0.07;
          break;
      }
    }
    let embrace = 0;
    let highFive = 0;
    const g = this.gestureTime;
    if (this.gesture) {
      // A high-five must remain visible long enough for both people to meet palms.
      // The earlier 1.4s envelope ended before much of the 5s co-op action.
      const duration = 5; // matched to the full cooperative server action
      // The high-five reaches full palm contact in the first half second,
      // then holds it for the joint action; normalizing across five seconds
      // used to delay the touch until after the other arm had already passed.
      const reach = this.gesture === 'hug'
        ? THREE.MathUtils.smoothstep(g,.12,.65) * (1-THREE.MathUtils.smoothstep(g,3.35,4.35))
        : THREE.MathUtils.smoothstep(g,.07,.28) * (1-THREE.MathUtils.smoothstep(g,4.05,4.75));
      if (this.gesture === 'hug') {
        expression = 0.11 + 0.72 * reach;
        gaze = 0.030 * reach;
        armSpread = -0.28 * (1 - reach) + 0.25 * reach;
        leftY = rightY = THREE.MathUtils.lerp(-0.56, -0.06, reach);
        leftZ = rightZ = reach * 0.44;
        embrace = reach * 0.14;
        lean = 0.20 * reach;
        this.heart.scale.setScalar(0.69 + reach * 0.26);
      } else {
        highFive = reach;
        expression = 0.10 + 0.56 * reach;
        // Both face each other. Their raised hands meet on the same side of
        // the shared center line by using opposite shoulders.
        if (this.id === 'vlad') { rightY = -0.56 + 0.76 * reach; rightZ = 0.36 * reach; }
        else { leftY = -0.56 + 0.76 * reach; leftZ = 0.36 * reach; }
        lean = 0.07 * reach;
      }
      if (g >= duration + .05) this.setPose('idle');
    }

    const pair=this.partnerGesture;
    let intimateContact=0;
    let partnerRoll=0, partnerHead=0, partnerReach=0, partnerForward=0,partnerYaw=0,partnerSide=0,partnerChestYaw=0;
    if(pair){
      const sec=pair.time;
      const rise=THREE.MathUtils.smoothstep(sec,.12,.78);
      // Contact is sustained for the server action's real duration (5 / 8 /
      // 13 seconds), then released gradually instead of freezing halfway.
      const longDance = pair.motion==='slowDance'||pair.motion==='dance';
      const shortContact = pair.motion==='hug'||pair.motion==='closeHug'||
        pair.motion==='kiss'||pair.motion==='cheek'||pair.motion==='highFive';
      const duration = pair.motion==='gift'?20:pair.motion==='sofaMassage'?40:pair.motion==='bedRest'?35:pair.motion==='sofaLean'||pair.motion==='sofaHug'?20:pair.motion==='sofaHands'?18:pair.motion==='cuddle'?15:longDance ? 13 : shortContact ? 5 : 8;
      const contact=rise*(1-THREE.MathUtils.smoothstep(sec,duration-1.45,duration-.40));
      switch(pair.motion){
        case 'hug':case 'closeHug': {
          const weight=contact;
          leftY=rightY=-.54+.47*weight; leftZ=rightZ=.39*weight;
          armSpread+=.32*weight; embrace=weight*.091; lean=.14*weight;
          partnerForward=(pair.motion==='closeHug'?.083:.071)*weight;
          partnerReach=weight;
          partnerRoll=.018*Math.sin(sec*1.65)*weight;
          expression=.13+.45*weight; partnerHead=(pair.leads?-.11:.14)*weight;
          break;
        }
        case 'kiss':case 'cheek':
          lean+=(pair.motion==='kiss'?.19:pair.leads?.17:.035)*contact;
          partnerForward=(pair.motion==='kiss'?.151:pair.leads?.146:.048)*contact;
          partnerHead=(pair.motion==='cheek'?.21:.22)*(pair.leads?-1:1)*contact;
          partnerRoll=(pair.leads?-.041:.028)*contact;
          crouch+=(this.id==='vlad'?.047:0)*contact;
          gaze+=(pair.leads?-.075:.055)*contact;
          intimateContact=contact;
          expression+=.13*rise-.08*contact;
          leftY+=.07*contact; rightY+=.11*contact;
          break;
        case 'gift':
          partnerReach=contact;rightY+=.15*contact;leftY+=.15*contact;expression+=.30*rise;
          if(this.vanityProp)this.vanityProp.visible=pair.leads?sec<10:sec>=10;break;
        case 'sofaMassage':{
          const side=pair.partner?Math.sign(this.root.worldToLocal(pair.partner.bodyPosition(new THREE.Vector3())).x-this.figure.position.x):1;
          if(pair.leads){partnerReach=contact;partnerYaw=(side||1)*.30*contact;partnerRoll=-(side||1)*.12*contact;if(side>0)rightY+=.25*contact;else leftY+=.25*contact;}
          else {gaze+=.10*contact;partnerHead=.045*Math.sin(sec*1.8)*contact;}expression+=.23*rise;break;
        }
        case 'hands':case 'slowDance':
          partnerReach=contact; rightY+=.18*contact; leftY+=.12*contact; expression+=.24*contact;
          partnerRoll=pair.motion==='slowDance'?Math.sin(sec*1.6)*.095*contact:.03*contact; gaze-=.025*contact;
          break;
        case 'hair':case 'shoulder':
          partnerReach=pair.leads?contact:0;
          if(pair.leads) { rightY+=.43*contact; rightZ+=.22*contact; lean+=.06*contact; }
          else partnerHead=.10*contact;
          expression+=.20*rise; break;
        case 'cuddle':case 'sofaLean':case 'sofaHands':case 'sofaKiss':case 'sofaHug':{
          // Seats face the same direction. Derive the inward side from the actual
          // partner body anchor, including rotated purchased sofas.
          const side=pair.partner?Math.sign(this.root.worldToLocal(pair.partner.bodyPosition(new THREE.Vector3())).x-this.figure.position.x):this.id==='vlad'?-1:1;
          const inward=side||1;
          const strength=pair.motion==='sofaLean'?(pair.leads?1:.10):pair.motion==='sofaKiss'?.77:pair.motion==='sofaHands'?.20:.72;
          partnerRoll=-inward*.32*contact*strength;
          partnerHead=-inward*.18*contact*strength;
          partnerSide=inward*.045*contact*strength;
          partnerYaw=inward*(pair.motion==='sofaKiss'?.86:.24)*contact;
          partnerChestYaw+=inward*(pair.motion==='sofaKiss'?.56:pair.motion==='sofaHug'?.18:.06)*contact;
          if(pair.motion==='sofaHands'||pair.motion==='sofaHug'&&pair.leads)partnerReach=contact;
          if(inward>0)rightY+=.13*contact;else leftY+=.13*contact;
          if(pair.motion==='sofaKiss'){intimateContact=contact;expression+=.12*contact;}
          else expression+=.30*contact;
          break;
        }
        case 'teaTogether':{
          const speaking=Math.floor(sec/3)%2===(pair.leads?0:1);
          expression+=(speaking?.28:.12)*rise;gaze+=.035*Math.sin(sec*(speaking?3:1.5));
          if(pair.partner){const other=pair.partner.bodyPosition(new THREE.Vector3());const self=this.bodyPosition(new THREE.Vector3());const yaw=Math.atan2(other.x-self.x,other.z-self.z)-this.root.rotation.y;partnerYaw=THREE.MathUtils.clamp(Math.atan2(Math.sin(yaw),Math.cos(yaw)),-.48,.48)*rise;}
          break;
        }
        case 'musicTogether':
          expression+=.16*rise;partnerHead=.035*Math.sin(sec*2);gaze+=.035*Math.sin(sec*1.6);break;
        case 'bedRest':
          expression+=.16*rise;
          partnerYaw=(this.id==='vlad'?.18:-.18)*contact;
          gaze+=.025*Math.sin(sec*1.6);break;
        case 'dance':
          partnerRoll=Math.sin(sec*3.6)*.16*contact; crouch+=.055*(1+Math.cos(sec*4.2))*contact;
          leftY+=.36*(.60+.4*Math.sin(sec*3.6))*contact; rightY+=.36*(.60-.4*Math.sin(sec*3.6))*contact;
          leftZ+=.20*contact;rightZ+=.22*contact;expression+=.45*contact;break;
        case 'laugh':
          lean+=.11*Math.max(0,Math.sin(sec*5))*contact; partnerRoll=.06*Math.sin(sec*4)*contact;
          rightY+=.20*contact; expression+=.64*contact; break;
        default: {
          const speaking=pair.leads?sec%8<3.4:sec%8>=3.4;
          const breadth=pair.motion==='explain'?.28:pair.motion==='listen'?.10:.18;
          if(speaking){
            rightY+=breadth*(.55+.45*Math.sin(sec*3.4))*contact;
            rightZ+=breadth*contact;leftY+=breadth*.48*Math.sin(sec*2.47)*contact;
          }else gaze+=.07*Math.max(0,Math.sin(sec*2.4))*contact;
          partnerHead=.048*Math.sin(sec*1.72)*contact;expression+=.17*contact;
        }
      }
    }

    // Continuous, small expressions across ordinary idle and walking.
    // Active cooking, seats, hugs and sleep keep their original authored poses.
    const moodWeight=this.needReaction?0:this.idleGesture?.35:1;
    lean+=demeanor.shoulders*moodWeight;
    gaze+=demeanor.gaze*moodWeight;
    expression=THREE.MathUtils.clamp(expression+demeanor.smile*moodWeight,0,.78);

    // Reuse the exact same lightweight articulated rig used by cooking and
    // talking: a few soft arm/head targets, no new meshes or animation files.
    const needWeight = this.needReaction ? needReactionWeight(this.needReactionTime) : 0;
    let restlessSway = 0;
    if (needWeight > 0) {
      const w = needWeight;
      switch (this.needReaction) {
        case 'yawn': {
          // Vlad covers a yawn with his right hand; Alina with her left.
          if (this.id === 'vlad') {
            rightY = THREE.MathUtils.lerp(rightY, 0.24, w);
            rightZ = THREE.MathUtils.lerp(rightZ, 0.18, w);
          } else {
            leftY = THREE.MathUtils.lerp(leftY, 0.22, w);
            leftZ = THREE.MathUtils.lerp(leftZ, 0.19, w);
          }
          gaze = THREE.MathUtils.lerp(gaze, -0.11, w);
          lean -= 0.045 * w;
          expression = THREE.MathUtils.lerp(expression, 0.025, w);
          break;
        }
        case 'tired': {
          const phase=this.needReactionTime;
          restlessSway=.085*Math.sin(phase*3.1)*w;
          lean+=.105*w;
          gaze+=.22*w;
          expression=THREE.MathUtils.lerp(expression,.01,w);
          break;
        }
        case 'hunger':
          // One hand on the stomach, a brief forward glance.
          rightY = THREE.MathUtils.lerp(rightY, -0.47, w);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.21, w);
          leftY = THREE.MathUtils.lerp(leftY, -0.55, w);
          gaze += 0.14 * w;
          lean += (0.095 + .022*Math.sin(this.needReactionTime*3.4)) * w;
          expression = THREE.MathUtils.lerp(expression, 0.018, w);
          break;
        case 'bladder':
          // Restless weight shifts, without crouching or shifting navigation.
          restlessSway = 0.034 * Math.sin(this.needReactionTime * 5.2) * w;
          leftY = THREE.MathUtils.lerp(leftY, -0.43, w);
          rightY = THREE.MathUtils.lerp(rightY, -0.40, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.16, w);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.19, w);
          gaze += 0.09 * w;
          break;
        case 'hygiene':
          // Brush an imaginary speck from a shoulder or sleeve.
          leftY = THREE.MathUtils.lerp(leftY, -0.06, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.27, w);
          gaze += 0.12 * w;
          break;
        case 'lowMood':
          // Quiet sigh and drooping head; no gameplay penalties.
          gaze += 0.17 * w;
          lean += 0.065 * w;
          expression = THREE.MathUtils.lerp(expression, 0.01, w);
          break;
      }
    }

    // Every habit is a short choreographed sequence, not a frozen hand angle.
    // All rotations are additive to the existing articulated rig and leave
    // the foot contacts, navigation root, and server entirely untouched.
    const idleWeight = this.idleGesture ? residentIdleWeight(this.idleGestureTime) : 0;
    const idleTouch = this.idleGesture ? residentIdleTouchWeight(this.idleGestureTime) : 0;
    let idleHeadYaw = 0, idleHeadRoll = 0, idleChestRoll = 0;
    let idleChestYaw = 0, idleEyeYaw = 0, idleEyePitch = 0;
    if (idleWeight > 0) {
      const w = idleWeight;
      const phase = this.idleGestureTime;
      switch (this.idleGesture) {
        case 'think': {
          // Vlad studies something for a beat. The right hand rests on the
          // chin through a real wrist target; left hand relaxes near the waist.
          const thought = residentIdleEase(phase, 0.7, 1.55);
          leftY = THREE.MathUtils.lerp(leftY, -0.41, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.16, w);
          rightY = THREE.MathUtils.lerp(rightY, 0.05, w);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.20, w);
          gaze += (0.07 + 0.065 * thought) * w;
          idleHeadYaw = 0.07 * w;
          idleHeadRoll = 0.035 * w;
          idleChestYaw = -0.028 * w;
          lean += 0.024 * w;
          idleEyePitch += 0.055 * w;
          expression = THREE.MathUtils.lerp(expression, 0.025, w);
          break;
        }
        case 'fixHair': {
          // Alina brushes the side strands back from her temple. Separate
          // reaching and sweeping phases are handled by wrist IK below.
          const sweep = residentIdleEase(phase, 1.08, 2.68);
          leftY = THREE.MathUtils.lerp(leftY, 0.09 + 0.12 * sweep, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.13, w);
          rightY = THREE.MathUtils.lerp(rightY, -0.50, w * .32);
          idleHeadRoll = -0.065 * w;
          idleHeadYaw = (-0.055 - 0.035 * sweep) * w;
          idleChestYaw = 0.029 * w;
          gaze -= 0.025 * w;
          expression += 0.065 * w;
          break;
        }
        case 'lookAround': {
          // Eyes lead, then head and shoulders follow. A genuine left-right
          // scan with two held glances rather than an endless sine loop.
          const scan = 0.39 * residentIdleEase(phase, 0.42, 1.35)
            - 0.71 * residentIdleEase(phase, 1.46, 2.57)
            + 0.32 * residentIdleEase(phase, 2.70, 3.44);
          const eyes = 0.43 * residentIdleEase(phase, 0.22, 1.09)
            - 0.76 * residentIdleEase(phase, 1.29, 2.32)
            + 0.33 * residentIdleEase(phase, 2.52, 3.26);
          idleHeadYaw = scan * w;
          idleEyeYaw = eyes * w * 0.32;
          idleChestYaw = scan * w * 0.22;
          idleHeadRoll = 0.035 * scan * w;
          gaze -= 0.018 * w;
          break;
        }
        case 'adjustSleeve': {
          // One forearm is lifted into view; the other reaches the actual
          // opposite sleeve for two small tugs. No large, waving motion.
          const tug = Math.sin(Math.PI * 2 * residentIdleEase(phase, 1.20, 2.68)) ** 2;
          leftY = THREE.MathUtils.lerp(leftY, -0.23, w);
          leftZ = THREE.MathUtils.lerp(leftZ, 0.37, w);
          rightY = THREE.MathUtils.lerp(rightY, -0.15 + 0.021 * tug, w);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.33 + 0.018 * tug, w);
          armSpread = THREE.MathUtils.lerp(armSpread, 0.06, w);
          idleHeadYaw = -0.17 * w;
          gaze += 0.13 * w;
          idleEyePitch += 0.055 * w;
          idleChestYaw = -0.042 * w;
          break;
        }
        case 'shiftWeight': {
          // Feet remain planted. A relaxed hip/shoulder counterbalance makes
          // a living silhouette without the old squatting gait.
          const shift = Math.sin(Math.PI * residentIdleEase(phase, 0.35, 3.35));
          const side = this.id === 'vlad' ? 1 : -1;
          idleChestRoll = side * 0.072 * shift * w;
          idleHeadRoll = -idleChestRoll * 0.64;
          idleChestYaw = side * 0.041 * shift * w;
          idleHeadYaw = -side * 0.045 * shift * w;
          rightY = THREE.MathUtils.lerp(rightY, -0.45, w * .57);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.14, w * .57);
          leftY = THREE.MathUtils.lerp(leftY, -0.50, w * .45);
          lean -= 0.013 * shift * w;
          break;
        }
        case 'stretchNeck': {
          // Slow neck release from one shoulder to the other. Open chest,
          // small shoulder movement, and a gentle exhale.
          const release = 0.17 * residentIdleEase(phase, 0.55, 1.34)
            - 0.34 * residentIdleEase(phase, 1.47, 2.48)
            + 0.17 * residentIdleEase(phase, 2.72, 3.45);
          idleHeadRoll = release * w;
          idleHeadYaw = release * w * 0.22;
          idleChestRoll = -release * w * 0.28;
          leftY = THREE.MathUtils.lerp(leftY, -0.42, w);
          rightY = THREE.MathUtils.lerp(rightY, -0.42, w);
          armSpread = THREE.MathUtils.lerp(armSpread, 0.068, w);
          gaze -= 0.075 * w;
          lean -= 0.045 * w;
          expression = THREE.MathUtils.lerp(expression, 0.12, w);
          break;
        }
        case 'studyPalm': {
          const examine=residentIdleEase(phase,.67,1.5)*(1-residentIdleEase(phase,2.5,3.42));
          rightY=THREE.MathUtils.lerp(rightY,-.10,w);
          rightZ=THREE.MathUtils.lerp(rightZ,.26,w);
          leftY=THREE.MathUtils.lerp(leftY,-.37,w*.6);
          idleHeadYaw=.10*w;
          gaze+=.18*w;
          idleEyePitch+=.08*examine;
          expression+=.025*w;
          break;
        }
        case 'rubShoulder': {
          const press=residentIdleEase(phase,.54,1.14)*(1-residentIdleEase(phase,2.85,3.45));
          rightY=THREE.MathUtils.lerp(rightY,-.01,w);
          rightZ=THREE.MathUtils.lerp(rightZ,.23,w);
          idleHeadRoll=.055*w;
          idleHeadYaw=-.07*w;
          idleChestRoll=-.025*press;
          gaze+=.05*press;
          break;
        }
        case 'easeWrists': {
          const movement=Math.sin(phase*4.1)*w;
          leftY=THREE.MathUtils.lerp(leftY,-.18,w);
          rightY=THREE.MathUtils.lerp(rightY,-.19+.024*movement,w);
          leftZ=THREE.MathUtils.lerp(leftZ,.32,w);
          rightZ=THREE.MathUtils.lerp(rightZ,.34,w);
          idleHeadYaw=-.12*w;
          gaze+=.12*w;
          expression+=.042*w;
          break;
        }
        case 'steadyBreath': {
          const inhale=Math.sin(Math.PI*residentIdleEase(phase,.45,3.2))*w;
          idleChestRoll=(this.id==='vlad'?.035:-.035)*inhale;
          idleHeadRoll=-idleChestRoll*.55;
          idleChestYaw=.016*inhale;
          lean-=.052*inhale;
          leftY=THREE.MathUtils.lerp(leftY,-.45,w*.45);
          rightY=THREE.MathUtils.lerp(rightY,-.45,w*.45);
          armSpread=THREE.MathUtils.lerp(armSpread,.065,w);
          expression=THREE.MathUtils.lerp(expression,.17,w);
          break;
        }
        case 'noticePet': {
          // A real pet nearby catches the gaze. Mild head/chest rotation and
          // a fond downward glance, never a fake petting/feed action.
          const yaw = THREE.MathUtils.clamp(this.idleContext.petYaw ?? 0, -0.68, 0.68);
          idleHeadYaw = yaw * 0.79 * w;
          idleChestYaw = yaw * 0.21 * w;
          idleEyeYaw = yaw * 0.21 * w;
          idleEyePitch += 0.085 * w;
          gaze += 0.18 * w;
          lean += 0.026 * w;
          idleHeadRoll = (yaw >= 0 ? 1 : -1) * 0.027 * w;
          expression += 0.14 * w;
          break;
        }
        case 'noticePartner': {
          // A restrained friendly acknowledgement: eyes, half-smile and
          // slight hand movement. This is not a server social interaction.
          const yaw = THREE.MathUtils.clamp(this.idleContext.partnerYaw ?? 0, -0.65, 0.65);
          idleHeadYaw = yaw * 0.76 * w;
          idleChestYaw = yaw * 0.23 * w;
          idleEyeYaw = yaw * 0.22 * w;
          idleHeadRoll = -0.032 * w;
          expression += 0.21 * w;
          const nod = Math.sin(Math.PI * residentIdleEase(phase, 1.15, 2.52));
          gaze += 0.038 * nod * w;
          rightY = THREE.MathUtils.lerp(rightY, -0.43, w * 0.42);
          rightZ = THREE.MathUtils.lerp(rightZ, 0.18 + .017 * nod, w * 0.52);
          if(this.greeting){
            // A single calm hello, readable even at a normal phone camera
            // distance. Arm rises beside the shoulder, then settles.
            // No extra social action, root displacement or forced embrace.
            const wave=residentIdleEase(phase,.32,.86)*
              (1-residentIdleEase(phase,2.12,2.96));
            // The raised hand is solved at the wrist below, not by a
            // shoulder-only twist (which could flip the arm behind the body).
            idleChestYaw+=yaw*.18*wave;
            idleHeadYaw+=yaw*.08*wave;
            expression+=.10*wave;
          }
          break;
        }
      }
    }

    if(this.conversationYaw!==null&&this.conversationSpeaking&&!asleep&&!this.activity&&!this.gesture&&!this.partnerGesture&&!this.carryingBook&&!this.idleGesture&&!this.needReaction&&motion<.08&&this.pose!=='work'){
      const wave=Math.max(0,Math.sin(t*2.8))*.09;
      leftY+=wave;leftZ+=wave*.6;
    }
    if(!this.activity&&!this.gesture&&!this.partnerGesture&&!resting&&!this.carryingBook&&!this.workCoffeeCarrying&&this.pose!=='work'){
      leftZ+=transfer.hands;rightZ+=transfer.hands;
    }
    const eatingWith = mealUtensil(this.diningDish);
    this.spoon.visible = (this.activity === 'cook' &&
      (kitchenStep === 'whisk' || kitchenStep === 'stir')) ||
      (this.activity === 'eat' && eatingWith === 'spoon');
    this.props.phone.visible=this.activity==='scrollPhone'||this.activity==='phone';
    this.props.fork.visible = this.activity === 'eat' && eatingWith === 'fork';
    this.props.knife.visible = (this.activity === 'cook' && kitchenStep === 'chop') ||
      (this.activity === 'prep' && helperChop(a));
    this.props.spatula.visible=this.activity==='cook'&&(kitchenStep==='flip'||kitchenStep==='plate');
    this.props.groomingBrush.visible = this.activity === 'brush';
    this.props.tongs.visible = this.activity === 'grill';
    if (this.props.tongs.visible) this.props.grip(a);
    this.toolError=null;this.mealBite.visible=false;
    this.crouchBlend = THREE.MathUtils.lerp(this.crouchBlend, crouch, alpha);
    const armZ = this.activity === 'cook' ? -0.11 + Math.sin(a * 5) * 0.15 : armSpread;
    // Keep keyboard IK in the base work pose (including remote career rigs),
    // but do not type while explicitly reading or writing a paper journal.
    const typing = this.pose === 'work' && (this.activity === 'games' || this.activity === null) && this.keys;
    const stirring = this.activity === 'cook' && this.pan;
    // Face-level actions (teeth, phone, reach) must not be mistaken for
    // two-handed counter work just because World supplied a focus point.
    const counter = this.pan && this.activity && COUNTER_ACTIONS.has(this.activity as DomesticMotion)
      ? this.pan : undefined;
    const drinking=this.activity==='eat'&&isHomeDrink(this.diningDish);
    const cupHeld=drinking||this.workCoffeeCarrying||pair?.motion==='teaTogether';
    if (!rest && !typing && !stirring && !counter) {
      this.bend(armA, data.elbows[0], data.upperArm, data.lowerArm, leftY, leftZ, -1, alpha);
      armA.rotation.y = THREE.MathUtils.lerp(armA.rotation.y, 0, alpha);
      armA.rotation.z = THREE.MathUtils.lerp(armA.rotation.z, armSpread, alpha);
      if(!cupHeld){
        this.bend(armB, data.elbows[1], data.upperArm, data.lowerArm, rightY, rightZ, -1, alpha);
        armB.rotation.y = THREE.MathUtils.lerp(armB.rotation.y, 0, alpha);
        armB.rotation.z = THREE.MathUtils.lerp(armB.rotation.z, -armZ, alpha);
      }
    }
    if(rest){
      // Direct authored local joint angles supersede the standing two-bone
      // targets: elbows fold toward the body, not through the mattress.
      for(const i of [0,1] as const){
        const arm=i===0?armA:armB,p=rest.arms[i];
        arm.rotation.x=THREE.MathUtils.lerp(arm.rotation.x,p.x,alpha);
        arm.rotation.y=THREE.MathUtils.lerp(arm.rotation.y,p.y,alpha);
        arm.rotation.z=THREE.MathUtils.lerp(arm.rotation.z,p.z,alpha);
        data.elbows[i].rotation.x=THREE.MathUtils.lerp(data.elbows[i].rotation.x,p.bend,alpha);
      }
    }
    if (!typing && !stirring && !counter) for (const wrist of data.wrists) {
      if(cupHeld&&wrist===data.wrists[1])continue;
      wrist.rotation.x = THREE.MathUtils.lerp(wrist.rotation.x, rest?rest.arms[data.wrists.indexOf(wrist)].end:this.activity === 'eat' ? 0.12 : 0, alpha);
      wrist.rotation.y = THREE.MathUtils.lerp(wrist.rotation.y, 0, alpha);
      wrist.rotation.z = THREE.MathUtils.lerp(wrist.rotation.z, 0, alpha);
    }

    this.figureBase.lerp(this.poseOffset, 1 - Math.exp(-dt * 8));
    for (let i = 0; i < 2; i++) {
      const upper = i === 0 ? this.leftLeg : this.rightLeg;
      const knee = data.knees[i];
      const legLength=data.thighLength+data.shinLength;
      const foot=walkFootTarget(this.gait,i as 0 | 1,legLength,strideLength,motion,stanceDrop,this.crouchBlend);
      const legBlend=1-Math.exp(-dt*(12+15*motion));
      // Compensate the vertical rise even after the seat blend has ended,
      // so feet do not sink as the first walking step begins.
      if(this.seatBlend>.001||(!resting&&this.figureBase.y<-.001)){
        foot.y-=this.figureBase.y;
      }
      if(this.seatBlend>.001){
        const seatForward=data.thighLength*.84-i*.027;
        foot.z+=this.seatBlend*seatForward-weightTransfer*.036;
        // A very tall seat cannot support ground contact with a bent knee.
        // Let the shins hang naturally instead of extending both legs rigidly.
        const highSeat=THREE.MathUtils.smoothstep(this.figureBase.y,-.13,.025)*this.seatBlend;
        foot.y=THREE.MathUtils.lerp(foot.y,Math.max(foot.y,-data.shinLength-.09),highSeat);
        foot.toePitch*=1-this.seatBlend;
      }
      if(this.activity==='spaSwim'){foot.z+=Math.sin(a*4.8+i*Math.PI)*.11;foot.y+=.04*Math.sin(a*4.8+i*Math.PI);}
      else if(this.activity==='gymRun'||this.activity==='gymStep'||this.activity==='gymCycle'){
        const phase=a*(this.activity==='gymRun'?8:5)+i*Math.PI;
        const cycling=this.activity==='gymCycle';
        foot.y+=Math.max(0,Math.sin(phase))*(cycling?.13:.17);
        foot.z+=Math.cos(phase)*(cycling?.13:this.activity==='gymRun'?.24:.10);
      }else if(this.activity==='gymLeg'){
        const extension=(1+Math.sin(a*2.7))/2;
        foot.y+=.18*extension;foot.z+=.24*extension;
      }else if(this.activity==='gymRow'){
        foot.z+=.09*(1+Math.cos(a*3));
      }
      if(rest){
        const p=rest.legs[i];
        upper.rotation.x=THREE.MathUtils.lerp(upper.rotation.x,p.x,legBlend);
        upper.rotation.y=THREE.MathUtils.lerp(upper.rotation.y,p.y,legBlend);
        upper.rotation.z=THREE.MathUtils.lerp(upper.rotation.z,p.z,legBlend);
        knee.rotation.x=THREE.MathUtils.lerp(knee.rotation.x,p.bend,legBlend);
      }else{
        this.bend(upper,knee,data.thighLength,data.shinLength,foot.y,foot.z,1,legBlend);
        upper.rotation.y=THREE.MathUtils.lerp(upper.rotation.y,0,legBlend);
        upper.rotation.z=THREE.MathUtils.lerp(upper.rotation.z,0,legBlend);
      }
      const ankle = data.ankles[i];
      ankle.rotation.x = THREE.MathUtils.lerp(ankle.rotation.x,
        rest?rest.legs[i].end:foot.toePitch - upper.rotation.x - knee.rotation.x,legBlend);
    }

    // Speech overlay only on the face/head: preserve utensils, hands, legs, route and furniture pose.
    const chatActive=(!resting||this.activity==='spaRecline')&&this.activity!=='spaSwim'&&this.conversationYaw!==null&&!this.partnerGesture;
    this.conversationBeat=chatActive?this.conversationBeat+dt:0;
    const chat=conversationExpression(this.conversationBeat,this.conversationSpeaking,!!this.activity||this.pose==='work',this.id==='alina');
    const chatYaw=chatActive?THREE.MathUtils.clamp(this.conversationYaw!,-.55,.55)*(this.activity||this.pose==='work'?.48:.85)*chat.focus:0;
    const chatNod=chatActive?chat.nod:0;
    if(chatActive)expression=Math.max(expression,chat.smile);
    const idleLook = seated || resting || this.activity || this.gesture || this.idleGesture || pair ? 0 : Math.sin(t * 0.53) ** 7;
    if (data.animateFace) {
      const chatEye=conversationEyeLead(chatYaw,!!this.activity||this.pose==='work');
      const eyeYaw = resting ? 0 : this.pose === 'work' ? 0.046 * Math.sin(t * 1.53)+chatEye :
        (0.10 * idleLook + lead * 0.44) * (1 - 0.4 * motion) + idleEyeYaw+chatEye;
      const eyePitch = resting ? 0 : this.activity === 'cook' ? 0.07 :
        this.pose === 'work' ? 0.030 + 0.046 * Math.sin(t * 1.18) :
        0.025 * Math.sin(t * 0.67) + idleEyePitch;
      data.animateFace(dt, asleep || intimateContact>.72 || ((this.needReaction === 'yawn'||this.needReaction==='tired') && needWeight > 0.60),
        expression, eyeYaw, eyePitch, demeanor.lids*moodWeight);
    } else {
      const blinkTime = t % (this.id === 'vlad' ? 6.3 : 7.15);
      const blink = asleep || intimateContact>.72 ? 0.13 : blinkTime < 0.17 ? 1 - 0.89 * Math.sin(blinkTime / 0.17 * Math.PI) : 1;
      for (const eye of data.eyes) eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, blink*(1-demeanor.lids*moodWeight), alpha);
    }
    const look = rest?rest.headYaw+(reclining?partnerYaw:0)+chatYaw:0.20 * idleLook + lead + idleHeadYaw + chatYaw + partnerYaw;
    data.head.rotation.y = THREE.MathUtils.lerp(data.head.rotation.y, look - motion * 0.061 * Math.sin(stridePhase), alpha);
    data.head.rotation.x = THREE.MathUtils.lerp(data.head.rotation.x, (rest?rest.headPitch:gaze + 0.022 * breath - lean * 0.55 + chatNod + transfer.gaze), alpha);
    data.head.rotation.z = THREE.MathUtils.lerp(data.head.rotation.z,
      rest?rest.headRoll:0.018 * Math.sin(t * 0.73) - restlessSway * 0.4 + idleHeadRoll + partnerHead + (chatActive?chat.tilt:0) + demeanor.tilt*moodWeight, alpha);
    data.hair.rotation.y = -data.head.rotation.y * 0.16 + motion * Math.cos(stridePhase - 0.6) * 0.031 +
      (this.idleGesture === 'fixHair' ? 0.025 * idleTouch * Math.sin(this.idleGestureTime * 1.4) : 0);
    data.hair.rotation.x = -data.head.rotation.x * 0.05 + motion * Math.sin(stridePhase) * 0.031;

    const taskRhythm=Math.sin(taskCadence(a,this.id,2.3))*.012*activityEase;
    data.chest.rotation.x = THREE.MathUtils.lerp(data.chest.rotation.x,
      rest?rest.chestPitch+.011*breath:lean + motion * .025 + transfer.lean + taskRhythm,alpha);
    data.chest.rotation.y = THREE.MathUtils.lerp(data.chest.rotation.y,
      motion * 0.055 * Math.cos(stridePhase) + idleChestYaw + partnerChestYaw, alpha);
    data.chest.rotation.z = THREE.MathUtils.lerp(data.chest.rotation.z,
      .016*Math.sin(t*.71)+motion*.027*Math.sin(stridePhase)+restlessSway+idleChestRoll+partnerRoll+taskRhythm*.65,alpha);
    data.chest.position.z = -Math.sin(data.chest.rotation.x) * data.waistY;
    data.chest.position.y = (1 - Math.cos(data.chest.rotation.x)) * data.waistY + 0.006 * breath;

    this.figure.position.copy(this.figureBase);
    // Close the visual gap during a hug while the path endpoints stay fixed.
    this.figure.position.z += embrace;
    this.figure.position.y -= this.activity==='spaMassage'||this.activity==='spaRecline'?0:stanceDrop + this.crouchBlend;
    this.figure.position.x += motion * 0.011 * Math.sin(stridePhase) + restlessSway * 0.15 + partnerSide;
    this.figure.position.z += partnerForward;
    if(this.activity==='spaSwim'){this.figure.position.y+=.045*Math.sin(a*2.7);if(!this.authoredWaterAnchor)this.figure.position.z+=.36*Math.sin(a*.42);}
    this.figure.rotation.x = THREE.MathUtils.lerp(this.figure.rotation.x, this.activity==='spaMassage'?Math.PI/2:resting||this.activity==='spaSwim' ? -Math.PI / 2 : 0, alpha);
    this.figure.rotation.y = THREE.MathUtils.lerp(this.figure.rotation.y,rest?.roll??0,alpha);
    if(rest)this.figure.position.y+=rest.lift+.004*breath;
    if(this.activity==='consolePlay'&&this.activePad){
      const pad=this.activePad,shoulderY=(this.leftArm.position.y+this.rightArm.position.y)/2;
      const fight=this.activeConsoleGame==='ufc6',phase=a+(this.id==='alina'?1.1:0);
      const burst=fight?Math.max(0,Math.sin(phase*3.5))**4:0;
      const center=data.chest.localToWorld(this.target.set(0,shoulderY-.35+.013*Math.sin(a*3.1)+burst*.028,.31+.018*Math.sin(a*2.0)+burst*.018));
      pad.position.copy(this.figure.worldToLocal(center));pad.rotation.set(-.10+.07*Math.sin(a*2.8)-burst*.08,.035*Math.sin(a*1.9)+burst*.055,.055*Math.sin(a*3.2));pad.updateWorldMatrix(true,false);
      const l=pad.getObjectByName('stick-left'),r=pad.getObjectByName('stick-right');
      if(l)l.position.set(-.038+.0035*Math.sin(phase*4.1),.034,-.005+.0035*Math.cos(phase*3.7));
      if(r)r.position.set(.038+.003*Math.sin(phase*5.7),.034,-.005+.003*Math.cos(phase*5.1));
      for(const i of [0,1] as const){
        const side=i===0?-1:1;
        this.reach(i,pad.localToWorld(this.target.set(side*CONTROLLER_GRIP,-.01,-.069)),1,.63);
        pad.getWorldQuaternion(this.parentRotation);
        this.aimHand(i,this.handDirection.set(-side*.30,-.12,1).applyQuaternion(this.parentRotation),1);
      }
    } else if(this.activity==='fishing'&&this.fishing){
      const p=this.fishing,cast=Math.sin(Math.PI*Math.min(1,a/2.1)),y=.99+cast*.23+.045*Math.sin(a*1.1);
      const grip=this.root.localToWorld(new THREE.Vector3(.13,y,.39+cast*.06));
      this.reach(1,grip,1,.65);this.aimHand(1,this.handDirection.set(0,-.2,1).applyAxisAngle(up,this.root.rotation.y),1);
      this.reach(0,this.root.localToWorld(new THREE.Vector3(-.075,y-.06,.45)),1,.65);
      this.rig.wrists[1].getWorldPosition(grip);p.frame(a,this.root,grip);
    } else if(this.catchProp&&!this.activity&&!this.isWalking()){this.reach(1,this.root.localToWorld(new THREE.Vector3(.26,1.02,.37)),1,.65);this.aimHand(1,this.handDirection.set(0,-.2,1).applyAxisAngle(up,this.root.rotation.y),1);
    } else if(this.venueFrame&&this.activity&&['venueCue','venueHockey','venueCards','venueJenga','venueBowl'].includes(this.activity)){
      const f=this.venueFrame,frame=venueHandFrame(f.game,this.id,f.t,f.match);
      const target=new THREE.Vector3(f.center.x+frame.x,frame.y,f.center.z+frame.z);
      if(frame.reach){this.reach(1,target,alpha);this.aimHand(1,this.handDirection.set(0,-.22,1).applyAxisAngle(up,this.root.rotation.y),alpha);}
      if(this.venueProp&&(this.activity==='venueCards'||this.activity==='venueBowl'))this.venueProp.visible=frame.reach;
      if(this.activity==='venueCue'&&this.venueProp){this.venueProp.visible=frame.reach;const toward=new THREE.Vector3(f.center.x,.94,f.center.z).sub(target).normalize();this.rig.wrists[1].getWorldQuaternion(this.parentRotation).invert();this.venueProp.quaternion.setFromUnitVectors(forwardAxis,toward.applyQuaternion(this.parentRotation));}
    } else if (typing) {
      const spec=this.homeWorkStyle?HOME_JOBS[this.homeWorkStyle as keyof typeof HOME_JOBS]:undefined;
      const variant=spec?.animation??0;
      const period=spec?14+variant*1.2:11.6;
      const cycle=(t + (this.id==='vlad'?0:2.8))%period;
      const phase=cycle/period;
      const pause=THREE.MathUtils.smoothstep(phase,.38,.48) * (1-THREE.MathUtils.smoothstep(phase,.60,.73));
      const beats = (0.52 + 0.48 * Math.max(0, Math.sin(t * (spec?.style==="code"?1.3:.85))))*(1-pause);
      for (const i of [0, 1] as const) {
        const tap = beats * Math.max(0, Math.sin(t * ((i === 0 ? 8.5 : 10.2)+variant*.22) + i * 1.3)) ** 2;
        this.target.copy(typing[i]);
        const pointerStyle=!!spec&&["video","design","trade","notes"].includes(spec.style);
        const mouseBlend=i===1&&typing[2]?(pointerStyle?
          THREE.MathUtils.smoothstep(phase,.12,.19)*(1-THREE.MathUtils.smoothstep(phase,.80,.91)):
          pause):0;
        if(mouseBlend&&typing[2])this.target.lerp(typing[2],mouseBlend);
        const teaching=spec?.style==="hair"&&pause>.05;
        const listening=spec?.style==="mail"&&i===1&&!mouseBlend;
        const keyTap=tap*(1-mouseBlend);
        this.target.y += .028-.018*keyTap + (teaching?pause*(.14+.07*Math.sin(t*2.4+i)):0)+(listening?pause*.20:0);
        this.target.add(this.handDirection.set(mouseBlend*.008*Math.sin(t*1.5)+(teaching?pause*(i===0?-.10:.10):0), 0,
          (1-mouseBlend)*(.014*Math.sin(t*1.82+i)-.008*keyTap)-mouseBlend*.035-(listening?pause*.12:0))
          .applyAxisAngle(up, this.root.rotation.y));
        this.reach(i, this.target, alpha);
        // Fingers point toward the input surface, not back toward the body.
        this.aimHand(i, this.handDirection.set(0,-.27,1).applyAxisAngle(up,this.root.rotation.y),alpha);
      }
    } else if (stirring) {
      // Alternate preparation, pan work and plating by recipe rather than
      // endlessly stirring. Motions use the same two-bone IK and light props.
      const phase = taskCadence(a,this.id,kitchenStep==='chop'?7.4:kitchenStep==='whisk'?7:3.6);
      if (kitchenStep==='chop') {
        this.reach(0,this.stationTarget(stirring,.20,.115,-.09),alpha);
        this.reach(1,this.stationTarget(stirring,
          .23,.15+.045*(1+Math.sin(phase)),-.08+.020*Math.cos(phase)),alpha);
      } else if(kitchenStep==='knead') {
        this.reach(0,this.stationTarget(stirring,-.085+.055*Math.sin(phase),.13,-.11+.038*Math.cos(phase)),alpha);
        this.reach(1,this.stationTarget(stirring,.085-.055*Math.sin(phase),.13,-.11-.038*Math.cos(phase)),alpha);
      } else if(kitchenStep==='flip') {
        const lift=Math.max(0,Math.sin(phase*1.8));
        this.reach(0,this.stationTarget(stirring,-.18,.12,-.11),alpha);
        this.reach(1,this.stationTarget(stirring,.035+.048*Math.sin(phase),.16+.11*lift,-.13+.055*Math.cos(phase)),alpha);
      } else if(kitchenStep==='plate') {
        const serve=Math.sin(Math.min(1,Math.max(0,(a-9.6)/2.4))*Math.PI);
        this.reach(0,this.stationTarget(stirring,-.17,.13,-.12),alpha);
        this.reach(1,this.stationTarget(stirring,.17+.14*serve,.14+.07*serve,-.1),alpha);
      } else {
        this.reach(0,this.stationTarget(stirring,-.19,.105,-.13),alpha);
        this.reach(1,this.stationTarget(stirring,
          .055*Math.cos(phase),.135+.013*Math.sin(phase*2),-.12+.045*Math.sin(phase)),alpha);
      }
      for(const i of [0,1] as const)
        this.aimHand(i,this.handDirection.set(0,-.48,-1)
          .applyAxisAngle(up,this.root.rotation.y),alpha);
    } else if (bite > 0 && !this.pan) {
      data.head.localToWorld(this.target.set(0.022, -0.133, 0.151));
      this.handDirection.set(0.066, -0.114, 0.175).applyAxisAngle(up, this.root.rotation.y);
      this.target.add(this.handDirection);
      this.reach(1, this.target, bite);
      this.aimHand(1, this.handDirection.set(0, -0.21, 1).applyAxisAngle(up, this.root.rotation.y), bite);
    } else if (this.activity==='eat' && this.pan) {
      // Between mouthfuls, the right hand actually collects the next bite
      // from the resident's own plate; the left hand rests near its rim.
      this.reach(0,this.stationTarget(this.pan,-.11,.09,-.035),alpha);
      this.reach(1,this.stationTarget(this.pan,
        .015+.035*Math.sin(a*2.5),.10+.012*Math.sin(a*5.2),-.03),alpha);
      this.aimHand(1,this.handDirection.set(0,-.5,-1)
        .applyAxisAngle(up,this.root.rotation.y),alpha);
    } else if (this.petContact && (this.activity === 'brush' || this.activity === 'pet' || this.activity === 'feed' || this.activity === 'play'||this.activity==='treat'||this.activity==='bathe')) {
      // Follow the actual animal's saved position; strokes travel across the
      // coat rather than moving a hand in place beside the standing resident.
      const bathing=this.activity==='bathe';
      const brushing = this.activity === 'brush'||bathing;
      const stroke = Math.sin(taskCadence(a,this.id,brushing?6.2:3.7));
      const lateral = brushing ? .065 : .023;
      const coat=this.activity==='pet'||this.activity==='brush';
      if(typeof this.petContact==='function')this.petContact(this.target,coat?stroke:0);
      else{
        this.target.copy(this.petContact);
        // Static contact anchors (legacy caller / fallback) still need a
        // repeated stroke. Live coat callbacks already include pet-local motion.
        if(coat){
          this.target.x+=.10*stroke*Math.sin(this.root.rotation.y);
          this.target.z+=.10*stroke*Math.cos(this.root.rotation.y);
        }
      }
      if(coat){
        // Use the animated coat in the animal's local coordinate system.
        // Palm clearance is explicit; a grooming brush contacts with bristles.
        this.toolSurface.copy(this.target);
        if(this.activity==='brush'){
          this.toolContact(this.props.groomingBrush,this.toolSurface,.153,.048,0,-.12,true);
        }else{
          this.handDirection.set(0,-.55,1).normalize().applyAxisAngle(up,this.root.rotation.y);
          this.target.addScaledVector(this.handDirection,-.055);
          this.reach(1,this.target,Math.min(1,alpha*3),.65);
          this.aimHand(1,this.handDirection,Math.min(1,alpha*3));
        }
      }else{
      this.target.x += lateral * stroke * Math.cos(this.root.rotation.y);
      this.target.z -= lateral * stroke * Math.sin(this.root.rotation.y);
      if(brushing||this.activity==='pet'){
        this.target.x += stroke*.08*Math.sin(this.root.rotation.y);
        this.target.z += stroke*.08*Math.cos(this.root.rotation.y);
      }
      this.target.y += .043 + .019 * Math.sin(a * (brushing ? 4.3 : 2.9))
        + (this.activity==='play'?.11*(.5+.5*Math.sin(a*4)):0);
      if(bathing){this.target.y+=.04;this.target.x+=.05*Math.sin(a*4);this.reach(0,this.target.clone().add(new THREE.Vector3(0,.01,-.18)),Math.min(1,alpha*3));}
      this.reach(1,this.target,Math.min(1,alpha * 2.8));
      this.aimHand(1,this.handDirection.set(0,-1,-.25).applyAxisAngle(up,this.root.rotation.y),alpha);
      }
    } else if (this.gestureTarget && highFive > 0) {
      const hand = this.id === 'vlad' ? 1 : 0;
      this.target.copy(this.gestureTarget).addScaledVector(up, -0.069);
      this.reach(hand, this.target, highFive);
      this.aimHand(hand, this.handDirection.copy(up), highFive);
    } else if(pair?.partner&&partnerReach>0.002&&(pair.motion==='hug'||pair.motion==='closeHug')) {
      // Opposite shoulders face each other. Place each wrist at the side
      // of the partner's upper arm and keep the elbow outside both torsos.
      const partner=pair.partner;
      const blend=Math.min(1,alpha*4*partnerReach);
      for(const hand of [0,1] as const){
        const shoulder=hand===0?partner.rightArm:partner.leftArm;
        this.target.copy(shoulder.position);
        this.target.x+=(hand===0?.085:-.085);
        this.target.y-=hand===0?.14:.23;
        this.target.z-=.052;
        partner.rig.chest.localToWorld(this.target);
        // Place the palm on the partner's upper-arm surface, keeping
        // the wrist back from it and the elbow outside the torso.
        this.handDirection.set(hand===0?.8:-.8,-.33,.40)
          .applyAxisAngle(up,this.root.rotation.y).normalize();
        this.target.addScaledVector(this.handDirection,-.055);
        this.reach(hand,this.target,blend,1.1);
        this.aimHand(hand,this.handDirection,blend);
      }
    } else if(pair?.partner&&partnerReach>0.002&&pair.motion==='sofaMassage'&&pair.leads){
      const other=pair.partner,own=this.bodyPosition(new THREE.Vector3()),local=this.root.worldToLocal(other.bodyPosition(new THREE.Vector3()));
      const hand=local.x-this.figure.position.x>0?1:0;
      const shoulder=other.root.worldToLocal(own.clone()).x-other.figure.position.x>0?other.rightArm:other.leftArm;
      this.target.copy(shoulder.position);this.target.y+=.015+.025*Math.sin(pair.time*5);this.target.z+=.025;other.rig.chest.localToWorld(this.target);
      const blend=Math.min(1,alpha*3*partnerReach);
      // Reach the shoulder with the palm and vary pressure, rather than
      // burying the wrist and hand in the recipient's upper arm.
      this.handDirection.set(0,-1,.2).applyAxisAngle(up,this.root.rotation.y).normalize();
      this.target.addScaledVector(this.handDirection,-.055);
      this.reach(hand,this.target,blend,.70);
      this.aimHand(hand,this.handDirection,blend);
    } else if(pair?.partner&&partnerReach>0.002&&(pair.motion==='sofaHands'||pair.motion==='sofaHug')){
      const other=pair.partner;
      const own=this.bodyPosition(new THREE.Vector3()),theirs=other.bodyPosition(new THREE.Vector3());
      const local=this.root.worldToLocal(theirs.clone());
      const hand=local.x-this.figure.position.x>0?1:0;
      const blend=Math.min(1,alpha*3*partnerReach);
      if(pair.motion==='sofaHands'){
        this.target.copy(own).lerp(theirs,.5).add(new THREE.Vector3(0,.80,.24).applyAxisAngle(up,this.root.rotation.y));
      }else{
        const far=other.root.worldToLocal(own.clone()).x-other.figure.position.x>0?other.leftArm:other.rightArm;
        this.target.copy(far.position);
        this.target.y-=.07;
        this.target.z-=.015;
        other.rig.chest.localToWorld(this.target);
      }
      if(pair.motion==='sofaHands')this.reachPartnerPalm(hand,this.target,blend);
      else {
        this.reach(hand,this.target,blend);
        this.aimHand(hand,this.handDirection.set(0,-.8,.2).applyAxisAngle(up,this.root.rotation.y),blend);
      }
    } else if(pair?.target&&partnerReach>0.002) {
      const hand=pair.motion==='gift'||pair.motion==='hands'||pair.motion==='slowDance'?(this.id==='vlad'?1:0):1;
      const blend=Math.min(1,alpha*4*partnerReach);
      this.target.copy(pair.target);
      if(pair.motion==='hands'||pair.motion==='slowDance'){
        this.reachPartnerPalm(hand,this.target,blend);
      }else{
        this.reach(hand,this.target,blend);
        this.aimHand(hand,this.handDirection.set(0,-.55,-.3)
          .applyAxisAngle(up,this.root.rotation.y),alpha*partnerReach);
      }
    }
    if(this.vanityKind&&usesCareContact(this.vanityKind)&&(this.activity==='vanity'||this.activity==='bath'))this.animateCareContact(a,alpha);
    // The old idle gestures only raised an elbow toward the face. Use
    // the existing two-bone IK solver to put the wrist at a meaningful
    // contact point, following the animated head/chest and their real scale.
    // The same code works with lightweight fallback and Blender skin rigs.
    if (needWeight > .002 && (this.needReaction==='hunger'||this.needReaction==='tired')) {
      const phase=this.needReactionTime;
      const touch=residentIdleEase(phase,.25,.93)*(1-residentIdleEase(phase,2.65,3.55));
      const hand:0|1=this.id==='vlad'?1:0;
      const side=hand===1?1:-1;
      if(touch>.002){
        if(this.needReaction==='hunger'){
          // Wrist beside the abdomen; fingers cross the front of the shirt.
          data.chest.localToWorld(this.target.set(side*(.145+.018*Math.sin(phase*3.7)),
            data.waistY+.18+.015*Math.sin(phase*3.7),.192));
          this.reach(hand,this.target,Math.min(1,touch*alpha*8),.64);
          this.aimHand(hand,this.handDirection.set(-side*.91,-.12,-.38)
            .applyAxisAngle(up,this.root.rotation.y),Math.min(1,touch*alpha*6));
        }else{
          // Hand beside the temple follows the moving head rather than floating.
          data.head.localToWorld(this.target.set(side*.195,.015,.145));
          this.reach(hand,this.target,Math.min(1,touch*alpha*8),.76);
          this.aimHand(hand,this.handDirection.set(-side*.22,.95,-.22)
            .applyAxisAngle(up,this.root.rotation.y),Math.min(1,touch*alpha*6));
        }
      }
    }
    if (idleTouch > 0.002 && this.idleGesture) {
      const reachBlend = Math.min(1, idleTouch * alpha * 7.4);
      const handBlend = Math.min(1, idleTouch * alpha * 4.3);
      let contactHand: 0 | 1 | null = null;
      if (this.idleGesture === 'think') {
        // Right fingertips near chin, safely in front of the face.
        data.head.localToWorld(this.target.set(0.108, -0.151, 0.180));
        contactHand = 1;
      } else if (this.idleGesture === 'fixHair') {
        // Left fingertips travel from cheek-side hair to the temple/crown.
        const sweep = residentIdleEase(this.idleGestureTime, 1.1, 2.73);
        data.head.localToWorld(this.target.set(-0.184 + 0.028 * sweep,
          0.019 + 0.124 * sweep, 0.144 - 0.031 * sweep));
        contactHand = 0;
      } else if (this.idleGesture === 'studyPalm') {
        data.chest.localToWorld(this.target.set(0.17,1.22,0.37));
        contactHand=1;
      } else if (this.idleGesture === 'rubShoulder') {
        data.chest.localToWorld(this.target.set(-0.19,1.40,0.21));
        contactHand=1;
      } else if (this.idleGesture === 'easeWrists') {
        data.chest.localToWorld(this.target.set(-0.07,1.20,0.37));
        this.reach(0,this.target,reachBlend);
        data.chest.localToWorld(this.target.set(-0.045,1.205,0.39));
        contactHand=1;
      } else if (this.idleGesture === 'adjustSleeve') {
        // Present the left cuff in front of the chest, then briefly tug it
        // with the other hand. Both targets are within reachable distance
        // of the shoulders on both Blender and fallback models.
        const tug = Math.sin(this.idleGestureTime * 8.3) ** 2;
        data.chest.localToWorld(this.target.set(-0.13, 1.21, 0.29));
        this.reach(0, this.target, reachBlend);
        this.aimHand(0, this.handDirection.set(0, 0.20, -1)
          .applyAxisAngle(up, this.root.rotation.y), handBlend);
        data.chest.localToWorld(this.target.set(-0.085, 1.225 + .017 * tug, 0.337));
        this.reach(1, this.target, reachBlend);
        this.aimHand(1, this.handDirection.set(-0.15, 0.0, -1)
          .applyAxisAngle(up, this.root.rotation.y), handBlend);
      }
      if (contactHand !== null) {
        this.reach(contactHand, this.target, reachBlend);
        this.aimHand(contactHand,
          this.handDirection.set(contactHand === 0 ? -0.18 : 0.11,
            -0.18, -1).applyAxisAngle(up, this.root.rotation.y),
          handBlend);
      }
    }
    // A readable little hello needs the *hand* beside the face, with an
    // elbow that bends correctly. Shoulder angles alone once sent the whole
    // arm behind Vlad on actual 390x844 WebGL frames. Reuse the existing
    // two-bone IK and hand orientation; no extra bone, mesh or server action.
    if (this.idleGesture === 'noticePartner' && this.greeting) {
      const phase = this.idleGestureTime;
      const wave = residentIdleEase(phase, .32, .91) *
        (1 - residentIdleEase(phase, 2.13, 3.07));
      if (wave > .004) {
        const flutter = Math.sin(phase * 8.6);
        data.head.localToWorld(this.target.set(
          .28 + .024 * flutter, -.016 + .024 * Math.sin(phase * 8.6), .205));
        this.reach(1, this.target, Math.min(1, wave * alpha * 8.0));
        this.aimHand(1, this.handDirection.set(.13, .90, .22)
          .applyAxisAngle(up, this.root.rotation.y), Math.min(1, wave * alpha * 6.1));
      }
    }
    if (this.activity === 'reach' && this.pan && !this.workCoffeeCarrying) {
      // Taking an item from a shelf uses one hand; the other stays at rest.
      // Previously any supplied target forced BOTH hands into the furniture.
      this.reach(1, this.target.copy(this.pan), alpha);
      this.aimHand(1, this.handDirection.set(0, -.25, -1)
        .applyAxisAngle(up, this.root.rotation.y), alpha);
    }
    if (counter) {
      for (const i of [0, 1] as const) {
        const side = i === 0 ? -1 : 1;
        let x = side * .12, y = .13, z = -.13;
        switch (this.activity) {
          case 'dishes':
            x = side * .095 + .025 * Math.sin(a * 4.3 + i * Math.PI);
            y = .115 + .016 * Math.sin(a * 3.9 + i * Math.PI);
            z = -.12 + .021 * Math.cos(a * 3.4);
            break;
          case 'wash':
          case 'washHands':
            x = side * .05 + .020 * Math.sin(a * 6 + i * Math.PI);
            y = .14 + .012 * Math.cos(a * 6 + i * Math.PI);
            z = -.12 + .018 * Math.sin(a * 4);
            break;
          case 'grill': {
            const turn = barbecueStep==='turn';
            const toss = barbecueStep==='toss';
            const assembling = barbecueStep==='assemble';
            const plating = barbecueStep==='plate';
            const swing = a*(turn?2.7:toss?3.8:2.3);
            x = i ? (assembling?.04:plating?.26:.08)+
              (turn?.07:toss?.13:.09)*Math.sin(swing) : -.18;
            y = i ? .14+(plating?.09:assembling?.04:.075)*Math.max(0,Math.sin(swing*1.5)) : .11;
            z = i ? -.09+(turn?.08:.025)*Math.cos(swing) : -.18;
            break;
          }
          case 'prep': {
            const chop=helperChop(a);
            x=i?.13+.028*Math.sin(a*4):-.11;
            y=i?(chop?.135+.05*(1+Math.sin(a*7)):.13):.115;
            z=i?-.09+.016*Math.cos(a*4):-.10;
            break;
          }
          case 'coffee':
            x = i ? .04 + .034 * Math.sin(a * 3.1) : -.18;
            y = i ? .11 + .035 * Math.max(0, Math.sin(a * 3.1)) : .16;
            z = i ? -.10 : -.21;
            break;
          case 'tea':
            x = i ? .055 + .040 * Math.sin(a * 2.6) : -.17;
            y = i ? .12 + .022 * Math.sin(a * 2.6) : .15;
            z = i ? -.11 : -.20;
            break;
          default: // tidying a worktop: two staggered, short wiping strokes
            x = side * .13 + .060 * Math.sin(a * 3.5 + i * Math.PI);
            y = .095 + .010 * Math.sin(a * 3.5 + i);
            z = -.12 + .044 * Math.cos(a * 3.5 + i * Math.PI);
        }
        this.reach(i, this.stationTarget(counter, x, y, z), alpha);
        this.aimHand(i, this.handDirection.set(0, -.72, -.4)
          .applyAxisAngle(up, this.root.rotation.y), alpha);
      }
    }

    const hookah=pair?.motion==='yardHookah'&&!!pair.target;
    this.loungeMouthpiece.visible=this.loungeHose.visible=hookah;
    if(hookah&&pair?.target){
      const {raise,exhale}=hookahPhase(pair.time,pair.leads);
      // Mouth anchor follows the actual head including nods and yaw.
      this.rig.head.localToWorld(this.loungeMouth.set(0,-.132,.155));
      this.rig.head.localToWorld(this.loungeForward.set(0,-.132,1.155));
      this.loungeForward.sub(this.loungeMouth).normalize();
      const rest=this.bodyPosition(this.hoseStart).add(this.handDirection.set(.22,.80,.25).applyAxisAngle(up,this.root.rotation.y));
      const wristGoal=this.loungeGrip.copy(this.loungeMouth).addScaledVector(this.loungeForward,.145);wristGoal.y-=.036;
      this.reach(1,rest.lerp(wristGoal,raise),alpha,.35);
      this.aimHand(1,this.handDirection.set(.08,-.78+.48*raise,.65-.5*raise).applyAxisAngle(up,this.root.rotation.y),alpha);
      this.root.updateMatrixWorld(true);
      this.loungeMouthpiece.getWorldPosition(this.loungeGrip);
      this.loungeAxis.copy(this.loungeForward).multiplyScalar(-1);this.loungeAxis.y+=.36;this.loungeAxis.normalize();
      this.loungeAxis.lerp(this.hoseEnd.copy(this.loungeMouth).sub(this.loungeGrip).normalize(),raise).normalize();
      this.rig.wrists[1].getWorldQuaternion(this.loungeRotation).invert();
      this.loungeAxis.applyQuaternion(this.loungeRotation);
      this.loungeMouthpiece.quaternion.setFromUnitVectors(forwardAxis,this.loungeAxis);
      this.loungeMouthpiece.updateWorldMatrix(true,false);
      this.loungeSmoke.updateExhale(exhale,this.loungeMouth,this.loungeForward);
      const side=this.id==='vlad'?-1:1;
      this.hoseStart.copy(pair.target);this.hoseStart.x+=side*.08;
      this.loungeMouthpiece.localToWorld(this.hoseEnd.set(0,0,-.086));
      this.hoseLowA.set(pair.target.x+.20,.06,HOME_PLACEMENTS.yardTable.z+.58);
      this.hoseLowB.set(this.hoseEnd.x,.08,HOME_PLACEMENTS.yardTable.z+.64+side*.06);
      this.loungeHose.updatePath(this.root.worldToLocal(this.hoseStart),this.root.worldToLocal(this.hoseLowA),this.root.worldToLocal(this.hoseLowB),this.root.worldToLocal(this.hoseEnd));
    }
    if(!hookah)this.loungeSmoke.visible=false;
    this.teaCup.visible=drinking||pair?.motion==='teaTogether'||this.workCoffeeCarrying;
    if(this.teaCup.visible){const liquid=this.teaCup.getObjectByName('Drink liquid') as THREE.Mesh<THREE.CircleGeometry,THREE.MeshStandardMaterial>;const recipe=this.carriedDrink??(drinking?this.diningDish as RecipeId:undefined),cold=['bananaShake','berrySmoothie','orangeJuice','mintLemonade'].includes(recipe??'');this.teaCup.getObjectByName('Cold glass')!.visible=cold;this.teaCup.getObjectByName('Drink handle')!.visible=!cold;this.teaCup.getObjectByName('Drink vessel')!.visible=!cold;liquid.position.y=cold?.062:.0415;liquid.material.color.setHex(drinking&&this.resortDrinkTint!==undefined?this.resortDrinkTint:recipe?HOME_DRINK_COLORS[recipe]??0x9b6332:0x9b6332);}
    if(drinking){const phase=a%7,sip=THREE.MathUtils.smoothstep(phase,1.3,2.4)*(1-THREE.MathUtils.smoothstep(phase,3.8,5));this.bodyPosition(this.cupCenter).add(this.cupHandleOffset.set(.15,.80,.29).applyAxisAngle(up,this.root.rotation.y));const mouth=this.rig.head.localToWorld(this.cupGripDirection.set(.025,-.18,.19));this.gripCup(this.cupCenter.lerp(mouth,sip),1);}
    if(this.teaCup.visible&&pair){
      const phase=(pair.time+(pair.leads?0:2.4))%8;
      const sip=THREE.MathUtils.smoothstep(phase,2,3.2)*(1-THREE.MathUtils.smoothstep(phase,4.2,5.5));
      this.bodyPosition(this.cupCenter).add(this.cupHandleOffset.set(.15,.80,.29).applyAxisAngle(up,this.root.rotation.y));
      const mouth=this.rig.head.getWorldPosition(this.cupGripDirection)
        .add(this.cupHandleOffset.set(.025,-.18,.19).applyAxisAngle(up,this.root.rotation.y));
      this.gripCup(this.cupCenter.lerp(mouth,sip),alpha*.9);
    }
    if(this.workCoffeeCarrying&&!pair){
      const target=this.workCoffeeTarget;
      this.bodyPosition(this.cupCenter).add(this.cupHandleOffset.set(.19,1.12,.30).applyAxisAngle(up,this.root.rotation.y));
      if(target){
        const place=THREE.MathUtils.smoothstep(a,.08,1.05);
        this.cupCenter.lerp(this.cupGripDirection.copy(target).add(this.cupHandleOffset.set(0,this.carriedDrink&&['bananaShake','berrySmoothie','orangeJuice','mintLemonade'].includes(this.carriedDrink)?.062:.0415,0)),place);
      }
      this.gripCup(this.cupCenter,alpha*.92);
    }
    this.racket.visible=this.activity==='badminton';
    if(this.racket.visible){
      const f=this.badmintonFrame,hit=f?.hit??0,height=f?.height??1.65;
      const axis=new THREE.Vector3(.28+.22*hit,.82-.16*hit,.32+.22*hit).normalize().applyAxisAngle(up,this.root.rotation.y);
      const wristGoal=new THREE.Vector3(.29+.025*hit,THREE.MathUtils.lerp(1.10,height-.30,hit),.18+.08*hit).applyAxisAngle(up,this.root.rotation.y).add(this.bodyPosition(new THREE.Vector3()));
      this.reach(1,wristGoal,alpha);
      const y=new THREE.Vector3(0,1,0);y.addScaledVector(axis,-y.dot(axis)).normalize();
      const x=new THREE.Vector3().crossVectors(y,axis).normalize();y.crossVectors(axis,x).normalize();
      const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,axis));
      this.rig.elbows[1].getWorldQuaternion(this.parentRotation).invert();
      this.rig.wrists[1].quaternion.slerp(q.premultiply(this.parentRotation),alpha);
    }
    this.paddle.visible=this.activity==='pingPong';
    if(this.paddle.visible){
      const hit=this.tennisTarget?this.tennisHit:Math.max(0,Math.sin(a*3));
      const forward=new THREE.Vector3(.12,.10,1).normalize().applyAxisAngle(up,this.root.rotation.y);
      const wristGoal=new THREE.Vector3(.24,1.02,.30).applyAxisAngle(up,this.root.rotation.y).add(this.bodyPosition(new THREE.Vector3()));
      if(this.tennisTarget)wristGoal.lerp(this.tennisTarget.clone().addScaledVector(forward,-.15),hit);
      this.reach(1,wristGoal,alpha);
      const normal=new THREE.Vector3(0,1,-.30).applyAxisAngle(up,this.root.rotation.y);normal.addScaledVector(forward,-normal.dot(forward)).normalize();
      const across=new THREE.Vector3().crossVectors(normal,forward).normalize();normal.crossVectors(forward,across).normalize();
      const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,normal,forward));this.rig.elbows[1].getWorldQuaternion(this.parentRotation).invert();this.rig.wrists[1].quaternion.slerp(q.premultiply(this.parentRotation),alpha);
    }
    if(this.isParkSwing()&&this.swingHinge){
      this.figure.position.sub(this.swingHinge).applyAxisAngle(new THREE.Vector3(1,0,0),this.swingAngle).add(this.swingHinge);
      this.figure.rotation.x=this.swingAngle;
    }
    this.selectionRing.position.x = this.figure.position.x;
    this.selectionRing.position.z = this.figure.position.z;
    // Resolve utensils after all body offsets and generic pose transforms.
    if(this.pan&&this.venueProp&&this.activity==='modeling'){
      const t=a*2.7;
      {this.reach(1,this.stationTarget(this.pan,.12*Math.sin(t*.55),.055+.065*Math.max(0,Math.sin(t)),0),alpha);this.reach(0,this.stationTarget(this.pan,-.13,.04,0),alpha);}
    }else if(this.pan&&this.activity==='cook'){
      const phase=taskCadence(a,this.id,kitchenStep==='chop'?7.4:kitchenStep==='whisk'?7:3.6);
      if(this.spoon.visible){
        this.toolContact(this.spoon,this.stationTarget(this.pan,.068*Math.cos(phase),.058,.057*Math.sin(phase)),.203,0,0,-.60);
      }else if(this.props.spatula.visible){
        const lift=.085*Math.max(0,Math.sin(phase));
        this.toolContact(this.props.spatula,this.stationTarget(this.pan,.075*Math.cos(phase),.048+lift,.045*Math.sin(phase)),.209,-.008,0,-.30+lift*3);
      }else if(this.props.knife.visible){
        // Board is to the cook's right when facing the stove (world -X).
        this.toolSurface.copy(this.pan);this.toolSurface.x-=.23;this.toolSurface.z+=.10;this.toolSurface.y=1.124;
        this.toolContact(this.props.knife,this.stationTarget(this.toolSurface,.035*Math.sin(phase*.5),.05*(.5+.5*Math.sin(phase)),0),.15,-.015,0,-.22);
        this.reach(0,this.stationTarget(this.toolSurface,-.12,.08,-.09),1,.7);
      }else if(kitchenStep==='knead'){
        this.toolSurface.copy(this.pan);this.toolSurface.x-=.23;this.toolSurface.z+=.10;this.toolSurface.y=1.124;
        for(const i of [0,1] as const){
          const side=i===0?-1:1;
          this.reach(i,this.stationTarget(this.toolSurface,side*.075+.025*Math.sin(phase+i*Math.PI),.065+.025*Math.cos(phase+i*Math.PI),-.035+.025*Math.cos(phase)),1,.65);
          this.aimHand(i,this.handDirection.set(0,-.75,.65).applyAxisAngle(up,this.root.rotation.y),1);
        }
      }
    }else if(this.pan&&this.activity==='prep'&&this.props.knife.visible){
      this.toolContact(this.props.knife,this.stationTarget(this.pan,.07,.025+.047*(.5+.5*Math.sin(a*7)),0),.15,-.015,0,-.22);
    }else if(this.pan&&this.activity==='grill'&&this.props.tongs.visible){
      const swing=taskCadence(a,this.id,3.1);
      this.toolContact(this.props.tongs,this.stationTarget(this.pan,.085*Math.sin(swing),.035+.08*Math.max(0,Math.sin(swing)),.055*Math.cos(swing)),.173,0,0,-.50);
    }else if(this.pan&&this.activity==='eat'&&!drinking){
      const mealTime=this.mealSlow?a/2.8:a;
      const meal=mealGesture(mealTime,this.id);
      // The portion is collected from the actual personal plate, then
      // follows one continuous path to the mouth and returns empty.
      this.toolSurface.copy(this.pan);
      this.toolSurface.x+=.025*Math.cos(mealTime*2.7);this.toolSurface.y-=.035;
      data.head.localToWorld(this.toolGoal.set(0,-.134,.158));
      this.toolSurface.lerp(this.toolGoal,bite);
      this.toolSurface.y+=.045*Math.sin(Math.PI*bite);
      if(this.spoon.visible||this.props.fork.visible){
        const tool=this.spoon.visible?this.spoon:this.props.fork;
        this.toolContact(tool,this.toolSurface,this.spoon.visible?.203:.2565,0,-Math.PI*bite,-.46+.56*bite);
      }else{
        this.toolAxis.set(.12,-.20,1).normalize().applyAxisAngle(up,this.root.rotation.y);
        this.target.copy(this.toolSurface).addScaledVector(this.toolAxis,-.07);
        this.reach(1,this.target,1,.65);this.aimHand(1,this.handDirection.copy(this.toolAxis),1);
        this.rig.wrists[1].localToWorld(this.toolTip.set(0,-.07,0));
      }
      if(meal.loaded>0&&bite>.035){
        this.mealBite.visible=true;this.mealBite.position.copy(this.figure.worldToLocal(this.target.copy(this.toolTip)));
        this.mealBite.position.y+=.008;this.mealBite.scale.set(.026*(.8+.2*meal.loaded),.015*(.8+.2*meal.loaded),.025*(.8+.2*meal.loaded));
      }
    }
    // Resolve handheld objects after all body offsets and pose transforms.
    // The props are authoritative targets; IK keeps the hands on their edges.
    if(this.props.phone.visible){
      const phone=this.props.phone,call=this.activity==='phone';
      const shoulderY=this.rightArm.position.y;
      phone.position.copy(this.figure.worldToLocal(data.chest.localToWorld(this.target.set(.085,shoulderY-.29,.36))));
      phone.rotation.set(-.76,.08,.04);
      if(call){
        const lift=THREE.MathUtils.smoothstep(a,0,.65);
        const ear=data.head.localToWorld(this.target.set(.183,-.075,.008));
        phone.position.lerp(this.figure.worldToLocal(ear),lift);
        data.head.getWorldQuaternion(this.aimRotation);
        this.rotationBasis.makeBasis(this.basisX.set(0,0,-1),this.elbowAxis.set(-1,0,0),this.basisZ.set(0,1,0));
        this.parentRotation.setFromRotationMatrix(this.rotationBasis);
        this.aimRotation.multiply(this.parentRotation);
        this.figure.getWorldQuaternion(this.parentRotation).invert();
        phone.quaternion.slerp(this.parentRotation.multiply(this.aimRotation),lift);
      }
      phone.updateWorldMatrix(true,false);
      this.reach(1,phone.localToWorld(this.target.set(.012,-.018,-.095)),1,.65);
      this.aimHand(1,this.handDirection.set(0,0,1).applyQuaternion(phone.getWorldQuaternion(this.parentRotation)),1);
      if(!call){
        const {contact:swipe,z}=phoneStroke(a,this.id);
        // The animated palm travels along the glass during a swipe, then
        // hovers above it. No independent finger joints on the shipped rig.
        phone.getWorldQuaternion(this.parentRotation);
        this.handDirection.set(.65,-.30,.72).normalize().applyQuaternion(this.parentRotation);
        this.target.set(-.012,.025+.026*(1-swipe),z);
        phone.localToWorld(this.target).addScaledVector(this.handDirection,-.085);
        this.reach(0,this.target,1,.66);
        this.aimHand(0,this.handDirection,1);
      }
    }
    if (this.carryingBook || this.closingBook > 0) {
      const reading=this.activity==='read',closing=this.closingBook/.36;
      this.props.book(this.activityTime,reading,closing);
      if(reading||closing>0){
        const book=this.props.heldBook,page=this.props.bookPage,shoulderY=(this.leftArm.position.y+this.rightArm.position.y)*.5;
        book.position.copy(this.figure.worldToLocal(data.chest.localToWorld(this.target.set(0,shoulderY-.31,.36))));
        book.rotation.set(-.47,0,0);book.updateWorldMatrix(true,true);
        const phase=this.activityTime%10.5,turn=reading?Math.sin(Math.PI*THREE.MathUtils.smoothstep(phase,7.85,9.40)):0;
        for(const i of [0,1] as const){
          const side=i===0?-1:1;
          const leaf=this.props.bookLeaves[i];
          this.handDirection.set(-side*.28,.16,1).normalize().applyQuaternion(book.getWorldQuaternion(this.parentRotation));
          const goal=leaf.localToWorld(this.target.set(side*.105,-.017,-.052));
          if(i===1&&turn>0){const edge=page.localToWorld(this.basisX.set(.11,.022,-.025));goal.lerp(edge,turn);}
          goal.addScaledVector(this.handDirection,-.055);
          this.reach(i,goal,1,.65);
          this.aimHand(i,this.handDirection,1);
        }
      }
      this.closingBook = Math.max(0,this.closingBook-dt);
    } else this.props.hideBook();
  }
}
