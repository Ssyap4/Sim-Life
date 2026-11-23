/** Distance thresholds in metres, with a short hysteresis to prevent
 * constant LOD toggling near a boundary. Medium zoom retains real geometry.
 * Low quality still starts simplifying earlier to protect mobile FPS. */
export const DISTRICT_DETAIL={
  building:{near:77,far:82,lowBias:12},
  cottage:{near:74,far:79,lowBias:12},
  trees:{near:51,far:56,lowBias:11},
  flowers:{near:41,far:46,lowBias:9},
  distantFlowers:{near:75,far:79,lowBias:9},
  grass:{near:39,far:44,lowBias:8},
} as const;
export function detailLimit(kind:keyof typeof DISTRICT_DETAIL,alreadyFar:boolean,low:boolean){
  const item=DISTRICT_DETAIL[kind];
  return (alreadyFar?item.near:item.far)-(low?item.lowBias:0);
}
