import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache, type Sprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface AltesTicket {
  id: string;
  ticket_nr: number;
  titel: string;
  merged_am: string | null;
}

interface Anhang {
  id: string;
  storage_path: string;
}

interface Nachricht {
  id: string;
  quelle: string;
  inhalt: string | null;
  erstellt_am: string;
  autor: { name: string | null } | null;
  anhaenge: Anhang[];
}

function formatDatum(iso: string, sprache: Sprache): string {
  return new Date(iso).toLocaleString(sprache === "en" ? "en-US" : "de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Zeigt Tickets, die per "Zusammenführen" (TicketMerge.tsx) in dieses Ticket
// gemündet sind - mit direkt aufklappbarem Verlauf, damit man den alten
// Ticket-Kontext nicht erst umständlich im geschlossenen Alt-Ticket
// nachschlagen muss.
export default function ZusammengefuehrteTickets({ ticketId }: { ticketId: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).zusammengefuehrteTickets;
  const [alteTickets, setAlteTickets] = useState<AltesTicket[]>([]);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [nachrichtenNachTicket, setNachrichtenNachTicket] = useState<Record<string, Nachricht[]>>({});
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    supabase
      .from("tickets")
      .select("id, ticket_nr, titel, merged_am")
      .eq("merged_into", ticketId)
      .order("merged_am", { ascending: false })
      .then(({ data }) => setAlteTickets((data as AltesTicket[]) ?? []));
  }, [ticketId]);

  async function oeffnen(altesTicketId: string) {
    if (offenId === altesTicketId) {
      setOffenId(null);
      return;
    }
    setOffenId(altesTicketId);
    if (nachrichtenNachTicket[altesTicketId]) return;
    setLaedt(true);
    const { data } = await supabase
      .from("ticket_nachrichten")
      .select("id, quelle, inhalt, erstellt_am, autor:autor_id(name), anhaenge(id, storage_path)")
      .eq("ticket_id", altesTicketId)
      .order("erstellt_am", { ascending: false });
    setNachrichtenNachTicket((v) => ({ ...v, [altesTicketId]: (data as unknown as Nachricht[]) ?? [] }));
    setLaedt(false);
  }

  async function anhangOeffnen(pfad: string) {
    const { data, error } = await supabase.storage.from("anhaenge").createSignedUrl(pfad, 60);
    if (!error && data) window.open(data.signedUrl, "_blank");
  }

  if (alteTickets.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">
        🔗 {txt.titel}
      </h3>
      {alteTickets.map((t) => (
        <div key={t.id} className="rounded-md border border-[var(--border)]">
          <button
            onClick={() => oeffnen(t.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
          >
            <span className="font-medium text-[var(--text-strong)]">
              #{t.ticket_nr} – {t.titel}
            </span>
            {t.merged_am && (
              <span className="ml-auto font-mono text-[var(--text-faint)]">
                {txt.zusammengefuehrtAmPrefix} {formatDatum(t.merged_am, sprache)}
              </span>
            )}
            <span className="text-[var(--text-faint)]">{offenId === t.id ? "▲" : "▼"}</span>
          </button>

          {offenId === t.id && (
            <div className="max-h-72 space-y-2 overflow-y-auto border-t border-[var(--border)] p-3">
              {laedt && !nachrichtenNachTicket[t.id] ? (
                <p className="text-xs text-[var(--text-faint)]">{txt.laedt}</p>
              ) : nachrichtenNachTicket[t.id]?.length === 0 ? (
                <p className="text-xs text-[var(--text-faint)]">{txt.keineNachrichten}</p>
              ) : (
                nachrichtenNachTicket[t.id]?.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-md p-2.5 text-xs ${
                      n.quelle === "intern"
                        ? "border border-[var(--bubble-intern-border)] bg-[var(--bubble-intern-bg)]"
                        : n.quelle === "whatsapp"
                        ? "border border-[var(--bubble-whatsapp-border)] bg-[var(--bubble-whatsapp-bg)]"
                        : "border border-[var(--border)] bg-[var(--bg-muted)]"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[var(--text-soft)]">
                      <span>{n.autor?.name ?? txt.kunde}</span>
                      <span className="font-mono text-[var(--text-faint)]">
                        {formatDatum(n.erstellt_am, sprache)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-[var(--text-strong)]">{n.inhalt}</p>
                    {n.anhaenge && n.anhaenge.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {n.anhaenge.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => anhangOeffnen(a.storage_path)}
                            className="rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[0.65rem] text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                          >
                            📎 {a.storage_path.split("-").slice(1).join("-")}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
