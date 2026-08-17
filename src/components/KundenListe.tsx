import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { sichererDateiname } from "../lib/dateiname";
import { LAENDER_MWST, LAENDER_LISTE } from "../lib/laender";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import Avatar from "./Avatar";
import ZugangsdatenBox from "./ZugangsdatenBox";
import DongleVerwaltung from "./DongleVerwaltung";
import KundenTodoListe from "./KundenTodoListe";
import KundenHardware from "./KundenHardware";
import KundenAuswahl from "./KundenAuswahl";

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
  zusammengefuehrt_in: string | null;
  wartungsvertrag_stufe_id: string | null;
}

interface WartungsvertragStufe {
  id: string;
  name: string;
  farbe: string;
}

interface ZusatzEmail {
  id: string;
  email: string;
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

interface LizenzVertrag {
  id: string;
  lizenz_seriennummer: string;
  produkt_name: string;
  vertrag_ende: string | null;
  status: string | null;
}

interface HardwareKategorie {
  id: string;
  name: string;
}

interface HardwareEintrag {
  kunde_id: string;
  kategorie_id: string;
  wert: string;
}

interface KundenListeProps {
  organisationId: string;
  refreshKey?: number;
  organisationName?: string | null;
  organisationAdresse?: string | null;
  organisationLogoUrl?: string | null;
  onlineIds?: Set<string>;
}

const KUNDEN_STANDARD_SICHTBAR = 10;

// exocad-Lizenzen laufen ueblicherweise ein Jahr - ohne Vertragsbeginn im
// Datenmodell dient ein 365-Tage-Referenzfenster als Naeherung fuer den
// Fuellstand des Laufzeit-Balkens (100% = Vertragsende erreicht).
function laufzeitInfo(vertragEnde: string | null | undefined) {
  if (!vertragEnde) return null;
  const tage = Math.round((new Date(vertragEnde).getTime() - Date.now()) / 86400000);
  const prozent = Math.max(0, Math.min(100, 100 - (tage / 365) * 100));
  const farbe =
    tage < 0
      ? "var(--badge-kritisch-text)"
      : tage <= 30
      ? "var(--status-offen-text)"
      : "var(--akzent)";
  return { tage, prozent, farbe };
}

export default function KundenListe({
  organisationId,
  refreshKey,
  organisationName,
  organisationAdresse,
  organisationLogoUrl,
  onlineIds,
}: KundenListeProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).kundenListe;
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [suchbegriff, setSuchbegriff] = useState("");
  const [zeigeArchivierte, setZeigeArchivierte] = useState(false);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Partial<Kunde>>({});
  const [preise, setPreise] = useState<KundenPreis[]>([]);
  const [neuesPreisDatum, setNeuesPreisDatum] = useState("");
  const [neuerPreisEuro, setNeuerPreisEuro] = useState("");
  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [vertraege, setVertraege] = useState<LizenzVertrag[]>([]);
  const [alleKundenAnzeigen, setAlleKundenAnzeigen] = useState(false);
  const [hardwareKategorien, setHardwareKategorien] = useState<HardwareKategorie[]>([]);
  const [hardwareEintraege, setHardwareEintraege] = useState<HardwareEintrag[]>([]);
  const [wartungsvertragStufen, setWartungsvertragStufen] = useState<WartungsvertragStufe[]>([]);
  const [filterKategorieId, setFilterKategorieId] = useState("");
  const [filterWert, setFilterWert] = useState("");
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [kundeEmail, setKundeEmail] = useState<string | null>(null);
  const [emailEntwurf, setEmailEntwurf] = useState("");
  const [emailLaedt, setEmailLaedt] = useState(false);
  const [zusatzEmails, setZusatzEmails] = useState<ZusatzEmail[]>([]);
  const [neueZusatzEmail, setNeueZusatzEmail] = useState("");
  const [zeigeZusammenfuehren, setZeigeZusammenfuehren] = useState(false);
  const [zusammenfuehrenQuelleId, setZusammenfuehrenQuelleId] = useState("");
  const [zusammenfuehrenLaedt, setZusammenfuehrenLaedt] = useState(false);
  const [mergeVersion, setMergeVersion] = useState(0);
  const [zielNamen, setZielNamen] = useState<Record<string, string>>({});
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
    ladeHardwareFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey]);

  useEffect(() => {
    supabase
      .from("wartungsvertrag_stufen")
      .select("id, name, farbe")
      .eq("organisation_id", organisationId)
      .order("reihenfolge")
      .then(({ data }) => setWartungsvertragStufen((data as WartungsvertragStufe[]) ?? []));
  }, [organisationId]);

  async function ladeHardwareFilter() {
    const [{ data: katDaten }, { data: eintragDaten }] = await Promise.all([
      supabase.from("hardware_kategorien").select("id, name").eq("organisation_id", organisationId).order("name"),
      supabase.from("kunden_hardware").select("kunde_id, kategorie_id, wert").eq("organisation_id", organisationId),
    ]);
    setHardwareKategorien((katDaten as HardwareKategorie[]) ?? []);
    setHardwareEintraege((eintragDaten as HardwareEintrag[]) ?? []);
  }

  async function ladeKunden() {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, name, vorname, nachname, avatar_url, telefonnummer, strasse, hausnummer, plz, ort, land, mwst_satz, ust_id, notizen, deaktiviert, zusammengefuehrt_in, wartungsvertrag_stufe_id",
      )
      .eq("organisation_id", organisationId)
      .eq("rolle", "kunde")
      .eq("deaktiviert", zeigeArchivierte)
      .order("name");
    if (error) {
      console.error("[KundenListe] Laden fehlgeschlagen:", error);
      setHinweis(txt.fehlerLaden);
    }
    const geladeneKunden = (data as Kunde[]) ?? [];
    setKunden(geladeneKunden);

    const zielIds = Array.from(
      new Set(geladeneKunden.map((k) => k.zusammengefuehrt_in).filter((id): id is string => !!id)),
    );
    if (zielIds.length > 0) {
      const { data: ziele } = await supabase.from("profiles").select("id, name").in("id", zielIds);
      const map: Record<string, string> = {};
      for (const z of (ziele as { id: string; name: string | null }[]) ?? []) {
        map[z.id] = z.name ?? txt.unbenannt;
      }
      setZielNamen(map);
    } else {
      setZielNamen({});
    }
  }

  async function statusUmschalten(kundeId: string, deaktivieren: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ deaktiviert: deaktivieren })
      .eq("id", kundeId);
    if (error) {
      console.error(error);
      setHinweis(txt.fehlerAktion);
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
    setHinweis(null);
    setKundeEmail(null);
    setEmailEntwurf("");
    setNeueZusatzEmail("");
    setZeigeZusammenfuehren(false);
    setZusammenfuehrenQuelleId("");
    ladeDokumente(k.id);
    ladePreise(k.id);
    ladeVertraege(k.id);
    ladeKundeEmail(k.id);
    ladeZusatzEmails(k.id);
  }

  async function ladeKundeEmail(kundeId: string) {
    const { data } = await supabase.rpc("get_kunde_email", { p_kunde_id: kundeId });
    setKundeEmail((data as string | null) ?? null);
  }

  async function kundeEmailAendern(kundeId: string) {
    if (!emailEntwurf.trim() || !emailEntwurf.includes("@")) {
      setHinweis(txt.fehlerEmailUngueltig);
      return;
    }
    setEmailLaedt(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aendere-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ nutzerId: kundeId, neueEmail: emailEntwurf.trim() }),
      },
    );
    const json = await res.json();
    setEmailLaedt(false);
    if (!res.ok) {
      setHinweis(json.error ?? txt.fehlerEmailAendern);
      return;
    }
    setEmailEntwurf("");
    setHinweis(txt.erfolgEmailGeaendert);
    ladeKundeEmail(kundeId);
  }

  async function ladeZusatzEmails(kundeId: string) {
    const { data } = await supabase
      .from("kunden_email_adressen")
      .select("id, email")
      .eq("kunde_id", kundeId)
      .order("erstellt_am");
    setZusatzEmails((data as ZusatzEmail[]) ?? []);
  }

  async function zusatzEmailHinzufuegen(kundeId: string) {
    const email = neueZusatzEmail.trim().toLowerCase();
    if (!email) return;
    const { error } = await supabase
      .from("kunden_email_adressen")
      .insert({ organisation_id: organisationId, kunde_id: kundeId, email });
    if (error) {
      setHinweis(
        error.code === "23505"
          ? txt.fehlerEmailVergeben
          : txt.fehlerEmailHinzufuegen,
      );
      return;
    }
    setNeueZusatzEmail("");
    ladeZusatzEmails(kundeId);
  }

  async function zusatzEmailLoeschen(id: string, kundeId: string) {
    await supabase.from("kunden_email_adressen").delete().eq("id", id);
    ladeZusatzEmails(kundeId);
  }

  async function kontenZusammenfuehren(zielId: string) {
    if (!zusammenfuehrenQuelleId) return;
    setZusammenfuehrenLaedt(true);
    setHinweis(null);
    const { error } = await supabase.rpc("kunden_zusammenfuehren", {
      p_ziel_kunde_id: zielId,
      p_quelle_kunde_id: zusammenfuehrenQuelleId,
    });
    setZusammenfuehrenLaedt(false);
    if (error) {
      console.error(error);
      setHinweis(error.message ?? txt.fehlerZusammenfuehren);
      return;
    }
    setZeigeZusammenfuehren(false);
    setZusammenfuehrenQuelleId("");
    setHinweis(txt.erfolgZusammengefuehrt);
    setMergeVersion((v) => v + 1);
    ladeZusatzEmails(zielId);
    ladeDokumente(zielId);
    ladePreise(zielId);
    ladeVertraege(zielId);
    ladeKunden();
  }

  async function preisHinzufuegen(kundeId: string) {
    if (!neuesPreisDatum || neuerPreisEuro.trim() === "") return;
    const wert = parseFloat(neuerPreisEuro.trim().replace(",", "."));
    if (isNaN(wert)) {
      setHinweis(txt.fehlerUngueltigerPreis);
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
      setHinweis(txt.fehlerPreisHinzufuegen);
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
        wartungsvertrag_stufe_id: entwurf.wartungsvertrag_stufe_id || null,
      })
      .eq("id", offenId);
    setLaedt(false);
    if (error) {
      console.error(error);
      setHinweis(txt.fehlerSpeichern);
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
      setHinweis(txt.fehlerAvatarUpload);
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
      setHinweis(txt.fehlerDokumentUpload);
    } finally {
      setLaedt(false);
    }
  }

  async function dokumentOeffnen(pfad: string) {
    const { data, error } = await supabase.storage
      .from("kundendokumente")
      .createSignedUrl(pfad, 60);
    if (error || !data) {
      setHinweis(txt.fehlerDokumentOeffnen);
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
      if (!res.ok) throw new Error(json.error ?? txt.fehlerLinkFehlgeschlagen);
      setNeuerZugang({ email: json.email, link: json.link, telefon: telefon ?? undefined });
    } catch (err) {
      console.error(err);
      setHinweis(txt.fehlerNeuerLink);
    } finally {
      setLaedt(false);
    }
  }

  const hardwareWertOptionen = filterKategorieId
    ? Array.from(
        new Set(
          hardwareEintraege
            .filter((e) => e.kategorie_id === filterKategorieId)
            .map((e) => e.wert),
        ),
      ).sort()
    : [];
  const hardwareGefilterteKundenIds =
    filterKategorieId && filterWert
      ? new Set(
          hardwareEintraege
            .filter((e) => e.kategorie_id === filterKategorieId && e.wert === filterWert)
            .map((e) => e.kunde_id),
        )
      : null;

  const gefilterteKunden = kunden.filter((k) => {
    const begriff = suchbegriff.trim().toLowerCase();
    if (begriff) {
      const treffer = [k.name, k.telefonnummer, k.strasse, k.hausnummer, k.plz, k.ort]
        .filter(Boolean)
        .some((feld) => feld!.toLowerCase().includes(begriff));
      if (!treffer) return false;
    }
    if (hardwareGefilterteKundenIds && !hardwareGefilterteKundenIds.has(k.id)) return false;
    return true;
  });
  const kundenSuchtAktiv = suchbegriff.trim() !== "" || (filterKategorieId !== "" && filterWert !== "");
  const sichtbareKunden = kundenSuchtAktiv || alleKundenAnzeigen
    ? gefilterteKunden
    : gefilterteKunden.slice(0, KUNDEN_STANDARD_SICHTBAR);


  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={suchbegriff}
          onChange={(e) => setSuchbegriff(e.target.value)}
          placeholder={txt.suchePlatzhalter}
          className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
        />
        <button
          onClick={() => setZeigeArchivierte((v) => !v)}
          className="shrink-0 text-xs text-[var(--text-faint)] hover:underline"
        >
          {zeigeArchivierte ? txt.zurueckAktive : txt.archiv}
        </button>
      </div>

      {hardwareKategorien.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={filterKategorieId}
            onChange={(e) => {
              setFilterKategorieId(e.target.value);
              setFilterWert("");
            }}
            className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
          >
            <option value="">{txt.nachHardwareFiltern}</option>
            {hardwareKategorien.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          {filterKategorieId && (
            <select
              value={filterWert}
              onChange={(e) => setFilterWert(e.target.value)}
              className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-strong)]"
            >
              <option value="">{txt.wertWaehlen}</option>
              {hardwareWertOptionen.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          )}
          {(filterKategorieId || filterWert) && (
            <button
              onClick={() => {
                setFilterKategorieId("");
                setFilterWert("");
              }}
              className="shrink-0 text-xs text-[var(--text-faint)] hover:underline"
            >
              {txt.zuruecksetzen}
            </button>
          )}
        </div>
      )}

      {gefilterteKunden.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">
          {kunden.length === 0
            ? zeigeArchivierte
              ? txt.keineDeaktiviertenKunden
              : txt.nochKeineKunden
            : txt.keineTreffer}
        </p>
      ) : (
        sichtbareKunden.map((k) => (
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
                  title={txt.online}
                />
              )}
            </span>
            <span className="text-sm text-[var(--text-strong)]">{k.name ?? txt.unbenannt}</span>
            <span className="ml-auto truncate text-xs text-[var(--text-faint)]">
              {k.telefonnummer ?? "—"}
            </span>
          </button>

          {offenId === k.id && (
            <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={entwurf.name ?? k.name} avatarUrl={entwurf.avatar_url ?? null} groesse="lg" />
                <label className="cursor-pointer rounded border border-[var(--border-input)] px-3 py-1.5 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                  {txt.profilbildAendern}
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
                  {txt.emailLoginLabel}
                </label>
                <p className="mb-1.5 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-strong)]">
                  {kundeEmail ?? "—"}
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailEntwurf}
                    onChange={(e) => setEmailEntwurf(e.target.value)}
                    placeholder={txt.neueEmailPlatzhalter}
                    className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <button
                    onClick={() => kundeEmailAendern(k.id)}
                    disabled={emailLaedt || !emailEntwurf.includes("@") || emailEntwurf === kundeEmail}
                    className="shrink-0 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {emailLaedt ? "…" : txt.emailAendern}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.weitereEmailsLabel}{" "}
                  <span className="font-normal text-[var(--text-faint)]">
                    {txt.weitereEmailsHinweis}
                  </span>
                </label>
                {zusatzEmails.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {zusatzEmails.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5 text-sm"
                      >
                        <span className="truncate text-[var(--text-strong)]">{e.email}</span>
                        <button
                          onClick={() => zusatzEmailLoeschen(e.id, k.id)}
                          className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                        >
                          {txt.entfernen}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={neueZusatzEmail}
                    onChange={(e) => setNeueZusatzEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && zusatzEmailHinzufuegen(k.id)}
                    placeholder={txt.weitereEmailPlatzhalter}
                    className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <button
                    onClick={() => zusatzEmailHinzufuegen(k.id)}
                    className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    +
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  {txt.zusatzEmailHinweis}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.telefonWhatsapp}
                </label>
                <input
                  type="text"
                  value={entwurf.telefonnummer ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, telefonnummer: e.target.value })}
                  placeholder={txt.telefonPlatzhalter}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={entwurf.strasse ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, strasse: e.target.value })}
                  placeholder={txt.strassePlatzhalter}
                  className="flex-1 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={entwurf.hausnummer ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, hausnummer: e.target.value })}
                  placeholder={txt.nrPlatzhalter}
                  className="w-16 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={entwurf.plz ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, plz: e.target.value })}
                  placeholder={txt.plzPlatzhalter}
                  className="w-24 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <input
                  type="text"
                  value={entwurf.ort ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, ort: e.target.value })}
                  placeholder={txt.ortPlatzhalter}
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
                    placeholder={txt.mwstPlatzhalter}
                    className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-2 py-2 text-sm text-[var(--text-strong)]"
                  />
                  <span className="text-xs text-[var(--text-faint)]">%</span>
                </div>
              </div>
              <p className="-mt-1 text-xs text-[var(--text-faint)]">
                {txt.mwstHinweis}
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.ustIdLabel}
                </label>
                <input
                  type="text"
                  value={entwurf.ust_id ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, ust_id: e.target.value })}
                  placeholder={txt.ustIdPlatzhalter}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  {txt.ustIdHinweis}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.wartungsvertragLabel}
                </label>
                <select
                  value={entwurf.wartungsvertrag_stufe_id ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, wartungsvertrag_stufe_id: e.target.value || null })}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                >
                  <option value="">{texte(sprache).wartungsvertrag.minutenpreis}</option>
                  {wartungsvertragStufen.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  {txt.wartungsvertragHinweis}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.notizenLabel}
                </label>
                <textarea
                  value={entwurf.notizen ?? ""}
                  onChange={(e) => setEntwurf({ ...entwurf, notizen: e.target.value })}
                  rows={3}
                  placeholder={txt.notizenPlatzhalter}
                  className="w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
                  {txt.individuellerPreisLabel}
                </label>

                {preise.length === 0 ? (
                  <p className="mb-2 text-xs text-[var(--text-faint)]">
                    {txt.keinPreisGesetzt}
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
                            {txt.abPrefix} {new Date(p.gueltig_ab).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")}:{" "}
                            {(p.preis_pro_minute_cent / 100).toLocaleString(sprache === "en" ? "en-US" : "de-DE", {
                              style: "currency",
                              currency: "EUR",
                            })}
                            {p.id === aktiveId && (
                              <span className="ml-2 rounded bg-akzent px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
                                {txt.aktuell}
                              </span>
                            )}
                            {p.gueltig_ab > heute && (
                              <span className="ml-2 rounded bg-[var(--border)] px-1.5 py-0.5 text-[0.65rem] font-medium text-[var(--text-soft)]">
                                {txt.geplant}
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => preisLoeschen(p.id, k.id)}
                            className="shrink-0 text-xs text-[var(--text-faint)] hover:text-red-600"
                          >
                            {txt.entfernen}
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
                    placeholder={txt.preisPlatzhalter}
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
                  {txt.preisHinweis}
                </p>
              </div>

              <button
                onClick={speichern}
                disabled={laedt}
                className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {txt.speichern}
              </button>

              <div className="border-t border-[var(--border)] pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  {txt.dokumenteLabel}
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
                          {txt.loeschen}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="block cursor-pointer rounded border border-dashed border-[var(--border-input)] px-3 py-2 text-center text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                  {txt.dokumentHochladen}
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
                  {txt.todoListe}
                </p>
                <KundenTodoListe
                  key={`todos-${k.id}-${mergeVersion}`}
                  kundeId={k.id}
                  organisationId={organisationId}
                  modus="voll"
                />
              </div>

              <div className="border-t border-[var(--border)] pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  {txt.hardware}
                </p>
                <KundenHardware
                  key={`hardware-${k.id}-${mergeVersion}`}
                  kundeId={k.id}
                  organisationId={organisationId}
                />
              </div>

              <div className="border-t border-[var(--border)] pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  {txt.donglesLizenzen}
                </p>
                <DongleVerwaltung
                  key={`dongle-${k.id}-${mergeVersion}`}
                  kundeId={k.id}
                  organisationId={organisationId}
                />
              </div>

              {vertraege.length > 0 && (
                <div className="border-t border-[var(--border)] pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                    {txt.lizenzvertraegeLabel}
                  </p>
                  <div className="space-y-2">
                    {vertraege.map((v) => {
                      const info = laufzeitInfo(v.vertrag_ende);
                      return (
                        <div key={v.id} className="rounded bg-[var(--bg-muted)] px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-[var(--text-strong)]">{v.produkt_name}</span>
                            <span className="font-mono text-xs text-[var(--text-faint)]">
                              {v.lizenz_seriennummer}
                            </span>
                            {v.status && <span className="text-xs text-[var(--text-faint)]">· {v.status}</span>}
                          </div>
                          {v.vertrag_ende && info && (
                            <div className="mt-1.5">
                              <div className="mb-1 flex justify-between text-xs text-[var(--text-faint)]">
                                <span>{txt.laufzeit}</span>
                                <span style={{ color: info.farbe }} className="font-medium">
                                  {txt.bisPrefix} {new Date(v.vertrag_ende).toLocaleDateString(sprache === "en" ? "en-US" : "de-DE")}
                                  {info.tage >= 0 ? ` (${info.tage} ${txt.tageSuffix})` : ` ${txt.abgelaufen}`}
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${info.prozent}%`, background: info.farbe }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!zeigeArchivierte && (
                <div className="border-t border-[var(--border)] pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                    {txt.kontenZusammenfuehrenLabel}
                  </p>
                  {!zeigeZusammenfuehren ? (
                    <button
                      onClick={() => setZeigeZusammenfuehren(true)}
                      className="w-full rounded border border-[var(--border-input)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                    >
                      {txt.mitAnderemKontoZusammenfuehren}
                    </button>
                  ) : (
                    <div className="space-y-2 rounded border border-[var(--border-input)] p-3">
                      <p className="text-xs text-[var(--text-faint)]">
                        {txt.zusammenfuehrenBeschreibungVor}{" "}
                        <strong>{k.name ?? txt.diesemKunden}</strong>
                        {txt.zusammenfuehrenBeschreibungNach}
                      </p>
                      <KundenAuswahl
                        organisationId={organisationId}
                        value={zusammenfuehrenQuelleId}
                        onChange={setZusammenfuehrenQuelleId}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => kontenZusammenfuehren(k.id)}
                          disabled={
                            zusammenfuehrenLaedt || !zusammenfuehrenQuelleId || zusammenfuehrenQuelleId === k.id
                          }
                          className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {zusammenfuehrenLaedt ? txt.wirdZusammengefuehrt : txt.zusammenfuehren}
                        </button>
                        <button
                          onClick={() => {
                            setZeigeZusammenfuehren(false);
                            setZusammenfuehrenQuelleId("");
                          }}
                          className="rounded border border-[var(--border-input)] px-3 py-2 text-sm text-[var(--text-soft)]"
                        >
                          {txt.abbrechen}
                        </button>
                      </div>
                      {zusammenfuehrenQuelleId === k.id && (
                        <p className="text-xs text-red-600">{txt.bitteAnderesKontoWaehlen}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}

              <button
                onClick={() => neuenLinkAnfordern(k.id, entwurf.telefonnummer ?? null)}
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
                  k.zusammengefuehrt_in ? (
                    <p className="text-xs text-[var(--text-faint)]">
                      {txt.kontoZusammengefuehrtInVor}{" "}
                      <strong>{zielNamen[k.zusammengefuehrt_in] ?? txt.einAnderesKonto}</strong>
                      {txt.kontoZusammengefuehrtInNach}
                    </p>
                  ) : (
                    <button
                      onClick={() => statusUmschalten(k.id, false)}
                      className="w-full rounded border border-[var(--border-input)] px-4 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
                    >
                      {txt.wiederAktivieren}
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => statusUmschalten(k.id, true)}
                    className="w-full rounded border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                  >
                    {txt.kundeDeaktivieren}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        ))
      )}

      {!kundenSuchtAktiv && gefilterteKunden.length > KUNDEN_STANDARD_SICHTBAR && (
        <button
          onClick={() => setAlleKundenAnzeigen((v) => !v)}
          className="w-full rounded border border-[var(--border-input)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
        >
          {alleKundenAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(gefilterteKunden.length))}
        </button>
      )}
    </div>
  );
}
