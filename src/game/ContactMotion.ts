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

/** Small eye lead complements the head turn; existing task gaze wins. */
export function conversationEyeLead(yaw:number,focused:boolean):number {
  if(!Number.isFinite(yaw))return 0;
  return Math.max(-.12,Math.min(.12,yaw*(focused?.12:.28)));
}
