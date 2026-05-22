import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Celebratory confetti — a center burst plus a short side-cannon volley. */
export function celebrate() {
  if (reducedMotion()) return;
  const colors = ['#fbbf24', '#38bdf8', '#4ade80', '#fb7185', '#ffffff'];
  confetti({ particleCount: 150, spread: 95, startVelocity: 45, origin: { y: 0.6 }, colors });
  const end = Date.now() + 1400;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 65, origin: { x: 0 }, colors });
    confetti({ particleCount: 5, angle: 120, spread: 65, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Fire confetti exactly once, the moment `youWon` becomes true. */
export function useCelebrateOnWin(youWon) {
  const fired = useRef(false);
  useEffect(() => {
    if (youWon && !fired.current) {
      fired.current = true;
      celebrate();
    } else if (!youWon) {
      fired.current = false;
    }
  }, [youWon]);
}

/** Shared end-of-game buttons used by every game. */
export function ResultActions({ canRematch, onRematch, onLeave }) {
  return (
    <div className="result-actions">
      {canRematch && (
        <button className="btn primary" type="button" onClick={onRematch}>
          Play again
        </button>
      )}
      <button className="btn ghost" type="button" onClick={onLeave}>
        Back to games
      </button>
    </div>
  );
}
