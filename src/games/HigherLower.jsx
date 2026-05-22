import { useState } from 'react';
import { ResultActions, useCelebrateOnWin } from './shared.jsx';

const onlyDigits = (v) => v.replace(/[^0-9]/g, '').slice(0, 7);

export default function HigherLower({ game, players, you, send, onLeave, error }) {
  useCelebrateOnWin(game.youWon);
  const opp = players[1 - you]?.name || 'Opponent';
  const canRematch = players.every((p) => p?.connected);
  const [secretDraft, setSecretDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [guessDraft, setGuessDraft] = useState('');

  const lastMine = game.log.length ? game.log[game.log.length - 1] : null;

  if (game.status === 'setup') {
    return (
      <section className="screen">
        <p className="kicker">Higher / Lower · vs {opp}</p>
        <h1>Set your secret number</h1>
        <p className="range-badge">
          Range {game.min} – {game.max}
        </p>
        {game.mySecretSet ? (
          <>
            <div className="hint hint-match">Your number is locked in.</div>
            <p className="lede waiting">Waiting for {opp} to choose their number…</p>
          </>
        ) : (
          <>
            <p className="lede">
              Pick a number from {game.min} to {game.max}. It stays on the server — {opp} never
              sees it.
            </p>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                send({ type: 'secret', value: secretDraft });
              }}
            >
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
                    onChange={(e) => setSecretDraft(onlyDigits(e.target.value))}
                    placeholder={`${game.min} – ${game.max}`}
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
    );
  }

  if (game.status === 'playing') {
    return (
      <section className="screen">
        <p className="kicker">Higher / Lower · vs {opp}</p>
        <h1>Crack {opp}&apos;s number</h1>
        <div
          key={game.log.length}
          className={`hint hint-${lastMine ? lastMine.hint : 'idle'}`}
        >
          {lastMine
            ? lastMine.hint === 'higher'
              ? `Go higher than ${lastMine.value} ↑`
              : `Go lower than ${lastMine.value} ↓`
            : `Their number is from ${game.min} to ${game.max}`}
        </div>
        {game.yourTurn ? (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (guessDraft === '') return;
              send({ type: 'guess', value: guessDraft });
              setGuessDraft('');
            }}
          >
            <label className="field">
              <span>
                Your guess ({game.min}–{game.max})
              </span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={guessDraft}
                onChange={(e) => setGuessDraft(onlyDigits(e.target.value))}
                placeholder={`${game.min} – ${game.max}`}
                autoFocus
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn primary" type="submit">
              Guess
            </button>
          </form>
        ) : (
          <p className="lede waiting">Waiting for {opp} to guess…</p>
        )}
        <div className="race">
          <div className={`race-cell ${game.yourTurn ? 'turn' : ''}`}>
            <span>You</span>
            <strong>{game.myGuesses}</strong>
            <small>guesses</small>
          </div>
          <div className={`race-cell ${!game.yourTurn ? 'turn' : ''}`}>
            <span>{opp}</span>
            <strong>{game.oppGuesses}</strong>
            <small>guesses</small>
          </div>
        </div>
        {game.log.length > 0 && (
          <div className="feed-wrap">
            <p className="feed-label">Your guesses ({game.log.length})</p>
            <div className="feed">
              {game.log
                .map((e, i) => ({ ...e, num: i + 1 }))
                .reverse()
                .map((e) => (
                  <div key={e.num} className="feed-row">
                    <span className="feed-num">#{e.num}</span>
                    <span className="feed-value">{e.value}</span>
                    <span className={`feed-hint ${e.hint}`}>
                      {e.hint === 'higher' ? '↑ higher' : e.hint === 'lower' ? '↓ lower' : '✓ correct'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  // over
  return (
    <section className="screen center">
      <p className="kicker">Higher / Lower · Game over</p>
      <h1 className={game.youWon ? 'celebrate-title' : ''}>
        {game.youWon ? 'You win! 🎉' : `${opp} wins`}
      </h1>
      <div className="result-grid">
        <div className={`result-cell ${game.youWon ? 'win' : ''}`}>
          <span>Your number</span>
          <strong>{game.reveal?.yourNumber ?? '—'}</strong>
          <small>{game.myGuesses} guesses</small>
        </div>
        <div className={`result-cell ${!game.youWon ? 'win' : ''}`}>
          <span>{opp}&apos;s number</span>
          <strong>{game.reveal?.opponentNumber ?? '—'}</strong>
          <small>{game.oppGuesses} guesses</small>
        </div>
      </div>
      <ResultActions
        canRematch={canRematch}
        onRematch={() => send({ type: 'rematch' })}
        onLeave={onLeave}
      />
    </section>
  );
}
