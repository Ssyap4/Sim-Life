import assert from 'node:assert/strict';
import test from 'node:test';
import {ufcBroadcastFrame} from '../../src/game/UfcChoreography';
import {highlightAt} from '../../src/game/UfcHighlights';
const clips=['exchange-1.mp4','exchange-2.mp4','exchange-3.mp4','celebrate-1.mp4','celebrate-2.mp4','celebrate-3.mp4'];
test('UFC contains distinct choreography and synchronized decisive exchange/replay for either winner',()=>{
 for(const winner of ['red','blue'] as const)for(const seed of [0,1,77,999999]){
  const m={seed,winner,redLabel:'VLAD',blueLabel:'ALINA'};
  const frames=Array.from({length:1800},(_,i)=>ufcBroadcastFrame(i/15,m));
  assert.ok(new Set(frames.map(f=>f.kind)).size>=9);
  assert.ok(new Set(frames.map(f=>f.zoom)).size>=5);
  assert.ok(frames.every(f=>Number.isFinite(f.strike)&&f.strike>=0&&f.strike<=1&&f.fall>=0&&f.fall<=1));
  assert.equal(ufcBroadcastFrame(110,m).fall,1);
  assert.equal(ufcBroadcastFrame(110,m).active,winner==='red'?0:1);
  const original=ufcBroadcastFrame(108.75,m),replay=ufcBroadcastFrame(113,m);
  assert.equal(replay.sceneTime,original.sceneTime);assert.equal(replay.strike,original.strike);
  assert.equal(replay.fall,original.fall);assert.equal(replay.active,original.active);
  assert.equal(ufcBroadcastFrame(119,m).winner,winner==='red'?0:1);
  assert.equal(ufcBroadcastFrame(119,m).celebrate,true);
 }
});
test('private highlight montage rotates all six clips without replacing final match result',()=>{
 for(const seed of [0,1,55,999999]){
  const used=new Set<string>();
  for(let t=0;t<120;t+=.25){const c=highlightAt(t,seed,clips);if(c){used.add(c.file);assert.ok(t<107);assert.ok(c.offset>=0&&c.offset<4);}}
  assert.equal(used.size,6);
  assert.equal(highlightAt(112,seed,clips),null);assert.equal(highlightAt(119,seed,clips),null);
  assert.equal(highlightAt(8,seed,[]),null);
 }
});
