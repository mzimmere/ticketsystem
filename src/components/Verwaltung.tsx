import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";

interface Organisation {
  id: string;
  name: string;
  logo_url: string | null;
}

interface VerwaltungProps {
  rolle: Rolle;
  organisationId: string | null;
}

export default function Verwaltung({ rolle, organisationId }: VerwaltungProps) {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [orgName, setOrgName] = useState("");
  const [alleOrganisationen, setAlleOrganisationen] = useState<Organisation[]>([]);
  const [neueOrgName, setNeueOrgName] = useState("");

  const [einladenEmail, setEinladenEmail] = useState("");
  const [einladenName, setEinladenName] = useState("");
  const [einladenRolle, setEinladenRolle] = useState<"kunde" | "techniker" | "org_admin">("kunde");

  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    if (organisationId) ladeOrganisation();
    if (rolle === "super_admin") ladeAlleOrganisationen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ladeOrganisation() {
    const { data } = await supabase
      .from("organisationen")
      .select("id, name, logo_url")
      .eq("id", organisationId)
      .single();
    if (data) {
      setOrganisation(data);
      setOrgName(data.name);
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
    setLaedt(true);
    await supabase.from("organisationen").update({ name: orgName }).eq("id", organisation.id);
    setLaedt(false);
    setHinweis("Gespeichert.");
  }

  async function logoHochladen(datei: File) {
    if (!organisation) return;
    setLaedt(true);
    setHinweis(null);
    try {
      const pfad = `${organisation.id}/${Date.now()}-${datei.name}`;
      const { error: uploadFehler } = await supabase.storage
        .from("logos")
        .upload(pfad, datei, { upsert: true });
      if (uploadFehler) throw uploadFehler;

      const { data: oeffentlich } = supabase.storage.from("logos").getPublicUrl(pfad);
      await supabase
        .from("organisationen")
        .update({ logo_url: oeffentlich.publicUrl })
        .eq("id", organisation.id);

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

  async function personEinladen() {
    if (!einladenEmail.trim() || !organisationId) return;
    setLaedt(true);
    setHinweis(null);

    const functionName = einladenRolle === "kunde" ? "invite-kunde" : "invite-mitarbeiter";
    const { data: sessionData } = await supabase.auth.getSession();

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email: einladenEmail.trim(),
            name: einladenName.trim() || null,
            organisationId,
            rolle: einladenRolle,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Einladung fehlgeschlagen");

      setHinweis(`Einladung an ${einladenEmail} gesendet.`);
      setEinladenEmail("");
      setEinladenName("");
    } catch (err) {
      console.error(err);
      setHinweis("Einladung fehlgeschlagen. Sind die Edge Functions deployt?");
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
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
            />
            <button
              onClick={organisationSpeichern}
              disabled={laedt}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      {organisationId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">Person einladen</h3>
          <input
            type="email"
            value={einladenEmail}
            onChange={(e) => setEinladenEmail(e.target.value)}
            placeholder="E-Mail"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={einladenName}
            onChange={(e) => setEinladenName(e.target.value)}
            placeholder="Name (optional)"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          />
          <select
            value={einladenRolle}
            onChange={(e) => setEinladenRolle(e.target.value as typeof einladenRolle)}
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          >
            <option value="kunde">Kunde</option>
            <option value="techniker">Techniker</option>
            <option value="org_admin">Org-Admin</option>
          </select>
          <button
            onClick={personEinladen}
            disabled={laedt}
            className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Einladung senden
          </button>
        </div>
      )}

      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
    </div>
  );
}
