import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharacterId } from '../src/shared/protocol';

const TTL = 30 * 24 * 60 * 60 * 1000;
type Device = { digest: string; role: CharacterId; expiresAt: number };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const validToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[\da-f]{64}$/.test(value);

export function openDevices(dataDir: string) {
  const filename = join(dataDir, 'trusted-devices.json');
  let records: Device[] = [];
  if (existsSync(filename)) {
    const parsed: unknown = JSON.parse(readFileSync(filename, 'utf8'));
    if (!Array.isArray(parsed) || !parsed.every(d => d && validToken(d.digest) &&
      (d.role === 'alina' || d.role === 'vlad') && Number.isFinite(d.expiresAt))) {
      throw new Error('Invalid trusted device file');
    }
    records = parsed;
  }
  const persist = (updated: Device[]) => {
    const temporary = filename + '.tmp';
    writeFileSync(temporary, JSON.stringify(updated), { mode: 0o600 });
    renameSync(temporary, filename);
    records = updated;
  };
  return {
    verify(role: CharacterId, token: unknown): token is string {
      if (!validToken(token)) return false;
      const id = digest(token);
      return records.some(record => record.role === role && record.expiresAt > Date.now() && record.digest === id);
    },
    issue(role: CharacterId): string {
      const token = randomBytes(32).toString('hex');
      const now = Date.now();
      const active = records.filter(r => r.expiresAt > now);
      const allowed = active.filter(r => r.role !== role || active.filter(d => d.role === role).slice(-7).includes(r));
      persist([...allowed, { role, digest: digest(token), expiresAt: now + TTL }]);
      return token;
    },
    revoke(token: string): void {
      const id = digest(token);
      persist(records.filter(record => record.digest !== id));
    },
  };
}
