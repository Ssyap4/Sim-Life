import type { CharacterId } from '../shared/protocol';

const key = 'sim-life.trusted-device.v1';
type Trust = { role: CharacterId; token: string };
export function trustedDevice(): Trust | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const { role, token } = raw as Partial<Trust>;
    return (role === 'vlad' || role === 'alina') && typeof token === 'string' && /^[\da-f]{64}$/.test(token)
      ? { role, token } : null;
  } catch { return null; }
}
export function storeTrust(value: Trust | null): void {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch { /* The current authenticated session still works in private browsing. */ }
}
