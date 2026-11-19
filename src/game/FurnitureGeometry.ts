import * as THREE from 'three';

/**
 * Low-poly upholstery with a broad crown, rounded corners and a tucked seam.
 * Horizontal sections specify height, footprint and corner radius.
 */
const sections = [
  [-0.50, 0.40, 0.13], [-0.37, 0.48, 0.17], [-0.12, 0.50, 0.18],
  [0.17, 0.493, 0.18], [0.38, 0.45, 0.155], [0.47, 0.35, 0.125],
] as const;
const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]] as const;
const arcSteps = 3;
const ringSize = corners.length * (arcSteps + 1);
const positions: number[] = [];
const uvs: number[] = [];
const indices: number[] = [];
for (const [y, span, radius] of sections) {
  corners.forEach(([sx, sz], corner) => {
    for (let step = 0; step <= arcSteps; step++) {
      const angle = (corner + step / arcSteps) * (Math.PI / 2);
      const x = sx * (span - radius) + Math.sin(angle) * radius;
      const z = sz * (span - radius) + Math.cos(angle) * radius;
      positions.push(x, y, z);
      uvs.push(x + 0.5, z + 0.5);
    }
  });
}
for (let row = 0; row < sections.length - 1; row++) {
  for (let i = 0; i < ringSize; i++) {
    const a = row * ringSize + i;
    const b = row * ringSize + (i + 1) % ringSize;
    indices.push(a, b, a + ringSize, b, b + ringSize, a + ringSize);
  }
}
for (const [offset, y] of [[0, -0.5], [(sections.length - 1) * ringSize, 0.5]]) {
  const center = positions.length / 3;
  positions.push(0, y, 0);
  uvs.push(0.5, 0.5);
  for (let i = 0; i < ringSize; i++) {
    const a = i + offset;
    const b = (i + 1) % ringSize + offset;
    indices.push(center, y > 0 ? a : b, y > 0 ? b : a);
  }
}
export const cushionGeometry = new THREE.BufferGeometry();
cushionGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
cushionGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
cushionGeometry.setIndex(indices);
cushionGeometry.computeVertexNormals();
