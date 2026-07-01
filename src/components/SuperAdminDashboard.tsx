import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface FirmenStat {
  id: string;
  name: string;
  logo_url: string | null;
  tickets_gesamt: number;
  tickets_offen: number;
  nutzer: number;
  letzteAktivitaet: string | null;
}

function formatRelativ(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

export default function SuperAdminDashboard() {
  const [firmen, setFirmen] = useState<FirmenStat[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [gesamt, setGesamt] = useState({ tickets: 0, nutzer: 0, firmen: 0 });

  useEffect(() => {
    laden();
  }, []);

  async function laden() {
    setLaedt(true);

    // Alle Firmen laden
    const { data: orgDaten } = await supabase
      .from("organisationen")
      .select("id, name, logo_url")
      .order("name");

    if (!orgDaten) { setLaedt(false); return; }

    // Stats pro Firma parallel laden
    const stats = await Promise.all(
      orgDaten.map(async (org) => {
        const [ticketsRes, offenRes, nutzerRes, aktivitaetRes] = await Promise.all([
          supabase.from("tickets").select("id", { count: "exact", head: true })
            .eq("organisation_id", org.id),
          supabase.from("tickets").select("id", { count: "exact", head: true })
            .eq("organisation_id", org.id)
            .in("status", ["offen", "in_bearbeitung", "wartet_auf_kunde"]),
          supabase.from("profiles").select("id", { count: "exact", head: true })
            .eq("organisation_id", org.id).eq("deaktiviert", false),
          supabase.from("tickets").select("erstellt_am")
            .eq("organisation_id", org.id)
            .order("erstellt_am", { ascending: false })
            .limit(1),
        ]);

        return {
          id: org.id,
          name: org.name,
          logo_url: org.logo_url,
          tickets_gesamt: ticketsRes.count ?? 0,
          tickets_offen: offenRes.count ?? 0,
          nutzer: nutzerRes.count ?? 0,
          letzteAktivitaet: aktivitaetRes.data?.[0]?.erstellt_am ?? null,
        };
      })
    );

    setFirmen(stats);
    setGesamt({
      firmen: stats.length,
      tickets: stats.reduce((s, f) => s + f.tickets_gesamt, 0),
      nutzer: stats.reduce((s, f) => s + f.nutzer, 0),
    });
    setLaedt(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-strong)]">Super-Admin Dashboard</h2>

      {/* Gesamt-KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Firmen", wert: gesamt.firmen },
          { label: "Tickets gesamt", wert: gesamt.tickets },
          { label: "Aktive Nutzer", wert: gesamt.nutzer },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
            <p className="text-2xl font-bold text-[var(--text-strong)]">{laedt ? "—" : k.wert}</p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Firmen-Tabelle */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border)] px-4 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Firmen-Übersicht
          </p>
        </div>

        {laedt ? (
          <p className="p-4 text-sm text-[var(--text-faint)]">Lädt…</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {firmen.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                {f.logo_url ? (
                  <img src={f.logo_url} alt={f.name}
                    className="h-8 w-8 shrink-0 rounded-lg bg-[var(--bg-muted)] object-contain p-0.5" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-xs font-bold text-[var(--text-soft)]">
                    {f.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-strong)]">{f.name}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {f.nutzer} Nutzer · letzte Aktivität {formatRelativ(f.letzteAktivitaet)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-right">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-strong)]">{f.tickets_gesamt}</p>
                    <p className="text-[0.65rem] text-[var(--text-faint)]">Tickets</p>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${f.tickets_offen > 0 ? "text-orange-500" : "text-green-600"}`}>
                      {f.tickets_offen}
                    </p>
                    <p className="text-[0.65rem] text-[var(--text-faint)]">Offen</p>
                  </div>

                  {/* Auslastungs-Balken */}
                  <div className="w-16">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <div
                        className={`h-1.5 rounded-full ${f.tickets_offen > 10 ? "bg-orange-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(100, (f.tickets_offen / Math.max(f.tickets_gesamt, 1)) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[0.6rem] text-[var(--text-faint)]">
                      {f.tickets_gesamt > 0 ? Math.round((f.tickets_offen / f.tickets_gesamt) * 100) : 0}% offen
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {firmen.length === 0 && (
              <p className="p-4 text-sm text-[var(--text-faint)]">Noch keine Firmen angelegt.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
