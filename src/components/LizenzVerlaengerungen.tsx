import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface FaelligeLizenz {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string;
  status: string | null;
  kunde: { name: string | null } | null;
}

export default function LizenzVerlaengerungen({ organisationId }: { organisationId: string }) {
  const [tageVorher, setTageVorher] = useState("30");
  const [erinnerungEmail, setErinnerungEmail] = useState("");
  const [lizenzen, setLizenzen] = useState<FaelligeLizenz[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  async function laden() {
    const { data: konfig } = await supabase
      .from("lizenz_konfiguration")
      .select("erinnerung_tage_vorher, erinnerung_email")
      .eq("organisation_id", organisationId)
      .maybeSingle();
    const tage = konfig?.erinnerung_tage_vorher ?? 30;
    setTageVorher(String(tage));
    setErinnerungEmail(konfig?.erinnerung_email ?? "");
    await ladeLizenzen(tage);
  }

  async function ladeLizenzen(tage: number) {
    const grenze = new Date(Date.now() + tage * 86400000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende, status, kunde:kunde_id(name)")
      .eq("organisation_id", organisationId)
      .not("kunde_id", "is", null)
      .not("vertrag_ende", "is", null)
      .ilike("status", "active")
      .lte("vertrag_ende", grenze)
      .order("vertrag_ende", { ascending: true });
    setLizenzen((data as unknown as FaelligeLizenz[]) ?? []);
  }

  async function speichern() {
    const tage = Math.max(1, Number(tageVorher) || 30);
    setLaedt(true);
    const { error } = await supabase.from("lizenz_konfiguration").upsert({
      organisation_id: organisationId,
      erinnerung_tage_vorher: tage,
      erinnerung_email: erinnerungEmail.trim() || null,
    });
    if (!error) await ladeLizenzen(tage);
    setLaedt(false);
    setHinweis(error ? "Fehler beim Speichern." : "Gespeichert.");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">Lizenz-Ablauf-Erinnerungen</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
          Frist für die Erinnerung
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={tageVorher}
            onChange={(e) => setTageVorher(e.target.value)}
            className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          />
          <span className="text-xs text-[var(--text-faint)]">Tage vor Vertragsende</span>
        </div>

        <label className="mb-1 mt-3 block text-xs font-medium text-[var(--text-soft)]">
          Erinnerung senden an
        </label>
        <input
          type="email"
          value={erinnerungEmail}
          onChange={(e) => setErinnerungEmail(e.target.value)}
          placeholder="leer = alle Org-Admins dieser Firma"
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Aktive Lizenzverträge, deren Vertragsende innerhalb der Frist liegt, erscheinen unten und
          werden per E-Mail-Erinnerung gemeldet (kein automatischer Rechnungsversand, Kunden werden
          nie kontaktiert). Leer lassen = an alle Org-Admins; sonst nur an diese eine Adresse (z.B.
          Support-Postfach oder eine bestimmte Person).
        </p>
        <button
          onClick={speichern}
          disabled={laedt}
          className="mt-2 w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {laedt ? "Speichert…" : "Speichern"}
        </button>
        {hinweis && <p className="mt-1 text-xs text-[var(--text-soft)]">{hinweis}</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Bald fällige Lizenzverlängerungen ({lizenzen.length})
        </p>
        {lizenzen.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">
            Aktuell keine Lizenzen, die innerhalb der Frist ablaufen.
          </p>
        ) : (
          <div className="space-y-1.5">
            {lizenzen.map((v) => {
              const tageBisAblauf = Math.round(
                (new Date(v.vertrag_ende).getTime() - Date.now()) / 86400000,
              );
              return (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center gap-2 rounded px-3 py-1.5"
                  style={{
                    background: tageBisAblauf < 0 ? "var(--badge-kritisch-bg)" : "var(--status-offen-bg)",
                  }}
                >
                  <span className="text-sm text-[var(--text-strong)]">
                    {v.kunde?.name ?? "Unbenannt"}
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">· {v.produkt_name}</span>
                  <span className="font-mono text-xs text-[var(--text-faint)]">
                    {v.lizenz_seriennummer}
                  </span>
                  <span
                    className="ml-auto text-xs font-medium"
                    style={{
                      color: tageBisAblauf < 0 ? "var(--badge-kritisch-text)" : "var(--status-offen-text)",
                    }}
                  >
                    bis {new Date(v.vertrag_ende).toLocaleDateString("de-DE")}
                    {tageBisAblauf >= 0 ? ` (${tageBisAblauf} Tage)` : " (abgelaufen)"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
