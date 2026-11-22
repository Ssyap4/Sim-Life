import * as THREE from 'three';
import { batchRigidParts, drum, type XYZ } from './ArtKit';
import { lettering, part, paving, round, smallOrb, trim, type LocationResources } from './LocationArt';
import { marketCashier } from './MarketArt';
import { CAREERS, careerAt, type CareerId, type CareerPlace } from '../shared/careers';
import { WORK_DECOR, WORK_NPCS, WORK_VISITORS, type Station } from '../shared/locations';

const palettes: Record<CareerId, { floor: string; seam: string; wall: number; base: number; ink: string; color: string; accent: number }> = {
  it:{floor:'#c6c7bc',seam:'#afb6b1',wall:0xaabdbb,base:0x536a70,ink:'#284757',color:'#e4eadc',accent:0x567d8e},
  detail:{floor:'#b7b9b4',seam:'#959b9a',wall:0xa8b5b6,base:0x455760,ink:'#233b43',color:'#f2c979',accent:0xbc8743},
  marketing:{floor:'#ddc0a1',seam:'#c5a88b',wall:0xe1cabe,base:0xbd7f78,ink:'#553747',color:'#fbe7ce',accent:0x99647f},
  clinic:{floor:'#dce3d8',seam:'#b9cdc2',wall:0xc9e0d0,base:0x65988c,ink:'#315a53',color:'#eff0dc',accent:0x6d9e90},
};
const wood = 0xa77e5a, pale = 0xf1e5cd, frame = 0x3c5055;

function desk(root: THREE.Group, width: number, color: number, own = false) {
  trim(root,[width,.10,.69],[0,.81,-.06],wood);
  for (const x of [-width*.39,width*.39]) {
    trim(root,[.105,.76,.56],[x,.38,-.06],color);
  }
  part(root,[width-.24,.31,.035],[0,.54,-.21],color);
  if (own) chair(root,0,.63,color);
}
function chair(root: THREE.Group, x: number, z: number, color: number) {
  for (const dx of [-.19,.19]) for (const dz of [-.16,.16]) part(root,[.07,.44,.07],[x+dx,.22,z+dz],frame);
  trim(root,[.53,.085,.44],[x,.46,z],color);
  trim(root,[.53,.38,.078],[x,.70,z+.18],color);
}
function screen(root: THREE.Group, pos: XYZ, laptop: boolean, accent: number) {
  const [x,y,z] = pos;
  if (laptop) {
    trim(root,[.55,.03,.37],[x,y,z+.13],frame);
    const lid = trim(root,[.55,.35,.04],[x,y+.165,z-.055],frame); lid.rotation.x = -.2;
    part(root,[.47,.264,.019],[x,y+.184,z-.032],accent).rotation.x = -.2;
    for (let i=0;i<4;i++) part(root,[.40,.007,.018],[x,y+.02,z+.038+i*.045],0xbecac5);
    part(root,[.16,.007,.078],[x,y+.018,z+.235],0x778b8e);
  } else {
    trim(root,[.74,.42,.065],[x,y+.297,z-.11],frame);
    part(root,[.65,.338,.018],[x,y+.31,z-.072],0x557c83);
    trim(root,[.25,.055,.23],[x,y+.033,z-.10],frame);
    trim(root,[.46,.032,.145],[x,y+.025,z+.21],frame);
    trim(root,[.085,.031,.115],[x+.32,y+.020,z+.20],0x8da79f);
    for (let i=0;i<3;i++) part(root,[.34-i*.07,.018,.014],[x-.10,y+.401-i*.064,z-.06],accent);
  }
}
function note(root: THREE.Group, x: number, y: number, z: number, color = pale) {
  trim(root,[.31,.024,.22],[x,y,z],color);
  for (let n=0;n<3;n++) part(root,[.17+.018*n,.004,.010],[x-.024,y+.015,z-.061+n*.048],0x82928b);
}
function plant(root: THREE.Group, x: number, z: number, accent: number) {
  round(root,.23,.29,[x,.145,z],accent);
  for (let i=0;i<5;i++) part(root,[.12,.33,.13],[x+Math.cos(i*1.9)*.12,.38+i*.066,z+Math.sin(i*1.9)*.12],
    i%2?0x7e9b76:0x52846a,smallOrb).rotation.z=(i-2)*.19;
}
function board(root: THREE.Group, resources: LocationResources, name: string, accent: number) {
  for (const x of [-.66,.66]) part(root,[.07,1.48,.10],[x,.75,0],frame);
  trim(root,[1.55,.88,.075],[0,1.36,0],accent);
  part(root,[1.44,.78,.024],[0,1.36,.051],pale);
  for (let i=0;i<6;i++) {
    const memo = part(root,[.16+i%2*.06,.13,.012],[.46-(i%3)*.47,1.54-Math.floor(i/3)*.29,.069],
      [0xf4ce82,0xa7cdb9,0xd7a497][i%3]);
    memo.rotation.z = Math.sin(i) * .14;
  }
  lettering(root,resources,[0,1.97,.068],1.55,.22,name,['#f5ebd6','#405752']);
}

