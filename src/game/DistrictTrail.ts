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
  const sections=[-1,-.80,.80,1];
  for(const [branch,points] of samples.entries()) {
    let distance = 0;
    for(const [i,p] of points.entries()) {
      const prev = points[Math.max(0,i-1)], next = points[Math.min(points.length-1,i+1)];
      const direction = next.clone().sub(prev).normalize();
      if (i) distance += p.distanceTo(prev);
      const index = positions.length/3;
      for (const [j,t] of sections.entries()) {
        const side=trailWidth*t/2;
        positions.push(p.x-direction.z*side,.010+branch*.0006+.003*(1-t*t),p.z+direction.x*side);
        uv.push((1+t)*trailWidth*.58,distance*.76);
        const base=(j===0||j===sections.length-1)?.72:1;
        colors.push(base,base*.995,base*.966);
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
