import type {GameState} from './protocol';
import {FURNITURE_BY_ID,type PlacedFurniture} from './furniture';
import {isSurfaceDevice} from './consoleCatalog';
import {speakerSurfaces,speakerMountAt} from './speakerPlacement';
import {checkFurniturePlacement} from './furnishingPlacement';
import {roomById,type RoomId} from './renovation';
export type LampSpot={x:number;z:number;y:number;label:string};
export function renovationLampSpots(s:GameState,room:RoomId,sku:string,max=3):LampSpot[]{
 const r=roomById(room),p=FURNITURE_BY_ID.get(sku);if(!r||p?.shape!=='lamp'||['bathroom','wc'].includes(room))return [];
 const out:LampSpot[]=[];const contains=(x:number,z:number)=>x>=r.x1&&x<=r.x2&&z>=r.z1&&z<=r.z2;
 const round=(n:number)=>Math.round(n*100)/100;
 const accept=(x:number,z:number,label:string)=>{if(out.length>=max||!contains(x,z))return;const c:PlacedFurniture={id:s.furnishing.nextId,sku,finish:'oak',x:round(x),z:round(z),rotation:0};if(out.some(p=>Math.hypot(p.x-c.x,p.z-c.z)<.15)||!checkFurniturePlacement(s,c).valid)return;const mount=speakerMountAt(s.furnishing,c);out.push({x:c.x,z:c.z,y:mount?.y??0,label:mount?.label??label});};
 if(isSurfaceDevice(sku)){for(const f of speakerSurfaces(s.furnishing)){const a=f.rotation*Math.PI/2;for(const dx of [0,-.12,.12])accept(f.x+(f.u+dx)*Math.cos(a)+f.v*Math.sin(a),f.z-(f.u+dx)*Math.sin(a)+f.v*Math.cos(a),f.label);}return out;}
 const x1=r.x1+p.width/2+.24,x2=r.x2-p.width/2-.24,z1=r.z1+p.depth/2+.24,z2=r.z2-p.depth/2-.24;
 for(const [x,z] of [[x1,z1],[x2,z1],[x1,z2],[x2,z2],[(x1+x2)/2,z1],[(x1+x2)/2,z2],[x1,(z1+z2)/2],[x2,(z1+z2)/2]])accept(x,z,'Свободное место '+(out.length+1));
 return out;
}
