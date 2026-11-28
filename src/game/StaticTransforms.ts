import type {Object3D} from 'three';

/** Only use on audited immutable local transforms. Visibility, materials and
 * instance counts may still change; world matrices must follow moving parents. */
export function freezeLocalTransforms(root:Object3D):number{
 let count=0;
 root.traverse(object=>{
  object.updateMatrix();
  object.matrixAutoUpdate=false;
  count++;
 });
 return count;
}
