import * as THREE from 'three';
import { batchRigidParts, colors as C, cube, finish, plane, torus, type XYZ } from './ArtKit';
import { lettering, painted, part, round, trim, type LocationResources } from './LocationArt';
import { DISTRICT_FOUNTAIN, DISTRICT_FLOOR, DISTRICT_PLAZA, DISTRICT_PATHS, DISTRICT_SITES,
  DISTRICT_BEDS, DISTRICT_LAMPS, districtStation, districtYaw, sitePoint } from '../shared/district';
import { buildDistrictFacade, distantDistrictFacade } from './DistrictBuildings';
import { buildDistrictPlants, districtPlantGeometry } from './DistrictPlants';
import { NEIGHBOR_HOMES } from '../shared/neighborHomes';
import { buildNeighborhood } from './NeighborhoodArt';

export { districtPlantGeometry };

function planeSurface(root:THREE.Group,resources:LocationResources,texture:THREE.Texture|null,
  x:number,z:number,w:number,d:number,y:number,fallback:number,repeat=1) {
  const material=new THREE.MeshStandardMaterial({map:texture,color:texture?0xffffff:fallback,roughness:.95});
  resources.materials.push(material);
  const geometry=plane.clone();
  const uv=geometry.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w*repeat,uv.getY(i)*d*repeat);
  const model=new THREE.Mesh(geometry,material);
  model.rotation.x=-Math.PI/2;model.position.set(x,y,z);model.scale.set(w,d,1);
  root.add(model);
}

function gardenPaint(resources:LocationResources) {
  const turf=painted(resources,256,256,ctx=>{
    ctx.fillStyle='#94a574';ctx.fillRect(0,0,256,256);
    let seed=719777;
    for(let i=0;i<4000;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const x=seed%256,z=(seed>>>9)%256;
      ctx.fillStyle=['#aaba8666','#657e4866','#d3b77938','#51724d45','#b0b37450'][i%5];
      ctx.fillRect(x,z,1+i%3,1+(i%4));
    }
    for(let i=0;i<900;i++){
      const x=(i*71)%256,y=(i*179+i*i)%256;
      ctx.strokeStyle=i%2?'#7d936a90':'#c1bb8390';
      ctx.beginPath();ctx.moveTo(x,y+3);ctx.lineTo(x+i%3-1,y);ctx.stroke();
    }
  });
  if(turf)turf.wrapS=turf.wrapT=THREE.RepeatWrapping;
  const stone=painted(resources,256,256,ctx=>{
    ctx.fillStyle='#a7977f';ctx.fillRect(0,0,256,256);
    const shades=['#c6b296','#cfbea0','#b5a38d','#d9c5a9','#c8bba6','#baa88b','#bda98d'];
    for(let y=0;y<8;y++)for(let x=-1;x<7;x++){
      const l=x*43+(y%2)*22,t=y*32;
      ctx.fillStyle=shades[(x*7+y*5+x*y+71)%shades.length];
      ctx.beginPath();ctx.roundRect(l+1,t+1,41,30,2);ctx.fill();
      ctx.fillStyle='#eddbc059';ctx.fillRect(l+4,t+4,34,2);
    }
    for(let n=0;n<1400;n++){
      ctx.fillStyle=n%2?'#907b6251':'#f7dec052';
      ctx.fillRect((n*43+n*n)%256,(n*71+n*n*3)%256,1,1);
    }
  });
  if(stone)stone.wrapS=stone.wrapT=THREE.RepeatWrapping;
  return {turf,stone};
}

