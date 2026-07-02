interface LeerZustandProps {
  icon: string;
  titel: string;
  beschreibung?: string;
  aktion?: { label: string; onClick: () => void };
}

export default function LeerZustand({ icon, titel, beschreibung, aktion }: LeerZustandProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12 text-center">
      <span className="mb-3 text-4xl">{icon}</span>
      <p className="text-sm font-medium text-[var(--text-strong)]">{titel}</p>
      {beschreibung && (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--text-faint)]">{beschreibung}</p>
      )}
      {aktion && (
        <button
          onClick={aktion.onClick}
          className="mt-4 rounded-lg bg-akzent px-4 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          {aktion.label}
        </button>
      )}
    </div>
  );
}
