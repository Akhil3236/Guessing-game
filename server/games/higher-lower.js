/**
 * Higher / Lower Duel — each player sets a secret number, then they take
 * turns guessing the other's number with higher/lower hints.
 */
const FLOOR = 1;
const CEILING = 1000000;

function parseConfig(config) {
  const min = Number.parseInt(config?.min, 10);
  const max = Number.parseInt(config?.max, 10);
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
  if (min < FLOOR || max > CEILING || max <= min) return null;
  return { min, max };
}

function parseNumber(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function create(config) {
  return {
    status: 'setup',
    min: config.min,
    max: config.max,
    secrets: [null, null],
    log: [], // { by, value, hint }
    turn: 0,
    winner: null,
  };
}

function setSecret(state, i, msg) {
  if (state.status !== 'setup') return 'Secrets are already locked.';
  const n = parseNumber(msg.value, state.min, state.max);
  if (n === null) return `Pick a whole number between ${state.min} and ${state.max}.`;
  state.secrets[i] = n;
  if (state.secrets[0] !== null && state.secrets[1] !== null) {
    state.status = 'playing';
    state.turn = Math.random() < 0.5 ? 0 : 1;
  }
  return null;
}

function guess(state, i, msg) {
  if (state.status !== 'playing') return 'The game is not in progress.';
  if (state.turn !== i) return 'Wait for your turn.';
  const n = parseNumber(msg.value, state.min, state.max);
  if (n === null) return `Enter a whole number between ${state.min} and ${state.max}.`;
  const target = state.secrets[1 - i];
  const hint = n === target ? 'match' : n < target ? 'higher' : 'lower';
  state.log.push({ by: i, value: n, hint });
  if (hint === 'match') {
    state.status = 'over';
    state.winner = i;
  } else {
    state.turn = 1 - i;
  }
  return null;
}

function view(state, i) {
  return {
    status: state.status,
    min: state.min,
    max: state.max,
    turn: state.turn,
    yourTurn: state.status === 'playing' && state.turn === i,
    mySecretSet: state.secrets[i] !== null,
    oppSecretSet: state.secrets[1 - i] !== null,
    myGuesses: state.log.filter((e) => e.by === i).length,
    oppGuesses: state.log.filter((e) => e.by === 1 - i).length,
    // each player only ever sees their own guesses
    log: state.log.filter((e) => e.by === i),
    winner: state.winner,
    youWon: state.winner === i,
    reveal:
      state.status === 'over'
        ? { yourNumber: state.secrets[i], opponentNumber: state.secrets[1 - i] }
        : null,
  };
}

export default {
  id: 'higher-lower',
  name: 'Higher / Lower Duel',
  parseConfig,
  configError: 'Pick a valid range: whole numbers, 1 and up, low below high.',
  create,
  view,
  handlers: { secret: setSecret, guess },
};
