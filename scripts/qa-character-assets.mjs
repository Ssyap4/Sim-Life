import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readAsset(folder, id) {
  const file=readFileSync(new URL('../src/assets/characters/'+folder+id+'.glb',import.meta.url));
  assert.equal(file.toString('ascii',0,4),'glTF');
  assert.equal(file.readUInt32LE(4),2);
  assert.equal(file.readUInt32LE(8),file.length);
  const length=file.readUInt32LE(12);
  const doc=JSON.parse(file.toString('utf8',20,20+length));
  const data=file.subarray(28+length);
  return {file,doc,data};
}

const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const scalar={
  5121:[1,'readUInt8',255],5123:[2,'readUInt16LE',65535],
  5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1],
};

function rows(asset,index) {
  const info=asset.doc.accessors[index],view=asset.doc.bufferViews[info.bufferView];
  const [bytes,reader,scale]=scalar[info.componentType];
  const count=components[info.type], stride=view.byteStride??bytes*count;
  const start=(view.byteOffset??0)+(info.byteOffset??0);
  assert.ok(!info.sparse,'joint, bind and skin accessors must be directly readable');
  return Array.from({length:info.count},(_,i)=>Array.from({length:count},(_,j)=>
    asset.data[reader](start+stride*i+bytes*j)/(info.normalized?scale:1)));
}

const transform=node=>({
  translation:node.translation??[0,0,0],
  rotation:node.rotation??[0,0,0,1],
  scale:node.scale??[1,1,1],
  matrix:node.matrix??null,
});

function close(actual,expected,message) {
  assert.equal(actual.length,expected.length,message);
  for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<1e-6,message+' at '+i);
}

function skeleton(asset) {
  const {nodes,skins}=asset.doc;
  assert.equal(skins.length,1);
  const rig=skins[0], binds=rows(asset,rig.inverseBindMatrices);
  const parents=new Map();
  for(const parent of nodes)for(const child of parent.children??[])parents.set(child,parent.name);
  return new Map(rig.joints.map((index,i)=>[nodes[index].name,{
    parent:parents.get(index), transform:transform(nodes[index]), bind:binds[i],
  }]));
}

function garments(asset) {
  const {nodes}=asset.doc;
  return new Map(nodes.filter(node=>node.extras?.garmentId).map(node=>[node.extras.garmentId,node.extras]));
}

function getMetrics(asset,id) {
  const {doc,file}=asset;
  const triangles=node=>doc.meshes[node.mesh].primitives.reduce((sum,p)=>
    sum+doc.accessors[p.indices??p.attributes.POSITION].count/3,0);
  const meshes=doc.nodes.filter(node=>node.mesh!==undefined);
  const visible=meshes.filter(node=>node.extras?.garmentId?node.extras.garmentDefault:
    !(id==='alina'&&node.extras?.bodyRegion==='forearms'));
  return {
    bytes:file.length,
    allTriangles:meshes.reduce((total,node)=>total+triangles(node),0),
    defaultTriangles:visible.reduce((total,node)=>total+triangles(node),0),
    defaultPrimitives:visible.reduce((total,node)=>total+doc.meshes[node.mesh].primitives.length,0),
    wardrobePieces:garments(asset).size,
    joints:skeleton(asset).size,
    textures:doc.images.map(image=>({name:image.name,bytes:doc.bufferViews[image.bufferView].byteLength})),
  };
}

for(const id of ['alina','vlad']){
  const original=readAsset('',id), candidate=readAsset('remake/',id);
  const oldRig=skeleton(original), newRig=skeleton(candidate);
  assert.deepEqual([...newRig.keys()],[...oldRig.keys()],id+' joint order');
  for(const [name,old] of oldRig){
    const next=newRig.get(name);
    assert.equal(next.parent,old.parent,id+' '+name+' parent');
    for(const key of ['translation','rotation','scale'])close(next.transform[key],old.transform[key],id+' '+name+' '+key);
    assert.deepEqual(next.transform.matrix,old.transform.matrix);
    close(next.bind,old.bind,id+' '+name+' inverse bind matrix');
  }
  const {doc}=candidate;
  const roots=asset=>asset.doc.nodes.find(node=>node.name==='Resident');
  assert.deepEqual(roots(candidate).extras,roots(original).extras);
  assert.deepEqual(transform(roots(candidate)),transform(roots(original)));
  assert.deepEqual(garments(candidate),garments(original));
  assert.ok(doc.nodes.some(node=>node.extras?.bodyRegion==='forearms'));

  const portrait=doc.nodes.findIndex(node=>node.extras?.remakePortrait===true);
  const keys=doc.meshes[doc.nodes[portrait].mesh].extras.targetNames;
  assert.deepEqual(keys,['Smile','CloseLids']);
  const blink=doc.animations.find(clip=>clip.name==='Blink');
  const track=blink?.channels.find(item=>item.target.node===portrait&&item.target.path==='weights');
  assert.ok(track,id+' Blink must target the new eyelids');
  const values=rows(candidate,blink.samplers[track.sampler].output).flat();
  assert.ok(values.some((value,i)=>i%2===1&&value>.99));
  const hair=doc.nodes.find(node=>node.name==='Sculpted hairstyle');
  if(id==='alina')assert.deepEqual(doc.meshes[hair.mesh].extras.targetNames,['DailyStyle','EveningStyle']);

  const eyes=doc.nodes.find(node=>node.name==='Eyes').mesh;
  const eyeJoints=new Set();
  const jointNames=[...newRig.keys()];
  for(const [number,mesh] of doc.meshes.entries())for(const part of mesh.primitives){
    const {POSITION,NORMAL,JOINTS_0,WEIGHTS_0}=part.attributes;
    const vertices=doc.accessors[POSITION].count;
    assert.equal(doc.accessors[NORMAL].count,vertices);
    const weights=rows(candidate,WEIGHTS_0), joints=rows(candidate,JOINTS_0);
    assert.equal(weights.length,vertices);
    assert.equal(joints.length,vertices);
    for(const [i,weight] of weights.entries()){
      assert.ok(weight.every(n=>Number.isFinite(n)&&n>=0),id+' invalid weights on mesh '+number);
      assert.ok(Math.abs(weight.reduce((sum,n)=>sum+n,0)-1)<.004,id+' skin weight sum on mesh '+number);
      assert.ok(joints[i].every((n,j)=>!weight[j]||n>=0&&n<newRig.size),id+' skin joint on mesh '+number);
      if(number===eyes)for(const [joint,s] of joints[i].entries())if(weight[joint])eyeJoints.add(jointNames[s]);
    }
  }
  assert.ok(eyeJoints.has('EyeL')&&eyeJoints.has('EyeR'),id+' both irises must follow the animated joints');
  console.log(JSON.stringify({id,approved:getMetrics(original,id),remake:getMetrics(candidate,id)}));
}
