import { useState, useEffect } from "react";
import { Sun, Moon, User, Settings, Building2, Receipt, Mail, Ticket as TicketIcon, BarChart2 } from "lucide-react";
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

function neukundeSlug(): string | null {
  return new URLSearchParams(window.location.search).get("neukunde");
}

function datenschutzSlug(): string | null {
  return new URLSearchParams(window.location.search).get("datenschutz");
}

function faqSlug(): string | null {
  return new URLSearchParams(window.location.search).get("faq");
}

interface Organisation {
  name: string;
  logo_url: string | null;
  motto: string | null;
  akzentfarbe: string | null;
  hero_bild_url: string | null;
  sla_stunden: number | null;
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
  const { profil, eingeloggt, laedt } = useProfil();
  const { dunkel, umschalten } = useTheme();
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [ausgewaehltesTicket, setAusgewaehltesTicket] = useState<string | null>(null);
  const [zeigeNeuesTicket, setZeigeNeuesTicket] = useState(false);
  const [zeigeProfil, setZeigeProfil] = useState(false);
  const [zeigeVerwaltung, setZeigeVerwaltung] = useState(false);
  const [superAdminFirma, setSuperAdminFirma] = useState<string | null>(null);
  const [zeigeFirmenInfo, setZeigeFirmenInfo] = useState(false);
  const [zeigeAbrechnung, setZeigeAbrechnung] = useState(false);
  const [zeigePostfach, setZeigePostfach] = useState(false);
  const [zeigeDashboard, setZeigeDashboard] = useState(false);
  const [zeigeStartseite, setZeigeStartseite] = useState(true);
  const [verwaltungsTab, setVerwaltungsTab] = useState<"firma" | "team" | "kunden" | "werkzeuge" | "integrationen">("firma");
  const [ticketFilter, setTicketFilter] = useState<"meine" | "wartend" | null>(null);
  const [rechnungDetail, setRechnungDetail] = useState<
    { kundeId: string; jahr: number; monat: number } | null
  >(null);

  // Für Super-Admin: sobald eine Firma in "Alle Firmen" ausgewählt wurde,
  // gilt sie als aktiver Kontext für Tickets/Abrechnung/Postfach/Firmeninfo -
  // ohne dass die eigene super_admin-Rolle dafür geändert werden muss.
  const aktiveOrgId =
    profil?.rolle === "super_admin" ? superAdminFirma : profil?.organisation_id ?? null;

