/**
 * Search input pill. Position-agnostic — the caller places it (the event top
 * bar centers it). Filters the wall by dimming non-matching cards.
 */
export function SearchPill({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-full border border-hairline bg-polaroid/90 px-4 py-2 shadow-sm backdrop-blur " +
        className
      }
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 text-muted"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search the guestbook…"
        className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 text-muted hover:text-ink"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
