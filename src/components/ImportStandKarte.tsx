import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import { zuletztText } from "../lib/zeitText";
import { importFarbe, type ImportFarbe, type ImportStand } from "../lib/importAlter";

const FARBEN: Record<ImportFarbe, { bg: string; text: string }> = {
  gruen: { bg: "var(--status-geloest-bg)", text: "var(--status-geloest-text)" },
  amber: { bg: "var(--badge-hoch-bg)", text: "var(--badge-hoch-text)" },
  rot: { bg: "var(--badge-kritisch-bg)", text: "var(--badge-kritisch-text)" },
  neutral: { bg: "var(--bg-muted)", text: "var(--text-soft)" },
};

// Ausfuehrliche Darstellung des Datenstands aus dem exocad-Portal (fuer den
// Reiter "Import & Zuordnung"): je Export-Art Datum, Uhrzeit, Alter und eine
// verstaendliche Einordnung.
export default function ImportStandKarte({ stand }: { stand: ImportStand }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).dongleLizenzVerwaltung;
  const locale = sprache === "en" ? "en-US" : "de-DE";

  const zeilen: { key: "dongle" | "lizenz"; label: string }[] = [
    { key: "dongle", label: txt.importDongleListe },
    { key: "lizenz", label: txt.importLizenzListe },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.importStandTitel}</h3>
      <div className="space-y-2">
        {zeilen.map(({ key, label }) => {
          const eintrag = stand[key];
          const farbe = importFarbe(eintrag?.am);
          const f = FARBEN[farbe];
          const status = !eintrag
            ? txt.importStatusNie
            : farbe === "gruen"
              ? txt.importStatusAktuell
              : farbe === "amber"
                ? txt.importStatusAelter
                : txt.importStatusVeraltet;
          return (
            <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[var(--bg-muted)] px-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.text }} />
              <span className="text-sm font-medium text-[var(--text-strong)]">{label}</span>
              <span className="text-xs text-[var(--text-soft)]">
                {eintrag
                  ? `${txt.importZuletzt} ${new Date(eintrag.am).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })} (${zuletztText(eintrag.am, sprache)})${eintrag.rueckwirkend ? ` · ${txt.importGeschaetzt}` : ""}`
                  : txt.importNochNie}
              </span>
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                style={{ background: f.bg, color: f.text }}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-[var(--text-faint)]">{txt.importHandlung}</p>
    </div>
  );
}
