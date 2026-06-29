import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

interface AbrechnungsZeile {
  kunde_id: string;
  kunde_name: string | null;
  gesamt_minuten: number;
  gesamt_cent: number;
}

interface AbrechnungProps {
  organisationId: string;
  onKundeAuswahl: (kundeId: string, jahr: number, monat: number) => void;
}

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function monatLabel(jahr: number, monat: number): string {
  return new Date(jahr, monat - 1, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
}

export default function Abrechnung({ organisationId, onKundeAuswahl }: AbrechnungProps) {
  const heute = new Date();
  const [jahr, setJahr] = useState(heute.getFullYear());
  const [monat, setMonat] = useState(heute.getMonth() + 1); // 1-12
  const [zeilen, setZeilen] = useState<AbrechnungsZeile[]>([]);
  const [laedt, setLaedt] = useState(true);

  const monatsErster = useMemo(
    () => `${jahr}-${String(monat).padStart(2, "0")}-01`,
    [jahr, monat],
  );

  useEffect(() => {
    ladeAbrechnung();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, jahr, monat]);

  async function ladeAbrechnung() {
    setLaedt(true);
    const { data } = await supabase
      .from("kunde_monatsabrechnung")
      .select("kunde_id, gesamt_minuten, gesamt_cent, kunde:kunde_id(name)")
      .eq("organisation_id", organisationId)
      .eq("monat", monatsErster);

    const zeilenMitName = ((data ?? []) as unknown as Array<{
      kunde_id: string;
      gesamt_minuten: number;
      gesamt_cent: number;
      kunde: { name: string | null } | null;
    }>)
      .map((z) => ({
        kunde_id: z.kunde_id,
        kunde_name: z.kunde?.name ?? "Unbenannt",
        gesamt_minuten: z.gesamt_minuten,
        gesamt_cent: z.gesamt_cent,
      }))
      .sort((a, b) => (a.kunde_name ?? "").localeCompare(b.kunde_name ?? ""));

    setZeilen(zeilenMitName);
    setLaedt(false);
  }

  function monatWechseln(delta: number) {
    let neuerMonat = monat + delta;
    let neuesJahr = jahr;
    if (neuerMonat > 12) {
      neuerMonat = 1;
      neuesJahr += 1;
    } else if (neuerMonat < 1) {
      neuerMonat = 12;
      neuesJahr -= 1;
    }
    setMonat(neuerMonat);
    setJahr(neuesJahr);
  }

  function csvExportieren() {
    const zeilenText = zeilen
      .map((z) => `${z.kunde_name};${z.gesamt_minuten};${(z.gesamt_cent / 100).toFixed(2)}`)
      .join("\n");
    const csv = `Kunde;Minuten;Betrag (EUR)\n${zeilenText}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abrechnung-${jahr}-${String(monat).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const gesamtMinuten = zeilen.reduce((sum, z) => sum + z.gesamt_minuten, 0);
  const gesamtCent = zeilen.reduce((sum, z) => sum + z.gesamt_cent, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-lg font-semibold text-[var(--text-strong)]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Abrechnung
        </h2>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5">
        <button
          onClick={() => monatWechseln(-1)}
          className="rounded px-2 py-1 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          ←
        </button>
        <span className="text-sm font-medium text-[var(--text-strong)]">
          {monatLabel(jahr, monat)}
        </span>
        <button
          onClick={() => monatWechseln(1)}
          className="rounded px-2 py-1 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          →
        </button>
      </div>

      {laedt ? (
        <p className="text-sm text-[var(--text-faint)]">Lädt…</p>
      ) : zeilen.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">
          Keine erfassten Zeiten in diesem Monat.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-muted)] px-4 py-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)]">
              <span className="flex-1">Kunde</span>
              <span className="w-20 text-right">Minuten</span>
              <span className="w-24 text-right">Betrag</span>
            </div>
            {zeilen.map((z) => (
              <button
                key={z.kunde_id}
                onClick={() => onKundeAuswahl(z.kunde_id, jahr, monat)}
                className="flex w-full items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--bg-muted)]"
              >
                <span className="flex-1 text-[var(--text-strong)]">{z.kunde_name}</span>
                <span className="w-20 text-right font-mono text-[var(--text-soft)]">
                  {z.gesamt_minuten}
                </span>
                <span className="w-24 text-right font-mono text-[var(--text-strong)]">
                  {formatEuro(z.gesamt_cent)}
                </span>
              </button>
            ))}
            <div className="flex items-center gap-3 bg-[var(--bg-muted)] px-4 py-2.5 text-sm font-medium">
              <span className="flex-1 text-[var(--text-strong)]">Gesamt</span>
              <span className="w-20 text-right font-mono text-[var(--text-strong)]">
                {gesamtMinuten}
              </span>
              <span className="w-24 text-right font-mono text-[var(--text-strong)]">
                {formatEuro(gesamtCent)}
              </span>
            </div>
          </div>

          <button
            onClick={csvExportieren}
            className="w-full rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
          >
            Als CSV exportieren
          </button>
        </>
      )}
    </div>
  );
}
