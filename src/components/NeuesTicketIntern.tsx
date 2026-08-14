import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { benachrichtigeMitarbeiter } from "../lib/benachrichtigungen";
import { useUngespeichertWarnung } from "../lib/useUngespeichertWarnung";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import KundenAuswahl from "./KundenAuswahl";
import KundenTodoListe from "./KundenTodoListe";

type Prioritaet = "niedrig" | "mittel" | "hoch" | "kritisch";

interface Techniker {
  id: string;
  name: string | null;
}

interface Dongle {
  id: string;
  seriennummer: string;
  software: string;
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
  const { sprache } = useSprache();
  const txt = texte(sprache).neuesTicketIntern;
  const prioritaetLabel = texte(sprache).prioritaet;
  const [techniker, setTechniker] = useState<Techniker[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [dongles, setDongles] = useState<Dongle[]>([]);
  const [dongleId, setDongleId] = useState("");
  const [zugewiesenAn, setZugewiesenAn] = useState(technikerId);
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [prioritaet, setPrioritaet] = useState<Prioritaet>("mittel");
  const [vorlagen, setVorlagen] = useState<{ id: string; titel: string; beschreibung: string; prioritaet: Prioritaet }[]>([]);
  useUngespeichertWarnung(titel.trim().length > 0 || beschreibung.trim().length > 0);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    // get_team_mit_email statt profiles-Direktabfrage: erfasst auch
    // Mitarbeiter, die nur per firmen_mitgliedschaften (Mehrfach-
    // Mitgliedschaft) mit dieser Firma verknuepft sind, nicht ueber ihre
    // "Home"-Firma (profiles.organisation_id).
    supabase
      .rpc("get_team_mit_email", { p_organisation_id: organisationId })
      .eq("deaktiviert", false)
      .then(({ data }) => setTechniker((data as Techniker[]) ?? []));

    supabase
      .from("vorlagen")
      .select("id, titel, beschreibung, prioritaet")
      .eq("organisation_id", organisationId)
      .order("titel")
      .then(({ data }) => setVorlagen((data as typeof vorlagen) ?? []));
  }, [organisationId]);

  useEffect(() => {
    setDongleId("");
    if (!kundeId) {
      setDongles([]);
      return;
    }
    supabase
      .from("kunden_dongles")
      .select("id, seriennummer, software")
      .eq("kunde_id", kundeId)
      .order("seriennummer")
      .then(({ data }) => setDongles((data as Dongle[]) ?? []));
  }, [kundeId]);

  async function absenden() {
    if (!kundeId || !titel.trim()) {
      setFehler(txt.fehlerKundeUndTitel);
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
          zugewiesen_an: zugewiesenAn || null,
          dongle_id: dongleId || null,
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

      if (zugewiesenAn) {
        benachrichtigeMitarbeiter({ ticketId: ticket.id, ereignis: "zugewiesen" });
      }

      onErstellt(ticket.id);
    } catch (err) {
      console.error(err);
      setFehler(txt.fehlerAnlegen);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.kunde}</label>
        <KundenAuswahl organisationId={organisationId} value={kundeId} onChange={setKundeId} />
      </div>

      {kundeId && (
        <KundenTodoListe kundeId={kundeId} organisationId={organisationId} modus="kompakt" />
      )}

      {kundeId && dongles.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
            {txt.dongleLabel} <span className="font-normal text-[var(--text-faint)]">{txt.optional}</span>
          </label>
          <select
            value={dongleId}
            onChange={(e) => setDongleId(e.target.value)}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          >
            <option value="">{txt.keinDongle}</option>
            {dongles.map((d) => (
              <option key={d.id} value={d.id}>
                {d.seriennummer} ({d.software})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            {txt.dongleHinweis}
          </p>
        </div>
      )}

      {vorlagen.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
            {txt.vorlageVerwenden}
          </label>
          <select
            onChange={(e) => {
              const v = vorlagen.find((v) => v.id === e.target.value);
              if (v) {
                setTitel(v.titel);
                setBeschreibung(v.beschreibung);
                setPrioritaet(v.prioritaet as Prioritaet);
              }
              e.target.value = "";
            }}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-soft)]"
          >
            <option value="">{txt.vorlageAuswaehlen}</option>
            {vorlagen.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titel} ({prioritaetLabel[v.prioritaet]})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            {txt.vorlageHinweis}
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.titelLabel}</label>
        <input
          type="text"
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder={txt.titelPlatzhalter}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
          {txt.beschreibungLabel}
        </label>
        <textarea
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          rows={3}
          placeholder={txt.beschreibungPlatzhalter}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
          {txt.zuweisenAn}
        </label>
        <select
          value={zugewiesenAn}
          onChange={(e) => setZugewiesenAn(e.target.value)}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        >
          <option value="">{txt.nichtZugewiesen}</option>
          {techniker.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name ?? txt.unbenannt}
              {t.id === technikerId ? txt.ich : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.prioritaetLabel}</label>
        <select
          value={prioritaet}
          onChange={(e) => setPrioritaet(e.target.value as Prioritaet)}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        >
          <option value="niedrig">{prioritaetLabel.niedrig}</option>
          <option value="mittel">{prioritaetLabel.mittel}</option>
          <option value="hoch">{prioritaetLabel.hoch}</option>
          <option value="kritisch">{prioritaetLabel.kritisch}</option>
        </select>
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      <div className="flex gap-2">
        <button
          onClick={absenden}
          disabled={laedt}
          className="flex-1 rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {laedt ? txt.wirdAngelegt : txt.ticketAnlegen}
        </button>
        <button
          onClick={onAbbrechen}
          className="rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)]"
        >
          {txt.abbrechen}
        </button>
      </div>
    </div>
  );
}
