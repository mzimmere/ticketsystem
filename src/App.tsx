import { useState, useEffect } from "react";
import { Sun, Moon, User, Settings, Building2, Receipt, Mail, Ticket as TicketIcon, BarChart2, Landmark } from "lucide-react";
import { useProfil } from "./lib/useProfil";
import { useTheme } from "./lib/useTheme";
import { useOnlinePraesenz } from "./lib/praesenz";
import { supabase } from "./lib/supabaseClient";
import Login from "./components/Login";
import NeuesTicket from "./components/NeuesTicket";
import MeineTickets from "./components/MeineTickets";
import MeinTicketDetail from "./components/MeinTicketDetail";
import TicketUebersicht from "./components/TicketUebersicht";
import TicketDetail from "./components/TicketDetail";
import MeinProfil from "./components/MeinProfil";
import Verwaltung from "./components/Verwaltung";
import SuperAdminUebersicht from "./components/SuperAdminUebersicht";
import FirmenInfo from "./components/FirmenInfo";
import Abrechnung from "./components/Abrechnung";
import RechnungDetail from "./components/RechnungDetail";
import AdminPostfach from "./components/AdminPostfach";
import Dashboard from "./components/Dashboard";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import Startseite from "./components/Startseite";
import KundenRegistrierung from "./components/KundenRegistrierung";
import DatenschutzSeite from "./components/DatenschutzSeite";
import FaqOeffentlich from "./components/FaqOeffentlich";
import ZugangsBestaetigen from "./components/ZugangsBestaetigen";
import Changelog from "./components/Changelog";
import HowTo, { howToAlsGesehenMarkieren } from "./components/HowTo";
import PlattformAbrechnung from "./components/PlattformAbrechnung";

function neukundeSlug(): string | null {
  return new URLSearchParams(window.location.search).get("neukunde");
}

function datenschutzSlug(): string | null {
  return new URLSearchParams(window.location.search).get("datenschutz");
}

function faqSlug(): string | null {
  return new URLSearchParams(window.location.search).get("faq");
}

// Zwischenseite fuer Zugangs-/Einladungslinks (siehe ZugangsBestaetigen.tsx) -
// enthaelt den eigentlichen Supabase-Link nur verpackt als Query-Parameter,
// damit Messenger-Vorschau-Bots ihn nicht versehentlich verbrauchen.
function zugangsZiel(): string | null {
  const wert = new URLSearchParams(window.location.search).get("zugang");
  return wert ? decodeURIComponent(wert) : null;
}

interface Organisation {
  name: string;
  logo_url: string | null;
  motto: string | null;
  akzentfarbe: string | null;
  hero_bild_url: string | null;
}

// Erkennt, ob die aktuelle URL von einem Einladungs- oder Passwort-Link kommt
// (Supabase hängt das als Hash- oder Query-Parameter an). In diesem Fall
// MUSS die Person erst ein Passwort setzen, bevor sie in die App darf -
// unabhängig davon, ob technisch schon eine Sitzung existiert.
function kommtVonAuthLink(): boolean {
  const ziel = window.location.hash + window.location.search;
  return (
    ziel.includes("type=invite") ||
    ziel.includes("type=recovery") ||
    ziel.includes("type=signup")
  );
}

