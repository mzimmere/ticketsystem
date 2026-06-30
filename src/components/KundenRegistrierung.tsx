import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface OrgOeffentlich {
  id: string;
  name: string;
  logo_url: string | null;
  motto: string | null;
  akzentfarbe: string | null;
}

interface KundenRegistrierungProps {
  slug: string;
}

export default function KundenRegistrierung({ slug }: KundenRegistrierungProps) {
  const [organisation, setOrganisation] = useState<OrgOeffentlich | null>(null);
  const [ladeOrg, setLadeOrg] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [telefon, setTelefon] = useState("");
  const [strasse, setStrasse] = useState("");
  const [hausnummer, setHausnummer] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<"sofort" | "bestaetigung" | null>(null);

  useEffect(() => {
    supabase
      .rpc("get_organisation_by_slug", { p_slug: slug })
      .then(({ data, error }) => {
        if (error) {
          console.error("[KundenRegistrierung] Firma konnte nicht geladen werden:", error);
        }
        setOrganisation(data && data.length > 0 ? data[0] : null);
        setLadeOrg(false);
      });
  }, [slug]);

  async function registrieren() {
    if (!organisation) return;
    if (!name.trim() || !email.trim() || passwort.length < 8) {
      setFehler("Bitte mindestens Name, E-Mail und ein Passwort mit 8+ Zeichen angeben.");
      return;
    }
    setFehler(null);
    setLaedt(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: passwort,
      options: {
        data: {
          organisation_id: organisation.id,
          rolle: "kunde",
          name: name.trim(),
          telefonnummer: telefon.trim() || null,
          strasse: strasse.trim() || null,
          hausnummer: hausnummer.trim() || null,
          plz: plz.trim() || null,
          ort: ort.trim() || null,
        },
      },
    });

    setLaedt(false);

    if (error) {
      setFehler(
        error.message.toLowerCase().includes("already")
          ? "Für diese E-Mail existiert schon ein Account. Bitte normal einloggen."
          : "Registrierung fehlgeschlagen. Bitte später erneut versuchen.",
      );
      return;
    }

    setFertig(data.session ? "sofort" : "bestaetigung");
  }

  if (ladeOrg) return null;

  if (!organisation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8">
        <p className="text-sm text-[var(--text-soft)]">
          Dieser Registrierungslink ist ungültig oder nicht mehr aktiv.
        </p>
      </div>
    );
  }

  if (fertig) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8"
        style={{ "--akzent": organisation.akzentfarbe || "#f59e0b" } as React.CSSProperties}
      >
        <div className="max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
          {organisation.logo_url && (
            <img
              src={organisation.logo_url}
              alt={organisation.name}
              className="mx-auto mb-4 h-20 w-20 rounded-lg object-cover"
            />
          )}
          <p className="text-sm text-[var(--text-strong)]">
            {fertig === "sofort"
              ? "Account erstellt! Du wirst gleich weitergeleitet."
              : "Fast geschafft – wir haben dir eine Bestätigungsmail geschickt. Bitte klicke den Link darin an, dann kannst du dich einloggen."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8"
      style={{ "--akzent": organisation.akzentfarbe || "#f59e0b" } as React.CSSProperties}
    >
      <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <div className="mb-5 text-center">
          {organisation.logo_url && (
            <img
              src={organisation.logo_url}
              alt={organisation.name}
              className="mx-auto mb-3 h-20 w-20 rounded-lg object-cover"
            />
          )}
          <h1 className="text-base font-semibold text-[var(--text-strong)]">
            {organisation.name}
          </h1>
          {organisation.motto && (
            <p className="mt-1 text-xs text-[var(--text-soft)]">{organisation.motto}</p>
          )}
          <p className="mt-3 text-sm text-[var(--text-soft)]">Neuen Account anlegen</p>
        </div>

        <div className="space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <input
            type="password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            placeholder="Passwort (mind. 8 Zeichen)"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <input
            type="text"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            placeholder="Telefon / WhatsApp (optional)"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />

          <div className="flex gap-2">
            <input
              type="text"
              value={strasse}
              onChange={(e) => setStrasse(e.target.value)}
              placeholder="Straße (optional)"
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
            <input
              type="text"
              value={hausnummer}
              onChange={(e) => setHausnummer(e.target.value)}
              placeholder="Nr."
              className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={plz}
              onChange={(e) => setPlz(e.target.value)}
              placeholder="PLZ"
              className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
            <input
              type="text"
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              placeholder="Ort"
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
          </div>

          {fehler && <p className="text-sm text-red-600">{fehler}</p>}

          <button
            onClick={registrieren}
            disabled={laedt}
            className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {laedt ? "Wird angelegt…" : "Account erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}
