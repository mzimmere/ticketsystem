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
  onClick?: () => void;
}

function Schnellzahl({ wert, label, farbe, onClick }: SchnellzahlProps) {
  const inhalt = (
    <>
      <p className={`text-2xl font-bold ${farbe ?? "text-[var(--text-strong)]"}`}>
        {wert === null ? "—" : wert}
      </p>
      <p className="mt-0.5 text-xs text-[var(--text-faint)]">{label}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="rounded-lg text-center transition-colors hover:bg-[var(--bg-muted)] px-2 py-1 -mx-2 -my-1"
        title={`Zu: ${label}`}
      >
        {inhalt}
      </button>
    );
  }

  return <div className="text-center">{inhalt}</div>;
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

function SchnellNutzerAnlegen() {
  const [firmen, setFirmen] = useState<{ id: string; name: string }[]>([]);
  const [firmaId, setFirmaId] = useState("");
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [rolle, setRolleState] = useState<"kunde" | "techniker" | "org_admin">("kunde");
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<{ typ: "ok" | "fehler"; text: string } | null>(null);

  useEffect(() => {
    supabase.from("organisationen").select("id, name").order("name")
      .then(({ data }) => {
        setFirmen(data ?? []);
        if (data?.length === 1) setFirmaId(data[0].id);
      });
  }, []);

  async function anlegen() {
    if (!firmaId || !email.trim() || !vorname.trim()) {
      setHinweis({ typ: "fehler", text: "Firma, Vorname und E-Mail sind Pflichtfelder." });
      return;
    }
    setLaedt(true);
    setHinweis(null);
    try {
      const fn = rolle === "kunde" ? "invite-kunde" : "invite-mitarbeiter";
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(
        `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/${fn}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email: email.trim(),
            vorname: vorname.trim(),
            nachname: nachname.trim() || undefined,
            organisationId: firmaId,
            rolle,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unbekannter Fehler");
      setHinweis({ typ: "ok", text: `${vorname} wurde als ${rolle === "kunde" ? "Kunde" : rolle === "techniker" ? "Techniker" : "Admin"} angelegt.` });
      setVorname(""); setNachname(""); setEmail(""); setRolleState("kunde");
    } catch (err) {
      setHinweis({ typ: "fehler", text: String(err) });
    }
    setLaedt(false);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
        Nutzer schnell anlegen
      </p>

      <select value={firmaId} onChange={(e) => setFirmaId(e.target.value)}
        className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-strong)]">
        <option value="">Firma wählen…</option>
        {firmen.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={vorname} onChange={(e) => setVorname(e.target.value)}
          placeholder="Vorname *"
          className="rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
        <input type="text" value={nachname} onChange={(e) => setNachname(e.target.value)}
          placeholder="Nachname"
          className="rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
      </div>

      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="E-Mail *"
        className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />

      <div className="flex gap-2">
        {(["kunde", "techniker", "org_admin"] as const).map((r) => (
          <button key={r} onClick={() => setRolleState(r)}
            className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
              rolle === r
                ? "border-[var(--akzent)] bg-akzent/10 text-akzent"
                : "border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            }`}>
            {r === "kunde" ? "Kunde" : r === "techniker" ? "Techniker" : "Admin"}
          </button>
        ))}
      </div>

      {hinweis && (
        <p className={`text-xs ${hinweis.typ === "ok" ? "text-green-600" : "text-red-600"}`}>
          {hinweis.typ === "ok" ? "✓ " : "✗ "}{hinweis.text}
        </p>
      )}

      <button onClick={anlegen} disabled={laedt}
        className="w-full rounded-lg bg-akzent py-2 text-sm font-medium text-white disabled:opacity-50">
        {laedt ? "Wird angelegt…" : "Nutzer anlegen"}
      </button>
    </div>
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
        {organisationId && rolle !== "super_admin" && (
          <div className={`mt-5 grid border-t border-[var(--border)] pt-4 ${istIntern ? "grid-cols-3" : "grid-cols-2"} gap-4`}>
            {istIntern ? (
              <>
                <Schnellzahl
                  wert={stats.alleOffenen}
                  label="Offene Tickets"
                  farbe={(stats.alleOffenen ?? 0) > 0 ? "text-orange-500" : "text-green-600"}
                  onClick={() => onAktion("tickets")}
                />
                <Schnellzahl
                  wert={stats.meineOffenen}
                  label="Mir zugewiesen"
                  farbe={(stats.meineOffenen ?? 0) > 0 ? "text-blue-500" : "text-[var(--text-strong)]"}
                  onClick={() => onAktion("tickets-meine")}
                />
                <Schnellzahl
                  wert={stats.wartenAufMich}
                  label="Wartet auf Antwort"
                  farbe={(stats.wartenAufMich ?? 0) > 0 ? "text-yellow-500" : "text-[var(--text-strong)]"}
                  onClick={() => onAktion("tickets-wartend")}
                />
              </>
            ) : (
              <>
                <Schnellzahl wert={stats.meineTickets} label="Meine Anfragen" />
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

        {istIntern && rolle !== "super_admin" && (
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
                icon="👤"
                label="Team"
                sub="Mitarbeiter & Techniker"
                onClick={() => onAktion("verwaltung-team")}
              />
            )}
            {organisationId && (
              <AktionsButton
                icon="🤝"
                label="Kunden"
                sub="Kundenstamm verwalten"
                onClick={() => onAktion("verwaltung-kunden")}
              />
            )}
            {organisationId && (
              <AktionsButton
                icon="🏢"
                label="Firmenprofil"
                sub="Einstellungen & Branding"
                onClick={() => onAktion("verwaltung-firma")}
              />
            )}
            {organisationId && (
              <AktionsButton
                icon="🔧"
                label="Werkzeuge"
                sub="Makros, Tags, SLA, FAQ"
                onClick={() => onAktion("verwaltung-werkzeuge")}
              />
            )}
            {organisationId && (
              <AktionsButton
                icon="🔌"
                label="Integrationen"
                sub="E-Mail, WhatsApp"
                onClick={() => onAktion("verwaltung-integrationen")}
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
      {istIntern && (stats.wartenAufMich ?? 0) > 0 && rolle !== "super_admin" && (
        <button
          onClick={() => onAktion("tickets")}
          className="w-full rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-left dark:border-yellow-700 dark:bg-yellow-900/20"
        >
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            ⏳ {stats.wartenAufMich} {stats.wartenAufMich === 1 ? "Ticket wartet" : "Tickets warten"} auf eine Antwort vom Kunden
          </p>
          <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-300">Zur Ticketübersicht →</p>
        </button>
      )}

      {rolle === "super_admin" && !organisationId && <SchnellNutzerAnlegen />}
    </div>
  );
}
