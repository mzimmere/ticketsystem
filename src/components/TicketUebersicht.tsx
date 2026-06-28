import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Avatar from "./Avatar";

type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";
type Prioritaet = "niedrig" | "mittel" | "hoch" | "kritisch";

interface TicketZeile {
  id: string;
  titel: string;
  status: Status;
  prioritaet: Prioritaet;
  erstellt_am: string;
  kunde: { name: string | null } | null;
  zugewiesen: { name: string | null; avatar_url: string | null } | null;
}

const STATUS_LABEL: Record<Status, string> = {
  offen: "Offen",
  in_bearbeitung: "In Bearbeitung",
  wartet_auf_kunde: "Wartet auf Kunde",
  geloest: "Gelöst",
  geschlossen: "Geschlossen",
};

const PRIORITAET_FARBE: Record<Prioritaet, string> = {
  niedrig: "bg-[var(--bg-muted)] text-[var(--text-soft)]",
  mittel: "bg-[var(--badge-mittel-bg)] text-[var(--badge-mittel-text)]",
  hoch: "bg-[var(--badge-hoch-bg)] text-[var(--badge-hoch-text)]",
  kritisch: "bg-[var(--badge-kritisch-bg)] text-[var(--badge-kritisch-text)]",
};

interface TicketUebersichtProps {
  onAuswahl: (ticketId: string) => void;
}

export default function TicketUebersicht({ onAuswahl }: TicketUebersichtProps) {
  const [tickets, setTickets] = useState<TicketZeile[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | "alle">("alle");
  const [prioritaetFilter, setPrioritaetFilter] = useState<Prioritaet | "alle">("alle");
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    ladeTickets();

    const channel = supabase
      .channel("tickets-uebersicht")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        ladeTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, prioritaetFilter]);

  async function ladeTickets() {
    setLaedt(true);
    let query = supabase
      .from("tickets")
      .select(
        "id, titel, status, prioritaet, erstellt_am, kunde:kunde_id(name), zugewiesen:zugewiesen_an(name, avatar_url)",
      )
      .order("erstellt_am", { ascending: false });

    if (statusFilter !== "alle") query = query.eq("status", statusFilter);
    if (prioritaetFilter !== "alle") query = query.eq("prioritaet", prioritaetFilter);

    const { data } = await query;
    setTickets((data as unknown as TicketZeile[]) ?? []);
    setLaedt(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Status | "alle")}
          className="rounded border border-[var(--border-input)] px-3 py-1.5 text-sm"
        >
          <option value="alle">Alle Status</option>
          {Object.entries(STATUS_LABEL).map(([wert, label]) => (
            <option key={wert} value={wert}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={prioritaetFilter}
          onChange={(e) => setPrioritaetFilter(e.target.value as Prioritaet | "alle")}
          className="rounded border border-[var(--border-input)] px-3 py-1.5 text-sm"
        >
          <option value="alle">Alle Prioritäten</option>
          <option value="niedrig">Niedrig</option>
          <option value="mittel">Mittel</option>
          <option value="hoch">Hoch</option>
          <option value="kritisch">Kritisch</option>
        </select>
      </div>

      {laedt ? (
        <p className="text-sm text-[var(--text-faint)]">Lädt…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">Keine Tickets gefunden.</p>
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => onAuswahl(ticket.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg-muted)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-strong)]">{ticket.titel}</p>
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs text-[var(--text-soft)]">
                    {ticket.kunde?.name ?? "Unbekannter Kunde"}
                  </p>
                  {ticket.zugewiesen?.name && (
                    <>
                      <span className="text-xs text-[var(--text-faint)]">·</span>
                      <Avatar name={ticket.zugewiesen.name} avatarUrl={ticket.zugewiesen.avatar_url} groesse="sm" />
                      <p className="truncate text-xs text-[var(--text-soft)]">{ticket.zugewiesen.name}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITAET_FARBE[ticket.prioritaet]}`}
                >
                  {ticket.prioritaet}
                </span>
                <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-soft)]">
                  {STATUS_LABEL[ticket.status]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
