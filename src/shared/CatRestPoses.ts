/**
 * Authored resting silhouettes for the real, skeletal Simba model.
 * Values below are in Simba's unscaled GLB model space; no new geometry.
 * A furniture socket picks the pose, not the cat's walking animation.
 */
export type CatRestPoseId =
  | 'sofa_loaf'
  | 'sofa_side_rest'
  | 'bed_curl'
  | 'chair_compact'
  | 'mat_curl' | 'house_cabin' | 'house_soft' | 'house_tower';

export interface CatRestPose {
  /** Local yaw relative to the furniture's open/front direction. */
  yaw:number;
  pitch:number;
  roll:number;
  /** Root-to-cushion offset. Mesh underside sits around y = .27. */
  sink:number;
  length:number;
  height:number;
  /** These are local two-bone IK ankle targets from each hip. */
  forePawY:number;
  forePawZ:number;
  hindPawY:number;
  hindPawZ:number;
  spineYaw:number;
  spinePitch:number;
  headPitch:number;
  headTurn:number;
  headDrop:number;
  tailCurl:number;
}

/** Distinct hand-authored targets: no random transform per animation frame. */
export const CAT_REST_POSES:Readonly<Record<CatRestPoseId,CatRestPose>>={
  sofa_loaf:{
    yaw:Math.PI/2,pitch:.025,roll:.015,sink:.235,length:.87,height:.94,
    forePawY:-.130,forePawZ:-.075,hindPawY:-.140,hindPawZ:.095,
    spineYaw:.13,spinePitch:.045,headPitch:.09,headTurn:.11,headDrop:.038,tailCurl:1,
  },
  sofa_side_rest:{
    yaw:Math.PI/2,pitch:.045,roll:.15,sink:.245,length:.92,height:.96,
    forePawY:-.125,forePawZ:.085,hindPawY:-.135,hindPawZ:.115,
    spineYaw:.15,spinePitch:.055,headPitch:.23,headTurn:.14,headDrop:.075,tailCurl:.92,
  },
  bed_curl:{
    yaw:Math.PI/2-.26,pitch:.035,roll:.085,sink:.240,length:.82,height:.93,
    forePawY:-.135,forePawZ:-.105,hindPawY:-.145,hindPawZ:.155,
    spineYaw:.29,spinePitch:.085,headPitch:.24,headTurn:.20,headDrop:.090,tailCurl:1.12,
  },
  chair_compact:{
    yaw:0,pitch:.015,roll:0,sink:.230,length:.71,height:.91,
    forePawY:-.130,forePawZ:-.080,hindPawY:-.145,hindPawZ:.095,
    spineYaw:.10,spinePitch:.045,headPitch:.04,headTurn:.08,headDrop:.020,tailCurl:1.14,
  },
  house_cabin:{
    yaw:0,pitch:.025,roll:.025,sink:.235,length:.78,height:.92,
    forePawY:-.13,forePawZ:-.085,hindPawY:-.14,hindPawZ:.12,
    spineYaw:.19,spinePitch:.06,headPitch:.16,headTurn:.12,headDrop:.05,tailCurl:1.15,
  },
  house_soft:{
    yaw:Math.PI/2,pitch:.035,roll:.13,sink:.24,length:.79,height:.92,
    forePawY:-.125,forePawZ:.055,hindPawY:-.145,hindPawZ:.15,
    spineYaw:.25,spinePitch:.07,headPitch:.25,headTurn:.19,headDrop:.085,tailCurl:1.10,
  },
  house_tower:{
    yaw:0,pitch:.02,roll:0,sink:.23,length:.73,height:.91,
    forePawY:-.13,forePawZ:-.065,hindPawY:-.145,hindPawZ:.105,
    spineYaw:.10,spinePitch:.04,headPitch:.05,headTurn:.08,headDrop:.025,tailCurl:1.16,
  },
  mat_curl:{
    yaw:0,pitch:.035,roll:.10,sink:.240,length:.83,height:.93,
    forePawY:-.135,forePawZ:-.095,hindPawY:-.145,hindPawZ:.145,
    spineYaw:.22,spinePitch:.070,headPitch:.22,headTurn:.18,headDrop:.070,tailCurl:1.08,
  },
};

export function chooseCatRestPose(
  options:readonly CatRestPoseId[]|undefined,key:string,startedAt:number,kind:'curl'|'watch',
):CatRestPoseId{
  const candidates:readonly CatRestPoseId[]=options?.length?options:
    [kind==='watch'?'chair_compact':'sofa_loaf'];
  if(candidates.length===1)return candidates[0]!;
  // Same visual on both devices while alternating two sofa poses on later rests.
  let hash=2166136261;
  for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  hash=Math.imul(hash^(Number.isFinite(startedAt)?Math.floor(startedAt):0),16777619);
  return candidates[(hash>>>0)%candidates.length]!;
}
