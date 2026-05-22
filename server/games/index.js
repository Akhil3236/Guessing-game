import higherLower from './higher-lower.js';
import ticTacToe from './tic-tac-toe.js';
import connect4 from './connect-4.js';
import rockPaperScissors from './rock-paper-scissors.js';
import hangman from './hangman.js';

/** Registry of every game the server can host, keyed by game id. */
export const GAMES = {
  'higher-lower': higherLower,
  'tic-tac-toe': ticTacToe,
  'connect-4': connect4,
  'rock-paper-scissors': rockPaperScissors,
  hangman,
};
