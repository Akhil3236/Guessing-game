/**
 * Duel Arcade — game server.
 *
 * Serves the built client (in production) and runs every game over one
 * WebSocket. The server is authoritative: each game module decides what
 * slice of state a player is allowed to see, so secrets never leak.
 */
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { GAMES } from './games/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily confused chars

// --- HTTP: serve the built client --------------------------------------

const app = express();
const distDir = join(__dirname, '..', 'dist');

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')));
}

const httpServer = createServer(app);

// --- Rooms -------------------------------------------------------------

/** @type {Map<string, Room>} code -> room */
const rooms = new Map();

function makeCode() {
  let code;
  do {
    code = Array.from(
      { length: 4 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  return String(name || '').trim().slice(0, 20) || 'Player';
}

function makePlayer(ws, name) {
  return { ws, name: cleanName(name) };
}

function send(ws, payload) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function bothConnected(room) {
  return room.players.every((p) => p && p.ws && p.ws.readyState === 1);
}

/** Build the slice of state a given player is allowed to see. */
function viewFor(room, index) {
  const module = GAMES[room.gameType];
  return {
    type: 'state',
    code: room.code,
    gameType: room.gameType,
    you: index,
    phase: room.phase, // waiting | started | abandoned
    players: room.players.map((p) =>
      p ? { name: p.name, connected: !!p.ws && p.ws.readyState === 1 } : null,
    ),
    game: room.game ? module.view(room.game, index) : null,
  };
}

function broadcast(room) {
  room.players.forEach((p, i) => {
    if (p && p.ws && p.ws.readyState === 1) send(p.ws, viewFor(room, i));
  });
}

// --- Actions -----------------------------------------------------------

function createRoom(ws, msg) {
  const module = GAMES[msg.gameType];
  if (!module) return send(ws, { type: 'error', message: 'Unknown game.' });

  let config = {};
  if (module.parseConfig) {
    config = module.parseConfig(msg.config);
    if (config === null) {
      return send(ws, { type: 'error', message: module.configError || 'Invalid game settings.' });
    }
  }

  detach(ws);
  const room = {
    code: makeCode(),
    gameType: msg.gameType,
    config,
    players: [makePlayer(ws, msg.name), null],
    phase: 'waiting',
    game: null,
  };
  rooms.set(room.code, room);
  ws.roomCode = room.code;
  ws.playerIndex = 0;
  broadcast(room);
}

function joinRoom(ws, msg) {
  const room = rooms.get(String(msg.code || '').toUpperCase().trim());
  if (!room) return send(ws, { type: 'error', message: 'No game found with that code.' });
  if (room.players[1]) return send(ws, { type: 'error', message: 'That game is already full.' });

  detach(ws);
  room.players[1] = makePlayer(ws, msg.name);
  ws.roomCode = room.code;
  ws.playerIndex = 1;
  room.phase = 'started';
  room.game = GAMES[room.gameType].create(room.config);
  broadcast(room);
}

function handleGameMessage(ws, msg) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.phase !== 'started' || !room.game) return;
  const handler = GAMES[room.gameType].handlers[msg.type];
  if (!handler) return;
  const error = handler(room.game, ws.playerIndex, msg);
  if (error) return send(ws, { type: 'error', message: error });
  broadcast(room);
}

function rematch(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.phase !== 'started' || !room.game) return;
  if (room.game.status !== 'over') return;
  if (!bothConnected(room)) return;
  const module = GAMES[room.gameType];
  room.game = module.rematch
    ? module.rematch(room.config, room.game)
    : module.create(room.config);
  broadcast(room);
}

/** Remove a socket from its room, ending or cleaning up as needed. */
function detach(ws) {
  const code = ws.roomCode;
  ws.roomCode = null;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;

  const i = ws.playerIndex;
  if (room.players[i] && room.players[i].ws === ws) room.players[i].ws = null;

  const other = room.players[1 - i];
  if (other && other.ws && other.ws.readyState === 1) {
    if (room.phase !== 'abandoned') room.phase = 'abandoned';
    broadcast(room);
  } else {
    rooms.delete(code);
  }
}

// --- WebSocket wiring --------------------------------------------------

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.roomCode = null;
  ws.playerIndex = -1;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg?.type !== 'string') return;
    switch (msg.type) {
      case 'create':
        return createRoom(ws, msg);
      case 'join':
        return joinRoom(ws, msg);
      case 'rematch':
        return rematch(ws);
      case 'leave':
        return detach(ws);
      default:
        return handleGameMessage(ws, msg);
    }
  });

  ws.on('close', () => detach(ws));
  ws.on('error', () => {});
});

// Drop sockets that have gone silent (idle proxies, asleep laptops).
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

httpServer.listen(PORT, () => {
  console.log(`Duel Arcade server listening on :${PORT}`);
});
