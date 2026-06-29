import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";
import ZugangsdatenBox from "./ZugangsdatenBox";

interface Kunde {
  id: string;
  name: string | null;
  avatar_url: string | null;
  telefonnummer: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  notizen: string | null;
  deaktiviert: boolean;
}

interface KundenPreis {
  id: string;
  preis_pro_minute_cent: number;
  gueltig_ab: string;
}

interface Dokument {
  id: string;
  storage_path: string;
  dateiname: string;
  erstellt_am: string;
}

interface KundenListeProps {
  organisationId: string;
  refreshKey?: number;
  organisationName?: string | null;
  organisationAdresse?: string | null;
  organisationLogoUrl?: string | null;
  onlineIds?: Set<string>;
}

export default function KundenListe({
  organisationId,
  refreshKey,
  organisationName,
  organisationAdresse,
  organisationLogoUrl,
  onlineIds,
}: KundenListeProps) {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [suchbegriff, setSuchbegriff] = useState("");
  const [zeigeArchivierte, setZeigeArchivierte] = useState(false);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Partial<Kunde>>({});
  const [preise, setPreise] = useState<KundenPreis[]>([]);
  const [neuesPreisDatum, setNeuesPreisDatum] = useState("");
  const [neuerPreisEuro, setNeuerPreisEuro] = useState("");
  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [neuerZugang, setNeuerZugang] = useState<{
    email: string;
    link?: string;
    telefon?: string;
  } | null>(null);

  useEffect(() => {
    ladeKunden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey, zeigeArchivierte]);

  async function ladeKunden() {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, name, avatar_url, telefonnummer, strasse, hausnummer, plz, ort, notizen, deaktiviert",
      )
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .eq("deaktiviert", zeigeArchivierte)
      .order("name");
    setKunden((data as Kunde[]) ?? []);
  }

  async function statusUmschalten(kundeId: string, deaktivieren: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ deaktiviert: deaktivieren })
      .eq("id", kundeId);
    if (error) {
      console.error(error);
      setHinweis("Aktion fehlgeschlagen.");
      return;
    }
    setOffenId(null);
    ladeKunden();
  }

  async function ladeDokumente(kundeId: string) {
    const { data } = await supabase
      .from("kunden_dokumente")
      .select("id, storage_path, dateiname, erstellt_am")
      .eq("kunde_id", kundeId)
      .order("erstellt_am", { ascending: false });
    setDokumente((data as Dokument[]) ?? []);
  }

  async function ladePreise(kundeId: string) {
    const { data } = await supabase
      .from("kunden_preise")
      .select("id, preis_pro_minute_cent, gueltig_ab")
      .eq("kunde_id", kundeId)
      .order("gueltig_ab", { ascending: false });
    setPreise((data as KundenPreis[]) ?? []);
  }

  function bearbeitenOeffnen(k: Kunde) {
    setOffenId(k.id);
    setEntwurf(k);
    setNeuesPreisDatum(new Date().toISOString().slice(0, 10));
    setNeuerPreisEuro("");
    setHinweis(null);
    ladeDokumente(k.id);
    ladePreise(k.id);
  }

  async function preisHinzufuegen(kundeId: string) {
    if (!neuesPreisDatum || neuerPreisEuro.trim() === "") return;
    const wert = parseFloat(neuerPreisEuro.trim().replace(",", "."));
    if (isNaN(wert)) {
      setHinweis("Ungültiger Preis – bitte z.B. 1,99 eingeben.");
      return;
    }
    const { error } = await supabase.from("kunden_preise").insert({
      kunde_id: kundeId,
      organisation_id: organisationId,
      preis_pro_minute_cent: Math.round(wert * 100),
      gueltig_ab: neuesPreisDatum,
    });
    if (error) {
      console.error(error);
      setHinweis("Preis konnte nicht hinzugefügt werden.");
      return;
    }
    setNeuerPreisEuro("");
    ladePreise(kundeId);
  }

  async function preisLoeschen(preisId: string, kundeId: string) {
    await supabase.from("kunden_preise").delete().eq("id", preisId);
    ladePreise(kundeId);
  }

  async function speichern() {
    if (!offenId) return;
    setLaedt(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: entwurf.name?.trim() || null,
        telefonnummer: entwurf.telefonnummer?.trim() || null,
        strasse: entwurf.strasse?.trim() || null,
        hausnummer: entwurf.hausnummer?.trim() || null,
        plz: entwurf.plz?.trim() || null,
        ort: entwurf.ort?.trim() || null,
        notizen: entwurf.notizen?.trim() || null,
      })
      .eq("id", offenId);
    setLaedt(false);
    if (error) {
      console.error(error);
      setHinweis("Speichern fehlgeschlagen.");
      return;
    }
    setOffenId(null);
    ladeKunden();
  }

  async function avatarHochladen(kundeId: string, datei: File) {
    setLaedt(true);
    setHinweis(null);
    try {
      const pfad = `${kundeId}/${Date.now()}-${sichererDateiname(datei.name)}`;
      const { error: uploadFehler } = await supabase.storage
        .from("avatare")
        .upload(pfad, datei, { upsert: true });
      if (uploadFehler) throw uploadFehler;

      const { data: oeffentlich } = supabase.storage.from("avatare").getPublicUrl(pfad);
      const { error: updateFehler } = await supabase
        .from("profiles")
        .update({ avatar_url: oeffentlich.publicUrl })
        .eq("id", kundeId);
      if (updateFehler) throw updateFehler;

      setEntwurf((e) => ({ ...e, avatar_url: oeffentlich.publicUrl }));
      ladeKunden();
    } catch (err) {
      console.error(err);
      setHinweis("Profilbild-Upload fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }

  async function dokumentHochladen(kundeId: string, datei: File) {
    setLaedt(true);
    setHinweis(null);
    try {
      const pfad = `${kundeId}/${Date.now()}-${sichererDateiname(datei.name)}`;
      const { error: uploadFehler } = await supabase.storage
        .from("kundendokumente")
        .upload(pfad, datei);
      if (uploadFehler) throw uploadFehler;

      const { data: authData } = await supabase.auth.getUser();
      const { error: insertFehler } = await supabase.from("kunden_dokumente").insert({
        organisation_id: organisationId,
        kunde_id: kundeId,
        storage_path: pfad,
        dateiname: datei.name,
        dateityp: datei.type,
        hochgeladen_von: authData.user?.id,
      });
      if (insertFehler) throw insertFehler;

      ladeDokumente(kundeId);
    } catch (err) {
      console.error(err);
      setHinweis("Dokument-Upload fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  }

  async function dokumentOeffnen(pfad: string) {
    const { data, error } = await supabase.storage
      .from("kundendokumente")
      .createSignedUrl(pfad, 60);
    if (error || !data) {
      setHinweis("Konnte Dokument nicht öffnen.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function dokumentLoeschen(dokId: string, pfad: string, kundeId: string) {
    await supabase.storage.from("kundendokumente").remove([pfad]);
    await supabase.from("kunden_dokumente").delete().eq("id", dokId);
    ladeDokumente(kundeId);
  }

  async function neuenLinkAnfordern(kundeId: string, telefon: string | null) {
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
        body: JSON.stringify({ userId: kundeId }),
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

  const gefilterteKunden = kunden.filter((k) => {
    const begriff = suchbegriff.trim().toLowerCase();
    if (!begriff) return true;
    return [k.name, k.telefonnummer, k.strasse, k.hausnummer, k.plz, k.ort]
      .filter(Boolean)
      .some((feld) => feld!.toLowerCase().includes(begriff));
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={suchbegriff}
          onChange={(e) => setSuchbegriff(e.target.value)}
          placeholder="Suche nach Name, Telefon, Straße, PLZ oder Ort…"
          className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        />
        <button
          onClick={() => setZeigeArchivierte((v) => !v)}
          className="shrink-0 text-xs text-[var(--text-faint)] hover:underline"
        >
          {zeigeArchivierte ? "← Aktive" : "Archiv"}
        </button>
      </div>

      {gefilterteKunden.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">
          {kunden.length === 0
            ? zeigeArchivierte
              ? "Keine deaktivierten Kunden."
              : "Noch keine Kunden vorhanden."
            : "Keine Treffer für diese Suche."}
        </p>
      ) : (
        gefilterteKunden.map((k) => (
        <div
          key={k.id}
          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
        >
          <button
            onClick={() => (offenId === k.id ? setOffenId(null) : bearbeitenOeffnen(k))}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
          >
            <span className="relative shrink-0">
              <Avatar name={k.name} avatarUrl={k.avatar_url} groesse="sm" />
              {onlineIds?.has(k.id) && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500"
                  title="Online"
                />
              )}
            </span>
            <span className="text-sm text-[var(--text-strong)]">{k.name ?? "Unbenannt"}</span>
            <span className="ml-auto truncate text-xs text-[var(--text-faint)]">
              {k.telefonnummer ?? "—"}
            </span>
          </button>

          {offenId === k.id && (
            <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={entwurf.name ?? k.name} avatarUrl={entwurf.avatar_url ?? null} groesse="lg" />
                <label className="cursor-pointer rounded border border-[var(--border-input)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                  Profilbild ändern
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && avatarHochladen(k.id, e.target.files[0])}
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
                  Telefon / WhatsApp
                </label>
                <input
                  type="text"
                  value={entwurf.telefonnummer ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, telefonnummer: e.target.value })}
                  placeholder="z.B. 4915112345678"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={entwurf.strasse ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, strasse: e.target.value })}
                  placeholder="Straße"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={entwurf.hausnummer ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, hausnummer: e.target.value })}
                  placeholder="Nr."
                  className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={entwurf.plz ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, plz: e.target.value })}
                  placeholder="PLZ"
                  className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={entwurf.ort ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, ort: e.target.value })}
                  placeholder="Ort"
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Notizen / Besonderheiten
                </label>
                <textarea
                  value={entwurf.notizen ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, notizen: e.target.value })}
                  rows={3}
                  placeholder="z.B. bevorzugte Erreichbarkeit, technische Besonderheiten…"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Individueller Minutenpreis (Verlauf, optional)
                </label>

                {preise.length === 0 ? (
                  <p className="mb-2 text-xs text-[var(--text-faint)]">
                    Noch kein individueller Preis gesetzt – es gilt der Standardpreis der Firma.
                  </p>
                ) : (
                  <div className="mb-2 space-y-1">
                    {(() => {
                      const heute = new Date().toISOString().slice(0, 10);
                      const aktiveId = preise.find((p) => p.gueltig_ab <= heute)?.id;
                      return preise.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5 text-sm"
                        >
                          <span className="text-[var(--text-strong)]">
                            ab {new Date(p.gueltig_ab).toLocaleDateString("de-DE")}:{" "}
                            {(p.preis_pro_minute_cent / 100).toLocaleString("de-DE", {
                              style: "currency",
                              currency: "EUR",
                            })}
                            {p.id === aktiveId && (
                              <span className="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
                                Aktuell
                              </span>
                            )}
                            {p.gueltig_ab > heute && (
                              <span className="ml-2 rounded bg-[var(--border)] px-1.5 py-0.5 text-[0.65rem] font-medium text-[var(--text-soft)]">
                                Geplant
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => preisLoeschen(p.id, k.id)}
                            className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                          >
                            Entfernen
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="date"
                    value={neuesPreisDatum}
                    onChange={(e) => setNeuesPreisDatum(e.target.value)}
                    className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={neuerPreisEuro}
                    onChange={(e) => setNeuerPreisEuro(e.target.value)}
                    placeholder="z.B. 1,99"
                    className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <button
                    onClick={() => preisHinzufuegen(k.id)}
                    className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    +
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  Gilt automatisch ab dem gewählten Datum – ältere Zeiterfassungen bleiben mit
                  ihrem damaligen Preis unangetastet.
                </p>
              </div>

              <button
                onClick={speichern}
                disabled={laedt}
                className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Speichern
              </button>

              <div className="border-t border-[var(--border)] pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  Dokumente (unabhängig von Tickets)
                </p>

                {dokumente.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {dokumente.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
                      >
                        <button
                          onClick={() => dokumentOeffnen(d.storage_path)}
                          className="truncate text-left text-sm text-[var(--text-strong)] hover:underline"
                        >
                          {d.dateiname}
                        </button>
                        <button
                          onClick={() => dokumentLoeschen(d.id, d.storage_path, k.id)}
                          className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                        >
                          Löschen
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="block cursor-pointer rounded border border-dashed border-[var(--border-input)] px-3 py-2 text-center text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                  + Dokument hochladen
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && dokumentHochladen(k.id, e.target.files[0])
                    }
                  />
                </label>
              </div>

              {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}

              <button
                onClick={() => neuenLinkAnfordern(k.id, entwurf.telefonnummer ?? null)}
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
                    onClick={() => statusUmschalten(k.id, false)}
                    className="w-full rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                  >
                    Wieder aktivieren
                  </button>
                ) : (
                  <button
                    onClick={() => statusUmschalten(k.id, true)}
                    className="w-full rounded border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                  >
                    Kunde deaktivieren
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        ))
      )}
    </div>
  );
}