function car(root: THREE.Group, color: number) {
  trim(root,[1.47,.30,2.72],[0,.42,0],color);
  trim(root,[1.38,.30,1.52],[0,.59,-.18],color);
  trim(root,[1.14,.34,1.24],[0,.769,-.17],0x516d76);
  trim(root,[1.04,.073,.93],[0,.945,-.22],color);
  trim(root,[1.42,.15,.60],[0,.57,.98],color);
  trim(root,[1.35,.14,.39],[0,.55,-1.09],color);
  for (const z of [-.87,.86]) for (const side of [-1,1]) {
    const wheel = part(root,[.239,.16,.239],[side*.73,.26,z],0x2e393c,drum); wheel.rotation.z=Math.PI/2;
    const rim = part(root,[.128,.035,.128],[side*.824,.26,z],0xb2b8ae,drum); rim.rotation.z=Math.PI/2;
    trim(root,[.25,.089,.057],[side*.49,.48, z>0?1.37:-1.37],z>0?0xf6df9a:0xa64c48);
  }
  trim(root,[.49,.078,.03],[0,.37,1.364],pale);
}
function animal(root: THREE.Group, x: number, y: number, z: number) {
  const fur = 0xc6a582;
  part(root,[.28,.15,.30],[x-.03,y+.115,z-.01],fur,smallOrb);
  part(root,[.174,.137,.16],[x+.204,y+.171,z+.005],fur,smallOrb);
  for (const side of [-1,1]) {
    part(root,[.047,.090,.042],[x+.189,y+.274,z+side*.091],0x95634e,smallOrb).rotation.x=side*.38;
    part(root,[.027,.022,.024],[x+.356,y+.187,z+side*.06],0x393634,smallOrb);
    part(root,[.13,.05,.065],[x+.10,y+.054,z+side*.15],0xe5c9a8,smallOrb);
  }
  part(root,[.043,.024,.036],[x+.379,y+.145,z],0x69483a,smallOrb);
  part(root,[.174,.041,.038],[x-.31,y+.095,z-.083],fur,smallOrb).rotation.y=-.6;
}
function cabinet(root: THREE.Group, color: number, width: number, h: number) {
  trim(root,[width,h,.52],[0,h/2,0],color);
  for (let y=.27;y<h-.08;y+=.24) {
    trim(root,[width-.10,.20,.049],[0,y,.27],pale);
    trim(root,[.25,.035,.041],[0,y+.025,.304],frame);
  }
}
function kit(root: THREE.Group, color: number) {
  trim(root,[.45,.02,.30],[.35,.90,.046],0xaab9b2);
  for (let x=-.5;x<.18;x+=.29) {
    round(root,.068,.18,[x,.946,-.16],color);
    round(root,.057,.04,[x,1.06,-.16],pale);
  }
}

