import * as THREE from 'three';
import { CAR_PARKING } from '../shared/locations';
import { batchRigidParts, cube, softCube, drum, finish } from './ArtKit';

type Point3=[number,number,number];
/** Black full-size 1999-style SUV. Sculpted continuous body, recessed arches,
 * four doors, three side windows, chrome five-spoke wheels. No roof equipment. */
export function buildFamilyCar():THREE.Group{
  const group=new THREE.Group();group.name='Семейный внедорожник';
  group.position.set(CAR_PARKING.x,0,CAR_PARKING.z);
  group.rotation.y=Math.PI;
  const paint=0x181a1e, shoulder=0x22262b, black=0x0c1013, rubber=0x242526,
    chrome=0xc5cbd1, silver=0x89939d, glass=0x58758a, rearGlass=0x293d4c;
  function part(w:number,h:number,d:number,x:number,y:number,z:number,color:number,geometry:THREE.BufferGeometry=softCube,surface:'metal'|'screen'|'fabric'='metal'){
    const m=new THREE.Mesh(geometry,finish(color,surface));m.scale.set(w,h,d);m.position.set(x,y,z);
    m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
  }
  function geometry(points:Point3[],indices:number[],color:number,surface:'metal'|'screen'|'fabric'='metal'){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(()=>[0,0]),2));
    g.setIndex(indices);g.computeVertexNormals();return part(1,1,1,0,0,0,color,g,surface);
  }
  function quad(a:Point3,b:Point3,c:Point3,d:Point3,color:number,surface:'metal'|'screen'|'fabric'='metal'){
    // Windows have an outward-facing winding and use the same opaque mobile material.
    return geometry([a,b,c,d],[0,1,2,0,2,3],color,surface);
  }
  // Loft a continuous chamfered shell, rather than placing a small box on a box.
  // Rings run from back to front, with the shoulders rounded in cross section.
  function loft(rings:Point3[][],color:number){
    const n=rings[0].length,points=rings.flat(),indices:number[]=[];
    for(let r=0;r<rings.length-1;r++)for(let j=0;j<n;j++){
      const a=r*n+j,b=r*n+(j+1)%n,c=a+n,d=b+n;
      indices.push(a,c,b,b,c,d);
    }
    for(let j=1;j<n-1;j++){indices.push(0,j,j+1);const f=(rings.length-1)*n;indices.push(f,f+j+1,f+j);}
    return geometry(points,indices,color);
  }
  const axles=[-1.53,1.53],wheelY=.432,wheelRadius=.43,archRadius=.525;
  const zs=[-2.37,-2.30,-2.17,-2.08,-.94,-.85,0,.85,.94,2.08,2.17,2.30,2.37];
  for(const a of axles)for(let i=0;i<=12;i++)zs.push(a+archRadius*Math.cos(Math.PI*i/12));
  const sections=[...new Set(zs)].sort((a,b)=>a-b);
  const archHeight=(z:number)=>{
    let y=.49;
    for(const a of axles){const delta=Math.abs(z-a);if(delta<archRadius)y=Math.max(y,wheelY+Math.sqrt(archRadius**2-delta**2));}
    return y;
  };
  // Lower sill/chassis stays narrow under the wheel wells; the outer body rises over the tyres.
  part(1.36,.22,4.33,0,.49,0,black);
  loft(sections.map(z=>{
    const end=Math.max(0,(Math.abs(z)-2.08)/.29), w=1.015-.075*end;
    const top=z>1.02?1.17-.08*Math.max(0,(z-1.55)/.82):1.19;
    const y=archHeight(z),bevel=Math.min(.065,(top-y)*.35);
    return [[-w+.09,y,z],[-w,y+bevel,z],[-w,top-.12,z],[-w+.08,top,z],
      [w-.08,top,z],[w,top-.12,z],[w,y+bevel,z],[w-.09,y,z]];
  }),paint);
  // Continuous cabin. The windshield leans rearwards and the tailgate is almost upright.
  const cabinBottom=1.16,cabinTop=1.94,roofX=.84,baseX=.965;
  const rearBottom=-2.24,rearTop=-2.05,frontBottom=1.03,frontTop=.48;
  const cabinRings:Point3[][]=[
    [[-baseX,cabinBottom,rearBottom],[-roofX,cabinTop-.09,rearTop],[-roofX+.065,cabinTop,rearTop+.045],[roofX-.065,cabinTop,rearTop+.045],[roofX,cabinTop-.09,rearTop],[baseX,cabinBottom,rearBottom]],
    [[-baseX,cabinBottom,-1.82],[-roofX,cabinTop-.09,-1.82],[-roofX+.065,cabinTop,-1.82],[roofX-.065,cabinTop,-1.82],[roofX,cabinTop-.09,-1.82],[baseX,cabinBottom,-1.82]],
    [[-baseX,cabinBottom,.45],[-roofX,cabinTop-.09,.45],[-roofX+.065,cabinTop,.45],[roofX-.065,cabinTop,.45],[roofX,cabinTop-.09,.45],[baseX,cabinBottom,.45]],
    [[-baseX,cabinBottom,frontBottom],[-roofX,cabinTop-.09,frontTop],[-roofX+.065,cabinTop,frontTop-(frontBottom-frontTop)*.09/(cabinTop-.09-cabinBottom)],[roofX-.065,cabinTop,frontTop-(frontBottom-frontTop)*.09/(cabinTop-.09-cabinBottom)],[roofX,cabinTop-.09,frontTop],[baseX,cabinBottom,frontBottom]],
  ];
  loft(cabinRings,paint);
  const bottomY=1.22,topY=1.825;
  const wx=(y:number)=>baseX+(roofX-baseX)*(y-cabinBottom)/(cabinTop-.09-cabinBottom)+.012;
  const frontZ=(y:number)=>frontBottom+(frontTop-frontBottom)*(y-cabinBottom)/(cabinTop-.09-cabinBottom)+.045;
  const rearZ=(y:number)=>rearBottom+(rearTop-rearBottom)*(y-cabinBottom)/(cabinTop-.09-cabinBottom)-.012;
  quad([-wx(bottomY)+.065,bottomY,frontZ(bottomY)],[wx(bottomY)-.065,bottomY,frontZ(bottomY)],
    [wx(topY)-.055,topY,frontZ(topY)],[-wx(topY)+.055,topY,frontZ(topY)],glass,'screen');
  quad([wx(bottomY)-.08,bottomY,rearZ(bottomY)],[-wx(bottomY)+.08,bottomY,rearZ(bottomY)],
    [-wx(topY)+.06,topY,rearZ(topY)],[wx(topY)-.06,topY,rearZ(topY)],rearGlass,'screen');
  for(const side of [-1,1]){
    // Side windows: front door, rear door, cargo quarter; visible B/C pillars.
    const panes=[[-2.08,-1.16,-1.99,-1.16],[-1.08,-.19,-1.08,-.19],[-.11,.88,-.11,.43]];
    for(const [lo,hi,loTop,hiTop] of panes){
      const p:Point3[]=[[side*wx(bottomY),bottomY,lo],[side*wx(bottomY),bottomY,hi],[side*wx(topY),topY,hiTop],[side*wx(topY),topY,loTop]];
      if(side>0)p.reverse();
      quad(p[0],p[1],p[2],p[3],lo< -1.1?rearGlass:glass,'screen');
    }
    // Real wheel arches, a narrow raised fender lip and dark wheel-well liner.
    for(const z of axles){
      const strip:Point3[]=[];const ix:number[]=[];
      for(let i=0;i<=14;i++){
        const a=Math.PI*i/14;
        for(const rad of [archRadius-.016,archRadius+.065])
          strip.push([side*1.026,wheelY+Math.sin(a)*rad,z+Math.cos(a)*rad]);
        if(i<14){const j=i*2;ix.push(...(side>0?[j,j+2,j+1,j+1,j+2,j+3]:[j,j+1,j+2,j+1,j+3,j+2]));}
      }
      geometry(strip,ix,shoulder);
      const tyre=part(wheelRadius,.285,wheelRadius,side*.889,wheelY,z,rubber,drum,'fabric');tyre.rotation.z=Math.PI/2;
      const rim=part(.264,.021,.264,side*1.038,wheelY,z,chrome,drum);rim.rotation.z=Math.PI/2;
      const inset=part(.222,.025,.222,side*1.05,wheelY,z,0x31363a,drum);inset.rotation.z=Math.PI/2;
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5+.22,spoke=part(.027,.185,.063,side*1.073,wheelY+Math.cos(a)*.135,z+Math.sin(a)*.135,chrome,cube);
        spoke.rotation.x=a;
      }
      const center=part(.080,.035,.080,side*1.075,wheelY,z,silver,drum);center.rotation.z=Math.PI/2;
    }
    // Door gaps, handles and chrome belt molding. Wheel wells stay open.
    for(const z of [-1.08,-.15,.90]){
      const y0=Math.max(.58,archHeight(z)+.02);
      part(.010,1.145-y0,.016,side*1.018,(1.145+y0)/2,z,black,cube);
    }
    for(const z of [-.91,.08]) {
      part(.027,.065,.22,side*1.024,1.075,z,black);
      part(.032,.026,.155,side*1.041,1.085,z,chrome);
    }
    part(.020,.035,3.98,side*1.014,1.105,-.12,silver,cube);
    part(.20,.10,1.83,side*.975,.43,0,black);
    part(.19,.021,1.75,side*1.005,.49,0,silver,cube);
    part(.14,.11,.18,side*1.01,1.27,.70,black);
    part(.23,.16,.30,side*1.10,1.32,.72,paint);
    part(.012,.10,.21,side*1.219,1.32,.72,glass,cube,'screen');
    // Rectangular stacked headlight modules, amber corners and lower fog lights.
    part(.43,.25,.07,side*.735,.98,2.324,black);
    part(.30,.135,.035,side*.69,1.025,2.37,0xdde4df);
    part(.30,.072,.035,side*.69,.906,2.372,0xb5bfc6);
    part(.095,.208,.042,side*.90,.967,2.35,0xe89c34);
    part(.23,.095,.045,side*.69,.59,2.413,0xe4e8dc);
    // Tall rear corner lenses rather than generic small horizontal tail lamps.
    part(.14,.37,.05,side*.865,1.00,-2.348,0x6f1e26);
    part(.115,.23,.055,side*.865,1.07,-2.376,0xc53333);
    part(.115,.085,.055,side*.865,.90,-2.376,0xe6cbb1);
  }
  // Distinct chrome rectangular grille and inset slats, no branding required.
  part(1.06,.37,.105,0,.98,2.345,chrome);
  part(.955,.284,.105,0,.98,2.39,black);
  for(let i=0;i<5;i++)part(.904,.013,.024,0,.867+i*.055,2.45,silver,cube);
  for(let i=0;i<7;i++)part(.012,.263,.023,-.402+i*.134,.98,2.451,silver,cube);
  part(.115,.15,.025,0,.98,2.466,chrome);
  part(1.97,.245,.21,0,.65,2.31,paint);
  part(1.87,.035,.15,0,.765,2.37,silver);
  part(1.96,.23,.18,0,.64,-2.29,paint);
  part(1.84,.036,.12,0,.75,-2.34,silver);
  part(.45,.125,.025,0,.66,-2.397,0xe6e7e0,cube);
  part(.45,.125,.025,0,.57,2.426,0xe6e7e0,cube);
  part(.55,.027,.025,0,1.15,-2.27,black,cube);
  batchRigidParts(group,true);
  return group;
}
