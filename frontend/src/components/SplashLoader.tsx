import { motion } from "framer-motion";
import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * Full-screen themed intro shown on the first Home load while data fetches.
 * Dark: a rising moon over twinkling stars. Light: a rising sun with clouds + birds.
 * The accent progress bar fills over `durationMs`.
 */
export default function SplashLoader({ durationMs }: { durationMs: number }) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        dur: Math.random() * 2 + 1.5,
      })),
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden ${
        dark
          ? "bg-[radial-gradient(ellipse_at_top,#0b1026_0%,#05070f_55%,#000_100%)]"
          : "bg-gradient-to-b from-sky-300 via-sky-200 to-sky-100"
      }`}
    >
      {/* Ambient scene */}
      {dark
        ? stars.map((s) => (
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
          ))
        : (
          <>
            {[14, 30, 52].map((top, i) => (
              <div
                key={i}
                className="absolute"
                style={{ top: `${top}%`, opacity: 0.9, animation: `drift ${50 + i * 18}s linear ${-i * 12}s infinite` }}
              >
                <svg width="150" height="72" viewBox="0 0 140 70" fill="white">
                  <ellipse cx="45" cy="45" rx="35" ry="22" />
                  <ellipse cx="80" cy="38" rx="30" ry="26" />
                  <ellipse cx="105" cy="48" rx="28" ry="18" />
                  <rect x="30" y="48" width="90" height="20" rx="10" />
                </svg>
              </div>
            ))}
            {[20, 34, 26].map((top, i) => (
              <div key={`b${i}`} className="absolute" style={{ top: `${top}%`, animation: `fly ${18 + i * 5}s linear ${-i * 7}s infinite` }}>
                <svg width="26" height="14" viewBox="0 0 26 14">
                  <path d="M1 11 Q7 1 13 8 Q19 1 25 11" fill="none" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" style={{ animation: "flap .5s ease-in-out infinite" }} />
                </svg>
              </div>
            ))}
          </>
        )}

      {/* Foreground: rising celestial body + label + progress */}
      <div className="relative z-10 flex flex-col items-center gap-7 px-6 text-center">
        <motion.div
          initial={{ y: 40, scale: 0.6, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        >
          {dark ? (
            <div
              className="h-28 w-28 rounded-full bg-slate-100"
              style={{ boxShadow: "0 0 70px 16px rgba(241,245,249,0.55), inset -16px -10px 0 0 rgba(0,0,0,0.18)" }}
            />
          ) : (
            <div className="h-28 w-28 rounded-full bg-amber-300" style={{ animation: "sun-pulse 4s ease-in-out infinite" }} />
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className={`text-lg font-semibold tracking-wide ${dark ? "text-slate-100" : "text-slate-800"}`}
        >
          {dark ? "Charting the night sky…" : "Catching the morning light…"}
        </motion.p>

        <div className={`h-1.5 w-56 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-white/40"}`}>
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: 0, animation: `splash-progress ${durationMs}ms ease-in-out forwards` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
