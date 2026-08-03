import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface EmailTexteVerwaltungProps {
  organisationId: string;
}

interface Vorlage {
  betreff: string;
  text: string;
}

interface VorlagenMeta {
  key: string;
  gruppe: "kunde" | "mitarbeiter";
  platzhalter: string[];
}

const VORLAGEN_META: VorlagenMeta[] = [
  {
    key: "kunde_status_geaendert",
    gruppe: "kunde",
    platzhalter: ["kunde_name", "ticket_titel", "ticket_nr", "status", "link", "firmen_name"],
  },
  {
    key: "kunde_ticket_geschlossen",
    gruppe: "kunde",
    platzhalter: ["kunde_name", "ticket_titel", "ticket_nr", "link", "bewertung_link_ja", "bewertung_link_nein", "firmen_name"],
  },
  {
    key: "kunde_neue_antwort",
    gruppe: "kunde",
    platzhalter: ["kunde_name", "ticket_titel", "ticket_nr", "link", "firmen_name"],
  },
  {
    key: "mitarbeiter_zugewiesen",
    gruppe: "mitarbeiter",
    platzhalter: ["ticket_titel", "ticket_nr", "aenderer_name", "link"],
  },
  {
    key: "mitarbeiter_status_geaendert",
    gruppe: "mitarbeiter",
    platzhalter: ["ticket_titel", "ticket_nr", "aenderer_name", "status", "link"],
  },
  {
    key: "mitarbeiter_neue_kundenantwort",
    gruppe: "mitarbeiter",
    platzhalter: ["ticket_titel", "ticket_nr", "aenderer_name", "link"],
  },
];

// Deckt sich mit STANDARD_VORLAGEN in den Edge Functions
// benachrichtige-kunde/benachrichtige-mitarbeiter - dient hier nur dazu,
// das Textfeld vorzubelegen, solange keine eigene Vorlage existiert.
const STANDARD: Record<string, Vorlage> = {
  kunde_status_geaendert: {
    betreff: `Ticket #{{ticket_nr}}: Status geändert auf "{{status}}"`,
    text: `Hallo {{kunde_name}},\n\nder Status deines Tickets "{{ticket_titel}}" (#{{ticket_nr}}) wurde auf "{{status}}" geändert.\n\nDetails ansehen: {{link}}\n\n— {{firmen_name}}`,
  },
  kunde_ticket_geschlossen: {
    betreff: `Ticket #{{ticket_nr}}: Geschlossen`,
    text: `Hallo {{kunde_name}},\n\ndein Ticket "{{ticket_titel}}" (#{{ticket_nr}}) wurde geschlossen.\n\nDetails ansehen: {{link}}\n\nWar unsere Hilfe zufriedenstellend?\n👍 Ja: {{bewertung_link_ja}}\n👎 Nicht wirklich: {{bewertung_link_nein}}\n\n— {{firmen_name}}`,
  },
  kunde_neue_antwort: {
    betreff: `Ticket #{{ticket_nr}}: Neue Antwort`,
    text: `Hallo {{kunde_name}},\n\nes gibt eine neue Antwort zu deinem Ticket "{{ticket_titel}}" (#{{ticket_nr}}).\n\nDetails ansehen: {{link}}\n\n— {{firmen_name}}`,
  },
  mitarbeiter_zugewiesen: {
    betreff: `Ticket #{{ticket_nr}} wurde dir zugewiesen`,
    text: `Das Ticket "{{ticket_titel}}" (#{{ticket_nr}}) wurde dir von {{aenderer_name}} zugewiesen.\n\nTicket ansehen: {{link}}`,
  },
  mitarbeiter_status_geaendert: {
    betreff: `Ticket #{{ticket_nr}}: Status geändert auf "{{status}}"`,
    text: `Der Status deines Tickets "{{ticket_titel}}" (#{{ticket_nr}}) wurde von {{aenderer_name}} auf "{{status}}" geändert.\n\nTicket ansehen: {{link}}`,
  },
  mitarbeiter_neue_kundenantwort: {
    betreff: `Ticket #{{ticket_nr}}: Neue Kundenantwort`,
    text: `{{aenderer_name}} hat auf dein Ticket "{{ticket_titel}}" (#{{ticket_nr}}) geantwortet.\n\nTicket ansehen: {{link}}`,
  },
};

