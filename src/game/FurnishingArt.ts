import * as THREE from 'three';
import { FURNITURE_BY_ID, type FurnitureFinish } from '../shared/furniture';
import { batchRigidParts } from './ArtKit';
import { distinctiveFurniture } from './FurnitureDesigns';

// A single geometry pipeline powers the catalog thumbnail, placement ghost
// and final world object. No separate "illustration" model can drift out of sync.
function createBody(sku:string,finishId:FurnitureFinish):THREE.Group {
  const info=FURNITURE_BY_ID.get(sku);
  if(!info)throw new Error('Unknown furniture: '+sku);
  const root=distinctiveFurniture(sku,finishId);
  if(!root)throw new Error('Missing bespoke furniture design for: '+sku);
  root.name=info.name;
  batchRigidParts(root,true);
  // SKU dimensions are authoritative for placement, networking and saves.
  // Tuck sculptural details into this physical volume to keep old furniture
  // safe without changing footprints, pathways or save migration.
  const bounds=new THREE.Box3().setFromObject(root);
  if(bounds.min.y<0){
    root.position.y=-bounds.min.y;
    bounds.max.y-=bounds.min.y;
    bounds.min.y=0;
  }
  const maxX=Math.max(-bounds.min.x,bounds.max.x);
  const maxZ=Math.max(-bounds.min.z,bounds.max.z);
  if(maxX>0)root.scale.x=Math.min(1,info.width/(2*maxX));
  if(maxZ>0)root.scale.z=Math.min(1,info.depth/(2*maxZ));
  if(bounds.max.y>0)root.scale.y=Math.min(1,info.height/bounds.max.y);
  return root;
}

export function buildFurnishingModel(sku:string,finishId:FurnitureFinish):THREE.Group {
  return createBody(sku,finishId);
}

export function createPlacementGhost(sku:string,finishId:FurnitureFinish):THREE.Group {
  const ghost=createBody(sku,finishId);
  ghost.name='Предпросмотр размещения';
  const copies=new Map<THREE.Material,THREE.MeshStandardMaterial>();
  ghost.traverse(child=>{
    if(!(child instanceof THREE.Mesh))return;
    const old=child.material as THREE.MeshStandardMaterial;
    let material=copies.get(old);
    if(!material){
      material=old.clone();
      material.transparent=true;
      material.opacity=.58;
      material.depthWrite=false;
      material.emissive.setHex(0x173b2c);
      copies.set(old,material);
    }
    child.material=material;
  });
  return ghost;
}
