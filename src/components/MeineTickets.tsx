import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import StatusBadge from "./StatusBadge";

type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";

interface TicketZeile {
  id: string;
  titel: string;
  status: Status;
  erstellt_am: string;
}

interface MeineTicketsProps {
  onAuswahl: (ticketId: string) => void;
}

export default function MeineTickets({ onAuswahl }: MeineTicketsProps) {
  const [tickets, setTickets] = useState<TicketZeile[]>([]);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    ladeTickets();
  }, []);

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

  if (laedt) return <p className="text-sm text-[var(--text-faint)]">Lädt…</p>;

  if (tickets.length === 0) {
    return <p className="text-sm text-[var(--text-faint)]">Du hast noch keine Anfragen gestellt.</p>;
  }

  return (
    <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          onClick={() => onAuswahl(ticket.id)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg-muted)]"
        >
          <p className="truncate text-sm font-medium text-[var(--text-strong)]">{ticket.titel}</p>
          <StatusBadge
            status={ticket.status}
            labelOverride={ticket.status === "wartet_auf_kunde" ? "Wartet auf dich" : undefined}
          />
        </button>
      ))}
    </div>
  );
}
