import { useState } from 'react';
import { ResultActions, useCelebrateOnWin } from './shared.jsx';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function Figure({ wrong }) {
  const show = (n) => wrong >= n;
  return (
    <svg className="hm-figure" viewBox="0 0 120 150" aria-hidden="true">
      <g className="hm-gallows">
        <line x1="8" y1="144" x2="74" y2="144" />
        <line x1="30" y1="144" x2="30" y2="10" />
        <line x1="30" y1="10" x2="84" y2="10" />
        <line x1="84" y1="10" x2="84" y2="24" />
      </g>
      <g className="hm-body">
        {show(1) && <circle cx="84" cy="38" r="13" />}
        {show(2) && <line x1="84" y1="51" x2="84" y2="98" />}
        {show(3) && <line x1="84" y1="62" x2="66" y2="80" />}
        {show(4) && <line x1="84" y1="62" x2="102" y2="80" />}
        {show(5) && <line x1="84" y1="98" x2="68" y2="122" />}
        {show(6) && <line x1="84" y1="98" x2="100" y2="122" />}
      </g>
    </svg>
  );
}

export default function Hangman({ game, players, you, send, onLeave, error }) {
  useCelebrateOnWin(game.youWon);
  const opp = players[1 - you]?.name || 'Opponent';
  const canRematch = players.every((p) => p?.connected);
  const [wordDraft, setWordDraft] = useState('');
  const [hintDraft, setHintDraft] = useState('');

  if (game.status === 'setup') {
    if (game.youAreSetter) {
      return (
        <section className="screen">
          <p className="kicker">Hangman · vs {opp}</p>
          <h1>Choose a secret word</h1>
          <p className="lede">
            3–16 letters, no spaces. {opp} will try to guess it before the figure is drawn.
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              send({ type: 'word', value: wordDraft, hint: hintDraft });
            }}
          >
            <label className="field">
              <span>Secret word</span>
              <input
                value={wordDraft}
                onChange={(e) =>
                  setWordDraft(e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 16).toUpperCase())
                }
                placeholder="e.g. PUZZLE"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="hm-word-input"
              />
            </label>
            <label className="field">
              <span>Hint for {opp} (optional)</span>
              <input
                value={hintDraft}
                onChange={(e) => setHintDraft(e.target.value.slice(0, 80))}
                placeholder="e.g. A board game, or: rhymes with riddle"
                autoComplete="off"
                maxLength={80}
              />
              <small className="muted">
                A category or clue makes it fairer. Leave it blank for a tough round.
              </small>
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn primary" type="submit" disabled={wordDraft.length < 3}>
              Lock in the word
            </button>
          </form>
        </section>
      );
    }
    return (
      <section className="screen center">
        <p className="kicker">Hangman · vs {opp}</p>
        <h1>Get ready to guess</h1>
        <p className="lede waiting">Waiting for {opp} to choose a secret word…</p>
      </section>
    );
  }

  const over = game.status === 'over';
  const statusText = over
    ? game.youWon
      ? game.youAreSetter
        ? 'Your word held! 🎉'
        : 'You guessed it! 🎉'
      : game.youAreSetter
        ? `${opp} cracked your word`
        : 'The figure is complete'
    : game.youAreSetter
      ? `${opp} is guessing…`
      : 'Guess a letter';

  return (
    <section className="screen center">
      <p className="kicker">Hangman · vs {opp}</p>
      <h1 className={over && game.youWon ? 'celebrate-title' : ''}>{statusText}</h1>

      {game.hint && (
        <p className="hm-hint">
          <span className="hm-hint-tag">💡 Hint</span>
          {game.hint}
        </p>
      )}

      <div className="hm-stage">
        <Figure wrong={game.wrongCount} />
        <div className="hm-lives">
          <strong>{game.maxWrong - game.wrongCount}</strong>
          <small>guesses left</small>
        </div>
      </div>

      <div className="hm-word">
        {game.letters.map((l, i) => (
          <span key={i} className={`hm-slot ${l.char ? 'filled' : ''}`}>
            {l.char || ''}
          </span>
        ))}
      </div>

      {over && game.word && !game.youWon && (
        <p className="lede">
          The word was <strong>{game.word}</strong>.
        </p>
      )}

      {!over && !game.youAreSetter && (
        <div className="keyboard">
          {ALPHABET.map((letter) => {
            const hit = game.guessed.includes(letter);
            const miss = game.missed.includes(letter);
            return (
              <button
                key={letter}
                type="button"
                className={`key ${hit ? 'hit' : ''} ${miss ? 'miss' : ''}`}
                disabled={hit || miss}
                onClick={() => send({ type: 'letter', letter })}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {game.missed.length > 0 && (
        <p className="muted hm-missed">Missed: {game.missed.join(' ')}</p>
      )}

      {error && <p className="error">{error}</p>}
      {over && (
        <ResultActions
          canRematch={canRematch}
          onRematch={() => send({ type: 'rematch' })}
          onLeave={onLeave}
        />
      )}
    </section>
  );
}
