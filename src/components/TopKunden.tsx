import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import { ladeKundenStatistik, type KundenStat } from "../lib/kundenStatistik";
import { zuletztText } from "../lib/zeitText";

interface KundeKurz {
  id: string;
  name: string | null;
  firmenname: string | null;
}

type Ansicht = "tickets" | "zeit" | "besuche";

const TOP_ANZAHL = 10;

function minutenText(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Rangliste der Kunden im Dashboard: wer hat die meisten Tickets, die meiste
// erfasste Zeit oder die meisten Portal-Besuche im gewaehlten Zeitraum.
export default function TopKunden({ organisationId, zeitraum }: { organisationId: string; zeitraum: number }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).topKunden;
  const [ansicht, setAnsicht] = useState<Ansicht>("tickets");
  const [kunden, setKunden] = useState<KundeKurz[]>([]);
  const [stat, setStat] = useState<Record<string, KundenStat>>({});
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLaedt(true);
    Promise.all([
      supabase
        .from("profiles")
        .select("id, name, firmenname")
        .eq("organisation_id", organisationId)
        .eq("rolle", "kunde"),
      ladeKundenStatistik(organisationId, zeitraum),
    ])
      .then(([k, s]) => {
        if (abgebrochen) return;
        setKunden((k.data as KundeKurz[]) ?? []);
        setStat(s);
      })
      .catch((err) => console.error("[TopKunden]", err))
      .finally(() => {
        if (!abgebrochen) setLaedt(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [organisationId, zeitraum]);

  const wert = (s: KundenStat | undefined) =>
    ansicht === "tickets" ? (s?.tickets ?? 0) : ansicht === "zeit" ? (s?.minuten ?? 0) : (s?.besuche ?? 0);

  const rang = kunden
    .map((k) => ({ k, s: stat[k.id] }))
    .filter((z) => wert(z.s) > 0)
    .sort((a, b) => wert(b.s) - wert(a.s) || (a.k.name ?? "").localeCompare(b.k.name ?? "", "de"))
    .slice(0, TOP_ANZAHL);
  const max = Math.max(1, ...rang.map((z) => wert(z.s)));

  const anzeige = (z: { s: KundenStat | undefined }) =>
    ansicht === "tickets"
      ? `${z.s?.tickets ?? 0} ${txt.ticketsEinheit}`
      : ansicht === "zeit"
        ? minutenText(z.s?.minuten ?? 0)
        : `${z.s?.besuche ?? 0} ${txt.besucheEinheit}`;

  const tab = (id: Ansicht, label: string) => (
    <button
      key={id}
      onClick={() => setAnsicht(id)}
      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
        ansicht === id
          ? "bg-[var(--bg-surface)] text-[var(--text-strong)] shadow-sm"
          : "text-[var(--text-faint)] hover:text-[var(--text-soft)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="animate-fade-in rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">{txt.titel}</p>
          <p className="text-[0.7rem] text-[var(--text-faint)]">{txt.hinweis}</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-0.5">
          {tab("tickets", txt.tabTickets)}
          {tab("zeit", txt.tabZeit)}
          {tab("besuche", txt.tabBesuche)}
        </div>
      </div>

      {laedt ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.laedt}</p>
      ) : rang.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.keineDaten}</p>
      ) : (
        <ol className="space-y-2.5">
          {rang.map((z, i) => (
            <li key={z.k.id} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right font-mono text-xs text-[var(--text-faint)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-[var(--text-strong)]">
                    {z.k.name ?? "—"}
                    {z.k.firmenname && z.k.firmenname !== z.k.name && (
                      <span className="text-xs text-[var(--text-faint)]"> · {z.k.firmenname}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-[var(--text-strong)]">{anzeige(z)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--bg-muted)]">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.round((wert(z.s) / max) * 100)}%`, background: "var(--akzent)" }}
                  />
                </div>
                <div className="mt-0.5 text-[0.65rem] text-[var(--text-faint)]">
                  {ansicht !== "besuche" && (z.s?.offen ?? 0) > 0 && (
                    <span>
                      {z.s?.offen} {txt.offen}
                    </span>
                  )}
                  {ansicht === "besuche" && (
                    <span>
                      {txt.letzterBesuch}: {zuletztText(z.s?.letzterBesuch ?? null, sprache)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {ansicht === "besuche" && <p className="mt-3 text-[0.7rem] text-[var(--text-faint)]">{txt.besuchHinweis}</p>}
    </div>
  );
}
