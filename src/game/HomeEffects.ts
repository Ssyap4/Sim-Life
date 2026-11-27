import {drawConsoleFrame} from './ConsoleFrames';
import {stopUfcHighlight} from './UfcHighlights';
import type {ConsoleMatch,ConsoleGameId} from '../shared/consoleCatalog';
import * as THREE from 'three';
import { electronicsDisplay,electronicsVariants } from './ElectronicsArt';
import type { ElectronicsId } from '../shared/electronics';
import { BATH_FIXTURES } from '../shared/home';
import type { Program } from '../shared/homeLife';
import { GENRES } from '../shared/homeLife';
import { SKILL_IDS, SKILLS } from '../shared/education';
import { MATERIAL_BY_ID } from '../shared/educationCatalog';
import {drawNamedMedia} from '../mediaArt';
import type {MediaSelection} from '../shared/mediaCatalog';
import { drawTvProgramMoment } from './TvProgramMoments';

const themes: Record<Program, [string,string,string,string]> = {
  lesson: ['#365d59','#638980','#eddcb5','Учебное телевидение'],
  horror: ['#111725','#334151','#dde4ba','Лунная тропа'],
  drama: ['#553a42','#8c6861','#efad7c','Последний разговор'],
  crime: ['#121f39','#384e66','#e8bb77','Улики в городе'],
  thriller: ['#1e2430','#732d44','#fdc18d','Тень в коридоре'],
  action: ['#421c2c','#924831','#ffca77','Погоня'],
  comedy: ['#855e67','#d66f67','#ffdd8c','Не тот чемодан'],
  romance: ['#67435b','#b87280','#ffd7a1','Встреча на закате'],
  pets: ['#36584a','#73935c','#eac294','Звери дома'],
  vlog: ['#464277','#987fa6','#ffe0a4','День со мной'],
  travel: ['#263f57','#659aaa','#f4db9f','Дорога к морю'],
  tech: ['#163342','#387780','#a7f4d4','Рабочий стол'],
  cooking: ['#503f4c','#ad6549','#f2c79b','Готовим ужин'],
  broadcast: ['#244355','#527c7b','#e8d2a6','Вечерний эфир'],
  concert: ['#32294e','#805877','#e9a290','Живой концерт'],
};

export class HomeEffects {
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly screen: THREE.Mesh;
  private readonly tvHardware=electronicsVariants('tv');
  private tvId:ElectronicsId='tvStart';
  private readonly shower: THREE.LineSegments;
  private readonly foam: THREE.InstancedMesh;
  private readonly bathBomb: THREE.Mesh<THREE.IcosahedronGeometry,THREE.MeshStandardMaterial>;
  private readonly bathRelease=new THREE.Vector3();
  private readonly bathLanding=new THREE.Vector3();
  private bathCareActive=false;
  private bathReleaseKnown=false;
  private readonly handWater: THREE.LineSegments;
  private readonly dogWater:THREE.LineSegments;
  private readonly dogFoam:THREE.InstancedMesh;
  private readonly media = new Map<string, Program>();
  private readonly namedMedia=new Map<string,{selection:MediaSelection;start:number}>();
  private lastScreen = -1;
  private readonly games=new Map<string,{game:ConsoleGameId;start:number;match?:ConsoleMatch}>();
  console(id:string,game?:ConsoleGameId,start=0,match?:ConsoleMatch){if(game)this.games.set(id,{game,start,match});else this.games.delete(id);if(![...this.games.values()].some(g=>g.game==='ufc6'))stopUfcHighlight(this.context);this.screen.visible=this.media.size>0||this.games.size>0;this.lastScreen=-1;}
  private lesson?: string;

  constructor(scene: THREE.Scene) {
    this.canvas.width = 256;
    this.canvas.height = 144;
    this.context = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(1,1),
      new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    this.screen.position.set(0,0,.003);
    electronicsDisplay(this.tvHardware.select('tvStart'))!.add(this.screen);
    this.screen.visible = false;

    const lines = Array.from({length:18},(_,i) => {
      const angle = i*2.39996, radius = .48*Math.sqrt((i+1)/18);
      const x = Math.cos(angle)*radius, z = Math.sin(angle)*radius;
      const y = .23+(i*31%17)/10;
      return [x,y,z,x+.07,y+.28,z];
    }).flat();
    this.shower = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(
      Array.from({length:36},(_,i) => new THREE.Vector3().fromArray(lines,i*3))),
      new THREE.LineBasicMaterial({color:0xa5e4f0,transparent:true,opacity:.65}));
    const shower = BATH_FIXTURES.shower.center;
    this.shower.position.set(shower.x+.16,.08,shower.z+.14);
    this.shower.visible = false;

