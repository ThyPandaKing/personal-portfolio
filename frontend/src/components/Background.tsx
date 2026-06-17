import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * Full-screen animated backdrop behind all content.
 * - Dark: black sky with flickering stars + a glowing moon.
 * - Light: blue sky with a pulsing sun, drifting clouds, and flying birds.
 * Pure SVG/CSS — no external assets. Sits at -z-10 and ignores pointer events.
 */
export default function Background() {
  const { theme } = useTheme();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {theme === "dark" ? <StarryNight /> : <DaySky />}
    </div>
  );
}

/* --------------------------------- DARK --------------------------------- */

function StarryNight() {
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 4,
        dur: Math.random() * 2.5 + 1.5,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0b1026_0%,#05070f_55%,#000000_100%)]">
      {/* Moon */}
      <div
        className="absolute right-[8%] top-[10%] h-24 w-24 rounded-full bg-slate-100"
        style={{ boxShadow: "0 0 60px 12px rgba(241,245,249,0.55), inset -14px -8px 0 0 rgba(0,0,0,0.18)" }}
      />
      {/* Stars */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            boxShadow: "0 0 4px rgba(255,255,255,0.8)",
          }}
        />
      ))}
      {/* Occasional shooting star */}
      <span className="absolute left-[15%] top-[18%] h-px w-24 bg-gradient-to-r from-white to-transparent" style={{ animation: "shoot 7s ease-in 2s infinite" }} />
    </div>
  );
}

/* --------------------------------- LIGHT --------------------------------- */

function DaySky() {
  const birds = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const dur = 16 + Math.random() * 12;
        return {
          id: i,
          top: 12 + Math.random() * 35,
          scale: 0.6 + Math.random() * 0.7,
          // Negative delay → already mid-flight at load, so birds start scattered.
          delay: -Math.random() * dur,
          dur,
        };
      }),
    [],
  );
  const clouds = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const dur = 45 + Math.random() * 40;
        return {
          id: i,
          top: 8 + Math.random() * 55,
          scale: 0.7 + Math.random() * 0.9,
          // Negative delay → spread across the sky on first paint, not bunched left.
          delay: -Math.random() * dur,
          dur,
          opacity: 0.75 + Math.random() * 0.25,
        };
      }),
    [],
  );

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-sky-100">
      {/* Sun */}
      <div
        className="absolute left-[8%] top-[8%] h-28 w-28 rounded-full bg-amber-300"
        style={{ animation: "sun-pulse 5s ease-in-out infinite" }}
      />
      {/* Clouds */}
      {clouds.map((c) => (
        <div
          key={c.id}
          className="absolute"
          style={{
            top: `${c.top}%`,
            opacity: c.opacity,
            transform: `scale(${c.scale})`,
            animation: `drift ${c.dur}s linear ${c.delay}s infinite`,
          }}
        >
          <Cloud />
        </div>
      ))}
      {/* Birds */}
      {birds.map((b) => (
        <div
          key={b.id}
          className="absolute"
          style={{
            top: `${b.top}%`,
            transform: `scale(${b.scale})`,
            animation: `fly ${b.dur}s linear ${b.delay}s infinite`,
          }}
        >
          <Bird />
        </div>
      ))}
    </div>
  );
}

function Cloud() {
  return (
    <svg width="140" height="70" viewBox="0 0 140 70" fill="white">
      <ellipse cx="45" cy="45" rx="35" ry="22" />
      <ellipse cx="80" cy="38" rx="30" ry="26" />
      <ellipse cx="105" cy="48" rx="28" ry="18" />
      <rect x="30" y="48" width="90" height="20" rx="10" />
    </svg>
  );
}

function Bird() {
  return (
    <svg width="26" height="14" viewBox="0 0 26 14">
      <path
        d="M1 11 Q7 1 13 8 Q19 1 25 11"
        fill="none"
        stroke="#334155"
        strokeWidth="1.6"
        strokeLinecap="round"
        style={{ animation: "flap 0.5s ease-in-out infinite" }}
      />
    </svg>
  );
}
