import * as THREE from 'three';
import { DISTRICT_BEDS, DISTRICT_TREES, DISTRICT_PATHS, DISTRICT_PLAZA, DISTRICT_FLOOR, DISTRICT_OBSTACLES,
  DISTRICT_SITES, DISTRICT_POND, districtPoint, inDistrictPond, sitePoint } from '../shared/district';
import { NEIGHBOR_HOMES, homePoint, homeStops } from '../shared/neighborHomes';
import { pointIsClear } from './navigation';
import { addTufts, grassMaterial, growFlowers, growShrub, growTree, landscapeRandom, PlantBatch,
  type GrassTuft } from './LandscapePlants';
import type { GroundArea, GroundPatch } from './LandscapeGround';
import { besideTrail } from './DistrictTrail';

type Garden = GroundArea & {palette:number;count:number;y:number};
type Shrub = GroundArea & {palette:number;height:number;y:number};

const publicGardens: Garden[] = DISTRICT_BEDS.map(bed=>({
  ...bed,palette:bed.scheme,y:.20,count:Math.ceil(bed.w*bed.d*6.8),
}));
const borderGardens: Garden[] = [
  {x:-16.73,z:6.02,w:1.25,d:.62,palette:0,y:0,count:9},
  {x:-13.45,z:-12.93,w:2.30,d:1.10,palette:1,y:0,count:11},
  {x:-8.17,z:-11.83,w:2.6,d:.83,palette:2,y:0,count:14},
  {x:-3.0,z:8.85,w:2.6,d:1.31,palette:0,y:0,count:13},
  {x:3.49,z:5.22,w:2.74,d:1.05,palette:2,y:0,count:13},
  {x:8.84,z:5.39,w:2.52,d:.88,palette:1,y:0,count:11},
  {x:15.97,z:-5.00,w:1.78,d:1.21,palette:2,y:0,count:12},
  {x:23.19,z:-12.73,w:3.53,d:1.42,palette:0,y:0,count:16},
  {x:19.45,z:-2.05,w:2.97,d:1.16,palette:3,y:0,count:13},
  {x:23.7,z:4.87,w:2.86,d:1.32,palette:0,y:0,count:13},
  {x:25.0,z:18.02,w:3.46,d:1.82,palette:2,y:0,count:12},
  {x:21.45,z:24.08,w:4.24,d:2.45,palette:0,y:0,count:12},
  {x:12.07,z:16.42,w:3.26,d:1.15,palette:3,y:0,count:11},
  {x:-11.83,z:16.46,w:2.58,d:1.28,palette:2,y:0,count:10},
  {x:18.92,z:22.04,w:1.26,d:1.80,palette:0,y:0,count:15},
  {x:19.50,z:19.26,w:1.72,d:1.00,palette:2,y:0,count:12},
  {x:22.13,z:19.05,w:1.93,d:.74,palette:0,y:0,count:14},
  {x:24.22,z:21.44,w:1.22,d:1.44,palette:3,y:0,count:13},
  {x:21.83,z:24.89,w:1.77,d:.89,palette:2,y:0,count:12},
  {x:22.97,z:23.83,w:2.5,d:1.12,palette:1,y:0,count:10},
  {x:16.03,z:23.89,w:1.18,d:2.06,palette:2,y:0,count:12},
  {x:13.87,z:14.90,w:1.68,d:1.09,palette:1,y:0,count:10},
  {x:23.51,z:17.55,w:2.02,d:1.38,palette:3,y:0,count:11},
  {x:8.25,z:23.97,w:2.7,d:1.23,palette:1,y:0,count:14},
  {x:3.84,z:19.55,w:3.1,d:1.15,palette:2,y:0,count:13},
  {x:-3.52,z:21.57,w:2.24,d:1.32,palette:0,y:0,count:11},
  {x:-7.40,z:26.60,w:2.2,d:1.13,palette:1,y:0,count:10},
];
const gardens: Garden[] = [...publicGardens,...borderGardens];
const shrubs: Shrub[] = [];
const porchPads = DISTRICT_SITES.map(site=>({...sitePoint(site,0,site.d/2+.86),w:2.4,d:2.46}));
const paved = [...DISTRICT_PATHS,DISTRICT_PLAZA,...porchPads];

