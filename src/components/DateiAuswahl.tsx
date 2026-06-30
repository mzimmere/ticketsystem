import { useRef } from "react";

interface DateiAuswahlProps {
  dateien: File[];
  onAendern: (dateien: File[]) => void;
  mehrfach?: boolean;
  label?: string;
}

export default function DateiAuswahl({
  dateien,
  onAendern,
  mehrfach = true,
  label = "Datei anhängen",
}: DateiAuswahlProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function dateienHinzufuegen(neu: FileList | null) {
    if (!neu) return;
    const liste = Array.from(neu);
    onAendern(mehrfach ? [...dateien, ...liste] : liste.slice(0, 1));
    if (inputRef.current) inputRef.current.value = "";
  }

  function entfernen(index: number) {
    onAendern(dateien.filter((_, i) => i !== index));
  }

  function formatGroesse(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded border border-dashed border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple={mehrfach}
        onChange={(e) => dateienHinzufuegen(e.target.files)}
        className="hidden"
      />

      {dateien.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dateien.map((datei, i) => (
            <span
              key={`${datei.name}-${i}`}
              className="flex items-center gap-1.5 rounded bg-[var(--bg-muted)] px-2 py-1 text-xs text-[var(--text-soft)]"
            >
              <span className="max-w-[140px] truncate">{datei.name}</span>
              <span className="text-[var(--text-faint)]">{formatGroesse(datei.size)}</span>
              <button
                type="button"
                onClick={() => entfernen(i)}
                className="text-[var(--text-faint)] hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
