import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

interface OrgOeffentlich {
  id: string;
  name: string;
  logo_url: string | null;
  motto: string | null;
  akzentfarbe: string | null;
  adresse: string | null;
  telefon: string | null;
  email: string | null;
  website: string | null;
  datenschutz_url: string | null;
  datenschutz_text: string | null;
}

interface KundenRegistrierungProps {
  slug: string;
}

export default function KundenRegistrierung({ slug }: KundenRegistrierungProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).kundenRegistrierung;
  const [organisation, setOrganisation] = useState<OrgOeffentlich | null>(null);
  const [ladeOrg, setLadeOrg] = useState(true);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
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
  const [datenschutzAkzeptiert, setDatenschutzAkzeptiert] = useState(false);
  const [hatFaq, setHatFaq] = useState(false);

  useEffect(() => {
    supabase
      .rpc("get_organisation_by_slug", { p_slug: slug })
      .then(({ data, error }) => {
        if (error) {
          console.error("[KundenRegistrierung] Firma konnte nicht geladen werden:", error);
        }
        const firma = data && data.length > 0 ? data[0] : null;
        setOrganisation(firma);
        setLadeOrg(false);

        if (firma) {
          supabase
            .from("faq_eintraege")
            .select("id", { count: "exact", head: true })
            .eq("organisation_id", firma.id)
            .eq("oeffentlich", true)
            .then(({ count }) => setHatFaq((count ?? 0) > 0));
        }
      });
  }, [slug]);

  const hatDatenschutz = !!(organisation?.datenschutz_url || organisation?.datenschutz_text);

  async function registrieren() {
    if (!organisation) return;
    if (!vorname.trim() || !nachname.trim() || !email.trim() || passwort.length < 8) {
      setFehler(txt.fehlerPflichtfelder);
      return;
    }
    if (hatDatenschutz && !datenschutzAkzeptiert) {
      setFehler(txt.fehlerDatenschutz);
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
          vorname: vorname.trim(),
          nachname: nachname.trim(),
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
          ? txt.fehlerExistiertSchon
          : txt.fehlerAllgemein,
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
          {txt.linkUngueltig}
        </p>
      </div>
    );
  }

  if (fertig) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8"
        style={{ "--akzent": organisation.akzentfarbe || "#0e6e8c" } as React.CSSProperties}
      >
        <div className="max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-7 text-center">
          {organisation.logo_url && (
            <img
              src={organisation.logo_url}
              alt={organisation.name}
              className="mx-auto mb-4 h-20 w-20 rounded-lg bg-[var(--bg-muted)] object-contain p-1"
            />
          )}
          <p className="text-sm text-[var(--text-strong)]">
            {fertig === "sofort" ? txt.fertigSofort : txt.fertigBestaetigung}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] p-8"
      style={{ "--akzent": organisation.akzentfarbe || "#0e6e8c" } as React.CSSProperties}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-7">
        <div className="mb-5 text-center">
          {organisation.logo_url && (
            <img
              src={organisation.logo_url}
              alt={organisation.name}
              className="mx-auto mb-3 h-48 w-48 rounded-lg bg-[var(--bg-muted)] object-contain p-2"
            />
          )}
          <h1 className="text-base font-semibold text-[var(--text-strong)]">
            {organisation.name}
          </h1>
          {organisation.motto && (
            <p className="mt-1 text-xs text-[var(--text-soft)]">{organisation.motto}</p>
          )}
        </div>

        <div className="mb-5 rounded-md bg-[var(--bg-muted)] p-3 text-center">
          <p className="text-sm text-[var(--text-strong)]">
            <strong>{organisation.name}</strong> {txt.einladungstext}
          </p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">
            {txt.beschreibungstext}
          </p>
          {(organisation.adresse || organisation.telefon || organisation.email || organisation.website) && (
            <div className="mt-2 space-y-0.5 border-t border-[var(--border)] pt-2 text-xs text-[var(--text-faint)]">
              {organisation.adresse && (
                <p className="whitespace-pre-line">{organisation.adresse}</p>
              )}
              {organisation.telefon && <p>{organisation.telefon}</p>}
              {organisation.email && <p>{organisation.email}</p>}
              {organisation.website && <p>{organisation.website}</p>}
            </div>
          )}
        </div>

        {hatFaq && (
          <a
            href={`${window.location.pathname}?faq=${slug}`}
            target="_blank"
            rel="noreferrer"
            className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-4 py-2.5 text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-akzent/10 hover:text-akzent"
          >
            {txt.faqAnsehen}
          </a>
        )}

        <div className="mb-2 text-center">
          <p className="text-sm text-[var(--text-soft)]">{txt.neuerAccount}</p>
        </div>

        <div className="space-y-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={vorname}
              onChange={(e) => setVorname(e.target.value)}
              placeholder={txt.vorname}
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
            <input
              type="text"
              value={nachname}
              onChange={(e) => setNachname(e.target.value)}
              placeholder={txt.nachname}
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
          </div>
          <input
            type="text"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            placeholder={txt.telefonOptional}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />

          <div className="flex gap-2">
            <input
              type="text"
              value={strasse}
              onChange={(e) => setStrasse(e.target.value)}
              placeholder={txt.strasseOptional}
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
            <input
              type="text"
              value={hausnummer}
              onChange={(e) => setHausnummer(e.target.value)}
              placeholder={txt.hausnummerKurz}
              className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={plz}
              onChange={(e) => setPlz(e.target.value)}
              placeholder={txt.plz}
              className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
            <input
              type="text"
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              placeholder={txt.ort}
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
            />
          </div>

          <div className="border-t border-[var(--border)] pt-2.5" />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={txt.email}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />
          <input
            type="password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            placeholder={txt.passwortPlatzhalter}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
          />

          {hatDatenschutz && (
            <label className="flex items-start gap-2 text-xs text-[var(--text-soft)]">
              <input
                type="checkbox"
                checked={datenschutzAkzeptiert}
                onChange={(e) => setDatenschutzAkzeptiert(e.target.checked)}
                className="mt-0.5 accent-amber-500"
              />
              <span>
                {txt.datenschutzVor}{" "}
                <a
                  href={
                    organisation?.datenschutz_url ||
                    `${window.location.pathname}?datenschutz=${slug}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-[var(--text-strong)]"
                >
                  {txt.datenschutzLink}
                </a>{" "}
                {txt.datenschutzNach}
              </span>
            </label>
          )}

          {fehler && <p className="text-sm text-red-600">{fehler}</p>}

          <button
            onClick={registrieren}
            disabled={laedt}
            className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {laedt ? txt.wirdAngelegt : txt.accountErstellen}
          </button>
        </div>
      </div>
    </div>
  );
}