function landscaping(root:THREE.Group,resources:LocationResources) {
  const {turf,stone}=gardenPaint(resources);
  const {minX,maxX,minZ,maxZ}=DISTRICT_FLOOR;
  const w=maxX-minX+1.7,d=maxZ-minZ+1.7,z=(minZ+maxZ)/2;
  trim(root,[w+.7,.49,d+.7],[0,-.29,z],0x736853);
  trim(root,[w+.32,.15,d+.28],[0,-.14,z],0x998965);
  planeSurface(root,resources,turf,0,z,w,d,-.002,0x879463,.26);
  for(const [x,z,w,d,color] of [[-7,-11,9.1,4.1,0x92a17a],[18,3,10,4,0x879572],
    [-14,-13,6.2,3.6,0x8f9b72],[2,9.1,13.2,3.4,0x919d77],[-15,9.15,4.4,2.1,0x8fa67e]]) {
    const grass=new THREE.Mesh(new THREE.CircleGeometry(1,20),finish(color,'fabric'));
    grass.rotation.x=-Math.PI/2; grass.scale.set(w/2,d/2,1);grass.position.set(x,.001,z);root.add(grass);
  }
  let stoneLayer=.012;
  function path(x:number,z:number,w:number,d:number,wide=false) {
    part(root,[w+.231,.055,d+.231],[x,-.02,z],0xa49a80,cube,'ceramic');
    part(root,[w+.11,.041,d+.11],[x,-.012,z],0xcec0a3,cube,'ceramic');
    stoneLayer+=.0005;
    planeSurface(root,resources,stone,x,z,w,d,wide?.022:stoneLayer,0xc6b394,wide?.42:.58);
    if(wide){
      part(root,[w-.27,.026,.056],[x,.028,z-d/2+.24],0xe2d3b6,cube,'ceramic');
      part(root,[w-.27,.026,.056],[x,.028,z+d/2-.24],0xe2d3b6,cube,'ceramic');
      for(const side of [-1,1])part(root,[.058,.028,d-.46],[x+side*(w/2-.24),.028,z],0xe2d3b6,cube,'ceramic');
    }
  }
  for(const p of DISTRICT_PATHS)path(p.x,p.z,p.w,p.d);
  path(DISTRICT_PLAZA.x,DISTRICT_PLAZA.z,DISTRICT_PLAZA.w,DISTRICT_PLAZA.d,true);
  for(const site of DISTRICT_SITES) {
    if(site.place==='home')continue;
    const porch=sitePoint(site,0,site.d/2+.86);
    path(porch.x,porch.z,Math.abs(site.turn)%2?2.4:2.2,Math.abs(site.turn)%2?2.2:2.46);
  }
  for(const bed of DISTRICT_BEDS){
    trim(root,[bed.w,.18,bed.d],[bed.x,.076,bed.z],0xa28c6e);
    trim(root,[bed.w-.14,.075,bed.d-.12],[bed.x,.17,bed.z],0x766b50);
    for(const edge of [-1,1])part(root,[bed.w-.08,.048,.065],[bed.x,.172,bed.z+edge*(bed.d/2-.016)],0xc2ad88,cube,'ceramic');
  }
  for(const [x,z] of [[-15.7,-6],[-5.4,1.8],[5.3,-10.9],[17.4,4.0],[10.7,8.8],[-25.8,3.4],[-23.4,-19.0]]){
    for(let i=0;i<4;i++){
      const stone=trim(root,[.18+i*.12,.106+i*.04,.20+i*.087],[x+Math.sin(i*2.4)*.54,.043+i*.023,z+Math.cos(i*2.4)*.56],
        [0xa2977f,0x8e8870,0xb3a68a][i%3]);
      stone.rotation.y=i*.84;
    }
  }
}

function fixtures(root:THREE.Group,resources:LocationResources, bulb:THREE.MeshStandardMaterial) {
  const lightGeometry=new THREE.CylinderGeometry(.19,.12,.24,8,1,false);
  for(const [i,[x,z]] of DISTRICT_LAMPS.entries()){
    round(root,.224,.12,[x,.055,z],C.ink);
    round(root,.065,2.20,[x,1.09,z],C.ink);
    part(root,[.35,.041,.059],[x+.12,2.18,z],0x425855,cube,'metal');
    const glow=new THREE.Mesh(lightGeometry,bulb);
    glow.position.set(x+.23,2.06,z);
    root.add(glow);
    round(root,.21,.069,[x+.23,2.22,z],0x435754);
    round(root,.13,.036,[x+.23,1.94,z],0x435754);
    if (i%4===0){
      round(root,.19,.36,[x+.46,.19,z+.46],0x757d67);
      round(root,.195,.052,[x+.46,.39,z+.46],0x3f5a51);
    }
  }
  const cursor = new THREE.Vector3();
  for(const [x,z] of [[-16.19,1.7],[-2.38,-11.08],[12.24,6.21]]){
    round(root,.055,1.72,[x,.85,z],C.walnut);
    const signs=[['ПЛОЩАДЬ',-.18,1.60],['ПАРК',.21,1.33]] as const;
    for(const [name,dx,y] of signs)lettering(root,resources,cursor.set(x+dx,y,z+.07).toArray(),.96,.21,name,['#56726b','#fff1d5']);
  }
  // Low perimeter posts articulate the entrance gaps without closing routes.
  for(const x of [-25,-21,-17,-13,-8,-4,0,4,8,12,16,20,24])
    trim(root,[.11,.66,.11],[x,.31,-30.44],0xd2bf99);
  for(const side of [-1,1])for(const z of [-23,-18,-13,-8,-3,2,7,12])
    trim(root,[.11,.62,.11],[side*27.9,.30,z],0xc9b692);
}

