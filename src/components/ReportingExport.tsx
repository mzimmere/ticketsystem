import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

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

function downloadBlob(inhalt: BlobPart, dateiname: string, typ: string) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = dateiname; a.click();
  URL.revokeObjectURL(url);
}

// exceljs/jspdf werden erst bei Bedarf nachgeladen (dynamic import), damit
// sie nicht das Haupt-Bundle aufblaehen - die meisten Exporte laufen
// weiterhin als reines CSV ohne diese Abhaengigkeiten.
async function downloadXlsx(kopf: string[], zeilen: (string | number | null)[][], dateiname: string, blattname: string) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet(blattname);
  ws.addRow(kopf);
  ws.getRow(1).font = { bold: true };
  zeilen.forEach((z) => ws.addRow(z));
  ws.columns.forEach((col) => { col.width = 20; });
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(buffer, dateiname, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

async function downloadPdf(titel: string, kopf: string[], zeilen: (string | number | null)[][], dateiname: string) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(13);
  doc.text(titel, 14, 15);
  autoTable(doc, {
    head: [kopf],
    body: zeilen.map((z) => z.map((f) => (f === null ? "" : String(f)))),
    startY: 20,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(dateiname);
}

export default function ReportingExport({ organisationId }: ReportingExportProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).reportingExport;
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

    const kopf = csvZeile(txt.csvTicketsKopf);
    const zeilen = data.map((t) => csvZeile([
      t.ticket_nr, t.titel, t.status, t.prioritaet,
      t.erstellt_am?.slice(0, 16).replace("T", " "),
      t.erste_antwort_am?.slice(0, 16).replace("T", " ") ?? null,
      t.reaktion_faellig_am?.slice(0, 16).replace("T", " ") ?? null,
      t.loesung_faellig_am?.slice(0, 16).replace("T", " ") ?? null,
      t.csat_bewertung === 1 ? txt.positiv : t.csat_bewertung === 2 ? txt.negativ : null,
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

    const kopf = csvZeile(txt.csvZeitKopf);
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

    const kopf = csvZeile(txt.csvCsatKopf);
    const zeilen = data.map((t) => csvZeile([
      t.ticket_nr, t.titel,
      t.csat_bewertung === 1 ? txt.positivMitEmoji : txt.negativMitEmoji,
      t.csat_am?.slice(0, 10),
      (t.kunde as unknown as { name: string | null } | null)?.name ?? null,
      (t.zugewiesen as unknown as { name: string | null } | null)?.name ?? null,
    ]));
    download([kopf, ...zeilen].join("\n"), `csat-${von}-${bis}.csv`);
    setLaedt(null);
  }

  async function ladeLizenzZeilen(): Promise<(string | number | null)[][] | null> {
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("lizenz_seriennummer, produkt_name, lizenz_typ, vertrag_ende, status, kunde:kunde_id(name, firmenname), dongle:dongle_id(seriennummer)")
      .eq("organisation_id", organisationId)
      .not("vertrag_ende", "is", null)
      .gte("vertrag_ende", von)
      .lte("vertrag_ende", bis)
      .order("vertrag_ende");

    if (!data) return null;

    return data.map((v) => [
      (v.kunde as unknown as { name: string | null } | null)?.name ?? null,
      (v.kunde as unknown as { firmenname: string | null } | null)?.firmenname ?? null,
      (v.dongle as unknown as { seriennummer: string | null } | null)?.seriennummer ?? txt.keinDongle,
      v.lizenz_seriennummer,
      v.produkt_name,
      v.lizenz_typ,
      v.vertrag_ende,
      v.status,
    ]);
  }

  async function exportLizenzVerlaengerungen(format: "csv" | "xlsx" | "pdf") {
    setLaedt(`lizenz-${format}`);
    try {
      const zeilen = await ladeLizenzZeilen();
      if (!zeilen) return;

      if (format === "csv") {
        const kopf = csvZeile(txt.csvLizenzKopf);
        download([kopf, ...zeilen.map((z) => csvZeile(z))].join("\n"), `lizenz-verlaengerungen-${von}-${bis}.csv`);
      } else if (format === "xlsx") {
        await downloadXlsx(txt.csvLizenzKopf, zeilen, `lizenz-verlaengerungen-${von}-${bis}.xlsx`, txt.lizenzLabel.replace(/^\S+\s/, ""));
      } else {
        await downloadPdf(txt.lizenzPdfTitelTemplate.replace("{von}", von).replace("{bis}", bis), txt.csvLizenzKopf, zeilen, `lizenz-verlaengerungen-${von}-${bis}.pdf`);
      }
    } finally {
      setLaedt(null);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>
      <p className="text-xs text-[var(--text-faint)]">
        {txt.beschreibung}
      </p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.von}</label>
          <input type="date" value={von} onChange={(e) => setVon(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.bis}</label>
          <input type="date" value={bis} onChange={(e) => setBis(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {[
          { id: "tickets", label: txt.ticketsLabel, sub: txt.ticketsSub, fn: exportTickets },
          { id: "zeit", label: txt.zeitLabel, sub: txt.zeitSub, fn: exportZeit },
          { id: "csat", label: txt.csatLabel, sub: txt.csatSub, fn: exportCsat },
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

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <p className="text-sm font-medium text-[var(--text-strong)]">{txt.lizenzLabel}</p>
          <p className="mb-2 text-xs text-[var(--text-faint)]">{txt.lizenzSub}</p>
          <div className="flex gap-2">
            {(["csv", "xlsx", "pdf"] as const).map((format) => (
              <button
                key={format}
                onClick={() => exportLizenzVerlaengerungen(format)}
                disabled={laedt !== null}
                className="flex-1 rounded-lg border border-[var(--border-input)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
              >
                {laedt === `lizenz-${format}` ? "⏳" : format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
