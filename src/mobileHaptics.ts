/** Locally configurable, unobtrusive feedback. Haptics require explicit opt-in. */
const STORAGE_KEY = 'simlife-mobile-haptic-v1';

export function hapticsEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
  catch { return false; }
}
export function setHapticsEnabled(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, String(enabled)); }
  catch { /* private browsing can reject storage */ }
}
export function subtleHaptic(kind: 'select' | 'confirm' | 'place' = 'select'): void {
  if (!hapticsEnabled() || typeof navigator.vibrate !== 'function') return;
  // A single short vibration, never a sustained buzzing loop.
  navigator.vibrate(kind === 'confirm' ? 18 : kind === 'place' ? 13 : 9);
}
