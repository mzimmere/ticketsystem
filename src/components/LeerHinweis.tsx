import type { ReactNode } from "react";

export default function LeerHinweis({
  icon,
  titel,
  hinweis,
}: {
  icon: ReactNode;
  titel: string;
  hinweis?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-input)] px-4 py-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-faint)]">
        {icon}
      </span>
      <p className="text-sm font-medium text-[var(--text-soft)]">{titel}</p>
      {hinweis && <p className="max-w-sm text-xs text-[var(--text-faint)]">{hinweis}</p>}
    </div>
  );
}
