import { useRef, useState } from "react";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import { ImportFehler, kundenImportAnwenden, kundenImportPruefen, type ImportZeile } from "../lib/kundenImport";

interface KundenImportProps {
  organisationId: string;
  // Nach erfolgreichem Speichern, z.B. um Listen neu zu laden.
  onFertig?: () => void;
}

type Phase = "start" | "prueft" | "vorschau" | "speichert" | "fertig";

const karteKlasse = "rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3";
const knopfKlasse =
  "rounded-lg border border-[var(--border-input)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors";

export default function KundenImport({ organisationId, onFertig }: KundenImportProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).kundenImport;
  const exportTxt = texte(sprache).kundenExport;
  const dateiRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("start");
  const [zeilen, setZeilen] = useState<ImportZeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ ok: number; fehlgeschlagen: { name: string; grund: string }[] } | null>(null);

  const mitAenderung = zeilen.filter((z) => z.fehler.length === 0 && z.aenderungen.length > 0);
  const mitFehler = zeilen.filter((z) => z.fehler.length > 0);
  const unveraendert = zeilen.length - mitAenderung.length - mitFehler.length;

  function zuruecksetzen() {
    setPhase("start");
    setZeilen([]);
    setFehler(null);
    setErgebnis(null);
  }

  async function dateiGewaehlt(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setErgebnis(null);
    setPhase("prueft");
    try {
      const geprueft = await kundenImportPruefen({ organisationId, datei, exportTxt, txt });
      setZeilen(geprueft);
      setPhase("vorschau");
    } catch (err) {
      console.error(err);
      setFehler(err instanceof ImportFehler ? err.message : txt.fehlerLesen);
      setPhase("start");
    } finally {
      if (dateiRef.current) dateiRef.current.value = "";
    }
  }

  async function speichern() {
    setPhase("speichert");
    try {
      const r = await kundenImportAnwenden(zeilen, txt);
      setErgebnis(r);
      setPhase("fertig");
      onFertig?.();
    } catch (err) {
      console.error(err);
      setFehler(txt.fehlerSpeichern);
      setPhase("vorschau");
    }
  }

  const beschaeftigt = phase === "prueft" || phase === "speichert";

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

      {(phase === "vorschau" || phase === "speichert") && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[var(--bg-muted)] p-2">
              <p className="text-lg font-semibold text-[var(--text-strong)]">{mitAenderung.length}</p>
              <p className="text-[11px] text-[var(--text-faint)]">{txt.sumAendern}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)] p-2">
              <p className="text-lg font-semibold text-[var(--text-strong)]">{unveraendert}</p>
              <p className="text-[11px] text-[var(--text-faint)]">{txt.sumUnveraendert}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)] p-2">
              <p className={`text-lg font-semibold ${mitFehler.length > 0 ? "text-red-600" : "text-[var(--text-strong)]"}`}>{mitFehler.length}</p>
              <p className="text-[11px] text-[var(--text-faint)]">{txt.sumFehler}</p>
            </div>
          </div>

          <p className="text-xs text-[var(--text-faint)]">{txt.leereZellenHinweis}</p>

          {mitAenderung.length === 0 && mitFehler.length === 0 && <p className="text-sm text-[var(--text-soft)]">{txt.nichtsZuTun}</p>}

          {mitAenderung.length > 0 && (
            <div className="max-h-96 space-y-2 overflow-auto rounded-lg border border-[var(--border)] p-2">
              {mitAenderung.map((z) => (
                <div key={z.zeile} className="text-xs">
                  <p className="font-medium text-[var(--text-strong)]">
                    {z.anzeigeName} <span className="font-normal text-[var(--text-faint)]">· {txt.zeile} {z.zeile}</span>
                  </p>
                  <ul className="ml-3 mt-0.5 space-y-0.5">
                    {z.aenderungen.map((a) => (
                      <li key={a.feld} className="break-words text-[var(--text-soft)]">
                        <span className="text-[var(--text-faint)]">{a.feld}:</span> {a.alt} <span className="text-[var(--text-faint)]">→</span>{" "}
                        <span className="font-medium text-[var(--text-strong)]">{a.neu}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {mitFehler.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-red-600">{txt.fehlerUebersprungen}</p>
              <ul className="max-h-48 space-y-1 overflow-auto rounded-lg bg-[var(--badge-kritisch-bg)] p-2 text-xs text-[var(--badge-kritisch-text)]">
                {mitFehler.map((z) => (
                  <li key={z.zeile} className="break-words">
                    <span className="font-medium">{z.anzeigeName}</span> ({txt.zeile} {z.zeile}): {z.fehler.join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={speichern}
              disabled={phase === "speichert" || mitAenderung.length === 0}
              className="flex-1 rounded-lg bg-akzent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {phase === "speichert" ? `⏳ ${txt.speichert}` : txt.anwenden.replace("{n}", String(mitAenderung.length))}
            </button>
            <button onClick={zuruecksetzen} disabled={phase === "speichert"} className={knopfKlasse}>
              {txt.abbrechen}
            </button>
          </div>
        </div>
      )}

      {phase === "fertig" && ergebnis && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-strong)]">✅ {txt.ergebnisErfolg.replace("{n}", String(ergebnis.ok))}</p>
          {ergebnis.fehlgeschlagen.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600">{txt.ergebnisFehler.replace("{n}", String(ergebnis.fehlgeschlagen.length))}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--badge-kritisch-text)]">
                {ergebnis.fehlgeschlagen.map((f) => (
                  <li key={f.name}>
                    {f.name}: {f.grund}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={zuruecksetzen} className={knopfKlasse}>
            {txt.fertig}
          </button>
        </div>
      )}
    </div>
  );
}
