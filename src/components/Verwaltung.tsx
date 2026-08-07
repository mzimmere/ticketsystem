import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import { pruefeBild } from "../lib/bildvalidierung";
import { generierePasswort } from "../lib/passwort";
import { LAENDER_MWST, LAENDER_LISTE } from "../lib/laender";
import KundenListe from "./KundenListe";
import DongleLizenzVerwaltung from "./DongleLizenzVerwaltung";
import MitarbeiterListe from "./MitarbeiterListe";
import ZugangsdatenBox from "./ZugangsdatenBox";
import VorlagenVerwaltung from "./VorlagenVerwaltung";
import MakroVerwaltung from "./MakroVerwaltung";
import TagVerwaltung from "./TagVerwaltung";
import SlaVerwaltung from "./SlaVerwaltung";
import LizenzVerlaengerungen from "./LizenzVerlaengerungen";
import HardwareKategorienVerwaltung from "./HardwareKategorienVerwaltung";
import FaqVerwaltung from "./FaqVerwaltung";
import ReportingExport from "./ReportingExport";
import IntegrationenVerwaltung from "./IntegrationenVerwaltung";
import EmailTexteVerwaltung from "./EmailTexteVerwaltung";
import KonfigurationsHilfe from "./KonfigurationsHilfe";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

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

type VerwaltungsTab = "firma" | "team" | "kunden" | "dongles" | "werkzeuge" | "integrationen";

interface VerwaltungProps {
  rolle: Rolle;
  organisationId: string | null;
  onlineIds?: Set<string>;
  initialTab?: VerwaltungsTab;
}