for (const [i,home] of NEIGHBOR_HOMES.entries()) {
  const face = home.depth/2;
  for (const side of [-1,1]) {
    gardens.push({...homePoint(home,side*(home.width/2-.77),face+1.47),w:1.24,d:.55,palette:i,y:.06,count:10});
    gardens.push({...homePoint(home,side*home.width*.30,face+.33),w:1.08,d:.28,palette:i,y:1.10,count:6});
    for (let k=0;k<4;k++) shrubs.push({...homePoint(home,side*(home.width/2+1.35),face-1+k*1.45),
      w:.70,d:.98,height:.55,palette:i,y:0});
    if (i===2) gardens.push({...homePoint(home,side*home.width*.37,face+1.70),w:1.28,d:.45,palette:2,y:.08,count:8});
  }
  if (i===0) for (let row=0;row<3;row++) {
    const tray=homePoint(home,-home.width*.37,face+1.05+row*.57);
    for (let n=0;n<4;n++) shrubs.push({...tray,x:tray.x+(n-1.5)*.26,w:.22,d:.20,height:.20,palette:0,y:.11});
  }
}
for (const [i,site] of DISTRICT_SITES.entries()) {
  for(const side of [-1,1]) {
    const p=sitePoint(site,side*site.w*.41,site.d/2+.51);
    shrubs.push({...p,w:.81,d:1.02,height:.52,palette:(i+1)%4,y:.02});
    const edge=sitePoint(site,side*site.w*.39,site.d/2+.91);
    gardens.push({...edge,w:.37,d:.94,palette:i%4,y:.008,count:7});
  }
}
for (const [x,z,hue] of [
  [-25.7,-17.4,0],[-12.35,2.12,2],[-4.52,-7.11,1],[6.64,-12.09,2],[9.70,-6.30,0],[11.1,-3.35,1],
  [21.90,-3.8,3],[25.3,7.5,3],[23.3,12.7,0],[10.8,11.55,1],[3.6,12.4,0],[-6.9,13.4,2],
  [-13.7,-12.6,1],[-10.4,-12.55,0],[-25.4,-28.4,3],[26.18,-27.7,2],
  [25.7,22.8,1],[23.45,28.1,3],[19.4,26.04,0],[15.18,24.08,0],[6.83,26.1,2],[-9.92,29,3],[-14.48,25.0,0],
  [20.6,18.1,3],[23.76,23.62,1],[26.9,26.2,3],[25.9,14.6,2],[14.1,16.25,2],[11.35,25.05,0],
  [8.5,19.4,1],[3.25,26.25,2],[-4.95,22.8,1],[-11.6,21.35,0],[-3.03,26.78,0],
]) {
  for(let k=0;k<3;k++) {
    const a=k*2.399+z, px=x+Math.sin(a)*.63, pz=z+Math.cos(a)*.65;
    if(paved.some(p=>within(px,pz,p,.32))||besideTrail(px,pz,.46))continue;
    shrubs.push({x:px,z:pz,w:.72+k*.12,d:.78,height:.32+k*.13,palette:hue,y:0});
  }
}
function within(x:number,z:number,area:GroundArea,padding=0) {
  return Math.abs(x-area.x)<area.w/2+padding && Math.abs(z-area.z)<area.d/2+padding;
}
const canPlantOnGround = (x:number,z:number) =>
  !besideTrail(x,z,.17) && !paved.some(p=>within(x,z,p,.08)) && !inDistrictPond(districtPoint({x,z}));

const plots: GroundPatch[] = [
  {x:-9,z:-3.8,w:17,d:14,ink:[154,183,114],opacity:.60},
  {x:23,z:-3,w:14,d:27,ink:[103,158,103],opacity:.69},
  {x:17.5,z:20,w:24,d:25,ink:[155,179,101],opacity:.59},
  {x:-7.0,z:12,w:19,d:11,ink:[127,162,103],opacity:.49},
  {x:-18,z:16,w:9,d:36,ink:[134,169,110],opacity:.76},
  ...NEIGHBOR_HOMES.map(home=>({x:home.x,z:home.z+home.depth*.53,w:home.width+4,d:11,
    ink:[148,185,119] as GroundPatch['ink'],opacity:.63,border:true})),
];
const flowerInk: GroundPatch['ink'][] = [[223,211,151],[196,132,150],[158,143,189],[214,150,101]];
export const districtGroundPatches: GroundPatch[] = [
  ...plots,
  {x:DISTRICT_POND.x,z:DISTRICT_POND.z,w:DISTRICT_POND.radiusX*2.45,d:DISTRICT_POND.radiusZ*2.48,
    ink:[107,115,91],opacity:.63,border:true},
  ...DISTRICT_TREES.map(([x,z,kind,size])=>({x:x+.19,z:z+.16,w:size*2.54,d:size*1.99,
    ink:(kind==='maple'?[143,116,66]:[57,93,61]) as GroundPatch['ink'],opacity:.42,border:true})),
  ...gardens.filter(g=>g.y<.1).map(g=>({x:g.x,z:g.z,w:g.w*1.36,d:g.d*1.39,
    ink:[129,112,82] as GroundPatch['ink'],opacity:.44,border:true, flecks:flowerInk[g.palette]})),
  ...shrubs.filter(s=>s.y<.05).map(s=>({x:s.x,z:s.z,w:s.w*1.34,d:s.d*1.22,
    ink:[55,98,59] as GroundPatch['ink'],opacity:.41,border:true})),
];

