import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

interface AbrechnungsZeile {
  kunde_id: string;
  kunde_name: string;
  mwst_satz: number;
  gesamt_minuten: number;
  netto_cent: number;
  mwst_cent: number;
  brutto_cent: number;
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

    const [{ data: zeitDaten }, { data: anpassungDaten }] = await Promise.all([
      supabase
        .from("kunde_monatsabrechnung")
        .select("kunde_id, gesamt_minuten, gesamt_cent, kunde:kunde_id(name, mwst_satz)")
        .eq("organisation_id", organisationId)
        .eq("monat", monatsErster),
      supabase
        .from("rechnungsanpassungen")
        .select("kunde_id, betrag_cent, kunde:kunde_id(name, mwst_satz)")
        .eq("organisation_id", organisationId)
        .eq("monat", monatsErster),
    ]);

    type Roh = {
      kunde_id: string;
      kunde_name: string;
      mwst_satz: number;
      gesamt_minuten: number;
      netto_cent: number;
    };
    const karte = new Map<string, Roh>();

    for (const z of (zeitDaten ?? []) as unknown as Array<{
      kunde_id: string;
      gesamt_minuten: number;
      gesamt_cent: number;
      kunde: { name: string | null; mwst_satz: number | null } | null;
    }>) {
      karte.set(z.kunde_id, {
        kunde_id: z.kunde_id,
        kunde_name: z.kunde?.name ?? "Unbenannt",
        mwst_satz: z.kunde?.mwst_satz ?? 0,
        gesamt_minuten: z.gesamt_minuten,
        netto_cent: z.gesamt_cent,
      });
    }

    for (const a of (anpassungDaten ?? []) as unknown as Array<{
      kunde_id: string;
      betrag_cent: number;
      kunde: { name: string | null; mwst_satz: number | null } | null;
    }>) {
      const bestehend = karte.get(a.kunde_id);
      if (bestehend) {
        bestehend.netto_cent += a.betrag_cent;
      } else {
        karte.set(a.kunde_id, {
          kunde_id: a.kunde_id,
          kunde_name: a.kunde?.name ?? "Unbenannt",
          mwst_satz: a.kunde?.mwst_satz ?? 0,
          gesamt_minuten: 0,
          netto_cent: a.betrag_cent,
        });
      }
    }

    const zeilenFertig: AbrechnungsZeile[] = Array.from(karte.values())
      .map((z) => {
        const mwstCent = Math.round(z.netto_cent * (z.mwst_satz / 100));
        return { ...z, mwst_cent: mwstCent, brutto_cent: z.netto_cent + mwstCent };
      })
      .sort((a, b) => a.kunde_name.localeCompare(b.kunde_name));

    setZeilen(zeilenFertig);
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
      .map(
        (z) =>
          `${z.kunde_name};${z.gesamt_minuten};${(z.netto_cent / 100).toFixed(2)};${(z.mwst_cent / 100).toFixed(2)};${(z.brutto_cent / 100).toFixed(2)}`,
      )
      .join("\n");
    const csv = `Kunde;Minuten;Netto (EUR);MwSt (EUR);Brutto (EUR)\n${zeilenText}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abrechnung-${jahr}-${String(monat).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const gesamtMinuten = zeilen.reduce((sum, z) => sum + z.gesamt_minuten, 0);
  const gesamtNetto = zeilen.reduce((sum, z) => sum + z.netto_cent, 0);
  const gesamtMwst = zeilen.reduce((sum, z) => sum + z.mwst_cent, 0);
  const gesamtBrutto = zeilen.reduce((sum, z) => sum + z.brutto_cent, 0);

  return (
    <div className="space-y-4">
      <div className="keine-druckansicht flex items-center justify-between">
        <h2
          className="text-lg font-semibold text-[var(--text-strong)]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Abrechnung
        </h2>
        {zeilen.length > 0 && (
          <button
            onClick={() => window.print()}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Drucken / Als PDF
          </button>
        )}
      </div>

      <div className="keine-druckansicht flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5">
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
          Keine erfassten Zeiten oder Anpassungen in diesem Monat.
        </p>
      ) : (
        <>
          <div className="druckbereich overflow-hidden rounded-lg border border-[var(--border)]">
            <p className="hidden border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] print:block">
              Monatsübersicht – {monatLabel(jahr, monat)}
            </p>
            <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-muted)] px-4 py-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)]">
              <span className="flex-1">Kunde</span>
              <span className="w-16 text-right">Min.</span>
              <span className="w-20 text-right">Netto</span>
              <span className="w-16 text-right">MwSt.</span>
              <span className="w-20 text-right">Brutto</span>
            </div>
            {zeilen.map((z) => (
              <button
                key={z.kunde_id}
                onClick={() => onKundeAuswahl(z.kunde_id, jahr, monat)}
                className="flex w-full items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--bg-muted)]"
              >
                <span className="flex-1 text-[var(--text-strong)]">{z.kunde_name}</span>
                <span className="w-16 text-right font-mono text-[var(--text-soft)]">
                  {z.gesamt_minuten}
                </span>
                <span className="w-20 text-right font-mono text-[var(--text-soft)]">
                  {formatEuro(z.netto_cent)}
                </span>
                <span className="w-16 text-right font-mono text-[var(--text-faint)]">
                  {formatEuro(z.mwst_cent)}
                </span>
                <span className="w-20 text-right font-mono text-[var(--text-strong)]">
                  {formatEuro(z.brutto_cent)}
                </span>
              </button>
            ))}
            <div className="flex items-center gap-3 bg-[var(--bg-muted)] px-4 py-2.5 text-sm font-medium">
              <span className="flex-1 text-[var(--text-strong)]">Gesamt</span>
              <span className="w-16 text-right font-mono text-[var(--text-strong)]">
                {gesamtMinuten}
              </span>
              <span className="w-20 text-right font-mono text-[var(--text-strong)]">
                {formatEuro(gesamtNetto)}
              </span>
              <span className="w-16 text-right font-mono text-[var(--text-strong)]">
                {formatEuro(gesamtMwst)}
              </span>
              <span className="w-20 text-right font-mono text-[var(--text-strong)]">
                {formatEuro(gesamtBrutto)}
              </span>
            </div>
          </div>

          <button
            onClick={csvExportieren}
            className="keine-druckansicht w-full rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
          >
            Als CSV exportieren
          </button>
        </>
      )}
    </div>
  );
}
