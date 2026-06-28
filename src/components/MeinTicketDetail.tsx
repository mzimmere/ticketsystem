import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Avatar from "./Avatar";

interface Nachricht {
  id: string;
  quelle: string;
  inhalt: string | null;
  erstellt_am: string;
}

interface MeinTicketDetailProps {
  ticketId: string;
}

export default function MeinTicketDetail({ ticketId }: MeinTicketDetailProps) {
  const [titel, setTitel] = useState("");
  const [bearbeiter, setBearbeiter] = useState<{ name: string | null; avatar_url: string | null } | null>(
    null,
  );
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([]);
  const [antwort, setAntwort] = useState("");

  useEffect(() => {
    ladeTicket();
    ladeNachrichten();

    const channel = supabase
      .channel(`mein-ticket-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_nachrichten",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => ladeNachrichten(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function ladeTicket() {
    const { data } = await supabase
      .from("tickets")
      .select("titel, zugewiesen:zugewiesen_an(name, avatar_url)")
      .eq("id", ticketId)
      .single();
    if (data) {
      setTitel(data.titel);
      setBearbeiter(
        data.zugewiesen as unknown as { name: string | null; avatar_url: string | null } | null,
      );
    }
  }

  async function ladeNachrichten() {
    // RLS blendet interne Notizen hier automatisch aus
    const { data } = await supabase
      .from("ticket_nachrichten")
      .select("id, quelle, inhalt, erstellt_am")
      .eq("ticket_id", ticketId)
      .order("erstellt_am", { ascending: true });
    setNachrichten((data as Nachricht[]) ?? []);
  }

  async function antwortSenden() {
    if (!antwort.trim()) return;
    const { data: authData } = await supabase.auth.getUser();
    await supabase.from("ticket_nachrichten").insert({
      ticket_id: ticketId,
      autor_id: authData.user?.id,
      quelle: "portal",
      inhalt: antwort.trim(),
    });
    setAntwort("");
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-strong)]">{titel}</h2>
        {bearbeiter?.name && (
          <div className="mt-1 flex items-center gap-2">
            <Avatar name={bearbeiter.name} avatarUrl={bearbeiter.avatar_url} groesse="sm" />
            <p className="text-xs text-[var(--text-soft)]">Bearbeitet von {bearbeiter.name}</p>
          </div>
        )}
      </div>

      <div className="max-h-96 space-y-3 overflow-y-auto">
        {nachrichten.map((n) => (
          <div key={n.id} className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] p-3 text-sm">
            <p className="text-[var(--text-strong)]">{n.inhalt}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={antwort}
          onChange={(e) => setAntwort(e.target.value)}
          rows={3}
          placeholder="Antworten…"
          className="w-full rounded border border-[var(--border-input)] px-3 py-2 text-sm"
        />
        <button
          onClick={antwortSenden}
          className="rounded bg-amber-500 px-4 py-1.5 text-sm font-medium text-white"
        >
          Senden
        </button>
      </div>
    </div>
  );
}