interface Sector {
  x:number;z:number;trees:PlantBatch;distantTrees:PlantBatch;beds:PlantBatch;distantBeds:PlantBatch;grass:GrassTuft[];
}
export function buildDistrictPlants(root:THREE.Group, materialPool:THREE.Material[]) {
  const sectors=new Map<string,Sector>();
  function sector(x:number,z:number) {
    const col=Math.floor(x/11),row=Math.floor(z/11),key=col+'/'+row;
    let group=sectors.get(key);
    if(!group) {
      group={x:col*11+5.5,z:row*11+5.5,trees:new PlantBatch(),distantTrees:new PlantBatch(),
        beds:new PlantBatch(),distantBeds:new PlantBatch(),grass:[]};
      sectors.set(key,group);
    }
    return group;
  }
  for (const [i,[x,z,type,size]] of DISTRICT_TREES.entries()) {
    const {trees,distantTrees}=sector(x,z);
    growTree(trees,x,z,type,size,942+i*907);
    growTree(distantTrees,x,z,type,size,942+i*907,true);
  }
  for (const [i,g] of gardens.entries()) {
    const {beds,distantBeds}=sector(g.x,g.z);
    const edge=i<publicGardens.length?.22:0;
    const args=[g.x,g.y,g.z,g.w-edge,Math.max(.21,g.d-edge),g.palette,g.count,i*875+43] as const;
    const allowed=g.y<.1?canPlantOnGround:undefined;
    growFlowers(beds,...args,false,allowed);
    growFlowers(distantBeds,...args,true,allowed);
  }
  for (const [i,s] of shrubs.entries()) {
    const {beds,distantBeds}=sector(s.x,s.z);
    const args=[s.x,s.y,s.z,s.w,s.height,s.d,s.palette,32+i*19] as const;
    growShrub(beds,...args);
    growShrub(distantBeds,...args,true);
  }

  const random=landscapeRandom(71997);
  const countryside=[
    {x:22,z:-3,w:13,d:26},{x:18,z:19,w:25,d:24},{x:0,z:10,w:29,d:10},
    {x:-4,z:-12,w:24,d:5},{x:0,z:-20,w:50,d:7},{x:-14,z:18,w:6,d:22},
  ];
  function addGrass(x:number,z:number,large:boolean) {
    if(!pointIsClear({x,z},DISTRICT_OBSTACLES,DISTRICT_FLOOR)||paved.some(p=>within(x,z,p,.26))||besideTrail(x,z,.23))return;
    if (NEIGHBOR_HOMES.some(home=>{
      const {gate,sidewalk}=homeStops(home);
      return Math.abs(x-gate.x)<.74 && z>home.z+home.depth/2 && z<sidewalk.z+.22;
    }))return;
    if (gardens.some(g=>g.y<.1&&within(x,z,g,.12)))return;
    sector(x,z).grass.push({x,z,size:large?.62+random()*.76:.42+random()*.55,
      yaw:random()*Math.PI*2,color:[0x83ad61,0x729f59,0xa6b873,0x668f60][Math.floor(random()*4)]});
  }
  for(let i=0;i<625;i++) {
    const group=countryside[i%countryside.length];
    addGrass(group.x+(random()-.5)*group.w,group.z+(random()-.5)*group.d,i%4===0);
  }
  for(let i=0;i<275;i++) addGrass((random()-.5)*55,(random()-.5)*60,i%5===0);

  const {material,wind}=grassMaterial();
  materialPool.push(material);
  const layers=[...sectors.values()].map(data=>{
    const trees=new THREE.Group(),distantTrees=new THREE.Group(),beds=new THREE.Group(),
      distantBeds=new THREE.Group(),tufts=new THREE.Group();
    data.trees.attach(trees,'Tree crowns, branches and bark');
    data.distantTrees.attach(distantTrees,'Distant tree crowns');
    data.beds.attach(beds,'Flowerbeds and shrubs');
    data.distantBeds.attach(distantBeds,'Distant flowerbeds and shrubs');
    addTufts(tufts,data.grass,material);
    root.add(trees,distantTrees,beds,distantBeds,tufts);
    distantTrees.visible=distantBeds.visible=false;
    return {x:data.x,z:data.z,trees,distantTrees,beds,distantBeds,tufts};
  });

  return (camera:THREE.Vector3,compactLow:boolean,seconds:number)=>{
    wind.value=seconds;
    const bias=compactLow?4:0;
    for(const l of layers) {
      const distance=Math.hypot(camera.x-l.x,camera.z-l.z,camera.y*.77);
      // Keep foliage silhouettes on the overview. Lawn paint carries the
      // flower color once a garden is too far away to make out individual buds.
      l.distantTrees.visible=distance>(l.distantTrees.visible?22:24)-bias;
      l.trees.visible=!l.distantTrees.visible;
      l.beds.visible=distance<(l.beds.visible?20:18)-bias;
      l.distantBeds.visible=!l.beds.visible && distance<(l.distantBeds.visible?43:40)-bias;
      l.tufts.visible=distance<(l.tufts.visible?23:21)-bias;
    }
  };
}