export function careerStation(station: Station, career: CareerId, resources?: LocationResources) {
  const root = new THREE.Group();
  root.position.set(station.center.x,0,station.center.z);
  const scheme = palettes[career], id = station.action.kind === 'career' ? station.action.station : 'desk';
  if (id==='desk') {
    desk(root,station.width,scheme.accent,true);
    screen(root,[0,.875,-.105],career==='marketing',0xa2caca);
    note(root,.58,.87,.042);
  } else if (id==='board' && career!=='clinic') {
    board(root,resources!,station.name,scheme.accent);
  } else if (id==='board' || id==='records' && career==='marketing') {
    cabinet(root,scheme.accent,station.width,.95);
    for (const x of [-.5,-.2,.24,.45]) trim(root,[.12,.20,.31],[x,1.056,-.03],x<0?0xd9a76c:0x8ab1a9);
  } else if (id==='records' && career==='it') {
    cabinet(root,scheme.accent,station.width,.91);
    trim(root,[.89,.29,.48],[0,1.055,.008],frame);
    trim(root,[.47,.038,.30],[.06,1.218,.04],pale);
  } else if (id==='service' && career==='detail') {
    trim(root,[2.63,.07,2.79],[0,.034,0],0x576c70);
    car(root,0x567f85);
  } else if (id==='service' && career==='clinic') {
    trim(root,[1.45,.104,.94],[0,.847,0],0xa9c1bc);
    trim(root,[.53,.74,.51],[0,.41,0],0x648d87);
    trim(root,[.90,.10,.52],[0,.91,.005],0xe6dbc3);
    animal(root,0,.97,0);
  } else if (id==='service' && career==='marketing') {
    for (const x of [-.58,.58]) part(root,[.07,1.08,.07],[x,.54,0],frame);
    trim(root,[1.83,.92,.15],[0,1.25,0],frame);
    part(root,[1.7,.79,.028],[0,1.25,.09],0x597376);
    for (let i=0;i<5;i++) {
      const h=.21+([1,4,2,5,6][i])*.075;
      part(root,[.16,h,.021],[-.61+i*.302,.91+h/2,.11],i%2?0xe7bd85:0xa6bdab);
    }
  } else if (id==='service' && career==='it') {
    desk(root,station.width,scheme.accent);
    screen(root,[0,.875,-.105],false,0xb7cbab);
    note(root,.53,.87,.045);
  } else if (id==='lead' && (career==='it'||career==='marketing')) {
    trim(root,[station.width,.09,station.depth-.13],[0,.75,0],wood);
    for (const x of [-.72,.72]) trim(root,[.11,.70,.63],[x,.35,0],scheme.accent);
    chair(root,-.38,.50,scheme.accent); chair(root,.40,.50,scheme.accent);
    note(root,-.48,.806,-.11); note(root,.45,.806,.06,0xddb384);
  } else {
    desk(root,station.width,scheme.accent);
    if (id==='lead') {
      screen(root,[-.57,.875,-.13],false,0xb3c9aa);
      trim(root,[.32,.055,.19],[.48,.896,.06],0xcbb788);
      note(root,.18,.87,.15);
    } else kit(root,scheme.accent);
  }
  if (resources && !(id==='board' && career!=='clinic')) lettering(root,resources,
    [0,id==='lead'?.93:1.52,id==='lead'?.44:.30],Math.min(1.7,station.width),.23,station.name,['#f6ecd7','#455b53'],undefined,true);
  batchRigidParts(root,true);
  return root;
}

