import type {Object3D} from 'three';
/** For named animation pivots whose hierarchy is fixed for the life of a model.
 * Replacement models get their own entries, and removed roots can be collected. */
export class StableModelParts {
 private readonly roots=new WeakMap<Object3D,Map<string,Object3D|undefined>>();
 get(root:Object3D|undefined,name:string):Object3D|undefined{
  if(!root)return undefined;
  let parts=this.roots.get(root);
  if(!parts){parts=new Map();this.roots.set(root,parts);}
  if(!parts.has(name))parts.set(name,root.getObjectByName(name));
  return parts.get(name);
 }
}
