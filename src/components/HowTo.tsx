import { useState, useSyncExternalStore } from "react";
import { X, Share, Download } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import {
  aufAenderungHoeren,
  installationMoeglich,
  installationStarten,
  istIOS,
  laeuftAlsApp,
} from "../lib/pwaInstall";

interface HowToSchritt {
  titel: string;
  text: string;
}

// Installations-Hinweis: zeigt - je nach Browser - entweder einen echten
// Installations-Button (Chrome/Edge/Android) oder die manuelle Anleitung
// (iOS/Safari und alles andere). Laeuft die App bereits installiert, wird
// gar nichts angezeigt.
function InstallHinweis() {
  const { sprache } = useSprache();
  const txt = texte(sprache).howTo;
  const kannInstallieren = useSyncExternalStore(aufAenderungHoeren, installationMoeglich, () => false);
  const [laeuft, setLaeuft] = useState(false);
  const [abgelehnt, setAbgelehnt] = useState(false);

  if (laeuftAlsApp()) return null;

  async function installieren() {
    setLaeuft(true);
    const ergebnis = await installationStarten();
    setLaeuft(false);
    if (ergebnis === "dismissed") setAbgelehnt(true);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Download size={15} className="shrink-0 text-akzent" />
        <p className="text-sm font-medium text-[var(--text-strong)]">{txt.alsAppInstallieren}</p>
      </div>

      {kannInstallieren ? (
        <>
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-soft)]">
            {txt.installHinweisText}
          </p>
          <button
            onClick={installieren}
            disabled={laeuft}
            className="w-full rounded-lg bg-akzent py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {laeuft ? txt.wirdInstalliert : txt.jetztInstallieren}
          </button>
          {abgelehnt && (
            <p className="mt-1.5 text-xs text-[var(--text-faint)]">
              {txt.abgebrochenHinweis}
            </p>
          )}
        </>
      ) : istIOS() ? (
        <p className="text-xs leading-relaxed text-[var(--text-soft)]">
          {txt.iosVor} <strong>{txt.iosSafari}</strong> {txt.iosMid1}{" "}
          <Share size={11} className="inline align-[-1px]" /> {txt.iosMid2}{" "}
          <strong>{txt.iosZumHome}</strong> {txt.iosNach}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-[var(--text-soft)]">
          {txt.andereVor} <strong>{txt.andereAppInstallieren}</strong> {txt.andereOder}
          <strong> {txt.andereZumStartbildschirm}</strong> {txt.andereNach}
        </p>
      )}
    </div>
  );
}

interface HowToProps {
  istIntern: boolean;
  autoOeffnen: boolean;
  onGesehen: () => void;
}

export default function HowTo({ istIntern, autoOeffnen, onGesehen }: HowToProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).howTo;
  const [offen, setOffen] = useState(autoOeffnen);
  const internSchritte: HowToSchritt[] = [
    { titel: txt.internTitel1, text: txt.internText1 },
    { titel: txt.internTitel2, text: txt.internText2 },
    { titel: txt.internTitel3, text: txt.internText3 },
    { titel: txt.internTitel4, text: txt.internText4 },
    { titel: txt.internTitel5, text: txt.internText5 },
  ];
  const kundeSchritte: HowToSchritt[] = [
    { titel: txt.kundeTitel1, text: txt.kundeText1 },
    { titel: txt.kundeTitel2, text: txt.kundeText2 },
    { titel: txt.kundeTitel3, text: txt.kundeText3 },
    { titel: txt.kundeTitel4, text: txt.kundeText4 },
  ];
  const schritte = istIntern ? internSchritte : kundeSchritte;

  function schliessen() {
    setOffen(false);
    if (autoOeffnen) onGesehen();
  }

  return (
    <>
      <button
        onClick={() => setOffen(true)}
        title={txt.anleitungTooltip}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-bold text-[var(--text-faint)] transition-colors hover:border-[var(--akzent)] hover:text-[var(--akzent)]"
      >
        ?
      </button>

      {offen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={schliessen}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">
                {txt.dialogTitel}
              </h3>
              <button
                onClick={schliessen}
                className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-muted)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {schritte.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-xs font-bold text-[var(--text-strong)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-[var(--text-strong)]">{s.titel}</p>
                    <p className="text-xs leading-relaxed text-[var(--text-soft)]">{s.text}</p>
                  </div>
                </div>
              ))}

              <InstallHinweis />
            </div>

            <div className="border-t border-[var(--border)] px-5 py-3">
              <button
                onClick={schliessen}
                className="w-full rounded-lg bg-akzent py-2 text-sm font-medium text-white"
              >
                {txt.verstanden}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export async function howToAlsGesehenMarkieren(profilId: string) {
  await supabase.from("profiles").update({ howto_gesehen: true }).eq("id", profilId);
}
