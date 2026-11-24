import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FittingStage} from '../../src/game/FittingStage';
test('fitting stage isolates model and fits head and footwear above controls on mobile',()=>{
 const model=new THREE.Group();
 model.position.set(19,0,13);model.rotation.y=2;
 const body=new THREE.Mesh(new THREE.BoxGeometry(.64,1.8,.46));body.position.y=.9;
 model.add(body);
 const invisible=new THREE.Mesh(new THREE.BoxGeometry(20,20,20));invisible.visible=false;model.add(invisible);
 const stage=new FittingStage(model,'vlad');
 stage.wear('signature');
 for(const [w,h,bottom] of [[390,844,.64],[320,568,.57],[430,932,.70]]){
  for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
   stage.rotate(angle);stage.frame(w,h,bottom);
   for(const x of [-.32,.32])for(const y of [0,1.8])for(const z of [-.23,.23]){
    const p=new THREE.Vector3(x,y,z).project(stage.camera);
    const u=(1+p.x)/2,v=(1-p.y)/2;
    assert.ok(u>=0&&u<=1&&v>=0&&v<=bottom,JSON.stringify({w,h,bottom,angle,u,v}));
   }
  }
 }
 assert.equal(model.position.x,19);assert.equal(model.rotation.y,2);assert.equal(model.children.length,2);
 stage.dispose();assert.equal(stage.scene.children.length,0);
});
