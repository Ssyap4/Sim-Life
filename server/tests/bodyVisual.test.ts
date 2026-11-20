import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { Actor } from '../../src/game/Actor';
import { pointIsClear, type FloorRect } from '../../src/game/navigation';
import { RESIDENT_CLEARANCE, residentStep, unoccupiedDestination } from '../../src/game/residentCollision';

const floor: FloorRect = { minX:-4, maxX:4, minZ:-3, maxZ:3 };
const walls: FloorRect[] = [];

function bodies(a: Actor, b: Actor): number {
  const v=a.bodyPosition(new Vector3()), w=b.bodyPosition(new Vector3());
  return Math.hypot(v.x-w.x,v.z-w.z);
}

test('Standing up to walk reattaches the rendered body before any movement',()=>{
  const vlad=new Actor('vlad',[-1.4,0]);
  const alina=new Actor('alina',[0,0]);
  // The animation root is offset to a chair while its path anchor stays safe.
  vlad.setFurniturePose('sit',new Vector3(-.30,-.25,0),0);
  for(let i=0;i<60;i++) vlad.update(1/60);
  assert.ok(Math.abs(vlad.bodyPosition(new Vector3()).x-vlad.root.position.x)>.8);
  let finished=0;
  vlad.walkPath([new Vector3(2.4,0,0)],()=>finished++);
  assert.ok(Math.abs(vlad.bodyPosition(new Vector3()).x-vlad.root.position.x)<1e-6,
    'the visible body must not drift through another person when walking from a chair');
  for(let i=0;i<500 && !finished;i++){
    vlad.update(1/60,(from,to)=>residentStep(from,to,
      alina.bodyPosition(new Vector3()),walls,floor));
    assert.ok(bodies(vlad,alina)>=RESIDENT_CLEARANCE-.03,
      'the full visible actor remains separated throughout the route');
  }
  assert.equal(finished,1);
});

test('Simultaneous crossing paths never swap sides by passing through bodies',()=>{
  for(const dt of [1/60,.08,.2]) {
    const vlad=new Actor('vlad',[-2.2,-.8]);
    const alina=new Actor('alina',[2.2,.8]);
    let done=0,closest=100;
    vlad.walkPath([new Vector3(2.2,0,.8)],()=>done++);
    alina.walkPath([new Vector3(-2.2,0,-.8)],()=>done++);
    for(let elapsed=0;elapsed<15 && done<2;elapsed+=dt) {
      vlad.update(dt,(from,to)=>residentStep(from,to,
        alina.bodyPosition(new Vector3()),walls,floor));
      alina.update(dt,(from,to)=>residentStep(from,to,
        vlad.bodyPosition(new Vector3()),walls,floor));
      const apart=bodies(vlad,alina);
      closest=Math.min(apart,closest);
      assert.ok(apart>=RESIDENT_CLEARANCE-.035,'visible actors may not overlap at '+dt+' dt');
      assert.ok(pointIsClear(vlad.root.position,walls,floor));
      assert.ok(pointIsClear(alina.root.position,walls,floor));
    }
    assert.equal(done,2,'both residents should make it around each other at '+dt+' dt');
    assert.ok(closest<1.35,'both paths actually crossed each other');
  }
});

test('Two guests at one counter receive physically distinct destinations',()=>{
  const blocked:FloorRect[]=[{minX:-1,maxX:1,minZ:0,maxZ:.7}];
  const first={x:0,z:1.2};
  const second=unoccupiedDestination(first,first,blocked,floor);
  assert.ok(second);
  assert.ok(Math.hypot(second.x-first.x,second.z-first.z)>=RESIDENT_CLEARANCE);
  assert.ok(pointIsClear(second,blocked,floor));
});
