import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

export default function CsatBewertung({ ticketId, bewertung }: { ticketId: string; bewertung: number | null }) {
  const { sprache } = useSprache();
  const t = texte(sprache).csat;
  const [aktuell, setAktuell] = useState<number | null>(bewertung);
  const [gesendet, setGesendet] = useState(false);
  const [kommentar, setKommentar] = useState("");
  const [kommentarLaeuft, setKommentarLaeuft] = useState(false);
  const [kommentarGesendet, setKommentarGesendet] = useState(false);

  async function bewerten(wert: number) {
    if (aktuell !== null) return;
    const { error } = await supabase.from("tickets").update({ csat_bewertung: wert, csat_am: new Date().toISOString() }).eq("id", ticketId);
    if (!error) { setAktuell(wert); setGesendet(true); }
  }

  async function kommentarSenden() {
    const text = kommentar.trim();
    if (!text) return;
    setKommentarLaeuft(true);
    const { error } = await supabase.from("tickets").update({ csat_kommentar: text }).eq("id", ticketId);
    setKommentarLaeuft(false);
    if (!error) setKommentarGesendet(true);
  }

  if (aktuell !== null && !gesendet) {
    return (
      <div className="rounded-md bg-[var(--bg-muted)] p-3 text-center text-xs text-[var(--text-soft)]">
        {aktuell === 1 ? t.bereitsBewertetJa : t.bereitsBewertetNein}
      </div>
    );
  }

  if (gesendet) {
    return (
      <div className="space-y-2 rounded-md bg-[var(--bg-muted)] p-3 text-xs text-[var(--text-soft)]">
        <p className="text-center">{t.danke}</p>
        {kommentarGesendet ? (
          <p className="text-center">{t.kommentarGesendet}</p>
        ) : (
          <>
            <label className="block text-center">{t.kommentarFrage}</label>
            <textarea
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t.kommentarPlatzhalter}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
            <div className="text-center">
              <button
                onClick={kommentarSenden}
                disabled={kommentarLaeuft || !kommentar.trim()}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-1.5 text-sm text-[var(--text-strong)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
              >
                {t.kommentarSenden}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
      <p className="mb-2 text-xs text-[var(--text-soft)]">{t.frage}</p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => bewerten(1)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-green-50 hover:border-green-300"
        >
          👍 {t.ja}
        </button>
        <button
          onClick={() => bewerten(2)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-red-50 hover:border-red-300"
        >
          👎 {t.nein}
        </button>
      </div>
    </div>
  );
}
