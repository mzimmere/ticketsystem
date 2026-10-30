import { useState, type ReactNode } from "react";
import { FileText, Zap, Tag, Timer, Mail, CircleHelp, Cpu, FolderOpen, ShieldCheck, Handshake, CalendarClock, Download } from "lucide-react";
import VorlagenVerwaltung from "../VorlagenVerwaltung";
import MakroVerwaltung from "../MakroVerwaltung";
import TagVerwaltung from "../TagVerwaltung";
import WartungsvertragStufenVerwaltung from "../WartungsvertragStufenVerwaltung";
import SubresellerVerwaltung from "../SubresellerVerwaltung";
import SlaVerwaltung from "../SlaVerwaltung";
import LizenzVerlaengerungen from "../LizenzVerlaengerungen";
import HardwareKategorienVerwaltung from "../HardwareKategorienVerwaltung";
import DokumentKategorienVerwaltung from "../DokumentKategorienVerwaltung";
import FaqVerwaltung from "../FaqVerwaltung";
import ReportingExport from "../ReportingExport";
import EmailTexteVerwaltung from "../EmailTexteVerwaltung";
import KonfigurationsHilfe from "../KonfigurationsHilfe";
import { useSprache } from "../../lib/SpracheContext";
import { texte } from "../../lib/uebersetzungen";

type WerkzeugId =
  | "vorlagen" | "makros" | "tags" | "sla" | "emailtexte" | "faq"
  | "hardware" | "dokumente" | "wartung" | "subreseller" | "lizenzerinnerung"
  | "export";

const ICONS: Record<WerkzeugId, ReactNode> = {
  vorlagen: <FileText size={14} />,
  makros: <Zap size={14} />,
  tags: <Tag size={14} />,
  sla: <Timer size={14} />,
  emailtexte: <Mail size={14} />,
  faq: <CircleHelp size={14} />,
  hardware: <Cpu size={14} />,
  dokumente: <FolderOpen size={14} />,
  wartung: <ShieldCheck size={14} />,
  subreseller: <Handshake size={14} />,
  lizenzerinnerung: <CalendarClock size={14} />,
  export: <Download size={14} />,
};

const GRUPPEN: { gruppe: "ticketsSupport" | "kundenVertraege" | "auswertung"; items: WerkzeugId[] }[] = [
  { gruppe: "ticketsSupport", items: ["vorlagen", "makros", "tags", "sla", "emailtexte", "faq"] },
  { gruppe: "kundenVertraege", items: ["hardware", "dokumente", "wartung", "subreseller", "lizenzerinnerung"] },
  { gruppe: "auswertung", items: ["export"] },
];