export default function Verwaltung({ rolle, organisationId, onlineIds, initialTab = "firma" }: VerwaltungProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).verwaltung;
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
  const [orgAkzentfarbe, setOrgAkzentfarbe] = useState("#0e6e8c");
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
      setOrgAkzentfarbe(data.akzentfarbe ?? "#0e6e8c");
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
        preisFehler = txt.fehlerUngueltigerPreis;
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
          ? txt.fehlerSlugVergeben
          : txt.fehlerSpeichern,
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
    setHinweis(preisFehler ?? txt.erfolgGespeichert);
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
      setHinweis(fehlermeldung ?? txt.erfolgLogoAktualisiert);
    } catch (err) {
      console.error(err);
      setHinweis(txt.fehlerLogoUpload);
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
      setHinweis(fehlermeldung ?? txt.erfolgBildAktualisiert);
    } catch (err) {
      console.error(err);
      setHinweis(txt.fehlerBildUpload);
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
      setHinweis(err instanceof Error ? err.message : txt.fehlerAnlegenFehlgeschlagen);
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
      setHinweis(err instanceof Error ? err.message : txt.fehlerAnlegenFehlgeschlagen);
    } finally {
      setLaedt(false);
    }
  }

  async function nutzerZuweisen(bestaetigt = false) {
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
            bestaetigt,
          }),
        },
      );
      const json = await res.json();

      if (!res.ok) {
        if (json.warnung) {
          setLaedt(false);
          if (confirm(`${json.meldung}\n\n${txt.trotzdemZuweisen}`)) {
            await nutzerZuweisen(true);
          } else {
            setHinweis(txt.abgebrochenNiemand);
          }
          return;
        }
        throw new Error(json.error ?? txt.fehlerZuweisenFehlgeschlagen);
      }

      setHinweis(`${json.name ?? zuweisenEmail} ${txt.istJetztTeilDieserFirma}`);
      setZuweisenEmail("");
      setZeigeNutzerZuweisen(false);
      setTeamRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setHinweis(err instanceof Error ? err.message : txt.fehlerZuweisenFehlgeschlagen);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text-strong)]">
          {txt.titel}{organisation && rolle === "super_admin" ? ` – ${organisation.name}` : ""}
        </h2>
      </div>

      {/* Tab-Leiste */}
      <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
        {([
          { id: "firma", label: txt.tabFirma },
          { id: "team", label: txt.tabTeam },
          { id: "kunden", label: txt.tabKunden },
          { id: "dongles", label: txt.tabDongles },
          { id: "werkzeuge", label: txt.tabWerkzeuge },
          { id: "integrationen", label: txt.tabIntegrationen },
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
        <p className="text-sm text-[var(--text-faint)]">{txt.bitteFirmaWaehlen}</p>
      )}

      {aktiveTab === "firma" && organisation && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.firmenprofil}</h3>
          <div className="flex items-center gap-4">
            {organisation.logo_url && (
              <img src={organisation.logo_url} alt={organisation.name} className="h-10 w-10 shrink-0 rounded bg-[var(--bg-muted)] object-contain p-0.5" />
            )}
            <label className="cursor-pointer rounded border border-[var(--border-input)] bg-[var(--bg-surface)] text-[var(--text-strong)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
              {txt.logoAendern}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && logoHochladen(e.target.files[0])}
              />
            </label>
          </div>
          <p className="text-xs text-[var(--text-faint)]">
            {txt.logoHinweis}
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              {txt.logoBreiteLabel}
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
              <span className="text-xs text-[var(--text-faint)]">{txt.pxHinweis}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              {txt.slaReaktionszeitLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={orgSlaStunden}
                onChange={(e) => setOrgSlaStunden(e.target.value)}
                placeholder={txt.slaPlatzhalter}
                className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <span className="text-xs text-[var(--text-faint)]">{txt.stunden}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              {txt.slaHinweis}
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={txt.firmennamePlatzhalter}
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              {txt.adresseLabel}
            </label>
            <textarea
              value={orgAdresse}
              onChange={(e) => setOrgAdresse(e.target.value)}
              rows={2}
              placeholder={txt.adressePlatzhalter}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                {txt.telefonLabel}
              </label>
              <input
                type="text"
                value={orgTelefon}
                onChange={(e) => setOrgTelefon(e.target.value)}
                placeholder={txt.telefonPlatzhalter}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                {txt.emailLabel}
              </label>
              <input
                type="email"
                value={orgEmail}
                onChange={(e) => setOrgEmail(e.target.value)}
                placeholder={txt.emailPlatzhalter}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              {txt.websiteLabel}
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
              {txt.oeffnungszeitenLabel}
            </label>
            <input
              type="text"
              value={orgOeffnungszeiten}
              onChange={(e) => setOrgOeffnungszeiten(e.target.value)}
              placeholder={txt.oeffnungszeitenPlatzhalter}
              className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              {txt.standardpreisLabel}
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
              {txt.individualisierung}
            </p>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                {txt.mottoLabel}
              </label>
              <input
                type="text"
                value={orgMotto}
                onChange={(e) => setOrgMotto(e.target.value)}
                placeholder={txt.mottoPlatzhalter}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                {txt.akzentfarbeLabel}
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
                {txt.akzentfarbeHinweis}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                {txt.heroBildLabel}
              </label>
              {organisation?.hero_bild_url && (
                <img
                  src={organisation.hero_bild_url}
                  alt=""
                  className="mb-2 h-24 w-full rounded object-cover"
                />
              )}
              <label className="block cursor-pointer rounded border border-dashed border-[var(--border-input)] px-3 py-2 text-center text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                {organisation?.hero_bild_url ? txt.heroBildAendern : txt.heroBildHochladen}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && heroBildHochladen(e.target.files[0])}
                />
              </label>
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                {txt.heroBildHinweis}
              </p>
            </div>

            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                {txt.registrierungslinkLabel}
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
                    {slugKopiert ? txt.kopiert : txt.kopieren}
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                {txt.registrierungslinkHinweis}
              </p>
              {hinweis && <p className="mt-2 text-xs text-[var(--text-soft)]">{hinweis}</p>}
            </div>

            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                {txt.datenschutzLabel}
              </label>
              <p className="mb-2 text-xs text-[var(--text-faint)]">
                {txt.datenschutzHinweis}
              </p>
              <input
                type="text"
                value={orgDatenschutzUrl}
                onChange={(e) => setOrgDatenschutzUrl(e.target.value)}
                placeholder={txt.datenschutzUrlPlatzhalter}
                className="mb-2 w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <textarea
                value={orgDatenschutzText}
                onChange={(e) => setOrgDatenschutzText(e.target.value)}
                rows={6}
                placeholder={txt.datenschutzTextPlatzhalter}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            onClick={organisationSpeichern}
            disabled={laedt}
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {laedt ? txt.speichert : txt.speichern}
          </button>
        </div>
      )}

      {aktiveTab === "team" && organisationId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.team}</h3>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setZeigeNutzerZuweisen((v) => !v);
                  setZeigeMitarbeiterAnlegen(false);
                }}
                className="text-xs text-amber-600 hover:underline"
              >
                {zeigeNutzerZuweisen ? txt.abbrechen : txt.bestehendenNutzerZuweisen}
              </button>
              <button
                onClick={() => {
                  setZeigeMitarbeiterAnlegen((v) => !v);
                  setZeigeNutzerZuweisen(false);
                }}
                className="text-xs text-amber-600 hover:underline"
              >
                {zeigeMitarbeiterAnlegen ? txt.abbrechen : txt.mitarbeiterAnlegenPlus}
              </button>
            </div>
          </div>

          {zeigeNutzerZuweisen && (
            <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs text-[var(--text-faint)]">
                {txt.zuweisenHinweis}
              </p>
              <input
                type="email"
                value={zuweisenEmail}
                onChange={(e) => setZuweisenEmail(e.target.value)}
                placeholder={txt.emailBestehenderAccount}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <select
                value={zuweisenRolle}
                onChange={(e) => setZuweisenRolle(e.target.value as typeof zuweisenRolle)}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              >
                <option value="techniker">{txt.techniker}</option>
                <option value="org_admin">{txt.orgAdmin}</option>
              </select>
              <button
                onClick={() => nutzerZuweisen()}
                disabled={laedt}
                className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {laedt ? txt.wirdZugewiesen : txt.zuweisen}
              </button>
            </div>
          )}

          {zeigeMitarbeiterAnlegen && (
            <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <input
                type="email"
                value={neuerMitarbeiterEmail}
                onChange={(e) => setNeuerMitarbeiterEmail(e.target.value)}
                placeholder={txt.emailEinladungPlatzhalter}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerMitarbeiterVorname}
                  onChange={(e) => setNeuerMitarbeiterVorname(e.target.value)}
                  placeholder={txt.vornamePlatzhalter}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={neuerMitarbeiterNachname}
                  onChange={(e) => setNeuerMitarbeiterNachname(e.target.value)}
                  placeholder={txt.nachnamePlatzhalter}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                />
              </div>
              <input
                type="text"
                value={neuerMitarbeiterTelefon}
                onChange={(e) => setNeuerMitarbeiterTelefon(e.target.value)}
                placeholder={txt.telefonOptionalPlatzhalter}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              />
              <select
                value={neuerMitarbeiterRolle}
                onChange={(e) =>
                  setNeuerMitarbeiterRolle(e.target.value as typeof neuerMitarbeiterRolle)
                }
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
              >
                <option value="techniker">{txt.techniker}</option>
                <option value="org_admin">{txt.orgAdmin}</option>
              </select>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerMitarbeiterPasswort}
                  onChange={(e) => setNeuerMitarbeiterPasswort(e.target.value)}
                  placeholder={txt.passwortOptionalPlatzhalter}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setNeuerMitarbeiterPasswort(generierePasswort())}
                  className="rounded border border-[var(--border-input)] px-3 py-2 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                >
                  {txt.generieren}
                </button>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                {txt.passwortHinweis}
              </p>

              <button
                onClick={mitarbeiterAnlegen}
                disabled={laedt}
                className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {laedt
                  ? txt.wirdAngelegt
                  : neuerMitarbeiterPasswort.trim()
                  ? txt.mitarbeiterMitPasswort
                  : txt.mitarbeiterLinkErzeugen}
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
            <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.kunden}</h3>
            <button
              onClick={() => setZeigeKundeAnlegen((v) => !v)}
              className="text-xs text-amber-600 hover:underline"
            >
              {zeigeKundeAnlegen ? txt.abbrechen : txt.kundeAnlegenPlus}
            </button>
          </div>

          {zeigeKundeAnlegen && (
            <div className="space-y-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <input
                type="email"
                value={neuerKundeEmail}
                onChange={(e) => setNeuerKundeEmail(e.target.value)}
                placeholder={txt.emailEinladungPlatzhalter}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerKundeVorname}
                  onChange={(e) => setNeuerKundeVorname(e.target.value)}
                  placeholder={txt.vornamePlatzhalter}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={neuerKundeNachname}
                  onChange={(e) => setNeuerKundeNachname(e.target.value)}
                  placeholder={txt.nachnamePlatzhalter}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>
              <input
                type="text"
                value={neuerKundeTelefon}
                onChange={(e) => setNeuerKundeTelefon(e.target.value)}
                placeholder={txt.telefonWhatsappOptional}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerKundeStrasse}
                  onChange={(e) => setNeuerKundeStrasse(e.target.value)}
                  placeholder={txt.strasseOptional}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={neuerKundeHausnummer}
                  onChange={(e) => setNeuerKundeHausnummer(e.target.value)}
                  placeholder={txt.nrLabel}
                  className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerKundePlz}
                  onChange={(e) => setNeuerKundePlz(e.target.value)}
                  placeholder={txt.plzLabel}
                  className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={neuerKundeOrt}
                  onChange={(e) => setNeuerKundeOrt(e.target.value)}
                  placeholder={txt.ortLabel}
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
                    placeholder={txt.mwstPlatzhalter}
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <span className="text-xs text-[var(--text-faint)]">%</span>
                </div>
              </div>
              <input
                type="text"
                value={neuerKundeUstId}
                onChange={(e) => setNeuerKundeUstId(e.target.value)}
                placeholder={txt.ustIdOptional}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
              <textarea
                value={neuerKundeNotizen}
                onChange={(e) => setNeuerKundeNotizen(e.target.value)}
                placeholder={txt.notizenOptional}
                rows={2}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  value={neuerKundePasswort}
                  onChange={(e) => setNeuerKundePasswort(e.target.value)}
                  placeholder={txt.passwortOptionalPlatzhalter}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <button
                  type="button"
                  onClick={() => setNeuerKundePasswort(generierePasswort())}
                  className="rounded border border-[var(--border-input)] px-3 py-2 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                >
                  {txt.generieren}
                </button>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                {txt.passwortHinweis}
              </p>

              <button
                onClick={kundeAnlegen}
                disabled={laedt}
                className="w-full rounded bg-akzent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {laedt
                  ? txt.wirdAngelegt
                  : neuerKundePasswort.trim()
                  ? txt.kundeMitPasswort
                  : txt.kundeLinkErzeugen}
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

      {aktiveTab === "dongles" && organisationId && (
        <DongleLizenzVerwaltung organisationId={organisationId} />
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <VorlagenVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Ticket-Vorlagen verwenden"
            schritte={[
              { nr: 1, titel: "Vorlage anlegen", beschreibung: "Name, vorausgefüllten Titel, Beschreibung und Priorität eingeben. Typische Vorlagen: 'VPN-Problem', 'Drucker offline', 'Passwort zurücksetzen'." },
              { nr: 2, titel: "Beim neuen Ticket auswählen", beschreibung: "Wenn ein Techniker oder Kunde ein neues Ticket anlegt, erscheint oben ein '📋 Vorlage auswählen…'-Dropdown. Nach der Auswahl werden Titel, Beschreibung und Priorität vorausgefüllt – alles bleibt danach bearbeitbar." },
              { nr: 3, titel: "Spart Zeit bei Standardproblemen", beschreibung: "Für wiederkehrende Anfragen (Onboarding neuer Mitarbeiter, regelmäßige Wartungen) die immer gleiche Checkliste vorbereiten." },
            ]}
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <MakroVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Makros (Textbausteine) verwenden"
            schritte={[
              { nr: 1, titel: "Makro anlegen", beschreibung: "Einen Titel (z.B. 'Passwort zurückgesetzt') und den fertig formulierten Antworttext eingeben. Mehrere Makros für häufige Situationen anlegen." },
              { nr: 2, titel: "Im Ticket einfügen", beschreibung: "Im Ticket-Verlauf erscheint über dem Antwortfeld ein '📋 Makro einfügen…'-Dropdown. Auswahl fügt den Text direkt ins Antwortfeld ein – danach noch personalisieren und senden." },
            ]}
            hinweis="Makros unterscheiden sich von Vorlagen: Vorlagen füllen ein neues Ticket vor, Makros fügen Text ins Antwortfeld eines bestehenden Tickets ein."
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <TagVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Tags / Kategorien verwenden"
            schritte={[
              { nr: 1, titel: "Tags anlegen", beschreibung: "Name und Farbe wählen. Sinnvolle Tags: Hardware, Software, Netzwerk, Drucker, Passwort, Onboarding, Dringend." },
              { nr: 2, titel: "Tickets taggen", beschreibung: "Im Ticket-Detail gibt es einen '+ Tag'-Button. Mehrere Tags pro Ticket möglich. Tags sind auch für Kunden sichtbar." },
              { nr: 3, titel: "In der Übersicht filtern", beschreibung: "In der Ticket-Übersicht erscheinen alle vergebenen Tags als Filter-Buttons. Klick auf einen Tag zeigt nur Tickets mit diesem Tag." },
            ]}
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <HardwareKategorienVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Kunden-Hardware erfassen"
            schritte={[
              { nr: 1, titel: "Kategorien anlegen", beschreibung: "Z.B. Intraoral-Scanner, Desktop-Scanner, Exocad-Datenbank (lokal/SQL-Server), Fräsmaschine, Drucker. Ganz nach eurem Bedarf." },
              { nr: 2, titel: "Beim Kunden oder im Ticket erfassen", beschreibung: "In der Kundenliste und direkt im Ticket lässt sich pro Kategorie ein Wert per Klick aus bereits verwendeten Vorschlägen übernehmen oder frei eintippen." },
              { nr: 3, titel: "Mehrfachwerte möglich", beschreibung: "Ein Kunde kann z.B. zwei Fräsmaschinen unterschiedlicher Hersteller haben – einfach beide als eigene Chips hinzufügen." },
            ]}
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <SlaVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="SLA & Automatisierung konfigurieren"
            schritte={[
              { nr: 1, titel: "Reaktionszeiten festlegen", beschreibung: "Für jede Priorität (Niedrig bis Kritisch) eine Reaktionszeit (erste Antwort) und Lösungszeit in Stunden eingeben. Beispiel: Kritisch = 1h Reaktion / 4h Lösung." },
              { nr: 2, titel: "SLA aktivieren", beschreibung: "Checkbox 'SLA-Fristen aktiv' einschalten. Ab sofort bekommen neue Tickets automatisch Fälligkeitsdaten berechnet – direkt beim Anlegen." },
              { nr: 3, titel: "Überfällige Tickets erkennen", beschreibung: "Im Ticket-Detail erscheint ein roter Hinweis wenn die Reaktions- oder Lösungsfrist überschritten ist." },
              { nr: 4, titel: "Auto-Schließen (optional)", beschreibung: "Anzahl Tage eintragen, nach denen ein Ticket im Status 'Wartet auf Kunde' automatisch geschlossen wird. Leer lassen = deaktiviert. Läuft täglich um 02:00 Uhr." },
            ]}
            hinweis="SLA-Fristen gelten nur für Tickets die nach der Aktivierung erstellt werden – bestehende Tickets bleiben unverändert."
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <LizenzVerlaengerungen organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Lizenz-Ablauf-Erinnerungen"
            schritte={[
              { nr: 1, titel: "Frist einstellen", beschreibung: "Anzahl Tage vor Vertragsende festlegen, ab wann eine Lizenz als 'bald fällig' gilt und eine Erinnerungs-Mail auslöst." },
              { nr: 2, titel: "Lizenzverträge importieren", beschreibung: "Über den Import-Button in der Kundenliste den exocad 'license_history'-Export hochladen. Neue Verträge landen zunächst unzugeordnet und werden dort einem Kunden zugewiesen." },
              { nr: 3, titel: "Nur Hinweis, keine Rechnung", beschreibung: "Das System verschickt ausschließlich eine Erinnerungs-Mail an Org-Admins. Rechnung/Verlängerung wird weiterhin manuell in der Abrechnung erstellt." },
            ]}
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <FaqVerwaltung organisationId={organisationId} slug={organisation?.slug} />
          <KonfigurationsHilfe
            titel="FAQ / Wissensdatenbank befüllen"
            schritte={[
              { nr: 1, titel: "Einträge anlegen", beschreibung: "Häufig gestellte Fragen mit Antwort, optionaler Kategorie und öffentlich/intern-Kennzeichnung anlegen. Öffentliche Einträge sind für Kunden sichtbar, interne nur für dein Team." },
              { nr: 2, titel: "Kategorien nutzen", beschreibung: "Einfach im Kategorie-Feld einen Namen eintippen (z.B. 'Passwörter', 'Hardware', 'Software'). Kunden können nach Kategorie filtern." },
              { nr: 3, titel: "Öffentlicher Link", beschreibung: "Falls ein Firmen-Slug hinterlegt ist, gibt es oben einen kopierbaren Link zur öffentlichen FAQ-Seite – zum Einbinden auf der eigenen Website." },
              { nr: 4, titel: "Kunden entlasten", beschreibung: "Gute FAQ reduziert Ticket-Volumen deutlich. Faustregel: die häufigsten 10 Fragen der letzten 3 Monate als Startpunkt nehmen." },
            ]}
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">E-Mail-Texte</h3>
          <EmailTexteVerwaltung organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Automatische E-Mails anpassen"
            schritte={[
              { nr: 1, titel: "Text öffnen", beschreibung: "Auf eine der Mails klicken (z.B. 'Ticket geschlossen (mit Bewertung)'), um Betreff und Text zu bearbeiten." },
              { nr: 2, titel: "Platzhalter verwenden", beschreibung: "Werte wie {{kunde_name}} oder {{ticket_nr}} werden beim Versand automatisch durch die echten Werte ersetzt. Welche Platzhalter zur Verfügung stehen, steht direkt über dem Textfeld." },
              { nr: 3, titel: "Zurücksetzen jederzeit möglich", beschreibung: "Mit 'Auf Standard zurücksetzen' wird wieder der ursprüngliche Systemtext verwendet." },
            ]}
            hinweis="Ohne eigene Anpassung wird automatisch der Standardtext verschickt - hier ändert sich also nichts, solange nichts bearbeitet wird."
          />
        </div>
      )}

      {aktiveTab === "werkzeuge" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <ReportingExport organisationId={organisationId} />
          <KonfigurationsHilfe
            titel="Daten exportieren und nutzen"
            schritte={[
              { nr: 1, titel: "Zeitraum wählen", beschreibung: "Von/Bis-Datum einstellen. Tipp: für Monatsberichte immer den 1. bis letzten des Monats wählen." },
              { nr: 2, titel: "Tickets-Export", beschreibung: "Enthält alle Tickets mit Status, Priorität, SLA-Fälligkeiten, CSAT-Bewertung, Kunde und Techniker. Ideal für Monatsberichte an Kunden." },
              { nr: 3, titel: "Zeiterfassungs-Export", beschreibung: "Alle Zeiteinträge mit Minuten, Stunden (dezimal), Beschreibung und Ticket-Zuordnung. Direkt in Excel für die Abrechnung nutzbar." },
              { nr: 4, titel: "CSV in Excel öffnen", beschreibung: "Datei per Doppelklick öffnen oder in Excel via Daten → Aus Text/CSV importieren. Der Export ist UTF-8-kodiert mit Komma als Trennzeichen." },
            ]}
            hinweis="Alle Exporte enthalten eine UTF-8-BOM-Markierung, damit Excel deutsche Umlaute (ä, ö, ü) korrekt anzeigt."
          />
        </div>
      )}

      {aktiveTab === "integrationen" && organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <IntegrationenVerwaltung organisationId={organisationId} />
        </div>
      )}

      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
    </div>
  );
}
