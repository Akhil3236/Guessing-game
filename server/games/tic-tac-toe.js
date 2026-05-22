/**
 * Tic-Tac-Toe — player 0 is X, player 1 is O. Random first move.
 */
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function create() {
  return {
    status: 'playing',
    board: Array(9).fill(null),
    turn: Math.random() < 0.5 ? 0 : 1,
    winner: null,
    line: null,
  };
}

function mark(state, i, msg) {
  if (state.status !== 'playing') return 'The game is over.';
  if (state.turn !== i) return 'Wait for your turn.';
  const cell = Number(msg.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return 'Invalid cell.';
  if (state.board[cell] !== null) return 'That square is taken.';

  state.board[cell] = i;
  for (const line of LINES) {
    if (line.every((c) => state.board[c] === i)) {
      state.status = 'over';
      state.winner = i;
      state.line = line;
      return null;
    }
  }
  if (state.board.every((v) => v !== null)) {
    state.status = 'over';
    state.winner = null; // draw
  } else {
    state.turn = 1 - i;
  }
  return null;
}

function view(state, i) {
  return {
    status: state.status,
    board: state.board,
    turn: state.turn,
    yourTurn: state.status === 'playing' && state.turn === i,
    yourMark: i, // 0 = X, 1 = O
    winner: state.winner,
    youWon: state.winner === i,
    line: state.line,
    draw: state.status === 'over' && state.winner === null,
  };
}

export default {
  id: 'tic-tac-toe',
  name: 'Tic-Tac-Toe',
  create,
  view,
  handlers: { mark },
};
