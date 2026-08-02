import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

type Modus = "laden" | "anmelden" | "passwort-setzen" | "passwort-vergessen";

export default function Login() {
  const { sprache, setSprache } = useSprache();
  const t = texte(sprache).login;
  const STATUS_ZEILEN = [
    { label: t.ladenStatusDatenbank, zustand: "online" as const },
    { label: t.ladenStatusAuth, zustand: "online" as const },
    { label: t.ladenStatusWhatsapp, zustand: "vorbereitet" as const },
  ];
  const [modus, setModus] = useState<Modus>("laden");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [linkGesendet, setLinkGesendet] = useState(false);
  const [titel, setTitel] = useState("Ticketsystem");
  const [spruch, setSpruch] = useState("Anfragen ankommen lassen,\nohne dass etwas verloren geht.");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setModus(data.session ? "passwort-setzen" : "anmelden");
    });

    supabase.from("app_branding").select("login_titel, login_spruch").eq("id", true).single()
      .then(({ data }) => {
        if (data) {
          setTitel(data.login_titel);
          setSpruch(data.login_spruch);
        }
      });

    // Bewusst auf JEDE Änderung reagieren, nicht nur auf "PASSWORD_RECOVERY" -
    // bei Einladungs-Links feuert oft ein anderes Event (z.B. "SIGNED_IN"),
    // entscheidend ist nur: sobald eine Sitzung da ist, muss ein Passwort
    // gesetzt werden, bevor es weitergeht.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setModus("passwort-setzen");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function anmelden() {
    setFehler(null);
    setLaedt(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: passwort,
    });
    setLaedt(false);
    if (error) setFehler(t.fehlerLogin);
  }

  async function linkAnfordern() {
    setFehler(null);
    if (!email.trim()) {
      setFehler(t.fehlerEmailErforderlich);
      return;
    }
    setLaedt(true);
    // Absichtlich keine Fehlermeldung bei unbekannter Adresse (Supabase
    // liefert dafuer auch keinen Fehler zurueck) - sonst liesse sich damit
    // erraten, welche E-Mail-Adressen im System existieren.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLaedt(false);
    setLinkGesendet(true);
  }

  async function passwortSetzen() {
    setFehler(null);
    if (passwort.length < 8) {
      setFehler(t.fehlerMindestZeichen);
      return;
    }
    setLaedt(true);
    const { error } = await supabase.auth.updateUser({ password: passwort });
    setLaedt(false);
    if (error) {
      setFehler(t.fehlerPasswortSetzen);
      return;
    }
    // URL bereinigen, damit ein Reload nicht wieder im Einladungs-Modus landet
    window.history.replaceState(null, "", window.location.pathname);
  }

  if (modus === "laden") return null;

  return (
    <div className="login-shell">
      <style>{`
        .login-shell {
          --ink: #131318;
          --ink-panel: #1e1f25;
          --ink-line: #46464f;
          --ink-text: #e4e2e6;
          --ink-text-soft: #c7c5d0;
          --signal: #0e6e8c;
          --paper: #ffffff;
          --paper-text: #14181f;
          --paper-soft: #4d5563;
          --paper-border: #c3cad4;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr;
          font-family: 'Plex Sans', system-ui, sans-serif;
        }
        @media (min-width: 860px) {
          .login-shell { grid-template-columns: 1fr 1fr; }
        }
        .login-panel {
          background: var(--ink);
          color: var(--ink-text);
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }
        .login-panel::before {
          content: "";
          position: absolute;
          inset: -40% -10% auto auto;
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, rgba(14,110,140,0.22), transparent 70%);
          pointer-events: none;
        }
        .login-wordmark {
          font-family: 'Plex Sans', sans-serif;
          font-weight: 600;
          font-size: 1.5rem;
          letter-spacing: -0.01em;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .login-wordmark span {
          color: var(--signal);
          font-size: 1.5rem;
        }
        .login-tagline {
          font-family: 'Plex Sans', sans-serif;
          font-weight: 600;
          font-size: clamp(1.6rem, 3.4vw, 2.4rem);
          line-height: 1.15;
          letter-spacing: -0.01em;
          max-width: 360px;
          margin-top: 32px;
        }
        .status-block {
          font-family: 'Plex Mono', monospace;
          font-size: 0.78rem;
          border-top: 1px solid var(--ink-line);
          padding-top: 18px;
          margin-top: 40px;
        }
        .status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 0;
          color: var(--ink-text-soft);
        }
        .status-row .dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-right: 8px;
        }
        .status-row[data-zustand="online"] .dot {
          background: #4ade80;
          box-shadow: 0 0 0 0 rgba(74,222,128,0.5);
          animation: pulse 2.4s ease-out infinite;
        }
        .status-row[data-zustand="vorbereitet"] .dot {
          background: var(--signal);
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .status-row[data-zustand="online"] .dot { animation: none; }
        }
        .status-row .zustand-label {
          font-size: 0.72rem;
          color: var(--ink-text-soft);
        }
        .login-formside {
          background: var(--paper);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }
        .login-card {
          width: 100%;
          max-width: 360px;
        }
        .login-card h1 {
          font-family: 'Plex Sans', sans-serif;
          font-weight: 600;
          font-size: 1.3rem;
          color: var(--paper-text);
          margin: 0 0 4px;
        }
        .login-card .sub {
          font-size: 0.85rem;
          color: var(--paper-soft);
          margin: 0 0 24px;
        }
        .login-field {
          margin-bottom: 14px;
        }
        .login-field label {
          display: block;
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--paper-soft);
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .login-field input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--paper-border);
          border-radius: 8px;
          font-size: 0.92rem;
          color: var(--paper-text);
          background: #fff;
        }
        .login-field input:focus {
          outline: 2px solid var(--signal);
          outline-offset: 1px;
          border-color: var(--signal);
        }
        .login-error {
          font-size: 0.82rem;
          color: #c0392b;
          margin: 4px 0 12px;
        }
        .login-submit {
          width: 100%;
          padding: 12px;
          margin-top: 6px;
          border-radius: 8px;
          border: none;
          background: var(--signal);
          color: #fff;
          font-size: 0.92rem;
          font-weight: 500;
          cursor: pointer;
        }
        .login-submit:disabled { opacity: 0.5; cursor: default; }
        .login-submit:hover:not(:disabled) { background: #0a5670; }
        .login-link {
          display: block;
          width: 100%;
          margin-top: 14px;
          padding: 0;
          border: none;
          background: none;
          text-align: center;
          font-size: 0.82rem;
          color: var(--paper-soft);
          cursor: pointer;
        }
        .login-link:hover { color: var(--signal); text-decoration: underline; }
      `}</style>

      <div className="login-panel">
        <div>
          <div className="flex items-center justify-between">
            <div className="login-wordmark">
              <span>●</span> {titel}
            </div>
            <div className="flex overflow-hidden rounded-full border border-[var(--ink-line)] text-xs">
              <button
                type="button"
                onClick={() => setSprache("de")}
                className="px-2 py-1"
                style={{ background: sprache === "de" ? "var(--signal)" : "transparent", color: "var(--ink-text)" }}
              >
                DE
              </button>
              <button
                type="button"
                onClick={() => setSprache("en")}
                className="px-2 py-1"
                style={{ background: sprache === "en" ? "var(--signal)" : "transparent", color: "var(--ink-text)" }}
              >
                EN
              </button>
            </div>
          </div>
          <p className="login-tagline">
            {spruch.split("\n").map((zeile, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {zeile}
              </span>
            ))}
          </p>
        </div>

        <div className="status-block">
          {STATUS_ZEILEN.map((zeile) => (
            <div key={zeile.label} className="status-row" data-zustand={zeile.zustand}>
              <span>
                <span className="dot" />
                {zeile.label}
              </span>
              <span className="zustand-label">
                {zeile.zustand === "online" ? t.zustandOnline : t.zustandVorbereitet}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="login-formside">
        <div className="login-card">
          {modus === "passwort-vergessen" ? (
            <>
              <h1>{t.passwortVergessenTitel}</h1>
              <p className="sub">
                {linkGesendet ? t.linkGesendetText : t.passwortVergessenText}
              </p>

              {!linkGesendet && (
                <div className="login-field">
                  <label htmlFor="email">{t.email}</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && linkAnfordern()}
                    autoFocus
                  />
                </div>
              )}

              {fehler && <p className="login-error">{fehler}</p>}

              {!linkGesendet && (
                <button className="login-submit" onClick={linkAnfordern} disabled={laedt}>
                  {laedt ? t.sendet : t.linkSenden}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setModus("anmelden");
                  setFehler(null);
                  setLinkGesendet(false);
                }}
                className="login-link"
              >
                {t.zurueckZumLogin}
              </button>
            </>
          ) : (
            <>
              <h1>{modus === "passwort-setzen" ? t.passwortFestlegen : t.anmelden}</h1>
              <p className="sub">
                {modus === "passwort-setzen" ? t.letzterSchritt : t.schoenDassDuDaBist}
              </p>

              {modus === "anmelden" && (
                <div className="login-field">
                  <label htmlFor="email">{t.email}</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              <div className="login-field">
                <label htmlFor="passwort">
                  {modus === "passwort-setzen" ? t.neuesPasswort : t.passwort}
                </label>
                <input
                  id="passwort"
                  type="password"
                  value={passwort}
                  onChange={(e) => setPasswort(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      modus === "passwort-setzen" ? passwortSetzen() : anmelden();
                    }
                  }}
                />
              </div>

              {fehler && <p className="login-error">{fehler}</p>}

              <button
                className="login-submit"
                onClick={modus === "passwort-setzen" ? passwortSetzen : anmelden}
                disabled={laedt}
              >
                {modus === "passwort-setzen" ? t.passwortSpeichernWeiter : t.anmelden}
              </button>

              {modus === "anmelden" && (
                <button
                  type="button"
                  onClick={() => {
                    setModus("passwort-vergessen");
                    setFehler(null);
                    setLinkGesendet(false);
                  }}
                  className="login-link"
                >
                  {t.passwortVergessenLink}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
