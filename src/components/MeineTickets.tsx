import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import StatusBadge from "./StatusBadge";
import FaqSeite from "./FaqSeite";

type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";

interface TicketZeile {
  id: string;
  titel: string;
  status: Status;
  erstellt_am: string;
}

interface MeineTicketsProps {
  onAuswahl: (ticketId: string) => void;
  organisationId?: string | null;
}

export default function MeineTickets({ onAuswahl, organisationId }: MeineTicketsProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).meineTickets;
  const [tickets, setTickets] = useState<TicketZeile[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [suchbegriff, setSuchbegriff] = useState("");
  const [nachrichtTrefferIds, setNachrichtTrefferIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    ladeTickets();
  }, []);

  // Volltextsuche über den eigenen Nachrichtenverlauf - debounced, ergänzt
  // die client-seitige Titel-Suche um Treffer im Gesprächsverlauf.
  useEffect(() => {
    const begriff = suchbegriff.trim();
    if (!begriff) {
      setNachrichtTrefferIds(new Set());
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.rpc("meine_ticket_ids_mit_nachricht", { p_begriff: begriff });
      setNachrichtTrefferIds(new Set((data as string[]) ?? []));
    }, 350);
    return () => clearTimeout(timeout);
  }, [suchbegriff]);

  async function ladeTickets() {
    setLaedt(true);
    // RLS sorgt automatisch dafür, dass hier nur die eigenen Tickets zurückkommen
    const { data } = await supabase
      .from("tickets")
      .select("id, titel, status, erstellt_am")
      .order("erstellt_am", { ascending: false });
    setTickets((data as TicketZeile[]) ?? []);
    setLaedt(false);
  }

  const gefilterteTickets = useMemo(() => {
    const begriff = suchbegriff.trim().toLowerCase();
    if (!begriff) return tickets;
    return tickets.filter(
      (t) => t.titel.toLowerCase().includes(begriff) || nachrichtTrefferIds.has(t.id),
    );
  }, [tickets, suchbegriff, nachrichtTrefferIds]);

  if (laedt) return <p className="text-sm text-[var(--text-faint)]">{txt.laedt}</p>;

  if (tickets.length === 0) {
    return <p className="text-sm text-[var(--text-faint)]">{txt.nochKeineAnfragen}</p>;
  }

  return (
    <>
      <input
        type="text"
        value={suchbegriff}
        onChange={(e) => setSuchbegriff(e.target.value)}
        placeholder={txt.suchePlatzhalter}
        className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
      />
      {gefilterteTickets.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">{txt.keineTrefferTemplate.replace("{begriff}", suchbegriff)}</p>
      ) : (
      <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
        {gefilterteTickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => onAuswahl(ticket.id)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg-muted)]"
          >
            <p className="truncate text-sm font-medium text-[var(--text-strong)]">{ticket.titel}</p>
            <StatusBadge
              status={ticket.status}
              labelOverride={ticket.status === "wartet_auf_kunde" ? txt.wartetAufDich : undefined}
            />
          </button>
        ))}
      </div>
      )}
      {organisationId && <FaqSeite organisationId={organisationId} />}
    </>
  );
}
