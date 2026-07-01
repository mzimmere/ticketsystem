import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import { pruefeBild } from "../lib/bildvalidierung";
import { generierePasswort } from "../lib/passwort";
import { LAENDER_MWST, LAENDER_LISTE } from "../lib/laender";
import KundenListe from "./KundenListe";
import MitarbeiterListe from "./MitarbeiterListe";
import ZugangsdatenBox from "./ZugangsdatenBox";
import VorlagenVerwaltung from "./VorlagenVerwaltung";
import MakroVerwaltung from "./MakroVerwaltung";
import TagVerwaltung from "./TagVerwaltung";
import SlaVerwaltung from "./SlaVerwaltung";
import FaqVerwaltung from "./FaqVerwaltung";
import ReportingExport from "./ReportingExport";

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
  motto: string | null;
  akzentfarbe: string | null;
  hero_bild_url: string | null;
  slug: string | null;
  datenschutz_url: string | null;
  datenschutz_text: string | null;
  rechnungslogo_breite: number | null;
  sla_stunden: number | null;
}

type VerwaltungsTab = "firma" | "team" | "kunden" | "werkzeuge";

interface VerwaltungProps {
  rolle: Rolle;
  organisationId: string | null;
  onlineIds?: Set<string>;
  initialTab?: VerwaltungsTab;
}

