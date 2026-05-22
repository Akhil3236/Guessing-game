/**
 * Connect 4 — drop discs into a 7-wide, 6-tall grid; four in a row wins.
 * The board is a flat array, index = row * COLS + col, row 0 at the top.
 */
const COLS = 7;
const ROWS = 6;
const idx = (r, c) => r * COLS + c;

function create() {
  return {
    status: 'playing',
    board: Array(COLS * ROWS).fill(null),
    turn: Math.random() < 0.5 ? 0 : 1,
    winner: null,
    line: null,
  };
}

/** From a just-placed cell, return the winning line (>=4 cells) or null. */
function winningLine(board, row, col, player) {
  const directions = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal ↘
    [1, -1], // diagonal ↙
  ];
  for (const [dr, dc] of directions) {
    const cells = [[row, col]];
    for (let s = 1; ; s += 1) {
      const r = row + dr * s;
      const c = col + dc * s;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[idx(r, c)] !== player) break;
      cells.push([r, c]);
    }
    for (let s = 1; ; s += 1) {
      const r = row - dr * s;
      const c = col - dc * s;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[idx(r, c)] !== player) break;
      cells.unshift([r, c]);
    }
    if (cells.length >= 4) return cells.map(([r, c]) => idx(r, c));
  }
  return null;
}

function drop(state, i, msg) {
  if (state.status !== 'playing') return 'The game is over.';
  if (state.turn !== i) return 'Wait for your turn.';
  const col = Number(msg.column);
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return 'Invalid column.';

  let row = -1;
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (state.board[idx(r, col)] === null) {
      row = r;
      break;
    }
  }
  if (row === -1) return 'That column is full.';

  state.board[idx(row, col)] = i;
  const line = winningLine(state.board, row, col, i);
  if (line) {
    state.status = 'over';
    state.winner = i;
    state.line = line;
  } else if (state.board.every((v) => v !== null)) {
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
    cols: COLS,
    rows: ROWS,
    turn: state.turn,
    yourTurn: state.status === 'playing' && state.turn === i,
    yourDisc: i, // 0 or 1
    winner: state.winner,
    youWon: state.winner === i,
    line: state.line,
    draw: state.status === 'over' && state.winner === null,
  };
}

export default {
  id: 'connect-4',
  name: 'Connect 4',
  create,
  view,
  handlers: { drop },
  // exported for direct testing
  _winningLine: winningLine,
};
