import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Modus = "laden" | "anmelden" | "passwort-setzen";

const STATUS_ZEILEN = [
  { label: "Datenbank", zustand: "online" as const },
  { label: "Authentifizierung", zustand: "online" as const },
  { label: "WhatsApp-Anbindung", zustand: "vorbereitet" as const },
];

export default function Login() {
  const [modus, setModus] = useState<Modus>("laden");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setModus(data.session ? "passwort-setzen" : "anmelden");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setModus("passwort-setzen");
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
    if (error) setFehler("E-Mail oder Passwort stimmt nicht.");
  }

  async function passwortSetzen() {
    setFehler(null);
    if (passwort.length < 8) {
      setFehler("Mindestens 8 Zeichen.");
      return;
    }
    setLaedt(true);
    const { error } = await supabase.auth.updateUser({ password: passwort });
    setLaedt(false);
    if (error) {
      setFehler("Konnte das Passwort nicht setzen. Bitte Link erneut anfordern.");
    }
  }

  if (modus === "laden") return null;

  return (
    <div className="login-shell">
      <style>{`
        .login-shell {
          --ink: #10172a;
          --ink-panel: #1a2440;
          --ink-line: #2c3a63;
          --ink-text: #e7ecf8;
          --ink-text-soft: #93a0c2;
          --signal: #f0a23a;
          --paper: #faf9f5;
          --paper-text: #14171f;
          --paper-soft: #6b7180;
          --paper-border: #e4e1d8;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr;
          font-family: 'Inter', system-ui, sans-serif;
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
          background: radial-gradient(circle, rgba(240,162,58,0.16), transparent 70%);
          pointer-events: none;
        }
        .login-wordmark {
          font-family: 'Space Grotesk', sans-serif;
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
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: clamp(1.6rem, 3.4vw, 2.4rem);
          line-height: 1.15;
          letter-spacing: -0.01em;
          max-width: 360px;
          margin-top: 32px;
        }
        .status-block {
          font-family: 'JetBrains Mono', monospace;
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
          font-family: 'Space Grotesk', sans-serif;
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
          border-radius: 6px;
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
          padding: 11px;
          margin-top: 6px;
          border-radius: 6px;
          border: none;
          background: var(--ink);
          color: #fff;
          font-size: 0.92rem;
          font-weight: 500;
          cursor: pointer;
        }
        .login-submit:disabled { opacity: 0.5; cursor: default; }
        .login-submit:hover:not(:disabled) { background: #1a2440; }
      `}</style>

      <div className="login-panel">
        <div>
          <div className="login-wordmark">
            <span>●</span> Ticketsystem
          </div>
          <p className="login-tagline">
            Anfragen ankommen lassen,<br />ohne dass etwas verloren geht.
          </p>
        </div>

        <div className="status-block">
          {STATUS_ZEILEN.map((zeile) => (
            <div key={zeile.label} className="status-row" data-zustand={zeile.zustand}>
              <span>
                <span className="dot" />
                {zeile.label}
              </span>
              <span className="zustand-label">{zeile.zustand}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="login-formside">
        <div className="login-card">
          <h1>{modus === "passwort-setzen" ? "Passwort festlegen" : "Anmelden"}</h1>
          <p className="sub">
            {modus === "passwort-setzen"
              ? "Letzter Schritt, dann bist du drin."
              : "Schön, dass du da bist."}
          </p>

          {modus === "anmelden" && (
            <div className="login-field">
              <label htmlFor="email">E-Mail</label>
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
              {modus === "passwort-setzen" ? "Neues Passwort" : "Passwort"}
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
            {modus === "passwort-setzen" ? "Passwort speichern & weiter" : "Anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
}