  const onlineIds = useOnlinePraesenz(aktiveOrgId, profil?.id);

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
    setZeigeStartseite(false);
  }

  function startseitenAktion(aktion: string) {
    alleZustandsResets();
    setTicketFilter(null);
    if (aktion === "tickets") return;
    if (aktion === "tickets-meine") { setTicketFilter("meine"); return; }
    if (aktion === "tickets-wartend") { setTicketFilter("wartend"); return; }
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

  // Beim Firmenwechsel (Super-Admin) alle offenen Detail-/Auswahl-Zustände
  // zurücksetzen - sonst bliebe z.B. ein offenes Ticket der vorherigen
  // Firma sichtbar, weil RLS dem Super-Admin technisch jedes Ticket erlaubt.
  useEffect(() => {
    setAusgewaehltesTicket(null);
    setZeigeNeuesTicket(false);
    setRechnungDetail(null);
  }, [superAdminFirma]);

  useEffect(() => {
    if (aktiveOrgId) {
      supabase
        .from("organisationen")
        .select("name, logo_url, motto, akzentfarbe, hero_bild_url, sla_stunden")
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

  const istIntern =
    profil.rolle === "super_admin" || profil.rolle === "org_admin" || profil.rolle === "techniker";
  const istAdmin = profil.rolle === "super_admin" || profil.rolle === "org_admin";

  return (
    <div
      className="min-h-screen bg-[var(--bg-muted)]"
      style={{ "--akzent": organisation?.akzentfarbe || "#f59e0b" } as React.CSSProperties}
    >
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {profil.rolle === "super_admin" && superAdminFirma && (
            <button
              onClick={() => {
                setSuperAdminFirma(null);
                setZeigeVerwaltung(false);
                setZeigeAbrechnung(false);
                setZeigePostfach(false);
                setZeigeFirmenInfo(false);
                setAusgewaehltesTicket(null);
                setZeigeStartseite(true);
                setZeigeDashboard(false);
              }}
              title="Zurück zur Gesamt-Übersicht"
              className="group relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-blue-500 to-blue-700 text-base shadow-md shadow-blue-500/40 transition-all hover:scale-110 hover:shadow-blue-500/60 active:scale-95"
            >
              {/* Cape-Wellen-Animation */}
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-yellow-400 opacity-75" />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-yellow-400" />
              🦸
            </button>
          )}
          <button
            onClick={zurueckZuTickets}
            className="flex items-center gap-2 rounded hover:opacity-75"
            title="Zur Startseite"
          >
            {organisation?.logo_url && (
              <img src={organisation.logo_url} alt={organisation.name} className="h-6 w-6 shrink-0 rounded object-contain" />
            )}
            <span className="text-sm font-semibold text-[var(--text-strong)]">
              {organisation?.name ?? "IT-Ticketsystem"}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {istIntern && aktiveOrgId && (
            <button
              onClick={() => { alleZustandsResets(); }}
              className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
              title="Zur Ticketübersicht"
            >
              <TicketIcon size={16} />
            </button>
          )}
          <button
            onClick={umschalten}
            className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            title={dunkel ? "Helles Design" : "Dunkles Design"}
          >
            {dunkel ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {aktiveOrgId && (
            <button
              onClick={() => {
                setZeigeFirmenInfo(true);
                setZeigePostfach(false);
                setZeigeAbrechnung(false);
                setRechnungDetail(null);
                setZeigeVerwaltung(false);
                setZeigeProfil(false);
                setAusgewaehltesTicket(null);
                setZeigeNeuesTicket(false);
              }}
              className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
              title="Über uns / Kontakt"
            >
              <Building2 size={16} />
            </button>
          )}
          {istAdmin && (
            <button
              onClick={() => {
                setZeigeAbrechnung(true);
                setZeigePostfach(false);
                setZeigeFirmenInfo(false);
                setZeigeVerwaltung(false);
                setZeigeProfil(false);
                setAusgewaehltesTicket(null);
                setZeigeNeuesTicket(false);
                setZeigeDashboard(false);
              }}
              className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
              title="Abrechnung"
            >
              <Receipt size={16} />
            </button>
          )}
          {(istAdmin || profil.rolle === "super_admin") && (aktiveOrgId || profil.rolle === "super_admin") && (
            <button
              onClick={() => {
                setZeigeDashboard(true);
                setZeigeAbrechnung(false);
                setZeigePostfach(false);
                setZeigeFirmenInfo(false);
                setZeigeVerwaltung(false);
                setZeigeProfil(false);
                setAusgewaehltesTicket(null);
                setZeigeNeuesTicket(false);
                setZeigeStartseite(false);
              }}
              className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
              title="Dashboard"
            >
              <BarChart2 size={16} />
            </button>
          )}
          {istAdmin && (
            <button
              onClick={() => {
                setZeigePostfach(true);
                setZeigeAbrechnung(false);
                setRechnungDetail(null);
                setZeigeVerwaltung(false);
                setZeigeFirmenInfo(false);
                setZeigeProfil(false);
                setAusgewaehltesTicket(null);
                setZeigeNeuesTicket(false);
              }}
              className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
              title={profil.rolle === "super_admin" ? "Nachrichten von Firmen" : "Nachricht an Super-Admin"}
            >
              <Mail size={16} />
            </button>
          )}
          {istAdmin && (
            <button
              onClick={() => {
                setZeigeVerwaltung(true);
                setZeigeAbrechnung(false);
                setZeigePostfach(false);
                setRechnungDetail(null);
                setZeigeFirmenInfo(false);
                setZeigeProfil(false);
                setAusgewaehltesTicket(null);
                setZeigeNeuesTicket(false);
              }}
              className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
              title="Verwaltung"
            >
              <Settings size={16} />
            </button>
          )}
          <button
            onClick={() => {
              setZeigeProfil(true);
              setZeigeAbrechnung(false);
              setZeigePostfach(false);
                setRechnungDetail(null);
              setZeigeFirmenInfo(false);
              setZeigeVerwaltung(false);
              setAusgewaehltesTicket(null);
              setZeigeNeuesTicket(false);
            }}
            className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            title="Mein Profil"
          >
            <User size={16} />
          </button>
          <span className="text-xs text-[var(--text-soft)]">{profil.name ?? "Eingeloggt"}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text-soft)]"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        {zeigeStartseite && !ausgewaehltesTicket && !zeigeNeuesTicket && !zeigeVerwaltung && !zeigeAbrechnung && !zeigeFirmenInfo && !zeigePostfach && !zeigeDashboard && !zeigeProfil ? (
          <Startseite
            name={profil.name}
            rolle={profil.rolle}
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
        ) : zeigePostfach ? (
          <>
            <button
              onClick={() => setZeigePostfach(false)}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            <AdminPostfach rolle={profil.rolle} organisationId={aktiveOrgId} />
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
                onClick={() => setZeigeAbrechnung(false)}
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
              onClick={() => setZeigeFirmenInfo(false)}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            {aktiveOrgId && <FirmenInfo organisationId={aktiveOrgId} />}
          </>
        ) : zeigeVerwaltung ? (
          <>
            <button
              onClick={() => setZeigeVerwaltung(false)}
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
                rolle={profil.rolle}
                organisationId={
                  profil.rolle === "super_admin" ? superAdminFirma : profil.organisation_id
                }
                onlineIds={onlineIds}
                initialTab={verwaltungsTab}
              />
            )}
          </>
        ) : zeigeProfil ? (
          <>
            <button
              onClick={() => setZeigeProfil(false)}
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
            slaStunden={organisation?.sla_stunden}
            initialFilter={ticketFilter}
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
  );
}
