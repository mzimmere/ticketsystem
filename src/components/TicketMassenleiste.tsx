import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import { benachrichtigeKunde, benachrichtigeMitarbeiter } from "../lib/benachrichtigungen";

type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";

export interface MassenTicket {
  id: string;
  status: Status;
}

interface Mitarbeiter {
  id: string;
  name: string | null;
}

const KEINE_AENDERUNG = "__keine__";
const BLOCK = 100;

// Leiste fuer die Massenbearbeitung in der Ticketliste: Status setzen und/oder
// Mitarbeiter zuweisen fuer alle ausgewaehlten Tickets auf einmal. Standardmaessig
// gehen dabei KEINE Mails raus (bei 30+ Tickets sonst 30+ Mails an Kunden bzw.
// Mitarbeiter); wer das moechte, schaltet es bewusst ein.
export default function TicketMassenleiste({
  tickets,
  organisationId,
  technikerId,
  onFertig,
  onAufheben,
}: {
  tickets: MassenTicket[];
  organisationId: string;
  technikerId: string;
  onFertig: (anzahl: number) => void;
  onAufheben: () => void;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).ticketMassen;
  const statusTxt = texte(sprache).status;
  const [team, setTeam] = useState<Mitarbeiter[]>([]);
  const [statusWahl, setStatusWahl] = useState<string>(KEINE_AENDERUNG);
  const [zuweisungWahl, setZuweisungWahl] = useState<string>(KEINE_AENDERUNG);
  const [benachrichtigen, setBenachrichtigen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);

  useEffect(() => {
    supabase
      .rpc("get_team_mit_email", { p_organisation_id: organisationId })
      .eq("deaktiviert", false)
      .then(({ data }) => setTeam(((data as Mitarbeiter[]) ?? []).filter((m) => m.id)));
  }, [organisationId]);

  const hatAenderung = statusWahl !== KEINE_AENDERUNG || zuweisungWahl !== KEINE_AENDERUNG;

  async function anwenden() {
    if (!hatAenderung || tickets.length === 0) return;
    const zuweisungName =
      zuweisungWahl === "" ? txt.ohneZuweisung : (team.find((m) => m.id === zuweisungWahl)?.name ?? "?");
    const zeilen = [
      statusWahl !== KEINE_AENDERUNG ? txt.statusZeileTemplate.replace("{status}", statusTxt[statusWahl as Status]) : null,
      zuweisungWahl === ""
        ? txt.zuweisungEntferntZeile
        : zuweisungWahl !== KEINE_AENDERUNG
          ? txt.zuweisungZeileTemplate.replace("{name}", zuweisungName)
          : null,
    ].filter(Boolean);
    const ok = confirm(
      txt.bestaetigungTemplate
        .replace("{n}", String(tickets.length))
        .replace("{aenderungen}", zeilen.join("\n"))
        .replace("{benachrichtigung}", benachrichtigen ? txt.benachrichtigungAn : txt.benachrichtigungAus),
    );
    if (!ok) return;

    setLaeuft(true);
    setMeldung(null);
    try {
      const aenderung: Record<string, string | null> = {};
      if (statusWahl !== KEINE_AENDERUNG) aenderung.status = statusWahl;
      if (zuweisungWahl !== KEINE_AENDERUNG) aenderung.zugewiesen_an = zuweisungWahl || null;

      const geaendert = new Set<string>();
      for (let i = 0; i < tickets.length; i += BLOCK) {
        const ids = tickets.slice(i, i + BLOCK).map((t) => t.id);
        const { data, error } = await supabase.from("tickets").update(aenderung).in("id", ids).select("id");
        if (error) throw error;
        (data ?? []).forEach((r: { id: string }) => geaendert.add(r.id));
      }

      // Verlauf wie bei der Einzelaenderung: "Alt -> Neu" im Ticket vermerken
      const neuerStatus = statusWahl !== KEINE_AENDERUNG ? (statusWahl as Status) : null;
      const statusGewechselt = neuerStatus
        ? tickets.filter((t) => geaendert.has(t.id) && t.status !== neuerStatus)
        : [];
      if (neuerStatus && statusGewechselt.length > 0) {
        await supabase.from("ticket_nachrichten").insert(
          statusGewechselt.map((t) => ({
            ticket_id: t.id,
            autor_id: technikerId,
            quelle: "status_aenderung",
            inhalt: `${statusTxt[t.status]} → ${statusTxt[neuerStatus]}`,
          })),
        );
      }

      if (benachrichtigen) {
        const jobs: (() => Promise<void>)[] = [];
        if (neuerStatus) {
          for (const t of statusGewechselt) {
            jobs.push(async () => {
              await benachrichtigeKunde({ ticketId: t.id, ereignis: "status_geaendert", neuerStatus });
              await benachrichtigeMitarbeiter({ ticketId: t.id, ereignis: "status_geaendert", neuerStatus });
            });
          }
        }
        if (zuweisungWahl) {
          for (const t of tickets.filter((x) => geaendert.has(x.id))) {
            jobs.push(() => benachrichtigeMitarbeiter({ ticketId: t.id, ereignis: "zugewiesen" }));
          }
        }
        for (let i = 0; i < jobs.length; i += 5) await Promise.all(jobs.slice(i, i + 5).map((j) => j()));
      }

      setStatusWahl(KEINE_AENDERUNG);
      setZuweisungWahl(KEINE_AENDERUNG);
      // Die Leiste verschwindet danach - die Erfolgsmeldung zeigt die Liste selbst.
      onFertig(geaendert.size);
    } catch (err) {
      console.error("[Massenbearbeitung]", err);
      setMeldung({ text: txt.fehler, fehler: true });
    } finally {
      setLaeuft(false);
    }
  }

  const auswahlKlasse =
    "rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-strong)]";

  return (
    <div className="sticky top-2 z-20 space-y-2 rounded-xl border border-akzent bg-[var(--bg-surface)] p-3 shadow-lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--text-strong)]">
          {txt.ausgewaehltTemplate.replace("{n}", String(tickets.length))}
        </span>
        <select value={statusWahl} onChange={(e) => setStatusWahl(e.target.value)} disabled={laeuft} className={auswahlKlasse}>
          <option value={KEINE_AENDERUNG}>{txt.statusAendern}</option>
          {(Object.keys(statusTxt) as Status[]).map((s) => (
            <option key={s} value={s}>
              {statusTxt[s]}
            </option>
          ))}
        </select>
        <select value={zuweisungWahl} onChange={(e) => setZuweisungWahl(e.target.value)} disabled={laeuft} className={auswahlKlasse}>
          <option value={KEINE_AENDERUNG}>{txt.zuweisen}</option>
          <option value="">{txt.zuweisungEntfernen}</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? "?"}
            </option>
          ))}
        </select>
        <button
          onClick={anwenden}
          disabled={laeuft || !hatAenderung}
          className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {laeuft ? txt.speichert : txt.anwendenTemplate.replace("{n}", String(tickets.length))}
        </button>
        <button
          onClick={onAufheben}
          disabled={laeuft}
          className="ml-auto text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)] disabled:opacity-50"
        >
          {txt.auswahlAufheben}
        </button>
      </div>
      <label className="flex items-start gap-2 text-xs text-[var(--text-soft)]">
        <input type="checkbox" checked={benachrichtigen} onChange={(e) => setBenachrichtigen(e.target.checked)} disabled={laeuft} className="mt-0.5" />
        <span>
          {txt.benachrichtigen}
          {!benachrichtigen && <span className="block text-[0.7rem] text-[var(--text-faint)]">{txt.benachrichtigenHinweis}</span>}
        </span>
      </label>
      {meldung && (
        <p className={`text-xs ${meldung.fehler ? "text-red-600" : "text-[var(--status-geloest-text)]"}`}>{meldung.text}</p>
      )}
    </div>
  );
}
