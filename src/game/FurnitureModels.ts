import * as THREE from 'three';
import type {PlacedFurniture} from '../shared/furniture';
import {cube,softCube,orb,drum,plane,torus} from './ArtKit';

const shared=new Set<THREE.BufferGeometry>([cube,softCube,orb,drum,plane,torus]);

/** Retain unchanged models and their animation pivots. A move/rotation is a
 * transform only; new SKU/finish and removal are the only rebuild cases. */
export function reconcileFurnitureModels(models:Map<number,THREE.Group>,placed:readonly PlacedFurniture[],
  create:(item:PlacedFurniture)=>THREE.Group,remove:(model:THREE.Group)=>void,
  update:(model:THREE.Group,item:PlacedFurniture)=>void):void{
  const incoming=new Map(placed.map(item=>[item.id,item]));
  for(const [id,model] of models){
    const item=incoming.get(id);
    if(!item||model.userData.sku!==item.sku||model.userData.finish!==item.finish){
      remove(model);models.delete(id);
    }
  }
  for(const item of placed){
    let model=models.get(item.id);
    if(!model){
      model=create(item);
      model.userData.furnitureId=item.id;model.userData.sku=item.sku;model.userData.finish=item.finish;
      model.userData.originalScaleY=model.scale.y;
      models.set(item.id,model);
    }
    update(model,item);
  }
}

/** Keep the selected workstation if it still exists; retain its identity
 * even if its model was replaced by a finish change. */
export function preferredFurniture(placed:readonly PlacedFurniture[],preferredId:number|undefined,
 accepts:(item:PlacedFurniture)=>boolean):PlacedFurniture|undefined{
 return placed.find(item=>item.id===preferredId&&accepts(item))??placed.find(accepts);
}

/** Geometry is local to the model except the art-kit primitives; surface
 * materials and painted maps are cached globally, so never dispose those. */
export function disposeFurnitureModel(root:THREE.Object3D,ghost=false):void{
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(part=>{
    if(part instanceof THREE.InstancedMesh)part.dispose();
    if(!(part instanceof THREE.Mesh||part instanceof THREE.LineSegments))return;
    if(!shared.has(part.geometry))geometries.add(part.geometry);
    for(const material of Array.isArray(part.material)?part.material:[part.material]){
      if(ghost||material instanceof THREE.ShaderMaterial||
        part.name==='Oasis pool glass')materials.add(material);
    }
  });
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}