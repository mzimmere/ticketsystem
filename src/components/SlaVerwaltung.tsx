import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface SlaKonfig {
  reaktionszeit_stunden: number;
  loesungszeit_stunden: number;
  aktiv: boolean;
}

export default function SlaVerwaltung({ organisationId }: { organisationId: string }) {
  const [konfig, setKonfig] = useState<SlaKonfig>({ reaktionszeit_stunden: 4, loesungszeit_stunden: 24, aktiv: false });
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [autoSchliessen, setAutoSchliessen] = useState("");

  useEffect(() => { ladeKonfig(); }, [organisationId]);

  async function ladeKonfig() {
    const [slaRes, orgRes] = await Promise.all([
      supabase.from("sla_konfiguration").select("*").eq("organisation_id", organisationId).maybeSingle(),
      supabase.from("organisationen").select("auto_schliessen_tage").eq("id", organisationId).single()
    ]);
    if (slaRes.data) setKonfig(slaRes.data);
    if (orgRes.data) setAutoSchliessen(String(orgRes.data.auto_schliessen_tage ?? ""));
  }

  async function speichern() {
    setLaedt(true);
    const { error } = await supabase.from("sla_konfiguration").upsert({
      organisation_id: organisationId,
      reaktionszeit_stunden: konfig.reaktionszeit_stunden,
      loesungszeit_stunden: konfig.loesungszeit_stunden,
      aktiv: konfig.aktiv
    });
    const tage = autoSchliessen.trim() ? Number(autoSchliessen) : null;
    await supabase.from("organisationen").update({ auto_schliessen_tage: tage }).eq("id", organisationId);
    setLaedt(false);
    setHinweis(error ? "Fehler beim Speichern." : "Gespeichert.");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">SLA & Automatisierung</h3>

      <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
        <input type="checkbox" checked={konfig.aktiv} onChange={(e) => setKonfig({ ...konfig, aktiv: e.target.checked })} className="accent-amber-500" />
        SLA-Fristen aktiv (werden beim Anlegen neuer Tickets berechnet)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Erste Reaktion (Stunden)</label>
          <input type="number" min={1} value={konfig.reaktionszeit_stunden}
            onChange={(e) => setKonfig({ ...konfig, reaktionszeit_stunden: Number(e.target.value) })}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Lösung (Stunden)</label>
          <input type="number" min={1} value={konfig.loesungszeit_stunden}
            onChange={(e) => setKonfig({ ...konfig, loesungszeit_stunden: Number(e.target.value) })}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
          Auto-Schließen (Tage ohne Kunden-Antwort, leer = deaktiviert)
        </label>
        <div className="flex items-center gap-2">
          <input type="number" min={1} value={autoSchliessen} onChange={(e) => setAutoSchliessen(e.target.value)}
            placeholder="z.B. 7"
            className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
          <span className="text-xs text-[var(--text-faint)]">Tage</span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Tickets im Status "Wartet auf Kunde" werden nach dieser Zeit automatisch geschlossen.
        </p>
      </div>

      {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
      <button onClick={speichern} disabled={laedt} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {laedt ? "Speichert…" : "Speichern"}
      </button>
    </div>
  );
}
