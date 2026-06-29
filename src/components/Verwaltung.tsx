import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import { generierePasswort } from "../lib/passwort";
import KundenListe from "./KundenListe";
import MitarbeiterListe from "./MitarbeiterListe";
import ZugangsdatenBox from "./ZugangsdatenBox";

type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";

interface OrganisationKurz {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Organisation extends OrganisationKurz {
  adresse: string | null;
  telefon: string | null;
  email: string | null;
  website: string | null;
  oeffnungszeiten: string | null;
  standard_preis_pro_minute_cent: number | null;
}

interface VerwaltungProps {
  rolle: Rolle;
  organisationId: string | null;
}

export default function Verwaltung({ rolle, organisationId }: VerwaltungProps) {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgAdresse, setOrgAdresse] = useState("");
  const [orgTelefon, setOrgTelefon] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [orgOeffnungszeiten, setOrgOeffnungszeiten] = useState("");
  const [orgStandardpreisEuro, setOrgStandardpreisEuro] = useState("");
  const [alleOrganisationen, setAlleOrganisationen] = useState<OrganisationKurz[]>([]);
  const [neueOrgName, setNeueOrgName] = useState("");

  const [neuerMitarbeiterEmail, setNeuerMitarbeiterEmail] = useState("");
  const [neuerMitarbeiterName, setNeuerMitarbeiterName] = useState("");
  const [neuerMitarbeiterTelefon, setNeuerMitarbeiterTelefon] = useState("");
  const [neuerMitarbeiterPasswort, setNeuerMitarbeiterPasswort] = useState("");
  const [neuerMitarbeiterRolle, setNeuerMitarbeiterRolle] = useState<"techniker" | "org_admin">(
    "techniker",
  );
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);
  const [zeigeMitarbeiterAnlegen, setZeigeMitarbeiterAnlegen] = useState(false);
  const [mitarbeiterZugangsdaten, setMitarbeiterZugangsdaten] = useState<
    { email: string; passwort?: string; link?: string; telefon?: string } | null
  >(null);

  const [neuerKundeEmail, setNeuerKundeEmail] = useState("");
  const [neuerKundeName, setNeuerKundeName] = useState("");
  const [neuerKundeTelefon, setNeuerKundeTelefon] = useState("");
  const [neuerKundeAdresse, setNeuerKundeAdresse] = useState("");
  const [neuerKundeNotizen, setNeuerKundeNotizen] = useState("");
  const [neuerKundePasswort, setNeuerKundePasswort] = useState("");
  const [kundenRefreshKey, setKundenRefreshKey] = useState(0);
  const [zeigeKundeAnlegen, setZeigeKundeAnlegen] = useState(false);
  const [kundeZugangsdaten, setKundeZugangsdaten] = useState<
    { email: string; passwort?: string; link?: string; telefon?: string } | null
  >(null);

  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    if (organisationId) {
      ladeOrganisation();
    }
    if (rolle === "super_admin") ladeAlleOrganisationen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ladeOrganisation() {
    const { data } = await supabase
      .from("organisationen")
      .select(
        "id, name, logo_url, adresse, telefon, email, website, oeffnungszeiten, standard_preis_pro_minute_cent",
      )
      .eq("id", organisationId)
      .single();
    if (data) {
      setOrganisation(data);
      setOrgName(data.name);
      setOrgAdresse(data.adresse ?? "");
      setOrgTelefon(data.telefon ?? "");
      setOrgEmail(data.email ?? "");
      setOrgWebsite(data.website ?? "");
      setOrgOeffnungszeiten(data.oeffnungszeiten ?? "");
      setOrgStandardpreisEuro(
        data.standard_preis_pro_minute_cent != null
          ? (data.standard_preis_pro_minute_cent / 100).toFixed(2)
          : "",
      );
    }
  }

  async function ladeAlleOrganisationen() {
    const { data } = await supabase
      .from("organisationen")
      .select("id, name, logo_url")
      .order("name");
    setAlleOrganisationen(data ?? []);
  }

  async function organisationSpeichern() {
    if (!organisation) return;

    let standardpreisCent: number | null = null;
    if (orgStandardpreisEuro.trim() !== "") {
      const wert = parseFloat(orgStandardpreisEuro.trim().replace(",", "."));
      if (isNaN(wert)) {
        setHinweis("Ungültiger Standardpreis – bitte z.B. 1,99 eingeben.");
        return;
      }
      standardpreisCent = Math.round(wert * 100);
    }

    setLaedt(true);
    const { error } = await supabase
      .from("organisationen")
      .update({
        name: orgName,
        adresse: orgAdresse.trim() || null,
        telefon: orgTelefon.trim() || null,
        email: orgEmail.trim() || null,
        website: orgWebsite.trim() || null,
        oeffnungszeiten: orgOeffnungszeiten.trim() || null,
        standard_preis_pro_minute_cent: standardpreisCent,
      })
      .eq("id", organisation.id);
    setLaedt(false);
    setHinweis(error ? "Speichern fehlgeschlagen." : "Gespeichert.");
  }

  async function logoHochladen(datei: File) {
    if (!organisation) return;
    setLaedt(true);
    setHinweis(null);
    try {
      const pfad = `${organisation.id}/${Date.now()}-${sichererDateiname(datei.name)}`;
      const { error: uploadFehler } = await supabase.storage
        .from("logos")
        .upload(pfad, datei, { upsert: true });
      if (uploadFehler) throw uploadFehler;

      const { data: oeffentlich } = supabase.storage.from("logos").getPublicUrl(pfad);
      const { error: updateFehler } = await supabase
        .from("organisationen")
        .update({ logo_url: oeffentlich.publicUrl })
        .eq("id", organisation.id);
      if (updateFehler) throw updateFehler;

      setOrganisation({ ...organisation, logo_url: oeffentlich.publicUrl });
      setHinweis("Logo aktualisiert.");
    } catch (err) {
      console.error(err);
      setHinweis("Logo-Upload fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }

  async function neueOrganisationAnlegen() {
    if (!neueOrgName.trim()) return;
    setLaedt(true);
    const { error } = await supabase.from("organisationen").insert({ name: neueOrgName.trim() });
    setLaedt(false);
    if (!error) {
      setNeueOrgName("");
      ladeAlleOrganisationen();
      setHinweis("Organisation angelegt.");
    } else {
      setHinweis("Anlegen fehlgeschlagen.");
    }
  }

  async function kundeAnlegen() {
    if (!neuerKundeEmail.trim() || !organisationId) return;
    setLaedt(true);
    setHinweis(null);
    setKundeZugangsdaten(null);

    const { data: sessionData } = await supabase.auth.getSession();

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-kunde`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          email: neuerKundeEmail.trim(),
          name: neuerKundeName.trim() || null,
          organisationId,
          passwort: neuerKundePasswort.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Anlegen fehlgeschlagen");

      if (json.userId && (neuerKundeTelefon || neuerKundeAdresse || neuerKundeNotizen)) {
        await supabase
          .from("profiles")
          .update({
            telefonnummer: neuerKundeTelefon.trim() || null,
            adresse: neuerKundeAdresse.trim() || null,
            notizen: neuerKundeNotizen.trim() || null,
          })
          .eq("id", json.userId);
      }

      if (neuerKundePasswort.trim()) {
        setKundeZugangsdaten({ email: neuerKundeEmail.trim(), passwort: neuerKundePasswort.trim() });
      } else {
        setKundeZugangsdaten({
          email: neuerKundeEmail.trim(),
          link: json.link,
          telefon: neuerKundeTelefon.trim() || undefined,
        });
      }
      setNeuerKundeEmail("");
      setNeuerKundeName("");
      setNeuerKundeTelefon("");
      setNeuerKundeAdresse("");
      setNeuerKundeNotizen("");
      setNeuerKundePasswort("");
      setZeigeKundeAnlegen(false);
      setKundenRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setHinweis("Kunde anlegen fehlgeschlagen. Sind die Edge Functions deployt?");
    } finally {
      setLaedt(false);
    }
  }

  async function mitarbeiterAnlegen() {
    if (!neuerMitarbeiterEmail.trim() || !organisationId) return;
    setLaedt(true);
    setHinweis(null);
    setMitarbeiterZugangsdaten(null);

    const { data: sessionData } = await supabase.auth.getSession();

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-mitarbeiter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email: neuerMitarbeiterEmail.trim(),
            name: neuerMitarbeiterName.trim() || null,
            organisationId,
            rolle: neuerMitarbeiterRolle,
            passwort: neuerMitarbeiterPasswort.trim() || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Anlegen fehlgeschlagen");

      if (json.userId && neuerMitarbeiterTelefon.trim()) {
        await supabase
          .from("profiles")
          .update({ telefonnummer: neuerMitarbeiterTelefon.trim() })
          .eq("id", json.userId);
      }

      if (neuerMitarbeiterPasswort.trim()) {
        setMitarbeiterZugangsdaten({
          email: neuerMitarbeiterEmail.trim(),
          passwort: neuerMitarbeiterPasswort.trim(),
        });
      } else {
        setMitarbeiterZugangsdaten({
          email: neuerMitarbeiterEmail.trim(),
          link: json.link,
          telefon: neuerMitarbeiterTelefon.trim() || undefined,
        });
      }
      setNeuerMitarbeiterEmail("");
      setNeuerMitarbeiterName("");
      setNeuerMitarbeiterTelefon("");
      setNeuerMitarbeiterPasswort("");
      setZeigeMitarbeiterAnlegen(false);
      setTeamRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setHinweis("Anlegen fehlgeschlagen. Ist invite-mitarbeiter deployt?");
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-[var(--text-strong)]">Verwaltung</h2>

      {rolle === "super_admin" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">Organisationen</h3>
          {alleOrganisationen.length > 0 && (
            <ul className="space-y-1 text-sm text-[var(--text-soft)]">
              {alleOrganisationen.map((o) => (
                <li key={o.id}>{o.name}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={neueOrgName}
              onChange={(e) => setNeueOrgName(e.target.value)}
              placeholder="Name der neuen Firma"
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
            <button
              onClick={neueOrganisationAnlegen}
              disabled={laedt}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Anlegen
            </button>
          </div>
        </div>
      )}

      {organisation && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">Firmenprofil</h3>
          <div className="flex items-center gap-4">
            {organisation.logo_url && (
              <img src={organisation.logo_url} alt={organisation.name} className="h-10 w-10 rounded" />
            )}
            <label className="cursor-pointer rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
              Logo ändern
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && logoHochladen(e.target.files[0])}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Firmenname"
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              Adresse
            </label>
            <textarea
              value={orgAdresse}
              onChange={(e) => setOrgAdresse(e.target.value)}
              rows={2}
              placeholder="Straße, PLZ, Ort"
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                Telefon
              </label>
              <input
                type="text"
                value={orgTelefon}
                onChange={(e) => setOrgTelefon(e.target.value)}
                placeholder="+49 ..."
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                E-Mail
              </label>
              <input
                type="email"
                value={orgEmail}
                onChange={(e) => setOrgEmail(e.target.value)}
                placeholder="support@firma.de"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              Website
            </label>
            <input
              type="text"
              value={orgWebsite}
              onChange={(e) => setOrgWebsite(e.target.value)}
              placeholder="https://…"
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              Öffnungs- / Erreichbarkeitszeiten
            </label>
            <input
              type="text"
              value={orgOeffnungszeiten}
              onChange={(e) => setOrgOeffnungszeiten(e.target.value)}
              placeholder="z.B. Mo–Fr 8–17 Uhr"
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              Standard-Minutenpreis in Euro (für die Abrechnung)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={orgStandardpreisEuro}
              onChange={(e) => setOrgStandardpreisEuro(e.target.value)}
              placeholder="z.B. 1,99"
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={organisationSpeichern}
            disabled={laedt}
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {laedt ? "Speichert…" : "Speichern"}
          </button>
        </div>
      )}

      {organisationId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-strong)]">Team</h3>
            <button
              onClick={() => setZeigeMitarbeiterAnlegen((v) => !v)}
              className="text-xs text-amber-600 hover:underline"
            >
              {zeigeMitarbeiterAnlegen ? "Abbrechen" : "+ Mitarbeiter anlegen"}
            </button>
          </div>

          {zeigeMitarbeiterAnlegen && (
            <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <input
                type="email"
                value={neuerMitarbeiterEmail}
                onChange={(e) => setNeuerMitarbeiterEmail(e.target.value)}
                placeholder="E-Mail (für die Einladung)"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={neuerMitarbeiterName}
                onChange={(e) => setNeuerMitarbeiterName(e.target.value)}
                placeholder="Name"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={neuerMitarbeiterTelefon}
                onChange={(e) => setNeuerMitarbeiterTelefon(e.target.value)}
                placeholder="Telefon (optional)"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <select
                value={neuerMitarbeiterRolle}
                onChange={(e) =>
                  setNeuerMitarbeiterRolle(e.target.value as typeof neuerMitarbeiterRolle)
                }
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              >
                <option value="techniker">Techniker</option>
                <option value="org_admin">Org-Admin</option>
              </select>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerMitarbeiterPasswort}
                  onChange={(e) => setNeuerMitarbeiterPasswort(e.target.value)}
                  placeholder="Passwort (optional, statt Mail-Einladung)"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setNeuerMitarbeiterPasswort(generierePasswort())}
                  className="rounded border border-[var(--border-input)] px-3 py-2 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                >
                  Generieren
                </button>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                Leer lassen, um einen Einladungslink zu erzeugen. Mit Passwort: Account ist sofort nutzbar,
                keine Mail wird verschickt – du gibst die Zugangsdaten selbst weiter. Für WhatsApp empfehlenswert (Links können dort vorab verbraucht werden).
              </p>

              <button
                onClick={mitarbeiterAnlegen}
                disabled={laedt}
                className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {laedt
                  ? "Wird angelegt…"
                  : neuerMitarbeiterPasswort.trim()
                  ? "Mitarbeiter mit Passwort anlegen"
                  : "Mitarbeiter anlegen & Link erzeugen"}
              </button>
            </div>
          )}

          {mitarbeiterZugangsdaten && (
            <ZugangsdatenBox
              email={mitarbeiterZugangsdaten.email}
              passwort={mitarbeiterZugangsdaten.passwort}
              link={mitarbeiterZugangsdaten.link}
              telefon={mitarbeiterZugangsdaten.telefon}
              firmenName={organisation?.name}
              firmenAdresse={organisation?.adresse}
              logoUrl={organisation?.logo_url}
              onSchliessen={() => setMitarbeiterZugangsdaten(null)}
            />
          )}

          <MitarbeiterListe
            organisationId={organisationId}
            eigeneRolle={rolle}
            refreshKey={teamRefreshKey}
            organisationName={organisation?.name}
            organisationAdresse={organisation?.adresse}
            organisationLogoUrl={organisation?.logo_url}
          />
        </div>
      )}

      {organisationId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-strong)]">Kunden</h3>
            <button
              onClick={() => setZeigeKundeAnlegen((v) => !v)}
              className="text-xs text-amber-600 hover:underline"
            >
              {zeigeKundeAnlegen ? "Abbrechen" : "+ Kunde anlegen"}
            </button>
          </div>

          {zeigeKundeAnlegen && (
            <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <input
                type="email"
                value={neuerKundeEmail}
                onChange={(e) => setNeuerKundeEmail(e.target.value)}
                placeholder="E-Mail (für die Einladung)"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <input
                type="text"
                value={neuerKundeName}
                onChange={(e) => setNeuerKundeName(e.target.value)}
                placeholder="Name"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <input
                type="text"
                value={neuerKundeTelefon}
                onChange={(e) => setNeuerKundeTelefon(e.target.value)}
                placeholder="Telefon / WhatsApp (optional)"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <textarea
                value={neuerKundeAdresse}
                onChange={(e) => setNeuerKundeAdresse(e.target.value)}
                placeholder="Adresse (optional)"
                rows={2}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <textarea
                value={neuerKundeNotizen}
                onChange={(e) => setNeuerKundeNotizen(e.target.value)}
                placeholder="Notizen / Besonderheiten (optional)"
                rows={2}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerKundePasswort}
                  onChange={(e) => setNeuerKundePasswort(e.target.value)}
                  placeholder="Passwort (optional, statt Mail-Einladung)"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <button
                  type="button"
                  onClick={() => setNeuerKundePasswort(generierePasswort())}
                  className="rounded border border-[var(--border-input)] px-3 py-2 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                >
                  Generieren
                </button>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                Leer lassen, um einen Einladungslink zu erzeugen. Mit Passwort: Account ist sofort nutzbar,
                keine Mail wird verschickt – du gibst die Zugangsdaten selbst weiter. Für WhatsApp empfehlenswert (Links können dort vorab verbraucht werden).
              </p>

              <button
                onClick={kundeAnlegen}
                disabled={laedt}
                className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {laedt
                  ? "Wird angelegt…"
                  : neuerKundePasswort.trim()
                  ? "Kunde mit Passwort anlegen"
                  : "Kunde anlegen & Link erzeugen"}
              </button>
            </div>
          )}

          {kundeZugangsdaten && (
            <ZugangsdatenBox
              email={kundeZugangsdaten.email}
              passwort={kundeZugangsdaten.passwort}
              link={kundeZugangsdaten.link}
              telefon={kundeZugangsdaten.telefon}
              firmenName={organisation?.name}
              firmenAdresse={organisation?.adresse}
              logoUrl={organisation?.logo_url}
              onSchliessen={() => setKundeZugangsdaten(null)}
            />
          )}

          <KundenListe
            organisationId={organisationId}
            refreshKey={kundenRefreshKey}
            organisationName={organisation?.name}
            organisationAdresse={organisation?.adresse}
            organisationLogoUrl={organisation?.logo_url}
          />
        </div>
      )}

      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
    </div>
  );
}
