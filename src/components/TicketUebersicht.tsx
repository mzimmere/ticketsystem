import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import Avatar from "./Avatar";
import NeuesTicketIntern from "./NeuesTicketIntern";
import StatusBadge from "./StatusBadge";
import { TicketZeileSkeleton } from "./Skeleton";
import LeerZustand from "./LeerZustand";

type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";
type Prioritaet = "niedrig" | "mittel" | "hoch" | "kritisch";

interface TicketZeile {
  id: string;
  ticket_nr: number;
  titel: string;
  status: Status;
  prioritaet: Prioritaet;
  erstellt_am: string;
  zuletzt_kunden_nachricht_am: string | null;
  zuletzt_gelesen_am: string | null;
  tags: string[];
  kunde: { id: string; name: string | null } | null;
  zugewiesen: { name: string | null; avatar_url: string | null } | null;
}

interface KundeOption {
  id: string;
  name: string | null;
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

function istUngelesen(t: TicketZeile): boolean {
  if (!t.zuletzt_kunden_nachricht_am) return false;
  if (!t.zuletzt_gelesen_am) return true;
  return new Date(t.zuletzt_kunden_nachricht_am) > new Date(t.zuletzt_gelesen_am);
}

function istUeberfaellig(t: TicketZeile, slaStunden: number | null): boolean {
  if (!slaStunden || t.status !== "offen") return false;
  const stundenAlt = (Date.now() - new Date(t.erstellt_am).getTime()) / 3600000;
  return stundenAlt > slaStunden;
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
          ? "bg-akzent text-white"
          : "bg-[var(--bg-muted)] text-[var(--text-soft)] hover:bg-[var(--border)]"
      }`}
    >
      {children}
    </button>
  );
}

interface TicketUebersichtProps {
  onAuswahl: (ticketId: string) => void;
  organisationId: string | null;
  technikerId: string;
  motto?: string | null;
  heroBildUrl?: string | null;
  slaStunden?: number | null;
  initialFilter?: "meine" | "wartend" | null;
}

export default function TicketUebersicht({
  onAuswahl,
  organisationId,
  technikerId,
  motto,
  heroBildUrl,
  slaStunden,
  initialFilter,
}: TicketUebersichtProps) {
  const [tickets, setTickets] = useState<TicketZeile[]>([]);
  const [kundenOptionen, setKundenOptionen] = useState<KundeOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | "alle" | "offene">(
    initialFilter === "wartend" ? "wartet_auf_kunde" : "offene"
  );
  const [nurMeine, setNurMeine] = useState(initialFilter === "meine");
  const [prioritaetFilter, setPrioritaetFilter] = useState<Prioritaet | "alle">("alle");
  const [kundeFilter, setKundeFilter] = useState<string>("alle");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [suchbegriff, setSuchbegriff] = useState("");
  const [nachrichtTrefferIds, setNachrichtTrefferIds] = useState<Set<string>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [zeigeNeuesTicket, setZeigeNeuesTicket] = useState(false);

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
  }, [statusFilter, prioritaetFilter, kundeFilter, organisationId, nurMeine]);

  useEffect(() => {
    if (!organisationId) return;
    supabase
      .from("profiles")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .order("name")
      .then(({ data }) => setKundenOptionen((data as KundeOption[]) ?? []));
  }, [organisationId]);

  // Volltextsuche über Nachrichteninhalte - debounced, ergänzt die
  // client-seitige Suche (Titel/Kunde/Bearbeiter/Nr.) um Treffer im
  // eigentlichen Gesprächsverlauf.
  useEffect(() => {
    const begriff = suchbegriff.trim();
    if (!begriff || !organisationId) {
      setNachrichtTrefferIds(new Set());
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.rpc("ticket_ids_mit_nachricht", {
        p_organisation_id: organisationId,
        p_begriff: begriff,
      });
      setNachrichtTrefferIds(new Set((data as string[]) ?? []));
    }, 350);
    return () => clearTimeout(timeout);
  }, [suchbegriff, organisationId]);

  async function ladeTickets() {
    if (!organisationId) {
      setTickets([]);
      setLaedt(false);
      return;
    }
    setLaedt(true);
    let query = supabase
      .from("tickets")
      .select(
        "id, ticket_nr, titel, status, prioritaet, erstellt_am, zuletzt_kunden_nachricht_am, zuletzt_gelesen_am, tags, kunde:kunde_id(id, name), zugewiesen:zugewiesen_an(name, avatar_url)",
      )
      .eq("organisation_id", organisationId)
      .order("erstellt_am", { ascending: false });

    if (statusFilter === "offene") {
      query = query.not("status", "in", '("geloest","geschlossen")');
    } else if (statusFilter !== "alle") {
      query = query.eq("status", statusFilter);
    }
    if (prioritaetFilter !== "alle") query = query.eq("prioritaet", prioritaetFilter);
    if (kundeFilter !== "alle") query = query.eq("kunde_id", kundeFilter);
    if (nurMeine) query = query.eq("zugewiesen_an", technikerId);

    const { data } = await query;
    setTickets((data as unknown as TicketZeile[]) ?? []);
    setLaedt(false);
  }

  const alleTags = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => t.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [tickets]);

  const gefilterteTickets = useMemo(() => {
    const begriff = suchbegriff.trim().toLowerCase();
    return tickets.filter((t) => {
      if (tagFilter && !t.tags?.includes(tagFilter)) return false;
      if (!begriff) return true;
      const ticketNrText = `#${t.ticket_nr}`;
      return (
        t.titel.toLowerCase().includes(begriff) ||
        t.kunde?.name?.toLowerCase().includes(begriff) ||
        t.zugewiesen?.name?.toLowerCase().includes(begriff) ||
        ticketNrText.includes(begriff) ||
        nachrichtTrefferIds.has(t.id)
      );
    });
  }, [tickets, suchbegriff, tagFilter, nachrichtTrefferIds]);

  return (
    <div className="space-y-4">
      {(heroBildUrl || motto) && (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          {heroBildUrl && (
            <img src={heroBildUrl} alt="" className="h-40 w-full object-contain sm:h-56" />
          )}
          {motto && (
            <p className="bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-soft)]">
              {motto}
            </p>
          )}
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h2
          className="text-lg font-semibold text-[var(--text-strong)]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Tickets
        </h2>
        {!laedt && (
          <span className="font-mono text-xs text-[var(--text-faint)]">
            {gefilterteTickets.length} {gefilterteTickets.length === 1 ? "Eintrag" : "Einträge"}
          </span>
        )}
      </div>

      {organisationId &&
        (zeigeNeuesTicket ? (
          <NeuesTicketIntern
            organisationId={organisationId}
            technikerId={technikerId}
            onErstellt={(id) => {
              setZeigeNeuesTicket(false);
              onAuswahl(id);
            }}
            onAbbrechen={() => setZeigeNeuesTicket(false)}
          />
        ) : (
          <button
            onClick={() => setZeigeNeuesTicket(true)}
            className="w-full rounded border border-dashed border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
          >
            + Neues Ticket anlegen
          </button>
        ))}

      {/* Suche */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
          />
        </svg>
        <input
          type="text"
          value={suchbegriff}
          onChange={(e) => setSuchbegriff(e.target.value)}
          placeholder="Suche nach Titel, Kunde, Nr., Bearbeiter oder Verlauf…"
          className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-strong)]"
        />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kundeFilter}
          onChange={(e) => setKundeFilter(e.target.value)}
          className="rounded-full border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-strong)]"
        >
          <option value="alle">Alle Kunden</option>
          {kundenOptionen.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name ?? "Unbenannt"}
            </option>
          ))}
        </select>

        <span className="h-4 w-px bg-[var(--border)]" />

        <FilterChip aktiv={nurMeine} onClick={() => setNurMeine(!nurMeine)}>
          👤 Nur meine
        </FilterChip>

        <span className="h-4 w-px bg-[var(--border)]" />

        <FilterChip aktiv={statusFilter === "offene"} onClick={() => setStatusFilter("offene")}>
          Offene
        </FilterChip>
        <FilterChip aktiv={statusFilter === "alle"} onClick={() => setStatusFilter("alle")}>
          Alle Status
        </FilterChip>
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <FilterChip key={s} aktiv={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {STATUS_LABEL[s]}
          </FilterChip>
        ))}

        <span className="h-4 w-px bg-[var(--border)]" />

        <FilterChip
          aktiv={prioritaetFilter === "alle"}
          onClick={() => setPrioritaetFilter("alle")}
        >
          Alle Prioritäten
        </FilterChip>
        {(Object.keys(PRIORITAET_LABEL) as Prioritaet[]).map((p) => (
          <FilterChip key={p} aktiv={prioritaetFilter === p} onClick={() => setPrioritaetFilter(p)}>
            {PRIORITAET_LABEL[p]}
          </FilterChip>
        ))}

        {alleTags.length > 0 && (
          <>
            <span className="h-4 w-px bg-[var(--border)]" />
            {alleTags.map((tag) => (
              <FilterChip
                key={tag}
                aktiv={tagFilter === tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              >
                #{tag}
              </FilterChip>
            ))}
          </>
        )}
      </div>

      {/* Tabelle */}
      {!organisationId ? (
        <p className="text-sm text-[var(--text-faint)]">
          Wähle zuerst über das Zahnrad-Icon → "Alle Firmen" eine Firma aus, um deren Tickets zu
          sehen.
        </p>
      ) : laedt ? (
        <div className="animate-fade-in overflow-hidden rounded-lg border border-[var(--border)]">
          {[...Array(5)].map((_, i) => <TicketZeileSkeleton key={i} />)}
        </div>
      ) : gefilterteTickets.length === 0 ? (
        <LeerZustand
          icon="🎫"
          titel={suchbegriff || tagFilter ? "Keine Treffer" : "Keine offenen Tickets"}
          beschreibung={
            suchbegriff
              ? `Kein Ticket enthält „${suchbegriff}" – weder im Titel noch im Verlauf.`
              : tagFilter
              ? `Kein Ticket ist mit dem Tag „${tagFilter}" versehen.`
              : "Alles erledigt! Neue Tickets erscheinen hier sobald Kunden eine Anfrage stellen."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <div className="hidden items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-muted)] px-4 py-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)] sm:flex">
            <span className="w-2" />
            <span className="w-10">Nr.</span>
            <span className="flex-1">Betreff &amp; Kunde</span>
            <span className="w-20 text-right">Status</span>
            <span className="w-20 text-right">Zeit</span>
          </div>

          {gefilterteTickets.map((ticket) => {
            const ungelesen = istUngelesen(ticket);
            const ueberfaellig = istUeberfaellig(ticket, slaStunden ?? null);
            return (
            <button
              key={ticket.id}
              onClick={() => onAuswahl(ticket.id)}
              className={`flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--bg-muted)] ${
                ungelesen ? "bg-amber-50/60 dark:bg-akzent/10" : "bg-[var(--bg-surface)]"
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: PRIORITAET_AKZENT[ticket.prioritaet] }}
                title={PRIORITAET_LABEL[ticket.prioritaet]}
              />
              <span className="hidden w-10 shrink-0 font-mono text-xs text-[var(--text-faint)] sm:inline">
                #{ticket.ticket_nr}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${
                    ungelesen
                      ? "font-semibold text-[var(--text-strong)]"
                      : "font-medium text-[var(--text-strong)]"
                  }`}
                >
                  <span className="mr-1.5 font-mono text-xs text-[var(--text-faint)] sm:hidden">
                    #{ticket.ticket_nr}
                  </span>
                  {ungelesen && (
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-akzent align-middle" />
                  )}
                  {ticket.titel}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <p
                    className={`truncate text-xs ${
                      ungelesen ? "text-amber-700 dark:text-amber-400" : "text-[var(--text-soft)]"
                    }`}
                  >
                    {ungelesen
                      ? "Neue Nachricht vom Kunden"
                      : ticket.kunde?.name ?? "Unbekannter Kunde"}
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
                  {ueberfaellig && (
                    <span className="rounded-full bg-[var(--status-offen-bg)] px-1.5 py-0.5 text-[0.6rem] font-medium text-[var(--status-offen-text)]">
                      Überfällig
                    </span>
                  )}
                  {ticket.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[0.6rem] text-[var(--text-soft)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={ticket.status} />
                <span className="font-mono text-[0.65rem] text-[var(--text-faint)]">
                  {formatRelativ(ticket.erstellt_am)}
                </span>
              </div>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
