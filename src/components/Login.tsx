import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Modus = "laden" | "anmelden" | "passwort-setzen";

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
    <div className="mx-auto mt-20 max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-strong)]">
        {modus === "passwort-setzen" ? "Passwort festlegen" : "Anmelden"}
      </h1>

      {modus === "anmelden" && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          className="w-full rounded border border-[var(--border-input)] px-3 py-2 text-sm"
        />
      )}

      <input
        type="password"
        value={passwort}
        onChange={(e) => setPasswort(e.target.value)}
        placeholder={modus === "passwort-setzen" ? "Neues Passwort" : "Passwort"}
        className="w-full rounded border border-[var(--border-input)] px-3 py-2 text-sm"
      />

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      <button
        onClick={modus === "passwort-setzen" ? passwortSetzen : anmelden}
        disabled={laedt}
        className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {modus === "passwort-setzen" ? "Passwort speichern & weiter" : "Anmelden"}
      </button>
    </div>
  );
}
