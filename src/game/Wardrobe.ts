import {LAKE_LOOKS} from '../shared/lake';
import { PREVIEW_LOOKS, outfitChoices, previewLongSleeves } from '../shared/previewWardrobe';
import * as THREE from 'three';
import type { Object3D } from 'three';
import {orb,finish} from './ArtKit';
import type { CharacterId } from '../shared/protocol';

export const GARMENT_SLOTS = ['upper','lower','footwear','outfit','accessory'] as const;
export type GarmentSlot = typeof GARMENT_SLOTS[number];
type BodyRegion = 'forearms';

export interface Garment {
  id: string;
  name: string;
  slot: GarmentSlot;
  fit: string;
  layers: readonly GarmentSlot[];
  covers?: readonly BodyRegion[];
}

export const WARDROBE_LOOKS = [...new Set([...PREVIEW_LOOKS.alina,...PREVIEW_LOOKS.vlad].map(([id])=>id))];
export type WardrobeLook = typeof WARDROBE_LOOKS[number];
export {outfitChoices} from '../shared/previewWardrobe';
const NEW_GARMENTS:Garment[]=(['alina','vlad'] as const).flatMap(id=>[
  ...PREVIEW_LOOKS[id].slice(1).flatMap(([look])=>[
    {id:id+'-'+look+'-upper',name:look,slot:'upper' as const,fit:id+'-021',layers:['upper'] as const,
     covers:previewLongSleeves(look)?['forearms'] as const:undefined},
    {id:id+'-'+look+'-lower',name:look,slot:'lower' as const,fit:id+'-021',layers:['lower'] as const},
    {id:id+'-'+look+'-footwear',name:look,slot:'footwear' as const,fit:id+'-021',layers:['footwear'] as const},
  ])]);
export const GARMENTS: readonly Garment[] = [
  ...NEW_GARMENTS,
  {id:'vlad-signature-upper', name:'Футболка Влада',slot:'upper',fit:'vlad-021',layers:['upper']},
  {id:'vlad-signature-lower', name:'Брюки Влада',slot:'lower',fit:'vlad-021',layers:['lower']},
  {id:'vlad-signature-footwear', name:'Кеды Влада',slot:'footwear',fit:'vlad-021',layers:['footwear']},
  {id:'alina-signature-upper', name:'Голубой жакет',slot:'upper',fit:'alina-021',layers:['upper'],covers:['forearms']},
  {id:'alina-signature-lower', name:'Брюки Алины',slot:'lower',fit:'alina-021',layers:['lower']},
  {id:'alina-signature-footwear', name:'Туфли Алины',slot:'footwear',fit:'alina-021',layers:['footwear']},
  {id:'alina-tee-upper', name:'Футболка Алины',slot:'upper',fit:'alina-021',layers:['upper']},
];

const lakeOriginals=new WeakMap<THREE.Mesh,THREE.BufferGeometry>();
function restoreLakePalette(model:Object3D){
 model.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const original=lakeOriginals.get(o);if(original){o.geometry.dispose();o.geometry=original;lakeOriginals.delete(o);}});
}
export function fitWardrobe(model:Object3D, character:CharacterId, choices:readonly string[] = []) {
  restoreLakePalette(model);
  const fit=character+'-021';
  const fitted=new Map<string,Garment>();
  for(const rule of GARMENTS)if(rule.fit===fit)fitted.set(rule.id,rule);
  const assets=new Map<string,{item:Garment; parts:Object3D[]; defaultFit:boolean}>();
  model.traverse(object=>{
    if(object.userData.spaFoot)object.visible=false;
    const {garmentId,garmentSlot,garmentFit}=object.userData;
    if(typeof garmentId!=='string')return;
    object.visible=false;
    const item=fitted.get(garmentId);
    if(!item || garmentFit!==fit || garmentSlot!==item.slot)return;
    const asset=assets.get(item.id)??{item,parts:[],defaultFit:false};
    asset.parts.push(object);
    asset.defaultFit ||= object.userData.garmentDefault===true;
    assets.set(item.id,asset);
  });
  const selection=new Map<GarmentSlot,string>();
  const occupied=new Set<GarmentSlot>();
  const covered=new Set<BodyRegion>();
  const defaults=[...assets.values()].filter(asset=>asset.defaultFit).map(asset=>asset.item.id);
  // Apply explicit choices in reverse priority, then fill the free slots from defaults.
  for(const id of [...choices].reverse().concat(defaults)) {
    const asset=assets.get(id);
    if(!asset)continue;
    const {item,parts}=asset;
    const layers=[item.slot,...item.layers];
    if(layers.some(layer=>occupied.has(layer)))continue;
    for(const layer of layers)occupied.add(layer);
    for(const region of item.covers??[])covered.add(region);
    for(const part of parts)part.visible=true;
    selection.set(item.slot,id);
  }
  model.traverse(object=>{
    const region=object.userData.bodyRegion;
    if(region)object.visible=!covered.has(region);
  });
  return selection;
}

