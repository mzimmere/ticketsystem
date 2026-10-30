import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { generierePasswort } from "../../lib/passwort";
import MitarbeiterListe from "../MitarbeiterListe";
import ZugangsdatenBox from "../ZugangsdatenBox";
import { useSprache } from "../../lib/SpracheContext";
import { texte } from "../../lib/uebersetzungen";
import type { Organisation, Rolle } from "./typen";

export default function TeamTab({
  organisationId,
  organisation,
  rolle,
  onlineIds,
}: {
  organisationId: string;
  organisation: Organisation | null;
  rolle: Rolle;
  onlineIds?: Set<string>;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).verwaltung;
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
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

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
    <>
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
      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
    </>
  );
}
