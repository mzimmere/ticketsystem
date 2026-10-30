import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface Empfaenger {
  id: string;
  ticket_id: string | null;
  kunde: { name: string | null; firmenname: string | null } | null;
}

interface Nachricht {
  id: string;
  software: string;
  betreff: string;
  ist_html: boolean;
  anhang_namen: string[];
  erstellt_am: string;
  empfaenger: Empfaenger[];
}

interface Sendung {
  ticket_id: string | null;
  empfaenger: string;
  gesendet_am: string;
  geoeffnet_am: string | null;
}

const ANZAHL_SICHTBAR = 10;

export default function GesendeteNachrichten({
  organisationId,
  refreshKey,
}: {
  organisationId: string;
  refreshKey: number;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).gesendeteNachrichten;
  const locale = sprache === "en" ? "en-US" : "de-DE";
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([]);
  const [sendungen, setSendungen] = useState<Map<string, Sendung>>(new Map());
  const [offenId, setOffenId] = useState<string | null>(null);
  const [alleAnzeigen, setAlleAnzeigen] = useState(false);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    lade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey]);

  async function lade() {
    const { data } = await supabase
      .from("kunden_nachrichten")
      .select(
        "id, software, betreff, ist_html, anhang_namen, erstellt_am, empfaenger:kunden_nachricht_empfaenger(id, ticket_id, kunde:kunde_id(name, firmenname))",
      )
      .eq("organisation_id", organisationId)
      .order("erstellt_am", { ascending: false })
      .limit(50);
    const liste = (data as unknown as Nachricht[]) ?? [];
    setNachrichten(liste);

    const ticketIds = liste.flatMap((n) => n.empfaenger.map((e) => e.ticket_id)).filter((id): id is string => !!id);
    const karte = new Map<string, Sendung>();
    if (ticketIds.length > 0) {
      const { data: mails } = await supabase
        .from("email_sendungen")
        .select("ticket_id, empfaenger, gesendet_am, geoeffnet_am")
        .eq("organisation_id", organisationId)
        .eq("vorlage_key", "produkt_nachricht")
        .in("ticket_id", ticketIds)
        .order("gesendet_am", { ascending: false });
      for (const m of (mails as Sendung[]) ?? []) {
        if (m.ticket_id && !karte.has(m.ticket_id)) karte.set(m.ticket_id, m);
      }
    }
    setSendungen(karte);
    setLaedt(false);
  }

  function gelesenAnzahl(n: Nachricht) {
    return n.empfaenger.filter((e) => e.ticket_id && sendungen.get(e.ticket_id)?.geoeffnet_am).length;
  }

  const sichtbar = alleAnzeigen ? nachrichten : nachrichten.slice(0, ANZAHL_SICHTBAR);

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>
      {laedt ? (
        <p className="text-xs text-[var(--text-faint)]">{txt.laedt}</p>
      ) : nachrichten.length === 0 ? (
        <p className="text-xs text-[var(--text-faint)]">{txt.keine}</p>
      ) : (
        <div className="space-y-1">
          {sichtbar.map((n) => {
            const offen = offenId === n.id;
            return (
              <div key={n.id} className="rounded bg-[var(--bg-muted)] text-sm">
                <button
                  onClick={() => setOffenId(offen ? null : n.id)}
                  className="flex w-full flex-wrap items-center gap-2 px-3 py-1.5 text-left"
                >
                  <span className="text-xs text-[var(--text-faint)]">
                    {new Date(n.erstellt_am).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[0.65rem] text-[var(--text-soft)]">
                    {n.software}
                  </span>
                  {n.ist_html && (
                    <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[0.65rem] text-[var(--text-soft)]">
                      HTML
                    </span>
                  )}
                  <span className="font-medium text-[var(--text-strong)]">{n.betreff}</span>
                  <span className="ml-auto text-xs text-[var(--text-soft)]">
                    {txt.empfaengerTemplate.replace("{n}", String(n.empfaenger.length))} ·{" "}
                    {txt.gelesenTemplate
                      .replace("{gelesen}", String(gelesenAnzahl(n)))
                      .replace("{gesamt}", String(n.empfaenger.length))}
                  </span>
                </button>
                {offen && (
                  <div className="space-y-1 border-t border-[var(--border)] px-3 py-2">
                    {n.anhang_namen.length > 0 && (
                      <p className="text-xs text-[var(--text-soft)]">
                        📎 {txt.anhaengeLabel} {n.anhang_namen.join(", ")}
                      </p>
                    )}
                    {n.empfaenger.map((e) => {
                      const mail = e.ticket_id ? sendungen.get(e.ticket_id) : undefined;
                      return (
                        <div key={e.id} className="flex flex-wrap items-center gap-x-2 text-xs">
                          <span className="text-[var(--text-strong)]">
                            {e.kunde?.name ?? txt.unbenannt}
                            {e.kunde?.firmenname && (
                              <span className="text-[var(--text-faint)]"> ({e.kunde.firmenname})</span>
                            )}
                          </span>
                          {mail ? (
                            <>
                              <span className="text-[var(--text-faint)]">
                                {txt.gesendetAn} {mail.empfaenger}
                              </span>
                              <span
                                className={
                                  mail.geoeffnet_am
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-[var(--text-faint)]"
                                }
                              >
                                {mail.geoeffnet_am
                                  ? `${txt.gelesenAm} ${new Date(mail.geoeffnet_am).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}`
                                  : txt.nochNichtGeoeffnet}
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--text-faint)]">{txt.keinVersandProtokolliert}</span>
                          )}
                        </div>
                      );
                    })}
                    <p className="pt-1 text-[0.7rem] text-[var(--text-faint)]">{txt.lesestatusHinweis}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {nachrichten.length > ANZAHL_SICHTBAR && (
        <button
          onClick={() => setAlleAnzeigen((v) => !v)}
          className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          {alleAnzeigen ? "−" : `+ ${nachrichten.length - ANZAHL_SICHTBAR}`}
        </button>
      )}
    </div>
  );
}
