import { useEffect, useRef, useState } from 'react';

const MIN = 1;
const MAX = 100;

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

function onlyDigits(value) {
  return value.replace(/[^0-9]/g, '').slice(0, 3);
}

function codeFromUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get('code') || '';
  return fromQuery.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

export default function App() {
  const ws = useRef(null);
  const [conn, setConn] = useState('connecting'); // connecting | open | closed
  const [game, setGame] = useState(null); // latest server state, or null at home
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState(codeFromUrl);
  const [secretDraft, setSecretDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [guessDraft, setGuessDraft] = useState('');
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
        setGame(msg);
        setError('');
      } else if (msg.type === 'error') {
        setError(msg.message);
      }
    };
    return () => socket.close();
  }, []);

  const send = (payload) => {
    if (ws.current && ws.current.readyState === 1) {
      ws.current.send(JSON.stringify(payload));
    }
  };

  // --- actions ---------------------------------------------------------

  const createGame = () => {
    setError('');
    send({ type: 'create', name });
  };
  const joinGame = () => {
    setError('');
    send({ type: 'join', name, code });
  };
  const lockSecret = (event) => {
    event.preventDefault();
    send({ type: 'secret', value: secretDraft });
  };
  const submitGuess = (event) => {
    event.preventDefault();
    if (guessDraft === '') return;
    send({ type: 'guess', value: guessDraft });
    setGuessDraft('');
  };
  const playAgain = () => {
    setSecretDraft('');
    setReveal(false);
    setGuessDraft('');
    send({ type: 'rematch' });
  };
  const newGame = () => {
    send({ type: 'leave' });
    setGame(null);
    setSecretDraft('');
    setReveal(false);
    setGuessDraft('');
    setError('');
  };

  const copyInvite = () => {
    const link = `${window.location.origin}/?code=${game.code}`;
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  };

  // --- screen helpers --------------------------------------------------

  const phase = game ? game.phase : 'home';
  const step =
    phase === 'home' || phase === 'waiting'
      ? 1
      : phase === 'setup'
        ? 2
        : phase === 'playing'
          ? 3
          : 4;

  const lastHint = game && game.history.length ? game.history[game.history.length - 1] : null;

  return (
    <main className="shell">
      <div className="card">
        <header className="top">
          <p className="brand">Higher / Lower Duel</p>
          <ol className="steps" aria-label="Game progress">
            {['Lobby', 'Secrets', 'Duel', 'Result'].map((label, i) => (
              <li
                key={label}
                className={`step ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'done' : ''}`}
              >
                {label}
              </li>
            ))}
          </ol>
        </header>

        {/* Connection lost — covers everything else */}
        {conn === 'closed' && (
          <section className="screen center">
            <p className="kicker">Connection lost</p>
            <h1>You got disconnected</h1>
            <p className="lede">
              The link to the game server dropped. Reload to start again.
            </p>
            <button className="btn primary" type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </section>
        )}

        {/* Home / lobby */}
        {conn !== 'closed' && phase === 'home' && (
          <section className="screen">
            <h1>Play a friend, anywhere</h1>
            <p className="lede">
              Two players, two devices. Each picks a secret number from {MIN} to {MAX} — then you
              race to crack each other&apos;s number with higher / lower hints.
            </p>
            <div className="form">
              <label className="field">
                <span>Your name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Akhil"
                  maxLength={20}
                />
              </label>

              <button
                className="btn primary"
                type="button"
                onClick={createGame}
                disabled={conn !== 'open' || !name.trim()}
              >
                Create a game
              </button>

              <div className="divider"><span>or join with a code</span></div>

              <div className="join-row">
                <input
                  className="code-input"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
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
            </div>
          </section>
        )}

        {/* Waiting for opponent */}
        {conn !== 'closed' && phase === 'waiting' && (
          <section className="screen center">
            <p className="kicker">Game created</p>
            <h1>Invite your friend</h1>
            <p className="lede">Share this code. The game starts the moment they join.</p>
            <div className="code-box">{game.code}</div>
            <button className="btn primary" type="button" onClick={copyInvite}>
              {copied ? 'Link copied!' : 'Copy invite link'}
            </button>
            <p className="muted waiting">Waiting for an opponent to join…</p>
            <button className="btn ghost" type="button" onClick={newGame}>
              Cancel
            </button>
          </section>
        )}

        {/* Choose secret number */}
        {conn !== 'closed' && phase === 'setup' && (
          <section className="screen">
            <p className="kicker">Playing against {game.opponent?.name}</p>
            <h1>Set your secret number</h1>
            {game.me.secretSet ? (
              <>
                <div className="hint hint-match">Your number is locked in.</div>
                <p className="lede waiting">
                  Waiting for {game.opponent?.name} to choose their number…
                </p>
              </>
            ) : (
              <>
                <p className="lede">
                  Pick a number from {MIN} to {MAX}. It stays on the server —
                  {' '}{game.opponent?.name} never sees it.
                </p>
                <form className="form" onSubmit={lockSecret}>
                  <label className="field">
                    <span>Your secret number</span>
                    <div className="secret-row">
                      <input
                        name="s"
                        type={reveal ? 'text' : 'password'}
                        inputMode="numeric"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={secretDraft}
                        onChange={(event) => setSecretDraft(onlyDigits(event.target.value))}
                        placeholder={`${MIN} – ${MAX}`}
                      />
                      <button
                        className="btn ghost eye"
                        type="button"
                        onClick={() => setReveal((v) => !v)}
                      >
                        {reveal ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>
                  {error && <p className="error">{error}</p>}
                  <button className="btn primary" type="submit">
                    Lock it in
                  </button>
                </form>
              </>
            )}
          </section>
        )}

        {/* The duel */}
        {conn !== 'closed' && phase === 'playing' && (
          <section className="screen">
            <p className="kicker">You vs {game.opponent?.name}</p>
            <h1>Crack {game.opponent?.name}&apos;s number</h1>

            <div className={`hint hint-${lastHint ? lastHint.hint : 'idle'}`}>
              {lastHint
                ? lastHint.hint === 'higher'
                  ? `Go higher than ${lastHint.value} ↑`
                  : `Go lower than ${lastHint.value} ↓`
                : `Their number is somewhere from ${MIN} to ${MAX}`}
            </div>

            {game.yourTurn ? (
              <form className="form" onSubmit={submitGuess}>
                <label className="field">
                  <span>Your guess</span>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={guessDraft}
                    onChange={(event) => setGuessDraft(onlyDigits(event.target.value))}
                    placeholder={`${MIN} – ${MAX}`}
                    autoFocus
                  />
                </label>
                {error && <p className="error">{error}</p>}
                <button className="btn primary" type="submit">
                  Guess
                </button>
              </form>
            ) : (
              <p className="lede waiting">Waiting for {game.opponent?.name} to guess…</p>
            )}

            <div className="race">
              <div className={`race-cell ${game.yourTurn ? 'turn' : ''}`}>
                <span>You</span>
                <strong>{game.me.guesses}</strong>
                <small>guesses</small>
              </div>
              <div className={`race-cell ${!game.yourTurn ? 'turn' : ''}`}>
                <span>{game.opponent?.name}</span>
                <strong>{game.opponent?.guesses ?? 0}</strong>
                <small>guesses</small>
              </div>
            </div>

            {game.history.length > 0 && (
              <div className="history">
                {game.history.map((item, i) => (
                  <span key={`${item.value}-${i}`} className={`chip chip-${item.hint}`}>
                    {item.value}
                    {item.hint === 'higher' ? ' ↑' : item.hint === 'lower' ? ' ↓' : ' ✓'}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Result */}
        {conn !== 'closed' && phase === 'over' && (
          <section className="screen center">
            {game.endReason === 'disconnect' ? (
              <>
                <p className="kicker">Game over</p>
                <h1>{game.opponent?.name || 'Your opponent'} left</h1>
                <p className="lede">The other player disconnected, so the game ended.</p>
                <button className="btn primary" type="button" onClick={newGame}>
                  Back to lobby
                </button>
              </>
            ) : (
              <>
                <p className="kicker">Game over</p>
                <h1>{game.winner === game.you ? 'You win! 🎉' : `${game.opponent?.name} wins`}</h1>
                <div className="result-grid">
                  <div className={`result-cell ${game.winner === game.you ? 'win' : ''}`}>
                    <span>Your number</span>
                    <strong>{game.reveal?.yourNumber ?? '—'}</strong>
                  </div>
                  <div className={`result-cell ${game.winner !== game.you ? 'win' : ''}`}>
                    <span>{game.opponent?.name}&apos;s number</span>
                    <strong>{game.reveal?.opponentNumber ?? '—'}</strong>
                  </div>
                </div>
                <div className="form">
                  {game.opponent?.connected && (
                    <button className="btn primary" type="button" onClick={playAgain}>
                      Play again
                    </button>
                  )}
                  <button className="btn ghost" type="button" onClick={newGame}>
                    Back to lobby
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