function authLinkFehler(): string | null {
  const ziel = window.location.hash + window.location.search;
  const match = ziel.match(/error_description=([^&]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
}

export default function App() {
  const { profil, mitgliedschaften, eingeloggt, laedt, neuLaden } = useProfil();
  const { dunkel, umschalten } = useTheme();
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [ausgewaehltesTicket, setAusgewaehltesTicket] = useState<string | null>(null);
  const [zeigeNeuesTicket, setZeigeNeuesTicket] = useState(false);
  const [zeigeProfil, setZeigeProfil] = useState(false);
  const [zeigeVerwaltung, setZeigeVerwaltung] = useState(false);
  const [superAdminFirma, setSuperAdminFirma] = useState<string | null>(null);
  const [aktiveFirmaId, setAktiveFirmaId] = useState<string | null>(null);
  const [zeigeFirmenInfo, setZeigeFirmenInfo] = useState(false);
  const [zeigeAbrechnung, setZeigeAbrechnung] = useState(false);
  const [zeigePostfach, setZeigePostfach] = useState(false);
  const [zeigeDashboard, setZeigeDashboard] = useState(false);
  const [zeigePlattformAbrechnung, setZeigePlattformAbrechnung] = useState(false);
  const [zeigeStartseite, setZeigeStartseite] = useState(true);
  const [verwaltungsTab, setVerwaltungsTab] = useState<"firma" | "team" | "kunden" | "werkzeuge" | "integrationen">("firma");
  const [ticketFilter, setTicketFilter] = useState<"meine" | "wartend" | "sla-verletzt" | null>(null);
  const [rechnungDetail, setRechnungDetail] = useState<
    { kundeId: string; jahr: number; monat: number } | null
  >(null);

  // Für Super-Admin: sobald eine Firma in "Alle Firmen" ausgewählt wurde,
  // gilt sie als aktiver Kontext für Tickets/Abrechnung/Postfach/Firmeninfo -
  // ohne dass die eigene super_admin-Rolle dafür geändert werden muss.
  // Wer bei mehreren Firmen gleichzeitig Mitglied ist (Mehrfach-
  // Mitgliedschaft), wählt stattdessen über aktiveFirmaId, welche Firma
  // gerade der aktive Kontext ist.
  const aktiveOrgId =
    profil?.rolle === "super_admin"
      ? superAdminFirma
      : mitgliedschaften.length > 0
      ? aktiveFirmaId
      : profil?.organisation_id ?? null;

  const aktiveMitgliedschaft = mitgliedschaften.find((m) => m.organisation_id === aktiveFirmaId) ?? null;

  const onlineIds = useOnlinePraesenz(aktiveOrgId, profil?.id);

  // Sinnvollen Startwert fuer aktiveFirmaId setzen, sobald die
  // Mitgliedschaften geladen sind: bevorzugt die "Home"-Firma aus dem
  // Profil, sonst die erste Mitgliedschaft.
  useEffect(() => {
    if (mitgliedschaften.length === 0) { setAktiveFirmaId(null); return; }
    setAktiveFirmaId((vorher) => {
      if (vorher && mitgliedschaften.some((m) => m.organisation_id === vorher)) return vorher;
      const home = profil?.organisation_id;
      if (home && mitgliedschaften.some((m) => m.organisation_id === home)) return home;
      return mitgliedschaften[0].organisation_id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mitgliedschaften, profil?.organisation_id]);

  // Direkter Sprung zur Ticketübersicht von überall aus, ohne den
  // gewählten Firmenkontext (superAdminFirma) zu verlieren - kein Umweg
  // mehr nötig über "Alle Firmen" und zurück.
  function zurueckZuTickets() {
    setZeigeVerwaltung(false);
    setZeigeAbrechnung(false);
    setRechnungDetail(null);
    setZeigePostfach(false);
    setZeigeFirmenInfo(false);
    setZeigeProfil(false);
    setAusgewaehltesTicket(null);
    setZeigeNeuesTicket(false);
    setZeigeDashboard(false);
    setZeigePlattformAbrechnung(false);
    setZeigeStartseite(true);
  }

  function alleZustandsResets() {
    setZeigeVerwaltung(false);
    setZeigeAbrechnung(false);
    setRechnungDetail(null);
    setZeigePostfach(false);
    setZeigeFirmenInfo(false);
    setZeigeProfil(false);
    setAusgewaehltesTicket(null);
    setZeigeNeuesTicket(false);
    setZeigeDashboard(false);
    setZeigePlattformAbrechnung(false);
    setZeigeStartseite(false);
  }

  function startseitenAktion(aktion: string) {
    alleZustandsResets();
    setTicketFilter(null);
    if (aktion === "tickets") return;
    if (aktion === "tickets-meine") { setTicketFilter("meine"); return; }
    if (aktion === "tickets-wartend") { setTicketFilter("wartend"); return; }
    if (aktion === "tickets-sla-verletzt") { setTicketFilter("sla-verletzt"); return; }
    if (aktion === "neues-ticket") setZeigeNeuesTicket(true);
    if (aktion === "dashboard") setZeigeDashboard(true);
    if (aktion === "abrechnung") setZeigeAbrechnung(true);
    if (aktion === "firmeninfo") setZeigeFirmenInfo(true);
    if (aktion === "verwaltung" || aktion === "verwaltung-firma") { setZeigeVerwaltung(true); setVerwaltungsTab("firma"); }
    if (aktion === "verwaltung-team") { setZeigeVerwaltung(true); setVerwaltungsTab("team"); }
    if (aktion === "verwaltung-kunden") { setZeigeVerwaltung(true); setVerwaltungsTab("kunden"); }
    if (aktion === "verwaltung-werkzeuge") { setZeigeVerwaltung(true); setVerwaltungsTab("werkzeuge"); }
    if (aktion === "verwaltung-integrationen") { setZeigeVerwaltung(true); setVerwaltungsTab("integrationen"); }
  }

  // Beim Firmenwechsel (Super-Admin "Alle Firmen" ODER eigener Firmen-
  // Umschalter bei Mehrfach-Mitgliedschaft) alle offenen Detail-/Auswahl-
  // Zustände zurücksetzen - sonst bliebe z.B. ein offenes Ticket der
  // vorherigen Firma sichtbar.
  useEffect(() => {
    setAusgewaehltesTicket(null);
    setZeigeNeuesTicket(false);
    setRechnungDetail(null);
  }, [superAdminFirma, aktiveFirmaId]);

  useEffect(() => {
    if (aktiveOrgId) {
      supabase
        .from("organisationen")
        .select("name, logo_url, motto, akzentfarbe, hero_bild_url")
        .eq("id", aktiveOrgId)
        .single()
        .then(({ data }) => setOrganisation(data as Organisation));
    } else {
      setOrganisation(null);
    }
  }, [aktiveOrgId]);

  if (laedt) {
    return <div className="p-8 text-sm text-[var(--text-faint)]">Lädt…</div>;
  }

  const zugangZiel = zugangsZiel();
  if (zugangZiel) {
    return <ZugangsBestaetigen ziel={zugangZiel} />;
  }

  const fSlug = faqSlug();
  if (fSlug) {
    return <FaqOeffentlich slug={fSlug} />;
  }

  const dsSlug = datenschutzSlug();
  if (dsSlug) {
    return <DatenschutzSeite slug={dsSlug} />;
  }

  const slug = neukundeSlug();
  if (slug && !eingeloggt) {
    return <KundenRegistrierung slug={slug} />;
  }

  const linkFehler = authLinkFehler();
  if (linkFehler) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8">
        <div className="max-w-sm text-center text-sm">
          <p className="mb-2 font-medium text-[var(--text-strong)]">
            Dieser Link funktioniert nicht (mehr).
          </p>
          <p className="text-[var(--text-soft)]">{linkFehler}</p>
          <p className="mt-2 text-xs text-[var(--text-faint)]">
            Bitte beim Admin einen neuen Link/Zugang anfordern.
          </p>
        </div>
      </div>
    );
  }

  // Wichtig: Diese Prüfung kommt VOR "!eingeloggt", weil ein Einladungs-Link
  // bereits eine Sitzung erzeugt - die Person muss aber zwingend erst ein
  // Passwort setzen, bevor sie in die eigentliche App darf.
  if (kommtVonAuthLink()) {
    return (
      <div className="min-h-screen bg-[var(--bg-muted)]">
        <Login />
      </div>
    );
  }

  if (!eingeloggt) {
    return (
      <div className="min-h-screen bg-[var(--bg-muted)]">
        <Login />
      </div>
    );
  }

  if (!profil) {
    return (
      <div className="p-8 text-sm text-[var(--text-faint)]">
        Eingeloggt, aber kein Profil gefunden. Bitte beim Admin melden.
      </div>
    );
  }

  if (profil.deaktiviert) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8">
        <div className="max-w-sm text-center">
          <p className="mb-4 text-sm text-[var(--text-strong)]">
            Dieser Account wurde deaktiviert. Bitte wende dich an deinen Ansprechpartner, falls das
            ein Irrtum ist.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)]"
          >
            Abmelden
          </button>
        </div>
      </div>
    );
  }

  // Massgeblich ist bei Mehrfach-Mitgliedschaft die Rolle in der gerade
  // aktiven Firma (aktiveMitgliedschaft), nicht mehr profil.rolle global -
  // eine Person kann z.B. bei Firma A Techniker und bei Firma B Org-Admin
  // sein. profil.rolle bleibt nur als "hat ueberhaupt einen internen
  // Zugang" (mitgliedschaften.length > 0) und fuer super_admin relevant.
  const istIntern = profil.rolle === "super_admin" || mitgliedschaften.length > 0;
  const istAdmin = profil.rolle === "super_admin" || aktiveMitgliedschaft?.rolle === "org_admin";

  // Fuer Unterkomponenten, die eine einzelne "Rolle" erwarten (Startseite,
  // Verwaltung, AdminPostfach): die Rolle der gerade aktiven Firma, nicht
  // die globale profil.rolle - sonst wuerde z.B. Org-Admin-Sein bei Firma B
  // ignoriert, weil profil.rolle noch "techniker" von Firma A ist.
  const effektiveRolle = profil.rolle === "super_admin" ? "super_admin" : aktiveMitgliedschaft?.rolle ?? profil.rolle;

  const railItem = (
    key: string,
    aktiv: boolean,
    titel: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <button
      key={key}
      onClick={onClick}
      title={titel}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors active:scale-95 ${
        aktiv
          ? "bg-akzent text-white"
          : "text-[var(--text-soft)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-strong)]"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div
      className="grid min-h-screen grid-cols-[72px_1fr] bg-[var(--bg-muted)]"
      style={{ "--akzent": organisation?.akzentfarbe || "#f59e0b" } as React.CSSProperties}
    >
      {/* Navigation Rail */}
      <nav className="flex flex-col items-center gap-1 border-r border-[var(--border)] bg-[var(--bg-surface)] py-4">
        <button
          onClick={zurueckZuTickets}
          title="Zur Startseite"
          className="mb-3 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-akzent text-sm font-bold text-white transition-transform active:scale-95"
        >
          {organisation?.logo_url ? (
            <img src={organisation.logo_url} alt={organisation.name} className="h-full w-full object-contain" />
          ) : (
            (organisation?.name ?? "IT").slice(0, 2).toUpperCase()
          )}
        </button>

        {istIntern && aktiveOrgId &&
          railItem("tickets", false, "Zur Ticketübersicht", <TicketIcon size={20} />, alleZustandsResets)}

        {(istAdmin || profil.rolle === "super_admin") && (aktiveOrgId || profil.rolle === "super_admin") &&
          railItem("dashboard", zeigeDashboard, "Dashboard", <BarChart2 size={20} />, () => {
            setZeigeDashboard(true);
            setZeigePlattformAbrechnung(false);
            setZeigeAbrechnung(false);
            setZeigePostfach(false);
            setRechnungDetail(null);
            setZeigeFirmenInfo(false);
            setZeigeVerwaltung(false);
            setZeigeProfil(false);
            setAusgewaehltesTicket(null);
            setZeigeNeuesTicket(false);
            setZeigeStartseite(false);
          })}

        {istAdmin &&
          railItem("abrechnung", zeigeAbrechnung, "Abrechnung", <Receipt size={20} />, () => {
            setZeigeAbrechnung(true);
            setZeigeDashboard(false);
            setZeigePlattformAbrechnung(false);
            setZeigePostfach(false);
            setRechnungDetail(null);
            setZeigeFirmenInfo(false);
            setZeigeVerwaltung(false);
            setZeigeProfil(false);
            setAusgewaehltesTicket(null);
            setZeigeNeuesTicket(false);
            setZeigeStartseite(false);
          })}

        {istAdmin &&
          railItem(
            "postfach",
            zeigePostfach,
            profil.rolle === "super_admin" ? "Nachrichten von Firmen" : "Nachricht an Super-Admin",
            <Mail size={20} />,
            () => {
              setZeigePostfach(true);
              setZeigeDashboard(false);
              setZeigePlattformAbrechnung(false);
              setZeigeAbrechnung(false);
              setRechnungDetail(null);
              setZeigeVerwaltung(false);
              setZeigeFirmenInfo(false);
              setZeigeProfil(false);
              setAusgewaehltesTicket(null);
              setZeigeNeuesTicket(false);
              setZeigeStartseite(false);
            },
          )}

        {profil.rolle === "super_admin" &&
          railItem(
            "plattform-abrechnung",
            zeigePlattformAbrechnung,
            "Plattform-Abrechnung (Firmen-Rechnungen)",
            <Landmark size={20} />,
            () => {
              setZeigePlattformAbrechnung(true);
              setZeigeDashboard(false);
              setZeigeAbrechnung(false);
              setZeigePostfach(false);
              setRechnungDetail(null);
              setZeigeFirmenInfo(false);
              setZeigeVerwaltung(false);
              setZeigeProfil(false);
              setAusgewaehltesTicket(null);
              setZeigeNeuesTicket(false);
              setZeigeStartseite(false);
            },
          )}

        {istAdmin &&
          railItem("verwaltung", zeigeVerwaltung, "Verwaltung", <Settings size={20} />, () => {
            setZeigeVerwaltung(true);
            setZeigeDashboard(false);
            setZeigePlattformAbrechnung(false);
            setZeigeAbrechnung(false);
            setZeigePostfach(false);
            setRechnungDetail(null);
            setZeigeFirmenInfo(false);
            setZeigeProfil(false);
            setAusgewaehltesTicket(null);
            setZeigeNeuesTicket(false);
            setZeigeStartseite(false);
          })}

        {aktiveOrgId &&
          railItem("firmeninfo", zeigeFirmenInfo, "Über uns / Kontakt", <Building2 size={20} />, () => {
            setZeigeFirmenInfo(true);
            setZeigeDashboard(false);
            setZeigePlattformAbrechnung(false);
            setZeigePostfach(false);
            setZeigeAbrechnung(false);
            setRechnungDetail(null);
            setZeigeVerwaltung(false);
            setZeigeProfil(false);
            setAusgewaehltesTicket(null);
            setZeigeNeuesTicket(false);
            setZeigeStartseite(false);
          })}

        <div className="flex-1" />

        {profil.rolle === "super_admin" && superAdminFirma && (
          <button
            onClick={() => {
              setSuperAdminFirma(null);
              setZeigeVerwaltung(false);
              setZeigePlattformAbrechnung(false);
              setZeigeAbrechnung(false);
              setZeigePostfach(false);
              setZeigeFirmenInfo(false);
              setZeigeProfil(false);
              setAusgewaehltesTicket(null);
              setZeigeStartseite(true);
              setZeigeDashboard(false);
            }}
            title="Zurück zur Gesamt-Übersicht"
            className="group relative mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-base shadow-md shadow-blue-500/40 transition-all hover:scale-105 active:scale-95"
          >
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-yellow-400 opacity-75" />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-yellow-400" />
            🦸
          </button>
        )}

        {railItem("theme", false, dunkel ? "Helles Design" : "Dunkles Design", dunkel ? <Sun size={20} /> : <Moon size={20} />, umschalten)}

        {railItem("profil", zeigeProfil, "Mein Profil", <User size={20} />, () => {
          setZeigeProfil(true);
          setZeigeDashboard(false);
          setZeigePlattformAbrechnung(false);
          setZeigeAbrechnung(false);
          setZeigePostfach(false);
          setRechnungDetail(null);
          setZeigeFirmenInfo(false);
          setZeigeVerwaltung(false);
          setAusgewaehltesTicket(null);
          setZeigeNeuesTicket(false);
          setZeigeStartseite(false);
        })}
      </nav>

      <div className="flex min-w-0 flex-col">
        {/* Kontext-Leiste: Firmenname, Firmen-Umschalter, Changelog, Account */}
        <header className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-5 py-2.5">
          <span className="truncate text-sm font-medium text-[var(--text-strong)]">
            {organisation?.name ?? "IT-Ticketsystem"}
          </span>
          {mitgliedschaften.length > 1 && (
            <select
              value={aktiveFirmaId ?? ""}
              onChange={(e) => setAktiveFirmaId(e.target.value)}
              title="Aktive Firma wechseln"
              className="rounded-full border border-[var(--border-input)] bg-[var(--bg-muted)] px-2.5 py-1 text-xs text-[var(--text-soft)]"
            >
              {mitgliedschaften.map((m) => (
                <option key={m.organisation_id} value={m.organisation_id}>
                  {m.organisation_name}
                </option>
              ))}
            </select>
          )}
          <Changelog />
          <HowTo
            istIntern={istIntern}
            autoOeffnen={!profil.howto_gesehen}
            onGesehen={() => {
              howToAlsGesehenMarkieren(profil.id);
              neuLaden();
            }}
          />
          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden text-xs text-[var(--text-soft)] sm:inline">{profil.name ?? "Eingeloggt"}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-full border border-[var(--border-input)] px-3 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-strong)]"
            >
              Abmelden
            </button>
          </div>
        </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6 lg:px-8">
        {zeigeStartseite && !ausgewaehltesTicket && !zeigeNeuesTicket && !zeigeVerwaltung && !zeigeAbrechnung && !zeigeFirmenInfo && !zeigePostfach && !zeigeDashboard && !zeigePlattformAbrechnung && !zeigeProfil ? (
          <Startseite
            name={profil.name}
            rolle={effektiveRolle}
            organisationId={aktiveOrgId}
            orgName={organisation?.name ?? null}
            logoUrl={organisation?.logo_url ?? null}
            akzentfarbe={organisation?.akzentfarbe ?? null}
            onAktion={startseitenAktion}
          />
        ) : zeigeDashboard ? (
          <>
            <button
              onClick={() => { setZeigeDashboard(false); setZeigeStartseite(true); }}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            {profil.rolle === "super_admin" && !superAdminFirma ? (
              <SuperAdminDashboard onFirmaOeffnen={(id) => { setSuperAdminFirma(id); setZeigeDashboard(false); setZeigeStartseite(true); }} />
            ) : aktiveOrgId ? (
              <Dashboard organisationId={aktiveOrgId} />
            ) : (
              <SuperAdminDashboard onFirmaOeffnen={(id) => { setSuperAdminFirma(id); setZeigeDashboard(false); setZeigeStartseite(true); }} />
            )}
          </>
        ) : zeigePlattformAbrechnung ? (
          <>
            <button
              onClick={() => { setZeigePlattformAbrechnung(false); setZeigeStartseite(true); }}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            <PlattformAbrechnung />
          </>
        ) : zeigePostfach ? (
          <>
            <button
              onClick={() => { setZeigePostfach(false); setZeigeStartseite(true); }}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            <AdminPostfach rolle={effektiveRolle} organisationId={aktiveOrgId} />
          </>
        ) : zeigeAbrechnung ? (
          rechnungDetail ? (
            <RechnungDetail
              organisationId={aktiveOrgId!}
              kundeId={rechnungDetail.kundeId}
              jahr={rechnungDetail.jahr}
              monat={rechnungDetail.monat}
              onZurueck={() => setRechnungDetail(null)}
            />
          ) : (
            <>
              <button
                onClick={() => { setZeigeAbrechnung(false); setZeigeStartseite(true); }}
                className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
              >
                ← Zurück
              </button>
              {aktiveOrgId && (
                <Abrechnung
                  organisationId={aktiveOrgId}
                  onKundeAuswahl={(kundeId, jahr, monat) =>
                    setRechnungDetail({ kundeId, jahr, monat })
                  }
                />
              )}
            </>
          )
        ) : zeigeFirmenInfo ? (
          <>
            <button
              onClick={() => { setZeigeFirmenInfo(false); setZeigeStartseite(true); }}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            {aktiveOrgId && <FirmenInfo organisationId={aktiveOrgId} />}
          </>
        ) : zeigeVerwaltung ? (
          <>
            <button
              onClick={() => { setZeigeVerwaltung(false); setZeigeStartseite(true); }}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            {profil.rolle === "super_admin" && superAdminFirma && (
              <button
                onClick={() => setSuperAdminFirma(null)}
                className="ml-3 text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
              >
                Alle Firmen
              </button>
            )}
            {profil.rolle === "super_admin" && !superAdminFirma ? (
              <SuperAdminUebersicht onFirmaOeffnen={setSuperAdminFirma} />
            ) : (
              <Verwaltung
                rolle={effektiveRolle}
                organisationId={aktiveOrgId}
                onlineIds={onlineIds}
                initialTab={verwaltungsTab}
              />
            )}
          </>
        ) : zeigeProfil ? (
          <>
            <button
              onClick={() => { setZeigeProfil(false); setZeigeStartseite(true); }}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            <MeinProfil
              profilId={profil.id}
              organisationId={aktiveOrgId}
              istIntern={istIntern}
            />
          </>
        ) : istIntern ? (
          // ---------- Techniker / Admin-Ansicht ----------
          ausgewaehltesTicket ? (
            <>
              <button
                onClick={() => setAusgewaehltesTicket(null)}
                className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
              >
                ← Zurück zur Übersicht
              </button>
              <TicketDetail ticketId={ausgewaehltesTicket} technikerId={profil.id} />
            </>
          ) : (
            <TicketUebersicht
            key={ticketFilter ?? "standard"}
            onAuswahl={setAusgewaehltesTicket}
            organisationId={aktiveOrgId}
            technikerId={profil.id}
            motto={organisation?.motto}
            heroBildUrl={organisation?.hero_bild_url}
            initialFilter={ticketFilter}
            standardFilter={profil.standard_ticket_filter}
          />
          )
        ) : (
          // ---------- Kunden-Ansicht ----------
          ausgewaehltesTicket ? (
            <>
              <button
                onClick={() => setAusgewaehltesTicket(null)}
                className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
              >
                ← Zurück zu meinen Anfragen
              </button>
              <MeinTicketDetail ticketId={ausgewaehltesTicket} />
            </>
          ) : zeigeNeuesTicket ? (
            <>
              <button
                onClick={() => setZeigeNeuesTicket(false)}
                className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
              >
                ← Zurück
              </button>
              <NeuesTicket
                onErstellt={(id) => {
                  setZeigeNeuesTicket(false);
                  setAusgewaehltesTicket(id);
                }}
              />
            </>
          ) : (
            <>
              {(organisation?.hero_bild_url || organisation?.motto) && (
                <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                  {organisation?.hero_bild_url && (
                    <img
                      src={organisation.hero_bild_url}
                      alt=""
                      className="h-40 w-full object-contain sm:h-56"
                    />
                  )}
                  {organisation?.motto && (
                    <p className="bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-soft)]">
                      {organisation.motto}
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => setZeigeNeuesTicket(true)}
                className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white"
              >
                + Neue Anfrage
              </button>
              <MeineTickets onAuswahl={setAusgewaehltesTicket} organisationId={aktiveOrgId} />
            </>
          )
        )}
      </main>
      </div>
    </div>
  );
}
