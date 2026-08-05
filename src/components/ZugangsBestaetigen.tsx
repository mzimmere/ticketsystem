import { useState } from "react";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

// Zwischenseite fuer Zugangs-/Einladungslinks: Messenger wie WhatsApp rufen
// geteilte Links selbst auf, um eine Vorschau zu erzeugen - dabei wuerde ein
// Einmal-Link (Supabase "invite"/"recovery") schon verbraucht, bevor die
// Person tatsaechlich klickt. Diese Seite zeigt stattdessen nur einen
// Button; der eigentliche (einmalige) Supabase-Link wird erst beim
// tatsaechlichen Klick aufgerufen - Vorschau-Bots klicken nicht, sie lesen
// nur den HTML-Quelltext.
export default function ZugangsBestaetigen({ ziel }: { ziel: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).zugangsBestaetigen;
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function aktivieren() {
    let erlaubterUrsprung: string;
    try {
      erlaubterUrsprung = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
    } catch {
      setFehler(txt.linkUngueltig);
      return;
    }
    let zielUrsprung: string;
    try {
      zielUrsprung = new URL(ziel).origin;
    } catch {
      setFehler(txt.linkUngueltig);
      return;
    }
    if (zielUrsprung !== erlaubterUrsprung) {
      setFehler(txt.linkUngueltig);
      return;
    }
    setLaedt(true);
    window.location.href = ziel;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
        <p className="text-sm font-medium text-[var(--text-strong)]">
          {txt.fastGeschafft}
        </p>
        <p className="text-xs text-[var(--text-faint)]">
          {txt.zwischenschrittHinweis}
        </p>
        {fehler && <p className="text-xs text-red-600">{fehler}</p>}
        <button
          onClick={aktivieren}
          disabled={laedt}
          className="w-full rounded bg-akzent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {laedt ? txt.oeffne : txt.zugangAktivieren}
        </button>
      </div>
    </div>
  );
}
