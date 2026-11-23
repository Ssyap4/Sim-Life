/** Shared scenery footprints and daily-life door positions. Never persisted in family saves. */
export const REAR_WALK_Z = -15.35;
export const NEIGHBOR_HOMES = [
  { id: 'west-garden', side: 'rear', x: -20.0, z: -25.1, yaw: 0,
    width: 7.35, depth: 5.2, plaster: 0xe3d4b8, roof: 0x856651, trim: 0xf4e6cd, shutters: 0x71866b },
  { id: 'west-orchard', side: 'rear', x: -7.1, z: -25.8, yaw: 0,
    width: 7.75, depth: 5.45, plaster: 0xc5cba9, roof: 0x765c51, trim: 0xf1e5ca, shutters: 0xa7785a },
  { id: 'rear-cottage', side: 'rear', x: 6.7, z: -25.1, yaw: 0,
    width: 8.65, depth: 5.65, plaster: 0xe7c9ae, roof: 0x8d5e4c, trim: 0xffecd2, shutters: 0x668479 },
  { id: 'east-cottage', side: 'rear', x: 20.2, z: -25.8, yaw: 0,
    width: 8.05, depth: 5.45, plaster: 0xd1c6ae, roof: 0x657066, trim: 0xf5e8cf, shutters: 0xa47659 },
] as const;

export type NeighborHome = typeof NEIGHBOR_HOMES[number];
export type NeighborPoint = { x: number; z: number };

export function homePoint(home: NeighborHome, x: number, z: number): NeighborPoint {
  const c = Math.cos(home.yaw), s = Math.sin(home.yaw);
  return { x: home.x + x * c + z * s, z: home.z - x * s + z * c };
}

export function homeStops(home: NeighborHome) {
  const face = home.depth / 2;
  const sidewalk = {x:home.x,z:REAR_WALK_Z};
  return {
    door: homePoint(home, 0, face + .25),
    porch: homePoint(home, 0, face + 1.38),
    flower: homePoint(home, home.width * .16, face + 1.80),
    tea: homePoint(home, -home.width * .22, face + 2.30),
    mail: homePoint(home, home.width * .32, face + 3.58),
    gate: homePoint(home, 0, face + 3.58),
    sidewalk,
  };
}

/** Four distinct private yards, with matching art AND activity locations.
 * This is presentation data only; no friendship/inventory/save migration. */
export const YARD_STYLES = ['tomato','herbs','flowers','cabbage'] as const;
export type YardStyle = typeof YARD_STYLES[number];
export function yardFeatures(home: NeighborHome, index: number) {
  const front=home.depth/2;
  const style=YARD_STYLES[index%YARD_STYLES.length];
  const benchLocal={x:-home.width*.30,z:front+3.02};
  const grillLocal={x:home.width*.34,z:front+2.89};
  const patchLocal={x:home.width*.31,z:front+1.54};
  const flowerLocal={x:-home.width*.32,z:front+1.53};
  const bench=homePoint(home,benchLocal.x,benchLocal.z);
  const grill=homePoint(home,grillLocal.x,grillLocal.z);
  const patch=homePoint(home,patchLocal.x,patchLocal.z);
  const flowers=homePoint(home,flowerLocal.x,flowerLocal.z);
  return {
    style,bench,grill,patch,flowers,
    patchArea:{...patch,w:1.13+(index%2)*.20,d:.97+(index%3)*.08},
    flowerArea:{...flowers,w:1.17,d:.56},
    grillPad:{...grill,w:1.50,d:1.26},
    benchApproach:homePoint(home,-home.width*.15,front+2.27),
    grillApproach:homePoint(home,home.width*.12,front+2.67),
    patchApproach:homePoint(home,home.width*.12,front+1.53),
    flowerApproach:homePoint(home,-home.width*.15,front+1.38),
    benchYaw:home.yaw,
    plantYaw:home.yaw-Math.PI/2,
    grillYaw:home.yaw+Math.PI/2,
  };
}
