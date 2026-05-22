# Higher / Lower Duel

A real-time, two-player higher / lower number game. The players are on
**separate devices, anywhere** — they connect over the internet with a
shared room code.

## How it works

1. One player is the **host**: they pick the number range (any range from
   1 up to 1,000,000), create a game, and get a 4-character room code.
2. They share the code (the "Copy invite link" button copies a join link).
3. The other player enters the code and joins.
4. Each player privately picks a secret number inside the host's range.
   The numbers live only on the server — neither player ever receives the
   other's.
5. Players take turns guessing the *other* player's number, guided by
   higher / lower hints. **First to crack it wins.** The starting player is
   chosen at random so it's fair.
6. A **shared guess feed** shows every guess from both players in real
   time, so you can watch your opponent close in on your number.

## Tech

- **Client** — React + Vite.
- **Server** — Node, Express (serves the built client) and `ws` for the
  real-time game. The server is authoritative: it holds both secret
  numbers and only ever sends a player higher/lower hints.

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
npm start       # starts the server, which serves dist/ + the game
```

The server listens on `process.env.PORT` (falling back to 3001), so it
runs as-is on hosts like Railway.
