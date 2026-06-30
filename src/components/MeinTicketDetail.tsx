import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";

type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";

interface Anhang {
  id: string;
  storage_path: string;
}

interface Nachricht {
  id: string;
  quelle: string;
  inhalt: string | null;
  erstellt_am: string;
  anhaenge: Anhang[];
}

interface MeinTicketDetailProps {
  ticketId: string;
}

const STATUS_LABEL: Record<Status, string> = {
  offen: "Offen",
  in_bearbeitung: "In Bearbeitung",
  wartet_auf_kunde: "Wartet auf dich",
  geloest: "Gelöst",
  geschlossen: "Geschlossen",
};

export default function MeinTicketDetail({ ticketId }: MeinTicketDetailProps) {
  const [titel, setTitel] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [bearbeiter, setBearbeiter] = useState<{ name: string | null; avatar_url: string | null } | null>(
    null,
  );
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([]);
  const [antwort, setAntwort] = useState("");
  const [dateien, setDateien] = useState<FileList | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [sendeLaedt, setSendeLaedt] = useState(false);

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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` },
        () => ladeTicket(),
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
      .select("titel, status, zugewiesen:zugewiesen_an(name, avatar_url)")
      .eq("id", ticketId)
      .single();
    if (data) {
      setTitel(data.titel);
      setStatus(data.status as Status);
      setBearbeiter(
        data.zugewiesen as unknown as { name: string | null; avatar_url: string | null } | null,
      );
    }
  }

  async function ladeNachrichten() {
    // RLS blendet interne Notizen hier automatisch aus
    const { data } = await supabase
      .from("ticket_nachrichten")
      .select("id, quelle, inhalt, erstellt_am, anhaenge(id, storage_path)")
      .eq("ticket_id", ticketId)
      .order("erstellt_am", { ascending: true });
    setNachrichten((data as unknown as Nachricht[]) ?? []);
  }

  async function anhangOeffnen(pfad: string) {
    const { data, error } = await supabase.storage.from("anhaenge").createSignedUrl(pfad, 60);
    if (!error && data) window.open(data.signedUrl, "_blank");
  }

  async function antwortSenden() {
    if (!antwort.trim() && (!dateien || dateien.length === 0)) return;
    setSendeLaedt(true);
    const { data: authData } = await supabase.auth.getUser();

    const { data: nachricht, error } = await supabase
      .from("ticket_nachrichten")
      .insert({
        ticket_id: ticketId,
        autor_id: authData.user?.id,
        quelle: "portal",
        inhalt: antwort.trim() || null,
      })
      .select("id")
      .single();

    if (error || !nachricht) {
      setSendeLaedt(false);
      return;
    }

    if (dateien) {
      for (const datei of Array.from(dateien)) {
        const pfad = `${ticketId}/${Date.now()}-${sichererDateiname(datei.name)}`;
        const { error: uploadFehler } = await supabase.storage
          .from("anhaenge")
          .upload(pfad, datei);
        if (!uploadFehler) {
          await supabase.from("anhaenge").insert({
            nachricht_id: nachricht.id,
            storage_path: pfad,
            dateityp: datei.type,
          });
        }
      }
    }

    setAntwort("");
    setDateien(null);
    setSendeLaedt(false);
  }

  async function ticketSchliessen() {
    setLaedt(true);
    const { error } = await supabase
      .from("tickets")
      .update({ status: "geschlossen" })
      .eq("id", ticketId);
    setLaedt(false);
    if (!error) setStatus("geschlossen");
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--text-strong)]">{titel}</h2>
          {status && (
            <span className="shrink-0 rounded bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-soft)]">
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>
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
            {n.anhaenge && n.anhaenge.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {n.anhaenge.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => anhangOeffnen(a.storage_path)}
                    className="rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                  >
                    📎 {a.storage_path.split("-").slice(1).join("-") || "Anhang"}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={antwort}
          onChange={(e) => setAntwort(e.target.value)}
          rows={3}
          placeholder="Antworten…"
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-2 text-sm"
        />
        <input
          type="file"
          multiple
          onChange={(e) => setDateien(e.target.files)}
          className="w-full text-xs text-[var(--text-soft)]"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={antwortSenden}
            disabled={sendeLaedt}
            className="rounded bg-akzent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {sendeLaedt ? "Wird gesendet…" : "Senden"}
          </button>
          {status && status !== "geschlossen" && (
            <button
              onClick={ticketSchliessen}
              disabled={laedt}
              className="text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)] disabled:opacity-50"
            >
              Für mich erledigt – Ticket schließen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
