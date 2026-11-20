import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Actor } from '../../src/game/Actor';
import { HOME_WALK_SPEED } from '../../src/shared/home';
import { WALK_MAX_HIP_DROP, WALK_STANCE_FRACTION, walkFootTarget, walkPelvisDrop, walkStrideLength } from '../../src/game/WalkingGait';

type AnimationProbe = {
  figure: { position: Vector3 };
  rig: { ankles: { getWorldPosition(target: Vector3): Vector3 }[];
    knees: { rotation: { x: number } }[];
    chest: { rotation: { x: number } } };
};

test('Walking gait keeps both model rigs upright across all stance and swing phases', () => {
  const originalDip = 0.116;
  for (const [role, length] of [['vlad',0.821], ['alina',0.767]] as const) {
    const stride=walkStrideLength(role);
    let min=Infinity,max=-Infinity,forward=0,raised=0;
    for (let i=0;i<=240;i++) {
      const phase=i/240;
      const pelvis=walkPelvisDrop(phase,1);
      min=Math.min(min,pelvis);max=Math.max(max,pelvis);
      for(const leg of [0,1] as const) {
        const foot=walkFootTarget(phase,leg,length,stride,1,pelvis,0);
        assert.ok(foot.z>=-length*.361 && foot.z<=length*.361,
          'step length must fit actual skeleton for '+role);
        assert.ok(foot.y>=-length && foot.y<=-length+.14,
          'feet remain below the torso and swing only a little');
        if (foot.swing && Math.abs(foot.z)<.2 && foot.y > -length+.05)raised++;
        forward=Math.max(forward,Math.abs(foot.z));
      }
    }
    assert.ok(max<=WALK_MAX_HIP_DROP+1e-9);
    assert.ok(min>=.013);
    assert.ok(originalDip/max>2.9,'new hip dip at least 3x less than previous deep squat');
    assert.ok(max-min<=.026,'no exaggerated pogo-stick movement');
    assert.ok(forward>.23 && raised>0,'legs should still take real steps');
    assert.equal(WALK_STANCE_FRACTION,.60);
  }
});

test('Walking 3D character models preserve foot contact and do not sag or crouch', () => {
  for(const role of ['vlad','alina'] as const) for(const dt of [1/60, .08, .20]) {
    const actor=new Actor(role,[0,0]);
    const initial=new Vector3();
    actor.bodyPosition(initial);
    actor.walkPath([new Vector3(15,0,0)],()=>{});
    let minDip=0,maxDip=-Infinity,minFoot=Infinity,maxFoot=-Infinity,peakKnee=0;
    let samples=0;
    const probe=actor as unknown as AnimationProbe;
    for (let i=0;i<Math.ceil(5/dt);i++) {
      actor.update(dt);
      if(i*dt<.65)continue; // allow the blend from idle to settle
      ++samples;
      minDip=Math.min(minDip,probe.figure.position.y);
      maxDip=Math.max(maxDip,probe.figure.position.y);
      assert.ok(probe.rig.chest.rotation.x<.12,'upper body should not lean forward like crawling');
      for(const ankle of probe.rig.ankles) {
        const pos=ankle.getWorldPosition(new Vector3());
        minFoot=Math.min(minFoot,pos.y);
        maxFoot=Math.max(maxFoot,pos.y);
      }
      for(const knee of probe.rig.knees)peakKnee=Math.max(peakKnee,Math.abs(knee.rotation.x));
      assert.ok(Math.abs(actor.root.position.y)<.00001,'navigation still stays at ground height');
    }
    assert.ok(samples>10,role+' has enough animation samples');
    assert.ok(minDip>=-.046,role+' cannot sink into a permanent crouch at dt '+dt+' (dip '+minDip+')');
    assert.ok(maxDip<=0);
    assert.ok(minFoot>-.025,role+' shoes must not clip through ground at '+dt+' (foot '+minFoot+')');
    assert.ok(maxFoot<.22,role+' feet must not over-lift at '+dt+' (foot '+maxFoot+')');
    assert.ok(peakKnee>.15,'legs must visibly articulate while walking');
    const moved=Math.hypot(actor.root.position.x,actor.root.position.z);
    assert.ok(moved>=HOME_WALK_SPEED*4.8,'character must still walk at the original navigation speed');
  }
});

test('From a seated pose, walking regains full height and stops upright without movement changes',()=>{
  for(const role of ['vlad','alina'] as const) {
    const actor=new Actor(role,[0,0]);
    actor.setFurniturePose('sit',new Vector3(0.35,.34,0),0);
    for(let i=0;i<80;i++)actor.update(1/60);
    let reached=false;
    actor.walkPath([new Vector3(3,0,0)],()=>{reached=true});
    for(let i=0;i<240 && !reached;i++)actor.update(1/60);
    assert.ok(reached,'walking from furniture still reaches its destination');
    for(let i=0;i<100;i++)actor.update(1/60);
    const model=actor as unknown as AnimationProbe;
    assert.ok(Math.abs(model.figure.position.y)<.005,'idle standing regains full height');
    assert.ok(Math.abs(model.rig.chest.rotation.x)<.10);
  }
});
