import type { Object3D } from 'three';
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

export const GARMENTS: readonly Garment[] = [
  {id:'vlad-signature-upper', name:'Футболка Влада',slot:'upper',fit:'vlad-021',layers:['upper']},
  {id:'vlad-signature-lower', name:'Брюки Влада',slot:'lower',fit:'vlad-021',layers:['lower']},
  {id:'vlad-signature-footwear', name:'Кеды Влада',slot:'footwear',fit:'vlad-021',layers:['footwear']},
  {id:'alina-signature-upper', name:'Голубой жакет',slot:'upper',fit:'alina-021',layers:['upper'],covers:['forearms']},
  {id:'alina-signature-lower', name:'Брюки Алины',slot:'lower',fit:'alina-021',layers:['lower']},
  {id:'alina-signature-footwear', name:'Туфли Алины',slot:'footwear',fit:'alina-021',layers:['footwear']},
  {id:'alina-tee-upper', name:'Футболка Алины',slot:'upper',fit:'alina-021',layers:['upper']},
];

export function fitWardrobe(model:Object3D, character:CharacterId, choices:readonly string[] = []) {
  const fit=character+'-021';
  const fitted=new Map<string,Garment>();
  for(const rule of GARMENTS)if(rule.fit===fit)fitted.set(rule.id,rule);
  const assets=new Map<string,{item:Garment; parts:Object3D[]; defaultFit:boolean}>();
  model.traverse(object=>{
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
