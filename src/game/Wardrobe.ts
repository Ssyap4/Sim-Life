import type { Object3D } from 'three';
import type { CharacterId } from '../shared/protocol';

export const GARMENT_SLOTS = ['upper','lower','footwear','outfit','accessory'] as const;
export type GarmentSlot = typeof GARMENT_SLOTS[number];

export interface Garment {
  id: string;
  name: string;
  slot: GarmentSlot;
  fit: string;
  layers: readonly GarmentSlot[];
}

export const GARMENTS: readonly Garment[] = [
  {id:'vlad-signature-upper', name:'Футболка Влада',slot:'upper',fit:'vlad-021',layers:['upper']},
  {id:'vlad-signature-lower', name:'Брюки Влада',slot:'lower',fit:'vlad-021',layers:['lower']},
  {id:'vlad-signature-footwear', name:'Кеды Влада',slot:'footwear',fit:'vlad-021',layers:['footwear']},
  {id:'alina-signature-upper', name:'Голубой жакет',slot:'upper',fit:'alina-021',layers:['upper']},
  {id:'alina-signature-lower', name:'Брюки Алины',slot:'lower',fit:'alina-021',layers:['lower']},
  {id:'alina-signature-footwear', name:'Туфли Алины',slot:'footwear',fit:'alina-021',layers:['footwear']},
  {id:'alina-cardigan-upper', name:'Терракотовый кардиган',slot:'upper',fit:'alina-021',layers:['upper']},
];

export function fitWardrobe(model:Object3D, character:CharacterId, choices:readonly string[] = []) {
  const fit=character+'-021';
  const fitted=new Map<string,Garment>();
  for(const rule of GARMENTS)if(rule.fit===fit)fitted.set(rule.id,rule);
  const assets=new Map<string,{item:Garment; object:Object3D}>();
  model.traverse(object=>{
    const {garmentId,garmentSlot,garmentFit}=object.userData;
    const item=typeof garmentId==='string'?fitted.get(garmentId):undefined;
    if(!item || garmentFit!==fit || garmentSlot!==item.slot)return;
    assets.set(item.id,{item,object});
  });
  // Reject incompatible selections by falling back to the authored default.
  // Only compatible meshes already bound to this same avatar may be visible.
  const selection=new Map<GarmentSlot,string>();
  for(const {item,object} of assets.values())
    if(object.userData.garmentDefault)selection.set(item.slot,item.id);
  for(const id of choices) {
    const option=assets.get(id)?.item;
    if(!option)continue;
    for(const layer of option.layers)selection.delete(layer);
    selection.set(option.slot,id);
  }
  for(const {item,object} of assets.values())object.visible=selection.get(item.slot)===item.id;
  return selection;
}
