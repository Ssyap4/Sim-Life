import * as THREE from 'three';
import { batchRigidParts } from './ArtKit';
import { lettering, part, paving, round, trim, type LocationResources } from './LocationArt';
import { marketCashier } from './MarketArt';
import type { Station } from '../shared/locations';

const cream = 0xf1e0bd;
const denim = 0x58778a;
const teal = 0x537c71;
const ochre = 0xa9825c;

export function buildEducationCenter(floor: THREE.Group, resources: LocationResources) {
  trim(floor, [12.3, .40, 10.3], [0, -.23, 0], 0x777c70);
  paving(floor, resources, 12, 10, 0, ctx => {
    ctx.fillStyle = '#e0d1b8'; ctx.fillRect(-6, -5, 12, 10);
    for (let row = 0; row < 19; row++) for (let col = -1; col < 20; col++) {
      ctx.fillStyle = ['#d9cbb4', '#e5d9c5', '#ded0bb'][(row * 7 + col + 3) % 3];
      ctx.fillRect(-6 + col * .65 + row % 2 * .30, -5 + row * .56, .639, .548);
    }
    for (const [x, color] of [[-3.36, '#bdc7b5'], [0, '#aebfc7'], [3.53, '#d0b193']] as const) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x - 1.47, -3.04, 2.94, 2.48, .17); ctx.fill();
    }
    ctx.fillStyle = '#6d9791'; ctx.fillRect(-2.96, 4.28, .80, .51);
  }, 0xdacbb4);
  trim(floor, [12.22, 2.60, .20], [0, 1.30, -4.92], 0xc7d3c4);
  trim(floor, [.20, 2.60, 9.92], [-6.04, 1.30, -.04], 0xd5c7ad);
  part(floor, [12, .76, .06], [0, .42, -4.79], teal);
  for (const x of [-4.25, 4.20]) {
    trim(floor, [2.08, 1.02, .09], [x, 1.66, -4.76], cream);
    part(floor, [1.86, .82, .035], [x, 1.66, -4.699], 0x91b4b2);
    part(floor, [.045, .85, .053], [x, 1.66, -4.67], cream);
    part(floor, [2.17, .07, .21], [x, 1.11, -4.70], ochre);
  }
  trim(floor, [3.03, 1.23, .108], [0, 1.65, -4.75], ochre);
  lettering(floor, resources, [0, 1.65, -4.68], 2.86, 1.06, 'ПОТЕНЦИАЛ', ['#355e59', '#f4e6c9'], 'Аудитория • Класс • Мастерская');
  for (const x of [-5.48, 5.47]) {
    round(floor, .28, .34, [x, .17, -4.25], 0xb17760);
    for (const dx of [-.13, .15]) trim(floor, [.22, .49, .21], [x + dx, .52, -4.24], 0x679177);
  }
  for (const [x, title, color] of [[-3.65, 'Администратор', 0x647886], [1.80, 'Преподаватель', 0x47776a]] as const) {
    const teacher = marketCashier(resources, { title, color });
    teacher.position.set(x, 0, x < 0 ? .76 : -3.64);
    floor.add(teacher);
  }
}

const roomColors = { classroom: teal, lab: denim, workshop: ochre, reception: 0x6d927a };
export function educationStation(station: Station, resources: LocationResources) {
  if (station.action.kind !== 'education') return null;
  const room = station.action.room, color = roomColors[room];
  const group = new THREE.Group();
  group.position.set(station.center.x, 0, station.center.z);
  const deskWidth = station.width - .08;
  trim(group, [deskWidth, .13, .69], [0, .80, -.16], ochre);
  for (const x of [-deskWidth * .42, deskWidth * .42])
    trim(group, [.11, .75, .54], [x, .385, -.16], color);
  part(group, [deskWidth - .32, .44, .055], [0, .53, -.06], color);
  if (room === 'reception') {
    trim(group, [.66, .055, .27], [-.44, .895, .01], cream);
    trim(group, [.36, .33, .07], [.49, 1.03, -.22], denim);
  } else for (const x of [-.63, .63]) {
    for (const z of [.46, .76]) for (const dx of [-.23, .23])
      part(group, [.078, .44, .075], [x + dx, .22, z], ochre);
    trim(group, [.56, .095, .42], [x, .477, .61], color);
    trim(group, [.54, .39, .08], [x, .73, .81], color);
    if (room === 'lab') {
      trim(group, [.52, .32, .08], [x, 1.08, -.267], 0x30474b);
      part(group, [.44, .246, .014], [x, 1.085, -.22], 0x79aaa5);
      part(group, [.37, .033, .17], [x, .894, -.02], 0x3f515d);
    } else {
      trim(group, [.35, .035, .22], [x, .883, -.10], room === 'classroom' ? cream : 0xbac0a4);
      part(group, [.22, .023, .043], [x + .045, .916, -.087], room === 'classroom' ? teal : 0xb65f42);
    }
  }
  lettering(group, resources, [0, 1.49, -.46], station.width, .30, station.name, ['#f2e1c4', '#314e49']);
  batchRigidParts(group, true);
  return group;
}
