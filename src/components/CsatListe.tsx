import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface CsatListeProps {
  organisationId: string;
  zeitraum: number;
  onSchliessen: () => void;
  onTicketOeffnen?: (ticketId: string) => void;
}

interface Bewertung {
  id: string;
  ticket_nr: number | null;
  titel: string;
  csat_bewertung: number;
  csat_am: string;
  csat_kommentar: string | null;
  kunde: { name: string | null; firmenname: string | null } | null;
  zugewiesen: { name: string | null } | null;
}

type Filter = "alle" | "negativ" | "positiv";

// Einzelbewertungen hinter der Dashboard-Kachel "Kundenzufriedenheit": wer hat
// wann wie bewertet, bei welchem Ticket, bei welchem Bearbeiter und mit
// welchem Text. Negative Bewertungen stehen oben.
export default function CsatListe({ organisationId, zeitraum, onSchliessen, onTicketOeffnen }: CsatListeProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).csatListe;
  const [zeilen, setZeilen] = useState<Bewertung[] | null>(null);
  const [filter, setFilter] = useState<Filter>("alle");

  useEffect(() => {
    let abgebrochen = false;
    setZeilen(null);
    const von = new Date();
    von.setDate(von.getDate() - zeitraum);
    supabase
      .from("tickets")
      .select(
        "id, ticket_nr, titel, csat_bewertung, csat_am, csat_kommentar, kunde:kunde_id(name, firmenname), zugewiesen:zugewiesen_an(name)",
      )
      .eq("organisation_id", organisationId)
      .not("csat_bewertung", "is", null)
      .gte("csat_am", von.toISOString())
      .order("csat_am", { ascending: false })
      .then(({ data, error }) => {
        if (abgebrochen) return;
        if (error) console.error(error);
        const liste = ((data as unknown as Bewertung[]) ?? []).slice();
        // 👎 (2) zuerst, innerhalb davon neueste zuerst
        liste.sort((a, b) => b.csat_bewertung - a.csat_bewertung || b.csat_am.localeCompare(a.csat_am));
        setZeilen(liste);
      });
    return () => {
      abgebrochen = true;
    };
  }, [organisationId, zeitraum]);

  const gefiltert = (zeilen ?? []).filter(
    (z) => filter === "alle" || (filter === "negativ" ? z.csat_bewertung === 2 : z.csat_bewertung === 1),
  );
  const anzahlNegativ = (zeilen ?? []).filter((z) => z.csat_bewertung === 2).length;
  const anzahlPositiv = (zeilen ?? []).filter((z) => z.csat_bewertung === 1).length;

  const zeitFormat = (iso: string) =>
    new Date(iso).toLocaleString(sprache === "de" ? "de-DE" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const chip = (wert: Filter, label: string, anzahl: number) => (
    <button
      key={wert}
      onClick={() => setFilter(wert)}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        filter === wert
          ? "border-akzent bg-akzent-soft text-akzent"
          : "border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
      }`}
    >
      {label} <span className="font-mono">{anzahl}</span>
    </button>
  );

  return (
    <div className="animate-fade-in rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
          {txt.titel} ({zeitraum} {texte(sprache).dashboard.tage})
        </p>
        <button onClick={onSchliessen} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)]">
          {txt.schliessen}
        </button>
      </div>
      <p className="mb-3 text-xs text-[var(--text-faint)]">{txt.hinweis}</p>

      <div className="mb-3 flex flex-wrap gap-2">
        {chip("alle", txt.alle, (zeilen ?? []).length)}
        {chip("negativ", txt.nurNegativ, anzahlNegativ)}
        {chip("positiv", txt.nurPositiv, anzahlPositiv)}
      </div>

      {zeilen === null ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.lade}</p>
      ) : gefiltert.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.keine}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {gefiltert.map((z) => {
            const negativ = z.csat_bewertung === 2;
            const kundeName = z.kunde?.name?.trim() || z.kunde?.firmenname?.trim() || "—";
            const firma = z.kunde?.firmenname?.trim();
            return (
              <li key={z.id} className="flex gap-3 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                  style={{
                    background: negativ ? "var(--badge-kritisch-bg)" : "var(--bg-muted)",
                  }}
                  title={negativ ? txt.negativLabel : txt.positivLabel}
                >
                  {negativ ? "👎" : "👍"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text-strong)]">
                    <span className="font-medium">{kundeName}</span>
                    {firma && firma !== kundeName && <span className="text-[var(--text-faint)]"> · {firma}</span>}
                  </p>
                  <p className="text-xs text-[var(--text-soft)]">
                    {onTicketOeffnen ? (
                      <button
                        onClick={() => onTicketOeffnen(z.id)}
                        title={txt.ticketOeffnen}
                        className="text-left text-akzent hover:underline"
                      >
                        #{z.ticket_nr ?? "?"} {z.titel}
                      </button>
                    ) : (
                      <span>
                        #{z.ticket_nr ?? "?"} {z.titel}
                      </span>
                    )}
                  </p>
                  {z.csat_kommentar?.trim() ? (
                    <p
                      className="mt-1.5 whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm"
                      style={{
                        background: negativ ? "var(--badge-kritisch-bg)" : "var(--bg-muted)",
                        color: negativ ? "var(--badge-kritisch-text)" : "var(--text-strong)",
                      }}
                    >
                      {z.csat_kommentar}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-[var(--text-faint)]">{txt.keinKommentar}</p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-[var(--text-faint)]">
                  <p>{zeitFormat(z.csat_am)}</p>
                  <p className="mt-0.5">
                    {txt.bearbeiter}: {z.zugewiesen?.name?.trim() || txt.nichtZugewiesen}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
