import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface Vorlage {
  id: string;
  titel: string;
  inhalt: string;
  typ: "antwort" | "ticket";
}

interface VorlagenVerwaltungProps {
  organisationId: string;
}

export default function VorlagenVerwaltung({ organisationId }: VorlagenVerwaltungProps) {
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([]);
  const [titel, setTitel] = useState("");
  const [inhalt, setInhalt] = useState("");
  const [typ, setTyp] = useState<"antwort" | "ticket">("antwort");
  const [zeigeForm, setZeigeForm] = useState(false);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  async function laden() {
    const { data } = await supabase
      .from("vorlagen")
      .select("id, titel, inhalt, typ")
      .eq("organisation_id", organisationId)
      .order("titel");
    setVorlagen((data as Vorlage[]) ?? []);
  }

  async function hinzufuegen() {
    if (!titel.trim() || !inhalt.trim()) return;
    setLaedt(true);
    const { error } = await supabase.from("vorlagen").insert({
      organisation_id: organisationId,
      titel: titel.trim(),
      inhalt: inhalt.trim(),
      typ,
    });
    setLaedt(false);
    if (!error) {
      setTitel("");
      setInhalt("");
      setZeigeForm(false);
      laden();
    }
  }

  async function loeschen(id: string) {
    await supabase.from("vorlagen").delete().eq("id", id);
    laden();
  }

  const antworten = vorlagen.filter((v) => v.typ === "antwort");
  const ticketVorlagen = vorlagen.filter((v) => v.typ === "ticket");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">
          Vorlagen &amp; Antwort-Makros
        </h3>
        <button
          onClick={() => setZeigeForm((v) => !v)}
          className="text-xs text-amber-600 hover:underline"
        >
          {zeigeForm ? "Abbrechen" : "+ Neue Vorlage"}
        </button>
      </div>

      {zeigeForm && (
        <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <select
            value={typ}
            onChange={(e) => setTyp(e.target.value as "antwort" | "ticket")}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          >
            <option value="antwort">Antwort-Makro (beim Antworten einfügbar)</option>
            <option value="ticket">Ticket-Vorlage (beim Neu-Anlegen nutzbar)</option>
          </select>
          <input
            type="text"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Kurzer Titel (z.B. 'Passwort zurückgesetzt')"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <textarea
            value={inhalt}
            onChange={(e) => setInhalt(e.target.value)}
            rows={4}
            placeholder="Text, der eingefügt wird…"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <button
            onClick={hinzufuegen}
            disabled={laedt}
            className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      )}

      {antworten.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Antwort-Makros
          </p>
          <div className="space-y-1.5">
            {antworten.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              >
                <span className="truncate text-sm text-[var(--text-strong)]">{v.titel}</span>
                <button
                  onClick={() => loeschen(v.id)}
                  className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {ticketVorlagen.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Ticket-Vorlagen
          </p>
          <div className="space-y-1.5">
            {ticketVorlagen.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              >
                <span className="truncate text-sm text-[var(--text-strong)]">{v.titel}</span>
                <button
                  onClick={() => loeschen(v.id)}
                  className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
