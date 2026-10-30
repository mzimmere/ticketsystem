import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import KennzahlKarte from "./KennzahlKarte";
import { zuletztText, vonDatum, alsBesuchsZeilen, type BesuchsZeile } from "../lib/zeitText";
import { Users, MousePointerClick, UserX } from "lucide-react";

interface KundeKurz {
  id: string;
  name: string | null;
  firmenname: string | null;
}

const TOP_ANZAHL = 10;

export default function KundenAktivitaet({
  organisationId,
  zeitraum,
}: {
  organisationId: string;
  zeitraum: number;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).kundenAktivitaet;
  const [kunden, setKunden] = useState<KundeKurz[]>([]);
  const [besuche, setBesuche] = useState<Record<string, BesuchsZeile>>({});
  const [laedt, setLaedt] = useState(true);
  const [zeigeInaktive, setZeigeInaktive] = useState(false);

  useEffect(() => {
    lade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, zeitraum]);

  async function lade() {
    setLaedt(true);
    const [kundenRes, besuchRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, firmenname")
        .eq("organisation_id", organisationId)
        .eq("rolle", "kunde")
        .eq("deaktiviert", false)
        .order("name"),
      supabase.rpc("besuche_auswertung", { p_organisation_id: organisationId, p_von: vonDatum(zeitraum) }),
    ]);
    if (besuchRes.error) console.error(besuchRes.error);
    setKunden((kundenRes.data as KundeKurz[]) ?? []);
    setBesuche(
      Object.fromEntries(
        alsBesuchsZeilen(besuchRes.data)
          .filter((b) => !b.ist_mitarbeiter)
          .map((b) => [b.nutzer_id, b]),
      ),
    );
    setLaedt(false);
  }

  const zeilen = kunden.map((k) => ({ k, b: besuche[k.id] }));
  const aktiv = zeilen
    .filter((z) => (z.b?.tage_aktiv ?? 0) > 0)
    .sort((a, b) => (b.b?.sitzungen ?? 0) - (a.b?.sitzungen ?? 0));
  const inaktiv = zeilen
    .filter((z) => (z.b?.tage_aktiv ?? 0) === 0)
    .sort((a, b) => {
      const x = a.b?.letzter_besuch ? new Date(a.b.letzter_besuch).getTime() : 0;
      const y = b.b?.letzter_besuch ? new Date(b.b.letzter_besuch).getTime() : 0;
      return y - x;
    });
  const besucheGesamt = aktiv.reduce((s, z) => s + (z.b?.sitzungen ?? 0), 0);
  const nieErfasst = zeilen.filter((z) => !z.b?.letzter_besuch).length;
  const top = aktiv.slice(0, TOP_ANZAHL);
  const maxSitzungen = Math.max(1, ...top.map((z) => z.b?.sitzungen ?? 0));

  return (
    <div className="animate-fade-in rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">{txt.titel}</p>
        <p className="text-[0.7rem] text-[var(--text-faint)]">{txt.hinweis}</p>
      </div>

      {laedt ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.laedt}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KennzahlKarte
              label={txt.aktiveKunden}
              wert={`${aktiv.length} / ${kunden.length}`}
              farbe={aktiv.length > 0 ? "gruen" : "neutral"}
              icon={<Users size={18} />}
            />
            <KennzahlKarte label={txt.besuche} wert={besucheGesamt} farbe="blau" icon={<MousePointerClick size={18} />} />
            <KennzahlKarte label={txt.nochNieErfasst} wert={nieErfasst} farbe="neutral" icon={<UserX size={18} />} />
          </div>

          {top.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)]">{txt.keineDaten}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[0.65rem] uppercase tracking-wide text-[var(--text-faint)]">
                    <th className="px-2 py-1.5 text-left font-medium">{txt.kunde}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{txt.aktiveTage}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{txt.besucheSpalte}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{txt.zuletzt}</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map(({ k, b }) => (
                    <tr key={k.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-2 py-2">
                        <span className="block text-[var(--text-strong)]">{k.name ?? txt.unbenannt}</span>
                        {k.firmenname && <span className="block text-xs text-[var(--text-faint)]">{k.firmenname}</span>}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs text-[var(--text-soft)]">
                        {b?.tage_aktiv} / {zeitraum}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className="font-mono text-[var(--text-strong)]">{b?.sitzungen}</span>
                        <div className="ml-auto mt-1 h-1 w-24 rounded-full bg-[var(--bg-muted)]">
                          <div
                            className="h-1 rounded-full"
                            style={{ width: `${Math.round(((b?.sitzungen ?? 0) / maxSitzungen) * 100)}%`, background: "var(--akzent)" }}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs text-[var(--text-faint)]">
                        {zuletztText(b?.letzter_besuch ?? null, sprache)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {inaktiv.length > 0 && (
            <div>
              <button
                onClick={() => setZeigeInaktive((v) => !v)}
                className="text-xs font-medium text-[var(--text-soft)] hover:text-[var(--text-strong)]"
              >
                {txt.inaktivTemplate.replace("{n}", String(inaktiv.length))} ·{" "}
                {zeigeInaktive ? txt.verbergen : txt.zeigen}
              </button>
              {zeigeInaktive && (
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {inaktiv.map(({ k, b }) => (
                    <div key={k.id} className="flex items-center justify-between gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5 text-sm">
                      <span className="truncate text-[var(--text-strong)]">
                        {k.name ?? txt.unbenannt}
                        {k.firmenname && <span className="text-[var(--text-faint)]"> ({k.firmenname})</span>}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-[var(--text-faint)]">
                        {zuletztText(b?.letzter_besuch ?? null, sprache)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[0.7rem] text-[var(--text-faint)]">{txt.erfassungsHinweis}</p>
        </div>
      )}
    </div>
  );
}
