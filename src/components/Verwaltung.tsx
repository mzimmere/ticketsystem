import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";
import KundenListe from "./KundenListe";

type Rolle = "super_admin" | "org_admin" | "techniker" | "kunde";

interface Organisation {
  id: string;
  name: string;
  logo_url: string | null;
}

interface TeamMitglied {
  id: string;
  name: string | null;
  avatar_url: string | null;
  rolle: Rolle;
  verfuegbarkeit: string;
}

interface VerwaltungProps {
  rolle: Rolle;
  organisationId: string | null;
}

const ROLLE_LABEL: Record<Rolle, string> = {
  super_admin: "Super-Admin",
  org_admin: "Org-Admin",
  techniker: "Techniker",
  kunde: "Kunde",
};

export default function Verwaltung({ rolle, organisationId }: VerwaltungProps) {
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [orgName, setOrgName] = useState("");
  const [alleOrganisationen, setAlleOrganisationen] = useState<Organisation[]>([]);
  const [neueOrgName, setNeueOrgName] = useState("");
  const [team, setTeam] = useState<TeamMitglied[]>([]);

  const [einladenEmail, setEinladenEmail] = useState("");
  const [einladenName, setEinladenName] = useState("");
  const [einladenRolle, setEinladenRolle] = useState<"kunde" | "techniker" | "org_admin">("kunde");

  const [neuerKundeEmail, setNeuerKundeEmail] = useState("");
  const [neuerKundeName, setNeuerKundeName] = useState("");
  const [neuerKundeTelefon, setNeuerKundeTelefon] = useState("");
  const [neuerKundeAdresse, setNeuerKundeAdresse] = useState("");
  const [neuerKundeNotizen, setNeuerKundeNotizen] = useState("");
  const [kundenRefreshKey, setKundenRefreshKey] = useState(0);
  const [zeigeKundeAnlegen, setZeigeKundeAnlegen] = useState(false);

  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    if (organisationId) {
      ladeOrganisation();
      ladeTeam();
    }
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

  async function ladeTeam() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, rolle, verfuegbarkeit")
      .eq("organisation_id", organisationId)
      .order("rolle");
    setTeam((data as TeamMitglied[]) ?? []);
  }

  async function rolleAendern(mitgliedId: string, neueRolle: Rolle) {
    const { error } = await supabase
      .from("profiles")
      .update({ rolle: neueRolle })
      .eq("id", mitgliedId);
    if (error) {
      console.error(error);
      setHinweis("Rolle ändern fehlgeschlagen.");
      return;
    }
    setTeam((t) => t.map((m) => (m.id === mitgliedId ? { ...m, rolle: neueRolle } : m)));
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
    const { error } = await supabase
      .from("organisationen")
      .update({ name: orgName })
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
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Anlegen fehlgeschlagen");

      // Telefon/Adresse/Notizen direkt im neu erstellten Profil ergänzen
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

      setHinweis(`Kunde angelegt, Einladung an ${neuerKundeEmail} gesendet.`);
      setNeuerKundeEmail("");
      setNeuerKundeName("");
      setNeuerKundeTelefon("");
      setNeuerKundeAdresse("");
      setNeuerKundeNotizen("");
      setZeigeKundeAnlegen(false);
      setKundenRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setHinweis("Kunde anlegen fehlgeschlagen. Sind die Edge Functions deployt?");
    } finally {
      setLaedt(false);
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
      ladeTeam();
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

      {organisationId && team.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-strong)]">Team</h3>
          <div className="divide-y divide-[var(--border)]">
            {team.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={m.name} avatarUrl={m.avatar_url} groesse="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--text-strong)]">
                      {m.name ?? "Unbenannt"}
                    </p>
                    {m.rolle !== "kunde" && m.verfuegbarkeit !== "verfuegbar" && (
                      <p className="text-xs text-[var(--text-faint)]">
                        {m.verfuegbarkeit === "urlaub" ? "Urlaub" : "Abwesend"}
                      </p>
                    )}
                  </div>
                </div>
                {(rolle === "super_admin" || rolle === "org_admin") ? (
                  <select
                    value={m.rolle}
                    onChange={(e) => rolleAendern(m.id, e.target.value as Rolle)}
                    className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-strong)]"
                  >
                    <option value="kunde">Kunde</option>
                    <option value="techniker">Techniker</option>
                    <option value="org_admin">Org-Admin</option>
                  </select>
                ) : (
                  <span className="text-xs text-[var(--text-soft)]">{ROLLE_LABEL[m.rolle]}</span>
                )}
              </div>
            ))}
          </div>
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
              <button
                onClick={kundeAnlegen}
                disabled={laedt}
                className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {laedt ? "Wird angelegt…" : "Kunde anlegen & einladen"}
              </button>
            </div>
          )}

          <KundenListe organisationId={organisationId} refreshKey={kundenRefreshKey} />
        </div>
      )}

      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
    </div>
  );
}
