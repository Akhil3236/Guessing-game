/**
 * Hangman — one player sets a secret word, the other guesses letters
 * before the figure is fully drawn. Roles swap on a rematch.
 */
const MAX_WRONG = 6;

function create(_config, prev) {
  const setter = prev ? 1 - prev.setter : 0;
  return {
    status: 'setup', // setup | playing | over
    setter, // index of the word-setter
    word: null,
    guessed: [], // correct letters
    missed: [], // wrong letters
    maxWrong: MAX_WRONG,
    winner: null,
  };
}

function setWord(state, i, msg) {
  if (state.status !== 'setup') return 'The word is already set.';
  if (i !== state.setter) return 'Only the word-setter can do that.';
  const raw = String(msg.value || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3,16}$/.test(raw)) return 'Word must be 3–16 letters, no spaces.';
  state.word = raw;
  state.status = 'playing';
  return null;
}

function guessLetter(state, i, msg) {
  if (state.status !== 'playing') return 'The game is not in progress.';
  if (i === state.setter) return 'You set the word — let your opponent guess.';
  const letter = String(msg.letter || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return 'Pick a single letter.';
  if (state.guessed.includes(letter) || state.missed.includes(letter)) {
    return 'You already tried that letter.';
  }

  if (state.word.includes(letter)) {
    state.guessed.push(letter);
    if ([...state.word].every((ch) => state.guessed.includes(ch))) {
      state.status = 'over';
      state.winner = i; // guesser solved it
    }
  } else {
    state.missed.push(letter);
    if (state.missed.length >= state.maxWrong) {
      state.status = 'over';
      state.winner = state.setter; // figure complete
    }
  }
  return null;
}

function view(state, i) {
  const youAreSetter = i === state.setter;
  const reveal = youAreSetter || state.status === 'over';
  const letters = state.word
    ? [...state.word].map((ch) => ({
        char: reveal || state.guessed.includes(ch) ? ch : null,
      }))
    : [];
  return {
    status: state.status,
    youAreSetter,
    wordLength: state.word ? state.word.length : 0,
    letters,
    guessed: state.guessed,
    missed: state.missed,
    maxWrong: state.maxWrong,
    wrongCount: state.missed.length,
    winner: state.winner,
    youWon: state.winner === i,
    word: state.status === 'over' ? state.word : null,
  };
}

export default {
  id: 'hangman',
  name: 'Hangman',
  create,
  rematch: (config, prev) => create(config, prev),
  view,
  handlers: { word: setWord, letter: guessLetter },
};
