import * as THREE from 'three';
import type {CharacterId} from '../shared/protocol';

type Region='face'|'eyes'|'trim'|'hair';
const cache=new WeakMap<THREE.BufferGeometry,Map<string,THREE.BufferGeometry>>();
const bell=(x:number)=>Math.exp(-x*x);
const smooth=THREE.MathUtils.smoothstep;

/** Refine only the authored head surfaces. All positions remain in the
 * original bind coordinate system; eye pivots, skeleton and clothing stay fixed.
 * The same warp is applied to the open face, closed eyelid and smile targets. */
export function refineResidentGeometry(source:THREE.BufferGeometry,id:CharacterId,region:Region){
 const key=id+':'+region;let variants=cache.get(source);if(!variants){variants=new Map();cache.set(source,variants);}
 const cached=variants.get(key);if(cached)return cached;
 const female=id==='alina',h=female?1.724:1.778,cx=female?.060:.059;
 function warp(x:number,y:number,z:number):[number,number,number]{
  const local=y-h,side=x<0?-1:1,ax=Math.abs(x);
  if(region==='hair'){
   if(female){
    const length=1-smooth(local,-.37,-.05),crown=bell((local-.12)/.15),front=smooth(z,-.08,.11);
    // Lift the crown and give the lower silhouette soft, rounded locks.
    x=x*(1+.095*crown+.055*length)+side*.018*length*Math.sin(local*19+z*7);
    z=z+.022*length*front+.012*crown*Math.sign(z+.025);
    y=y+.018*crown+.012*length*Math.cos(x*28);
   }else{
    const crest=bell((local-.19)/.11)*smooth(z,-.12,.08);
    y+=.018*crest;z+=.012*crest;x-=.008*crest;
   }
   return [x,y,z];
  }
  const front=smooth(z,.045,.085);
  const eyeRegion=region==='eyes'?1:bell((local)/.049)*bell((ax-cx)/.064)*front;
  // Increase aperture about its original center, not the eye bone.
  const eyeX=(ax-cx)*(female?.12:.065)*eyeRegion;
  const eyeY=local*(female?.27:.12)*eyeRegion;
  x+=side*eyeX;y+=eyeY;
  if(region==='face'){
   const jaw=bell((local+.145)/.055)*smooth(ax,.02,.11);
   x*=1-(female?.095:.035)*jaw;
   y+=.009*bell((local+.197)/.036);
   // Keep nose, lips and head topology while softening the profile.
   z-= (female?.009:.004)*bell(x/.030)*bell((local+(female?.054:.063))/.027)*front;
   const mouth=bell(x/.061)*bell((local+(female?.112:.121))/.027)*front;
   x*=1+(female?.045:.015)*mouth;
   z+=.003*mouth;
  }
  return [x,y,z];
 }
 const g=source.clone(),p=g.getAttribute('position'),original=source.getAttribute('position');
 const targets=g.morphAttributes.position??[];
 for(let i=0;i<p.count;i++){
  const x=original.getX(i),y=original.getY(i),z=original.getZ(i),q=warp(x,y,z);
  p.setXYZ(i,...q);
  for(const target of targets){
   const relative=g.morphTargetsRelative;
   const t=warp(target.getX(i)+(relative?x:0),target.getY(i)+(relative?y:0),target.getZ(i)+(relative?z:0));
   target.setXYZ(i,t[0]-(relative?q[0]:0),t[1]-(relative?q[1]:0),t[2]-(relative?q[2]:0));
  }
 }
 p.needsUpdate=true;for(const t of targets)t.needsUpdate=true;
 // Retain the authored seam normals on face and eyelids; displacements are small.
 g.computeBoundingBox();g.computeBoundingSphere();variants.set(key,g);return g;
}