function fountain(group: THREE.Group, resources: LocationResources) {
  const {x,z,radius}=DISTRICT_FOUNTAIN;
  round(group,radius,.135,[x,.073,z],0xc6b190);
  round(group,radius-.075,.21,[x,.231,z],0xdfcaae);
  round(group,radius-.13,.042,[x,.354,z],0x76a8a2);
  const rim=part(group,[radius-.16, radius-.16, .72],[x,.376,z],0xeedac0,torus);
  rim.rotation.x=-Math.PI/2;
  for(let i=0;i<10;i++) {
    const angle=i*Math.PI/5;
    part(group,[.037,.15,.068],[x+Math.sin(angle)*(radius-.062),.24,z+Math.cos(angle)*(radius-.062)],0xe7d3b6).rotation.y=angle;
  }
  round(group,.32,.14,[x,.392,z],0xdcbe9c);
  round(group,.15,.55,[x,.64,z],0xe6c9a7);
  const bowl=new THREE.CylinderGeometry(.56,.25,.18,20);
  part(group,[1,1,1],[x,.84,z],0xf0d5b0,bowl);
  round(group,.52,.04,[x,.94,z],0x91b8ac);
  round(group,.136,.115,[x,1,z],0xc49e74);

  const lines: number[]=[];
  for (let i=0;i<7;i++) {
    const angle=i*2*Math.PI/7;
    for(let j=0;j<8;j++){
      for(const n of [j,j+1]) {
        const u=n/8,r=.056+u*.437;
        lines.push(Math.cos(angle)*r,1.01+Math.sin(Math.PI*u)*.34-u*.05,Math.sin(angle)*r);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  const material = new THREE.LineBasicMaterial({color:0xc7e6dd,transparent:true,opacity:.78,depthWrite:false});
  resources.materials.push(material);
  const jets = new THREE.LineSegments(geometry,material);
  jets.name='Fountain streams';
  jets.position.set(x,0,z);
  group.add(jets);
  return (seconds: number) => {
    jets.rotation.y = seconds * .24;
    material.opacity = .76 + Math.sin(seconds * 3.2)*.12;
  };
}


export function buildDistrict(root:THREE.Group,resources:LocationResources) {
  const terrain=new THREE.Group();root.add(terrain);
  landscaping(terrain,resources);
  const lantern=new THREE.MeshStandardMaterial({color:0xe3caa2,emissive:0xffb763,emissiveIntensity:.04,roughness:.52});
  resources.materials.push(lantern);
  fixtures(terrain,resources,lantern);
  const cottageWindows=new THREE.MeshStandardMaterial({color:0xaac3bd,emissive:0xf4b67a,emissiveIntensity:0,roughness:.57});
  cottageWindows.userData.window=true;resources.materials.push(cottageWindows);
  const cottages=buildNeighborhood(terrain,cottageWindows);
  const distantCottages=NEIGHBOR_HOMES.map(home=>{
    const model=new THREE.Group();model.position.set(home.x,0,home.z);
    part(model,[home.width,2.68,home.depth],[0,1.34,0],home.plaster,cube,'ceramic');
    for(const side of [-1,1]){
      const angle=Math.atan2(.95,home.width/2);
      const roof=part(model,[Math.hypot(home.width/2,.95)+.25,.17,home.depth+.40],
        [side*home.width/4,3.16,0],home.roof,cube,'ceramic');
      roof.rotation.z=-side*angle;
      part(model,[1.02,.84,.09],[side*home.width*.29,1.56,home.depth/2+.06],0x92aaaa,cube,'ceramic');
    }
    part(model,[.94,1.71,.13],[0,.88,home.depth/2+.07],home.shutters,cube,'ceramic');
    batchRigidParts(model,true);
    terrain.add(model);model.visible=false;
    return {model,detail:cottages.getObjectByName('Фоновый дом · '+home.id)!};
  });
  const animateWater=fountain(terrain,resources);
  batchRigidParts(terrain,true);
  const animatePlants=buildDistrictPlants(terrain,resources.materials);
  const facades=DISTRICT_SITES.map(site=>{
    const building=new THREE.Group();building.name=site.name;
    building.position.set(site.x,0,site.z);building.rotation.y=districtYaw(site);
    const detail=buildDistrictFacade(site,resources,lantern);
    detail.position.set(0,0,0);detail.rotation.y=0;
    const model=distantDistrictFacade(site);model.visible=false;
    building.add(detail,model);
    return {id:districtStation(site.place),building,model,detail};
  });
  const entries=new Map(facades.map(({id,building})=>[id,building]));
  const bounds:XYZ[] = [[-27.5,0,13],[27.5,0,13],[-26,3,-29],[26,3,-29]];
  return {
    entries,bounds,
    setNight(night:boolean) {
      lantern.emissiveIntensity=night?1.00:.04;
      for(const material of resources.materials)if(material.userData.window&&material instanceof THREE.MeshStandardMaterial)
        material.emissiveIntensity=night?.39:0;
    },
    animate(seconds:number,camera?:THREE.Camera){
      animateWater(seconds);
      if(!camera)return;
      animatePlants(camera,seconds);
      for(const {building,detail,model} of facades){
        const bias=camera.userData.compactLow?6:0;
        const far=building.position.distanceTo(camera.position)>(model.visible?32-bias:35-bias);
        model.visible=far;detail.visible=!far;
      }
      for(const {model,detail} of distantCottages){
        const bias=camera.userData.compactLow?5:0;
        const far=model.position.distanceTo(camera.position)>(model.visible?32-bias:35-bias);
        model.visible=far;detail.visible=!far;
      }
    },
  };
}
