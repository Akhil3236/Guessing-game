import { useEffect, useRef, useState } from 'react';
import { ResultActions, useCelebrateOnWin } from './shared.jsx';

export default function Connect4({ game, players, you, send, onLeave, error }) {
  useCelebrateOnWin(game.youWon);
  const opp = players[1 - you]?.name || 'Opponent';
  const canRematch = players.every((p) => p?.connected);
  const over = game.status === 'over';
  const { board, cols, rows } = game;

  // Detect the disc that was just placed so it can animate falling in.
  const [dropped, setDropped] = useState(null); // { index, fallRows }
  const prevBoard = useRef(board);
  useEffect(() => {
    const prev = prevBoard.current;
    if (prev === board) return; // same WS state (incl. StrictMode re-run)
    const added = [];
    for (let k = 0; k < board.length; k += 1) {
      if (prev[k] === null && board[k] !== null) added.push(k);
    }
    // One disc per move; anything else (rematch, reset) clears the animation.
    setDropped(added.length === 1 ? { index: added[0], fallRows: Math.floor(added[0] / cols) } : null);
    prevBoard.current = board;
  }, [board, cols]);

  const statusText = over
    ? game.draw
      ? "It's a draw."
      : game.youWon
        ? 'You win! 🎉'
        : `${opp} wins`
    : game.yourTurn
      ? 'Your turn — drop a disc'
      : `${opp} is thinking…`;

  return (
    <section className="screen center">
      <p className="kicker">Connect 4 · vs {opp}</p>
      <h1 className={over && game.youWon ? 'celebrate-title' : ''}>{statusText}</h1>

      <div className="c4-board">
        {Array.from({ length: cols }, (_, c) => {
          const full = board[c] !== null;
          const clickable = !over && game.yourTurn && !full;
          return (
            <button
              key={c}
              type="button"
              className="c4-col"
              disabled={!clickable}
              onClick={() => clickable && send({ type: 'drop', column: c })}
            >
              {Array.from({ length: rows }, (_, r) => {
                const cellIndex = r * cols + c;
                const v = board[cellIndex];
                const winning = game.line?.includes(cellIndex);
                const isDrop = dropped?.index === cellIndex;
                return (
                  <span
                    key={r}
                    className={`c4-cell ${v !== null ? `disc-${v}` : ''} ${
                      winning ? 'winning' : ''
                    } ${isDrop ? 'dropping' : ''}`}
                    style={isDrop ? { '--fall-rows': dropped.fallRows } : undefined}
                  />
                );
              })}
            </button>
          );
        })}
      </div>

      <p className="muted c4-legend">
        Your disc: <span className={`c4-dot disc-${game.yourDisc}`} />
      </p>

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
