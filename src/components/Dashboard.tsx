import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "../lib/supabaseClient";
import { KpiSkeleton } from "./Skeleton";

interface DashboardProps {
  organisationId: string;
}

interface TicketStats {
  gesamt: number;
  offen: number;
  in_bearbeitung: number;
  wartet_auf_kunde: number;
  geloest: number;
  geschlossen: number;
}

interface TechnikerStat {
  name: string | null;
  avatar_url: string | null;
  offen: number;
  geloest_30d: number;
  durchschnitt_minuten: number | null;
}

interface CsatStat {
  positiv: number;
  negativ: number;
}

interface SlaStat {
  eingehalten: number;
  verletzt: number;
}

interface TagesVolumen {
  tag: string;
  neu: number;
  geloest: number;
}

function KpiKarte({ titel, wert, sub, farbe }: { titel: string; wert: string | number; sub?: string; farbe?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">{titel}</p>
      <p className={`mt-1 text-3xl font-bold ${farbe ?? "text-[var(--text-strong)]"}`}>{wert}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--text-faint)]">{sub}</p>}
    </div>
  );
}

function MiniBalken({ wert, max, farbe }: { wert: number; max: number; farbe: string }) {
  const breite = max > 0 ? Math.round((wert / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--bg-muted)]">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${breite}%`, background: farbe }} />
    </div>
  );
}

