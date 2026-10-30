import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import Avatar from "./Avatar";
import { zuletztText, vonDatum, alsBesuchsZeilen, type BesuchsZeile } from "../lib/zeitText";

interface Zeile {
  techniker_id: string;
  tickets_zugewiesen: number;
  tickets_geloest: number;
  tickets_offen: number;
  minuten_gesamt: number;
  minuten_abrechenbar: number;
  antworten: number;
  erstantwort_minuten: number | null;
  csat_positiv: number;
  csat_negativ: number;
}

interface Person {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

type SortKey =
  | "name" | "tickets" | "geloest" | "offen" | "zeit" | "antworten" | "erstantwort" | "zufrieden" | "aktiv" | "zuletzt";

const LEER: Omit<Zeile, "techniker_id"> = {
  tickets_zugewiesen: 0,
  tickets_geloest: 0,
  tickets_offen: 0,
  minuten_gesamt: 0,
  minuten_abrechenbar: 0,
  antworten: 0,
  erstantwort_minuten: null,
  csat_positiv: 0,
  csat_negativ: 0,
};

function Balken({ wert, max, farbe }: { wert: number; max: number; farbe: string }) {
  const breite = max > 0 ? Math.round((wert / max) * 100) : 0;
  return (
    <div className="ml-auto mt-1 h-1 w-24 rounded-full bg-[var(--bg-muted)]">
      <div className="h-1 rounded-full" style={{ width: `${breite}%`, background: farbe }} />
    </div>
  );
}

export default function MitarbeiterAuswertung({
  organisationId,
  zeitraum,
}: {
  organisationId: string;
  zeitraum: number;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).mitarbeiterAuswertung;
  const [personen, setPersonen] = useState<Person[]>([]);
  const [zeilen, setZeilen] = useState<Record<string, Zeile>>({});
  const [besuche, setBesuche] = useState<Record<string, BesuchsZeile>>({});
  const [laedt, setLaedt] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("geloest");
  const [absteigend, setAbsteigend] = useState(true);

  useEffect(() => {
    lade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, zeitraum]);

  async function lade() {
    setLaedt(true);
    const von = new Date();
    von.setDate(von.getDate() - zeitraum);
    const [team, auswertung, besuchDaten] = await Promise.all([
      supabase.rpc("get_team_mit_email", { p_organisation_id: organisationId }).eq("deaktiviert", false),
      supabase.rpc("mitarbeiter_auswertung", { p_organisation_id: organisationId, p_von: von.toISOString() }),
      supabase.rpc("besuche_auswertung", { p_organisation_id: organisationId, p_von: vonDatum(zeitraum) }),
    ]);
    if (auswertung.error) console.error(auswertung.error);
    if (besuchDaten.error) console.error(besuchDaten.error);
    setBesuche(Object.fromEntries(alsBesuchsZeilen(besuchDaten.data).map((b) => [b.nutzer_id, b])));
    setPersonen((team.data as Person[]) ?? []);
    const karte: Record<string, Zeile> = {};
    for (const z of (auswertung.data as Zeile[]) ?? []) {
      karte[z.techniker_id] = {
        ...z,
        tickets_zugewiesen: Number(z.tickets_zugewiesen),
        tickets_geloest: Number(z.tickets_geloest),
        tickets_offen: Number(z.tickets_offen),
        minuten_gesamt: Number(z.minuten_gesamt),
        minuten_abrechenbar: Number(z.minuten_abrechenbar),
        antworten: Number(z.antworten),
        erstantwort_minuten: z.erstantwort_minuten === null ? null : Number(z.erstantwort_minuten),
        csat_positiv: Number(z.csat_positiv),
        csat_negativ: Number(z.csat_negativ),
      };
    }
    setZeilen(karte);
    setLaedt(false);
  }

  function dauer(min: number): string {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h} ${txt.stundenKurz} ${m} ${txt.minKurz}` : `${m} ${txt.minKurz}`;
  }

  function reaktion(min: number | null): string {
    if (min === null) return "—";
    if (min < 60) return `${Math.round(min)} ${txt.minKurz}`;
    if (min < 1440) return `${(min / 60).toFixed(1)} ${txt.stundenKurz}`;
    return `${(min / 1440).toFixed(1)} ${txt.tageKurz}`;
  }

  const daten = useMemo(() => {
    const liste = personen.map((p) => ({ p, z: { ...LEER, ...zeilen[p.id], techniker_id: p.id } as Zeile }));
    const zufrieden = (z: Zeile) => {
      const gesamt = z.csat_positiv + z.csat_negativ;
      return gesamt > 0 ? z.csat_positiv / gesamt : -1;
    };
    const wert = (e: { p: Person; z: Zeile }): number | string => {
      switch (sortKey) {
        case "name": return (e.p.name ?? "").toLowerCase();
        case "tickets": return e.z.tickets_zugewiesen;
        case "geloest": return e.z.tickets_geloest;
        case "offen": return e.z.tickets_offen;
        case "zeit": return e.z.minuten_gesamt;
        case "antworten": return e.z.antworten;
        case "erstantwort": return e.z.erstantwort_minuten ?? Number.POSITIVE_INFINITY;
        case "zufrieden": return zufrieden(e.z);
        case "aktiv": return besuche[e.p.id]?.tage_aktiv ?? 0;
        case "zuletzt": return besuche[e.p.id]?.letzter_besuch ? new Date(besuche[e.p.id].letzter_besuch!).getTime() : 0;
      }
    };
    return liste.sort((a, b) => {
      const x = wert(a);
      const y = wert(b);
      const vergleich = typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number);
      return absteigend ? -vergleich : vergleich;
    });
  }, [personen, zeilen, besuche, sortKey, absteigend]);

  const max = (f: (z: Zeile) => number) => Math.max(0, ...daten.map((d) => f(d.z)));
  const maxGeloest = max((z) => z.tickets_geloest);
  const maxZeit = max((z) => z.minuten_gesamt);
  const maxAntworten = max((z) => z.antworten);
  const summe = daten.reduce(
    (s, d) => ({
      tickets: s.tickets + d.z.tickets_zugewiesen,
      geloest: s.geloest + d.z.tickets_geloest,
      offen: s.offen + d.z.tickets_offen,
      zeit: s.zeit + d.z.minuten_gesamt,
      abrechenbar: s.abrechenbar + d.z.minuten_abrechenbar,
      antworten: s.antworten + d.z.antworten,
    }),
    { tickets: 0, geloest: 0, offen: 0, zeit: 0, abrechenbar: 0, antworten: 0 },
  );

  function sortieren(key: SortKey) {
    if (key === sortKey) setAbsteigend((a) => !a);
    else {
      setSortKey(key);
      setAbsteigend(key !== "name" && key !== "erstantwort");
    }
  }

  function Kopf({ k, label, rechts }: { k: SortKey; label: string; rechts?: boolean }) {
    return (
      <th className={`px-2 py-1.5 font-medium ${rechts ? "text-right" : "text-left"}`}>
        <button onClick={() => sortieren(k)} className="uppercase tracking-wide hover:text-[var(--text-strong)]">
          {label}
          {sortKey === k && <span className="ml-0.5">{absteigend ? "↓" : "↑"}</span>}
        </button>
      </th>
    );
  }

  return (
    <div className="animate-fade-in rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">{txt.titel}</p>
        <p className="text-[0.7rem] text-[var(--text-faint)]">{txt.hinweis}</p>
      </div>

      {laedt ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.laedt}</p>
      ) : daten.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.keineDaten}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[0.65rem] text-[var(--text-faint)]">
                <Kopf k="name" label={txt.mitarbeiter} />
                <Kopf k="tickets" label={txt.tickets} rechts />
                <Kopf k="geloest" label={txt.geloest} rechts />
                <Kopf k="offen" label={txt.offen} rechts />
                <Kopf k="zeit" label={txt.zeit} rechts />
                <Kopf k="antworten" label={txt.antworten} rechts />
                <Kopf k="erstantwort" label={txt.erstantwort} rechts />
                <Kopf k="zufrieden" label={txt.zufriedenheit} rechts />
                <Kopf k="aktiv" label={txt.aktiveTage} rechts />
                <Kopf k="zuletzt" label={txt.zuletztAktiv} rechts />
              </tr>
            </thead>
            <tbody>
              {daten.map(({ p, z }) => {
                const csatGesamt = z.csat_positiv + z.csat_negativ;
                return (
                  <tr key={p.id} className="border-b border-[var(--border)] align-top last:border-b-0">
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-2 text-[var(--text-strong)]">
                        <Avatar name={p.name} avatarUrl={p.avatar_url} groesse="sm" />
                        {p.name ?? txt.unbenannt}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[var(--text-soft)]">{z.tickets_zugewiesen}</td>
                    <td className="px-2 py-2 text-right">
                      <span className="font-mono font-medium text-green-600">{z.tickets_geloest}</span>
                      <Balken wert={z.tickets_geloest} max={maxGeloest} farbe="var(--status-geloest-text)" />
                    </td>
                    <td className={`px-2 py-2 text-right font-mono ${z.tickets_offen > 10 ? "font-medium text-orange-600" : "text-[var(--text-soft)]"}`}>
                      {z.tickets_offen}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="font-mono text-[var(--text-strong)]">{dauer(z.minuten_gesamt)}</span>
                      <span className="block text-[0.65rem] text-[var(--text-faint)]">
                        {dauer(z.minuten_abrechenbar)} {txt.abrechenbar}
                      </span>
                      <Balken wert={z.minuten_gesamt} max={maxZeit} farbe="var(--akzent)" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="font-mono text-[var(--text-soft)]">{z.antworten}</span>
                      <Balken wert={z.antworten} max={maxAntworten} farbe="var(--status-bearbeitung-text)" />
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-[var(--text-faint)]">
                      {reaktion(z.erstantwort_minuten)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-[var(--text-soft)]">
                      {csatGesamt > 0 ? `${Math.round((z.csat_positiv / csatGesamt) * 100)}% (${csatGesamt})` : "—"}
                    </td>
                    <td
                      className="px-2 py-2 text-right font-mono text-xs text-[var(--text-soft)]"
                      title={txt.sitzungenTitelTemplate.replace("{n}", String(besuche[p.id]?.sitzungen ?? 0))}
                    >
                      {besuche[p.id] ? `${besuche[p.id].tage_aktiv} / ${zeitraum}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-[var(--text-faint)]">
                      {zuletztText(besuche[p.id]?.letzter_besuch ?? null, sprache)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border)] text-xs font-medium text-[var(--text-strong)]">
                <td className="px-2 py-2">{txt.summe}</td>
                <td className="px-2 py-2 text-right font-mono">{summe.tickets}</td>
                <td className="px-2 py-2 text-right font-mono">{summe.geloest}</td>
                <td className="px-2 py-2 text-right font-mono">{summe.offen}</td>
                <td className="px-2 py-2 text-right font-mono">
                  {dauer(summe.zeit)}
                  <span className="block text-[0.65rem] font-normal text-[var(--text-faint)]">
                    {dauer(summe.abrechenbar)} {txt.abrechenbar}
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-mono">{summe.antworten}</td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-2 text-[0.7rem] text-[var(--text-faint)]">{txt.spaltenHinweis}</p>
    </div>
  );
}
