import { useState } from "react";

interface Schritt {
  nr: number;
  titel: string;
  beschreibung: string;
  link?: { label: string; url: string };
  code?: string;
}

interface KonfigurationsHilfeProps {
  titel: string;
  schritte: Schritt[];
  hinweis?: string;
}

export default function KonfigurationsHilfe({ titel, schritte, hinweis }: KonfigurationsHilfeProps) {
  const [offen, setOffen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]">
      <button
        onClick={() => setOffen(!offen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-input)] text-[0.65rem] font-bold text-[var(--text-faint)]">?</span>
          <span className="text-xs font-medium text-[var(--text-soft)]">Anleitung: {titel}</span>
        </div>
        <span className="text-xs text-[var(--text-faint)]">{offen ? "▲ Schließen" : "▼ Anzeigen"}</span>
      </button>

      {offen && (
        <div className="border-t border-[var(--border)] px-4 pb-4 pt-3 space-y-4">
          {schritte.map((s) => (
            <div key={s.nr} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-strong)]">
                {s.nr}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-[var(--text-strong)]">{s.titel}</p>
                <p className="text-xs leading-relaxed text-[var(--text-soft)]">{s.beschreibung}</p>
                {s.code && (
                  <code className="block rounded bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono text-[var(--text-strong)] break-all">
                    {s.code}
                  </code>
                )}
                {s.link && (
                  <a href={s.link.url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-amber-600 underline hover:text-amber-700">
                    {s.link.label} ↗
                  </a>
                )}
              </div>
            </div>
          ))}
          {hinweis && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200">
              💡 {hinweis}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
