import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import DongleImport from "./DongleImport";
import ProduktNachricht from "./ProduktNachricht";
import GesendeteNachrichten from "./GesendeteNachrichten";
import { benachrichtigeKunde } from "../lib/benachrichtigungen";
import { ChevronDown, ChevronRight, Trash2, Copy, Check, KeyRound, Link2Off, CalendarClock, Wallet, LayoutList, Send, Upload, RefreshCw } from "lucide-react";
import KennzahlKarte from "./KennzahlKarte";
import ImportStandKarte from "./ImportStandKarte";
import { importFarbe, alterInTagen, type ImportStand } from "../lib/importAlter";
import { zuletztText } from "../lib/zeitText";
import LeerHinweis from "./LeerHinweis";
import { softwareStil } from "../lib/softwareStil";
import { ablaufInfo } from "../lib/ablaufInfo";
import DongleDetailPanel, { VertragDetailPanel, type DetailDongle, type DetailVertrag } from "./DongleDetailPanel";

interface Vorlage {
  betreff: string;
  text: string;
}

// Deckt sich mit STANDARD in EmailTexteVerwaltung.tsx - dient hier nur als
// Fallback, solange die Firma keine eigene Vorlage in Werkzeuge -> E-Mail-Texte
// hinterlegt hat (Tabelle benachrichtigungs_mails, gleiches Muster wie bei
// den echten Benachrichtigungs-Mails).
const STANDARD_LIZENZ_VORLAGEN: Record<string, Vorlage> = {
  lizenz_update_einladung: {
    betreff: `Software-Update empfohlen (Build {{build}})`,
    text: `Eure Lizenz(en) {{seriennummern}} laufen aktuell auf Build {{build}}. Wir empfehlen ein Update auf die aktuelle Version – meldet euch gerne, wenn ihr dabei Unterstützung braucht.`,
  },
  lizenz_update_einladung_mit_max: {
    betreff: `Software-Update empfohlen (Build {{build}})`,
    text: `Eure Lizenz(en) {{seriennummern}} laufen aktuell auf Build {{build}}, erlaubt ist bereits Build {{max_build}}. Wir empfehlen ein Update – meldet euch gerne, wenn ihr dabei Unterstützung braucht.`,
  },
};

function fuellePlatzhalter(vorlage: string, werte: Record<string, string>): string {
  return vorlage.replace(/\{\{(\w+)\}\}/g, (_, name) => werte[name] ?? "");
}

interface KundeKurz {
  id: string;
  name: string | null;
}

interface NichtZugeordneterDongle {
  id: string;
  seriennummer: string;
  software: string;
  gruppe: string | null;
}

interface NichtZugeordneterVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
}

interface AlleDongle {
  id: string;
  seriennummer: string;
  software: string;
  wartungsvertrag: string;
  freiminuten_pro_monat: number;
  kunde_id: string | null;
  kunde: { name: string | null; firmenname: string | null } | null;
}

interface AlleVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
  status: string | null;
  kunde_id: string | null;
  dongle_id: string | null;
  kunde: { name: string | null; firmenname: string | null } | null;
  aktuelle_engine_build: string | null;
  max_erlaubte_engine_build: string | null;
  renewal_bezahlt: boolean;
}

interface MailStatus {
  gesendet_am: string;
  geoeffnet_am: string | null;
}

const ANZAHL_POOL_SICHTBAR = 5;
const ANZAHL_UEBERSICHT_SICHTBAR = 10;

