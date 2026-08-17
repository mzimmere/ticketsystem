import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { berechneFreiminutenAbzug, type DongleFreiminuten, type ZeitEintragMitDongle } from "../lib/freiminuten";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface AbrechnungsZeile {
  kunde_id: string;
  kunde_name: string;
  mwst_satz: number;
  gesamt_minuten: number;
  netto_cent: number;
  mwst_cent: number;
  brutto_cent: number;
  wartungsvertrag_stufe: { name: string; farbe: string } | null;
}

interface AbrechnungProps {
  organisationId: string;
  onKundeAuswahl: (kundeId: string, jahr: number, monat: number) => void;
}

function formatEuro(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function monatLabel(jahr: number, monat: number, sprache: "de" | "en"): string {
  return new Date(jahr, monat - 1, 1).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE", {
    month: "long",
    year: "numeric",
  });
}

export default function Abrechnung({ organisationId, onKundeAuswahl }: AbrechnungProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).abrechnung;
  const heute = new Date();
  const [jahr, setJahr] = useState(heute.getFullYear());
  const [monat, setMonat] = useState(heute.getMonth() + 1); // 1-12
  const [zeilen, setZeilen] = useState<AbrechnungsZeile[]>([]);
  const [laedt, setLaedt] = useState(true);

  const monatsErster = useMemo(
    () => `${jahr}-${String(monat).padStart(2, "0")}-01`,
    [jahr, monat],
  );
  const naechsterMonatErster = useMemo(() => {
    const naechsterMonat = monat === 12 ? 1 : monat + 1;
    const naechstesJahr = monat === 12 ? jahr + 1 : jahr;
    return `${naechstesJahr}-${String(naechsterMonat).padStart(2, "0")}-01`;
  }, [jahr, monat]);

  useEffect(() => {
    ladeAbrechnung();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, jahr, monat]);

  async function ladeAbrechnung() {
    setLaedt(true);

    const [{ data: zeitDaten }, { data: anpassungDaten }, { data: dongleDaten }] = await Promise.all([
      supabase
        .from("zeiteintraege")
        .select("kunde_id, minuten, preis_pro_minute_cent_snapshot, kunde:kunde_id(name, mwst_satz, wartungsvertrag_stufe:wartungsvertrag_stufe_id(name, farbe)), ticket:ticket_id(dongle_id)")
        .eq("organisation_id", organisationId)
        .gte("erstellt_am", monatsErster)
        .lt("erstellt_am", naechsterMonatErster)
        .not("minuten", "is", null),
      supabase
        .from("rechnungsanpassungen")
        .select("kunde_id, betrag_cent, kunde:kunde_id(name, mwst_satz, wartungsvertrag_stufe:wartungsvertrag_stufe_id(name, farbe))")
        .eq("organisation_id", organisationId)
        .eq("monat", monatsErster),
      supabase
        .from("kunden_dongles")
        .select("id, kunde_id, seriennummer, freiminuten_pro_monat")
        .eq("organisation_id", organisationId),
    ]);

    type Roh = {
      kunde_id: string;
      kunde_name: string;
      mwst_satz: number;
      gesamt_minuten: number;
      netto_cent: number;
      wartungsvertrag_stufe: { name: string; farbe: string } | null;
    };
    const karte = new Map<string, Roh>();

    const eintraegeJeKunde = new Map<string, ZeitEintragMitDongle[]>();
    const namenJeKunde = new Map<string, { name: string | null; mwst_satz: number | null; wartungsvertrag_stufe: { name: string; farbe: string } | null }>();
    for (const z of (zeitDaten ?? []) as unknown as Array<{
      kunde_id: string;
      minuten: number;
      preis_pro_minute_cent_snapshot: number;
      kunde: { name: string | null; mwst_satz: number | null; wartungsvertrag_stufe: { name: string; farbe: string } | null } | null;
      ticket: { dongle_id: string | null } | null;
    }>) {
      namenJeKunde.set(z.kunde_id, z.kunde ?? { name: null, mwst_satz: null, wartungsvertrag_stufe: null });
      const liste = eintraegeJeKunde.get(z.kunde_id) ?? [];
      liste.push({
        minuten: z.minuten,
        preis_pro_minute_cent_snapshot: z.preis_pro_minute_cent_snapshot,
        dongle_id: z.ticket?.dongle_id ?? null,
      });
      eintraegeJeKunde.set(z.kunde_id, liste);
    }

    const dongleListe = (dongleDaten as (DongleFreiminuten & { kunde_id: string | null })[]) ?? [];
    const dongleJeKunde = new Map<string, DongleFreiminuten[]>();
    for (const d of dongleListe) {
      if (!d.kunde_id) continue;
      const liste = dongleJeKunde.get(d.kunde_id) ?? [];
      liste.push(d);
      dongleJeKunde.set(d.kunde_id, liste);
    }

    for (const [kundeId, eintraege] of eintraegeJeKunde) {
      const kundeInfo = namenJeKunde.get(kundeId);
      const abzug = berechneFreiminutenAbzug(eintraege, dongleJeKunde.get(kundeId) ?? []);
      karte.set(kundeId, {
        kunde_id: kundeId,
        kunde_name: kundeInfo?.name ?? txt.unbenannt,
        mwst_satz: kundeInfo?.mwst_satz ?? 0,
        gesamt_minuten: abzug.gesamtMinuten,
        netto_cent: abzug.zwischensummeNachAbzug,
        wartungsvertrag_stufe: kundeInfo?.wartungsvertrag_stufe ?? null,
      });
    }

    for (const a of (anpassungDaten ?? []) as unknown as Array<{
      kunde_id: string;
      betrag_cent: number;
      kunde: { name: string | null; mwst_satz: number | null; wartungsvertrag_stufe: { name: string; farbe: string } | null } | null;
    }>) {
      const bestehend = karte.get(a.kunde_id);
      if (bestehend) {
        bestehend.netto_cent += a.betrag_cent;
      } else {
        karte.set(a.kunde_id, {
          kunde_id: a.kunde_id,
          kunde_name: a.kunde?.name ?? txt.unbenannt,
          mwst_satz: a.kunde?.mwst_satz ?? 0,
          gesamt_minuten: 0,
          netto_cent: a.betrag_cent,
          wartungsvertrag_stufe: a.kunde?.wartungsvertrag_stufe ?? null,
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
    const csv = `${txt.csvHeader}\n${zeilenText}`;
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
        >
          {txt.titel}
        </h2>
        {zeilen.length > 0 && (
          <button
            onClick={() => window.print()}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {txt.drucken}
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
          {monatLabel(jahr, monat, sprache)}
        </span>
        <button
          onClick={() => monatWechseln(1)}
          className="rounded px-2 py-1 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          →
        </button>
      </div>

      {laedt ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.laedt}</p>
      ) : zeilen.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">
          {txt.keineDaten}
        </p>
      ) : (
        <>
          <div className="druckbereich overflow-hidden rounded-lg border border-[var(--border)]">
            <p className="hidden border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-strong)] print:block">
              {txt.monatsuebersicht} {monatLabel(jahr, monat, sprache)}
            </p>
            <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-muted)] px-4 py-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)]">
              <span className="flex-1">{txt.spalteKunde}</span>
              <span className="w-16 text-right">{txt.spalteMin}</span>
              <span className="w-20 text-right">{txt.spalteNetto}</span>
              <span className="w-16 text-right">{txt.spalteMwst}</span>
              <span className="w-20 text-right">{txt.spalteBrutto}</span>
            </div>
            {zeilen.map((z) => (
              <button
                key={z.kunde_id}
                onClick={() => onKundeAuswahl(z.kunde_id, jahr, monat)}
                className="flex w-full items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-[var(--bg-muted)]"
              >
                <span className="flex flex-1 items-center gap-1.5 text-[var(--text-strong)]">
                  {z.kunde_name}
                  {z.wartungsvertrag_stufe && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[0.65rem] font-medium text-white"
                      style={{ background: z.wartungsvertrag_stufe.farbe }}
                    >
                      {z.wartungsvertrag_stufe.name}
                    </span>
                  )}
                </span>
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
              <span className="flex-1 text-[var(--text-strong)]">{txt.gesamt}</span>
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
            {txt.alsCsvExportieren}
          </button>
        </>
      )}
    </div>
  );
}
