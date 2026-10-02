/** The studio's own mark: three offset bars — a page, a palette, a rule. */
export function StudioMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="12" height="4" rx="1" />
      <rect x="3" y="16" width="15" height="4" rx="1" />
    </svg>
  );
}
