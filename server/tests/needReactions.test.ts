import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Actor } from '../../src/game/Actor';
import { NEED_REACTION_DURATION, needReactionWeight, pickNeedReaction, reactionAllowed,
  type ReactionNeeds } from '../../src/game/NeedReactions';

const okay: ReactionNeeds = { hunger: 90, energy: 90, bladder: 90, hygiene: 90, mood: 90 };
const low = (field: keyof ReactionNeeds, amount = 12): ReactionNeeds => ({ ...okay, [field]: amount });

test('Need reactions use actual thresholds, not permanent idle loops', () => {
  assert.equal(pickNeedReaction(okay, 0), null);
  for (const [field, gesture] of [
    ['hunger', 'hunger'], ['energy', 'tired'], ['bladder', 'bladder'],
    ['hygiene', 'hygiene'], ['mood', 'lowMood'],
  ] as const) {
    assert.equal(pickNeedReaction(low(field), 0), gesture);
    assert.equal(reactionAllowed(low(field), gesture), true);
    assert.equal(reactionAllowed(okay, gesture), false);
  }
  assert.equal(pickNeedReaction(low('energy', 50), 0), null);
  assert.equal(pickNeedReaction(low('energy', 49.9), 0), 'yawn');
  assert.equal(pickNeedReaction(low('hunger', 29.9), 0), 'hunger');
  assert.equal(pickNeedReaction(low('mood', 24), 0), null);
});

test('Equally urgent needs rotate rather than hiding all but the first', () => {
  const both = { ...okay, energy: 4, hunger: 4 };
  const kinds = Array.from({ length: 6 }, (_, n) => pickNeedReaction(both, n));
  assert.deepEqual(new Set(kinds), new Set(['yawn', 'tired', 'hunger']));
  assert.equal(pickNeedReaction({ ...both, bladder: 0, hygiene: 0 }, 0), 'bladder');
});

test('Gesture envelopes smoothly fade in and out to preserve normal idle pose', () => {
  assert.equal(needReactionWeight(-1), 0);
  assert.equal(needReactionWeight(0), 0);
  assert.equal(needReactionWeight(NEED_REACTION_DURATION), 0);
  assert.equal(needReactionWeight(Number.NaN), 0);
  assert.equal(needReactionWeight(1.5), 1);
  assert.ok(needReactionWeight(0.25) > 0 && needReactionWeight(0.25) < 1);
  assert.ok(needReactionWeight(NEED_REACTION_DURATION - 0.2) < 1);
});

test('A tired idle character can yawn and immediately yields to player movement', () => {
  const character = new Actor('vlad', [0, 0]);
  character.setNeeds(low('energy',40));
  for (let step = 0; step < 420; step++) character.update(1 / 60);
  const motion = character as unknown as { needReaction: string | null; rig: { head: { rotation: { x: number } } } };
  assert.equal(motion.needReaction, 'yawn');
  assert.ok(motion.rig.head.rotation.x < -0.035, 'head tips up during the yawn');

  character.walkPath([new Vector3(4, 0, 0)], () => {});
  character.update(1 / 60);
  assert.equal(motion.needReaction, null, 'walking instantly overrides idle gestures');
  assert.ok(character.root.position.x > 0, 'navigation still moves normally');

  character.playActivity('eat');
  character.update(1 / 60);
  assert.equal(motion.needReaction, null, 'eating overrides low-need gestures');
});

test('Healthy stats cancel an active idle gesture without altering needs', () => {
  const stats = low('bladder');
  const character = new Actor('alina', [0, 0]);
  character.setNeeds(stats);
  for (let step = 0; step < 580; step++) character.update(1 / 60);
  const motion = character as unknown as { needReaction: string | null };
  assert.equal(motion.needReaction, 'bladder');
  character.setNeeds(okay);
  character.update(1 / 60);
  assert.equal(motion.needReaction, null);
  assert.equal(stats.bladder, 12, 'visual-only gestures do not mutate server needs');
});

test('064 severe hunger and tiredness begin strictly below 30 and keep ordinary yawns',()=>{
  assert.equal(pickNeedReaction(low('hunger',30),0),null);
  assert.equal(pickNeedReaction(low('hunger',29.9),0),'hunger');
  assert.equal(pickNeedReaction(low('energy',30),0),'yawn');
  assert.equal(pickNeedReaction(low('energy',29.9),0),'tired');
  assert.equal(pickNeedReaction(low('energy',29.9),1),'yawn');
  assert.equal(reactionAllowed(low('energy',30),'tired'),false);
});
test('064 both residents reach abdomen and temple; fatigue sways without moving the root',()=>{
  for(const id of ['vlad','alina'] as const)for(const kind of ['hunger','tired'] as const){
    const actor=new Actor(id,[2,3]);
    const needs=low(kind==='hunger'?'hunger':'energy',18);
    actor.setNeeds(needs);
    const m=actor as unknown as {
      needReactionCooldown:number;
      rig:{head:{localToWorld(v:Vector3):Vector3},chest:{localToWorld(v:Vector3):Vector3,rotation:{z:number}},waistY:number,
      wrists:{getWorldPosition(v:Vector3):Vector3}[]}
    };
    m.needReactionCooldown=0;
    let min=Infinity,max=-Infinity;
    for(let i=0;i<126;i++){
      actor.update(1/60);
      if(i>60){min=Math.min(min,m.rig.chest.rotation.z);max=Math.max(max,m.rig.chest.rotation.z);}
    }
    const hand=id==='vlad'?1:0,side=hand===1?1:-1;
    const goal=kind==='hunger'?m.rig.chest.localToWorld(new Vector3(side*.145,m.rig.waistY+.18,.192)):
      m.rig.head.localToWorld(new Vector3(side*.195,.015,.145));
    assert.equal(actor.needReactionQA().kind,kind);
    assert.ok(m.rig.wrists[hand].getWorldPosition(new Vector3()).distanceTo(goal)<.12,id+' '+kind+' wrist contact');
    if(kind==='tired')assert.ok(max-min>.075,'visible fatigue sway');
    assert.equal(actor.root.position.x,2);assert.equal(actor.root.position.z,3);
    assert.equal(needs[kind==='hunger'?'hunger':'energy'],18);
    actor.playActivity('eat');actor.update(1/60);
    assert.equal(actor.needReactionQA().kind,null);
  }
});
