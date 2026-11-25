import {FURNITURE_BY_ID,workstationLayout,type FurnishingState,type PlacedFurniture} from './furniture';
import {HOME_PLACEMENTS,DINING_TOP} from './home';
import {isSurfaceDevice,isConsoleSku} from './consoleCatalog';
export type SpeakerMount={support:string;u:number;v:number};
export type Surface={id:string;label:string;x:number;z:number;y:number;rotation:number;u:number;v:number;w:number;d:number};
const round=(n:number)=>Math.round(n*100)/100;
function world(s:Surface,u:number,v:number){const a=s.rotation*Math.PI/2;return {x:round(s.x+u*Math.cos(a)+v*Math.sin(a)),z:round(s.z-u*Math.sin(a)+v*Math.cos(a))};}
function local(s:Surface,x:number,z:number){const a=s.rotation*Math.PI/2,dx=x-s.x,dz=z-s.z;return {u:round(dx*Math.cos(a)-dz*Math.sin(a)),v:round(dx*Math.sin(a)+dz*Math.cos(a))};}
export function speakerSurfaces(f:FurnishingState):Surface[]{
 const out:Surface[]=[];
 const add=(id:string,label:string,x:number,z:number,y:number,rotation:number,u:number,v:number,w:number,d:number)=>{if(w>=.23&&d>=.23)out.push({id,label,x,z,y,rotation,u,v,w,d});};
 const starter=(id:'table'|'desk',label:string,y:number,u:number,v:number,w:number,d:number)=>{if(!f.soldFixtures?.includes(id)){const p=HOME_PLACEMENTS[id];add('static:'+id,label,p.x,p.z,y,0,u,v,w,d);}};
 // Existing lamps fill the original bedside tables. TV, cooking and dish anchors are reserved.
 starter('table','Обеденный стол',DINING_TOP,0,.36,.48,.36);
 const vanity=HOME_PLACEMENTS.vanity;add('static:vanity','Туалетный столик',vanity.x,vanity.z,.915,1,.43,0,.36,.50);
 // Dedicated open equipment bays underneath the television.
 const tv=HOME_PLACEMENTS.tv;for(const x of [-.60,.60])add('static:tv:'+x,'Полка ТВ-тумбы',tv.x,tv.z,.247,0,x,.04,.50,.40);
 // The fixed desk already has a lamp, mug, notebook and PC: no safe free patch.
 // Rightmost counter section is used by sink/dishes; reserve the entire worktop.
 // Purchased surfaces have explicit free patches, never generic bounding-box tops.
 for(const p of f.placed){
  const m=FURNITURE_BY_ID.get(p.sku);if(!m||isSurfaceDevice(p.sku))continue;
  const id='item:'+p.id,slot=(y:number,u:number,v:number,w:number,d:number,suffix='')=>add(id+suffix,m.name,p.x,p.z,y+.01,p.rotation,u,v,w,d);
  const {width:w,depth:d,height:h}=m;
  if(m.shape==='nightstand'||m.shape==='dresser'&&p.sku!=='dresser-industrial')slot(Math.min(h,h*.96+.0275),0,0,w-.035,d-.035);
  else if(m.shape==='sideboard')slot(Math.min(h,h*.94+.03),0,0,w*.96-.035,d*.92-.035);
  else if(m.shape==='desk'){
   const layout=workstationLayout(p.sku);
   if(layout){const dep=Math.min(d-.58,.76),side=(w*.96-.96)/2;
    for(const sign of [-1,1])slot(.76,sign*(.48+side/2),-.24+.055,side-.04,dep-.18,sign<0?':left':':right');
   }else if(p.sku==='desk-large'||p.sku==='desk-simple'){
    const side=(w*.97-.96)/2;for(const sign of [-1,1])slot(Math.min(h,h*.91+(p.sku==='desk-large'?.05:.0375)),sign*(.48+side/2),0,side-.04,d*.94-.035,sign<0?':left':':right');
   }
  }else if(m.shape==='table'){
   if(p.sku==='table-nest')slot(h,-.23,-.05,.46,.40);
   else if(p.sku==='table-pebble'||p.sku==='table-coffee')continue; // curved tops lack a flat stable support
   else {
    const elliptical=['table-duet','table-silk','table-round','table-oval'].includes(p.sku);
    const y=p.sku==='table-round'?h*.89+.0325:p.sku==='table-oval'?h*.89+.0375:p.sku==='table-industrial'?h*.90+.045:p.sku==='table-glass'?h*.92+.0205:p.sku==='table-family'?h*.91+.0425:h;
    // Keep food and dirty dish positions free: reserve center and seating ends.
    if(h>=.63){const edge=d*(elliptical?.27:.32);slot(y,0,edge,w*(elliptical?.40:.30),d*(elliptical?.34:.30),':edge');}
    else slot(y,0,0,w*(elliptical?.65:.92),d*(elliptical?.65:.92));
   }
  }
 }

 return out;
}
function fits(s:Surface,p:PlacedFurniture,u:number,v:number){
 const m=FURNITURE_BY_ID.get(p.sku)!;const swap=(p.rotation-s.rotation+4)%2!==0;
 const hw=(swap?m.depth:m.width)/2+.012,hd=(swap?m.width:m.depth)/2+.012;
 return Math.abs(u-s.u)+hw<=s.w/2+1e-6&&Math.abs(v-s.v)+hd<=s.d/2+1e-6;
}
export function speakerMountAt(f:FurnishingState,p:PlacedFurniture):{mount:SpeakerMount;y:number;label:string}|null{
 if(!isSurfaceDevice(p.sku))return null;
 for(const s of speakerSurfaces(f)){
  const {u,v}=local(s,p.x,p.z);
  if(s.id.startsWith('static:tv:')&&!isConsoleSku(p.sku))continue;
  if(!fits(s,p,u,v))continue;
  const host=s.id.startsWith('item:')?f.placed.find(it=>it.id===Number(s.id.split(':')[1])):undefined;
  const hm=host&&FURNITURE_BY_ID.get(host.sku);
  if(host&&hm?.shape==='table'&&hm.height>=.63&&f.placed.some(ch=>{const cm=FURNITURE_BY_ID.get(ch.sku);if(!cm||!['chair','stool','armchair','bench','ottoman'].includes(cm.shape)||Math.hypot(ch.x-host.x,ch.z-host.z)>Math.max(1.35,hm.width/2+1.1))return false;const q=local(s,ch.x,ch.z);const cx=Math.max(-hm.width/2+Math.min(.23,hm.width*.23),Math.min(hm.width/2-Math.min(.23,hm.width*.23),q.u*.64)),cz=Math.max(-hm.depth/2+Math.min(.23,hm.depth*.23),Math.min(hm.depth/2-Math.min(.23,hm.depth*.23),q.v*.64));return Math.hypot(cx-u,cz-v)<.34;}))continue;
  if(f.placed.some(other=>other.id!==p.id&&isSurfaceDevice(other.sku)&&Math.abs(other.x-p.x)<(FURNITURE_BY_ID.get(other.sku)!.width+FURNITURE_BY_ID.get(p.sku)!.width)/2+.035&&Math.abs(other.z-p.z)<(FURNITURE_BY_ID.get(other.sku)!.depth+FURNITURE_BY_ID.get(p.sku)!.depth)/2+.035))continue;
  return {mount:{support:s.id,u,v},y:s.y,label:s.label};
 }
 return null;
}
export function snapSpeaker(f:FurnishingState,p:PlacedFurniture):PlacedFurniture{
 let best=p,distance=.32;
 for(const s of speakerSurfaces(f)){
  const q=local(s,p.x,p.z),m=FURNITURE_BY_ID.get(p.sku)!;
  const swap=(p.rotation-s.rotation+4)%2!==0,hw=(swap?m.depth:m.width)/2+.02,hd=(swap?m.width:m.depth)/2+.02;
  if(s.w<2*hw||s.d<2*hd)continue;
  const u=Math.max(s.u-s.w/2+hw,Math.min(s.u+s.w/2-hw,q.u)),v=Math.max(s.v-s.d/2+hd,Math.min(s.v+s.d/2-hd,q.v));
  const pos=world(s,u,v),candidate={...p,...pos},dist=Math.hypot(pos.x-p.x,pos.z-p.z);
  if(dist<distance&&speakerMountAt(f,candidate)){best=candidate;distance=dist;}
 }
 return best;
}
export function speakerHeight(f:FurnishingState,p:PlacedFurniture){return speakerMountAt(f,p)?.y??null;}
export function supportOccupied(f:FurnishingState,id:string){return f.placed.some(p=>isSurfaceDevice(p.sku)&&p.mount&&(p.mount.support===id||p.mount.support.startsWith(id+':')));}
export function migrateSpeakerMounts(f:FurnishingState){
 let changed=false;
 for(const p of [...f.placed]){
  if(!isSurfaceDevice(p.sku))continue;
  const found=speakerMountAt(f,p);
  if(found){if(JSON.stringify(p.mount)!==JSON.stringify(found.mount)){p.mount=found.mount;changed=true;}}
  else{f.placed=f.placed.filter(x=>x.id!==p.id);f.stored.push({id:p.id,sku:p.sku,finish:p.finish});changed=true;}
 }
 return changed;
}