export default function Verwaltung({ rolle, organisationId, onlineIds, initialTab = "firma" }: VerwaltungProps) {
  const [aktiveTab, setAktiveTab] = useState<VerwaltungsTab>(initialTab);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgAdresse, setOrgAdresse] = useState("");
  const [orgTelefon, setOrgTelefon] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [orgOeffnungszeiten, setOrgOeffnungszeiten] = useState("");
  const [orgStandardpreisEuro, setOrgStandardpreisEuro] = useState("");
  const [orgMotto, setOrgMotto] = useState("");
  const [orgAkzentfarbe, setOrgAkzentfarbe] = useState("#f59e0b");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugKopiert, setSlugKopiert] = useState(false);
  const [orgDatenschutzUrl, setOrgDatenschutzUrl] = useState("");
  const [orgDatenschutzText, setOrgDatenschutzText] = useState("");
  const [orgRechnungslogoBreite, setOrgRechnungslogoBreite] = useState("80");
  const [orgSlaStunden, setOrgSlaStunden] = useState("");

  const [neuerMitarbeiterEmail, setNeuerMitarbeiterEmail] = useState("");
  const [neuerMitarbeiterVorname, setNeuerMitarbeiterVorname] = useState("");
  const [neuerMitarbeiterNachname, setNeuerMitarbeiterNachname] = useState("");
  const [neuerMitarbeiterTelefon, setNeuerMitarbeiterTelefon] = useState("");
  const [neuerMitarbeiterPasswort, setNeuerMitarbeiterPasswort] = useState("");
  const [neuerMitarbeiterRolle, setNeuerMitarbeiterRolle] = useState<"techniker" | "org_admin">(
    "techniker",
  );
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);
  const [zeigeMitarbeiterAnlegen, setZeigeMitarbeiterAnlegen] = useState(false);
  const [zeigeNutzerZuweisen, setZeigeNutzerZuweisen] = useState(false);
  const [zuweisenEmail, setZuweisenEmail] = useState("");
  const [zuweisenRolle, setZuweisenRolle] = useState<"techniker" | "org_admin">("techniker");
  const [mitarbeiterZugangsdaten, setMitarbeiterZugangsdaten] = useState<
    { email: string; passwort?: string; link?: string; telefon?: string } | null
  >(null);

  const [neuerKundeEmail, setNeuerKundeEmail] = useState("");
  const [neuerKundeVorname, setNeuerKundeVorname] = useState("");
  const [neuerKundeNachname, setNeuerKundeNachname] = useState("");
  const [neuerKundeTelefon, setNeuerKundeTelefon] = useState("");
  const [neuerKundeStrasse, setNeuerKundeStrasse] = useState("");
  const [neuerKundeHausnummer, setNeuerKundeHausnummer] = useState("");
  const [neuerKundePlz, setNeuerKundePlz] = useState("");
  const [neuerKundeOrt, setNeuerKundeOrt] = useState("");
  const [neuerKundeLand, setNeuerKundeLand] = useState("Deutschland");
  const [neuerKundeMwstSatz, setNeuerKundeMwstSatz] = useState("19");
  const [neuerKundeUstId, setNeuerKundeUstId] = useState("");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId]);

  async function ladeOrganisation() {
    const { data } = await supabase
      .from("organisationen")
      .select(
        "id, name, logo_url, adresse, telefon, email, website, oeffnungszeiten, standard_preis_pro_minute_cent, motto, akzentfarbe, hero_bild_url, slug, datenschutz_url, datenschutz_text, rechnungslogo_breite, sla_stunden",
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
      setOrgMotto(data.motto ?? "");
      setOrgAkzentfarbe(data.akzentfarbe ?? "#f59e0b");
      setOrgSlug(data.slug ?? "");
      setOrgDatenschutzUrl(data.datenschutz_url ?? "");
      setOrgDatenschutzText(data.datenschutz_text ?? "");
      setOrgRechnungslogoBreite(String(data.rechnungslogo_breite ?? 80));
      setOrgSlaStunden(data.sla_stunden != null ? String(data.sla_stunden) : "");
    }
  }

  async function organisationSpeichern() {
    if (!organisation) return;

    let standardpreisCent: number | null = organisation.standard_preis_pro_minute_cent;
    let preisFehler: string | null = null;
    if (orgStandardpreisEuro.trim() !== "") {
      const wert = parseFloat(orgStandardpreisEuro.trim().replace(",", "."));
      if (isNaN(wert)) {
        preisFehler = "Ungültiger Standardpreis – andere Felder wurden trotzdem gespeichert.";
      } else {
        standardpreisCent = Math.round(wert * 100);
      }
    } else {
      standardpreisCent = null;
    }

    setLaedt(true);
    const normalisierterSlug =
      orgSlug
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || null;

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
        motto: orgMotto.trim() || null,
        akzentfarbe: orgAkzentfarbe || null,
        slug: normalisierterSlug,
        datenschutz_url: orgDatenschutzUrl.trim() || null,
        datenschutz_text: orgDatenschutzText.trim() || null,
        rechnungslogo_breite: orgRechnungslogoBreite.trim()
          ? Math.max(20, Math.min(300, Number(orgRechnungslogoBreite)))
          : 80,
        sla_stunden: orgSlaStunden.trim() ? Math.max(1, Number(orgSlaStunden)) : null,
      })
      .eq("id", organisation.id);
    setLaedt(false);
    if (error) {
      setHinweis(
        error.message.includes("duplicate")
          ? "Dieser Link-Name ist schon vergeben, bitte einen anderen wählen."
          : "Speichern fehlgeschlagen.",
      );
      return;
    }
    setOrgSlug(normalisierterSlug ?? "");
    setOrganisation({
      ...organisation,
      slug: normalisierterSlug,
      standard_preis_pro_minute_cent: standardpreisCent,
      datenschutz_url: orgDatenschutzUrl.trim() || null,
      datenschutz_text: orgDatenschutzText.trim() || null,
      rechnungslogo_breite: orgRechnungslogoBreite.trim()
        ? Math.max(20, Math.min(300, Number(orgRechnungslogoBreite)))
        : 80,
      sla_stunden: orgSlaStunden.trim() ? Math.max(1, Number(orgSlaStunden)) : null,
    });
    setHinweis(preisFehler ?? "Gespeichert.");
  }

  async function logoHochladen(datei: File) {
    if (!organisation) return;
    setHinweis(null);

    const fehlermeldung = await pruefeBild(datei, { maxSizeMb: 3, minDimensionPx: 400 });
    if (fehlermeldung && fehlermeldung.includes("zu groß")) {
      setHinweis(fehlermeldung);
      return;
    }

    setLaedt(true);
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
      setHinweis(fehlermeldung ?? "Logo aktualisiert.");
    } catch (err) {
      console.error(err);
      setHinweis("Logo-Upload fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }

  async function heroBildHochladen(datei: File) {
    if (!organisation) return;
    setHinweis(null);

    const fehlermeldung = await pruefeBild(datei, { maxSizeMb: 5, minDimensionPx: 800 });
    if (fehlermeldung && fehlermeldung.includes("zu groß")) {
      setHinweis(fehlermeldung);
      return;
    }

    setLaedt(true);
    try {
      const pfad = `${organisation.id}/hero-${Date.now()}-${sichererDateiname(datei.name)}`;
      const { error: uploadFehler } = await supabase.storage
        .from("logos")
        .upload(pfad, datei, { upsert: true });
      if (uploadFehler) throw uploadFehler;

      const { data: oeffentlich } = supabase.storage.from("logos").getPublicUrl(pfad);
      const { error: updateFehler } = await supabase
        .from("organisationen")
        .update({ hero_bild_url: oeffentlich.publicUrl })
        .eq("id", organisation.id);
      if (updateFehler) throw updateFehler;

      setOrganisation({ ...organisation, hero_bild_url: oeffentlich.publicUrl });
      setHinweis(fehlermeldung ?? "Bild aktualisiert.");
    } catch (err) {
      console.error(err);
      setHinweis("Bild-Upload fehlgeschlagen.");
    } finally {
      setLaedt(false);
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
          vorname: neuerKundeVorname.trim() || null,
          nachname: neuerKundeNachname.trim() || null,
          organisationId,
          passwort: neuerKundePasswort.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Anlegen fehlgeschlagen");

      if (
        json.userId &&
        (neuerKundeTelefon || neuerKundeStrasse || neuerKundeHausnummer || neuerKundePlz || neuerKundeOrt || neuerKundeNotizen)
      ) {
        await supabase
          .from("profiles")
          .update({
            telefonnummer: neuerKundeTelefon.trim() || null,
            strasse: neuerKundeStrasse.trim() || null,
            hausnummer: neuerKundeHausnummer.trim() || null,
            plz: neuerKundePlz.trim() || null,
            ort: neuerKundeOrt.trim() || null,
            land: neuerKundeLand || null,
            ust_id: neuerKundeUstId.trim() || null,
            mwst_satz: neuerKundeMwstSatz.trim() === "" ? null : Number(neuerKundeMwstSatz),
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
      setNeuerKundeVorname("");
      setNeuerKundeNachname("");
      setNeuerKundeTelefon("");
      setNeuerKundeStrasse("");
      setNeuerKundeHausnummer("");
      setNeuerKundePlz("");
      setNeuerKundeOrt("");
      setNeuerKundeLand("Deutschland");
      setNeuerKundeMwstSatz("19");
      setNeuerKundeUstId("");
      setNeuerKundeNotizen("");
      setNeuerKundePasswort("");
      setZeigeKundeAnlegen(false);
      setKundenRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setHinweis(err instanceof Error ? err.message : "Kunde anlegen fehlgeschlagen.");
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
            vorname: neuerMitarbeiterVorname.trim() || null,
            nachname: neuerMitarbeiterNachname.trim() || null,
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
      setNeuerMitarbeiterVorname("");
      setNeuerMitarbeiterNachname("");
      setNeuerMitarbeiterTelefon("");
      setNeuerMitarbeiterPasswort("");
      setZeigeMitarbeiterAnlegen(false);
      setTeamRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setHinweis(err instanceof Error ? err.message : "Anlegen fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }

  async function nutzerZuweisen() {
    if (!zuweisenEmail.trim() || !organisationId) return;
    setLaedt(true);
    setHinweis(null);
    setMitarbeiterZugangsdaten(null);

    const { data: sessionData } = await supabase.auth.getSession();

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zuweise-bestehenden-nutzer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email: zuweisenEmail.trim(),
            organisationId,
            rolle: zuweisenRolle,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Zuweisen fehlgeschlagen");

      setHinweis(`${json.name ?? zuweisenEmail} ist jetzt Teil dieser Firma.`);
      setZuweisenEmail("");
      setZeigeNutzerZuweisen(false);
      setTeamRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setHinweis(err instanceof Error ? err.message : "Zuweisen fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text-strong)]">
          Verwaltung{organisation && rolle === "super_admin" ? ` – ${organisation.name}` : ""}
        </h2>
      </div>

      {/* Tab-Leiste */}
      <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
        {([
          { id: "firma", label: "🏢 Firma" },
          { id: "team", label: "👥 Team" },
          { id: "kunden", label: "🤝 Kunden" },
          { id: "werkzeuge", label: "🔧 Werkzeuge" },
        ] as { id: VerwaltungsTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setAktiveTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
              aktiveTab === t.id
                ? "bg-[var(--bg-surface)] text-[var(--text-strong)] shadow-sm"
                : "text-[var(--text-faint)] hover:text-[var(--text-soft)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Hinweis wenn kein Inhalt */}
      {!organisationId && aktiveTab !== "firma" && (
        <p className="text-sm text-[var(--text-faint)]">Bitte zuerst eine Firma auswählen.</p>
      )}

      {aktiveTab === "firma" && organisation && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">Firmenprofil</h3>
          <div className="flex items-center gap-4">
            {organisation.logo_url && (
              <img src={organisation.logo_url} alt={organisation.name} className="h-10 w-10 shrink-0 rounded bg-[var(--bg-muted)] object-contain p-0.5" />
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
          <p className="text-xs text-[var(--text-faint)]">
            Empfohlen: quadratisch, mind. 400×400px, max. 3 MB. Wird auf der Registrierungsseite
            bis zu 192×192px groß angezeigt.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              Logo-Breite auf der Rechnung
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={20}
                max={300}
                value={orgRechnungslogoBreite}
                onChange={(e) => setOrgRechnungslogoBreite(e.target.value)}
                className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <span className="text-xs text-[var(--text-faint)]">px (20–300, Standard 80)</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              SLA-Reaktionszeit (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={orgSlaStunden}
                onChange={(e) => setOrgSlaStunden(e.target.value)}
                placeholder="leer = kein SLA"
                className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <span className="text-xs text-[var(--text-faint)]">Stunden</span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              Tickets ohne Antwort innerhalb dieser Frist werden in der Übersicht als überfällig
              markiert.
            </p>
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

          <div className="border-t border-[var(--border)] pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
              Individualisierung
            </p>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                Motto / Begrüßungszeile
              </label>
              <input
                type="text"
                value={orgMotto}
                onChange={(e) => setOrgMotto(e.target.value)}
                placeholder='z.B. "Schnelle Hilfe, persönlich betreut"'
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                Akzentfarbe
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={orgAkzentfarbe}
                  onChange={(e) => setOrgAkzentfarbe(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-[var(--border-input)] bg-[var(--bg-surface)]"
                />
                <input
                  type="text"
                  value={orgAkzentfarbe}
                  onChange={(e) => setOrgAkzentfarbe(e.target.value)}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-mono"
                />
              </div>
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                Ersetzt die Button- und Akzentfarbe überall in der App für eure Mitarbeiter und
                Kunden.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                Bild für die Startseite (optional)
              </label>
              {organisation?.hero_bild_url && (
                <img
                  src={organisation.hero_bild_url}
                  alt=""
                  className="mb-2 h-24 w-full rounded object-cover"
                />
              )}
              <label className="block cursor-pointer rounded border border-dashed border-[var(--border-input)] px-3 py-2 text-center text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                {organisation?.hero_bild_url ? "Bild ändern" : "+ Bild hochladen"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && heroBildHochladen(e.target.files[0])}
                />
              </label>
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                Empfohlen: Querformat, mind. 800px breit, max. 5 MB.
              </p>
            </div>

            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                Registrierungslink für Kunden
              </label>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-[var(--text-faint)]">{window.location.origin}/?neukunde=</span>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  placeholder="meine-firma"
                  className="min-w-0 flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm text-[var(--text-strong)]"
                />
              </div>
              {organisation?.slug && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="flex-1 truncate font-mono text-xs text-[var(--text-soft)]">
                    {window.location.origin}/?neukunde={organisation.slug}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/?neukunde=${organisation.slug}`,
                      );
                      setSlugKopiert(true);
                      setTimeout(() => setSlugKopiert(false), 2000);
                    }}
                    className="shrink-0 rounded border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                  >
                    {slugKopiert ? "Kopiert ✓" : "Kopieren"}
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                Diesen Link auf eurer Website verlinken – Kunden können sich darüber selbst
                registrieren und landen direkt bei eurer Firma.
              </p>
              {hinweis && <p className="mt-2 text-xs text-[var(--text-soft)]">{hinweis}</p>}
            </div>

            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                Datenschutzerklärung
              </label>
              <p className="mb-2 text-xs text-[var(--text-faint)]">
                Wird Kunden bei der Registrierung als Pflicht-Link angezeigt. Entweder eine
                bestehende Seite verlinken, oder euren eigenen Text einfügen (z.B. von einem
                Generator wie eRecht24 oder Datenschutz-Generator.de erstellt) – dann zeigen wir
                ihn als eigene Seite innerhalb der App an. Link hat Vorrang, falls beides
                ausgefüllt ist.
              </p>
              <input
                type="text"
                value={orgDatenschutzUrl}
                onChange={(e) => setOrgDatenschutzUrl(e.target.value)}
                placeholder="https://eure-firma.de/datenschutz (optional)"
                className="mb-2 w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <textarea
                value={orgDatenschutzText}
                onChange={(e) => setOrgDatenschutzText(e.target.value)}
                rows={6}
                placeholder="Oder hier den vollständigen Text eurer Datenschutzerklärung einfügen…"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
            </div>
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

      {aktiveTab === "team" && organisationId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-strong)]">Team</h3>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setZeigeNutzerZuweisen((v) => !v);
                  setZeigeMitarbeiterAnlegen(false);
                }}
                className="text-xs text-amber-600 hover:underline"
              >
                {zeigeNutzerZuweisen ? "Abbrechen" : "Bestehenden Nutzer zuweisen"}
              </button>
              <button
                onClick={() => {
                  setZeigeMitarbeiterAnlegen((v) => !v);
                  setZeigeNutzerZuweisen(false);
                }}
                className="text-xs text-amber-600 hover:underline"
              >
                {zeigeMitarbeiterAnlegen ? "Abbrechen" : "+ Mitarbeiter anlegen"}
              </button>
            </div>
          </div>

          {zeigeNutzerZuweisen && (
            <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs text-[var(--text-faint)]">
                Für Personen, die schon einen Account haben (z.B. bei einer anderen Firma oder
                bereits als Kunde) – wird hier neu zugeordnet, kein neuer Account nötig.
              </p>
              <input
                type="email"
                value={zuweisenEmail}
                onChange={(e) => setZuweisenEmail(e.target.value)}
                placeholder="E-Mail des bestehenden Accounts"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <select
                value={zuweisenRolle}
                onChange={(e) => setZuweisenRolle(e.target.value as typeof zuweisenRolle)}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              >
                <option value="techniker">Techniker</option>
                <option value="org_admin">Org-Admin</option>
              </select>
              <button
                onClick={nutzerZuweisen}
                disabled={laedt}
                className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {laedt ? "Wird zugewiesen…" : "Zuweisen"}
              </button>
            </div>
          )}

          {zeigeMitarbeiterAnlegen && (
            <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <input
                type="email"
                value={neuerMitarbeiterEmail}
                onChange={(e) => setNeuerMitarbeiterEmail(e.target.value)}
                placeholder="E-Mail (für die Einladung)"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerMitarbeiterVorname}
                  onChange={(e) => setNeuerMitarbeiterVorname(e.target.value)}
                  placeholder="Vorname"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={neuerMitarbeiterNachname}
                  onChange={(e) => setNeuerMitarbeiterNachname(e.target.value)}
                  placeholder="Nachname"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                />
              </div>
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
                className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
            onlineIds={onlineIds}
          />
        </div>
      )}

      {aktiveTab === "kunden" && organisationId && (
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerKundeVorname}
                  onChange={(e) => setNeuerKundeVorname(e.target.value)}
                  placeholder="Vorname"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={neuerKundeNachname}
                  onChange={(e) => setNeuerKundeNachname(e.target.value)}
                  placeholder="Nachname"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>
              <input
                type="text"
                value={neuerKundeTelefon}
                onChange={(e) => setNeuerKundeTelefon(e.target.value)}
                placeholder="Telefon / WhatsApp (optional)"
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerKundeStrasse}
                  onChange={(e) => setNeuerKundeStrasse(e.target.value)}
                  placeholder="Straße (optional)"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={neuerKundeHausnummer}
                  onChange={(e) => setNeuerKundeHausnummer(e.target.value)}
                  placeholder="Nr."
                  className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerKundePlz}
                  onChange={(e) => setNeuerKundePlz(e.target.value)}
                  placeholder="PLZ"
                  className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={neuerKundeOrt}
                  onChange={(e) => setNeuerKundeOrt(e.target.value)}
                  placeholder="Ort"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={neuerKundeLand}
                  onChange={(e) => {
                    const land = e.target.value;
                    setNeuerKundeLand(land);
                    if (LAENDER_MWST[land] !== undefined) {
                      setNeuerKundeMwstSatz(String(LAENDER_MWST[land]));
                    }
                  }}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                >
                  {LAENDER_LISTE.map((land) => (
                    <option key={land} value={land}>
                      {land}
                    </option>
                  ))}
                </select>
                <div className="flex w-28 items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={neuerKundeMwstSatz}
                    onChange={(e) => setNeuerKundeMwstSatz(e.target.value)}
                    placeholder="MwSt."
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <span className="text-xs text-[var(--text-faint)]">%</span>
                </div>
              </div>
              <input
                type="text"
                value={neuerKundeUstId}
                onChange={(e) => setNeuerKundeUstId(e.target.value)}
                placeholder="USt-IdNr. (optional, z.B. ATU12345678)"
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
                className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
            onlineIds={onlineIds}
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <VorlagenVerwaltung organisationId={organisationId} />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <MakroVerwaltung organisationId={organisationId} />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <TagVerwaltung organisationId={organisationId} />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <SlaVerwaltung organisationId={organisationId} />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <FaqVerwaltung organisationId={organisationId} />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <ReportingExport organisationId={organisationId} />
        </div>
      )}

      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
    </div>
  );
}
