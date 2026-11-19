import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildFurniture } from '../../src/game/InteriorArt';
import { houseOutline, playOutline, portraitHomeFrame, renderProfile } from '../../src/game/HomeFrame';

test('portrait framing fits the play area across the screen and the cutaway between HUD rows', () => {
  const furniture = new Map<string, THREE.Box3>();
  buildFurniture((id, root) => {
    root.updateMatrixWorld(true);
    furniture.set(id, new THREE.Box3().setFromObject(root));
  });
  const sizes = [[390, 844], [393, 852], [375, 812], [360, 800], [412, 915], [430, 932], [360, 690], [320, 700]];
  for (const [width, height] of sizes) {
    for (const [header, footer] of [[112, 68], [140, 110]]) {
      const band = { top: header / height, bottom: 1 - footer / height };
      const aspect = width / height;
      const fov = 46;
      const frame = portraitHomeFrame(fov, aspect, band);
      const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 90);
      camera.position.copy(frame.position);
      camera.lookAt(frame.target);
      camera.updateMatrixWorld();
      const project = ([x, y, z]: readonly [number, number, number]) => new THREE.Vector3(x, y, z).project(camera);
      const points = playOutline.map(project);
      for (const p of points) assert.ok(Math.abs(p.x) < 0.94 && p.z < 1, `${width}×${height}`);
      for (const p of houseOutline.map(project)) {
        assert.ok((1 - p.y) / 2 > band.top && (1 - p.y) / 2 < band.bottom, `${width}×${height}`);
      }
      for (const [id, { min, max }] of furniture) {
        for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) {
          for (const z of [min.z, max.z]) {
            const p = project([x, y, z]);
            assert.ok(Math.abs(p.x) < 1 && p.z < 1, id + ' cut by a screen edge');
            assert.ok((1 - p.y) / 2 > band.top && (1 - p.y) / 2 < band.bottom, id + ' under the HUD');
          }
        }
      }
      assert.ok((Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) / 2 > 0.87);
    }
  }
});

test('the portrait render budget caps Retina buffers without upscaling 1× devices', () => {
  assert.deepEqual(renderProfile(true, 3), { pixelRatio: 1.25, shadowSize: 768 });
  assert.deepEqual(renderProfile(true, 1), { pixelRatio: 1, shadowSize: 768 });
  assert.deepEqual(renderProfile(false, 3), { pixelRatio: 1.5, shadowSize: 1024 });
});
