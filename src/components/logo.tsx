/** Aitta mark: a Finnish storehouse on stilts, drawn with a few strokes. */
export function AittaMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 14 16 5l12 9" />
      <path d="M7 12.5V23h18V12.5" />
      <path d="M13 23v-6h6v6" />
      <path d="M9 23v4M23 23v4" />
    </svg>
  );
}
