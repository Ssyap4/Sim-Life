import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { inspectionFrame } from '../../src/game/InspectionFrame';

test('inspection fits standing and low silhouettes between the active HUD panels', () => {
  const shapes = [
    new THREE.Box3(new THREE.Vector3(0.15, 0, 3.2), new THREE.Vector3(0.87, 2.05, 3.8)),
    new THREE.Box3(new THREE.Vector3(0.87, 0, 0.02), new THREE.Vector3(1.49, 1.21, 1.22)),
  ];
  const views = [
    { w: 390, h: 844, top: 0.15, bottom: 0.91 },
    { w: 360, h: 690, top: 0.30, bottom: 0.80 },
    { w: 412, h: 915, top: 0.08, bottom: 0.80 },
    { w: 1280, h: 800, top: 0.13, bottom: 0.94 },
  ];
  for (const bounds of shapes) for (const { w, h, top, bottom } of views) {
    const fov = 46;
    const aspect = w / h;
    const { position, target } = inspectionFrame(bounds, new THREE.Vector3(0.62, 0.20, 1),
      fov, aspect, { top, bottom });
    const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 90);
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(p.x) < 0.90);
        assert.ok((1 - p.y) / 2 > top && (1 - p.y) / 2 < bottom);
      }
    }
  }
});
