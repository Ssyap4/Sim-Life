import * as THREE from 'three';

const fork = [18.8,14.3];
const paths = [
  [[14.30,7.30],[16.60,9.32],[17.70,11.92],fork],
  [fork,[18.2,17.45],[16.86,20.59],[17.90,24.32],[21.20,26.55],[24.66,25.85],
    [26.05,22.33],[25.13,18.41],[22.52,15.58],fork],
] as const;

export const trailWidth = 1.17;
const curves = paths.map(points=>new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z))));
const samples = curves.map(curve=>curve.getPoints(Math.ceil(curve.getLength() * 3.5)));

export function besideTrail(x:number,z:number,padding:number) {
  const radius = trailWidth/2+padding;
  return samples.some(points=>points.some(p=>(x-p.x)**2+(z-p.z)**2<radius*radius));
}

export function districtTrailGeometry() {
  const path = new THREE.BufferGeometry();
  const positions: number[] = [], uv: number[] = [], indices: number[] = [], colors: number[] = [];
  const sections=[-1,-.91,-.68,.68,.91,1];
  for(const [branch,points] of samples.entries()) {
    let distance = 0;
    for(const [i,p] of points.entries()) {
      const prev = points[Math.max(0,i-1)], next = points[Math.min(points.length-1,i+1)];
      const direction = next.clone().sub(prev).normalize();
      if (i) distance += p.distanceTo(prev);
      const index = positions.length/3;
      for (const [j,t] of sections.entries()) {
        // Small edge wander and subtle variation of paving shades, so the
        // loop no longer looks like an identical asphalt ribbon.
        const noise=Math.sin(i*2.1+branch*11)*.038+
          Math.sin(i*.43+branch*17)*.027;
        const side=(trailWidth*t/2)+(Math.abs(t)>.90?Math.sign(t)*noise:0);
        positions.push(p.x-direction.z*side,.011+branch*.0006+.003*(1-t*t),p.z+direction.x*side);
        uv.push((1+t)*trailWidth*.58,distance*(.68+(branch%2)*.09));
        const grain=.93+.065*Math.sin(i*1.93+j*2.14+branch*3.1);
        const edge=(j===0||j===sections.length-1)?.76:(Math.abs(t)>.8?.88:1);
        colors.push(grain*edge,grain*edge*.986,grain*edge*.953);
        if (i && j) indices.push(index+j-1,index+j-sections.length-1,index+j,
          index+j,index+j-sections.length-1,index+j-sections.length);
      }
    }
  }
  path.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  path.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  path.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  path.setIndex(indices);
  path.computeVertexNormals();
  return path;
}

/** Decorative loose gravel along the walk shoulders. Baked into ONE mesh:
 * no particles, shaders or collision rectangles on the walk. */
export function districtTrailGravelGeometry():THREE.BufferGeometry {
  const positions:number[]=[],colors:number[]=[];
  const tint=[[.66,.59,.49],[.83,.76,.66],[.72,.68,.61],[.91,.85,.74]];
  for(const [branch,points] of samples.entries())for(let i=3;i<points.length-3;i+=2){
    const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(i+1,points.length-1)];
    const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz)||1;
    const nx=-dz/dist,nz=dx/dist;
    for(const side of [-1,1]) {
      const j=(i+branch*13+(side===1?4:1))%4;
      const offset=side*(trailWidth*.54+.055+(Math.sin(i*7.13+side)*.5+.5)*.15);
      const cx=p.x+nx*offset,cz=p.z+nz*offset;
      const radius=.028+.040*((Math.sin(i*3.75+branch)+1)*.5);
      const y=.015;
      const triangle=[
        cx-radius,y,cz-radius*.48,cx+radius*.74,y+.007,cz-radius*.24,
        cx+radius*.32,y,cz+radius*.79,
      ];
      positions.push(...triangle);
      for(let v=0;v<3;v++)colors.push(...tint[j]);
    }
  }
  const mesh=new THREE.BufferGeometry();
  mesh.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  mesh.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  mesh.computeVertexNormals();
  return mesh;
}
