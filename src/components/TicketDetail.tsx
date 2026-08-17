import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { benachrichtigeKunde, benachrichtigeMitarbeiter } from "../lib/benachrichtigungen";
import { sichererDateiname } from "../lib/dateiname";
import { useUngespeichertWarnung } from "../lib/useUngespeichertWarnung";
import { useSpracheingabe, spracheingabeUnterstuetzt } from "../lib/useSpracheingabe";
import { Mic, MicOff, Copy, Check, Trash2 } from "lucide-react";
import DateiAuswahl from "./DateiAuswahl";
import Zeiterfassung from "./Zeiterfassung";
import Avatar from "./Avatar";
import StatusBadge from "./StatusBadge";
import TicketMerge from "./TicketMerge";
import KiAssistent from "./KiAssistent";
import KundenTodoListe from "./KundenTodoListe";
import KundenHardware from "./KundenHardware";
import { useSprache, type Sprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";
type Prioritaet = "niedrig" | "mittel" | "hoch" | "kritisch";

interface Tag {
  id: string;
  name: string;
  farbe: string;
}

interface Makro {
  id: string;
  titel: string;
  inhalt: string;
}

interface Ticket {
  id: string;
  ticket_nr: number;
  titel: string;
  status: Status;
  prioritaet: Prioritaet;
  organisation_id: string;
  kunde_id: string;
  zugewiesen_an: string | null;
  dongle_id: string | null;
  reaktion_faellig_am: string | null;
  loesung_faellig_am: string | null;
  erste_antwort_am: string | null;
  kunde: {
    name: string | null;
    telefonnummer: string | null;
    wartungsvertrag_stufe: { name: string; farbe: string } | null;
  } | null;
}

interface Anhang {
  id: string;
  storage_path: string;
  dateityp: string | null;
}

interface Nachricht {
  id: string;
  quelle: string;
  inhalt: string | null;
  erstellt_am: string;
  autor: { name: string | null } | null;
  anhaenge: Anhang[];
}

interface Techniker {
  id: string;
  name: string | null;
  avatar_url: string | null;
  verfuegbarkeit: string;
}

interface Dongle {
  id: string;
  seriennummer: string;
  software: string;
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

const STATUS_OPTIONEN: Status[] = [
  "offen",
  "in_bearbeitung",
  "wartet_auf_kunde",
  "geloest",
  "geschlossen",
];

interface TicketDetailProps {
  ticketId: string;
  technikerId: string;
  rolle?: "super_admin" | "org_admin" | "techniker" | "kunde";
  onGeloescht?: () => void;
}

export default function TicketDetail({ ticketId, technikerId, rolle, onGeloescht }: TicketDetailProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).ticketDetail;
  const statusTxt = texte(sprache).status;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [kundeEmail, setKundeEmail] = useState<string | null>(null);
  const [kopiertFeld, setKopiertFeld] = useState<"telefon" | "email" | null>(null);
  const [wirdGeloescht, setWirdGeloescht] = useState(false);
  const darfLoeschen = rolle === "org_admin" || rolle === "super_admin";

  async function ticketLoeschen() {
    if (!confirm(txt.loeschenBestaetigen)) return;
    setWirdGeloescht(true);
    const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
    setWirdGeloescht(false);
    if (error) {
      alert(txt.loeschenFehlgeschlagen);
      return;
    }
    onGeloescht?.();
  }

  async function kopieren(text: string, feld: "telefon" | "email") {
    try {
      await navigator.clipboard.writeText(text);
      setKopiertFeld(feld);
      setTimeout(() => setKopiertFeld((f) => (f === feld ? null : f)), 1500);
    } catch {
      // Zwischenablage nicht verfügbar (z.B. kein HTTPS) - einfach ignorieren
    }
  }
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([]);
  const [techniker, setTechniker] = useState<Techniker[]>([]);
  const [dongles, setDongles] = useState<Dongle[]>([]);
  const [ticketTags, setTicketTags] = useState<Tag[]>([]);
  const [alleTags, setAlleTags] = useState<Tag[]>([]);
  const [makros, setMakros] = useState<Makro[]>([]);
  const [neueNotiz, setNeueNotiz] = useState("");
  const [neueDateien, setNeueDateien] = useState<File[]>([]);
  const [sendeLaedt, setSendeLaedt] = useState(false);
  const [fuerKundeSichtbar, setFuerKundeSichtbar] = useState(false);
  const [zeigeTagMenu, setZeigeTagMenu] = useState(false);
  const [andereBetrachter, setAndereBetrachter] = useState<string[]>([]);
  useUngespeichertWarnung(neueNotiz.trim().length > 0 || neueDateien.length > 0);
  const spracheingabe = useSpracheingabe((text) =>
    setNeueNotiz((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text)),
  );

  useEffect(() => {
    ladeAlles();

    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_nachrichten",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          ladeNachrichten();
          markiereGelesen();
        },
      )
      .on(
        // Anhänge werden erst NACH der Nachricht hochgeladen - ohne diese
        // zweite Subscription würde die obige schon (ohne Anhang) auslösen,
        // bevor die Datei überhaupt fertig ist.
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "anhaenge" },
        () => {
          ladeNachrichten();
        },
      )
      .subscribe();

    // Kollisionswarnung: zeigt an, wenn ein Kollege sich dieses Ticket
    // gerade auch anschaut - verhindert doppelte Arbeit ohne es zu merken.
    const praesenzChannel = supabase.channel(`ticket-praesenz-${ticketId}`, {
      config: { presence: { key: technikerId } },
    });
    praesenzChannel
      .on("presence", { event: "sync" }, () => {
        const state = praesenzChannel.presenceState();
        setAndereBetrachter(
          Object.keys(state)
            .filter((id) => id !== technikerId)
            .map((id) => (state[id][0] as { name?: string })?.name ?? "Jemand"),
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data: eigenesProfil } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", technikerId)
            .single();
          await praesenzChannel.track({ name: eigenesProfil?.name ?? "Jemand" });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(praesenzChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function ladeAlles() {
    const ticketDaten = await ladeTicket();
    await ladeNachrichten();
    if (ticketDaten) {
      await ladeTechniker(ticketDaten.organisation_id);
      await ladeTagsUndMakros(ticketDaten.organisation_id);
      await ladeTicketTags();
      await ladeDongles(ticketDaten.kunde_id);
      await ladeKundeEmail(ticketDaten.kunde_id);
    }
    markiereGelesen();
  }

  async function ladeKundeEmail(kundeId: string) {
    const { data } = await supabase.rpc("get_kunde_email", { p_kunde_id: kundeId });
    setKundeEmail((data as string | null) ?? null);
  }

  async function ladeDongles(kundeId: string) {
    const { data } = await supabase
      .from("kunden_dongles")
      .select("id, seriennummer, software")
      .eq("kunde_id", kundeId)
      .order("seriennummer");
    setDongles((data as Dongle[]) ?? []);
  }

  async function ladeTagsUndMakros(organisationId: string) {
    const [{ data: tagDaten }, { data: makroDaten }] = await Promise.all([
      supabase.from("tags").select("id, name, farbe").eq("organisation_id", organisationId).order("name"),
      supabase.from("makros").select("id, titel, inhalt").eq("organisation_id", organisationId).order("titel"),
    ]);
    setAlleTags((tagDaten as Tag[]) ?? []);
    setMakros((makroDaten as Makro[]) ?? []);
  }

  async function ladeTicketTags() {
    const { data } = await supabase
      .from("ticket_tags")
      .select("tag:tag_id(id, name, farbe)")
      .eq("ticket_id", ticketId);
    setTicketTags(((data ?? []).map((d: unknown) => (d as { tag: Tag }).tag)) as Tag[]);
  }

  async function tagHinzufuegen(tag: Tag) {
    await supabase.from("ticket_tags").upsert({ ticket_id: ticketId, tag_id: tag.id });
    setTicketTags((v) => (v.find((t) => t.id === tag.id) ? v : [...v, tag]));
    setZeigeTagMenu(false);
  }

  async function tagEntfernen(tagId: string) {
    await supabase.from("ticket_tags").delete().eq("ticket_id", ticketId).eq("tag_id", tagId);
    setTicketTags((v) => v.filter((t) => t.id !== tagId));
  }

  async function markiereGelesen() {
    await supabase
      .from("tickets")
      .update({ zuletzt_gelesen_am: new Date().toISOString() })
      .eq("id", ticketId);
  }

  async function ladeTicket() {
    const { data } = await supabase
      .from("tickets")
      .select("*, kunde:kunde_id(name, telefonnummer, wartungsvertrag_stufe:wartungsvertrag_stufe_id(name, farbe))")
      .eq("id", ticketId)
      .single();
    const t = data as unknown as Ticket | null;
    setTicket(t);
    return t;
  }

  async function ladeNachrichten() {
    const [nachrichtenRes, zeitRes] = await Promise.all([
      supabase
        .from("ticket_nachrichten")
        .select("id, quelle, inhalt, erstellt_am, autor:autor_id(name), anhaenge(id, storage_path, dateityp)")
        .eq("ticket_id", ticketId)
        .order("erstellt_am", { ascending: false }),
      supabase
        .from("zeiteintraege")
        .select("id, minuten, beschreibung, erfassungsart, erstellt_am, techniker:techniker_id(name)")
        .eq("ticket_id", ticketId)
        .not("minuten", "is", null)
        .order("erstellt_am", { ascending: false }),
    ]);

    const echteNachrichten = (nachrichtenRes.data as unknown as Nachricht[]) ?? [];

    // Zeiteinträge als Pseudo-Nachrichten in den Verlauf mischen
    const zeitNachrichten: Nachricht[] = ((zeitRes.data ?? []) as unknown as {
      id: string; minuten: number; beschreibung: string | null;
      erfassungsart: string; erstellt_am: string;
      techniker: { name: string | null } | null;
    }[]).map((z) => ({
      id: `zeit-${z.id}`,
      quelle: "zeiterfassung",
      inhalt: `${z.minuten} ${txt.minutenErfasstSuffix}${z.beschreibung ? ` – ${z.beschreibung}` : ""}${z.erfassungsart === "manuell" ? txt.manuellSuffix : ""}`,
      erstellt_am: z.erstellt_am,
      autor: z.techniker,
      anhaenge: [],
    }));

    const kombiniert = [...echteNachrichten, ...zeitNachrichten].sort(
      (a, b) => new Date(b.erstellt_am).getTime() - new Date(a.erstellt_am).getTime()
    );
    setNachrichten(kombiniert);
  }

  async function anhangOeffnen(pfad: string) {
    const { data, error } = await supabase.storage.from("anhaenge").createSignedUrl(pfad, 60);
    if (!error && data) window.open(data.signedUrl, "_blank");
  }

  async function ladeTechniker(organisationId: string) {
    // get_team_mit_email statt profiles-Direktabfrage: erfasst auch
    // Mitarbeiter, die nur per firmen_mitgliedschaften (Mehrfach-
    // Mitgliedschaft) mit dieser Firma verknuepft sind.
    const { data } = await supabase
      .rpc("get_team_mit_email", { p_organisation_id: organisationId })
      .eq("deaktiviert", false);
    setTechniker((data as Techniker[]) ?? []);
  }

  async function statusAendern(status: Status) {
    await supabase.from("tickets").update({ status }).eq("id", ticketId);
    setTicket((t) => (t ? { ...t, status } : t));
    benachrichtigeKunde({ ticketId, ereignis: "status_geaendert", neuerStatus: status });
    benachrichtigeMitarbeiter({ ticketId, ereignis: "status_geaendert", neuerStatus: status });
  }

  async function zuweisen(zugewiesenAn: string) {
    await supabase
      .from("tickets")
      .update({ zugewiesen_an: zugewiesenAn || null })
      .eq("id", ticketId);
    setTicket((t) => (t ? { ...t, zugewiesen_an: zugewiesenAn || null } : t));
    if (zugewiesenAn) {
      benachrichtigeMitarbeiter({ ticketId, ereignis: "zugewiesen" });
    }
  }

  async function dongleZuweisen(dongleId: string) {
    await supabase
      .from("tickets")
      .update({ dongle_id: dongleId || null })
      .eq("id", ticketId);
    setTicket((t) => (t ? { ...t, dongle_id: dongleId || null } : t));
  }

  async function notizSenden() {
    if (!neueNotiz.trim() && neueDateien.length === 0) return;
    setSendeLaedt(true);

    const { data: nachricht, error } = await supabase
      .from("ticket_nachrichten")
      .insert({
        ticket_id: ticketId,
        autor_id: technikerId,
        quelle: fuerKundeSichtbar ? "portal" : "intern",
        inhalt: neueNotiz.trim() || null,
      })
      .select("id")
      .single();

    if (error || !nachricht) {
      setSendeLaedt(false);
      return;
    }

    let anhangFehler = false;
    for (const datei of neueDateien) {
      const pfad = `${ticketId}/${Date.now()}-${sichererDateiname(datei.name)}`;
      const { error: uploadFehler } = await supabase.storage.from("anhaenge").upload(pfad, datei);
      if (uploadFehler) {
        console.error("[TicketDetail] Anhang-Upload fehlgeschlagen:", uploadFehler);
        anhangFehler = true;
        continue;
      }
      const { error: insertFehler } = await supabase.from("anhaenge").insert({
        nachricht_id: nachricht.id,
        storage_path: pfad,
        dateityp: datei.type,
      });
      if (insertFehler) {
        console.error("[TicketDetail] Anhang-Eintrag fehlgeschlagen:", insertFehler);
        anhangFehler = true;
      }
    }
    if (anhangFehler) {
      alert(txt.anhangFehler);
    }

    setNeueNotiz("");
    setNeueDateien([]);
    setSendeLaedt(false);
    await ladeNachrichten();
    if (fuerKundeSichtbar) {
      benachrichtigeKunde({ ticketId, ereignis: "neue_antwort" });
    }
  }

  if (!ticket) return <p className="text-sm text-[var(--text-faint)]">{txt.laedt}</p>;

  return (
    <div className="space-y-5">
      {andereBetrachter.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-300">
          👀 {andereBetrachter.join(", ")} {txt.betrachterBannerSuffix}
        </div>
      )}

      <div className="space-y-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5 lg:space-y-0">
        <div className="space-y-5 lg:col-span-2">

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-strong)]">
            <span className="mr-1.5 font-mono text-sm text-[var(--text-faint)]">
              #{ticket.ticket_nr}
            </span>
            {ticket.titel}
          </h2>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--text-soft)]">
            <span>{ticket.kunde?.name ?? txt.unbekannterKunde}</span>
            {ticket.kunde?.telefonnummer && (
              <>
                <span className="text-[var(--text-faint)]">·</span>
                <a
                  href={`tel:${ticket.kunde.telefonnummer}`}
                  className="font-mono hover:text-akzent hover:underline"
                >
                  {ticket.kunde.telefonnummer}
                </a>
                <button
                  type="button"
                  title={txt.telefonKopierenTitle}
                  onClick={() => kopieren(ticket.kunde!.telefonnummer!, "telefon")}
                  className="text-[var(--text-faint)] hover:text-akzent"
                >
                  {kopiertFeld === "telefon" ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </>
            )}
            {kundeEmail && (
              <>
                <span className="text-[var(--text-faint)]">·</span>
                <a href={`mailto:${kundeEmail}`} className="hover:text-akzent hover:underline">
                  {kundeEmail}
                </a>
                <button
                  type="button"
                  title={txt.emailKopierenTitle}
                  onClick={() => kopieren(kundeEmail, "email")}
                  className="text-[var(--text-faint)] hover:text-akzent"
                >
                  {kopiertFeld === "email" ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          {ticket.kunde?.wartungsvertrag_stufe ? (
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
              style={{ background: ticket.kunde.wartungsvertrag_stufe.farbe }}
            >
              {ticket.kunde.wartungsvertrag_stufe.name}
            </span>
          ) : (
            <span className="rounded-full border border-[var(--border-input)] px-2.5 py-1 text-xs font-medium text-[var(--text-soft)]">
              {texte(sprache).wartungsvertrag.minutenpreis}
            </span>
          )}
          <select
            value={ticket.status}
            onChange={(e) => statusAendern(e.target.value as Status)}
            className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONEN.map((s) => (
              <option key={s} value={s}>
                {statusTxt[s]}
              </option>
            ))}
          </select>

          {ticket.zugewiesen_an && (
            <Avatar
              name={techniker.find((t) => t.id === ticket.zugewiesen_an)?.name ?? null}
              avatarUrl={techniker.find((t) => t.id === ticket.zugewiesen_an)?.avatar_url ?? null}
              groesse="sm"
            />
          )}
          <select
            value={ticket.zugewiesen_an ?? ""}
            onChange={(e) => zuweisen(e.target.value)}
            className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-2 py-1.5 text-sm"
          >
            <option value="">{txt.nichtZugewiesen}</option>
            {techniker.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? txt.unbenannt}
                {t.verfuegbarkeit !== "verfuegbar" &&
                  ` (${t.verfuegbarkeit === "urlaub" ? txt.urlaub : txt.abwesend})`}
              </option>
            ))}
          </select>

          {dongles.length > 0 && (
            <select
              value={ticket.dongle_id ?? ""}
              onChange={(e) => dongleZuweisen(e.target.value)}
              title={txt.dongleTitle}
              className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-2 py-1.5 text-sm"
            >
              <option value="">{txt.keinDongleZugeordnet}</option>
              {dongles.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.seriennummer} ({d.software})
                </option>
              ))}
            </select>
          )}

          {darfLoeschen && (
            <button
              type="button"
              onClick={ticketLoeschen}
              disabled={wirdGeloescht}
              title={txt.loeschenTitle}
              className="ml-auto flex items-center gap-1 rounded border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-900/10"
            >
              <Trash2 size={12} />
              {txt.loeschen}
            </button>
          )}
        </div>

        {/* Zusammenführen */}
        {ticket.status !== "geschlossen" && (
          <TicketMerge
            ticketId={ticketId}
            ticketNr={ticket.ticket_nr}
            organisationId={ticket.organisation_id}
            onMerged={() => window.location.reload()}
          />
        )}

        {/* SLA-Fälligkeiten */}
        {(ticket.reaktion_faellig_am || ticket.loesung_faellig_am) && (
          <div className="flex flex-wrap gap-2">
            {ticket.reaktion_faellig_am && (
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${new Date(ticket.reaktion_faellig_am) < new Date() ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                ⏱ {txt.reaktionLabel} {formatDatum(ticket.reaktion_faellig_am, sprache)}
                {new Date(ticket.reaktion_faellig_am) < new Date() && ` – ${txt.ueberfaellig}`}
              </span>
            )}
            {ticket.loesung_faellig_am && (
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${new Date(ticket.loesung_faellig_am) < new Date() ? "bg-red-100 text-red-700" : "bg-orange-50 text-orange-700"}`}>
                🎯 {txt.loesungLabel} {formatDatum(ticket.loesung_faellig_am, sprache)}
                {new Date(ticket.loesung_faellig_am) < new Date() && ` – ${txt.ueberfaellig}`}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ticketTags.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ background: t.farbe }}
            >
              {t.name}
              <button onClick={() => tagEntfernen(t.id)} className="hover:opacity-75">×</button>
            </span>
          ))}
          {alleTags.filter((t) => !ticketTags.find((tt) => tt.id === t.id)).length > 0 && (
            <div className="relative">
              <button
                onClick={() => setZeigeTagMenu(!zeigeTagMenu)}
                className="rounded border border-dashed border-[var(--border-input)] px-2 py-0.5 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-muted)]"
              >
                {txt.tagButton}
              </button>
              {zeigeTagMenu && (
                <div className="absolute left-0 top-6 z-10 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-1 shadow-lg">
                  {alleTags.filter((t) => !ticketTags.find((tt) => tt.id === t.id)).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { tagHinzufuegen(t); setZeigeTagMenu(false); }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--bg-muted)]"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.farbe }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kollisionswarnung */}
        {andereBetrachter.length > 0 && (
          <p className="rounded bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
            ⚠️ {andereBetrachter.join(", ")} {andereBetrachter.length === 1 ? txt.betrachterSchautEinzahl : txt.betrachterSchautMehrzahl} {txt.betrachterWarnungSuffix}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--text-strong)]">{txt.verlauf}</h3>
        <div className="max-h-96 space-y-3 overflow-y-auto lg:max-h-[32rem]">
          {nachrichten.map((n) => (
            n.quelle === "zeiterfassung" ? (
              <div
                key={n.id}
                className="flex items-center gap-2 rounded-md border border-dashed border-amber-300/60 bg-amber-50/50 px-3 py-1.5 text-xs dark:border-amber-700/40 dark:bg-amber-900/10"
              >
                <span>⏱</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">
                  {n.autor?.name ?? txt.technikerFallback}
                </span>
                <span className="text-[var(--text-soft)]">{n.inhalt}</span>
                <span className="ml-auto font-mono text-[var(--text-faint)]">
                  {formatDatum(n.erstellt_am, sprache)}
                </span>
              </div>
            ) : (
            <div
              key={n.id}
              className={`rounded-md p-3 text-sm ${
                n.quelle === "intern"
                  ? "border border-[var(--bubble-intern-border)] bg-[var(--bubble-intern-bg)]"
                  : n.quelle === "whatsapp"
                  ? "border border-[var(--bubble-whatsapp-border)] bg-[var(--bubble-whatsapp-bg)]"
                  : "border border-[var(--border)] bg-[var(--bg-muted)]"
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-soft)]">
                <span>
                  {n.autor?.name ?? (n.quelle === "whatsapp" ? txt.kundeWhatsapp : txt.kunde)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[var(--text-faint)]">
                    {formatDatum(n.erstellt_am, sprache)}
                  </span>
                  <span className="uppercase tracking-wide">{n.quelle}</span>
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[var(--text-strong)]">{n.inhalt}</p>
              {n.anhaenge && n.anhaenge.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {n.anhaenge.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => anhangOeffnen(a.storage_path)}
                      className="rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                    >
                      📎 {a.storage_path.split("-").slice(1).join("-") || txt.anhangFallback}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {makros.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const makro = makros.find((m) => m.id === e.target.value);
                if (makro) {
                  setNeueNotiz((prev) => prev ? prev + "\n\n" + makro.inhalt : makro.inhalt);
                }
              }}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-soft)]"
            >
              <option value="">{txt.makroEinfuegen}</option>
              {makros.map((m) => (
                <option key={m.id} value={m.id}>{m.titel}</option>
              ))}
            </select>
          )}
          {spracheingabeUnterstuetzt ? (
            <button
              type="button"
              onClick={() => (spracheingabe.aktiv ? spracheingabe.stoppen() : spracheingabe.starten())}
              className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                spracheingabe.aktiv
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                  : "border-[var(--border-input)] text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
              }`}
            >
              {spracheingabe.aktiv ? <MicOff size={14} /> : <Mic size={14} />}
              {spracheingabe.aktiv ? txt.aufnahmeLaeuft : txt.diktieren}
            </button>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
              <MicOff size={13} />
              {txt.spracheingabeNichtMoeglich}
            </p>
          )}
          <DateiAuswahl dateien={neueDateien} onAendern={setNeueDateien}>
            <textarea
              value={neueNotiz}
              onChange={(e) => setNeueNotiz(e.target.value)}
              rows={3}
              placeholder={txt.notizPlatzhalter}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-2 text-sm"
            />
          </DateiAuswahl>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
              <input
                type="checkbox"
                checked={fuerKundeSichtbar}
                onChange={(e) => setFuerKundeSichtbar(e.target.checked)}
                className="accent-amber-500"
              />
              {txt.fuerKundenSichtbar}
            </label>
            <button
              onClick={notizSenden}
              disabled={sendeLaedt}
              className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {sendeLaedt ? txt.wirdGesendet : txt.senden}
            </button>
          </div>
        </div>
      </div>
        </div>

        <div className="space-y-5 lg:sticky lg:top-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h3 className="mb-2 text-sm font-medium text-[var(--text-strong)]">
              {txt.todoListeKunde}
            </h3>
            <KundenTodoListe
              kundeId={ticket.kunde_id}
              organisationId={ticket.organisation_id}
              modus="voll"
            />
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h3 className="mb-2 text-sm font-medium text-[var(--text-strong)]">
              {txt.hardwareKunde}
            </h3>
            <KundenHardware kundeId={ticket.kunde_id} organisationId={ticket.organisation_id} />
          </div>

          <KiAssistent
            ticketId={ticket.id}
            onAntwortVorschlag={(text) => setNeueNotiz((prev) => prev ? prev + "\n\n" + text : text)}
            onTagsVorgeschlagen={async (vorgeschlageneTags) => {
              const passende = alleTags.filter((t) => vorgeschlageneTags.includes(t.name));
              for (const tag of passende) {
                if (!ticketTags.find((tt) => tt.id === tag.id)) {
                  await tagHinzufuegen(tag);
                }
              }
            }}
          />

          <Zeiterfassung
            ticketId={ticket.id}
            kundeId={ticket.kunde_id}
            technikerId={technikerId}
            organisationId={ticket.organisation_id}
            onZeitErfasst={ladeNachrichten}
          />
        </div>
      </div>
    </div>
  );
}
