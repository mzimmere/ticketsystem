import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import { ablaufInfo } from "../lib/ablaufInfo";
import { softwareStil } from "../lib/softwareStil";

export interface DetailKunde {
  name: string | null;
  firmenname?: string | null;
}

export interface DetailDongle {
  id: string;
  seriennummer: string;
  software: string;
  wartungsvertrag: string | null;
  freiminuten_pro_monat: number | null;
  kunde_id: string | null;
  kunde: DetailKunde | null;
}

export interface DetailVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
  status: string | null;
  aktuelle_engine_build: string | null;
  max_erlaubte_engine_build: string | null;
  renewal_bezahlt: boolean;
  dongle_id: string | null;
  kunde_id: string | null;
  kunde: DetailKunde | null;
}

function kundeText(k: DetailKunde | null | undefined): string | null {
  if (!k) return null;
  const name = k.name?.trim();
  const firma = k.firmenname?.trim();
  if (name && firma && name !== firma) return `${name} · ${firma}`;
  return name || firma || null;
}

function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <div className="text-sm text-[var(--text-strong)]">{children}</div>
    </div>
  );
}

// Kompakte Vertragszeile mit denselben Farben wie die Gesamtuebersicht:
// Vertragsende (rot = abgelaufen, gelb = in <= 30 Tagen), Renewal, Build.
function VertragZeile({
  v,
  nichtVerknuepft,
  onRenewalUmschalten,
}: {
  v: DetailVertrag;
  nichtVerknuepft?: boolean;
  onRenewalUmschalten?: (vertragId: string, aktuellerWert: boolean) => void;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).dongleLizenzVerwaltung;
  const dongleTxt = texte(sprache).dongleVerwaltung;
  const dTxt = texte(sprache).dongleDetail;
  const aktiv = !v.status || v.status.toLowerCase() === "active";
  const a = v.vertrag_ende ? ablaufInfo(v.vertrag_ende) : null;
  const datum = v.vertrag_ende ? new Date(v.vertrag_ende).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE") : null;
  const stil =
    a?.farbe === "rot"
      ? { background: "var(--badge-kritisch-bg)", color: "var(--badge-kritisch-text)" }
      : a?.farbe === "amber"
        ? { background: "var(--badge-hoch-bg)", color: "var(--badge-hoch-text)" }
        : undefined;
  const renewalKlasse = `rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium ${
    v.renewal_bezahlt
      ? "bg-[var(--status-geloest-bg)] text-[var(--status-geloest-text)]"
      : aktiv
        ? "bg-[var(--badge-kritisch-bg)] text-[var(--badge-kritisch-text)]"
        : "bg-[var(--bg-surface)] text-[var(--text-faint)]"
  }`;

  return (
    <div className="space-y-1 rounded bg-[var(--bg-surface)] px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-xs text-[var(--text-strong)]">{v.lizenz_seriennummer}</span>
        <span className="text-xs text-[var(--text-faint)]">· {v.produkt_name}</span>
        {v.status && <span className="text-xs text-[var(--text-faint)]">({v.status})</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {v.aktuelle_engine_build && v.aktuelle_engine_build !== "null" && (
          <span className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--text-soft)]">
            {txt.buildLabel} {v.aktuelle_engine_build}
            {v.max_erlaubte_engine_build && v.max_erlaubte_engine_build !== "null" && v.max_erlaubte_engine_build !== v.aktuelle_engine_build
              ? ` → ${v.max_erlaubte_engine_build}`
              : ""}
          </span>
        )}
        {a && datum && (
          <span style={stil} className={`rounded-full px-1.5 py-0.5 text-[0.65rem] ${stil ? "font-medium" : "text-[var(--text-faint)]"}`}>
            {txt.bisPrefix} {datum}
            {a.farbe === "rot" && ` · ${txt.ablaufAbgelaufen}`}
            {a.farbe === "amber" && ` · ${txt.ablaufInTagenTemplate.replace("{n}", String(a.tage))}`}
          </span>
        )}
        {onRenewalUmschalten ? (
          <button onClick={() => onRenewalUmschalten(v.id, v.renewal_bezahlt)} title={dongleTxt.renewalBezahltHinweis} className={renewalKlasse}>
            {v.renewal_bezahlt ? dongleTxt.renewalBezahlt : dongleTxt.renewalOffen}
          </button>
        ) : (
          <span className={renewalKlasse}>{v.renewal_bezahlt ? dongleTxt.renewalBezahlt : dongleTxt.renewalOffen}</span>
        )}
        {nichtVerknuepft && (
          <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[0.65rem] text-[var(--text-soft)]">
            {dTxt.nichtVerknuepft}
            {kundeText(v.kunde) ? ` · ${dTxt.vertragKunde}: ${kundeText(v.kunde)}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// Aufgeklappter Bereich unter einer Dongle-Zeile: wem gehoert der Dongle, welche
// Vertraege haengen daran, welche Module sind aktiv und wie viele Tickets sind
// offen. Module und Tickets werden erst beim Aufklappen geladen.
export default function DongleDetailPanel({
  dongle,
  vertraege,
  onRenewalUmschalten,
}: {
  dongle: DetailDongle;
  vertraege: DetailVertrag[];
  onRenewalUmschalten?: (vertragId: string, aktuellerWert: boolean) => void;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).dongleDetail;
  const [module, setModule] = useState<{ name: string; aktiv: boolean }[] | null>(null);
  const [offeneTickets, setOffeneTickets] = useState<number | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    setModule(null);
    setOffeneTickets(null);
    supabase
      .from("dongle_module")
      .select("name, aktiv")
      .eq("dongle_id", dongle.id)
      .order("name")
      .then(({ data }) => {
        if (!abgebrochen) setModule((data as { name: string; aktiv: boolean }[]) ?? []);
      });
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("dongle_id", dongle.id)
      .in("status", ["offen", "in_bearbeitung", "wartet_auf_kunde"])
      .then(({ count }) => {
        if (!abgebrochen) setOffeneTickets(count ?? 0);
      });
    return () => {
      abgebrochen = true;
    };
  }, [dongle.id]);

  return (
    <div className="mt-1 space-y-3 rounded bg-[var(--bg-muted)] px-3 py-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Feld label={txt.kunde}>
          {kundeText(dongle.kunde) ?? <span className="italic text-[var(--text-faint)]">{txt.keinKunde}</span>}
        </Feld>
        <Feld label={txt.software}>
          <span style={softwareStil(dongle.software)} className="rounded-full px-2 py-0.5 text-xs font-medium">
            {dongle.software}
          </span>
        </Feld>
        <Feld label={txt.wartungsvertrag}>
          {dongle.wartungsvertrag?.trim() || "—"}
          {dongle.freiminuten_pro_monat ? (
            <span className="text-xs text-[var(--text-faint)]"> · {dongle.freiminuten_pro_monat} min</span>
          ) : null}
        </Feld>
        <Feld label={txt.offeneTickets}>{offeneTickets === null ? "…" : offeneTickets}</Feld>
      </div>

      <div className="space-y-1">
        <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-faint)]">{txt.vertraege}</p>
        {vertraege.length === 0 ? (
          <p className="text-xs italic text-[var(--text-faint)]">{txt.keinVertrag}</p>
        ) : (
          vertraege.map((v) => (
            <VertragZeile key={v.id} v={v} nichtVerknuepft={v.dongle_id !== dongle.id} onRenewalUmschalten={onRenewalUmschalten} />
          ))
        )}
      </div>

      <div className="space-y-1">
        <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-faint)]">{txt.module}</p>
        {module === null ? (
          <p className="text-xs text-[var(--text-faint)]">{txt.laedt}</p>
        ) : module.length === 0 ? (
          <p className="text-xs italic text-[var(--text-faint)]">{txt.keineModule}</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {module.map((m) => (
              <span
                key={m.name}
                className={`rounded px-1.5 py-0.5 text-[0.65rem] ${
                  m.aktiv ? "bg-[var(--bg-surface)] text-[var(--text-soft)]" : "bg-[var(--bg-surface)] text-[var(--text-faint)] line-through"
                }`}
              >
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Aufgeklappter Bereich unter einer Vertragszeile: zu welchem Dongle und
// Kunden gehoert der Vertrag. Ist er nicht verknuepft, aber ein Dongle mit
// passender Nummer existiert, wird darauf hingewiesen.
export function VertragDetailPanel({
  vertrag,
  dongle,
  passenderDongle,
}: {
  vertrag: DetailVertrag;
  dongle: DetailDongle | null;
  passenderDongle: DetailDongle | null;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).dongleDetail;
  return (
    <div className="mt-1 space-y-2 rounded bg-[var(--bg-muted)] px-3 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Feld label={txt.kunde}>
          {kundeText(vertrag.kunde) ?? <span className="italic text-[var(--text-faint)]">{txt.keinKunde}</span>}
        </Feld>
        <Feld label={txt.dongle}>
          {dongle ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{dongle.seriennummer}</span>
              <span style={softwareStil(dongle.software)} className="rounded-full px-2 py-0.5 text-xs font-medium">
                {dongle.software}
              </span>
            </span>
          ) : (
            <span className="italic text-[var(--text-faint)]">{txt.nichtVerknuepft}</span>
          )}
        </Feld>
        {dongle && (
          <Feld label={txt.dongleKunde}>
            {kundeText(dongle.kunde) ?? <span className="italic text-[var(--text-faint)]">{txt.keinKunde}</span>}
          </Feld>
        )}
      </div>
      {!dongle &&
        (passenderDongle ? (
          <p className="text-xs text-[var(--text-soft)]">
            {txt.passenderDongleTemplate.replace("{serial}", passenderDongle.seriennummer)}{" "}
            {txt.dongleKunde}: {kundeText(passenderDongle.kunde) ?? txt.keinKunde}.
          </p>
        ) : (
          <p className="text-xs italic text-[var(--text-faint)]">{txt.keinDongle}</p>
        ))}
    </div>
  );
}

