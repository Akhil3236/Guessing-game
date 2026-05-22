# Duel Arcade

A real-time, two-player game arcade. The players are on **separate
devices, anywhere** — they connect over the internet with a shared room
code.

## Games

| Game | How it works |
| --- | --- |
| **Higher / Lower** | Each player sets a secret number; take turns guessing the other's with higher/lower hints. First to crack it wins. |
| **Tic-Tac-Toe** | Classic 3×3. Three in a row wins. |
| **Connect 4** | Drop discs into a 7×6 grid; line up four to win. |
| **Rock Paper Scissors** | Pick at the same time, best-of-five — first to 3 round wins. |
| **Hangman** | One player sets a secret word, the other guesses letters before the figure is drawn. Roles swap on a rematch. |

## How to play

1. Pick a game on the home screen and create it — you get a 4-character
   room code.
2. Share the code (the "Copy invite link" button copies a join link).
3. Your friend enters the code and joins; the game starts instantly.

## Tech

- **Client** — React + Vite. One component per game; a shared lobby/hub.
- **Server** — Node, Express (serves the built client) and `ws` for the
  real-time games. The server is authoritative: each game module decides
  what a player is allowed to see, so secrets (numbers, words, picks)
  never leak to the opponent.
- Adding a game = one module in `server/games/` plus one React component.

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts the game server (port 3001) and the Vite dev server
together. Open the printed Vite URL in **two browser windows** to play
both sides.

## Build & run in production

```bash
npm run build   # builds the client into dist/
npm start       # starts the server, which serves dist/ + the games
```

The server listens on `process.env.PORT` (falling back to 3001), so it
runs as-is on hosts like Railway.
