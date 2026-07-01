import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function CsatBewertung({ ticketId, bewertung }: { ticketId: string; bewertung: number | null }) {
  const [aktuell, setAktuell] = useState<number | null>(bewertung);
  const [gesendet, setGesendet] = useState(false);

  async function bewerten(wert: number) {
    if (aktuell !== null) return;
    const { error } = await supabase.from("tickets").update({ csat_bewertung: wert, csat_am: new Date().toISOString() }).eq("id", ticketId);
    if (!error) { setAktuell(wert); setGesendet(true); }
  }

  if (aktuell !== null && !gesendet) {
    return (
      <div className="rounded-md bg-[var(--bg-muted)] p-3 text-center text-xs text-[var(--text-soft)]">
        Du hast dieses Ticket bewertet: {aktuell === 1 ? "👍 Hilfreich" : "👎 Nicht hilfreich"} – Danke!
      </div>
    );
  }

  if (gesendet) {
    return (
      <div className="rounded-md bg-[var(--bg-muted)] p-3 text-center text-xs text-[var(--text-soft)]">
        Danke für dein Feedback! 🙏
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
      <p className="mb-2 text-xs text-[var(--text-soft)]">War diese Hilfe nützlich?</p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => bewerten(1)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-green-50 hover:border-green-300"
        >
          👍 Ja, danke
        </button>
        <button
          onClick={() => bewerten(2)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-red-50 hover:border-red-300"
        >
          👎 Nicht wirklich
        </button>
      </div>
    </div>
  );
}
