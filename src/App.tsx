import { useState, useEffect } from "react";
import { Sun, Moon, User, Settings } from "lucide-react";
import { useProfil } from "./lib/useProfil";
import { useTheme } from "./lib/useTheme";
import { supabase } from "./lib/supabaseClient";
import Login from "./components/Login";
import NeuesTicket from "./components/NeuesTicket";
import MeineTickets from "./components/MeineTickets";
import MeinTicketDetail from "./components/MeinTicketDetail";
import TicketUebersicht from "./components/TicketUebersicht";
import TicketDetail from "./components/TicketDetail";
import MeinProfil from "./components/MeinProfil";
import Verwaltung from "./components/Verwaltung";

interface Organisation {
  name: string;
  logo_url: string | null;
}

export default function App() {
  const { profil, eingeloggt, laedt } = useProfil();
  const { dunkel, umschalten } = useTheme();
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [ausgewaehltesTicket, setAusgewaehltesTicket] = useState<string | null>(null);
  const [zeigeNeuesTicket, setZeigeNeuesTicket] = useState(false);
  const [zeigeProfil, setZeigeProfil] = useState(false);
  const [zeigeVerwaltung, setZeigeVerwaltung] = useState(false);

  useEffect(() => {
    if (profil?.organisation_id) {
      supabase
        .from("organisationen")
        .select("name, logo_url")
        .eq("id", profil.organisation_id)
        .single()
        .then(({ data }) => setOrganisation(data as Organisation));
    }
  }, [profil?.organisation_id]);

  if (laedt) {
    return <div className="p-8 text-sm text-[var(--text-faint)]">Lädt…</div>;
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

  const istIntern =
    profil.rolle === "super_admin" || profil.rolle === "org_admin" || profil.rolle === "techniker";
  const istAdmin = profil.rolle === "super_admin" || profil.rolle === "org_admin";

  return (
    <div className="min-h-screen bg-[var(--bg-muted)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {organisation?.logo_url && (
            <img src={organisation.logo_url} alt={organisation.name} className="h-6 w-6 rounded" />
          )}
          <span className="text-sm font-semibold text-[var(--text-strong)]">
            {organisation?.name ?? "IT-Ticketsystem"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={umschalten}
            className="rounded p-1.5 text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            title={dunkel ? "Helles Design" : "Dunkles Design"}
          >
            {dunkel ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {istAdmin && (
            <button
              onClick={() => {
                setZeigeVerwaltung(true);
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
        {zeigeVerwaltung ? (
          <>
            <button
              onClick={() => setZeigeVerwaltung(false)}
              className="text-sm text-[var(--text-soft)] hover:text-[var(--text-strong)]"
            >
              ← Zurück
            </button>
            <Verwaltung rolle={profil.rolle} organisationId={profil.organisation_id} />
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
              organisationId={profil.organisation_id}
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
            onAuswahl={setAusgewaehltesTicket}
            organisationId={profil.organisation_id}
            technikerId={profil.id}
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
              <button
                onClick={() => setZeigeNeuesTicket(true)}
                className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white"
              >
                + Neue Anfrage
              </button>
              <MeineTickets onAuswahl={setAusgewaehltesTicket} />
            </>
          )
        )}
      </main>
    </div>
  );
}
