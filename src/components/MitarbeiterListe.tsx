import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";
import ZugangsdatenBox from "./ZugangsdatenBox";

type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";
type Verfuegbarkeit = "verfuegbar" | "abwesend" | "urlaub";

interface Mitglied {
  id: string;
  name: string | null;
  vorname: string | null;
  nachname: string | null;
  avatar_url: string | null;
  telefonnummer: string | null;
  rolle: Rolle;
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

const ROLLE_LABEL: Record<Rolle, string> = {
  super_admin: "Super-Admin",
  org_admin: "Org-Admin",
  techniker: "Techniker",
  kunde: "Kunde",
};

export default function MitarbeiterListe({
  organisationId,
  eigeneRolle,
  refreshKey,
  organisationName,
  organisationAdresse,
  organisationLogoUrl,
  onlineIds,
}: MitarbeiterListeProps) {
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [zeigeArchivierte, setZeigeArchivierte] = useState(false);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Partial<Mitglied>>({});
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
      .from("profiles")
      .select("id, name, vorname, nachname, avatar_url, telefonnummer, rolle, verfuegbarkeit, deaktiviert")
      .eq("organisation_id", organisationId)
      .in("rolle", ["techniker", "org_admin", "super_admin"])
      .eq("deaktiviert", zeigeArchivierte)
      .order("rolle");
    if (error) {
      console.error("[MitarbeiterListe] Laden fehlgeschlagen:", error);
      setHinweis("Team konnte nicht geladen werden (Details in der Browser-Konsole).");
    }
    setMitglieder((data as Mitglied[]) ?? []);
  }

  async function statusUmschalten(mitgliedId: string, deaktivieren: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ deaktiviert: deaktivieren })
      .eq("id", mitgliedId);
    if (error) {
      console.error(error);
      setHinweis("Aktion fehlgeschlagen.");
      return;
    }
    setOffenId(null);
    ladeMitglieder();
  }

  function bearbeitenOeffnen(m: Mitglied) {
    if (!darfBearbeiten) return;
    setOffenId(m.id);
    setEntwurf(m);
    setHinweis(null);
  }

  async function speichern() {
    if (!offenId) return;
    setLaedt(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        vorname: entwurf.vorname?.trim() || null,
        nachname: entwurf.nachname?.trim() || null,
        telefonnummer: entwurf.telefonnummer?.trim() || null,
        rolle: entwurf.rolle,
        verfuegbarkeit: entwurf.verfuegbarkeit,
      })
      .eq("id", offenId);
    setLaedt(false);
    if (error) {
      console.error(error);
      setHinweis("Speichern fehlgeschlagen.");
      return;
    }
    setOffenId(null);
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
      setHinweis("Profilbild-Upload fehlgeschlagen.");
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
      if (!res.ok) throw new Error(json.error ?? "Fehlgeschlagen");
      setNeuerZugang({ email: json.email, link: json.link, telefon: telefon ?? undefined });
    } catch (err) {
      console.error(err);
      setHinweis("Neuer Link konnte nicht erzeugt werden. Ist resend-zugang deployt?");
    } finally {
      setLaedt(false);
    }
  }

  if (mitglieder.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--text-faint)]">
          {zeigeArchivierte ? "Keine deaktivierten Mitglieder." : "Noch keine Team-Mitglieder."}
        </p>
        {darfBearbeiten && (
          <button
            onClick={() => setZeigeArchivierte((v) => !v)}
            className="text-xs text-[var(--text-faint)] hover:underline"
          >
            {zeigeArchivierte ? "← Zurück zum aktiven Team" : "Deaktivierte Mitglieder anzeigen"}
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
          {zeigeArchivierte ? "← Zurück zum aktiven Team" : "Deaktivierte Mitglieder anzeigen"}
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
                  title="Online"
                />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--text-strong)]">{m.name ?? "Unbenannt"}</p>
              {m.verfuegbarkeit !== "verfuegbar" && (
                <p className="text-xs text-[var(--text-faint)]">
                  {m.verfuegbarkeit === "urlaub" ? "Urlaub" : "Abwesend"}
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
                  Profilbild ändern
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
                    Vorname
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
                    Nachname
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
                  Telefon
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
                    Rolle
                  </label>
                  <select
                    value={entwurf.rolle}
                    onChange={(e) => setEntwurf({ ...entwurf, rolle: e.target.value as Rolle })}
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  >
                    <option value="techniker">Techniker</option>
                    <option value="org_admin">Org-Admin</option>
                    <option value="kunde">Kunde</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                    Verfügbarkeit
                  </label>
                  <select
                    value={entwurf.verfuegbarkeit}
                    onChange={(e) =>
                      setEntwurf({ ...entwurf, verfuegbarkeit: e.target.value as Verfuegbarkeit })
                    }
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  >
                    <option value="verfuegbar">Verfügbar</option>
                    <option value="abwesend">Abwesend</option>
                    <option value="urlaub">Urlaub</option>
                  </select>
                </div>
              </div>

              {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}

              <button
                onClick={speichern}
                disabled={laedt}
                className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Speichern
              </button>

              <button
                onClick={() => neuenLinkAnfordern(m.id, entwurf.telefonnummer ?? null)}
                disabled={laedt}
                className="w-full rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
              >
                Neuen Zugangslink erzeugen
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
                    onClick={() => statusUmschalten(m.id, false)}
                    className="w-full rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                  >
                    Wieder aktivieren
                  </button>
                ) : (
                  <button
                    onClick={() => statusUmschalten(m.id, true)}
                    className="w-full rounded border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                  >
                    Mitarbeiter deaktivieren
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