export default function DongleLizenzVerwaltung({ organisationId }: { organisationId: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).dongleLizenzVerwaltung;
  const mailTxt = texte(sprache).ticketDetail;
  const dongleTxt = texte(sprache).dongleVerwaltung;
  const [kunden, setKunden] = useState<KundeKurz[]>([]);

  const [nichtZugeordnete, setNichtZugeordnete] = useState<NichtZugeordneterDongle[]>([]);
  const [zuweisenAn, setZuweisenAn] = useState<Record<string, string>>({});
  const [filterDongleNummer, setFilterDongleNummer] = useState("");
  const [alleDonglesPoolAnzeigen, setAlleDonglesPoolAnzeigen] = useState(false);

  const [nichtZugeordneteVertraege, setNichtZugeordneteVertraege] = useState<NichtZugeordneterVertrag[]>([]);
  const [zuweisenAnVertrag, setZuweisenAnVertrag] = useState<Record<string, string>>({});
  const [filterVertragNummer, setFilterVertragNummer] = useState("");
  const [alleVertraegePoolAnzeigen, setAlleVertraegePoolAnzeigen] = useState(false);

  const [alleDongles, setAlleDongles] = useState<AlleDongle[]>([]);
  const [dongleUebersichtSuche, setDongleUebersichtSuche] = useState("");
  const [dongleUebersichtAlleAnzeigen, setDongleUebersichtAlleAnzeigen] = useState(false);
  const [softwareFilter, setSoftwareFilter] = useState("");
  const [nachrichtenRefresh, setNachrichtenRefresh] = useState(0);
  const [unterTab, setUnterTab] = useState<"uebersicht" | "mitteilungen" | "zuordnung">("uebersicht");
  const [importStand, setImportStand] = useState<ImportStand>({});
  const [nachrichtSoftware, setNachrichtSoftware] = useState("");

  const [alleVertraege, setAlleVertraege] = useState<AlleVertrag[]>([]);
  const [vertragUebersichtSuche, setVertragUebersichtSuche] = useState("");
  const [vertragUebersichtAlleAnzeigen, setVertragUebersichtAlleAnzeigen] = useState(false);
  const [buildFilter, setBuildFilter] = useState("");
  const [einladungLaedt, setEinladungLaedt] = useState(false);
  const [einladungHinweis, setEinladungHinweis] = useState<string | null>(null);
  const [mailStatusByKunde, setMailStatusByKunde] = useState<Record<string, MailStatus>>({});
  const [kopiertId, setKopiertId] = useState<string | null>(null);
  const detailTxt = texte(sprache).dongleDetail;
  const [offenerDongleId, setOffenerDongleId] = useState<string | null>(null);
  const [offenerVertragId, setOffenerVertragId] = useState<string | null>(null);
  // Klick auf eine Kennzahl-Karte: die Vertragsliste zeigt dann genau diese
  // Vertraege (bald ablaufend bzw. davon Renewal offen), nach Ablauf sortiert.
  const [vertragKachel, setVertragKachel] = useState<"bald" | "renewal" | null>(null);
  const donglesKarteRef = useRef<HTMLDivElement>(null);
  const vertraegeKarteRef = useRef<HTMLDivElement>(null);

  function zuKarteScrollen(ref: React.RefObject<HTMLDivElement | null>) {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function vertragKachelWaehlen(art: "bald" | "renewal") {
    if (vertragKachel === art) {
      setVertragKachel(null);
      return;
    }
    setVertragKachel(art);
    setVertragUebersichtSuche("");
    setBuildFilter("");
    zuKarteScrollen(vertraegeKarteRef);
  }

  function donglesKachelWaehlen() {
    setVertragKachel(null);
    setDongleUebersichtSuche("");
    setSoftwareFilter("");
    zuKarteScrollen(donglesKarteRef);
  }

  // Klick auf die Zeile klappt die Details auf - ausser er trifft ein Bedien-
  // element (Kopieren, Auswahl, Loeschen, ...).
  function zeilenKlick(e: React.MouseEvent, umschalten: () => void) {
    if ((e.target as HTMLElement).closest("button, select, a, input, textarea")) return;
    umschalten();
  }

  async function seriennummerKopieren(id: string, seriennummer: string) {
    try {
      await navigator.clipboard.writeText(seriennummer);
      setKopiertId(id);
      setTimeout(() => setKopiertId((k) => (k === id ? null : k)), 1500);
    } catch {
      // Zwischenablage nicht verfügbar (z.B. kein HTTPS) - einfach ignorieren
    }
  }

  useEffect(() => {
    alleNeuLaden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  function alleNeuLaden() {
    ladeKunden();
    ladeNichtZugeordnete();
    ladeNichtZugeordneteVertraege();
    ladeAlleDongles();
    ladeAlleVertraege();
    ladeMailStatus();
    ladeImportStand();
  }

  // Zeitpunkt des letzten Imports je Art (Dongle-Export / Lizenz-Export aus dem
  // exocad-Portal), siehe import_protokoll (Abschnitt 85).
  async function ladeImportStand() {
    const { data } = await supabase
      .from("import_protokoll")
      .select("art, erstellt_am, rueckwirkend")
      .eq("organisation_id", organisationId)
      .order("erstellt_am", { ascending: false })
      .limit(50);
    const stand: typeof importStand = {};
    for (const z of (data as { art: "dongle" | "lizenz"; erstellt_am: string; rueckwirkend: boolean }[]) ?? []) {
      if (!stand[z.art]) stand[z.art] = { am: z.erstellt_am, rueckwirkend: z.rueckwirkend };
    }
    setImportStand(stand);
  }

  // Letzte Lizenz-Update-Einladung pro Kunde (eine Mail deckt ggf. mehrere
  // Lizenzen desselben Kunden ab, siehe updateEinladungenVersenden) - fuer
  // die "gelesen am"-Anzeige direkt in der Lizenzvertrags-Uebersicht, damit
  // man nicht jedes Ticket einzeln oeffnen muss.
  async function ladeMailStatus() {
    const { data } = await supabase
      .from("email_sendungen")
      .select("kunde_id, gesendet_am, geoeffnet_am")
      .eq("organisation_id", organisationId)
      .eq("vorlage_key", "lizenz_update_einladung")
      .order("gesendet_am", { ascending: false });
    const map: Record<string, MailStatus> = {};
    for (const row of data ?? []) {
      if (!row.kunde_id || map[row.kunde_id]) continue;
      map[row.kunde_id] = { gesendet_am: row.gesendet_am, geoeffnet_am: row.geoeffnet_am };
    }
    setMailStatusByKunde(map);
  }

  async function ladeKunden() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .eq("deaktiviert", false)
      .order("name");
    setKunden((data as KundeKurz[]) ?? []);
  }

  async function ladeNichtZugeordnete() {
    const { data } = await supabase
      .from("kunden_dongles")
      .select("id, seriennummer, software, gruppe")
      .eq("organisation_id", organisationId)
      .is("kunde_id", null)
      .order("seriennummer");
    setNichtZugeordnete((data as NichtZugeordneterDongle[]) ?? []);
  }

  async function dongleZuweisen(dongleId: string) {
    const kundeId = zuweisenAn[dongleId];
    if (!kundeId) return;
    await supabase.from("kunden_dongles").update({ kunde_id: kundeId }).eq("id", dongleId);
    setZuweisenAn((z) => {
      const kopie = { ...z };
      delete kopie[dongleId];
      return kopie;
    });
    ladeNichtZugeordnete();
    ladeAlleDongles();
  }

  async function ladeNichtZugeordneteVertraege() {
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende")
      .eq("organisation_id", organisationId)
      .is("kunde_id", null)
      .order("vertrag_ende", { ascending: true, nullsFirst: false });
    setNichtZugeordneteVertraege((data as NichtZugeordneterVertrag[]) ?? []);
  }

  async function vertragZuweisen(vertragId: string) {
    const kundeId = zuweisenAnVertrag[vertragId];
    if (!kundeId) return;
    await supabase.from("lizenz_vertraege").update({ kunde_id: kundeId }).eq("id", vertragId);
    setZuweisenAnVertrag((z) => {
      const kopie = { ...z };
      delete kopie[vertragId];
      return kopie;
    });
    ladeNichtZugeordneteVertraege();
    ladeAlleVertraege();
  }

  async function ladeAlleDongles() {
    const { data } = await supabase
      .from("kunden_dongles")
      .select("id, seriennummer, software, wartungsvertrag, freiminuten_pro_monat, kunde_id, kunde:kunde_id(name, firmenname)")
      .eq("organisation_id", organisationId)
      .order("seriennummer");
    setAlleDongles((data as unknown as AlleDongle[]) ?? []);
  }

  async function dongleLoeschen(id: string, seriennummer: string) {
    if (!confirm(dongleTxt.loeschenConfirmTemplate.replace("{seriennummer}", seriennummer))) return;
    const { error } = await supabase.from("kunden_dongles").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert(dongleTxt.fehlerLoeschen);
      return;
    }
    ladeAlleDongles();
    ladeNichtZugeordnete();
  }

  async function ladeAlleVertraege() {
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende, status, kunde_id, dongle_id, kunde:kunde_id(name, firmenname), aktuelle_engine_build, max_erlaubte_engine_build, renewal_bezahlt")
      .eq("organisation_id", organisationId)
      .order("lizenz_seriennummer");
    setAlleVertraege((data as unknown as AlleVertrag[]) ?? []);
  }

  async function vertragKundeAendern(v: AlleVertrag, neuerKundeId: string) {
    const neu = neuerKundeId || null;
    if (neu === v.kunde_id) return;
    const neuerName = kunden.find((k) => k.id === neu)?.name ?? txt.unbenannt;
    const meldung = neu
      ? txt.zuordnungAendernConfirmTemplate
          .replace("{seriennummer}", v.lizenz_seriennummer)
          .replace("{alt}", v.kunde?.name ?? txt.nichtZugeordnet)
          .replace("{neu}", neuerName)
      : txt.zuordnungAufhebenConfirmTemplate
          .replace("{seriennummer}", v.lizenz_seriennummer)
          .replace("{kunde}", v.kunde?.name ?? txt.unbenannt);
    if (!confirm(meldung)) return;
    await supabase.from("lizenz_vertraege").update({ kunde_id: neu, dongle_id: null }).eq("id", v.id);
    ladeAlleVertraege();
    ladeNichtZugeordneteVertraege();
  }

  async function renewalBezahltUmschalten(vertragId: string, aktuellerWert: boolean) {
    await supabase.from("lizenz_vertraege").update({ renewal_bezahlt: !aktuellerWert }).eq("id", vertragId);
    ladeAlleVertraege();
  }

  const gefilterteNichtZugeordnete = nichtZugeordnete.filter((d) =>
    d.seriennummer.toLowerCase().includes(filterDongleNummer.trim().toLowerCase()),
  );
  const dongleSuchtAktiv = filterDongleNummer.trim() !== "";
  const sichtbareNichtZugeordnete =
    dongleSuchtAktiv || alleDonglesPoolAnzeigen
      ? gefilterteNichtZugeordnete
      : gefilterteNichtZugeordnete.slice(0, ANZAHL_POOL_SICHTBAR);

  const gefilterteNichtZugeordneteVertraege = nichtZugeordneteVertraege.filter((v) =>
    v.lizenz_seriennummer.toLowerCase().includes(filterVertragNummer.trim().toLowerCase()),
  );
  const vertragSuchtAktiv = filterVertragNummer.trim() !== "";
  const sichtbareNichtZugeordneteVertraege =
    vertragSuchtAktiv || alleVertraegePoolAnzeigen
      ? gefilterteNichtZugeordneteVertraege
      : gefilterteNichtZugeordneteVertraege.slice(0, ANZAHL_POOL_SICHTBAR);

  function kurzDatum(e: { am: string; rueckwirkend: boolean } | undefined): string {
    if (!e) return txt.importNie;
    const datum = new Date(e.am).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE", { day: "2-digit", month: "2-digit" });
    return e.rueckwirkend ? `≈ ${datum}` : datum;
  }

  // Kurzer Wert fuer die Karte: bis 14 Tage relativ ("vor 3 Tagen"), danach
  // ein kompaktes Datum (TT.MM.JJ), damit es in die schmale Spalte passt.
  function importWert(iso: string | null): string {
    if (!iso) return txt.importNie;
    if (alterInTagen(iso) < 14) return zuletztText(iso, sprache);
    return new Date(iso).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }

  const bald = alleVertraege.filter((v) => {
    if (!v.vertrag_ende || (v.status && v.status.toLowerCase() !== "active")) return false;
    const a = ablaufInfo(v.vertrag_ende);
    return a.tage >= 0 && a.tage <= 30;
  });
  const baldOffen = bald.filter((v) => !v.renewal_bezahlt);
  const donglesProSoftware = Object.entries(
    alleDongles.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.software]: (acc[d.software] ?? 0) + 1 }), {}),
  )
    .map(([s, n]) => `${s} ${n}`)
    .join(" · ");

  const verfuegbareSoftware = Array.from(new Set(["exocad", "exoplan", ...alleDongles.map((d) => d.software)])).sort();

  const nachrichtEmpfaenger = nachrichtSoftware
    ? Array.from(
        new Map(
          alleDongles
            .filter((d) => d.software === nachrichtSoftware && d.kunde_id)
            .map((d) => [d.kunde_id!, { id: d.kunde_id!, name: d.kunde?.name ?? null }]),
        ).values(),
      )
    : [];

  async function softwareAendern(dongleId: string, software: string) {
    await supabase.from("kunden_dongles").update({ software }).eq("id", dongleId);
    ladeAlleDongles();
    ladeNichtZugeordnete();
  }

  const dongleUebersichtGefiltert = alleDongles.filter((d) => {
    if (softwareFilter && d.software !== softwareFilter) return false;
    const begriff = dongleUebersichtSuche.trim().toLowerCase();
    if (!begriff) return true;
    return (
      d.seriennummer.toLowerCase().includes(begriff) ||
      (d.kunde?.name ?? "").toLowerCase().includes(begriff)
    );
  });
  const dongleUebersichtSuchtAktiv = dongleUebersichtSuche.trim() !== "";
  const sichtbareDongleUebersicht =
    dongleUebersichtSuchtAktiv || dongleUebersichtAlleAnzeigen
      ? dongleUebersichtGefiltert
      : dongleUebersichtGefiltert.slice(0, ANZAHL_UEBERSICHT_SICHTBAR);

  const verfuegbareBuilds = Array.from(
    new Set(alleVertraege.map((v) => v.aktuelle_engine_build).filter((b): b is string => !!b && b !== "null")),
  ).sort();

  const kachelIds = vertragKachel
    ? new Set((vertragKachel === "bald" ? bald : baldOffen).map((v) => v.id))
    : null;
  const vertragUebersichtGefiltert = alleVertraege
    .filter((v) => {
    if (kachelIds && !kachelIds.has(v.id)) return false;
    if (buildFilter && v.aktuelle_engine_build !== buildFilter) return false;
    const begriff = vertragUebersichtSuche.trim().toLowerCase();
    if (!begriff) return true;
    return (
      v.lizenz_seriennummer.toLowerCase().includes(begriff) ||
      v.produkt_name.toLowerCase().includes(begriff) ||
      (v.kunde?.name ?? "").toLowerCase().includes(begriff)
    );
    })
    // Bei aktiver Kennzahl zuerst die, die am schnellsten ablaufen
    .sort((a, b) => (kachelIds ? (a.vertrag_ende ?? "").localeCompare(b.vertrag_ende ?? "") : 0));
  const vertragUebersichtSuchtAktiv = vertragUebersichtSuche.trim() !== "";
  const sichtbareVertragUebersicht =
    vertragUebersichtSuchtAktiv || vertragUebersichtAlleAnzeigen || kachelIds
      ? vertragUebersichtGefiltert
      : vertragUebersichtGefiltert.slice(0, ANZAHL_UEBERSICHT_SICHTBAR);

  const einladbareKunden = Array.from(
    new Set(vertragUebersichtGefiltert.filter((v) => v.kunde_id).map((v) => v.kunde_id!)),
  );

  async function ladeVorlage(key: string): Promise<Vorlage> {
    const { data } = await supabase
      .from("benachrichtigungs_mails")
      .select("betreff, text")
      .eq("organisation_id", organisationId)
      .eq("vorlage_key", key)
      .maybeSingle();
    return data ?? STANDARD_LIZENZ_VORLAGEN[key];
  }

  async function updateEinladungenVersenden() {
    if (einladbareKunden.length === 0) return;
    if (!confirm(txt.updateEinladenConfirmTemplate.replace("{n}", String(einladbareKunden.length)))) return;
    setEinladungLaedt(true);
    setEinladungHinweis(null);
    const { data: authData } = await supabase.auth.getUser();
    const [vorlageOhneMax, vorlageMitMax] = await Promise.all([
      ladeVorlage("lizenz_update_einladung"),
      ladeVorlage("lizenz_update_einladung_mit_max"),
    ]);
    let angelegt = 0;
    for (const kundeId of einladbareKunden) {
      const betroffeneVertraege = vertragUebersichtGefiltert.filter((v) => v.kunde_id === kundeId);
      const seriennummern = betroffeneVertraege.map((v) => v.lizenz_seriennummer).join(", ");
      const build = betroffeneVertraege[0]?.aktuelle_engine_build ?? buildFilter ?? "";
      const maxBuild = betroffeneVertraege[0]?.max_erlaubte_engine_build;

      const hatMax = !!maxBuild && maxBuild !== build;
      const vorlage = hatMax ? vorlageMitMax : vorlageOhneMax;
      const werte = { seriennummern, build, max_build: maxBuild ?? "" };
      const betreff = fuellePlatzhalter(vorlage.betreff, werte);
      const text = fuellePlatzhalter(vorlage.text, werte);

      const { data: ticket, error: ticketFehler } = await supabase
        .from("tickets")
        .insert({
          organisation_id: organisationId,
          kunde_id: kundeId,
          titel: betreff,
          quelle: "manuell",
        })
        .select("id")
        .single();
      if (ticketFehler || !ticket) continue;

      await supabase.from("ticket_nachrichten").insert({
        ticket_id: ticket.id,
        autor_id: authData.user?.id,
        quelle: "portal",
        inhalt: text,
      });

      // Zusaetzlich per Mail verschicken (mit Lesebestaetigungs-Pixel) -
      // vorher entstand nur der Ticket-Eintrag, ohne dass der Kunde aktiv
      // benachrichtigt wurde. Dokumentiert jetzt per email_sendungen, wann
      // (und ob) die Mail beim Kunden geoeffnet wurde.
      await benachrichtigeKunde({ ticketId: ticket.id, ereignis: "lizenz_update", betreff, text });

      angelegt++;
    }
    setEinladungLaedt(false);
    setEinladungHinweis(txt.updateEinladenErgebnisTemplate.replace("{n}", String(angelegt)));
    ladeMailStatus();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
        {(
          [
            { id: "uebersicht", label: txt.untertabUebersicht, badge: 0, icon: <LayoutList size={14} /> },
            { id: "mitteilungen", label: txt.untertabMitteilungen, badge: 0, icon: <Send size={14} /> },
            { id: "zuordnung", label: txt.untertabZuordnung, badge: nichtZugeordnete.length + nichtZugeordneteVertraege.length, icon: <Upload size={14} /> },
          ] as { id: typeof unterTab; label: string; badge: number; icon: React.ReactNode }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setUnterTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
              unterTab === t.id
                ? "bg-[var(--bg-surface)] text-[var(--text-strong)] shadow-sm"
                : "text-[var(--text-faint)] hover:text-[var(--text-soft)]"
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {unterTab === "zuordnung" && (
        <>
      <ImportStandKarte stand={importStand} />
      <DongleImport organisationId={organisationId} onImportiert={alleNeuLaden} />

      {nichtZugeordnete.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--border-input)] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            {txt.nichtZugeordneteLizenzenTemplate.replace("{gefiltert}", String(gefilterteNichtZugeordnete.length)).replace("{gesamt}", String(nichtZugeordnete.length))}
          </p>
          <input
            type="text"
            value={filterDongleNummer}
            onChange={(e) => setFilterDongleNummer(e.target.value)}
            placeholder={txt.seriennummerFilterPlatzhalter}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
          />
          {gefilterteNichtZugeordnete.length === 0 && (
            <p className="text-xs text-[var(--text-faint)]">{txt.keineTrefferFilter}</p>
          )}
          <div className="space-y-1.5">
            {sichtbareNichtZugeordnete.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
              >
                <span className="font-mono text-xs text-[var(--text-strong)]">{d.seriennummer}</span>
                <button
                  onClick={() => seriennummerKopieren(d.id, d.seriennummer)}
                  title={dongleTxt.seriennummerKopieren}
                  className="text-[var(--text-faint)] hover:text-akzent"
                >
                  {kopiertId === d.id ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <span className="text-xs text-[var(--text-faint)]">· {d.software}</span>
                {d.gruppe && <span className="text-xs text-[var(--text-faint)]">({d.gruppe})</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <select
                    value={zuweisenAn[d.id] ?? ""}
                    onChange={(e) => setZuweisenAn((z) => ({ ...z, [d.id]: e.target.value }))}
                    className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-strong)]"
                  >
                    <option value="">{txt.kundeWaehlen}</option>
                    {kunden.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name ?? txt.unbenannt}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => dongleZuweisen(d.id)}
                    disabled={!zuweisenAn[d.id]}
                    className="shrink-0 rounded bg-akzent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {txt.zuweisen}
                  </button>
                  <button
                    onClick={() => dongleLoeschen(d.id, d.seriennummer)}
                    title={dongleTxt.dongleLoeschen}
                    className="shrink-0 text-[var(--text-faint)] hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!dongleSuchtAktiv && gefilterteNichtZugeordnete.length > ANZAHL_POOL_SICHTBAR && (
            <button
              onClick={() => setAlleDonglesPoolAnzeigen((v) => !v)}
              className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            >
              {alleDonglesPoolAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(gefilterteNichtZugeordnete.length))}
            </button>
          )}
        </div>
      )}

      {nichtZugeordneteVertraege.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--border-input)] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            {txt.nichtZugeordneteVertraegeTemplate.replace("{gefiltert}", String(gefilterteNichtZugeordneteVertraege.length)).replace("{gesamt}", String(nichtZugeordneteVertraege.length))}
          </p>
          <input
            type="text"
            value={filterVertragNummer}
            onChange={(e) => setFilterVertragNummer(e.target.value)}
            placeholder={txt.seriennummerFilterPlatzhalter}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
          />
          {gefilterteNichtZugeordneteVertraege.length === 0 && (
            <p className="text-xs text-[var(--text-faint)]">{txt.keineTrefferFilter}</p>
          )}
          <div className="space-y-1.5">
            {sichtbareNichtZugeordneteVertraege.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
              >
                <span className="font-mono text-xs text-[var(--text-strong)]">{v.lizenz_seriennummer}</span>
                <span className="text-xs text-[var(--text-faint)]">· {v.produkt_name}</span>
                {v.vertrag_ende && (
                  <span className="text-xs text-[var(--text-faint)]">
                    ({txt.bisPrefix} {new Date(v.vertrag_ende).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")})
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <select
                    value={zuweisenAnVertrag[v.id] ?? ""}
                    onChange={(e) => setZuweisenAnVertrag((z) => ({ ...z, [v.id]: e.target.value }))}
                    className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-strong)]"
                  >
                    <option value="">{txt.kundeWaehlen}</option>
                    {kunden.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name ?? txt.unbenannt}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => vertragZuweisen(v.id)}
                    disabled={!zuweisenAnVertrag[v.id]}
                    className="shrink-0 rounded bg-akzent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {txt.zuweisen}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!vertragSuchtAktiv && gefilterteNichtZugeordneteVertraege.length > ANZAHL_POOL_SICHTBAR && (
            <button
              onClick={() => setAlleVertraegePoolAnzeigen((v) => !v)}
              className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            >
              {alleVertraegePoolAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(gefilterteNichtZugeordneteVertraege.length))}
            </button>
          )}
        </div>
      )}
        </>
      )}

      {unterTab === "uebersicht" && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KennzahlKarte
            label={txt.kennzahlDongles}
            wert={alleDongles.length}
            hinweis={donglesProSoftware}
            hinweisUmbrechen
            farbe="blau"
            icon={<KeyRound size={18} />}
            onClick={donglesKachelWaehlen}
          />
          <KennzahlKarte
            label={txt.kennzahlNichtZugeordnet}
            wert={nichtZugeordnete.length + nichtZugeordneteVertraege.length}
            hinweis={txt.kennzahlNichtZugeordnetHinweisTemplate
              .replace("{d}", String(nichtZugeordnete.length))
              .replace("{v}", String(nichtZugeordneteVertraege.length))}
            farbe={nichtZugeordnete.length + nichtZugeordneteVertraege.length > 0 ? "amber" : "gruen"}
            icon={<Link2Off size={18} />}
            onClick={() => setUnterTab("zuordnung")}
          />
          <KennzahlKarte
            label={txt.kennzahlLaeuftAb}
            wert={bald.length}
            hinweis={txt.kennzahlLaeuftAbHinweis}
            farbe={bald.length > 0 ? "amber" : "neutral"}
            icon={<CalendarClock size={18} />}
            onClick={() => vertragKachelWaehlen("bald")}
            aktiv={vertragKachel === "bald"}
          />
          <KennzahlKarte
            label={txt.kennzahlRenewalOffen}
            wert={baldOffen.length}
            hinweis={txt.kennzahlRenewalOffenHinweis}
            farbe={baldOffen.length > 0 ? "rot" : "gruen"}
            icon={<Wallet size={18} />}
            onClick={() => vertragKachelWaehlen("renewal")}
            aktiv={vertragKachel === "renewal"}
          />
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <KennzahlKarte
              label={txt.kennzahlImport}
              wert={
                importStand.dongle || importStand.lizenz
                  ? importWert([importStand.dongle?.am, importStand.lizenz?.am].filter(Boolean).sort().reverse()[0] ?? null)
                  : txt.importNie
              }
              hinweis={txt.kennzahlImportHinweisTemplate
                .replace("{d}", kurzDatum(importStand.dongle))
                .replace("{l}", kurzDatum(importStand.lizenz))}
              hinweisUmbrechen
              farbe={
                importStand.dongle && importStand.lizenz
                  ? importFarbe([importStand.dongle.am, importStand.lizenz.am].sort()[0])
                  : "rot"
              }
              icon={<RefreshCw size={18} />}
              onClick={() => setUnterTab("zuordnung")}
            />
          </div>
        </div>
      )}

      {unterTab === "uebersicht" && (
      <div ref={donglesKarteRef} className="scroll-mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">
          {txt.alleDonglesTemplate.replace("{n}", String(alleDongles.length))}
        </h3>
        <input
          type="text"
          value={dongleUebersichtSuche}
          onChange={(e) => setDongleUebersichtSuche(e.target.value)}
          placeholder={txt.sucheSeriennummerOderKunde}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-1.5 text-sm text-[var(--text-strong)]"
        />
        <select
          value={softwareFilter}
          onChange={(e) => setSoftwareFilter(e.target.value)}
          className="rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
        >
          <option value="">{txt.softwareFilterAlle}</option>
          {verfuegbareSoftware.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {dongleUebersichtGefiltert.length === 0 ? (
          <p className="text-xs text-[var(--text-faint)]">{txt.keineTreffer}</p>
        ) : (
          <div className="space-y-1">
            {sichtbareDongleUebersicht.map((d) => (
              <div key={d.id}>
              <div
                onClick={(e) => zeilenKlick(e, () => setOffenerDongleId((id) => (id === d.id ? null : d.id)))}
                title={detailTxt.detailsTitel}
                aria-expanded={offenerDongleId === d.id}
                className={`flex cursor-pointer flex-wrap items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors hover:bg-[var(--border)] ${
                  offenerDongleId === d.id ? "bg-[var(--border)]" : "bg-[var(--bg-muted)]"
                }`}
              >
                {offenerDongleId === d.id ? (
                  <ChevronDown size={14} className="text-[var(--text-faint)]" />
                ) : (
                  <ChevronRight size={14} className="text-[var(--text-faint)]" />
                )}
                <span className="font-mono text-xs text-[var(--text-strong)]">{d.seriennummer}</span>
                <button
                  onClick={() => seriennummerKopieren(d.id, d.seriennummer)}
                  title={dongleTxt.seriennummerKopieren}
                  className="text-[var(--text-faint)] hover:text-akzent"
                >
                  {kopiertId === d.id ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <select
                  value={d.software}
                  onChange={(e) => softwareAendern(d.id, e.target.value)}
                  title={txt.softwareAendernTitle}
                  style={softwareStil(d.software)}
                  className="rounded-full border border-transparent px-2 py-0.5 text-xs font-medium"
                >
                  {verfuegbareSoftware.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span
                  className={`ml-auto text-xs ${
                    d.kunde?.name ? "text-[var(--text-soft)]" : "italic text-[var(--text-faint)]"
                  }`}
                >
                  {d.kunde?.name ?? txt.nichtZugeordnet}
                </span>
                <button
                  onClick={() => dongleLoeschen(d.id, d.seriennummer)}
                  title={dongleTxt.dongleLoeschen}
                  className="text-[var(--text-faint)] hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {offenerDongleId === d.id && (
                <DongleDetailPanel
                  dongle={d as DetailDongle}
                  vertraege={alleVertraege.filter(
                    (v) =>
                      v.dongle_id === d.id ||
                      (!v.dongle_id && v.lizenz_seriennummer.toUpperCase().startsWith(`${d.seriennummer.toUpperCase()}-`)),
                  ) as DetailVertrag[]}
                  onRenewalUmschalten={renewalBezahltUmschalten}
                />
              )}
              </div>
            ))}
          </div>
        )}
        {!dongleUebersichtSuchtAktiv && dongleUebersichtGefiltert.length > ANZAHL_UEBERSICHT_SICHTBAR && (
          <button
            onClick={() => setDongleUebersichtAlleAnzeigen((v) => !v)}
            className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
          >
            {dongleUebersichtAlleAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(dongleUebersichtGefiltert.length))}
          </button>
        )}
      </div>

      )}

      {unterTab === "mitteilungen" && (
        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <select
              value={nachrichtSoftware}
              onChange={(e) => setNachrichtSoftware(e.target.value)}
              className="rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm text-[var(--text-strong)]"
            >
              <option value="">{txt.mitteilungSoftwareWaehlen}</option>
              {verfuegbareSoftware.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {!nachrichtSoftware && <LeerHinweis icon={<Send size={18} />} titel={txt.mitteilungHinweis} />}
            {nachrichtSoftware && nachrichtEmpfaenger.length === 0 && (
              <p className="text-xs text-[var(--text-faint)]">{txt.mitteilungKeineEmpfaenger}</p>
            )}
            {nachrichtSoftware && nachrichtEmpfaenger.length > 0 && (
              <ProduktNachricht
                key={nachrichtSoftware}
                organisationId={organisationId}
                software={nachrichtSoftware}
                empfaenger={nachrichtEmpfaenger}
                onVersendet={() => setNachrichtenRefresh((n) => n + 1)}
              />
            )}
          </div>
          <GesendeteNachrichten organisationId={organisationId} refreshKey={nachrichtenRefresh} />
        </div>
      )}

      {unterTab === "uebersicht" && (
      <div ref={vertraegeKarteRef} className="scroll-mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-2">
        <h3 className="text-sm font-medium text-[var(--text-strong)]">
          {txt.alleLizenzvertraegeTemplate.replace("{n}", String(alleVertraege.length))}
        </h3>
        {vertragKachel && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-faint)]">{txt.kachelFilterLabel}:</span>
            <button
              onClick={() => setVertragKachel(null)}
              title={txt.filterAufheben}
              className="inline-flex items-center gap-1.5 rounded-full border border-akzent bg-akzent-soft px-3 py-1 text-xs font-medium text-akzent"
            >
              {vertragKachel === "bald" ? txt.kennzahlLaeuftAb : txt.kennzahlRenewalOffen} ({vertragUebersichtGefiltert.length}) ✕
            </button>
          </div>
        )}
        <input
          type="text"
          value={vertragUebersichtSuche}
          onChange={(e) => setVertragUebersichtSuche(e.target.value)}
          placeholder={txt.sucheSeriennummerProduktKunde}
          className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-1.5 text-sm text-[var(--text-strong)]"
        />
        {verfuegbareBuilds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={buildFilter}
              onChange={(e) => setBuildFilter(e.target.value)}
              className="rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
            >
              <option value="">{txt.buildFilterAlle}</option>
              {verfuegbareBuilds.map((b) => (
                <option key={b} value={b}>
                  {txt.buildFilterLabelTemplate.replace("{build}", b)}
                </option>
              ))}
            </select>
            {buildFilter && einladbareKunden.length > 0 && (
              <button
                onClick={updateEinladungenVersenden}
                disabled={einladungLaedt}
                className="rounded bg-akzent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {einladungLaedt
                  ? txt.updateEinladenLaedt
                  : txt.updateEinladenButtonTemplate.replace("{n}", String(einladbareKunden.length))}
              </button>
            )}
          </div>
        )}
        {einladungHinweis && <p className="text-xs text-[var(--text-soft)]">{einladungHinweis}</p>}
        {vertragUebersichtGefiltert.length === 0 ? (
          <p className="text-xs text-[var(--text-faint)]">{txt.keineTreffer}</p>
        ) : (
          <div className="space-y-1">
            {sichtbareVertragUebersicht.map((v) => (
              <div key={v.id}>
              <div
                onClick={(e) => zeilenKlick(e, () => setOffenerVertragId((id) => (id === v.id ? null : v.id)))}
                title={detailTxt.detailsTitel}
                aria-expanded={offenerVertragId === v.id}
                className={`flex cursor-pointer flex-col gap-2 rounded px-3 py-2 text-sm transition-colors hover:bg-[var(--border)] md:flex-row md:items-center md:gap-3 ${
                  offenerVertragId === v.id ? "bg-[var(--border)]" : "bg-[var(--bg-muted)]"
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {offenerVertragId === v.id ? (
                      <ChevronDown size={14} className="self-center text-[var(--text-faint)]" />
                    ) : (
                      <ChevronRight size={14} className="self-center text-[var(--text-faint)]" />
                    )}
                    <span className="font-mono text-xs text-[var(--text-strong)]">{v.lizenz_seriennummer}</span>
                    <span className="text-xs text-[var(--text-faint)]">· {v.produkt_name}</span>
                    {v.status && <span className="text-xs text-[var(--text-faint)]">({v.status})</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {v.aktuelle_engine_build && v.aktuelle_engine_build !== "null" && (
                      <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--text-soft)]">
                        {txt.buildLabel} {v.aktuelle_engine_build}
                      </span>
                    )}
                    {v.vertrag_ende && (() => {
                      const a = ablaufInfo(v.vertrag_ende);
                      const datum = new Date(v.vertrag_ende).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE");
                      const stil =
                        a.farbe === "rot"
                          ? { background: "var(--badge-kritisch-bg)", color: "var(--badge-kritisch-text)" }
                          : a.farbe === "amber"
                            ? { background: "var(--badge-hoch-bg)", color: "var(--badge-hoch-text)" }
                            : undefined;
                      return (
                        <span
                          style={stil}
                          className={`rounded-full px-1.5 py-0.5 text-[0.65rem] ${stil ? "font-medium" : "text-[var(--text-faint)]"}`}
                        >
                          {txt.bisPrefix} {datum}
                          {a.farbe === "rot" && ` · ${txt.ablaufAbgelaufen}`}
                          {a.farbe === "amber" && ` · ${txt.ablaufInTagenTemplate.replace("{n}", String(a.tage))}`}
                        </span>
                      );
                    })()}
                    <button
                      onClick={() => renewalBezahltUmschalten(v.id, v.renewal_bezahlt)}
                      title={dongleTxt.renewalBezahltHinweis}
                      className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium ${
                        v.renewal_bezahlt
                          ? "bg-[var(--status-geloest-bg)] text-[var(--status-geloest-text)]"
                          : !v.status || v.status.toLowerCase() === "active"
                            ? "bg-[var(--badge-kritisch-bg)] text-[var(--badge-kritisch-text)]"
                            : "bg-[var(--bg-surface)] text-[var(--text-faint)]"
                      }`}
                    >
                      {v.renewal_bezahlt ? dongleTxt.renewalBezahlt : dongleTxt.renewalOffen}
                    </button>
                    {v.kunde_id && mailStatusByKunde[v.kunde_id] && (
                      <span
                        title={`${mailTxt.mailGesendetPrefix} ${new Date(mailStatusByKunde[v.kunde_id].gesendet_am).toLocaleString(sprache === "en" ? "en-US" : "de-DE")}`}
                        className={`rounded px-1.5 py-0.5 text-[0.65rem] font-medium ${
                          mailStatusByKunde[v.kunde_id].geoeffnet_am
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-[var(--bg-surface)] text-[var(--text-faint)]"
                        }`}
                      >
                        📧{" "}
                        {mailStatusByKunde[v.kunde_id].geoeffnet_am
                          ? `${mailTxt.mailGeoeffnetPrefix} ${new Date(mailStatusByKunde[v.kunde_id].geoeffnet_am!).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")}`
                          : mailTxt.mailNochNichtGeoeffnet}
                      </span>
                    )}
                  </div>
                </div>
                <select
                  value={v.kunde_id ?? ""}
                  onChange={(e) => vertragKundeAendern(v, e.target.value)}
                  title={txt.zuordnungAendernTitle}
                  className={`w-full shrink-0 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs md:w-56 ${
                    v.kunde_id ? "text-[var(--text-soft)]" : "italic text-[var(--text-faint)]"
                  }`}
                >
                  <option value="">{v.kunde_id ? txt.zuordnungAufheben : txt.nichtZugeordnet}</option>
                  {kunden.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name ?? txt.unbenannt}
                    </option>
                  ))}
                </select>
              </div>
              {offenerVertragId === v.id && (() => {
                const verknuepft = v.dongle_id ? (alleDongles.find((d) => d.id === v.dongle_id) ?? null) : null;
                const praefix = v.lizenz_seriennummer.split("-")[0].toUpperCase();
                const passend = verknuepft ? null : (alleDongles.find((d) => d.seriennummer.toUpperCase() === praefix) ?? null);
                return (
                  <VertragDetailPanel
                    vertrag={v as DetailVertrag}
                    dongle={verknuepft as DetailDongle | null}
                    passenderDongle={passend as DetailDongle | null}
                  />
                );
              })()}
              </div>
            ))}
          </div>
        )}
        {!vertragUebersichtSuchtAktiv && vertragUebersichtGefiltert.length > ANZAHL_UEBERSICHT_SICHTBAR && (
          <button
            onClick={() => setVertragUebersichtAlleAnzeigen((v) => !v)}
            className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
          >
            {vertragUebersichtAlleAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(vertragUebersichtGefiltert.length))}
          </button>
        )}
      </div>
      )}
    </div>
  );
}
