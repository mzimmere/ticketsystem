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

const PRIORITAET_LABEL: Record<Prioritaet, string> = {
  niedrig: "Niedrig",
  mittel: "Mittel",
  hoch: "Hoch",
  kritisch: "Kritisch",
};

// Wiederverwendet die Badge-Textfarben aus index.css als kräftige Akzentfarbe
// für den Prioritäts-Punkt - die sind pro Theme schon auf guten Kontrast abgestimmt.
const PRIORITAET_AKZENT: Record<Prioritaet, string> = {
  niedrig: "var(--text-faint)",
  mittel: "var(--badge-mittel-text)",
  hoch: "var(--badge-hoch-text)",
  kritisch: "var(--badge-kritisch-text)",
};

function formatRelativ(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  const tage = Math.floor(std / 24);
  if (tage < 7) return `vor ${tage} Tag${tage > 1 ? "en" : ""}`;
  return new Date(iso).toLocaleDateString("de-DE");
}

function FilterChip({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        aktiv
          ? "bg-amber-500 text-white"
          : "bg-[var(--bg-muted)] text-[var(--text-soft)] hover:bg-[var(--border)]"
      }`}
    >
      {children}
    </button>
  );
}

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
      <div className="flex items-baseline justify-between">
        <h2
          className="text-lg font-semibold text-[var(--text-strong)]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Tickets
        </h2>
        {!laedt && (
          <span className="font-mono text-xs text-[var(--text-faint)]">
            {tickets.length} {tickets.length === 1 ? "Eintrag" : "Einträge"}
          </span>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Status
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip aktiv={statusFilter === "alle"} onClick={() => setStatusFilter("alle")}>
            Alle
          </FilterChip>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <FilterChip key={s} aktiv={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {STATUS_LABEL[s]}
            </FilterChip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Priorität
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            aktiv={prioritaetFilter === "alle"}
            onClick={() => setPrioritaetFilter("alle")}
          >
            Alle
          </FilterChip>
          {(Object.keys(PRIORITAET_LABEL) as Prioritaet[]).map((p) => (
            <FilterChip key={p} aktiv={prioritaetFilter === p} onClick={() => setPrioritaetFilter(p)}>
              {PRIORITAET_LABEL[p]}
            </FilterChip>
          ))}
        </div>
      </div>

      {laedt ? (
        <p className="text-sm text-[var(--text-faint)]">Lädt…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">Keine Tickets gefunden.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => onAuswahl(ticket.id)}
              className="flex w-full items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--bg-muted)]"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: PRIORITAET_AKZENT[ticket.prioritaet] }}
                title={PRIORITAET_LABEL[ticket.prioritaet]}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-strong)]">
                  {ticket.titel}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-xs text-[var(--text-soft)]">
                    {ticket.kunde?.name ?? "Unbekannter Kunde"}
                  </p>
                  {ticket.zugewiesen?.name && (
                    <>
                      <span className="text-xs text-[var(--text-faint)]">·</span>
                      <Avatar
                        name={ticket.zugewiesen.name}
                        avatarUrl={ticket.zugewiesen.avatar_url}
                        groesse="sm"
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-[0.65rem] text-[var(--text-soft)]">
                  {STATUS_LABEL[ticket.status]}
                </span>
                <span className="font-mono text-[0.65rem] text-[var(--text-faint)]">
                  {formatRelativ(ticket.erstellt_am)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
