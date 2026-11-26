import type { Vector3 } from 'three';

/** Build a stable elbow plane even when the preferred elbow direction is
 * collinear with the target. No allocation; both vectors are caller-owned. */
export function stableElbowPlane(bend:Vector3,direction:Vector3):Vector3 {
  bend.addScaledVector(direction,-bend.dot(direction));
  if(bend.lengthSq()<1e-8){
    // Select the least aligned Cartesian axis, then project it into the plane.
    const x=Math.abs(direction.x),y=Math.abs(direction.y),z=Math.abs(direction.z);
    if(x<=y&&x<=z)bend.set(1,0,0);
    else if(y<=z)bend.set(0,1,0);
    else bend.set(0,0,1);
    bend.addScaledVector(direction,-bend.dot(direction));
  }
  return bend.normalize();
}

/** Phrase-sized gestures rather than continuous sinusoidal nodding.
 * No face geometry or speech/audio synthesis is involved. */
export function conversationExpression(seconds:number,speaking:boolean,focused:boolean,alina:boolean){
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
  const smooth=(x:number)=>{const a=Math.max(0,Math.min(1,x));return a*a*(3-2*a);};
  const pulse=(elapsed:number,width:number)=>{const x=elapsed/width;return x>0&&x<1?Math.sin(Math.PI*x)**2:0;};
  const enter=smooth(t/.35),phase=t%3;
  const nod=speaking?pulse(phase,.65)*.040+pulse(phase-1.10,.7)*.025:pulse(phase-.65,.70)*.065;
  const smile=speaking?.22+.10*pulse(phase-.35,1.3):.16+.13*pulse(phase-1.35,1.15);
  const tilt=(alina?1:-1)*.025*(speaking?pulse(phase-.3,1.7):pulse(phase-.2,2.1));
  const away=speaking?pulse(phase-1.65,.85):pulse(phase-2.25,.55);
  const scale=focused?.36:1;
  return {nod:nod*enter*scale,smile:smile*enter,tilt:tilt*enter*scale,focus:1-.24*away*enter*scale};
}

/** Small eye lead complements the head turn; existing task gaze wins. */
export function conversationEyeLead(yaw:number,focused:boolean):number {
  if(!Number.isFinite(yaw))return 0;
  return Math.max(-.12,Math.min(.12,yaw*(focused?.12:.28)));
}
