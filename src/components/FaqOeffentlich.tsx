import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface FaqEintrag {
  id: string;
  frage: string;
  antwort: string;
  kategorie: string | null;
}

interface Org {
  name: string;
  logo_url: string | null;
  akzentfarbe: string | null;
  motto: string | null;
}

export default function FaqOeffentlich({ slug }: { slug: string }) {
  const [org, setOrg] = useState<Org | null>(null);
  const [eintraege, setEintraege] = useState<FaqEintrag[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [aktiveKat, setAktiveKat] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    laden();
  }, [slug]);

  async function laden() {
    // Firma per Slug laden (nutzt bestehende RPC)
    const { data: orgDaten } = await supabase
      .rpc("get_organisation_by_slug", { p_slug: slug });
    const firma = orgDaten?.[0] ?? null;
    setOrg(firma);

    if (!firma) { setLaedt(false); return; }

    const { data } = await supabase
      .from("faq_eintraege")
      .select("id, frage, antwort, kategorie")
      .eq("organisation_id", firma.id)
      .eq("oeffentlich", true)
      .order("reihenfolge")
      .order("erstellt_am");
    setEintraege(data ?? []);
    setLaedt(false);
  }

  const kategorien = [...new Set(eintraege.map((e) => e.kategorie).filter(Boolean))] as string[];
  const gefiltert = eintraege.filter((e) => {
    const suchTreffer = !suche ||
      e.frage.toLowerCase().includes(suche.toLowerCase()) ||
      e.antwort.toLowerCase().includes(suche.toLowerCase());
    return suchTreffer && (!aktiveKat || e.kategorie === aktiveKat);
  });

  if (laedt) return null;

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8">
        <p className="text-sm text-[var(--text-soft)]">Diese Seite existiert nicht.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--bg-muted)]"
      style={{ "--akzent": org.akzentfarbe || "#f59e0b" } as React.CSSProperties}
    >
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-5">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          {org.logo_url && (
            <img src={org.logo_url} alt={org.name}
              className="h-10 w-10 shrink-0 rounded-lg bg-[var(--bg-muted)] object-contain p-0.5" />
          )}
          <div>
            <h1 className="text-base font-semibold text-[var(--text-strong)]">{org.name}</h1>
            {org.motto && <p className="text-xs text-[var(--text-soft)]">{org.motto}</p>}
          </div>
        </div>
      </div>

      {/* Inhalt */}
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-strong)]">Häufige Fragen</h2>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            Hier findest du Antworten auf die häufigsten Fragen.
          </p>
        </div>

        {/* Suche */}
        <input
          type="text"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Frage suchen…"
          className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--bg-surface)] px-4 py-3 text-sm shadow-sm"
        />

        {/* Kategorie-Filter */}
        {kategorien.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAktiveKat(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${!aktiveKat ? "bg-akzent text-white" : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-soft)]"}`}
            >
              Alle
            </button>
            {kategorien.map((k) => (
              <button key={k}
                onClick={() => setAktiveKat(aktiveKat === k ? null : k)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${aktiveKat === k ? "bg-akzent text-white" : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-soft)]"}`}
              >
                {k}
              </button>
            ))}
          </div>
        )}

        {/* Keine Treffer */}
        {gefiltert.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
            <p className="text-sm text-[var(--text-faint)]">
              {suche ? `Keine Treffer für „${suche}".` : "Noch keine FAQ-Einträge vorhanden."}
            </p>
          </div>
        )}

        {/* FAQ-Einträge */}
        <div className="space-y-2">
          {gefiltert.map((e) => (
            <div key={e.id}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm transition-shadow hover:shadow-md"
            >
              <button
                onClick={() => setOffen(offen === e.id ? null : e.id)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="pr-4 text-sm font-medium text-[var(--text-strong)]">{e.frage}</span>
                <span className={`shrink-0 text-xl font-light text-[var(--text-faint)] transition-transform duration-200 ${offen === e.id ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
              {offen === e.id && (
                <div className="border-t border-[var(--border)] px-5 pb-5 pt-4">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-soft)]">
                    {e.antwort}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Link zum Portal */}
        <p className="text-center text-xs text-[var(--text-faint)]">
          Keine Antwort gefunden?{" "}
          <a href={`${window.location.origin}/?neukunde=${slug}`}
            className="underline hover:text-[var(--text-soft)]">
            Anfrage stellen →
          </a>
        </p>
      </div>
    </div>
  );
}
