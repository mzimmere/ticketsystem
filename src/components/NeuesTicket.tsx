import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import DateiAuswahl from "./DateiAuswahl";
import { useUngespeichertWarnung } from "../lib/useUngespeichertWarnung";

type Prioritaet = "niedrig" | "mittel" | "hoch" | "kritisch";

interface Vorlage {
  id: string;
  titel: string;
  beschreibung: string;
  prioritaet: Prioritaet;
}

interface NeuesTicketProps {
  onErstellt?: (ticketId: string) => void;
}

export default function NeuesTicket({ onErstellt }: NeuesTicketProps) {
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [prioritaet, setPrioritaet] = useState<Prioritaet>("mittel");
  const [dateien, setDateien] = useState<File[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([]);
  useUngespeichertWarnung(titel.trim().length > 0 || beschreibung.trim().length > 0 || dateien.length > 0);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      const { data: profil } = await supabase
        .from("profiles").select("organisation_id").eq("id", userId).single();
      if (!profil?.organisation_id) return;
      const { data: vDaten } = await supabase
        .from("vorlagen").select("id, titel, beschreibung, prioritaet")
        .eq("organisation_id", profil.organisation_id).order("titel");
      setVorlagen((vDaten as Vorlage[]) ?? []);
    });
  }, []);

  async function absenden() {
    if (!titel.trim()) {
      setFehler("Bitte einen Titel angeben.");
      return;
    }
    setFehler(null);
    setLaedt(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error("Nicht eingeloggt");

      const { data: profil, error: profilFehler } = await supabase
        .from("profiles")
        .select("id, organisation_id")
        .eq("id", userId)
        .single();
      if (profilFehler || !profil) throw profilFehler ?? new Error("Profil nicht gefunden");

      const { data: ticket, error: ticketFehler } = await supabase
        .from("tickets")
        .insert({
          organisation_id: profil.organisation_id,
          kunde_id: profil.id,
          titel: titel.trim(),
          prioritaet,
          quelle: "portal",
        })
        .select("id")
        .single();
      if (ticketFehler || !ticket) throw ticketFehler;

      const { data: nachricht, error: nachrichtFehler } = await supabase
        .from("ticket_nachrichten")
        .insert({
          ticket_id: ticket.id,
          autor_id: profil.id,
          quelle: "portal",
          inhalt: beschreibung.trim(),
        })
        .select("id")
        .single();
      if (nachrichtFehler || !nachricht) throw nachrichtFehler;

      for (const datei of dateien) {
        const pfad = `${ticket.id}/${Date.now()}-${sichererDateiname(datei.name)}`;
        const { error: uploadFehler } = await supabase.storage
          .from("anhaenge")
          .upload(pfad, datei);
        if (uploadFehler) throw uploadFehler;

        await supabase.from("anhaenge").insert({
          nachricht_id: nachricht.id,
          storage_path: pfad,
          dateityp: datei.type,
        });
      }

      setTitel("");
      setBeschreibung("");
      setPrioritaet("mittel");
      setDateien([]);
      onErstellt?.(ticket.id);
    } catch (err) {
      console.error(err);
      setFehler("Da ist etwas schiefgelaufen. Bitte nochmal versuchen.");
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-4">
      <h2 className="text-base font-semibold text-[var(--text-strong)]">Neue Anfrage</h2>

      {vorlagen.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
            Vorlage verwenden (optional)
          </label>
          <select
            onChange={(e) => {
              const v = vorlagen.find((v) => v.id === e.target.value);
              if (v) {
                setTitel(v.titel);
                setBeschreibung(v.beschreibung);
                setPrioritaet(v.prioritaet);
              }
              e.target.value = "";
            }}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-soft)]"
          >
            <option value="">📋 Vorlage auswählen…</option>
            {vorlagen.map((v) => (
              <option key={v.id} value={v.id}>{v.titel}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-faint)]">Füllt das Formular vor – bleibt danach bearbeitbar.</p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Titel</label>
        <input
          type="text"
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder='Kurz zusammengefasst, z.B. "Drucker im Büro offline"'
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Beschreibung</label>
        <textarea
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          rows={4}
          placeholder="Was genau ist das Problem?"
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Priorität</label>
        <select
          value={prioritaet}
          onChange={(e) => setPrioritaet(e.target.value as Prioritaet)}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-2 text-sm"
        >
          <option value="niedrig">Niedrig</option>
          <option value="mittel">Mittel</option>
          <option value="hoch">Hoch</option>
          <option value="kritisch">Kritisch</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
          Anhänge (Screenshots, Dokumente)
        </label>
        <DateiAuswahl dateien={dateien} onAendern={setDateien} label="Anhänge auswählen" />
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      <button
        onClick={absenden}
        disabled={laedt}
        className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {laedt ? "Wird gesendet…" : "Anfrage absenden"}
      </button>
    </div>
  );
}
