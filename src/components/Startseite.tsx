import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";

interface StartseiteProps {
  name: string | null;
  rolle: Rolle;
  organisationId: string | null;
  orgName: string | null;
  logoUrl: string | null;
  akzentfarbe: string | null;
  onAktion: (aktion: string) => void;
}

interface SchnellzahlProps {
  wert: number | null;
  label: string;
  farbe?: string;
}

function Schnellzahl({ wert, label, farbe }: SchnellzahlProps) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${farbe ?? "text-[var(--text-strong)]"}`}>
        {wert === null ? "—" : wert}
      </p>
      <p className="mt-0.5 text-xs text-[var(--text-faint)]">{label}</p>
    </div>
  );
}

interface AktionsButtonProps {
  icon: string;
  label: string;
  sub?: string;
  onClick: () => void;
  hervorgehoben?: boolean;
}

function AktionsButton({ icon, label, sub, onClick, hervorgehoben }: AktionsButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
        hervorgehoben
          ? "border-[var(--akzent)] bg-akzent/10 hover:bg-akzent/15"
          : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)]"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${hervorgehoben ? "text-akzent" : "text-[var(--text-strong)]"}`}>
          {label}
        </p>
        {sub && <p className="mt-0.5 truncate text-xs text-[var(--text-faint)]">{sub}</p>}
      </div>
      <span className="ml-auto text-[var(--text-faint)]">›</span>
    </button>
  );
}

function tagesgruss(name: string | null): string {
  const stunde = new Date().getHours();
  const vorname = name?.split(" ")[0] ?? "";
  if (stunde < 12) return `Guten Morgen${vorname ? `, ${vorname}` : ""}`;
  if (stunde < 17) return `Guten Tag${vorname ? `, ${vorname}` : ""}`;
  return `Guten Abend${vorname ? `, ${vorname}` : ""}`;
}

