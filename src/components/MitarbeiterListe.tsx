import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";
import ZugangsdatenBox from "./ZugangsdatenBox";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";

type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";
type MitgliedRolle = "techniker" | "org_admin";
type Verfuegbarkeit = "verfuegbar" | "abwesend" | "urlaub";

interface Mitglied {
  id: string;
  mitgliedschaft_id: string;
  email: string | null;
  name: string | null;
  vorname: string | null;
  nachname: string | null;
  avatar_url: string | null;
  telefonnummer: string | null;
  rolle: MitgliedRolle;
  verfuegbarkeit: Verfuegbarkeit;
  deaktiviert: boolean;
}

interface MitarbeiterListeProps {
  organisationId: string;
  eigeneRolle: Rolle;
  refreshKey?: number;
  organisationName?: string | null;
  organisationAdresse?: string | null;
  organisationLogoUrl?: string | null;
  onlineIds?: Set<string>;
}

export default function MitarbeiterListe({
  organisationId,
  eigeneRolle,
  refreshKey,
  organisationName,
  organisationAdresse,
  organisationLogoUrl,
  onlineIds,
}: MitarbeiterListeProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).mitarbeiterListe;
  const ROLLE_LABEL: Record<Rolle, string> = {
    super_admin: txt.superAdmin,
    org_admin: txt.orgAdmin,
    techniker: txt.techniker,
    kunde: txt.kunde,
  };
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [zeigeArchivierte, setZeigeArchivierte] = useState(false);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Partial<Mitglied>>({});
  const [emailEntwurf, setEmailEntwurf] = useState("");
  const [emailLaedt, setEmailLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [neuerZugang, setNeuerZugang] = useState<{
    email: string;
    link?: string;
    telefon?: string;
  } | null>(null);
  const [laedt, setLaedt] = useState(false);

  const darfBearbeiten = eigeneRolle === "super_admin" || eigeneRolle === "org_admin";

  useEffect(() => {
    ladeMitglieder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey, zeigeArchivierte]);

  async function ladeMitglieder() {
    const { data, error } = await supabase
      .rpc("get_team_mit_email", { p_organisation_id: organisationId })
      .eq("deaktiviert", zeigeArchivierte);
    if (error) {
      console.error("[MitarbeiterListe] Laden fehlgeschlagen:", error);
      setHinweis(txt.fehlerLaden);
    }
    setMitglieder((data as Mitglied[]) ?? []);
  }

  // Deaktiviert/reaktiviert nur die Mitgliedschaft bei DIESER Firma - nicht
  // den ganzen Account, der bei Mehrfach-Mitgliedschaft ja evtl. bei einer
  // anderen Firma weiterhin aktiv sein soll.
  async function statusUmschalten(mitgliedschaftId: string, deaktivieren: boolean) {
    const { error } = await supabase
      .from("firmen_mitgliedschaften")
      .update({ deaktiviert: deaktivieren })
      .eq("id", mitgliedschaftId);
    if (error) {
      console.error(error);
      setHinweis(txt.fehlerAktion);
      return;
    }
    setOffenId(null);
    ladeMitglieder();
  }

  function bearbeitenOeffnen(m: Mitglied) {
    if (!darfBearbeiten) return;
    setOffenId(m.id);
    setEntwurf(m);
    setEmailEntwurf(m.email ?? "");
    setHinweis(null);
  }

  async function speichern() {
    if (!offenId || !entwurf.mitgliedschaft_id) return;
    setLaedt(true);
    // Persönliche Angaben gelten firmenübergreifend (ein Name/Telefon pro
    // Person), die Rolle dagegen ist pro Firma - deshalb zwei Updates auf
    // unterschiedliche Tabellen.
    const [{ error: profilFehler }, { error: mitgliedFehler }] = await Promise.all([
      supabase
        .from("profiles")
        .update({
          vorname: entwurf.vorname?.trim() || null,
          nachname: entwurf.nachname?.trim() || null,
          telefonnummer: entwurf.telefonnummer?.trim() || null,
          verfuegbarkeit: entwurf.verfuegbarkeit,
        })
        .eq("id", offenId),
      supabase
        .from("firmen_mitgliedschaften")
        .update({ rolle: entwurf.rolle })
        .eq("id", entwurf.mitgliedschaft_id),
    ]);
    setLaedt(false);
    if (profilFehler || mitgliedFehler) {
      console.error(profilFehler ?? mitgliedFehler);
      setHinweis(txt.fehlerSpeichern);
      return;
    }
    setOffenId(null);
    ladeMitglieder();
  }

  async function emailAendern(mitgliedId: string) {
    if (!emailEntwurf.trim() || !emailEntwurf.includes("@")) {
      setHinweis(txt.fehlerEmailUngueltig);
      return;
    }
    setEmailLaedt(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(
      `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/aendere-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ nutzerId: mitgliedId, neueEmail: emailEntwurf.trim() }),
      }
    );
    const json = await res.json();
    setEmailLaedt(false);
    if (!res.ok) {
      setHinweis(json.error ?? txt.fehlerEmailAendern);
      return;
    }
    setEmailEntwurf("");
    setHinweis(txt.erfolgEmailGeaendert);
    ladeMitglieder();
  }

  async function avatarHochladen(mitgliedId: string, datei: File) {
    setLaedt(true);
    setHinweis(null);
    try {
      const pfad = `${mitgliedId}/${Date.now()}-${sichererDateiname(datei.name)}`;
      const { error: uploadFehler } = await supabase.storage
        .from("avatare")
        .upload(pfad, datei, { upsert: true });
      if (uploadFehler) throw uploadFehler;

      const { data: oeffentlich } = supabase.storage.from("avatare").getPublicUrl(pfad);
      const { error: updateFehler } = await supabase
        .from("profiles")
        .update({ avatar_url: oeffentlich.publicUrl })
        .eq("id", mitgliedId);
      if (updateFehler) throw updateFehler;

      setEntwurf((e) => ({ ...e, avatar_url: oeffentlich.publicUrl }));
      ladeMitglieder();
    } catch (err) {
      console.error(err);
      setHinweis(txt.fehlerAvatarUpload);
    } finally {
      setLaedt(false);
    }
  }

  async function neuenLinkAnfordern(mitgliedId: string, telefon: string | null) {
    setLaedt(true);
    setHinweis(null);
    setNeuerZugang(null);
    const { data: sessionData } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-zugang`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({ userId: mitgliedId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? txt.fehlerLinkFehlgeschlagen);
      setNeuerZugang({ email: json.email, link: json.link, telefon: telefon ?? undefined });
    } catch (err) {
      console.error(err);
      setHinweis(txt.fehlerNeuerLink);
    } finally {
      setLaedt(false);
    }
  }

  if (mitglieder.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--text-faint)]">
          {zeigeArchivierte ? txt.keineDeaktivierten : txt.nochKeineTeamMitglieder}
        </p>
        {darfBearbeiten && (
          <button
            onClick={() => setZeigeArchivierte((v) => !v)}
            className="text-xs text-[var(--text-faint)] hover:underline"
          >
            {zeigeArchivierte ? txt.zurueckZumAktivenTeam : txt.deaktivierteAnzeigen}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {darfBearbeiten && (
        <button
          onClick={() => setZeigeArchivierte((v) => !v)}
          className="text-xs text-[var(--text-faint)] hover:underline"
        >
          {zeigeArchivierte ? txt.zurueckZumAktivenTeam : txt.deaktivierteAnzeigen}
        </button>
      )}
      {mitglieder.map((m) => (
        <div
          key={m.id}
          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
        >
          <button
            onClick={() => (offenId === m.id ? setOffenId(null) : bearbeitenOeffnen(m))}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
          >
            <span className="relative shrink-0">
              <Avatar name={m.name} avatarUrl={m.avatar_url} groesse="sm" />
              {onlineIds?.has(m.id) && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500"
                  title={txt.online}
                />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--text-strong)]">{m.name ?? txt.unbenannt}</p>
              {m.email && (
                <p className="truncate text-xs text-[var(--text-faint)]">{m.email}</p>
              )}
              {m.verfuegbarkeit !== "verfuegbar" && (
                <p className="text-xs text-[var(--text-faint)]">
                  {m.verfuegbarkeit === "urlaub" ? txt.urlaub : txt.abwesend}
                </p>
              )}
            </div>
            <span className="ml-auto shrink-0 text-xs text-[var(--text-soft)]">
              {ROLLE_LABEL[m.rolle]}
            </span>
          </button>

          {offenId === m.id && darfBearbeiten && (
            <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar
                  name={entwurf.name ?? m.name}
                  avatarUrl={entwurf.avatar_url ?? null}
                  groesse="lg"
                />
                <label className="cursor-pointer rounded border border-[var(--border-input)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                  {txt.profilbildAendern}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && avatarHochladen(m.id, e.target.files[0])
                    }
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                    {txt.vorname}
                  </label>
                  <input
                    type="text"
                    value={entwurf.vorname ?? ""}
                    onChange={(e) => setEntwurf({ ...entwurf, vorname: e.target.value })}
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                    {txt.nachname}
                  </label>
                  <input
                    type="text"
                    value={entwurf.nachname ?? ""}
                    onChange={(e) => setEntwurf({ ...entwurf, nachname: e.target.value })}
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.telefon}
                </label>
                <input
                  type="text"
                  value={entwurf.telefonnummer ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, telefonnummer: e.target.value })}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                    {txt.rolle}
                  </label>
                  <select
                    value={entwurf.rolle}
                    onChange={(e) => setEntwurf({ ...entwurf, rolle: e.target.value as MitgliedRolle })}
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  >
                    <option value="techniker">{txt.techniker}</option>
                    <option value="org_admin">{txt.orgAdmin}</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                    {txt.verfuegbarkeitLabel}
                  </label>
                  <select
                    value={entwurf.verfuegbarkeit}
                    onChange={(e) =>
                      setEntwurf({ ...entwurf, verfuegbarkeit: e.target.value as Verfuegbarkeit })
                    }
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  >
                    <option value="verfuegbar">{txt.verfuegbar}</option>
                    <option value="abwesend">{txt.abwesend}</option>
                    <option value="urlaub">{txt.urlaub}</option>
                  </select>
                </div>
              </div>

              {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}

              <button
                onClick={speichern}
                disabled={laedt}
                className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {txt.speichern}
              </button>

              {/* E-Mail-Adresse ändern */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-3 space-y-2">
                <p className="text-xs font-medium text-[var(--text-soft)]">{txt.emailAendernTitel}</p>
                <p className="text-xs text-[var(--text-faint)]">
                  {txt.aktuellLabel} <span className="font-mono">{m.email ?? "—"}</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailEntwurf}
                    onChange={(e) => setEmailEntwurf(e.target.value)}
                    placeholder={txt.neueEmailPlatzhalter}
                    className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => emailAendern(m.id)}
                    disabled={emailLaedt || !emailEntwurf.includes("@") || emailEntwurf === m.email}
                    className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {emailLaedt ? "…" : txt.aendern}
                  </button>
                </div>
              </div>

              <button
                onClick={() => neuenLinkAnfordern(m.id, entwurf.telefonnummer ?? null)}
                disabled={laedt}
                className="w-full rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
              >
                {txt.neuenZugangslinkErzeugen}
              </button>

              {neuerZugang && (
                <ZugangsdatenBox
                  email={neuerZugang.email}
                  link={neuerZugang.link}
                  telefon={neuerZugang.telefon}
                  firmenName={organisationName}
                  firmenAdresse={organisationAdresse}
                  logoUrl={organisationLogoUrl}
                  onSchliessen={() => setNeuerZugang(null)}
                />
              )}

              <div className="border-t border-[var(--border)] pt-3">
                {zeigeArchivierte ? (
                  <button
                    onClick={() => statusUmschalten(m.mitgliedschaft_id, false)}
                    className="w-full rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                  >
                    {txt.wiederAktivieren}
                  </button>
                ) : (
                  <button
                    onClick={() => statusUmschalten(m.mitgliedschaft_id, true)}
                    className="w-full rounded border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                    title={txt.ausFirmaEntfernenTitle}
                  >
                    {txt.ausFirmaEntfernen}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
