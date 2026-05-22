/**
 * Higher / Lower Duel — game server.
 *
 * Serves the built client (in production) and runs the WebSocket game.
 * The server is authoritative: both secret numbers live here and are never
 * sent to the other player until the game is over.
 *
 * The host (room creator) picks the number range. Each player sees only
 * their own guess history — never the opponent's guesses.
 */
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const RANGE_FLOOR = 1;
const RANGE_CEILING = 1000000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily confused chars

// --- HTTP: serve the built client --------------------------------------

const app = express();
const distDir = join(__dirname, '..', 'dist');

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')));
}

const httpServer = createServer(app);

// --- Game state --------------------------------------------------------

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
  return { ws, name: cleanName(name), secret: null };
}

/** Validate the host's chosen range. Returns {min,max} or null. */
function parseRange(min, max) {
  const lo = Number.parseInt(min, 10);
  const hi = Number.parseInt(max, 10);
  if (!Number.isInteger(lo) || !Number.isInteger(hi)) return null;
  if (lo < RANGE_FLOOR || hi > RANGE_CEILING) return null;
  if (hi <= lo) return null;
  return { min: lo, max: hi };
}

/** Validate a number against a room's range. Returns the int or null. */
function parseNumber(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function guessCount(room, index) {
  return room.log.reduce((sum, entry) => sum + (entry.by === index ? 1 : 0), 0);
}

function send(ws, payload) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function bothConnected(room) {
  return room.players.every((p) => p && p.ws && p.ws.readyState === 1);
}

/** Build the slice of state that a given player is allowed to see. */
function viewFor(room, index) {
  const me = room.players[index];
  const opp = room.players[1 - index];
  return {
    type: 'state',
    code: room.code,
    you: index,
    phase: room.phase,
    min: room.min,
    max: room.max,
    turn: room.turn,
    yourTurn: room.phase === 'playing' && room.turn === index,
    me: {
      name: me.name,
      secretSet: me.secret !== null,
      guesses: guessCount(room, index),
    },
    opponent: opp
      ? {
          name: opp.name,
          connected: !!opp.ws && opp.ws.readyState === 1,
          secretSet: opp.secret !== null,
          guesses: guessCount(room, 1 - index),
        }
      : null,
    // Only the player's own guesses — each player's guesses stay private.
    log: room.log.filter((entry) => entry.by === index),
    winner: room.winner,
    endReason: room.endReason,
    // Opponent's number is only ever revealed once the game is over.
    reveal:
      room.phase === 'over'
        ? { yourNumber: me.secret, opponentNumber: opp ? opp.secret : null }
        : null,
  };
}

function broadcast(room) {
  room.players.forEach((p, i) => {
    if (p && p.ws && p.ws.readyState === 1) send(p.ws, viewFor(room, i));
  });
}

// --- Actions -----------------------------------------------------------

function createRoom(ws, name, min, max) {
  const range = parseRange(min, max);
  if (!range) {
    return send(ws, {
      type: 'error',
      message: `Pick a valid range (whole numbers, ${RANGE_FLOOR}–${RANGE_CEILING}, low below high).`,
    });
  }
  detach(ws);
  const room = {
    code: makeCode(),
    players: [makePlayer(ws, name), null],
    phase: 'waiting',
    turn: 0,
    winner: null,
    endReason: null,
    min: range.min,
    max: range.max,
    log: [],
  };
  rooms.set(room.code, room);
  ws.roomCode = room.code;
  ws.playerIndex = 0;
  broadcast(room);
}

function joinRoom(ws, name, code) {
  const room = rooms.get(String(code || '').toUpperCase().trim());
  if (!room) {
    return send(ws, { type: 'error', message: 'No game found with that code.' });
  }
  if (room.players[1]) {
    return send(ws, { type: 'error', message: 'That game is already full.' });
  }
  detach(ws);
  room.players[1] = makePlayer(ws, name);
  ws.roomCode = room.code;
  ws.playerIndex = 1;
  room.phase = 'setup';
  broadcast(room);
}

function setSecret(ws, value) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.phase !== 'setup') return;
  const me = room.players[ws.playerIndex];
  if (!me || me.ws !== ws) return;

  const n = parseNumber(value, room.min, room.max);
  if (n === null) {
    return send(ws, {
      type: 'error',
      message: `Pick a whole number between ${room.min} and ${room.max}.`,
    });
  }
  me.secret = n;

  if (room.players[0].secret !== null && room.players[1].secret !== null) {
    room.phase = 'playing';
    room.turn = Math.random() < 0.5 ? 0 : 1; // random starter is fair
  }
  broadcast(room);
}

function makeGuess(ws, value) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.phase !== 'playing') return;
  const i = ws.playerIndex;
  if (room.turn !== i) return;

  const me = room.players[i];
  const opp = room.players[1 - i];
  if (!me || me.ws !== ws || !opp) return;

  const n = parseNumber(value, room.min, room.max);
  if (n === null) {
    return send(ws, {
      type: 'error',
      message: `Enter a whole number between ${room.min} and ${room.max}.`,
    });
  }

  const hint = n === opp.secret ? 'match' : n < opp.secret ? 'higher' : 'lower';
  room.log.push({ by: i, name: me.name, value: n, hint });

  if (hint === 'match') {
    room.phase = 'over';
    room.winner = i;
    room.endReason = 'win';
  } else {
    room.turn = 1 - i;
  }
  broadcast(room);
}

function rematch(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room || room.phase !== 'over' || room.endReason !== 'win') return;
  if (!bothConnected(room)) return;

  room.players.forEach((p) => {
    p.secret = null;
  });
  room.log = [];
  room.phase = 'setup';
  room.turn = 0;
  room.winner = null;
  room.endReason = null;
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
  const me = room.players[i];
  if (me && me.ws === ws) me.ws = null;

  const other = room.players[1 - i];
  if (other && other.ws && other.ws.readyState === 1) {
    if (room.phase !== 'over') {
      room.phase = 'over';
      room.endReason = 'disconnect';
      room.winner = null;
    }
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
    switch (msg.type) {
      case 'create':
        return createRoom(ws, msg.name, msg.min, msg.max);
      case 'join':
        return joinRoom(ws, msg.name, msg.code);
      case 'secret':
        return setSecret(ws, msg.value);
      case 'guess':
        return makeGuess(ws, msg.value);
      case 'rematch':
        return rematch(ws);
      case 'leave':
        return detach(ws);
      default:
        return;
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
  console.log(`Higher / Lower Duel server listening on :${PORT}`);
});
