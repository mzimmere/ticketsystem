import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { generierePasswort } from "../../lib/passwort";
import { LAENDER_MWST, LAENDER_LISTE } from "../../lib/laender";
import KundenListe from "../KundenListe";
import ZugangsdatenBox from "../ZugangsdatenBox";
import { useSprache } from "../../lib/SpracheContext";
import { texte } from "../../lib/uebersetzungen";
import type { Organisation } from "./typen";

export default function KundenTab({
  organisationId,
  organisation,
  onlineIds,
}: {
  organisationId: string;
  organisation: Organisation | null;
  onlineIds?: Set<string>;
}) {
  const { sprache } = useSprache();
  const txt = texte(sprache).verwaltung;
  const [neuerKundeEmail, setNeuerKundeEmail] = useState("");
  const [neuerKundeVorname, setNeuerKundeVorname] = useState("");
  const [neuerKundeNachname, setNeuerKundeNachname] = useState("");
  const [neuerKundeFirmenname, setNeuerKundeFirmenname] = useState("");
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
        (neuerKundeTelefon || neuerKundeStrasse || neuerKundeHausnummer || neuerKundePlz || neuerKundeOrt || neuerKundeNotizen || neuerKundeFirmenname)
      ) {
        await supabase
          .from("profiles")
          .update({
            firmenname: neuerKundeFirmenname.trim() || null,
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
      setNeuerKundeFirmenname("");
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

  return (
    <>
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
                value={neuerKundeFirmenname}
                onChange={(e) => setNeuerKundeFirmenname(e.target.value)}
                placeholder={txt.kundeFirmennamePlatzhalter}
                className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
              />
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
      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
    </>
  );
}
