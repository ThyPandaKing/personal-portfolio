import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

/** Day / night sliding toggle switch. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "day" : "night"} mode`}
      title={isDark ? "Night mode — switch to day" : "Day mode — switch to night"}
      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition-colors duration-300 ${
        isDark
          ? "border-slate-600 bg-slate-700"
          : "border-amber-300 bg-amber-200"
      }`}
    >
      {/* faint track icons */}
      <Sun size={12} className="absolute left-1.5 text-amber-500/80" />
      <Moon size={11} className="absolute right-1.5 text-slate-200/90" />
      {/* sliding knob */}
      <span
        className={`z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${
          isDark ? "translate-x-[30px]" : "translate-x-0.5"
        }`}
      >
        {isDark ? (
          <Moon size={13} className="text-slate-700" />
        ) : (
          <Sun size={13} className="text-amber-500" />
        )}
      </span>
    </button>
  );
}
