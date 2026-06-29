import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";

type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";
type Verfuegbarkeit = "verfuegbar" | "abwesend" | "urlaub";

interface Mitglied {
  id: string;
  name: string | null;
  avatar_url: string | null;
  telefonnummer: string | null;
  rolle: Rolle;
  verfuegbarkeit: Verfuegbarkeit;
}

interface MitarbeiterListeProps {
  organisationId: string;
  eigeneRolle: Rolle;
  refreshKey?: number;
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
}: MitarbeiterListeProps) {
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Partial<Mitglied>>({});
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  const darfBearbeiten = eigeneRolle === "super_admin" || eigeneRolle === "org_admin";

  useEffect(() => {
    ladeMitglieder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey]);

  async function ladeMitglieder() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, telefonnummer, rolle, verfuegbarkeit")
      .eq("organisation_id", organisationId)
      .in("rolle", ["techniker", "org_admin", "super_admin"])
      .order("rolle");
    setMitglieder((data as Mitglied[]) ?? []);
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
        name: entwurf.name?.trim() || null,
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

  if (mitglieder.length === 0) {
    return <p className="text-sm text-[var(--text-faint)]">Noch keine Team-Mitglieder.</p>;
  }

  return (
    <div className="space-y-2">
      {mitglieder.map((m) => (
        <div
          key={m.id}
          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
        >
          <button
            onClick={() => (offenId === m.id ? setOffenId(null) : bearbeitenOeffnen(m))}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
          >
            <Avatar name={m.name} avatarUrl={m.avatar_url} groesse="sm" />
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

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Name
                </label>
                <input
                  type="text"
                  value={entwurf.name ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, name: e.target.value })}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
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
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
