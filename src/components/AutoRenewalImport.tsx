import { useRef, useState } from "react";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import {
  AutoRenewalFehler,
  autoRenewalAbgleichen,
  autoRenewalAnwenden,
  reportLesen,
  type AutoRenewalAbgleich,
} from "../lib/autoRenewalImport";

interface AutoRenewalImportProps {
  organisationId: string;
  onFertig?: () => void;
}

type Phase = "start" | "prueft" | "vorschau" | "speichert" | "fertig";

const karteKlasse = "rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3";
const knopfKlasse =
  "rounded-lg border border-[var(--border-input)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors";

export default function AutoRenewalImport({ organisationId, onFertig }: AutoRenewalImportProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).autoRenewal;
  const locale = sprache === "en" ? "en-US" : "de-DE";
  const dateiRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("start");
  const [dateiName, setDateiName] = useState<string | null>(null);
  const [abgleich, setAbgleich] = useState<AutoRenewalAbgleich | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const datum = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(locale) : "–");

  function zuruecksetzen() {
    setPhase("start");
    setAbgleich(null);
    setDateiName(null);
    setFehler(null);
  }

  async function dateiGewaehlt(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setPhase("prueft");
    try {
      const zeilen = await reportLesen(datei);
      setAbgleich(await autoRenewalAbgleichen(organisationId, zeilen));
      setDateiName(datei.name);
      setPhase("vorschau");
    } catch (err) {
      console.error(err);
      const art = err instanceof AutoRenewalFehler ? err.message : "lesen";
      setFehler(art === "spalten" ? txt.fehlerSpalten : art === "leer" ? txt.fehlerLeer : txt.fehlerLesen);
      setPhase("start");
    } finally {
      if (dateiRef.current) dateiRef.current.value = "";
    }
  }

  async function uebernehmen() {
    if (!abgleich) return;
    setPhase("speichert");
    try {
      await autoRenewalAnwenden(organisationId, abgleich, dateiName);
      setPhase("fertig");
      onFertig?.();
    } catch (err) {
      console.error(err);
      setFehler(txt.fehlerSpeichern);
      setPhase("vorschau");
    }
  }

  const beschaeftigt = phase === "prueft" || phase === "speichert";
  const aenderungen = abgleich ? abgleich.setzen.length + abgleich.entfernen.length : 0;

  return (
    <div className={karteKlasse}>
      <p className="text-sm font-medium text-[var(--text-strong)]">{txt.label}</p>
      <p className="mb-2 text-xs text-[var(--text-faint)]">{txt.sub}</p>

      {(phase === "start" || phase === "prueft") && (
        <>
          <input
            ref={dateiRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => dateiGewaehlt(e.target.files?.[0])}
          />
          <button onClick={() => dateiRef.current?.click()} disabled={beschaeftigt} className={`w-full ${knopfKlasse}`}>
            {phase === "prueft" ? `⏳ ${txt.liest}` : txt.dateiWaehlen}
          </button>
        </>
      )}

      {fehler && <p className="mt-1 text-xs text-red-600">{fehler}</p>}

      {abgleich && (phase === "vorschau" || phase === "speichert") && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-lg bg-[var(--bg-muted)] p-2">
              <p className="text-lg font-semibold text-[var(--text-strong)]">{abgleich.dateiZeilen}</p>
              <p className="text-[11px] text-[var(--text-faint)]">{txt.sumImReport}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)] p-2">
              <p className="text-lg font-semibold text-[var(--text-strong)]">{abgleich.setzen.length}</p>
              <p className="text-[11px] text-[var(--text-faint)]">{txt.sumNeu}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)] p-2">
              <p className="text-lg font-semibold text-[var(--text-strong)]">{abgleich.unveraendert}</p>
              <p className="text-[11px] text-[var(--text-faint)]">{txt.sumUnveraendert}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)] p-2">
              <p className={`text-lg font-semibold ${abgleich.fehltImReport.length > 0 ? "text-amber-600" : "text-[var(--text-strong)]"}`}>
                {abgleich.fehltImReport.length}
              </p>
              <p className="text-[11px] text-[var(--text-faint)]">{txt.sumFehlt}</p>
            </div>
          </div>

          <p className="text-xs text-[var(--text-faint)]">
            {txt.zeitraum.replace("{von}", datum(abgleich.frueh)).replace("{bis}", datum(abgleich.spaet))}
          </p>

          {abgleich.fehltImReport.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--text-strong)]">{txt.fehltTitel}</p>
              <p className="mb-1 text-xs text-[var(--text-faint)]">{txt.fehltHinweis}</p>
              <ul className="max-h-48 space-y-1 overflow-auto rounded-lg bg-[var(--badge-hoch-bg)] p-2 text-xs text-[var(--badge-hoch-text)]">
                {abgleich.fehltImReport.map((f) => (
                  <li key={f.serial} className="break-words">
                    <span className="font-mono font-medium">{f.serial}</span> · {txt.ende} {datum(f.ende)} · {f.kunde ?? txt.ohneKunde} ·{" "}
                    {f.renewalBezahlt ? txt.renewalBezahlt : txt.renewalOffen}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {abgleich.nichtImSystem.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-red-600">{txt.nichtImSystemTitel}</p>
              <ul className="max-h-40 space-y-1 overflow-auto rounded-lg bg-[var(--badge-kritisch-bg)] p-2 text-xs text-[var(--badge-kritisch-text)]">
                {abgleich.nichtImSystem.map((z) => (
                  <li key={z.serial} className="break-words">
                    <span className="font-mono font-medium">{z.serial}</span> · {txt.autoRenewal} {datum(z.auto)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {abgleich.abweichungen.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--text-strong)]">{txt.abweichungTitel}</p>
              <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[var(--border)] p-2 text-xs text-[var(--text-soft)]">
                {abgleich.abweichungen.map((a, i) => (
                  <li key={`${a.serial}-${a.feld}-${i}`} className="break-words">
                    <span className="font-mono">{a.serial}</span> · {a.feld === "start" ? txt.start : txt.ende}: {txt.system} {datum(a.system)} →{" "}
                    {txt.report} {datum(a.report)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {abgleich.entfernen.length > 0 && (
            <p className="text-xs text-[var(--text-faint)]">{txt.entfernenHinweis.replace("{n}", String(abgleich.entfernen.length))}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={uebernehmen}
              disabled={phase === "speichert"}
              className="flex-1 rounded-lg bg-akzent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {phase === "speichert" ? `⏳ ${txt.speichert}` : txt.uebernehmen.replace("{n}", String(aenderungen))}
            </button>
            <button onClick={zuruecksetzen} disabled={phase === "speichert"} className={knopfKlasse}>
              {txt.abbrechen}
            </button>
          </div>
        </div>
      )}

      {phase === "fertig" && abgleich && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-strong)]">
            ✅ {txt.ergebnis.replace("{n}", String(abgleich.setzen.length)).replace("{f}", String(abgleich.fehltImReport.length))}
          </p>
          <button onClick={zuruecksetzen} className={knopfKlasse}>
            {txt.fertig}
          </button>
        </div>
      )}
    </div>
  );
}
