import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { SOCIAL_SPOTS, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { startServer } from '../server';

function next(ws: WebSocket, check: (packet: ServerPacket) => boolean): Promise<ServerPacket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', receive); reject(new Error('Packet timeout')); }, 2500);
    function receive(raw: RawData): void {
      const packet = JSON.parse(raw.toString()) as ServerPacket;
      if (!check(packet)) return;
      clearTimeout(timer); ws.off('message', receive); resolve(packet);
    }
    ws.on('message', receive);
  });
}
async function joinAs(port: number, role: CharacterId, code: string): Promise<WebSocket> {
  const ws = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  await once(ws, 'open');
  const ready = next(ws, (p) => p.type === 'ready' || p.type === 'error');
  ws.send(JSON.stringify({ type: 'auth', role, code }));
  assert.equal((await ready).type, 'ready');
  return ws;
}
test('Hug immediately syncs both characters without any extra confirmation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-social-'));
  const server = await startServer({ port: 0, dataDir: dir });
  const sockets: WebSocket[] = [];
  try {
    const codes = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8')) as Record<CharacterId,string>;
    const v = await joinAs(server.port, 'vlad', codes.vlad);
    sockets.push(v);
    const offline = next(v, (p) => p.type === 'error');
    v.send(JSON.stringify({ type: 'social_offer', kind: 'hug' }));
    assert.match((await offline as Extract<ServerPacket, {type:'error'}>).reason, /не в игре/);
    const a = await joinAs(server.port, 'alina', codes.alina);
    sockets.push(a);
    const vStart = next(v, (p) => p.type === 'social_start');
    const aStart = next(a, (p) => p.type === 'social_start');
    const vState = next(v, (p) => p.type === 'snapshot' && p.state.revision === 1);
    const aState = next(a, (p) => p.type === 'snapshot' && p.state.revision === 1);
    v.send(JSON.stringify({ type: 'social_offer', kind: 'hug' }));
    assert.deepEqual(await vStart, await aStart);
    const [vSnap, aSnap] = await Promise.all([vState, aState]);
    assert.deepEqual(vSnap, aSnap);
    assert.equal(vSnap.type, 'snapshot');
    if (vSnap.type === 'snapshot') {
      assert.equal(vSnap.state.characters.vlad.mood, 84);
      assert.equal(vSnap.state.characters.alina.mood, 91);
      assert.deepEqual([vSnap.state.characters.vlad.x, vSnap.state.characters.vlad.z],
        [SOCIAL_SPOTS.vlad.x, SOCIAL_SPOTS.vlad.z]);
    }
    const unsolicited = next(v, (p) => p.type === 'error');
    v.send(JSON.stringify({ type: 'social_reply', id: 1, accept: true }));
    assert.equal((await unsolicited).type, 'error');
    const duplicate = next(v, (p) => p.type === 'error');
    v.send(JSON.stringify({ type: 'social_offer', kind: 'hug' }));
    assert.equal((await duplicate).type, 'error');
    assert.equal(JSON.parse(readFileSync(join(dir, 'household.json'), 'utf8')).revision, 1);
  } finally {
    sockets.forEach((ws) => ws.terminate());
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
