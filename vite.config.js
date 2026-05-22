import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the React app runs on Vite and the game server runs on :3001.
// Vite proxies the WebSocket so the client can always talk to "/ws".
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
});
