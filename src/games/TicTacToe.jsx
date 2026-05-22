import { ResultActions, useCelebrateOnWin } from './shared.jsx';

const MARKS = ['X', 'O'];

export default function TicTacToe({ game, players, you, send, onLeave, error }) {
  useCelebrateOnWin(game.youWon);
  const opp = players[1 - you]?.name || 'Opponent';
  const canRematch = players.every((p) => p?.connected);
  const over = game.status === 'over';

  const statusText = over
    ? game.draw
      ? "It's a draw."
      : game.youWon
        ? 'You win! 🎉'
        : `${opp} wins`
    : game.yourTurn
      ? `Your turn — you're ${MARKS[game.yourMark]}`
      : `${opp} is thinking…`;

  return (
    <section className="screen center">
      <p className="kicker">Tic-Tac-Toe · vs {opp}</p>
      <h1 className={over && game.youWon ? 'celebrate-title' : ''}>{statusText}</h1>

      <div className="ttt-board">
        {game.board.map((cell, i) => {
          const winning = game.line?.includes(i);
          const clickable = !over && game.yourTurn && cell === null;
          return (
            <button
              key={i}
              type="button"
              className={`ttt-cell ${cell !== null ? `mark-${cell}` : ''} ${
                winning ? 'winning' : ''
              }`}
              disabled={!clickable}
              onClick={() => clickable && send({ type: 'mark', cell: i })}
            >
              {cell !== null ? MARKS[cell] : ''}
            </button>
          );
        })}
      </div>

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
