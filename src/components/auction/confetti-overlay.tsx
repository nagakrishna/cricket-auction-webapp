"use client";

import type { CSSProperties } from "react";

const CONFETTI_COLORS = [
  "bg-fuchsia-500",
  "bg-amber-400",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-lime-500",
  "bg-cyan-400",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-400",
  "bg-yellow-400",
  "bg-red-500",
];

const CONFETTI_SHAPES = ["rounded-sm", "rounded-full", "rounded-[999px]", "rounded-[6px]"];
const CONFETTI_SIZES = ["h-5 w-3", "h-4 w-4", "h-6 w-2.5", "h-3.5 w-3.5", "h-6 w-4", "h-5 w-2"];

const CONFETTI_PIECES = Array.from({ length: 220 }, (_, index) => ({
  left: `${((index * 47) % 100) + Math.random()}%`,
  delay:
    index < 120
      ? "0s"
      : `${(0.02 + ((index % 10) * 0.018)).toFixed(2)}s`,
  duration: `${3.9 + ((index * 13) % 18) * 0.12}s`,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  shape: CONFETTI_SHAPES[index % CONFETTI_SHAPES.length],
  size: CONFETTI_SIZES[index % CONFETTI_SIZES.length],
  drift: `${((index % 9) - 4) * 18}px`,
  endDrift: `${((index % 11) - 5) * 34}px`,
  rotate: `${(index * 29) % 360}deg`,
  spin: `${540 + (index % 7) * 120}deg`,
  opacity: 0.82 + (index % 4) * 0.04,
  wobbleDuration: `${1.1 + (index % 6) * 0.18}s`,
}));

export function ConfettiOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
      {CONFETTI_PIECES.map((piece, index) => (
        <div
          key={`confetti-${index}`}
          className="absolute -top-10 animate-[confetti-fall_var(--confetti-duration)_linear_var(--confetti-delay)_forwards]"
          style={
            {
              left: piece.left,
              "--confetti-delay": piece.delay,
              "--confetti-duration": piece.duration,
              "--confetti-x-start": piece.drift,
              "--confetti-x-end": piece.endDrift,
              "--confetti-spin": piece.spin,
            } as CSSProperties
          }
        >
          <div
            className={`${piece.size} ${piece.shape} ${piece.color} animate-[confetti-wobble_var(--confetti-wobble-duration)_ease-in-out_infinite] shadow-[0_10px_22px_rgba(15,23,42,0.18)] ring-1 ring-white/35`}
            style={
              {
                "--confetti-wobble-duration": piece.wobbleDuration,
                opacity: piece.opacity,
                transform: `rotate(${piece.rotate})`,
              } as CSSProperties
            }
          />
        </div>
      ))}
    </div>
  );
}
