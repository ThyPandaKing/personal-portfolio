/**
 * Simple line-art avatar of a guy wearing glasses (stands in for the owner).
 * Uses `currentColor` so it inherits the surrounding text color.
 */
export default function GuyAvatar({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Shoulders / bust */}
      <path d="M13 61 C13 49 22 45 32 45 C42 45 51 49 51 61" />
      {/* Neck */}
      <path d="M27 44 v-5 M37 44 v-5" />
      {/* Head */}
      <circle cx="32" cy="26" r="14" />
      {/* Hair */}
      <path d="M18 24 C18 9 46 9 46 24" />
      <path d="M18 24 C16 19 17 14 20 12 M46 24 C48 19 47 14 44 12" />
      {/* Glasses */}
      <circle cx="26" cy="27" r="4.6" />
      <circle cx="38" cy="27" r="4.6" />
      <path d="M30.6 27 h2.8" />
      <path d="M21.4 26 l-3.4 -1 M42.6 26 l3.4 -1" />
      {/* Smile */}
      <path d="M27 35 q5 4 10 0" />
    </svg>
  );
}
