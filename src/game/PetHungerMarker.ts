import * as THREE from 'three';
import type { PetHungerLevel } from '../shared/pets';

type AlertLevel = Exclude<PetHungerLevel, 'normal'>;

// Each badge texture is drawn only once and shared by both pets.
// No fonts, sprite atlases, heavy meshes or per-frame canvas redraws.
const cache: Partial<Record<AlertLevel, THREE.CanvasTexture>> = {};

export function warningTexture(level: AlertLevel): THREE.CanvasTexture {
  const existing = cache[level];
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is required for pet need indicators');

  ctx.clearRect(0, 0, 128, 128);
  ctx.save();
  ctx.shadowColor = 'rgba(31, 31, 31, .36)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.arc(64, 61, 48, 0, 2 * Math.PI);
  ctx.fillStyle = level === 'critical' ? '#cf3f35' : '#e7aa37';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(64, 61, 48, 0, 2 * Math.PI);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff8eb';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 79px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  cache[level] = texture;
  return texture;
}

export function petHungerSprite(): THREE.Sprite | null {
  // Tests and the authoritative server have no DOM; the status calculation
  // remains available to both without attempting to create a texture.
  if (typeof document === 'undefined') return null;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: warningTexture('warning'),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    sizeAttenuation: true,
  }));
  sprite.visible = false;
  sprite.renderOrder = 10;
  return sprite;
}