export function buildCareerPlace(place: CareerPlace, root: THREE.Group, people: THREE.Group, resources: LocationResources) {
  const id = careerAt(place), spec = CAREERS[id], scheme = palettes[id];
  trim(root,[12.25,.39,10.24],[0,-.22,0],scheme.base);
  paving(root,resources,12.04,10.01,0,ctx=>{
    ctx.fillStyle=scheme.seam; ctx.fillRect(-7,-6,14,12);
    const step=id==='marketing'?.46:id==='detail'?1.0:.65;
    for (let row=0;row<23;row++) for (let column=-1;column<20;column++) {
      ctx.fillStyle=scheme.floor;
      ctx.globalAlpha=(row*13+column*9+19)%7===0?.67:1;
      ctx.fillRect(-6+column*.70+row%2*.34,-5+row*step,.684,step-.014);
    }
    ctx.globalAlpha=1;
    if (id==='detail') {
      ctx.fillStyle='#dbb76e';
      for (const x of [-.75,1.60,4.45]) ctx.fillRect(x,-4.72,.063,5.54);
    } else {
      ctx.fillStyle=id==='it'?'#b4c3be':id==='clinic'?'#a7c7b7':'#c29fa9';
      ctx.beginPath(); ctx.roundRect(-1.1,3.66,2.2,1.0,.12); ctx.fill();
    }
  },scheme.base);
  trim(root,[12.2,2.86,.20],[0,1.43,-4.93],scheme.wall);
  trim(root,[.20,2.86,9.97],[-6.01,1.43,0],scheme.wall);
  part(root,[12,.58,.06],[0,.36,-4.80],scheme.base);
  part(root,[.06,.58,9.89],[-5.88,.36,0],scheme.base);
  for (const x of [-3.93,3.88]) {
    trim(root,[2.65,.99,.13],[x,1.80,-4.786],pale);
    part(root,[2.47,.81,.025],[x,1.80,-4.708],id==='detail'?0x617e82:0x9fb8b6);
    for (const dx of [-.62,.62]) part(root,[.068,.80,.037],[x+dx,1.802,-4.686],pale);
    trim(root,[2.71,.075,.197],[x,1.279,-4.755],wood);
  }
  lettering(root,resources,[0,2.22,-4.782],3.06,.59,spec.employer,[scheme.color,scheme.ink],
    {it:'Внутренние проекты',detail:'Приёмка и уход',marketing:'Кампании и аналитика',clinic:'Приём и наблюдение'}[id]);
  for (const x of [-.85,.86]) trim(root,[.71,.064,.16],[x,2.73,-4.784],pale);
  if (id==='detail') for (const x of [.43,2.9]) {
    trim(root,[1.40,.09,.22],[x,2.67,-3.45],frame);
    part(root,[1.29,.029,.16],[x,2.619,-3.45],0xf1dfb6);
  }
  plant(root,5.18,-4.34,scheme.accent); plant(root,-5.33,3.74,scheme.accent);
  for (const [i,{x,z,w,d}] of (WORK_DECOR[place] ?? []).entries()) {
    const decoration = new THREE.Group(); decoration.position.set(x,0,z); root.add(decoration);
    if (id==='detail' && i===0) { const second = new THREE.Group(); second.scale.set(.84,.86,.82); car(second,0xb88162); decoration.add(second); }
    else if ((id==='clinic'||id==='marketing'||id==='detail') && i===2) {
      trim(decoration,[w,.18,d],[0,.45,0],scheme.accent);
      trim(decoration,[w,.35,.11],[0,.59,-d/2+.056],scheme.accent);
      for (const px of [-w*.40,w*.40]) part(decoration,[.076,.40,d*.74],[px,.21,0],wood);
    } else if (i===0 && id!=='detail') {
      desk(decoration,w,scheme.accent);
      screen(decoration,[0,.875,-.11],id==='marketing',0xb7cbab);
    } else cabinet(decoration,scheme.accent,w,id==='clinic'?.99:1.16);
  }
  const staff = spec.staff.map((person,index) => {
    const actor = marketCashier(resources,{ title:person.name,color:index?scheme.accent:scheme.base,
      shirt:index===2?0xc1c6c0:pale,skin:[0xc8957d,0xb87d5d,0xd6a58c][index],animated:true });
    const spot = WORK_NPCS[id][index];
    actor.position.set(spot.x,0,spot.z);
    actor.rotation.y = id==='detail' && index ? (index===1?1.35:-1.35) : -.12 + index*.11;
    people.add(actor);
    const rig = actor.userData.motion as {head:THREE.Group;arms:THREE.Group[]};
    return { actor, ...rig };
  });
  const visit = WORK_VISITORS[id];
  const visitor = visit && marketCashier(resources,{title:id==='clinic'?'Владелец пациента':'Посетитель',color:0xb27b70,shirt:0xc7c5ad});
  if (visitor && visit) {
    visitor.position.set(visit.x,0,visit.z);
    visitor.rotation.y = Math.PI + .2;
    visitor.visible = false;
    visitor.userData.careerVisitor = true;
    if (id==='clinic') animal(visitor,-.39,0,.06);
    people.add(visitor);
  }
  return (time: number) => {
    for (const [i,{head,arms,actor}] of staff.entries()) {
      const beat=time*(i===0?1.4:4.4)+i*1.86;
      head.rotation.y=Math.sin(time*.65+i)*.17;
      head.rotation.x=Math.cos(time*.9+i)*.038;
      if (id==='detail' && i) {
        arms[i%2].rotation.x=-.7+Math.sin(beat)*.31;
        arms[i%2].rotation.z=Math.sin(beat)*.11;
      } else {
        arms[0].rotation.x=-.15+Math.sin(beat)*.1;
        arms[1].rotation.x=-.18+Math.cos(beat+i)*.09;
      }
      actor.position.y=Math.sin(time*1.65+i)*.009;
    }
    if (visitor) {
      const phase = time % 72;
      visitor.visible = phase >= 18 && phase < 42;
      visitor.rotation.y = Math.PI + .2 + Math.sin(time*.72)*.16;
    }
  };
}