// A temporary venue outfit uses the approved short clothes, not a purchased
// wardrobe item. The original GLBs have no bare foot under their footwear.
// Fit two small stylized feet to the actual ankle joints; no new skeleton.
export function fitSpaWardrobe(model:Object3D,role:CharacterId){
 const look=role==='vlad'?'home':'pink';
 fitWardrobe(model,role,outfitChoices(look));
 const ankles=['AnkleL','AnkleR'].map(name=>model.getObjectByName(name));
 if(ankles.some(a=>!a))return;
 let skin=new THREE.Color(role==='vlad'?0xc58c70:0xd9a68c);
 model.traverse(o=>{
  if(!(o instanceof THREE.SkinnedMesh)||!o.visible||o.userData.garmentSlot!=='lower')return;
  const pos=o.geometry.getAttribute('position'),colors=o.geometry.getAttribute('color');
  if(!colors)return;let low=Infinity,index=0;for(let i=0;i<pos.count;i++)if(pos.getY(i)<low){low=pos.getY(i);index=i;}
  skin.setRGB(colors.getX(index),colors.getY(index),colors.getZ(index));
 });
 model.traverse(o=>{if(o.userData.garmentSlot==='footwear')o.visible=false;});
 for(const ankle of ankles){
  let group=ankle!.children.find(o=>o.userData.spaFoot);
  if(!group){
   group=new THREE.Group();group.name='SPA barefoot';group.userData.spaFoot=true;
   const sole=new THREE.Mesh(orb,finish(skin.getHex(),'fabric'));sole.scale.set(.075,.052,.120);sole.position.set(0,-.036,.056);
   const instep=new THREE.Mesh(orb,sole.material);instep.scale.set(.061,.047,.075);instep.position.set(0,-.012,.011);
   group.add(sole,instep);ankle!.add(group);
  }
  group.visible=true;
 }
}

// A single temporary campsite kit, fitted on the already-approved garment rigs.
// Copy only the color buffer. Never mutate the shared GLB, skeleton or owned look.
export function fitLakeWardrobe(model:Object3D,role:CharacterId){
 const look=LAKE_LOOKS[role];fitWardrobe(model,role,outfitChoices(look));
 const palette=role==='alina'?{upper:0x9cae92,lower:0x6f685c}:{upper:0xc2b395,lower:0x596d48};
 model.traverse(o=>{
  if(!(o instanceof THREE.Mesh)||!o.visible||o.userData.garmentId!==role+'-'+look+'-'+o.userData.garmentSlot)return;
  const slot=o.userData.garmentSlot as 'upper'|'lower';
  if(slot!=='upper'&&slot!=='lower')return;
  const color=o.geometry.getAttribute('color');if(!color||color.itemSize<3)return;
  const original=o.geometry,copy=original.clone(),out=copy.getAttribute('color');
  const target=new THREE.Color(palette[slot]);let peak=.001;
  for(let i=0;i<color.count;i++)peak=Math.max(peak,.2126*color.getX(i)+.7152*color.getY(i)+.0722*color.getZ(i));
  for(let i=0;i<color.count;i++){const y=.2126*color.getX(i)+.7152*color.getY(i)+.0722*color.getZ(i),shade=.36+.64*y/peak;out.setXYZ(i,target.r*shade,target.g*shade,target.b*shade);}
  out.needsUpdate=true;lakeOriginals.set(o,original);o.geometry=copy;
 });
}
