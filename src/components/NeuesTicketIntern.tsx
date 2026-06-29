import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Prioritaet = "niedrig" | "mittel" | "hoch" | "kritisch";

interface Kunde {
  id: string;
  name: string | null;
}

interface NeuesTicketInternProps {
  organisationId: string;
  technikerId: string;
  onErstellt: (ticketId: string) => void;
  onAbbrechen: () => void;
}

export default function NeuesTicketIntern({
  organisationId,
  technikerId,
  onErstellt,
  onAbbrechen,
}: NeuesTicketInternProps) {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [prioritaet, setPrioritaet] = useState<Prioritaet>("mittel");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .order("name")
      .then(({ data }) => setKunden((data as Kunde[]) ?? []));
  }, [organisationId]);

  async function absenden() {
    if (!kundeId || !titel.trim()) {
      setFehler("Bitte Kunde und Titel angeben.");
      return;
    }
    setFehler(null);
    setLaedt(true);
    try {
      const { data: ticket, error: ticketFehler } = await supabase
        .from("tickets")
        .insert({
          organisation_id: organisationId,
          kunde_id: kundeId,
          titel: titel.trim(),
          prioritaet,
          quelle: "manuell",
          zugewiesen_an: technikerId,
        })
        .select("id")
        .single();
      if (ticketFehler || !ticket) throw ticketFehler;

      if (beschreibung.trim()) {
        const { error: nachrichtFehler } = await supabase.from("ticket_nachrichten").insert({
          ticket_id: ticket.id,
          autor_id: technikerId,
          quelle: "portal",
          inhalt: beschreibung.trim(),
        });
        if (nachrichtFehler) throw nachrichtFehler;
      }

      onErstellt(ticket.id);
    } catch (err) {
      console.error(err);
      setFehler("Anlegen fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">Neues Ticket anlegen</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Kunde</label>
        <select
          value={kundeId}
          onChange={(e) => setKundeId(e.target.value)}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        >
          <option value="">Kunde wählen…</option>
          {kunden.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name ?? "Unbenannt"}
            </option>
          ))}
        </select>
        {kunden.length === 0 && (
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            Noch keine Kunden vorhanden – erst unter Verwaltung → Kunden anlegen.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Titel</label>
        <input
          type="text"
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder='z.B. "Drucker im Büro offline"'
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
          Beschreibung
        </label>
        <textarea
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          rows={3}
          placeholder="z.B. was am Telefon berichtet wurde"
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Priorität</label>
        <select
          value={prioritaet}
          onChange={(e) => setPrioritaet(e.target.value as Prioritaet)}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        >
          <option value="niedrig">Niedrig</option>
          <option value="mittel">Mittel</option>
          <option value="hoch">Hoch</option>
          <option value="kritisch">Kritisch</option>
        </select>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      <div className="flex gap-2">
        <button
          onClick={absenden}
          disabled={laedt}
          className="flex-1 rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {laedt ? "Wird angelegt…" : "Ticket anlegen"}
        </button>
        <button
          onClick={onAbbrechen}
          className="rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)]"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
