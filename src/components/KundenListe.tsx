import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Avatar from "./Avatar";

interface Kunde {
  id: string;
  name: string | null;
  avatar_url: string | null;
  telefonnummer: string | null;
  adresse: string | null;
  notizen: string | null;
  preis_pro_minute_cent: number | null;
}

interface KundenListeProps {
  organisationId: string;
  refreshKey?: number;
}

export default function KundenListe({ organisationId, refreshKey }: KundenListeProps) {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Partial<Kunde>>({});
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    ladeKunden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey]);

  async function ladeKunden() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, telefonnummer, adresse, notizen, preis_pro_minute_cent")
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .order("name");
    setKunden((data as Kunde[]) ?? []);
  }

  function bearbeitenOeffnen(k: Kunde) {
    setOffenId(k.id);
    setEntwurf(k);
    setHinweis(null);
  }

  async function speichern() {
    if (!offenId) return;
    setLaedt(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: entwurf.name?.trim() || null,
        telefonnummer: entwurf.telefonnummer?.trim() || null,
        adresse: entwurf.adresse?.trim() || null,
        notizen: entwurf.notizen?.trim() || null,
        preis_pro_minute_cent:
          entwurf.preis_pro_minute_cent === null || entwurf.preis_pro_minute_cent === undefined
            ? null
            : Number(entwurf.preis_pro_minute_cent),
      })
      .eq("id", offenId);
    setLaedt(false);
    if (error) {
      console.error(error);
      setHinweis("Speichern fehlgeschlagen.");
      return;
    }
    setOffenId(null);
    ladeKunden();
  }

  if (kunden.length === 0) {
    return <p className="text-sm text-[var(--text-faint)]">Noch keine Kunden vorhanden.</p>;
  }

  return (
    <div className="space-y-2">
      {kunden.map((k) => (
        <div
          key={k.id}
          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
        >
          <button
            onClick={() => (offenId === k.id ? setOffenId(null) : bearbeitenOeffnen(k))}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
          >
            <Avatar name={k.name} avatarUrl={k.avatar_url} groesse="sm" />
            <span className="text-sm text-[var(--text-strong)]">{k.name ?? "Unbenannt"}</span>
            <span className="ml-auto truncate text-xs text-[var(--text-faint)]">
              {k.telefonnummer ?? "—"}
            </span>
          </button>

          {offenId === k.id && (
            <div className="space-y-2.5 border-t border-[var(--border)] px-4 py-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Name
                </label>
                <input
                  type="text"
                  value={entwurf.name ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, name: e.target.value })}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Telefon / WhatsApp
                </label>
                <input
                  type="text"
                  value={entwurf.telefonnummer ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, telefonnummer: e.target.value })}
                  placeholder="z.B. 4915112345678"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Adresse
                </label>
                <textarea
                  value={entwurf.adresse ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, adresse: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Notizen / Besonderheiten
                </label>
                <textarea
                  value={entwurf.notizen ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, notizen: e.target.value })}
                  rows={3}
                  placeholder="z.B. bevorzugte Erreichbarkeit, technische Besonderheiten…"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Individueller Minutenpreis in Cent (optional)
                </label>
                <input
                  type="number"
                  value={entwurf.preis_pro_minute_cent ?? ""}
                  onChange={(e) =>
                    setEntwurf({
                      ...entwurf,
                      preis_pro_minute_cent: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="leer = Standardpreis der Firma"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}

              <button
                onClick={speichern}
                disabled={laedt}
                className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