export default function Startseite({
  name, rolle, organisationId, orgName, logoUrl, akzentfarbe, onAktion,
}: StartseiteProps) {
  const [stats, setStats] = useState<{
    meineOffenen: number | null;
    alleOffenen: number | null;
    wartenAufMich: number | null;
    meineTickets: number | null;
  }>({ meineOffenen: null, alleOffenen: null, wartenAufMich: null, meineTickets: null });

  useEffect(() => {
    if (!organisationId) return;
    ladeStats();
  }, [organisationId]);

  async function ladeStats() {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (rolle === "kunde" && userId) {
      const [meineRes, wartenRes] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true })
          .eq("kunde_id", userId),
        supabase.from("tickets").select("id", { count: "exact", head: true })
          .eq("kunde_id", userId).eq("status", "wartet_auf_kunde"),
      ]);
      setStats({
        meineOffenen: null,
        alleOffenen: null,
        wartenAufMich: wartenRes.count ?? 0,
        meineTickets: meineRes.count ?? 0,
      });
      return;
    }

    const [alleRes, meineRes, wartenRes] = await Promise.all([
      supabase.from("tickets").select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId!)
        .in("status", ["offen", "in_bearbeitung", "wartet_auf_kunde"]),
      userId
        ? supabase.from("tickets").select("id", { count: "exact", head: true })
            .eq("organisation_id", organisationId!)
            .eq("zugewiesen_an", userId)
            .in("status", ["offen", "in_bearbeitung"])
        : Promise.resolve({ count: 0 }),
      supabase.from("tickets").select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId!)
        .eq("status", "wartet_auf_kunde"),
    ]);

    setStats({
      alleOffenen: alleRes.count ?? 0,
      meineOffenen: (meineRes as { count: number | null }).count ?? 0,
      wartenAufMich: wartenRes.count ?? 0,
      meineTickets: null,
    });
  }

  const istAdmin = rolle === "super_admin" || rolle === "org_admin";
  const istIntern = rolle !== "kunde";

  return (
    <div
      className="space-y-6"
      style={{ "--akzent": akzentfarbe || "#f59e0b" } as React.CSSProperties}
    >
      {/* Kopfbereich */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={orgName ?? ""}
              className="h-14 w-14 shrink-0 rounded-xl bg-[var(--bg-muted)] object-contain p-1"
            />
          )}
          <div>
            <p className="text-xs font-medium text-[var(--text-faint)]">
              {orgName ?? "IT-Ticketsystem"}
            </p>
            <h1 className="text-xl font-bold text-[var(--text-strong)]">
              {tagesgruss(name)} 👋
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-soft)]">
              {istIntern
                ? "Hier findest du alles auf einen Blick."
                : "Wie können wir dir heute helfen?"}
            </p>
          </div>
        </div>

        {/* Live-Zahlen */}
        {organisationId && (
          <div className={`mt-5 grid border-t border-[var(--border)] pt-4 ${istIntern ? "grid-cols-3" : "grid-cols-2"} gap-4`}>
            {istIntern ? (
              <>
                <Schnellzahl
                  wert={stats.alleOffenen}
                  label="Offene Tickets"
                  farbe={(stats.alleOffenen ?? 0) > 0 ? "text-orange-500" : "text-green-600"}
                />
                <Schnellzahl
                  wert={stats.meineOffenen}
                  label="Mir zugewiesen"
                  farbe={(stats.meineOffenen ?? 0) > 0 ? "text-blue-500" : "text-[var(--text-strong)]"}
                />
                <Schnellzahl
                  wert={stats.wartenAufMich}
                  label="Wartet auf Antwort"
                  farbe={(stats.wartenAufMich ?? 0) > 0 ? "text-yellow-500" : "text-[var(--text-strong)]"}
                />
              </>
            ) : (
              <>
                <Schnellzahl
                  wert={stats.meineTickets}
                  label="Meine Anfragen"
                />
                <Schnellzahl
                  wert={stats.wartenAufMich}
                  label="Warten auf mich"
                  farbe={(stats.wartenAufMich ?? 0) > 0 ? "text-yellow-500" : "text-[var(--text-strong)]"}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Schnellzugriff */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
          Schnellzugriff
        </p>

        {istIntern && (
          <AktionsButton
            icon="🎫"
            label="Alle Tickets"
            sub="Übersicht, Suche und Filter"
            onClick={() => onAktion("tickets")}
            hervorgehoben
          />
        )}

        {!istIntern && (
          <>
            <AktionsButton
              icon="➕"
              label="Neue Anfrage stellen"
              sub="Beschreibe dein Anliegen – wir melden uns"
              onClick={() => onAktion("neues-ticket")}
              hervorgehoben
            />
            <AktionsButton
              icon="📋"
              label="Meine Anfragen"
              sub="Status und Verlauf aller deiner Tickets"
              onClick={() => onAktion("tickets")}
            />
          </>
        )}

        {istAdmin && (
          <div className="grid grid-cols-2 gap-2">
            <AktionsButton
              icon="📊"
              label="Dashboard"
              sub={rolle === "super_admin" && !organisationId ? "Alle Firmen im Überblick" : "Auswertungen & KPIs"}
              onClick={() => onAktion("dashboard")}
            />
            {organisationId && (
              <AktionsButton
                icon="💶"
                label="Abrechnung"
                sub="Rechnungen & Zeiterfassung"
                onClick={() => onAktion("abrechnung")}
              />
            )}
            {organisationId && (
              <AktionsButton
                icon="👥"
                label="Kunden & Team"
                sub="Verwaltung"
                onClick={() => onAktion("verwaltung")}
              />
            )}
            {organisationId && (
              <AktionsButton
                icon="🏢"
                label="Firmenprofil"
                sub="Einstellungen"
                onClick={() => onAktion("firmeninfo")}
              />
            )}
          </div>
        )}

        {istIntern && !istAdmin && (
          <AktionsButton
            icon="🏢"
            label="Über uns"
            sub="Kontakt & Öffnungszeiten"
            onClick={() => onAktion("firmeninfo")}
          />
        )}
      </div>

      {/* Hinweis-Box wenn Tickets warten */}
      {istIntern && (stats.wartenAufMich ?? 0) > 0 && (
        <button
          onClick={() => onAktion("tickets")}
          className="w-full rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-left dark:border-yellow-700 dark:bg-yellow-900/20"
        >
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            ⏳ {stats.wartenAufMich} {stats.wartenAufMich === 1 ? "Ticket wartet" : "Tickets warten"} auf eine Antwort vom Kunden
          </p>
          <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-300">
            Zur Ticketübersicht →
          </p>
        </button>
      )}
    </div>
  );
}
