/** Shared scenery footprints and daily-life door positions. Never persisted in family saves. */
export const NEIGHBOR_HOMES = [
  { id: 'west-garden', side: 'west', x: -31.7, z: 8.1, yaw: Math.PI / 2,
    width: 7.35, depth: 5.2, plaster: 0xe3d4b8, roof: 0x856651, trim: 0xf4e6cd, shutters: 0x71866b },
  { id: 'west-orchard', side: 'west', x: -31.9, z: -16.2, yaw: Math.PI / 2,
    width: 7.75, depth: 5.45, plaster: 0xc5cba9, roof: 0x765c51, trim: 0xf1e5ca, shutters: 0xa7785a },
  { id: 'rear-cottage', side: 'rear', x: 3.8, z: -29.0, yaw: 0,
    width: 8.65, depth: 5.65, plaster: 0xe7c9ae, roof: 0x8d5e4c, trim: 0xffecd2, shutters: 0x668479 },
  { id: 'east-cottage', side: 'east', x: 36.7, z: -1.2, yaw: -Math.PI / 2,
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
  const sidewalk = home.side === 'rear'
    ? { x: home.x, z: -15.35 }
    : home.side === 'west'
      ? { x: -17.50, z: Math.max(-13.85, Math.min(8.1, home.z)) }
      : { x: 23.50, z: home.z };
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
