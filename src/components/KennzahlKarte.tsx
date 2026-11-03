import type { ReactNode } from "react";

export type KennzahlFarbe = "blau" | "gruen" | "amber" | "rot" | "neutral";

// Nutzt nur die vorhandenen Design-Tokens aus index.css (Hell/Dunkel).
const FARBEN: Record<KennzahlFarbe, { bg: string; text: string }> = {
  blau: { bg: "var(--badge-mittel-bg)", text: "var(--badge-mittel-text)" },
  gruen: { bg: "var(--status-geloest-bg)", text: "var(--status-geloest-text)" },
  amber: { bg: "var(--badge-hoch-bg)", text: "var(--badge-hoch-text)" },
  rot: { bg: "var(--badge-kritisch-bg)", text: "var(--badge-kritisch-text)" },
  neutral: { bg: "var(--bg-muted)", text: "var(--text-soft)" },
};

export default function KennzahlKarte({
  label,
  wert,
  hinweis,
  hinweisUmbrechen,
  farbe,
  icon,
  onClick,
}: {
  label: string;
  wert: number | string;
  hinweis?: string;
  hinweisUmbrechen?: boolean;
  farbe: KennzahlFarbe;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const f = FARBEN[farbe];
  const inhalt = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: f.bg, color: f.text }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-tight text-[var(--text-strong)]">{wert}</span>
        <span className="block truncate text-xs font-medium text-[var(--text-soft)]">{label}</span>
        {hinweis && (
          <span className={`block ${hinweisUmbrechen ? "" : "truncate"} text-[0.7rem] text-[var(--text-faint)]`}>{hinweis}</span>
        )}
      </span>
    </>
  );
  const klasse =
    "flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-left";
  return onClick ? (
    <button onClick={onClick} className={`${klasse} transition-colors hover:border-akzent`}>
      {inhalt}
    </button>
  ) : (
    <div className={klasse}>{inhalt}</div>
  );
}
