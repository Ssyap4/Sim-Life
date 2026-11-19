import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { SOCIAL_SPOTS, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { startServer } from '../server';

function next(socket: WebSocket, accept: (event: ServerPacket) => boolean): Promise<ServerPacket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', handle);
      reject(new Error('Expected a social event'));
    }, 2500);
    function handle(raw: RawData): void {
      let event: ServerPacket;
      try { event = JSON.parse(raw.toString()) as ServerPacket; }
      catch { return; }
      if (!accept(event)) return;
      clearTimeout(timeout);
      socket.off('message', handle);
      resolve(event);
    }
    socket.on('message', handle);
  });
}

async function joinAs(port: number, role: CharacterId, code: string): Promise<WebSocket> {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  await once(socket, 'open');
  const ready = next(socket, (event) => event.type === 'ready' || event.type === 'error');
  socket.send(JSON.stringify({ type: 'auth', role, code }));
  assert.equal((await ready).type, 'ready');
  return socket;
}

test('both players explicitly consent to a synchronized hug with saved mood bonus', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-social-'));
  const server = await startServer({ port: 0, dataDir: dir });
  const sockets: WebSocket[] = [];
  try {
    const codes = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8')) as Record<CharacterId, string>;
    const vlad = await joinAs(server.port, 'vlad', codes.vlad);
    sockets.push(vlad);

    const offline = next(vlad, (event) => event.type === 'error');
    vlad.send(JSON.stringify({ type: 'social_offer', kind: 'hug' }));
    const denied = await offline;
    assert.equal(denied.type, 'error');
    if (denied.type === 'error') assert.match(denied.reason, /не в игре/);

    const alina = await joinAs(server.port, 'alina', codes.alina);
    sockets.push(alina);

    const offerV = next(vlad, (event) => event.type === 'social_offer');
    const offerA = next(alina, (event) => event.type === 'social_offer');
    vlad.send(JSON.stringify({ type: 'social_offer', kind: 'hug' }));
    const [a, b] = await Promise.all([offerV, offerA]);
    assert.deepEqual(a, b);
    assert.equal(a.type, 'social_offer');
    if (a.type !== 'social_offer') throw new Error('Missing offer');

    const forged = next(vlad, (event) => event.type === 'error');
    vlad.send(JSON.stringify({ type: 'social_reply', id: a.id, accept: true }));
    const deniedReply = await forged;
    assert.equal(deniedReply.type, 'error');

    const vladStart = next(vlad, (event) => event.type === 'social_start');
    const alinaStart = next(alina, (event) => event.type === 'social_start');
    const vladState = next(vlad, (event) => event.type === 'snapshot');
    const alinaState = next(alina, (event) => event.type === 'snapshot');
    alina.send(JSON.stringify({ type: 'social_reply', id: a.id, accept: true }));
    assert.equal((await vladStart).type, 'social_start');
    assert.equal((await alinaStart).type, 'social_start');
    const [stateV, stateA] = await Promise.all([vladState, alinaState]);
    assert.deepEqual(stateV, stateA);
    assert.equal(stateV.type, 'snapshot');
    if (stateV.type === 'snapshot') {
      assert.equal(stateV.state.revision, 1);
      assert.equal(stateV.state.money, 2500);
      assert.equal(stateV.state.characters.vlad.mood, 84);
      assert.equal(stateV.state.characters.alina.mood, 91);
      for (const id of ['vlad', 'alina'] as const) {
        assert.equal(stateV.state.characters[id].x, SOCIAL_SPOTS[id].x);
        assert.equal(stateV.state.characters[id].z, SOCIAL_SPOTS[id].z);
      }
    }
    sockets.forEach((s) => s.close());
    await server.close();
    const reloaded = await startServer({ port: 0, dataDir: dir });
    try {
      const reconnect = await joinAs(reloaded.port, 'vlad', codes.vlad);
      reconnect.close();
      const persisted = JSON.parse(readFileSync(join(dir, 'household.json'), 'utf8')) as { revision: number; characters: Record<CharacterId, { mood: number }> };
      assert.equal(persisted.revision, 1);
      assert.equal(persisted.characters.vlad.mood, 84);
      assert.equal(persisted.characters.alina.mood, 91);
    } finally { await reloaded.close(); }
  } finally {
    sockets.forEach((s) => { if (s.readyState === WebSocket.OPEN) s.close(); });
    if (server.httpServer.listening) await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('declining or cancelling a high five never changes family state', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-decline-'));
  const server = await startServer({ port: 0, dataDir: dir });
  const sockets: WebSocket[] = [];
  try {
    const codes = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8')) as Record<CharacterId, string>;
    const a = await joinAs(server.port, 'vlad', codes.vlad);
    const b = await joinAs(server.port, 'alina', codes.alina);
    sockets.push(a, b);
    const invite = next(a, (event) => event.type === 'social_offer');
    b.send(JSON.stringify({ type: 'social_offer', kind: 'highFive' }));
    const response = await invite;
    assert.equal(response.type, 'social_offer');
    if (response.type !== 'social_offer') throw new Error('Missing offer');
    const clearA = next(a, (event) => event.type === 'social_clear');
    const clearB = next(b, (event) => event.type === 'social_clear');
    a.send(JSON.stringify({ type: 'social_reply', id: response.id, accept: false }));
    assert.equal((await clearA).type, 'social_clear');
    assert.equal((await clearB).type, 'social_clear');
    // An invitation and a rejection never write a household save.
    assert.equal(existsSync(join(dir, 'household.json')), false);

    const secondOffer = next(b, (event) => event.type === 'social_offer');
    a.send(JSON.stringify({ type: 'social_offer', kind: 'highFive' }));
    const other = await secondOffer;
    assert.equal(other.type, 'social_offer');
    if (other.type !== 'social_offer') throw new Error('Missing second offer');
    const cancelledA = next(a, (event) => event.type === 'social_clear');
    const cancelledB = next(b, (event) => event.type === 'social_clear');
    a.send(JSON.stringify({ type: 'social_cancel', id: other.id }));
    assert.equal((await cancelledA).type, 'social_clear');
    assert.equal((await cancelledB).type, 'social_clear');
    assert.equal(existsSync(join(dir, 'household.json')), false);
  } finally {
    sockets.forEach((s) => s.close());
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
