import { useState } from "react";
import { X } from "lucide-react";
import { changelog, aktuelleVersion } from "../changelog";

export default function Changelog() {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOffen(true)}
        title="Was ist neu?"
        className="rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--text-faint)] transition-colors hover:border-[var(--akzent)] hover:text-[var(--akzent)]"
      >
        v{aktuelleVersion}
      </button>

      {offen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOffen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">Änderungsverlauf</h3>
              <button
                onClick={() => setOffen(false)}
                className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-muted)]"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="space-y-3 overflow-y-auto px-5 py-4">
              {changelog.map((eintrag, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-0.5 h-fit shrink-0 rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-faint)]">
                    v{changelog.length - i}
                  </span>
                  <div>
                    <p className="text-[var(--text-strong)]">{eintrag.titel}</p>
                    <p className="text-[10px] text-[var(--text-faint)]">{eintrag.datum}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
