import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import { LAENDER_MWST, LAENDER_LISTE } from "../lib/laender";
import Avatar from "./Avatar";
import ZugangsdatenBox from "./ZugangsdatenBox";
import DongleVerwaltung from "./DongleVerwaltung";
import DongleImport from "./DongleImport";

interface Kunde {
  id: string;
  name: string | null;
  vorname: string | null;
  nachname: string | null;
  avatar_url: string | null;
  telefonnummer: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  mwst_satz: number | null;
  ust_id: string | null;
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

interface Todo {
  id: string;
  text: string;
  erledigt: boolean;
}

interface NichtZugeordneterDongle {
  id: string;
  seriennummer: string;
  software: string;
  gruppe: string | null;
}

interface LizenzVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
  status: string | null;
}

interface NichtZugeordneterVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
}

interface KundenListeProps {
  organisationId: string;
  refreshKey?: number;
  organisationName?: string | null;
  organisationAdresse?: string | null;
  organisationLogoUrl?: string | null;
  onlineIds?: Set<string>;
}

const ANZAHL_STANDARD_SICHTBAR = 5;

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
  const [todos, setTodos] = useState<Todo[]>([]);
  const [neuesTodo, setNeuesTodo] = useState("");
  const [nichtZugeordnete, setNichtZugeordnete] = useState<NichtZugeordneterDongle[]>([]);
  const [zuweisenAn, setZuweisenAn] = useState<Record<string, string>>({});
  const [vertraege, setVertraege] = useState<LizenzVertrag[]>([]);
  const [nichtZugeordneteVertraege, setNichtZugeordneteVertraege] = useState<NichtZugeordneterVertrag[]>([]);
  const [zuweisenAnVertrag, setZuweisenAnVertrag] = useState<Record<string, string>>({});
  const [filterDongleNummer, setFilterDongleNummer] = useState("");
  const [filterVertragNummer, setFilterVertragNummer] = useState("");
  const [alleDonglesAnzeigen, setAlleDonglesAnzeigen] = useState(false);
  const [alleVertraegeAnzeigen, setAlleVertraegeAnzeigen] = useState(false);
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

  useEffect(() => {
    ladeNichtZugeordnete();
    ladeNichtZugeordneteVertraege();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey]);

  async function ladeNichtZugeordnete() {
    const { data } = await supabase
      .from("kunden_dongles")
      .select("id, seriennummer, software, gruppe")
      .eq("organisation_id", organisationId)
      .is("kunde_id", null)
      .order("seriennummer");
    setNichtZugeordnete((data as NichtZugeordneterDongle[]) ?? []);
  }

  async function dongleZuweisen(dongleId: string) {
    const kundeId = zuweisenAn[dongleId];
    if (!kundeId) return;
    await supabase.from("kunden_dongles").update({ kunde_id: kundeId }).eq("id", dongleId);
    setZuweisenAn((z) => {
      const kopie = { ...z };
      delete kopie[dongleId];
      return kopie;
    });
    ladeNichtZugeordnete();
  }

  async function ladeNichtZugeordneteVertraege() {
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende")
      .eq("organisation_id", organisationId)
      .is("kunde_id", null)
      .order("vertrag_ende", { ascending: true, nullsFirst: false });
    setNichtZugeordneteVertraege((data as NichtZugeordneterVertrag[]) ?? []);
  }

  async function vertragZuweisen(vertragId: string) {
    const kundeId = zuweisenAnVertrag[vertragId];
    if (!kundeId) return;
    await supabase.from("lizenz_vertraege").update({ kunde_id: kundeId }).eq("id", vertragId);
    setZuweisenAnVertrag((z) => {
      const kopie = { ...z };
      delete kopie[vertragId];
      return kopie;
    });
    ladeNichtZugeordneteVertraege();
  }

  async function ladeKunden() {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, name, vorname, nachname, avatar_url, telefonnummer, strasse, hausnummer, plz, ort, land, mwst_satz, ust_id, notizen, deaktiviert",
      )
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .eq("deaktiviert", zeigeArchivierte)
      .order("name");
    if (error) {
      console.error("[KundenListe] Laden fehlgeschlagen:", error);
      setHinweis("Kunden konnten nicht geladen werden (Details in der Browser-Konsole).");
    }
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

  async function ladeTodos(kundeId: string) {
    const { data } = await supabase
      .from("kunden_todos")
      .select("id, text, erledigt")
      .eq("kunde_id", kundeId)
      .order("erledigt", { ascending: true })
      .order("reihenfolge", { ascending: true })
      .order("erstellt_am", { ascending: true });
    setTodos((data as Todo[]) ?? []);
  }

  async function todoHinzufuegen(kundeId: string) {
    if (!neuesTodo.trim()) return;
    const { error } = await supabase.from("kunden_todos").insert({
      organisation_id: organisationId,
      kunde_id: kundeId,
      text: neuesTodo.trim(),
    });
    if (error) {
      console.error(error);
      setHinweis("Todo konnte nicht hinzugefügt werden.");
      return;
    }
    setNeuesTodo("");
    ladeTodos(kundeId);
  }

  async function todoAbhaken(todoId: string, erledigt: boolean, kundeId: string) {
    await supabase
      .from("kunden_todos")
      .update({ erledigt, erledigt_am: erledigt ? new Date().toISOString() : null })
      .eq("id", todoId);
    ladeTodos(kundeId);
  }

  async function todoLoeschen(todoId: string, kundeId: string) {
    await supabase.from("kunden_todos").delete().eq("id", todoId);
    ladeTodos(kundeId);
  }

  async function ladeVertraege(kundeId: string) {
    const { data } = await supabase
      .from("lizenz_vertraege")
      .select("id, lizenz_seriennummer, produkt_name, vertrag_ende, status")
      .eq("kunde_id", kundeId)
      .order("vertrag_ende", { ascending: true, nullsFirst: false });
    setVertraege((data as LizenzVertrag[]) ?? []);
  }

  function bearbeitenOeffnen(k: Kunde) {
    setOffenId(k.id);
    setEntwurf(k);
    setNeuesPreisDatum(new Date().toISOString().slice(0, 10));
    setNeuerPreisEuro("");
    setNeuesTodo("");
    setHinweis(null);
    ladeDokumente(k.id);
    ladePreise(k.id);
    ladeTodos(k.id);
    ladeVertraege(k.id);
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
        vorname: entwurf.vorname?.trim() || null,
        nachname: entwurf.nachname?.trim() || null,
        telefonnummer: entwurf.telefonnummer?.trim() || null,
        strasse: entwurf.strasse?.trim() || null,
        hausnummer: entwurf.hausnummer?.trim() || null,
        plz: entwurf.plz?.trim() || null,
        ort: entwurf.ort?.trim() || null,
        land: entwurf.land?.trim() || null,
        ust_id: entwurf.ust_id?.trim() || null,
        mwst_satz: entwurf.mwst_satz ?? null,
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

  const gefilterteNichtZugeordnete = nichtZugeordnete.filter((d) =>
    d.seriennummer.toLowerCase().includes(filterDongleNummer.trim().toLowerCase()),
  );
  const gefilterteNichtZugeordneteVertraege = nichtZugeordneteVertraege.filter((v) =>
    v.lizenz_seriennummer.toLowerCase().includes(filterVertragNummer.trim().toLowerCase()),
  );
  const dongleSuchtAktiv = filterDongleNummer.trim() !== "";
  const sichtbareNichtZugeordnete =
    dongleSuchtAktiv || alleDonglesAnzeigen
      ? gefilterteNichtZugeordnete
      : gefilterteNichtZugeordnete.slice(0, ANZAHL_STANDARD_SICHTBAR);
  const vertragSuchtAktiv = filterVertragNummer.trim() !== "";
  const sichtbareNichtZugeordneteVertraege =
    vertragSuchtAktiv || alleVertraegeAnzeigen
      ? gefilterteNichtZugeordneteVertraege
      : gefilterteNichtZugeordneteVertraege.slice(0, ANZAHL_STANDARD_SICHTBAR);

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

      <DongleImport organisationId={organisationId} onImportiert={ladeNichtZugeordnete} />

      {nichtZugeordnete.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--border-input)] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Nicht zugeordnete Lizenzen ({gefilterteNichtZugeordnete.length}/{nichtZugeordnete.length})
          </p>
          {zeigeArchivierte && (
            <p className="text-xs text-[var(--text-faint)]">
              Zum Zuweisen erst zu "Aktive" wechseln.
            </p>
          )}
          <input
            type="text"
            value={filterDongleNummer}
            onChange={(e) => setFilterDongleNummer(e.target.value)}
            placeholder="Nach Seriennummer filtern…"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
          />
          {gefilterteNichtZugeordnete.length === 0 && (
            <p className="text-xs text-[var(--text-faint)]">Keine Treffer für diesen Filter.</p>
          )}
          <div className="space-y-1.5">
            {sichtbareNichtZugeordnete.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
              >
                <span className="font-mono text-xs text-[var(--text-strong)]">{d.seriennummer}</span>
                <span className="text-xs text-[var(--text-faint)]">· {d.software}</span>
                {d.gruppe && <span className="text-xs text-[var(--text-faint)]">({d.gruppe})</span>}
                {!zeigeArchivierte && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <select
                      value={zuweisenAn[d.id] ?? ""}
                      onChange={(e) => setZuweisenAn((z) => ({ ...z, [d.id]: e.target.value }))}
                      className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-strong)]"
                    >
                      <option value="">Kunde wählen…</option>
                      {kunden.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name ?? "Unbenannt"}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => dongleZuweisen(d.id)}
                      disabled={!zuweisenAn[d.id]}
                      className="shrink-0 rounded bg-akzent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Zuweisen
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!dongleSuchtAktiv && gefilterteNichtZugeordnete.length > ANZAHL_STANDARD_SICHTBAR && (
            <button
              onClick={() => setAlleDonglesAnzeigen((v) => !v)}
              className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            >
              {alleDonglesAnzeigen ? "Weniger anzeigen" : `Alle ${gefilterteNichtZugeordnete.length} anzeigen`}
            </button>
          )}
        </div>
      )}

      {nichtZugeordneteVertraege.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--border-input)] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            Nicht zugeordnete Lizenzverträge ({gefilterteNichtZugeordneteVertraege.length}/{nichtZugeordneteVertraege.length})
          </p>
          {zeigeArchivierte && (
            <p className="text-xs text-[var(--text-faint)]">
              Zum Zuweisen erst zu "Aktive" wechseln.
            </p>
          )}
          <input
            type="text"
            value={filterVertragNummer}
            onChange={(e) => setFilterVertragNummer(e.target.value)}
            placeholder="Nach Seriennummer filtern…"
            className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-strong)]"
          />
          {gefilterteNichtZugeordneteVertraege.length === 0 && (
            <p className="text-xs text-[var(--text-faint)]">Keine Treffer für diesen Filter.</p>
          )}
          <div className="space-y-1.5">
            {sichtbareNichtZugeordneteVertraege.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
              >
                <span className="font-mono text-xs text-[var(--text-strong)]">{v.lizenz_seriennummer}</span>
                <span className="text-xs text-[var(--text-faint)]">· {v.produkt_name}</span>
                {v.vertrag_ende && (
                  <span className="text-xs text-[var(--text-faint)]">
                    (bis {new Date(v.vertrag_ende).toLocaleDateString("de-DE")})
                  </span>
                )}
                {!zeigeArchivierte && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <select
                      value={zuweisenAnVertrag[v.id] ?? ""}
                      onChange={(e) => setZuweisenAnVertrag((z) => ({ ...z, [v.id]: e.target.value }))}
                      className="rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-strong)]"
                    >
                      <option value="">Kunde wählen…</option>
                      {kunden.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name ?? "Unbenannt"}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => vertragZuweisen(v.id)}
                      disabled={!zuweisenAnVertrag[v.id]}
                      className="shrink-0 rounded bg-akzent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Zuweisen
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!vertragSuchtAktiv && gefilterteNichtZugeordneteVertraege.length > ANZAHL_STANDARD_SICHTBAR && (
            <button
              onClick={() => setAlleVertraegeAnzeigen((v) => !v)}
              className="w-full rounded border border-[var(--border-input)] px-3 py-1.5 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            >
              {alleVertraegeAnzeigen ? "Weniger anzeigen" : `Alle ${gefilterteNichtZugeordneteVertraege.length} anzeigen`}
            </button>
          )}
        </div>
      )}

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

              <div className="flex gap-2">
                <select
                  value={entwurf.land ?? "Deutschland"}
                  onChange={(e) => {
                    const land = e.target.value;
                    setEntwurf({
                      ...entwurf,
                      land,
                      mwst_satz: LAENDER_MWST[land] ?? entwurf.mwst_satz,
                    });
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
                    value={entwurf.mwst_satz ?? ""}
                    onChange={(e) =>
                      setEntwurf({
                        ...entwurf,
                        mwst_satz: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="MwSt."
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <span className="text-xs text-[var(--text-faint)]">%</span>
                </div>
              </div>
              <p className="-mt-1 text-xs text-[var(--text-faint)]">
                Vorschlagswert nach Land, Steuersatz bleibt frei änderbar (z.B. Kleinunternehmer,
                Reverse-Charge).
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  USt-IdNr. (für steuerfreie innergemeinschaftliche Lieferung)
                </label>
                <input
                  type="text"
                  value={entwurf.ust_id ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, ust_id: e.target.value })}
                  placeholder="z.B. ATU12345678"
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  Wenn ausgefüllt, weist die Rechnung automatisch 0% MwSt. aus und vermerkt
                  "Steuerfreie innergemeinschaftliche Lieferung / Tax-free intra-Community
                  supply".
                </p>
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
                              <span className="ml-2 rounded bg-akzent px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
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

              <div className="border-t border-[var(--border)] pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  Todo-Liste
                </p>

                {todos.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {todos.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={t.erledigt}
                          onChange={(e) => todoAbhaken(t.id, e.target.checked, k.id)}
                          className="accent-akzent"
                        />
                        <span
                          className={`flex-1 text-sm ${
                            t.erledigt
                              ? "text-[var(--text-faint)] line-through"
                              : "text-[var(--text-strong)]"
                          }`}
                        >
                          {t.text}
                        </span>
                        <button
                          onClick={() => todoLoeschen(t.id, k.id)}
                          className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                        >
                          Löschen
                        </button>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={neuesTodo}
                    onChange={(e) => setNeuesTodo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && todoHinzufuegen(k.id)}
                    placeholder="Neues Todo…"
                    className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <button
                    onClick={() => todoHinzufuegen(k.id)}
                    className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  Dongles / Lizenzen
                </p>
                <DongleVerwaltung kundeId={k.id} organisationId={organisationId} />
              </div>

              {vertraege.length > 0 && (
                <div className="border-t border-[var(--border)] pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                    Lizenzverträge (Ablauf/Verlängerung)
                  </p>
                  <div className="space-y-1.5">
                    {vertraege.map((v) => {
                      const tageBisAblauf = v.vertrag_ende
                        ? Math.round((new Date(v.vertrag_ende).getTime() - Date.now()) / 86400000)
                        : null;
                      const baldFaellig = tageBisAblauf !== null && tageBisAblauf <= 30;
                      return (
                        <div
                          key={v.id}
                          className={`flex flex-wrap items-center gap-2 rounded px-3 py-1.5 ${
                            baldFaellig ? "bg-amber-50 dark:bg-amber-950/30" : "bg-[var(--bg-muted)]"
                          }`}
                        >
                          <span className="text-sm text-[var(--text-strong)]">{v.produkt_name}</span>
                          <span className="font-mono text-xs text-[var(--text-faint)]">
                            {v.lizenz_seriennummer}
                          </span>
                          {v.status && <span className="text-xs text-[var(--text-faint)]">· {v.status}</span>}
                          {v.vertrag_ende && (
                            <span
                              className={`ml-auto text-xs ${
                                baldFaellig
                                  ? "font-medium text-amber-700 dark:text-amber-400"
                                  : "text-[var(--text-faint)]"
                              }`}
                            >
                              bis {new Date(v.vertrag_ende).toLocaleDateString("de-DE")}
                              {tageBisAblauf !== null && tageBisAblauf >= 0 && ` (${tageBisAblauf} Tage)`}
                              {tageBisAblauf !== null && tageBisAblauf < 0 && " (abgelaufen)"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
