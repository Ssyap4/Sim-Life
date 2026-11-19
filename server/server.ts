import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import WebSocket, { WebSocketServer, type RawData } from 'ws';
import {
  ACTIONS, names, SOCIAL_LABELS, type ActionId, type CharacterId, type GameState, type ServerPacket,
} from '../src/shared/protocol';
import { applyAction } from './logic';
import { applyFoodAction } from './food';
import { applySocial, otherRole, SOCIAL_COOLDOWN_MS } from './social';
import { openServerFiles } from './storage';

export interface ServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  distDir?: string;
}
export interface RunningServer {
  httpServer: HttpServer;
  port: number;
  close(): Promise<void>;
}
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2',
};
const sameCode = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
const packet = (socket: WebSocket, value: ServerPacket): void => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
};

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const port = options.port ?? 3101;
  const host = options.host ?? '127.0.0.1';
  const files = openServerFiles(options.dataDir ?? resolve('server-data'));
  const distDir = resolve(options.distDir ?? resolve('dist'));
  let state: GameState = files.load();
  const active = new Map<CharacterId, WebSocket>();
  const lastAction = new Map<CharacterId, number>();
  const lastSocial = new Map<CharacterId, number>();
  const online = (): CharacterId[] => Array.from(active.keys());
  const all = (event: ServerPacket): void => {
    for (const socket of active.values()) packet(socket, event);
  };
  const httpServer = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end(); return;
    }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }

    if (pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, version: 2, online: online().length }));
      return;
    }
    if (pathname.includes('\\') || pathname.includes('\0')) {
      res.writeHead(400); res.end(); return;
    }
    const route = pathname === '/' || !extname(pathname) ? '/index.html' : pathname;
    const requested = resolve(distDir, '.' + route);
    const rel = relative(distDir, requested);
    if (rel.startsWith('..') || isAbsolute(rel)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(requested) || !statSync(requested).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found. Run npm run build first.'); return;
    }
    const content = readFileSync(requested);
    res.writeHead(200, {
      'content-type': types[extname(requested)] ?? 'application/octet-stream',
      'cache-control': extname(requested) === '.html' ? 'no-store' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end(); else res.end(content);
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      const tracked = socket as WebSocket & { isAlive?: boolean };
      if (tracked.isAlive === false) { socket.terminate(); continue; }
      tracked.isAlive = false;
      socket.ping();
    }
  }, 15000);
  heartbeat.unref();
  httpServer.on('upgrade', (req, socket, head) => {
    let url: URL;
    try { url = new URL(req.url ?? '', 'http://localhost'); }
    catch { socket.destroy(); return; }
    if (url.pathname !== '/sync') { socket.destroy(); return; }
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) { socket.destroy(); return; }
      } catch { socket.destroy(); return; }
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (socket: WebSocket) => {
    const tracked = socket as WebSocket & { isAlive?: boolean };
    tracked.isAlive = true;
    socket.on('pong', () => { tracked.isAlive = true; });
    let role: CharacterId | null = null;
    let invalidLogins = 0;
    socket.on('message', (raw: RawData, isBinary: boolean) => {
      if (isBinary) { socket.close(1003, 'JSON only'); return; }
      let input: unknown;
      try { input = JSON.parse(raw.toString()); }
      catch { packet(socket, { type: 'error', reason: 'Повреждённое сообщение' }); return; }
      if (!input || typeof input !== 'object' || !('type' in input)) return;
      const message = input as Record<string, unknown>;

      if (!role) {
        if (message.type !== 'auth' ||
            (message.role !== 'vlad' && message.role !== 'alina') ||
            typeof message.code !== 'string') {
          packet(socket, { type: 'error', reason: 'Нужна авторизация персонажа' }); return;
        }
        const requested = message.role;
        if (!sameCode(message.code, files.access[requested])) {
          invalidLogins++;
          packet(socket, { type: 'error', reason: 'Неверный код доступа' });
          if (invalidLogins >= 5) socket.close(1008, 'Too many invalid codes');
          return;
        }
        if (active.has(requested)) {
          packet(socket, { type: 'error', reason: 'Этот персонаж уже занят на другом устройстве' });
          return;
        }
        role = requested;
        active.set(role, socket);
        packet(socket, { type: 'ready', role, state, online: online() });
        all({ type: 'online', online: online() });
        return;
      }

      if (message.type === 'social_offer') {
        if (message.kind !== 'hug' && message.kind !== 'highFive') {
          packet(socket, { type: 'error', reason: 'Неизвестное совместное действие' });
          return;
        }
        const partner = otherRole(role);
        if (!active.has(partner)) {
          packet(socket, { type: 'error', reason: names[partner] + ' пока не в игре' });
          return;
        }
        const now = Date.now();
        if (now - Math.max(lastSocial.get(role) ?? 0, lastSocial.get(partner) ?? 0) < SOCIAL_COOLDOWN_MS) {
          packet(socket, { type: 'error', reason: 'Подожди немного до следующего совместного действия' });
          return;
        }
        const next = applySocial(state, message.kind);
        try { files.save(next); }
        catch (error) {
          console.error('Failed to persist social action:', error);
          packet(socket, { type: 'error', reason: 'Не удалось сохранить совместное действие' });
          return;
        }
        state = next;
        lastSocial.set(role, now);
        lastSocial.set(partner, now);
        all({ type: 'social_start', kind: message.kind,
          message: 'Влад и Алина: ' + SOCIAL_LABELS[message.kind].toLowerCase() + ' ❤️' });
        all({ type: 'snapshot', state });
        return;
      }

      if (message.type === 'buy' || message.type === 'cook' || message.type === 'eat') {
        const now = Date.now();
        if (now - (lastAction.get(role) ?? 0) < 1500) {
          packet(socket, { type: 'error', reason: 'Немного подожди перед следующим действием' });
          return;
        }
        const command = message.type === 'buy'
          ? { type: 'buy' as const, item: typeof message.item === 'string' ? message.item : '' }
          : { type: message.type as 'cook' | 'eat', recipe: typeof message.recipe === 'string' ? message.recipe : '' };
        const result = applyFoodAction(state, role, command);
        if (!result.ok) { packet(socket, { type: 'error', reason: result.reason }); return; }
        try { files.save(result.state); }
        catch (error) {
          console.error('Failed to persist food action:', error);
          packet(socket, { type: 'error', reason: 'Не удалось сохранить продукты' });
          return;
        }
        state = result.state;
        lastAction.set(role, now);
        all({ type: 'food_event', role, action: message.type, message: result.message });
        all({ type: 'snapshot', state });
        return;
      }

      if (message.type !== 'act' || typeof message.actionId !== 'string' ||
          !Object.prototype.hasOwnProperty.call(ACTIONS, message.actionId)) {
        packet(socket, { type: 'error', reason: 'Неизвестная команда' });
        return;
      }
      const now = Date.now();
      if (now - (lastAction.get(role) ?? 0) < 1500) {
        packet(socket, { type: 'error', reason: 'Действие ещё выполняется — немного подожди' });
        return;
      }
      const result = applyAction(state, role, message.actionId);
      if (!result.ok) {
        packet(socket, { type: 'error', reason: result.reason });
        return;
      }
      try { files.save(result.state); }
      catch (error) {
        console.error('Failed to persist game state:', error);
        packet(socket, { type: 'error', reason: 'Не удалось сохранить действие. Попробуй ещё раз' });
        return;
      }
      state = result.state;
      lastAction.set(role, now);
      all({ type: 'action', role, actionId: message.actionId as ActionId, message: result.message });
      all({ type: 'snapshot', state });
    });
    socket.on('close', () => {
      if (role && active.get(role) === socket) {
        active.delete(role);
        all({ type: 'online', online: online() });
      }
    });
    socket.on('error', (error) => console.warn('WebSocket:', error.message));
  });

  await new Promise<void>((done, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.removeListener('error', reject);
      done();
    });
  });
  const addr = httpServer.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  return {
    httpServer, port: actualPort,
    async close(): Promise<void> {
      clearInterval(heartbeat);
      for (const socket of wss.clients) socket.terminate();
      await new Promise<void>((resolveClose) => wss.close(() => resolveClose()));
      await new Promise<void>((resolveClose) => httpServer.close(() => resolveClose()));
    },
  };
}
