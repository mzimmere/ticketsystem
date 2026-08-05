import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface Ticket {
  id: string;
  ticket_nr: number;
  titel: string;
  status: string;
}

interface TicketMergeProps {
  ticketId: string;
  ticketNr: number;
  organisationId: string;
  onMerged: () => void;
}

export default function TicketMerge({ ticketId, ticketNr, organisationId, onMerged }: TicketMergeProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).ticketMerge;
  const [zeigeDialog, setZeigeDialog] = useState(false);
  const [offeneTickets, setOffeneTickets] = useState<Ticket[]>([]);
  const [zielId, setZielId] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    if (!zeigeDialog) return;
    supabase.from("tickets")
      .select("id, ticket_nr, titel, status")
      .eq("organisation_id", organisationId)
      .neq("id", ticketId)
      .in("status", ["offen", "in_bearbeitung", "wartet_auf_kunde"])
      .order("ticket_nr", { ascending: false })
      .limit(50)
      .then(({ data }) => setOffeneTickets(data ?? []));
  }, [zeigeDialog, ticketId, organisationId]);

  async function zusammenfuehren() {
    if (!zielId) { setHinweis(txt.zielTicketWaehlenFehler); return; }
    setLaedt(true);
    // Quell-Ticket als zusammengeführt markieren und schließen
    const { error } = await supabase.from("tickets").update({
      status: "geschlossen",
      merged_into: zielId,
      merged_am: new Date().toISOString(),
    }).eq("id", ticketId);

    if (error) { setHinweis(txt.fehlerZusammenfuehren); setLaedt(false); return; }

    // System-Nachricht im Quell-Ticket
    await supabase.from("ticket_nachrichten").insert({
      ticket_id: ticketId,
      quelle: "intern",
      inhalt: `Dieses Ticket wurde mit #${offeneTickets.find(t => t.id === zielId)?.ticket_nr} zusammengeführt und geschlossen.`,
    });

    // System-Nachricht im Ziel-Ticket
    await supabase.from("ticket_nachrichten").insert({
      ticket_id: zielId,
      quelle: "intern",
      inhalt: `Ticket #${ticketNr} wurde mit diesem Ticket zusammengeführt.`,
    });

    setLaedt(false);
    setZeigeDialog(false);
    onMerged();
  }

  return (
    <>
      <button
        onClick={() => setZeigeDialog(true)}
        className="text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)]"
        title={txt.zusammenfuehrenTitle}
      >
        {txt.zusammenfuehrenButton}
      </button>

      {zeigeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">
              {txt.titelTemplate.replace("{nr}", String(ticketNr))}
            </h3>
            <p className="text-xs text-[var(--text-soft)]">
              {txt.beschreibung}
            </p>

            <select value={zielId} onChange={(e) => setZielId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2.5 text-sm text-[var(--text-strong)]">
              <option value="">{txt.zielTicketWaehlen}</option>
              {offeneTickets.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.ticket_nr} – {t.titel}
                </option>
              ))}
            </select>

            {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}

            <div className="flex gap-2">
              <button onClick={zusammenfuehren} disabled={laedt}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {laedt ? txt.fuehreZusammen : txt.zusammenfuehren}
              </button>
              <button onClick={() => setZeigeDialog(false)}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm text-[var(--text-soft)]">
                {txt.abbrechen}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
