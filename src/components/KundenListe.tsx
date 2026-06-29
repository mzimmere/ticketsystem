import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import Avatar from "./Avatar";

interface Kunde {
  id: string;
  name: string | null;
  avatar_url: string | null;
  telefonnummer: string | null;
  adresse: string | null;
  notizen: string | null;
  preis_pro_minute_cent: number | null;
  deaktiviert: boolean;
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
}

export default function KundenListe({ organisationId, refreshKey }: KundenListeProps) {
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [zeigeArchivierte, setZeigeArchivierte] = useState(false);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Partial<Kunde>>({});
  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    ladeKunden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey, zeigeArchivierte]);

  async function ladeKunden() {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, name, avatar_url, telefonnummer, adresse, notizen, preis_pro_minute_cent, deaktiviert",
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

  function bearbeitenOeffnen(k: Kunde) {
    setOffenId(k.id);
    setEntwurf(k);
    setHinweis(null);
    ladeDokumente(k.id);
  }

  async function speichern() {
    if (!offenId) return;
    setLaedt(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: entwurf.name?.trim() || null,
        telefonnummer: entwurf.telefonnummer?.trim() || null,
        adresse: entwurf.adresse?.trim() || null,
        notizen: entwurf.notizen?.trim() || null,
        preis_pro_minute_cent:
          entwurf.preis_pro_minute_cent === null || entwurf.preis_pro_minute_cent === undefined
            ? null
            : Number(entwurf.preis_pro_minute_cent),
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

  if (kunden.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--text-faint)]">
          {zeigeArchivierte ? "Keine deaktivierten Kunden." : "Noch keine Kunden vorhanden."}
        </p>
        <button
          onClick={() => setZeigeArchivierte((v) => !v)}
          className="text-xs text-[var(--text-faint)] hover:underline"
        >
          {zeigeArchivierte ? "← Zurück zu aktiven Kunden" : "Deaktivierte Kunden anzeigen"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setZeigeArchivierte((v) => !v)}
        className="text-xs text-[var(--text-faint)] hover:underline"
      >
        {zeigeArchivierte ? "← Zurück zu aktiven Kunden" : "Deaktivierte Kunden anzeigen"}
      </button>
      {kunden.map((k) => (
        <div
          key={k.id}
          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
        >
          <button
            onClick={() => (offenId === k.id ? setOffenId(null) : bearbeitenOeffnen(k))}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
          >
            <Avatar name={k.name} avatarUrl={k.avatar_url} groesse="sm" />
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

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  Adresse
                </label>
                <textarea
                  value={entwurf.adresse ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, adresse: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
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
                  Individueller Minutenpreis in Cent (optional)
                </label>
                <input
                  type="number"
                  value={entwurf.preis_pro_minute_cent ?? ""}
                  onChange={(e) =>
                    setEntwurf({
                      ...entwurf,
                      preis_pro_minute_cent: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="leer = Standardpreis der Firma"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
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
      ))}
    </div>
  );
}