export default function EmailTexteVerwaltung({ organisationId }: EmailTexteVerwaltungProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).emailTexteVerwaltung;
  const META_TEXT: Record<string, { label: string; beschreibung: string }> = {
    kunde_status_geaendert: { label: txt.labelKundeStatusGeaendert, beschreibung: txt.beschreibungKundeStatusGeaendert },
    kunde_ticket_geschlossen: { label: txt.labelKundeTicketGeschlossen, beschreibung: txt.beschreibungKundeTicketGeschlossen },
    kunde_neue_antwort: { label: txt.labelKundeNeueAntwort, beschreibung: txt.beschreibungKundeNeueAntwort },
    mitarbeiter_zugewiesen: { label: txt.labelMitarbeiterZugewiesen, beschreibung: txt.beschreibungMitarbeiterZugewiesen },
    mitarbeiter_status_geaendert: { label: txt.labelMitarbeiterStatusGeaendert, beschreibung: txt.beschreibungMitarbeiterStatusGeaendert },
    mitarbeiter_neue_kundenantwort: { label: txt.labelMitarbeiterNeueKundenantwort, beschreibung: txt.beschreibungMitarbeiterNeueKundenantwort },
  };
  const [angepasst, setAngepasst] = useState<Record<string, Vorlage>>({});
  const [entwuerfe, setEntwuerfe] = useState<Record<string, Vorlage>>({});
  const [offenerKey, setOffenerKey] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  async function laden() {
    const { data } = await supabase
      .from("benachrichtigungs_mails")
      .select("vorlage_key, betreff, text")
      .eq("organisation_id", organisationId);
    const map: Record<string, Vorlage> = {};
    for (const row of data ?? []) {
      map[row.vorlage_key] = { betreff: row.betreff, text: row.text };
    }
    setAngepasst(map);
  }

  function oeffnen(key: string) {
    if (offenerKey === key) {
      setOffenerKey(null);
      return;
    }
    setOffenerKey(key);
    setEntwuerfe((e) => ({ ...e, [key]: e[key] ?? angepasst[key] ?? STANDARD[key] }));
    setHinweis(null);
  }

  async function speichern(key: string) {
    const entwurf = entwuerfe[key];
    if (!entwurf?.betreff.trim() || !entwurf?.text.trim()) {
      setHinweis(txt.betreffTextLeer);
      return;
    }
    setLaedt(true);
    const { error } = await supabase.from("benachrichtigungs_mails").upsert(
      {
        organisation_id: organisationId,
        vorlage_key: key,
        betreff: entwurf.betreff.trim(),
        text: entwurf.text,
      },
      { onConflict: "organisation_id,vorlage_key" },
    );
    setLaedt(false);
    if (error) {
      console.error(error);
      setHinweis(txt.fehlerSpeichern);
      return;
    }
    setHinweis(txt.gespeichert);
    laden();
  }

  async function zuruecksetzen(key: string) {
    setLaedt(true);
    await supabase
      .from("benachrichtigungs_mails")
      .delete()
      .eq("organisation_id", organisationId)
      .eq("vorlage_key", key);
    setLaedt(false);
    setEntwuerfe((e) => ({ ...e, [key]: STANDARD[key] }));
    setHinweis(txt.zurueckgesetzt);
    laden();
  }

  function gruppe(g: "kunde" | "mitarbeiter") {
    return VORLAGEN_META.filter((m) => m.gruppe === g).map((meta) => {
      const istAngepasst = !!angepasst[meta.key];
      const entwurf = entwuerfe[meta.key] ?? angepasst[meta.key] ?? STANDARD[meta.key];
      const metaText = META_TEXT[meta.key];
      return (
        <div key={meta.key} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
          <button
            onClick={() => oeffnen(meta.key)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-strong)]">
              {metaText.label}
              {istAngepasst && (
                <span className="rounded bg-akzent/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-akzent">
                  {txt.angepasst}
                </span>
              )}
            </span>
            <span className="text-[var(--text-faint)]">{offenerKey === meta.key ? "▲" : "▼"}</span>
          </button>

          {offenerKey === meta.key && (
            <div className="space-y-2 border-t border-[var(--border)] p-3">
              <p className="text-xs text-[var(--text-faint)]">{metaText.beschreibung}</p>
              <p className="text-xs text-[var(--text-faint)]">
                {txt.platzhalterLabel}{" "}
                {meta.platzhalter.map((p) => (
                  <code
                    key={p}
                    className="mr-1 rounded bg-[var(--bg-muted)] px-1 py-0.5 font-mono text-[0.7rem] text-[var(--text-soft)]"
                  >
                    {`{{${p}}}`}
                  </code>
                ))}
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.betreffLabel}</label>
                <input
                  type="text"
                  value={entwurf.betreff}
                  onChange={(e) =>
                    setEntwuerfe((v) => ({ ...v, [meta.key]: { ...entwurf, betreff: e.target.value } }))
                  }
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.textLabel}</label>
                <textarea
                  value={entwurf.text}
                  onChange={(e) =>
                    setEntwuerfe((v) => ({ ...v, [meta.key]: { ...entwurf, text: e.target.value } }))
                  }
                  rows={8}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 font-mono text-xs text-[var(--text-strong)]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => speichern(meta.key)}
                  disabled={laedt}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {txt.speichern}
                </button>
                {istAngepasst && (
                  <button
                    onClick={() => zuruecksetzen(meta.key)}
                    disabled={laedt}
                    className="rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                  >
                    {txt.aufStandardZuruecksetzen}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--text-strong)]">{txt.emailsAnKunden}</h3>
        <div className="space-y-2">{gruppe("kunde")}</div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--text-strong)]">{txt.emailsAnMitarbeiter}</h3>
        <div className="space-y-2">{gruppe("mitarbeiter")}</div>
      </div>
      {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
    </div>
  );
}
