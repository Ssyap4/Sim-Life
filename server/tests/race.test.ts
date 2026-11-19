import { GROCERIES } from '../../src/shared/food';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { startServer } from '../server';
import type { ServerPacket } from '../../src/shared/protocol';

function next(socket: WebSocket, predicate: (event: ServerPacket) => boolean): Promise<ServerPacket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off('message', receive); reject(new Error('WebSocket test timed out')); }, 3000);
    function receive(raw: RawData): void {
      const event = JSON.parse(raw.toString()) as ServerPacket;
      if (!predicate(event)) return;
      clearTimeout(timeout); socket.off('message', receive); resolve(event);
    }
    socket.on('message', receive);
  });
}
async function joinRoom(port: number, role: string, code: string): Promise<WebSocket> {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  await once(socket, 'open');
  const handshake = next(socket, (p) => p.type === 'ready' || p.type === 'error');
  socket.send(JSON.stringify({ type: 'auth', role, code }));
  const result = await handshake;
  assert.equal(result.type, 'ready');
  return socket;
}
test('Two simultaneous purchases update shared money exactly twice and reject fast double-spend', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-race-'));
  const server = await startServer({ port: 0, host: '127.0.0.1', dataDir: dir });
  try {
    const keys = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8')) as {vlad:string;alina:string};
    const v = await joinRoom(server.port, 'vlad', keys.vlad);
    const a = await joinRoom(server.port, 'alina', keys.alina);

    const vFinal = next(v, (p) => p.type === 'snapshot' && p.state.revision === 2);
    const aFinal = next(a, (p) => p.type === 'snapshot' && p.state.revision === 2);
    v.send(JSON.stringify({ type: 'buy', item: 'eggs' }));
    a.send(JSON.stringify({ type: 'buy', item: 'eggs' }));

    const [vMessage, aMessage] = await Promise.all([vFinal, aFinal]);
    assert.equal(vMessage.type, 'snapshot');
    assert.equal(aMessage.type, 'snapshot');
    if (vMessage.type === 'snapshot' && aMessage.type === 'snapshot') {
      assert.equal(vMessage.state.money, 2500 - GROCERIES.eggs.price * 2);
      assert.equal(vMessage.state.pantry.eggs, 4 + GROCERIES.eggs.quantity * 2);
      assert.deepEqual(vMessage.state, aMessage.state);
    }

    const rejected = next(v, (p) => p.type === 'error');
    v.send(JSON.stringify({ type: 'buy', item: 'eggs' }));
    assert.equal((await rejected).type, 'error');

    v.close(); a.close();
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
