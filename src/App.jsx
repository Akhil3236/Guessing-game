import { useCallback, useEffect, useRef, useState } from 'react';
import HigherLower from './games/HigherLower.jsx';
import TicTacToe from './games/TicTacToe.jsx';
import Connect4 from './games/Connect4.jsx';
import RockPaperScissors from './games/RockPaperScissors.jsx';
import Hangman from './games/Hangman.jsx';
import Comms from './Comms.jsx';

const GAMES = {
  'higher-lower': {
    name: 'Higher / Lower',
    icon: '🔢',
    tag: 'Crack the secret number',
    component: HigherLower,
  },
  'tic-tac-toe': {
    name: 'Tic-Tac-Toe',
    icon: '⭕',
    tag: 'Three in a row wins',
    component: TicTacToe,
  },
  'connect-4': {
    name: 'Connect 4',
    icon: '🔴',
    tag: 'Line up four discs',
    component: Connect4,
  },
  'rock-paper-scissors': {
    name: 'Rock Paper Scissors',
    icon: '✊',
    tag: 'Best of five — first to 3',
    component: RockPaperScissors,
  },
  hangman: {
    name: 'Hangman',
    icon: '🔤',
    tag: 'Guess the hidden word',
    component: Hangman,
  },
};
const GAME_ORDER = ['higher-lower', 'tic-tac-toe', 'connect-4', 'rock-paper-scissors', 'hangman'];

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}
function codeFromUrl() {
  const q = new URLSearchParams(window.location.search).get('code') || '';
  return q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}
const onlyDigits = (v) => v.replace(/[^0-9]/g, '').slice(0, 7);

