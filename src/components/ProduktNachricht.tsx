import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import { benachrichtigeKunde } from "../lib/benachrichtigungen";

interface Empfaenger {
  id: string;
  name: string | null;
}

interface NachrichtVorlage {
  id: string;
  name: string;
  betreff: string;
  text: string;
}

function fuellePlatzhalter(vorlage: string, werte: Record<string, string>): string {
  return vorlage.replace(/\{\{(\w+)\}\}/g, (_, name) => werte[name] ?? "");
}

export default function ProduktNachricht({
  organisationId,
  software,
  empfaenger,
}: {
  organisationId: string;
  software: string;
  empfaenger: Empfaenger[];
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).produktNachricht;
  const [offen, setOffen] = useState(false);
  const [vorlagen, setVorlagen] = useState<NachrichtVorlage[]>([]);
  const [vorlageId, setVorlageId] = useState("");
  const [vorlageName, setVorlageName] = useState("");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [abgewaehlt, setAbgewaehlt] = useState<Set<string>>(new Set());
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    ladeVorlagen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  async function ladeVorlagen() {
    const { data, error } = await supabase
      .from("kunden_nachricht_vorlagen")
      .select("id, name, betreff, text")
      .eq("organisation_id", organisationId)
      .order("name");
    if (error) {
      console.error(error);
      setHinweis(txt.vorlagenLadenFehler);
      return;
    }
    setVorlagen((data as NachrichtVorlage[]) ?? []);
  }

  function vorlageWaehlen(id: string) {
    setVorlageId(id);
    const v = vorlagen.find((v) => v.id === id);
    setVorlageName(v?.name ?? "");
    if (v) {
      setBetreff(v.betreff);
      setText(v.text);
    }
  }

  async function vorlageSpeichern() {
    if (!vorlageName.trim()) { setHinweis(txt.vorlageNameErforderlich); return; }
    if (!betreff.trim() || !text.trim()) { setHinweis(txt.pflichtFehler); return; }
    const aktuelle = vorlagen.find((v) => v.id === vorlageId);
    const nutzeUpdate = !!aktuelle && aktuelle.name === vorlageName.trim();
    const felder = { name: vorlageName.trim(), betreff: betreff.trim(), text: text.trim() };
    const { data, error } = nutzeUpdate
      ? await supabase.from("kunden_nachricht_vorlagen").update(felder).eq("id", vorlageId).select("id").single()
      : await supabase
          .from("kunden_nachricht_vorlagen")
          .insert({ organisation_id: organisationId, ...felder })
          .select("id")
          .single();
    if (error || !data) {
      console.error(error);
      setHinweis(txt.vorlageFehler);
      return;
    }
    setHinweis(null);
    await ladeVorlagen();
    setVorlageId(data.id);
  }

  async function vorlageLoeschen() {
    if (!vorlageId || !confirm(txt.vorlageLoeschenConfirm)) return;
    await supabase.from("kunden_nachricht_vorlagen").delete().eq("id", vorlageId);
    setVorlageId("");
    setVorlageName("");
    ladeVorlagen();
  }

  function empfaengerUmschalten(id: string) {
    setAbgewaehlt((a) => {
      const kopie = new Set(a);
      if (kopie.has(id)) kopie.delete(id);
      else kopie.add(id);
      return kopie;
    });
  }

  const ausgewaehlt = empfaenger.filter((e) => !abgewaehlt.has(e.id));

  async function senden() {
    if (!betreff.trim() || !text.trim()) { setHinweis(txt.pflichtFehler); return; }
    if (ausgewaehlt.length === 0) { setHinweis(txt.keineEmpfaenger); return; }
    if (!confirm(txt.sendenConfirmTemplate.replace("{n}", String(ausgewaehlt.length)))) return;
    setLaedt(true);
    setHinweis(null);
    const { data: authData } = await supabase.auth.getUser();
    let versendet = 0;
    for (const e of ausgewaehlt) {
      const werte = { kunde_name: e.name ?? "", software };
      const ticketBetreff = fuellePlatzhalter(betreff, werte);
      const ticketText = fuellePlatzhalter(text, werte);

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({ organisation_id: organisationId, kunde_id: e.id, titel: ticketBetreff, quelle: "manuell" })
        .select("id")
        .single();
      if (error || !ticket) continue;

      await supabase.from("ticket_nachrichten").insert({
        ticket_id: ticket.id,
        autor_id: authData.user?.id,
        quelle: "portal",
        inhalt: ticketText,
      });
      await benachrichtigeKunde({ ticketId: ticket.id, ereignis: "lizenz_update", betreff: ticketBetreff, text: ticketText });
      versendet++;
    }
    setLaedt(false);
    setHinweis(txt.ergebnisTemplate.replace("{n}", String(versendet)));
  }

  if (!offen) {
    return (
      <button
        onClick={() => setOffen(true)}
        className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white"
      >
        {txt.oeffnenButtonTemplate.replace("{n}", String(empfaenger.length)).replace("{software}", software)}
      </button>
    );
  }

  const feldKlasse =
    "w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-strong)]";

  return (
    <div className="space-y-2 rounded border border-[var(--border)] bg-[var(--bg-muted)] p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[var(--text-strong)]">
          {txt.titelTemplate.replace("{n}", String(empfaenger.length)).replace("{software}", software)}
        </h4>
        <button onClick={() => setOffen(false)} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-strong)]">
          {txt.schliessen}
        </button>
      </div>

      <select value={vorlageId} onChange={(e) => vorlageWaehlen(e.target.value)} className={feldKlasse}>
        <option value="">{txt.keineVorlage}</option>
        {vorlagen.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={betreff}
        onChange={(e) => setBetreff(e.target.value)}
        placeholder={txt.betreffPlatzhalter}
        className={feldKlasse}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={txt.textPlatzhalter}
        className={feldKlasse}
      />
      <p className="text-xs text-[var(--text-faint)]">{txt.platzhalterHinweis}</p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={vorlageName}
          onChange={(e) => setVorlageName(e.target.value)}
          placeholder={txt.vorlageNamePlatzhalter}
          className="min-w-[10rem] flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
        />
        <button
          onClick={vorlageSpeichern}
          className="shrink-0 rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-surface)]"
        >
          {txt.vorlageSpeichern}
        </button>
        {vorlageId && (
          <button
            onClick={vorlageLoeschen}
            className="shrink-0 rounded border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/10"
          >
            {txt.vorlageLoeschen}
          </button>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--text-soft)]">
          {txt.empfaengerLabelTemplate
            .replace("{n}", String(ausgewaehlt.length))
            .replace("{gesamt}", String(empfaenger.length))}
        </p>
        <div className="max-h-40 space-y-0.5 overflow-y-auto rounded bg-[var(--bg-surface)] p-2">
          {empfaenger.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-xs text-[var(--text-strong)]">
              <input type="checkbox" checked={!abgewaehlt.has(e.id)} onChange={() => empfaengerUmschalten(e.id)} />
              {e.name ?? txt.unbenannt}
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={senden}
        disabled={laedt}
        className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {laedt ? txt.sendenLaedt : txt.senden}
      </button>
      {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
    </div>
  );
}
