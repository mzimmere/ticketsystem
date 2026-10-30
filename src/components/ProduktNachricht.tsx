import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import { benachrichtigeKunde } from "../lib/benachrichtigungen";
import { sichererDateiname } from "../lib/dateiname";
import { htmlBereinigen, htmlZuText, htmlMaskieren } from "../lib/htmlBereinigen";

interface Empfaenger {
  id: string;
  name: string | null;
}

interface NachrichtVorlage {
  id: string;
  name: string;
  betreff: string;
  text: string;
  ist_html: boolean;
}

// Die Mail laeuft als JSON ueber die Vercel-Function (Limit ca. 4,5 MB) -
// Anhaenge werden base64-kodiert und damit ca. ein Drittel groesser.
const ANHANG_LIMIT_BYTES = 3 * 1024 * 1024;

function fuellePlatzhalter(vorlage: string, werte: Record<string, string>): string {
  return vorlage.replace(/\{\{(\w+)\}\}/g, (_, name) => werte[name] ?? "");
}

export default function ProduktNachricht({
  organisationId,
  software,
  empfaenger,
  onVersendet,
}: {
  organisationId: string;
  software: string;
  empfaenger: Empfaenger[];
  onVersendet?: () => void;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).produktNachricht;
  const [offen, setOffen] = useState(false);
  const [vorlagen, setVorlagen] = useState<NachrichtVorlage[]>([]);
  const [vorlageId, setVorlageId] = useState("");
  const [vorlageName, setVorlageName] = useState("");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [istHtml, setIstHtml] = useState(false);
  const [dateien, setDateien] = useState<File[]>([]);
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
      .select("id, name, betreff, text, ist_html")
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
      setIstHtml(v.ist_html);
    }
  }

  async function vorlageSpeichern() {
    if (!vorlageName.trim()) { setHinweis(txt.vorlageNameErforderlich); return; }
    if (!betreff.trim() || !text.trim()) { setHinweis(txt.pflichtFehler); return; }
    const aktuelle = vorlagen.find((v) => v.id === vorlageId);
    const nutzeUpdate = !!aktuelle && aktuelle.name === vorlageName.trim();
    const felder = { name: vorlageName.trim(), betreff: betreff.trim(), text: text.trim(), ist_html: istHtml };
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

  function dateienHinzufuegen(neue: FileList | null) {
    if (!neue) return;
    const gesamt = [...dateien, ...Array.from(neue)];
    if (gesamt.reduce((sum, d) => sum + d.size, 0) > ANHANG_LIMIT_BYTES) {
      setHinweis(txt.anhangZuGross);
      return;
    }
    setHinweis(null);
    setDateien(gesamt);
  }

  const ausgewaehlt = empfaenger.filter((e) => !abgewaehlt.has(e.id));

  // Platzhalter werden im HTML maskiert eingesetzt, damit ein Kundenname
  // mit Sonderzeichen das Markup nicht verfaelscht.
  function inhaltFuer(e: Empfaenger) {
    const werte = { kunde_name: e.name ?? "", software };
    const betreffFertig = fuellePlatzhalter(betreff, werte);
    if (!istHtml) {
      const klartext = fuellePlatzhalter(text, werte);
      return { betreff: betreffFertig, klartext, html: undefined as string | undefined };
    }
    const maskiert = { kunde_name: htmlMaskieren(werte.kunde_name), software: htmlMaskieren(werte.software) };
    const html = htmlBereinigen(fuellePlatzhalter(text, maskiert));
    return { betreff: betreffFertig, klartext: htmlZuText(html), html };
  }

  async function senden() {
    if (!betreff.trim() || !text.trim()) { setHinweis(txt.pflichtFehler); return; }
    if (ausgewaehlt.length === 0) { setHinweis(txt.keineEmpfaenger); return; }
    if (!confirm(txt.sendenConfirmTemplate.replace("{n}", String(ausgewaehlt.length)))) return;
    setLaedt(true);
    setHinweis(null);
    const { data: authData } = await supabase.auth.getUser();

    const { data: nachricht, error: nachrichtFehler } = await supabase
      .from("kunden_nachrichten")
      .insert({
        organisation_id: organisationId,
        software,
        betreff: betreff.trim(),
        inhalt: text,
        ist_html: istHtml,
        anhang_namen: dateien.map((d) => d.name),
        erstellt_von: authData.user?.id ?? null,
      })
      .select("id")
      .single();
    if (nachrichtFehler || !nachricht) {
      console.error(nachrichtFehler);
      setHinweis(txt.sendenFehler);
      setLaedt(false);
      return;
    }

    let versendet = 0;
    for (const e of ausgewaehlt) {
      const inhalt = inhaltFuer(e);

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({ organisation_id: organisationId, kunde_id: e.id, titel: inhalt.betreff, quelle: "manuell" })
        .select("id")
        .single();
      if (error || !ticket) continue;

      const { data: ticketNachricht } = await supabase
        .from("ticket_nachrichten")
        .insert({
          ticket_id: ticket.id,
          autor_id: authData.user?.id,
          quelle: "portal",
          inhalt: inhalt.klartext,
        })
        .select("id")
        .single();

      // Pro Ticket eine eigene Kopie im Ordner des Tickets - passend zu den
      // Storage-Regeln des Buckets "anhaenge" (Zugriff ueber die Ticket-ID).
      const mailAnhaenge: { pfad: string; dateiname: string; dateityp: string }[] = [];
      for (const datei of dateien) {
        const pfad = `${ticket.id}/${Date.now()}-${sichererDateiname(datei.name)}`;
        const { error: uploadFehler } = await supabase.storage.from("anhaenge").upload(pfad, datei);
        if (uploadFehler) {
          console.error(uploadFehler);
          continue;
        }
        if (ticketNachricht) {
          await supabase
            .from("anhaenge")
            .insert({ nachricht_id: ticketNachricht.id, storage_path: pfad, dateityp: datei.type });
        }
        mailAnhaenge.push({ pfad, dateiname: datei.name, dateityp: datei.type || "application/octet-stream" });
      }

      await benachrichtigeKunde({
        ticketId: ticket.id,
        ereignis: "lizenz_update",
        betreff: inhalt.betreff,
        text: inhalt.klartext,
        html: inhalt.html,
        anhaenge: mailAnhaenge,
        vorlageKey: "produkt_nachricht",
      });

      await supabase.from("kunden_nachricht_empfaenger").insert({
        nachricht_id: nachricht.id,
        organisation_id: organisationId,
        kunde_id: e.id,
        ticket_id: ticket.id,
      });
      versendet++;
    }
    setLaedt(false);
    setHinweis(txt.ergebnisTemplate.replace("{n}", String(versendet)));
    setDateien([]);
    onVersendet?.();
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
  const beispiel = empfaenger[0] ? inhaltFuer(empfaenger[0]) : null;

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
            {v.ist_html ? " (HTML)" : ""}
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

      <label className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
        <input type="checkbox" checked={istHtml} onChange={(e) => setIstHtml(e.target.checked)} />
        {txt.alsHtml}
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={istHtml ? 9 : 5}
        placeholder={istHtml ? txt.htmlPlatzhalter : txt.textPlatzhalter}
        className={`${feldKlasse} ${istHtml ? "font-mono text-xs" : ""}`}
      />
      <p className="text-xs text-[var(--text-faint)]">{istHtml ? txt.htmlHinweis : txt.platzhalterHinweis}</p>

      {istHtml && beispiel?.html && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--text-soft)]">{txt.vorschau}</p>
          <iframe
            title={txt.vorschau}
            sandbox=""
            srcDoc={beispiel.html}
            className="h-48 w-full rounded border border-[var(--border-input)] bg-white"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="inline-block cursor-pointer rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-surface)]">
          {txt.dateiAnhaengen}
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              dateienHinzufuegen(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {dateien.map((d, i) => (
          <div key={`${d.name}-${i}`} className="flex items-center gap-2 text-xs text-[var(--text-strong)]">
            <span className="truncate">{d.name}</span>
            <span className="text-[var(--text-faint)]">({Math.max(1, Math.round(d.size / 1024))} KB)</span>
            <button
              onClick={() => setDateien((liste) => liste.filter((_, idx) => idx !== i))}
              className="text-[var(--text-faint)] hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
        <p className="text-xs text-[var(--text-faint)]">{txt.anhangHinweis}</p>
      </div>

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
