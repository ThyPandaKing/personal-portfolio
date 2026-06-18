/**
 * Friendly cartoon robot mascot for the AI chat assistant ("AI-ditya").
 * Self-contained animated SVG (gentle float, blinking eyes, pulsing antenna)
 * so it stays crisp and reliable when deployed — no external image dependency.
 */
export default function BotAvatar({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g className="bot-float">
        {/* antenna */}
        <line x1="32" y1="11" x2="32" y2="5" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
        <circle className="bot-antenna" cx="32" cy="4" r="3" fill="#f472b6" />
        {/* ears */}
        <rect x="6" y="26" width="5" height="14" rx="2.5" fill="#6366f1" />
        <rect x="53" y="26" width="5" height="14" rx="2.5" fill="#6366f1" />
        {/* head */}
        <rect x="11" y="11" width="42" height="36" rx="13" fill="#818cf8" stroke="#6366f1" strokeWidth="2" />
        {/* face screen */}
        <rect x="17" y="18" width="30" height="22" rx="9" fill="#0f172a" />
        {/* eyes (blink) */}
        <g className="bot-blink">
          <ellipse cx="26" cy="29" rx="3.2" ry="4" fill="#5eead4" />
          <ellipse cx="38" cy="29" rx="3.2" ry="4" fill="#5eead4" />
        </g>
        {/* smile */}
        <path d="M25 34 q7 5 14 0" fill="none" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" />
        {/* collar / body */}
        <rect x="22" y="49" width="20" height="10" rx="5" fill="#6366f1" />
      </g>
    </svg>
  );
}