export default function WerkzeugeTab({
  organisationId,
  slug,
}: {
  organisationId: string;
  slug?: string | null;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).werkzeugeNav;
  const [aktiv, setAktiv] = useState<WerkzeugId>("vorlagen");

  return (
    <div className="space-y-4 md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:items-start md:gap-5 md:space-y-0">
      <nav className="hidden space-y-4 md:block">
        {GRUPPEN.map((g) => (
          <div key={g.gruppe} className="space-y-0.5">
            <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              {txt.gruppen[g.gruppe]}
            </p>
            {g.items.map((id) => (
              <button
                key={id}
                onClick={() => setAktiv(id)}
                className={`flex w-full items-center gap-2 rounded-lg border-l-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  aktiv === id
                    ? "border-akzent bg-[var(--bg-muted)] font-medium text-[var(--text-strong)]"
                    : "border-transparent text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                }`}
              >
                <span className={aktiv === id ? "text-akzent" : "text-[var(--text-faint)]"}>{ICONS[id]}</span>
                {txt.items[id]}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <select
        value={aktiv}
        onChange={(e) => setAktiv(e.target.value as WerkzeugId)}
        className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)] md:hidden"
      >
        {GRUPPEN.map((g) => (
          <optgroup key={g.gruppe} label={txt.gruppen[g.gruppe]}>
            {g.items.map((id) => (
              <option key={id} value={id}>
                {txt.items[id]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="min-w-0">
      {aktiv === "vorlagen" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <VorlagenVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Ticket-Vorlagen verwenden"
            schritte={[
              { nr: 1, titel: "Vorlage anlegen", beschreibung: "Name, vorausgefüllten Titel, Beschreibung und Priorität eingeben. Typische Vorlagen: 'VPN-Problem', 'Drucker offline', 'Passwort zurücksetzen'." },
              { nr: 2, titel: "Beim neuen Ticket auswählen", beschreibung: "Wenn ein Techniker oder Kunde ein neues Ticket anlegt, erscheint oben ein '📋 Vorlage auswählen…'-Dropdown. Nach der Auswahl werden Titel, Beschreibung und Priorität vorausgefüllt – alles bleibt danach bearbeitbar." },
              { nr: 3, titel: "Spart Zeit bei Standardproblemen", beschreibung: "Für wiederkehrende Anfragen (Onboarding neuer Mitarbeiter, regelmäßige Wartungen) die immer gleiche Checkliste vorbereiten." },
            ]}
          />
        </div>
      )}

      {aktiv === "makros" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <MakroVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Makros (Textbausteine) verwenden"
            schritte={[
              { nr: 1, titel: "Makro anlegen", beschreibung: "Einen Titel (z.B. 'Passwort zurückgesetzt') und den fertig formulierten Antworttext eingeben. Mehrere Makros für häufige Situationen anlegen." },
              { nr: 2, titel: "Im Ticket einfügen", beschreibung: "Im Ticket-Verlauf erscheint über dem Antwortfeld ein '📋 Makro einfügen…'-Dropdown. Auswahl fügt den Text direkt ins Antwortfeld ein – danach noch personalisieren und senden." },
            ]}
            hinweis="Makros unterscheiden sich von Vorlagen: Vorlagen füllen ein neues Ticket vor, Makros fügen Text ins Antwortfeld eines bestehenden Tickets ein."
          />
        </div>
      )}

      {aktiv === "tags" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <TagVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Tags / Kategorien verwenden"
            schritte={[
              { nr: 1, titel: "Tags anlegen", beschreibung: "Name und Farbe wählen. Sinnvolle Tags: Hardware, Software, Netzwerk, Drucker, Passwort, Onboarding, Dringend." },
              { nr: 2, titel: "Tickets taggen", beschreibung: "Im Ticket-Detail gibt es einen '+ Tag'-Button. Mehrere Tags pro Ticket möglich. Tags sind auch für Kunden sichtbar." },
              { nr: 3, titel: "In der Übersicht filtern", beschreibung: "In der Ticket-Übersicht erscheinen alle vergebenen Tags als Filter-Buttons. Klick auf einen Tag zeigt nur Tickets mit diesem Tag." },
            ]}
          />
        </div>
      )}

      {aktiv === "hardware" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <HardwareKategorienVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Kunden-Hardware erfassen"
            schritte={[
              { nr: 1, titel: "Kategorien anlegen", beschreibung: "Z.B. Intraoral-Scanner, Desktop-Scanner, Exocad-Datenbank (lokal/SQL-Server), Fräsmaschine, Drucker. Ganz nach eurem Bedarf." },
              { nr: 2, titel: "Beim Kunden oder im Ticket erfassen", beschreibung: "In der Kundenliste und direkt im Ticket lässt sich pro Kategorie ein Wert per Klick aus bereits verwendeten Vorschlägen übernehmen oder frei eintippen." },
              { nr: 3, titel: "Mehrfachwerte möglich", beschreibung: "Ein Kunde kann z.B. zwei Fräsmaschinen unterschiedlicher Hersteller haben – einfach beide als eigene Chips hinzufügen." },
            ]}
          />
        </div>
      )}

      {aktiv === "dokumente" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <DokumentKategorienVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Kunden-Dokumente kategorisieren"
            schritte={[
              { nr: 1, titel: "Kategorien anlegen", beschreibung: "Z.B. Wartungsvertrag, Rechnung, Datenschutz, Sonstiges. Auf den Namen klicken, um ihn nachträglich umzubenennen." },
              { nr: 2, titel: "Beim Hochladen zuordnen", beschreibung: "In der Kundenverwaltung wird vor dem Datei-Upload eine Kategorie ausgewählt (optional)." },
              { nr: 3, titel: "Nachträglich ändern", beschreibung: "Jedes bereits hochgeladene Dokument kann per Dropdown einer anderen Kategorie zugeordnet oder unkategorisiert belassen werden." },
            ]}
          />
        </div>
      )}

      {aktiv === "wartung" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <WartungsvertragStufenVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Wartungsvertrag-Stufen einrichten"
            schritte={[
              { nr: 1, titel: "Stufen anlegen", beschreibung: "Bis zu 3 Ausbaustufen definieren (z.B. 'Basis', 'Premium', 'Enterprise') – ganz nach eurem eigenen Vertragsmodell." },
              { nr: 2, titel: "Kunden zuordnen", beschreibung: "In der Kundenliste bei jedem Kunden festlegen: zahlt er den Minutenpreis (Standard) oder hat er eine der Vertragsstufen?" },
              { nr: 3, titel: "Im Ticket sichtbar", beschreibung: "Der Status wird direkt im Ticket als farbiges Label angezeigt, damit sofort klar ist, ob und wie der Kunde für den Service bezahlt." },
            ]}
          />
        </div>
      )}

      {aktiv === "subreseller" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <SubresellerVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Subreseller einrichten"
            schritte={[
              { nr: 1, titel: "Subreseller anlegen", beschreibung: "Name und E-Mail-Adresse der Firma, die eure Dongles weiterverkauft und deren Endkunden betreut." },
              { nr: 2, titel: "Kunden zuordnen", beschreibung: "In der Kundenverwaltung bei jedem betroffenen Kunden den Subreseller auswählen (optional, Standard: direkt)." },
              { nr: 3, titel: "Automatische Mails", beschreibung: "Ticket-Status/-Antwort- und Lizenz-Update-Mails gehen dann nur noch an den Subreseller, der Endkunde erhält nichts mehr direkt von euch." },
            ]}
          />
        </div>
      )}

      {aktiv === "sla" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <SlaVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="SLA & Automatisierung konfigurieren"
            schritte={[
              { nr: 1, titel: "Reaktionszeiten festlegen", beschreibung: "Für jede Priorität (Niedrig bis Kritisch) eine Reaktionszeit (erste Antwort) und Lösungszeit in Stunden eingeben. Beispiel: Kritisch = 1h Reaktion / 4h Lösung." },
              { nr: 2, titel: "SLA aktivieren", beschreibung: "Checkbox 'SLA-Fristen aktiv' einschalten. Ab sofort bekommen neue Tickets automatisch Fälligkeitsdaten berechnet – direkt beim Anlegen." },
              { nr: 3, titel: "Überfällige Tickets erkennen", beschreibung: "Im Ticket-Detail erscheint ein roter Hinweis wenn die Reaktions- oder Lösungsfrist überschritten ist." },
              { nr: 4, titel: "Auto-Schließen (optional)", beschreibung: "Anzahl Tage eintragen, nach denen ein Ticket im Status 'Wartet auf Kunde' automatisch geschlossen wird. Leer lassen = deaktiviert. Läuft täglich um 02:00 Uhr." },
            ]}
            hinweis="SLA-Fristen gelten nur für Tickets die nach der Aktivierung erstellt werden – bestehende Tickets bleiben unverändert."
          />
        </div>
      )}

      {aktiv === "lizenzerinnerung" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <LizenzVerlaengerungen organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Lizenz-Ablauf-Erinnerungen"
            schritte={[
              { nr: 1, titel: "Frist einstellen", beschreibung: "Anzahl Tage vor Vertragsende festlegen, ab wann eine Lizenz als 'bald fällig' gilt und eine Erinnerungs-Mail auslöst." },
              { nr: 2, titel: "Lizenzverträge importieren", beschreibung: "Über den Import-Button in der Kundenliste den exocad 'license_history'-Export hochladen. Neue Verträge landen zunächst unzugeordnet und werden dort einem Kunden zugewiesen." },
              { nr: 3, titel: "Nur Hinweis, keine Rechnung", beschreibung: "Das System verschickt ausschließlich eine Erinnerungs-Mail an Org-Admins. Rechnung/Verlängerung wird weiterhin manuell in der Abrechnung erstellt." },
            ]}
          />
        </div>
      )}

      {aktiv === "faq" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <FaqVerwaltung organisationId={organisationId} slug={slug} />
          <KonfigurationsHilfe
            titel="FAQ / Wissensdatenbank befüllen"
            schritte={[
              { nr: 1, titel: "Einträge anlegen", beschreibung: "Häufig gestellte Fragen mit Antwort, optionaler Kategorie und öffentlich/intern-Kennzeichnung anlegen. Öffentliche Einträge sind für Kunden sichtbar, interne nur für dein Team." },
              { nr: 2, titel: "Kategorien nutzen", beschreibung: "Einfach im Kategorie-Feld einen Namen eintippen (z.B. 'Passwörter', 'Hardware', 'Software'). Kunden können nach Kategorie filtern." },
              { nr: 3, titel: "Öffentlicher Link", beschreibung: "Falls ein Firmen-Slug hinterlegt ist, gibt es oben einen kopierbaren Link zur öffentlichen FAQ-Seite – zum Einbinden auf der eigenen Website." },
              { nr: 4, titel: "Kunden entlasten", beschreibung: "Gute FAQ reduziert Ticket-Volumen deutlich. Faustregel: die häufigsten 10 Fragen der letzten 3 Monate als Startpunkt nehmen." },
            ]}
          />
        </div>
      )}

      {aktiv === "emailtexte" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">E-Mail-Texte</h3>
          <EmailTexteVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Automatische E-Mails anpassen"
            schritte={[
              { nr: 1, titel: "Text öffnen", beschreibung: "Auf eine der Mails klicken (z.B. 'Ticket geschlossen (mit Bewertung)'), um Betreff und Text zu bearbeiten." },
              { nr: 2, titel: "Platzhalter verwenden", beschreibung: "Werte wie {{kunde_name}} oder {{ticket_nr}} werden beim Versand automatisch durch die echten Werte ersetzt. Welche Platzhalter zur Verfügung stehen, steht direkt über dem Textfeld." },
              { nr: 3, titel: "Zurücksetzen jederzeit möglich", beschreibung: "Mit 'Auf Standard zurücksetzen' wird wieder der ursprüngliche Systemtext verwendet." },
            ]}
            hinweis="Ohne eigene Anpassung wird automatisch der Standardtext verschickt - hier ändert sich also nichts, solange nichts bearbeitet wird."
          />
        </div>
      )}

      {aktiv === "export" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <ReportingExport organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Daten exportieren und nutzen"
            schritte={[
              { nr: 1, titel: "Zeitraum wählen", beschreibung: "Von/Bis-Datum einstellen. Tipp: für Monatsberichte immer den 1. bis letzten des Monats wählen." },
              { nr: 2, titel: "Tickets-Export", beschreibung: "Enthält alle Tickets mit Status, Priorität, SLA-Fälligkeiten, CSAT-Bewertung, Kunde und Techniker. Ideal für Monatsberichte an Kunden." },
              { nr: 3, titel: "Zeiterfassungs-Export", beschreibung: "Alle Zeiteinträge mit Minuten, Stunden (dezimal), Beschreibung und Ticket-Zuordnung. Direkt in Excel für die Abrechnung nutzbar." },
              { nr: 4, titel: "CSV in Excel öffnen", beschreibung: "Datei per Doppelklick öffnen oder in Excel via Daten → Aus Text/CSV importieren. Der Export ist UTF-8-kodiert mit Komma als Trennzeichen." },
            ]}
            hinweis="Alle Exporte enthalten eine UTF-8-BOM-Markierung, damit Excel deutsche Umlaute (ä, ö, ü) korrekt anzeigt."
          />
        </div>
      )}
      </div>
    </div>
  );
}