export default function App() {
  const ws = useRef(null);
  const [conn, setConn] = useState('connecting'); // connecting | open | closed
  const [state, setState] = useState(null); // server room state, or null when not in a room
  const [error, setError] = useState('');

  const [picked, setPicked] = useState(null); // game chosen in the lobby
  const [name, setName] = useState('');
  const [code, setCode] = useState(codeFromUrl);
  const [rangeMin, setRangeMin] = useState('1');
  const [rangeMax, setRangeMax] = useState('100');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(wsUrl());
    ws.current = socket;
    socket.onopen = () => setConn('open');
    socket.onclose = () => setConn('closed');
    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'state') {
        setState(msg);
        setError('');
      } else if (msg.type === 'error') {
        setError(msg.message);
      } else if (msg.type === 'chat') {
        window.dispatchEvent(new CustomEvent('arcade-chat', { detail: msg }));
      } else if (msg.type === 'signal') {
        window.dispatchEvent(new CustomEvent('arcade-signal', { detail: msg }));
      }
    };
    return () => socket.close();
  }, []);

  const send = useCallback((payload) => {
    if (ws.current && ws.current.readyState === 1) {
      ws.current.send(JSON.stringify(payload));
    }
  }, []);

  const rangeLo = Number.parseInt(rangeMin, 10);
  const rangeHi = Number.parseInt(rangeMax, 10);
  const rangeValid =
    Number.isInteger(rangeLo) &&
    Number.isInteger(rangeHi) &&
    rangeLo >= 1 &&
    rangeHi <= 1000000 &&
    rangeHi > rangeLo;

  const createGame = () => {
    setError('');
    const payload = { type: 'create', gameType: picked, name };
    if (picked === 'higher-lower') payload.config = { min: rangeMin, max: rangeMax };
    send(payload);
  };
  const joinGame = () => {
    setError('');
    send({ type: 'join', name, code });
  };
  const leave = () => {
    send({ type: 'leave' });
    setState(null);
    setPicked(null);
    setError('');
  };
  const copyInvite = () => {
    const link = `${window.location.origin}/?code=${state.code}`;
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  };

  // --- pick the body ---------------------------------------------------

  let body;

  if (conn === 'closed') {
    body = (
      <section className="screen center">
        <p className="kicker">Connection lost</p>
        <h1>You got disconnected</h1>
        <p className="lede">The link to the game server dropped. Reload to start again.</p>
        <button className="btn primary" type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </section>
    );
  } else if (state && state.phase === 'abandoned') {
    body = (
      <section className="screen center">
        <p className="kicker">Game over</p>
        <h1>Opponent left</h1>
        <p className="lede">
          {state.players[1 - state.you]?.name || 'Your opponent'} disconnected, so the game
          ended.
        </p>
        <button className="btn primary" type="button" onClick={leave}>
          Back to games
        </button>
      </section>
    );
  } else if (state && state.phase === 'waiting') {
    body = (
      <section className="screen center">
        <p className="kicker">{GAMES[state.gameType]?.name}</p>
        <h1>Invite your friend</h1>
        <p className="lede">Share this code. The game starts the moment they join.</p>
        <div className="code-box">{state.code}</div>
        <button className="btn primary" type="button" onClick={copyInvite}>
          {copied ? 'Link copied!' : 'Copy invite link'}
        </button>
        <p className="muted waiting">Waiting for an opponent to join…</p>
        <button className="btn ghost" type="button" onClick={leave}>
          Cancel
        </button>
      </section>
    );
  } else if (state && state.phase === 'started' && state.game) {
    const GameComponent = GAMES[state.gameType].component;
    body = (
      <GameComponent
        game={state.game}
        players={state.players}
        you={state.you}
        send={send}
        onLeave={leave}
        error={error}
      />
    );
  } else if (picked) {
    body = (
      <section className="screen">
        <button
          className="back-link"
          type="button"
          onClick={() => {
            setPicked(null);
            setError('');
          }}
        >
          ← All games
        </button>
        <div className="lobby-head">
          <span className="game-icon big">{GAMES[picked].icon}</span>
          <div>
            <h1>{GAMES[picked].name}</h1>
            <p className="muted">{GAMES[picked].tag}</p>
          </div>
        </div>
        <div className="form">
          <label className="field">
            <span>Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Akhil"
              maxLength={20}
            />
          </label>
          {picked === 'higher-lower' && (
            <div className="field">
              <span>Number range</span>
              <div className="range-row">
                <input
                  inputMode="numeric"
                  aria-label="Lowest number"
                  value={rangeMin}
                  onChange={(e) => setRangeMin(onlyDigits(e.target.value))}
                  placeholder="1"
                />
                <em>to</em>
                <input
                  inputMode="numeric"
                  aria-label="Highest number"
                  value={rangeMax}
                  onChange={(e) => setRangeMax(onlyDigits(e.target.value))}
                  placeholder="100"
                />
              </div>
              <small className={rangeValid ? 'muted' : 'error'}>
                {rangeValid
                  ? `Secret numbers will run from ${rangeLo} to ${rangeHi}.`
                  : 'Whole numbers, 1 and up, with the low below the high.'}
              </small>
            </div>
          )}
          <button
            className="btn primary"
            type="button"
            onClick={createGame}
            disabled={
              conn !== 'open' || !name.trim() || (picked === 'higher-lower' && !rangeValid)
            }
          >
            Create game
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </section>
    );
  } else {
    body = (
      <section className="screen">
        <h1>Pick a game</h1>
        <p className="lede">
          Five two-player games. Choose one, share the code, and play with a friend anywhere.
        </p>
        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Akhil"
            maxLength={20}
          />
        </label>
        <div className="game-grid">
          {GAME_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className="game-card"
              onClick={() => {
                setError('');
                setPicked(id);
              }}
            >
              <span className="game-icon">{GAMES[id].icon}</span>
              <span className="game-name">{GAMES[id].name}</span>
              <span className="game-tag">{GAMES[id].tag}</span>
            </button>
          ))}
        </div>
        <div className="divider">
          <span>or join a friend&apos;s game</span>
        </div>
        <div className="join-row">
          <input
            className="code-input"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
            }
            placeholder="CODE"
            aria-label="Game code"
          />
          <button
            className="btn ghost"
            type="button"
            onClick={joinGame}
            disabled={conn !== 'open' || !name.trim() || code.length < 4}
          >
            Join
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {conn === 'connecting' && <p className="muted">Connecting to the server…</p>}
      </section>
    );
  }

  const inGame =
    state && (state.phase === 'started' || state.phase === 'waiting') && GAMES[state.gameType];

  // Changing this key remounts the body so each new screen animates in.
  let screenKey = 'hub';
  if (conn === 'closed') screenKey = 'closed';
  else if (state && state.phase === 'abandoned') screenKey = 'abandoned';
  else if (state && state.phase === 'waiting') screenKey = 'waiting';
  else if (state && state.phase === 'started' && state.game)
    // Connect 4 keeps a stable key so the body never remounts on the
    // playing→over transition — that lets the winning disc finish its
    // drop animation instead of snapping into place.
    screenKey =
      state.gameType === 'connect-4'
        ? 'game-connect-4'
        : `game-${state.gameType}-${state.game.status}`;
  else if (picked) screenKey = `lobby-${picked}`;

  return (
    <main className="shell">
      <div className="card">
        <header className="top">
          <p className="brand">🕹️ Duel Arcade</p>
          {inGame && (
            <p className="brand-sub">
              {GAMES[state.gameType].icon} {GAMES[state.gameType].name}
            </p>
          )}
        </header>
        <div key={screenKey}>{body}</div>
        {state && state.phase === 'started' && (
          <Comms send={send} you={state.you} players={state.players} />
        )}
      </div>
      <p className="footer">A two-player arcade · share a code and play anywhere</p>
    </main>
  );
}
