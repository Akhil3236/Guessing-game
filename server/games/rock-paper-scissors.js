/**
 * Rock Paper Scissors — both players pick at the same time, first to 3
 * round wins takes the match. Picks stay hidden until both are in.
 */
const TARGET = 3;
const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function create() {
  return {
    status: 'picking', // picking | revealing | over
    picks: [null, null],
    ready: [false, false],
    scores: [0, 0],
    round: 1,
    target: TARGET,
    lastRound: null, // { picks:[a,b], winner, round }
    history: [], // [{ picks, winner, round }]
    winner: null,
  };
}

function pick(state, i, msg) {
  if (state.status !== 'picking') return 'Not accepting picks right now.';
  if (!CHOICES.includes(msg.choice)) return 'Invalid choice.';
  state.picks[i] = msg.choice;

  if (state.picks[0] && state.picks[1]) {
    const [p0, p1] = state.picks;
    let roundWinner = null;
    if (p0 !== p1) roundWinner = BEATS[p0] === p1 ? 0 : 1;
    if (roundWinner !== null) state.scores[roundWinner] += 1;

    state.lastRound = { picks: [p0, p1], winner: roundWinner, round: state.round };
    state.history.push(state.lastRound);

    if (state.scores[0] >= state.target || state.scores[1] >= state.target) {
      state.status = 'over';
      state.winner = state.scores[0] > state.scores[1] ? 0 : 1;
    } else {
      state.status = 'revealing';
    }
  }
  return null;
}

function next(state, i) {
  if (state.status !== 'revealing') return null;
  state.ready[i] = true;
  if (state.ready[0] && state.ready[1]) {
    state.status = 'picking';
    state.picks = [null, null];
    state.ready = [false, false];
    state.round += 1;
  }
  return null;
}

function view(state, i) {
  return {
    status: state.status,
    round: state.round,
    target: state.target,
    myScore: state.scores[i],
    oppScore: state.scores[1 - i],
    myPick: state.picks[i],
    oppPicked: state.picks[1 - i] !== null,
    iAmReady: state.ready[i],
    oppReady: state.ready[1 - i],
    lastRound: state.lastRound
      ? {
          round: state.lastRound.round,
          myPick: state.lastRound.picks[i],
          oppPick: state.lastRound.picks[1 - i],
          outcome:
            state.lastRound.winner === null
              ? 'tie'
              : state.lastRound.winner === i
                ? 'win'
                : 'loss',
        }
      : null,
    winner: state.winner,
    youWon: state.winner === i,
    history: state.history.map((h) => ({
      round: h.round,
      myPick: h.picks[i],
      oppPick: h.picks[1 - i],
      outcome: h.winner === null ? 'tie' : h.winner === i ? 'win' : 'loss',
    })),
  };
}

export default {
  id: 'rock-paper-scissors',
  name: 'Rock Paper Scissors',
  create,
  view,
  handlers: { pick, next },
};
