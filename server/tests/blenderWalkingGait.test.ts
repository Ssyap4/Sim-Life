import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Bone, Group, Vector3 } from 'three';
import { Actor } from '../../src/game/Actor';
import type { CharacterId } from '../../src/shared/protocol';
import type { CharacterModel } from '../../src/game/CharacterArt';

/** Use the actual, shipped Blender bind transforms while testing the animated
 * joints. No browser, network, textures, or heavyweight GLB renderer needed. */
function fromShippedSkeleton(id: CharacterId): CharacterModel {
  const binary=readFileSync(join(process.cwd(),'src','assets','characters',id+'.glb'));
  assert.equal(binary.toString('utf8',0,4),'glTF');
  const json=JSON.parse(binary.toString('utf8',20,20+binary.readUInt32LE(12))) as {
    nodes: {name?:string;translation?:number[];extras?:{waistY?:number}}[];
  };
  const find=(name:string)=> {
    const node=json.nodes.find(node=>node.name===name);
    assert.ok(node, id + '/' + name);
    return node;
  };
  const waist=find('Resident').extras?.waistY;
  assert.ok(waist && waist>.6 && waist<1.2);
  const thighLength=-(find('KneeL').translation?.[1]??0);
  const shinLength=-(find('AnkleL').translation?.[1]??0);
  assert.ok(thighLength>.3 && shinLength>.3);
  return (figure:Group)=>{
    const knees:[Bone,Bone]=[new Bone(),new Bone()];
    const ankles:[Bone,Bone]=[new Bone(),new Bone()];
    const legs:[Bone,Bone]=[new Bone(),new Bone()];
    const chest=new Group();
    const head=new Group();
    const hair=new Group();
    const eyes:[Group,Group]=[new Group(),new Group()];
    const arms:[Group,Group]=[new Group(),new Group()];
    const elbows:[Bone,Bone]=[new Bone(),new Bone()];
    const wrists:[Group,Group]=[new Group(),new Group()];
    figure.add(chest);
    chest.position.y=waist;
    chest.add(head, ...arms);
    head.add(hair,...eyes);
    for(const [i,suffix] of ['L','R'].entries()){
      const p=find('Thigh'+suffix).translation!;
      legs[i].position.set(p[0],p[1],p[2]);
      knees[i].position.y=find('Knee'+suffix).translation![1];
      ankles[i].position.y=find('Ankle'+suffix).translation![1];
      figure.add(legs[i]);
      legs[i].add(knees[i]);
      knees[i].add(ankles[i]);
      arms[i].add(elbows[i]);
      elbows[i].add(wrists[i]);
    }
    return {
      joints:{leftLeg:legs[0],rightLeg:legs[1],leftArm:arms[0],rightArm:arms[1]},
      rig:{chest,head,hair,eyes,elbows,wrists,knees,ankles,waistY:waist,
        thighLength,shinLength,upperArm:.27,lowerArm:.28},
    };
  };
}

test('Shipped Blender Vlad and Alina skeletons walk upright with grounded feet',()=>{
  for(const role of ['vlad','alina'] as const){
    const actor=new Actor(role,[0,0],fromShippedSkeleton(role));
    actor.walkPath([new Vector3(12,0,0)],()=>{});
    const model=actor as unknown as {
      figure:{position:Vector3};
      rig:{ankles:Bone[];knees:Bone[];chest:Group};
    };
    let lowestBody=Infinity,lowestAnkle=Infinity,highestAnkle=-Infinity;
    for(let i=0;i<215;i++){
      actor.update(1/60);
      if(i<50)continue;
      lowestBody=Math.min(lowestBody,model.figure.position.y);
      for(const ankle of model.rig.ankles){
        const y=ankle.getWorldPosition(new Vector3()).y;
        lowestAnkle=Math.min(lowestAnkle,y);
        highestAnkle=Math.max(highestAnkle,y);
      }
      assert.ok(model.rig.chest.rotation.x<.1);
    }
    assert.ok(lowestBody>=-.043,role+' cannot crouch as before');
    assert.ok(lowestAnkle>.01 && lowestAnkle<.10,
      role+' stance ankle should remain close to floor, actual '+lowestAnkle);
    assert.ok(highestAnkle<.22,'step clearance not exaggerated '+highestAnkle);
  }
});
