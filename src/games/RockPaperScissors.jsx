import { ResultActions, useCelebrateOnWin } from './shared.jsx';

const CHOICES = [
  { id: 'rock', emoji: '✊', label: 'Rock' },
  { id: 'paper', emoji: '✋', label: 'Paper' },
  { id: 'scissors', emoji: '✌️', label: 'Scissors' },
];
const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };

export default function RockPaperScissors({ game, players, you, send, onLeave, error }) {
  useCelebrateOnWin(game.youWon);
  const opp = players[1 - you]?.name || 'Opponent';
  const canRematch = players.every((p) => p?.connected);

  const scoreBar = (
    <div className="rps-score">
      <div className="rps-score-cell">
        <span>You</span>
        <strong>{game.myScore}</strong>
      </div>
      <div className="rps-meta">
        <span>Round {game.round}</span>
        <small>First to {game.target}</small>
      </div>
      <div className="rps-score-cell">
        <span>{opp}</span>
        <strong>{game.oppScore}</strong>
      </div>
    </div>
  );

  if (game.status === 'over') {
    return (
      <section className="screen center">
        <p className="kicker">Rock Paper Scissors · Game over</p>
        <h1 className={game.youWon ? 'celebrate-title' : ''}>
          {game.youWon ? 'You win the match! 🎉' : `${opp} wins the match`}
        </h1>
        {scoreBar}
        <ResultActions
          canRematch={canRematch}
          onRematch={() => send({ type: 'rematch' })}
          onLeave={onLeave}
        />
      </section>
    );
  }

  if (game.status === 'revealing') {
    const lr = game.lastRound;
    const outcomeText =
      lr.outcome === 'win'
        ? 'You won the round!'
        : lr.outcome === 'loss'
          ? `${opp} won the round`
          : "It's a tie";
    return (
      <section className="screen center">
        <p className="kicker">Rock Paper Scissors · vs {opp}</p>
        <h1>Round {lr.round}</h1>
        {scoreBar}
        <div className="rps-reveal">
          <div className="rps-pick">
            <small>You</small>
            <span className="rps-emoji">{EMOJI[lr.myPick]}</span>
          </div>
          <em className={`rps-outcome out-${lr.outcome}`}>{outcomeText}</em>
          <div className="rps-pick">
            <small>{opp}</small>
            <span className="rps-emoji">{EMOJI[lr.oppPick]}</span>
          </div>
        </div>
        {game.iAmReady ? (
          <p className="lede waiting">Waiting for {opp}…</p>
        ) : (
          <button className="btn primary" type="button" onClick={() => send({ type: 'next' })}>
            Next round
          </button>
        )}
      </section>
    );
  }

  // picking
  return (
    <section className="screen center">
      <p className="kicker">Rock Paper Scissors · vs {opp}</p>
      <h1>Make your move</h1>
      {scoreBar}
      {game.myPick ? (
        <>
          <div className="rps-locked">
            <span className="rps-emoji">{EMOJI[game.myPick]}</span>
          </div>
          <p className="lede waiting">
            {game.oppPicked ? 'Revealing…' : `Locked in. Waiting for ${opp}…`}
          </p>
        </>
      ) : (
        <div className="rps-choices">
          {CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              className="rps-btn"
              onClick={() => send({ type: 'pick', choice: c.id })}
            >
              <span className="rps-emoji">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
