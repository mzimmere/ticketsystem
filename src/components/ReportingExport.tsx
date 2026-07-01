import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface ReportingExportProps {
  organisationId: string;
}

function csvZeile(felder: (string | number | null)[]): string {
  return felder.map((f) => {
    const s = f === null ? "" : String(f);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",");
}

function download(inhalt: string, dateiname: string, typ = "text/csv;charset=utf-8;") {
  const blob = new Blob(["\uFEFF" + inhalt, ""], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = dateiname; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportingExport({ organisationId }: ReportingExportProps) {
  const [von, setVon] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [bis, setBis] = useState(() => new Date().toISOString().slice(0, 10));
  const [laedt, setLaedt] = useState<string | null>(null);

  async function exportTickets() {
    setLaedt("tickets");
    const { data } = await supabase
      .from("tickets")
      .select("ticket_nr, titel, status, prioritaet, erstellt_am, erste_antwort_am, reaktion_faellig_am, loesung_faellig_am, csat_bewertung, kunde:kunde_id(name), zugewiesen:zugewiesen_an(name)")
      .eq("organisation_id", organisationId)
      .gte("erstellt_am", von)
      .lte("erstellt_am", bis + "T23:59:59")
      .order("ticket_nr");

    if (!data) { setLaedt(null); return; }

    const kopf = csvZeile(["Ticket-Nr", "Titel", "Status", "Priorität", "Erstellt", "Erste Antwort", "Reaktion fällig", "Lösung fällig", "CSAT", "Kunde", "Zugewiesen"]);
    const zeilen = data.map((t) => csvZeile([
      t.ticket_nr, t.titel, t.status, t.prioritaet,
      t.erstellt_am?.slice(0, 16).replace("T", " "),
      t.erste_antwort_am?.slice(0, 16).replace("T", " ") ?? null,
      t.reaktion_faellig_am?.slice(0, 16).replace("T", " ") ?? null,
      t.loesung_faellig_am?.slice(0, 16).replace("T", " ") ?? null,
      t.csat_bewertung === 1 ? "Positiv" : t.csat_bewertung === 2 ? "Negativ" : null,
      (t.kunde as unknown as { name: string | null } | null)?.name ?? null,
      (t.zugewiesen as unknown as { name: string | null } | null)?.name ?? null,
    ]));
    download([kopf, ...zeilen].join("\n"), `tickets-${von}-${bis}.csv`);
    setLaedt(null);
  }

  async function exportZeit() {
    setLaedt("zeit");
    const { data } = await supabase
      .from("zeiteintraege")
      .select("erstellt_am, minuten, beschreibung, erfassungsart, ticket:ticket_id(ticket_nr, titel), techniker:techniker_id(name), kunde:kunde_id(name)")
      .eq("organisation_id", organisationId)
      .gte("erstellt_am", von)
      .lte("erstellt_am", bis + "T23:59:59")
      .order("erstellt_am");

    if (!data) { setLaedt(null); return; }

    const kopf = csvZeile(["Datum", "Minuten", "Stunden", "Beschreibung", "Art", "Ticket-Nr", "Ticket", "Techniker", "Kunde"]);
    const zeilen = data.map((z) => csvZeile([
      z.erstellt_am?.slice(0, 10),
      z.minuten, (z.minuten / 60).toFixed(2),
      z.beschreibung ?? null,
      z.erfassungsart,
      (z.ticket as unknown as { ticket_nr: number } | null)?.ticket_nr ?? null,
      (z.ticket as unknown as { titel: string } | null)?.titel ?? null,
      (z.techniker as unknown as { name: string | null } | null)?.name ?? null,
      (z.kunde as unknown as { name: string | null } | null)?.name ?? null,
    ]));
    download([kopf, ...zeilen].join("\n"), `zeiterfassung-${von}-${bis}.csv`);
    setLaedt(null);
  }

  async function exportCsat() {
    setLaedt("csat");
    const { data } = await supabase
      .from("tickets")
      .select("ticket_nr, titel, csat_bewertung, csat_am, kunde:kunde_id(name), zugewiesen:zugewiesen_an(name)")
      .eq("organisation_id", organisationId)
      .not("csat_bewertung", "is", null)
      .gte("csat_am", von)
      .lte("csat_am", bis + "T23:59:59")
      .order("csat_am");

    if (!data) { setLaedt(null); return; }

    const kopf = csvZeile(["Ticket-Nr", "Titel", "Bewertung", "Bewertet am", "Kunde", "Techniker"]);
    const zeilen = data.map((t) => csvZeile([
      t.ticket_nr, t.titel,
      t.csat_bewertung === 1 ? "Positiv 👍" : "Negativ 👎",
      t.csat_am?.slice(0, 10),
      (t.kunde as unknown as { name: string | null } | null)?.name ?? null,
      (t.zugewiesen as unknown as { name: string | null } | null)?.name ?? null,
    ]));
    download([kopf, ...zeilen].join("\n"), `csat-${von}-${bis}.csv`);
    setLaedt(null);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">Daten exportieren</h3>
      <p className="text-xs text-[var(--text-faint)]">
        Alle Exporte als CSV-Datei (UTF-8, Komma-getrennt) – direkt in Excel oder Google Sheets öffenbar.
      </p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Von</label>
          <input type="date" value={von} onChange={(e) => setVon(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Bis</label>
          <input type="date" value={bis} onChange={(e) => setBis(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {[
          { id: "tickets", label: "🎫 Tickets exportieren", sub: "Alle Tickets mit Status, SLA, CSAT", fn: exportTickets },
          { id: "zeit", label: "⏱ Zeiterfassung exportieren", sub: "Alle Zeiteinträge mit Minuten und Beschreibung", fn: exportZeit },
          { id: "csat", label: "⭐ CSAT-Bewertungen exportieren", sub: "Nur Tickets mit Kundenbewertung", fn: exportCsat },
        ].map((exp) => (
          <button key={exp.id} onClick={exp.fn} disabled={laedt !== null}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-left hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors">
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-strong)]">{exp.label}</p>
              <p className="text-xs text-[var(--text-faint)]">{exp.sub}</p>
            </div>
            <span className="text-sm text-[var(--text-faint)]">
              {laedt === exp.id ? "⏳" : "⬇️"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