    this.foam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),
      new THREE.MeshStandardMaterial({color:0xeaf8ee,roughness:.83}),80);
    const dummy = new THREE.Object3D();
    for(let i=0;i<80;i++){
      const x=i%8,z=Math.floor(i/8),size=.055+(i*13%9)*.004;
      dummy.position.set((x-3.5)*.105+Math.sin(i*4)*.019,.447+Math.sin(i*5)*.016,(z-4.5)*.151+Math.cos(i*3)*.016);
      dummy.scale.set(size,size*.43,size*1.18);
      dummy.updateMatrix();
      this.foam.setMatrixAt(i,dummy.matrix);
    }
    const bath = BATH_FIXTURES.bathtub.center;
    this.foam.position.set(bath.x,0,bath.z);
    this.foam.visible = false;
    this.bathBomb=new THREE.Mesh(new THREE.IcosahedronGeometry(.042,1),new THREE.MeshStandardMaterial({color:0xf0dfc3,roughness:.82}));
    this.bathBomb.visible=false;scene.add(this.bathBomb);
    const sink = BATH_FIXTURES.wcBasin.center;
    this.handWater = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.011, .115, -.018), new THREE.Vector3(-.008, .004, .021),
      new THREE.Vector3(.003, .115, -.017), new THREE.Vector3(.008, 0, .024),
    ]), new THREE.LineBasicMaterial({ color: 0xb6e6ed, transparent: true, opacity: .82 }));
    this.handWater.position.set(sink.x, .983, sink.z + .025);
    this.handWater.visible = false;
    const droplets:Array<THREE.Vector3>=[];
    for(let i=0;i<18;i++){const x=(i%3-1)*.105,z=(Math.floor(i/3)-2.5)*.11,y=.70+(i%4)*.095;droplets.push(new THREE.Vector3(x,y,z),new THREE.Vector3(x-.05,y-.18,z+.025));}
    this.dogWater=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(droplets),new THREE.LineBasicMaterial({color:0xa9e1ff,transparent:true,opacity:.85}));
    this.dogWater.position.set(bath.x-.12,0,bath.z-.18);
    this.dogFoam=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0xf2fbff,roughness:.7}),20);
    for(let i=0;i<20;i++){const a=i*2.4,r=.10+(i%4)*.055;dummy.position.set(Math.cos(a)*r,.72+(i%3)*.055,Math.sin(a)*r);const size=.055+(i%4)*.01;dummy.scale.set(size,size*.73,size);dummy.updateMatrix();this.dogFoam.setMatrixAt(i,dummy.matrix);}
    this.dogFoam.position.set(bath.x-.13,0,bath.z-.20);
    this.dogWater.visible=this.dogFoam.visible=false;
    scene.add(this.shower,this.foam,this.handWater,this.dogWater,this.dogFoam);
  }

  mountTv(parent:THREE.Group){parent.add(this.tvHardware.group);this.tvHardware.group.position.y=.574;return this.tvHardware.group;}
  setTv(id:ElectronicsId){if(this.tvId===id)return;this.tvId=id;electronicsDisplay(this.tvHardware.select(id))!.add(this.screen);}
  television(id: string, program?: Program, lesson?: string, selection?:MediaSelection,start=0) {
    if(program&&selection)this.namedMedia.set(id,{selection,start});else this.namedMedia.delete(id);
    if (lesson) this.lesson = lesson;
    if(program) this.media.set(id,program); else this.media.delete(id);
    this.screen.visible = this.media.size > 0||this.games.size>0;
    this.lastScreen = -1;
  }

  water(station: 'shower' | 'bathtub' | 'wcBasin', active: boolean,foamColor=0xeaf8ee) {
    if(station === 'shower') this.shower.visible = active;
    else if (station === 'wcBasin') this.handWater.visible = active;
    else {this.bathCareActive=false;this.bathReleaseKnown=false;this.bathBomb.visible=false;this.foam.visible = active;(this.foam.material as THREE.MeshStandardMaterial).color.setHex(foamColor);}
  }

  beginBathCare(foamColor:number,bombColor:number){this.water('bathtub',false,foamColor);this.bathCareActive=true;this.bathBomb.material.color.setHex(bombColor);this.bathBomb.scale.setScalar(1);}
  updateBathCare(elapsed:number,hand:THREE.Vector3){
    if(!this.bathCareActive)return;
    const bath=BATH_FIXTURES.bathtub.center;
    if(elapsed<3.15||!this.bathReleaseKnown){this.bathRelease.copy(hand);this.bathLanding.set(THREE.MathUtils.clamp(hand.x,bath.x-.35,bath.x+.35),.438,THREE.MathUtils.clamp(hand.z,bath.z-.68,bath.z+.68));this.bathReleaseKnown=true;}
    this.bathBomb.visible=elapsed>=3.15&&elapsed<5.8;
    this.foam.visible=elapsed>=3.75;
    if(this.bathBomb.visible){const t=THREE.MathUtils.clamp((elapsed-3.15)/.60,0,1);this.bathBomb.position.lerpVectors(this.bathRelease,this.bathLanding,t*t);this.bathBomb.rotation.set(t*1.6,0,t*2.2);this.bathBomb.scale.setScalar(Math.max(.04,1-THREE.MathUtils.clamp((elapsed-3.75)/2.05,0,1)));}
  }
  dogBath(phase:'lift'|'wet'|'soap'|'rinse'|null){this.dogWater.visible=phase==='wet'||phase==='rinse';this.dogFoam.visible=phase==='soap';}
  reset() {
    stopUfcHighlight(this.context);
    this.media.clear();this.namedMedia.clear();this.games.clear();
    this.screen.visible = this.shower.visible = this.foam.visible = this.handWater.visible = false;
    this.water('bathtub',false);this.dogBath(null);
  }

  update(seconds: number) {
    if(this.dogWater.visible)this.dogWater.position.y=-.045*(seconds*7%1);
    if(this.dogFoam.visible)this.dogFoam.position.y=.012*Math.sin(seconds*4);
    if(this.shower.visible) this.shower.rotation.y = seconds*1.2;
    if(this.foam.visible) this.foam.position.y = .016*Math.sin(seconds*2.8);
    if(!this.screen.visible) return;
    const game=this.games.values().next().value;
    const frame = Math.floor(seconds*(game?15:8));
    if(frame === this.lastScreen) return;
    this.lastScreen = frame;
    const program = this.media.values().next().value!;
    if(game)drawConsoleFrame(this.context,game.game,Math.max(0,seconds-game.start),game.match);else {const named=this.namedMedia.values().next().value;if(!named||!drawNamedMedia(this.context,named.selection,Math.max(0,seconds-named.start)))this.draw(program,seconds);}
    this.texture.needsUpdate = true;
  }

  private draw(program: Program, t: number) {
    const c = this.context;
    if (program === 'lesson') {
      const item = this.lesson && MATERIAL_BY_ID.get(this.lesson);
      const index = item ? SKILL_IDS.indexOf(item.skill) : 0;
      const colors = ['#315b58','#83576e','#93684d','#315a78','#587760','#635c7c','#955944','#677d4e','#53586a'];
      c.fillStyle = colors[index]; c.fillRect(0, 0, 256, 144);
      c.fillStyle = '#f1e4c5'; c.font = 'bold 13px system-ui';
      c.fillText(item ? SKILLS[item.skill][1].toUpperCase() : 'УЧЕБНОЕ ТВ', 15, 25, 226);
      if (index % 3 === 0) {
        for (let i = 0; i < 5; i++) {
          const height = 23 + i * 8 + Math.sin(t * 1.6 + i) * 5;
          c.fillRect(26 + i * 45, 104 - height, 26, height);
        }
      } else if (index % 3 === 1) {
        for (let i = 0; i < 4; i++) {
          c.beginPath(); c.arc(42 + 54 * i, 74, 13 + Math.sin(t * 1.8 + i) * 5, 0, Math.PI * 2); c.fill();
        }
      } else {
        for (let i = 0; i < 3; i++) {
          c.strokeStyle = '#f1e4c5'; c.strokeRect(24 + i * 74, 57, 55, 43);
          c.fillRect(33 + i * 74, 79, 20 + 10 * Math.sin(t * 1.4 + i), 4);
        }
      }
      c.font = '12px system-ui';
      c.fillText(item ? item.title : themes.lesson[3], 15, 126, 227);
      return;
    }
    if (program === 'broadcast') {
      this.drawBroadcast(t);
      return;
    }
    const [dark,mid,light,title] = themes[program];
    const sky = c.createLinearGradient(0,0,0,144);
    sky.addColorStop(0,dark); sky.addColorStop(1,mid);
    c.fillStyle = sky; c.fillRect(0,0,256,144);
    const disk = (x: number,y: number,r: number,color: string) => {
      c.fillStyle=color; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
    };
    const walk = Math.sin(t*.91)*19;
    const silhouette = (x: number,y: number,h: number,hat = false) => {
      disk(x,y-h,h*.24,dark);
      c.fillStyle=dark; c.fillRect(x-h*.31,y-h*.74,h*.62,h*.75);
      if(hat) c.fillRect(x-h*.44,y-h*.98,h*.88,h*.12);
    };
    disk(183+Math.sin(t*.34)*9,45,program==='horror'?26:19,light);
    if(program==='thriller') {
      for(let i=0;i<5;i++){
        const z = 12+i*20+(t*14)%20;
        c.strokeStyle = i%2 ? light : dark;
        c.lineWidth = 2;
        c.strokeRect(127-z,64-z*.44,z*2,z*.94);
      }
    } else if(program==='tech') {
      c.fillStyle=dark; c.fillRect(73,43,111,54);
      c.fillStyle=light; c.fillRect(78,47,101,43);
      c.fillStyle=mid; c.fillRect(109,93,38,13);
      c.fillStyle=dark; c.fillRect(84,54,(Math.sin(t*2)+1)*43,5);
    } else if(program==='crime' || program==='action') {
      for(let i=0;i<10;i++){
        const h=14+(i*23%49);
        c.fillStyle=i%2===0?dark:mid;
        c.fillRect(i*28,112-h,23,h);
        c.fillStyle=light;
        c.fillRect(i*28+8,104-h,3,4);
      }
      if(program==='action'){
        c.fillStyle=light;
        c.fillRect((t*95)%290-30,95,30,6);
        c.fillRect((t*143)%295-26,84,26,3);
      }
    } else {
      c.fillStyle=mid; c.beginPath(); c.moveTo(0,105);
      for(let i=0;i<=8;i++) c.lineTo(i*32,84+13*Math.sin(i*2.4+t*.34));
      c.lineTo(256,122); c.lineTo(0,122); c.fill();
    }
    if(program==='pets') {
      for(const x of [86+walk,133-walk*.55]) {
        disk(x,78+Math.sin(t*4)*4,15,light);
        disk(x-9,65,5,dark); disk(x+9,65,5,dark);
        disk(x-5,78,2,dark); disk(x+5,78,2,dark);
      }
    } else if(program==='cooking') {
      c.fillStyle = dark; c.fillRect(62,80,124,20);
      for(let i=0;i<4;i++) disk(91+i*21,74-(t*21+i*9)%40,2.5,light);
    } else if(program==='horror') {
      silhouette(101+walk,113,45); silhouette(55-walk*.4,113,25);
      if(Math.sin(t*2.3)>.97){c.fillStyle='#dae4dc30';c.fillRect(0,0,256,108);}
    } else if(program==='romance' || program==='drama' || program==='comedy') {
      silhouette(110+walk*.34,111,37+(program==='comedy'?Math.sin(t*6)*8:0));
      silhouette(151-walk*.34,111,32);
      if(program==='romance') {
        for(let i=0;i<8;i++) disk(41+i*25,25+Math.sin(i*.9)*8,1.4+Math.sin(t*2+i)*.5,light);
      }
    } else if(program!=='travel' && program!=='tech') {
      silhouette(102+walk,113,36,program==='crime');
    }
    // Layer richer action over the EXISTING screen scenes; subtitles and 
    // progress strip stay in their previous positions.
    drawTvProgramMoment(c,program,t);
    c.fillStyle='#182028'; c.fillRect(0,112,256,32);
    c.fillStyle='#fff3da'; c.font='bold 12px sans-serif'; c.fillText(title,10,132);
    c.fillStyle=light; c.fillRect(10,139,(t*10)%235,1);
    if(Object.hasOwn(GENRES,program)){c.fillStyle=light;c.fillRect(238,120,8,8);}
  }

  private drawBroadcast(t: number): void {
    const c = this.context;
    const weather = Math.floor(t / 12) % 2 === 1;
    c.fillStyle = weather ? '#648b94' : '#284957';
    c.fillRect(0, 0, 256, 144);
    c.fillStyle = '#b9d4c6';
    c.fillRect(14, 17, 228, 88);
    if (weather) {
      for (let i = 0; i < 3; i++) {
        c.fillStyle = '#eff2cb';
        c.beginPath();
        c.arc(56 + i * 68, 54 + Math.sin(t + i) * 3, 13, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#386472';
        c.fillRect(42 + i * 68, 74, 29, 9);
      }
    } else {
      c.fillStyle = '#568177';
      c.beginPath();
      c.ellipse(55, 65, 27, 26, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2b4b52';
      c.fillRect(110, 46, 101, 7);
      c.fillRect(110, 61, 85, 6);
      c.fillRect(110, 76, 108, 6);
    }
    c.fillStyle = '#172e35';
    c.fillRect(0, 108, 256, 36);
    c.fillStyle = '#fff6df';
    c.font = 'bold 14px sans-serif';
    c.fillText(weather ? 'Прогноз погоды' : 'Новости района', 14, 131);
    c.fillStyle = '#a8d4b4';
    c.fillRect(10 + (t * 21) % 201, 138, 35, 2);
  }

}
