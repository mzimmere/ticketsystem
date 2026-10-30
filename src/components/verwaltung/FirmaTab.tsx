import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { sichererDateiname } from "../../lib/dateiname";
import { pruefeBild } from "../../lib/bildvalidierung";
import { useSprache } from "../../lib/SpracheContext";
import { texte } from "../../lib/uebersetzungen";
import type { Organisation } from "./typen";

export default function FirmaTab({
  organisation,
  setOrganisation,
}: {
  organisation: Organisation;
  setOrganisation: (o: Organisation) => void;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).verwaltung;
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
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
      setOrgName(organisation.name);
      setOrgAdresse(organisation.adresse ?? "");
      setOrgTelefon(organisation.telefon ?? "");
      setOrgEmail(organisation.email ?? "");
      setOrgWebsite(organisation.website ?? "");
      setOrgOeffnungszeiten(organisation.oeffnungszeiten ?? "");
      setOrgStandardpreisEuro(
        organisation.standard_preis_pro_minute_cent != null
          ? (organisation.standard_preis_pro_minute_cent / 100).toFixed(2)
          : "",
      );
      setOrgMotto(organisation.motto ?? "");
      setOrgAkzentfarbe(organisation.akzentfarbe ?? "#0e6e8c");
      setOrgSlug(organisation.slug ?? "");
      setOrgDatenschutzUrl(organisation.datenschutz_url ?? "");
      setOrgDatenschutzText(organisation.datenschutz_text ?? "");
      setOrgRechnungslogoBreite(String(organisation.rechnungslogo_breite ?? 80));
      setOrgSlaStunden(organisation.sla_stunden != null ? String(organisation.sla_stunden) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisation.id]);

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
      name: orgName,
      adresse: orgAdresse.trim() || null,
      telefon: orgTelefon.trim() || null,
      email: orgEmail.trim() || null,
      website: orgWebsite.trim() || null,
      oeffnungszeiten: orgOeffnungszeiten.trim() || null,
      motto: orgMotto.trim() || null,
      akzentfarbe: orgAkzentfarbe || null,
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

  return (
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
  );
}
