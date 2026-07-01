import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface FaqEintrag {
  id: string;
  frage: string;
  antwort: string;
  kategorie: string | null;
}

export default function FaqSeite({ organisationId }: { organisationId: string }) {
  const [eintraege, setEintraege] = useState<FaqEintrag[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [aktiveKat, setAktiveKat] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    supabase.from("faq_eintraege")
      .select("id, frage, antwort, kategorie")
      .eq("organisation_id", organisationId)
      .eq("oeffentlich", true)
      .order("reihenfolge").order("erstellt_am")
      .then(({ data }) => { setEintraege(data ?? []); setLaedt(false); });
  }, [organisationId]);

  const kategorien = [...new Set(eintraege.map((e) => e.kategorie).filter(Boolean))] as string[];
  const gefiltert = eintraege.filter((e) => {
    const suchTreffer = !suche || e.frage.toLowerCase().includes(suche.toLowerCase()) || e.antwort.toLowerCase().includes(suche.toLowerCase());
    const katTreffer = !aktiveKat || e.kategorie === aktiveKat;
    return suchTreffer && katTreffer;
  });

  if (laedt) return null;
  if (eintraege.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-strong)]">Häufige Fragen</h2>
        <p className="text-xs text-[var(--text-soft)] mt-0.5">Finde schnell Antworten auf häufige Fragen.</p>
      </div>

      <input type="text" value={suche} onChange={(e) => setSuche(e.target.value)}
        placeholder="Frage suchen…"
        className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm" />

      {kategorien.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setAktiveKat(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${!aktiveKat ? "bg-akzent text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>
            Alle
          </button>
          {kategorien.map((k) => (
            <button key={k} onClick={() => setAktiveKat(aktiveKat === k ? null : k)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${aktiveKat === k ? "bg-akzent text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>
              {k}
            </button>
          ))}
        </div>
      )}

      {gefiltert.length === 0 && (
        <p className="text-sm text-[var(--text-faint)]">Keine Treffer für „{suche}".</p>
      )}

      <div className="space-y-2">
        {gefiltert.map((e) => (
          <div key={e.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <button onClick={() => setOffen(offen === e.id ? null : e.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="text-sm font-medium text-[var(--text-strong)]">{e.frage}</span>
              <span className={`ml-3 shrink-0 text-lg transition-transform ${offen === e.id ? "rotate-45" : ""}`}>+</span>
            </button>
            {offen === e.id && (
              <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-soft)]">{e.antwort}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
