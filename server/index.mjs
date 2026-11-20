/**
 * Локальный хост-сервер «Чьё музло?!».
 *
 * Раздаёт собранное приложение (app/dist) и связывает хоста с гостями
 * по WebSocket. Работает в локальной сети, а с флагом --tunnel поднимает
 * ещё и публичный туннель Cloudflare (cloudflared) для удалённых игроков.
 *
 * Запуск:
 *   npm run host          (локальная сеть)
 *   npm run host:tunnel   (локальная сеть + публичная ссылка Cloudflare)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../app/dist');
const PORT = Number(process.env.PORT || 8080);
const USE_TUNNEL = process.argv.includes('--tunnel') || process.env.MUZLO_TUNNEL === '1';

/** Публичный адрес туннеля Cloudflare (появляется асинхронно). */
let publicOrigin = null;
/** 'off' | 'starting' | 'on' | 'error' */
let tunnelStatus = 'off';
let tunnelError = null;
/** Процесс cloudflared (если запущен). */
let tunnelProcess = null;

function startTunnel() {
  if (tunnelProcess || publicOrigin) return;

  tunnelStatus = 'starting';
  tunnelError = null;

  const child = spawn(
    'cloudflared',
    ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  tunnelProcess = child;

  const onData = (buf) => {
    const m = buf.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (m && !publicOrigin) {
      publicOrigin = m[0];
      tunnelStatus = 'on';
      console.log('');
      console.log(`  🌍 Публичная ссылка (Cloudflare Tunnel): ${publicOrigin}`);
      console.log('     Эту ссылку можно отправить удалённым игрокам.');
      console.log('');
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('error', (err) => {
    tunnelProcess = null;
    tunnelStatus = 'error';
    tunnelError =
      err.code === 'ENOENT'
        ? 'cloudflared не найден. Установи: winget install --id Cloudflare.cloudflared -e'
        : err.message;
    console.log('⚠️  ' + tunnelError);
  });

  child.on('exit', (code) => {
    tunnelProcess = null;
    if (!publicOrigin) {
      tunnelStatus = 'error';
      tunnelError = tunnelError || `Туннель завершился (код ${code})`;
    }
  });

  process.on('exit', () => {
    try { child.kill(); } catch { /* ignore */ }
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

/** Первый не-локальный IPv4 — адрес для гостей. */
function lanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=60',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Адрес для гостей (даже если хост открыл приложение через localhost).
  if (url.pathname === '/api/info') {
    const port = (req.headers.host || `localhost:${PORT}`).split(':')[1] || PORT;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        origin: `http://${lanIp()}:${port}`,
        publicOrigin: publicOrigin || undefined,
        tunnelStatus,
        tunnelError: tunnelError || undefined,
      }),
    );
    return;
  }

  // Включить/проверить публичный туннель Cloudflare (кнопка в лобби).
  if (url.pathname === '/api/tunnel') {
    if (req.method === 'POST') startTunnel();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        status: tunnelStatus,
        publicOrigin: publicOrigin || undefined,
        error: tunnelError || undefined,
      }),
    );
    return;
  }

  const rel = decodeURIComponent(url.pathname);
  const candidate = path.normalize(path.join(DIST, rel));
  if (!candidate.startsWith(DIST)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  fs.stat(candidate, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(res, candidate);
      return;
    }
    // SPA-фолбэк: любые пути отдаём index.html.
    const index = path.join(DIST, 'index.html');
    fs.stat(index, (e2) => {
      if (e2) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Сначала соберите приложение: npm run build');
        return;
      }
      sendFile(res, index);
    });
  });
});

// ---------------------------------------------------------------------------
// WebSocket-релей: хост <-> гости
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server, path: '/ws' });
/** code -> { host, guests:Set, state } */
const rooms = new Map();

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { host: null, guests: new Set(), state: null };
    rooms.set(code, room);
  }
  return room;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

wss.on('connection', (ws) => {
  ws.room = null;
  ws.role = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.t === 'host') {
      const room = getRoom(msg.room);
      if (room.host && room.host !== ws) {
        try { room.host.close(); } catch { /* ignore */ }
      }
      room.host = ws;
      ws.room = msg.room;
      ws.role = 'host';
      send(ws, { t: 'ready' });
      return;
    }

    if (msg.t === 'guest') {
      const room = getRoom(msg.room);
      room.guests.add(ws);
      ws.room = msg.room;
      ws.role = 'guest';
      // Опоздавшему гостю сразу отдаём последнее состояние.
      if (room.state) send(ws, { t: 'state', data: room.state });
      return;
    }

    if (msg.t === 'state' && ws.role === 'host') {
      const room = rooms.get(msg.room);
      if (!room) return;
      room.state = msg.data;
      for (const g of room.guests) send(g, { t: 'state', data: msg.data });
      return;
    }

    if (msg.t === 'intent' && ws.role === 'guest') {
      const room = rooms.get(ws.room);
      if (!room || !room.host) return;
      send(room.host, { t: 'intent', data: msg.data });
    }
  });

  ws.on('close', () => {
    const room = ws.room && rooms.get(ws.room);
    if (!room) return;
    if (ws.role === 'host') {
      for (const g of room.guests) send(g, { t: 'host-gone' });
      room.host = null;
    } else {
      room.guests.delete(ws);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  🎧 «Чьё музло?!» — лобби запущено');
  console.log('');
  console.log(`  Экран хоста:        http://localhost:${PORT}`);
  console.log(`  Гости в Wi-Fi:      http://${lanIp()}:${PORT}`);
  console.log('');
  if (USE_TUNNEL) {
    console.log('  Поднимаем туннель Cloudflare для удалённых игроков…');
    startTunnel();
  } else {
    console.log('  Для удалённых игроков: npm run host:tunnel (нужен cloudflared).');
  }
  console.log('  Открой экран хоста — лобби создастся автоматически.');
  console.log('');
});