function formatMinuten(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${Math.round(min)} Min.`;
  if (min < 1440) return `${(min / 60).toFixed(1)} Std.`;
  return `${(min / 1440).toFixed(1)} Tage`;
}

export default function Dashboard({ organisationId }: DashboardProps) {
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [techniker, setTechniker] = useState<TechnikerStat[]>([]);
  const [csat, setCsat] = useState<CsatStat>({ positiv: 0, negativ: 0 });
  const [sla, setSla] = useState<SlaStat>({ eingehalten: 0, verletzt: 0 });
  const [volumen, setVolumen] = useState<TagesVolumen[]>([]);
  const [zeitraum, setZeitraum] = useState<7 | 30 | 90>(30);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    laden();
  }, [organisationId, zeitraum]);

  async function laden() {
    setLaedt(true);
    const von = new Date();
    von.setDate(von.getDate() - zeitraum);
    const vonIso = von.toISOString();

    await Promise.all([
      ladeTicketStats(),
      ladeTechnikerStats(vonIso),
      ladeCsat(vonIso),
      ladeSla(vonIso),
      ladeTagesVolumen(vonIso),
    ]);
    setLaedt(false);
  }

  async function ladeTicketStats() {
    const { data } = await supabase
      .from("tickets")
      .select("status")
      .eq("organisation_id", organisationId);

    if (!data) return;
    const s: TicketStats = { gesamt: data.length, offen: 0, in_bearbeitung: 0, wartet_auf_kunde: 0, geloest: 0, geschlossen: 0 };
    for (const t of data) s[t.status as keyof TicketStats] = (s[t.status as keyof TicketStats] as number) + 1;
    setStats(s);
  }

  async function ladeTechnikerStats(vonIso: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .eq("organisation_id", organisationId)
      .in("rolle", ["techniker", "org_admin"])
      .eq("deaktiviert", false);

    if (!profile) return;

    const ergebnisse: TechnikerStat[] = await Promise.all(
      profile.map(async (p) => {
        const [offenRes, geloestRes] = await Promise.all([
          supabase.from("tickets").select("id", { count: "exact", head: true })
            .eq("organisation_id", organisationId)
            .eq("zugewiesen_an", p.id)
            .in("status", ["offen", "in_bearbeitung", "wartet_auf_kunde"]),
          supabase.from("tickets").select("erste_antwort_am, erstellt_am", { count: "exact" })
            .eq("organisation_id", organisationId)
            .eq("zugewiesen_an", p.id)
            .in("status", ["geloest", "geschlossen"])
            .gte("erstellt_am", vonIso),
        ]);

        const gelöstTickets = geloestRes.data ?? [];
        const reaktionszeiten = gelöstTickets
          .filter((t) => t.erste_antwort_am)
          .map((t) => (new Date(t.erste_antwort_am).getTime() - new Date(t.erstellt_am).getTime()) / 60000);
        const durchschnitt = reaktionszeiten.length > 0
          ? reaktionszeiten.reduce((a, b) => a + b, 0) / reaktionszeiten.length
          : null;

        return {
          name: p.name,
          avatar_url: p.avatar_url,
          offen: offenRes.count ?? 0,
          geloest_30d: geloestRes.count ?? 0,
          durchschnitt_minuten: durchschnitt,
        };
      })
    );

    setTechniker(ergebnisse.sort((a, b) => b.geloest_30d - a.geloest_30d));
  }

  async function ladeCsat(vonIso: string) {
    const { data } = await supabase
      .from("tickets")
      .select("csat_bewertung")
      .eq("organisation_id", organisationId)
      .not("csat_bewertung", "is", null)
      .gte("csat_am", vonIso);

    if (!data) return;
    setCsat({
      positiv: data.filter((t) => t.csat_bewertung === 1).length,
      negativ: data.filter((t) => t.csat_bewertung === 2).length,
    });
  }

  async function ladeSla(vonIso: string) {
    const { data } = await supabase
      .from("tickets")
      .select("reaktion_faellig_am, erste_antwort_am")
      .eq("organisation_id", organisationId)
      .not("reaktion_faellig_am", "is", null)
      .gte("erstellt_am", vonIso);

    if (!data) return;
    let eingehalten = 0, verletzt = 0;
    for (const t of data) {
      if (!t.erste_antwort_am) { verletzt++; continue; }
      if (new Date(t.erste_antwort_am) <= new Date(t.reaktion_faellig_am)) eingehalten++;
      else verletzt++;
    }
    setSla({ eingehalten, verletzt });
  }

  async function ladeTagesVolumen(vonIso: string) {
    const { data: neu } = await supabase
      .from("tickets")
      .select("erstellt_am")
      .eq("organisation_id", organisationId)
      .gte("erstellt_am", vonIso);

    const { data: geloest } = await supabase
      .from("tickets")
      .select("erstellt_am")
      .eq("organisation_id", organisationId)
      .in("status", ["geloest", "geschlossen"])
      .gte("erstellt_am", vonIso);

    const tageMap: Record<string, { neu: number; geloest: number }> = {};
    const heute = new Date();
    for (let i = zeitraum - 1; i >= 0; i--) {
      const d = new Date(heute);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      tageMap[key] = { neu: 0, geloest: 0 };
    }
    for (const t of neu ?? []) {
      const key = t.erstellt_am.slice(0, 10);
      if (tageMap[key]) tageMap[key].neu++;
    }
    for (const t of geloest ?? []) {
      const key = t.erstellt_am.slice(0, 10);
      if (tageMap[key]) tageMap[key].geloest++;
    }

    setVolumen(Object.entries(tageMap).map(([tag, v]) => ({ tag, ...v })));
  }

  const csatGesamt = csat.positiv + csat.negativ;
  const csatRate = csatGesamt > 0 ? Math.round((csat.positiv / csatGesamt) * 100) : null;
  const slaGesamt = sla.eingehalten + sla.verletzt;
  const slaRate = slaGesamt > 0 ? Math.round((sla.eingehalten / slaGesamt) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-strong)]">Dashboard</h2>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-0.5">
          {([7, 30, 90] as const).map((t) => (
            <button key={t} onClick={() => setZeitraum(t)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${zeitraum === t ? "bg-[var(--bg-surface)] text-[var(--text-strong)] shadow-sm" : "text-[var(--text-faint)] hover:text-[var(--text-soft)]"}`}>
              {t} Tage
            </button>
          ))}
        </div>
      </div>

      {laedt ? (
        <p className="text-sm text-[var(--text-faint)]">Lädt…</p>
      ) : (
        <>
          {/* KPI-Zeile */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in">
            {laedt ? (
              <>
                <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
              </>
            ) : (
              <>
                <KpiKarte titel="Tickets gesamt" wert={stats?.gesamt ?? 0} />
                <KpiKarte titel="Offen / aktiv"
                  wert={(stats?.offen ?? 0) + (stats?.in_bearbeitung ?? 0) + (stats?.wartet_auf_kunde ?? 0)}
                  farbe={(stats?.offen ?? 0) + (stats?.in_bearbeitung ?? 0) > 10 ? "text-orange-600" : "text-[var(--text-strong)]"}
                />
                <KpiKarte titel="Kundenzufriedenheit"
                  wert={csatRate !== null ? `${csatRate}%` : "—"}
                  sub={csatGesamt > 0 ? `${csatGesamt} Bewertungen` : "Noch keine Bewertungen"}
                  farbe={csatRate !== null ? (csatRate >= 80 ? "text-green-600" : csatRate >= 60 ? "text-yellow-600" : "text-red-600") : undefined}
                />
                <KpiKarte titel="SLA-Einhaltung"
                  wert={slaRate !== null ? `${slaRate}%` : "—"}
                  sub={slaGesamt > 0 ? `${slaGesamt} Tickets mit SLA` : "Keine SLA konfiguriert"}
                  farbe={slaRate !== null ? (slaRate >= 90 ? "text-green-600" : slaRate >= 70 ? "text-yellow-600" : "text-red-600") : undefined}
                />
              </>
            )}
          </div>

          {/* Status-Aufschlüsselung */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">Status-Verteilung</p>
            <div className="space-y-2.5">
              {[
                { label: "Offen", wert: stats?.offen ?? 0, farbe: "var(--status-offen-text)" },
                { label: "In Bearbeitung", wert: stats?.in_bearbeitung ?? 0, farbe: "var(--status-bearbeitung-text)" },
                { label: "Wartet auf Kunde", wert: stats?.wartet_auf_kunde ?? 0, farbe: "var(--status-warten-text)" },
                { label: "Gelöst", wert: stats?.geloest ?? 0, farbe: "var(--status-geloest-text)" },
                { label: "Geschlossen", wert: stats?.geschlossen ?? 0, farbe: "var(--text-faint)" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs text-[var(--text-soft)]">{s.label}</span>
                  <div className="flex-1">
                    <MiniBalken wert={s.wert} max={stats?.gesamt ?? 1} farbe={`var(${s.farbe.slice(4, -1)})`} />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-[var(--text-strong)]">{s.wert}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Volumen-Chart mit Recharts */}
          {volumen.length > 0 && !laedt && (
            <div className="animate-fade-in rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">Ticket-Volumen</p>
                <div className="flex items-center gap-4 text-xs text-[var(--text-faint)]">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-blue-400" />Neu</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-green-400" />Gelöst</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={volumen} barGap={2} barSize={zeitraum > 30 ? 4 : 8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="tag" tickFormatter={(v: string) => v.slice(5)}
                    tick={{ fontSize: 9, fill: "var(--text-faint)" }}
                    tickLine={false} axisLine={false}
                    interval={zeitraum <= 7 ? 0 : zeitraum <= 30 ? 4 : 9}
                  />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-faint)" }} tickLine={false} axisLine={false} width={20} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                    labelFormatter={(v) => String(v)}
                    formatter={(val) => [String(val ?? ""), (val === 0 || val) ? "" : ""]}
                  />
                  <Bar dataKey="neu" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="geloest" fill="#4ade80" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Reaktionszeit-Trend */}
          {techniker.length > 0 && !laedt && techniker.some((t) => t.durchschnitt_minuten !== null) && (
            <div className="animate-fade-in rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">Ø Reaktionszeit (Minuten)</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={techniker.filter((t) => t.durchschnitt_minuten !== null)} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text-faint)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-faint)" }} tickLine={false} axisLine={false} width={30}
                    tickFormatter={(v: number) => v >= 60 ? `${Math.round(v/60)}h` : `${v}m`} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                    
                  />
                  <Bar dataKey="durchschnitt_minuten" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Techniker-Tabelle */}
          {techniker.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">Team-Auslastung</p>
              <div className="space-y-0">
                <div className="grid grid-cols-4 border-b border-[var(--border)] pb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  <span>Techniker</span>
                  <span className="text-center">Offen</span>
                  <span className="text-center">Gelöst ({zeitraum}d)</span>
                  <span className="text-right">Ø Reaktion</span>
                </div>
                {techniker.map((t, i) => (
                  <div key={i} className="grid grid-cols-4 items-center border-b border-[var(--border)] py-2 text-sm last:border-b-0">
                    <span className="text-[var(--text-strong)]">{t.name ?? "Unbenannt"}</span>
                    <span className={`text-center font-medium ${t.offen > 10 ? "text-orange-600" : "text-[var(--text-soft)]"}`}>
                      {t.offen}
                    </span>
                    <span className="text-center text-green-600 font-medium">{t.geloest_30d}</span>
                    <span className="text-right text-xs text-[var(--text-faint)]">
                      {formatMinuten(t.durchschnitt_minuten)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CSAT Details */}
          {csatGesamt > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">Kundenzufriedenheit (CSAT)</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👍</span>
                  <div>
                    <p className="text-xl font-bold text-green-600">{csat.positiv}</p>
                    <p className="text-xs text-[var(--text-faint)]">Positiv</p>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <div className="h-3 rounded-full bg-green-500 transition-all"
                      style={{ width: `${csatRate ?? 0}%` }} />
                  </div>
                  <p className="mt-1 text-center text-xs text-[var(--text-faint)]">{csatRate}% Zufriedenheit</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xl font-bold text-red-500">{csat.negativ}</p>
                    <p className="text-xs text-[var(--text-faint)]">Negativ</p>
                  </div>
                  <span className="text-2xl">👎</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
