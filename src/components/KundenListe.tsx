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
import KundenDokumente from "./KundenDokumente";
import KundenAuswahl from "./KundenAuswahl";
import LeerZustand from "./LeerZustand";
import { zuletztText, vonDatum, alsBesuchsZeilen, type BesuchsZeile } from "../lib/zeitText";
import { Camera, ChevronDown, ChevronLeft, Handshake, KeyRound, X } from "lucide-react";

interface Kunde {
  id: string;
  name: string | null;
  vorname: string | null;
  nachname: string | null;
  firmenname: string | null;
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
  subreseller_id: string | null;
}

interface WartungsvertragStufe {
  id: string;
  name: string;
  farbe: string;
}

interface Subreseller {
  id: string;
  name: string;
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

const KUNDEN_STANDARD_SICHTBAR = 15;

type DetailTab = "stammdaten" | "vertrag" | "dongles" | "hardware" | "dokumente" | "konto";

interface KundenKennzahl {
  dongles: number;
  renewalOffen: number;
}

// PostgREST liefert pro Anfrage maximal 1000 Zeilen - bei grossen Beständen
// seitenweise nachladen, sonst stimmen die Zähler pro Kunde nicht.
async function ladeSeiten<T>(
  bauen: (von: number, bis: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const alle: T[] = [];
  for (let von = 0; ; von += 1000) {
    const { data } = await bauen(von, von + 999);
    alle.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return alle;
}

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
  const [tab, setTab] = useState<DetailTab>("stammdaten");
  const [kennzahlen, setKennzahlen] = useState<Record<string, KundenKennzahl>>({});
  const [besuche, setBesuche] = useState<Record<string, BesuchsZeile>>({});
  const [entwurf, setEntwurf] = useState<Partial<Kunde>>({});
  const [preise, setPreise] = useState<KundenPreis[]>([]);
  const [neuesPreisDatum, setNeuesPreisDatum] = useState("");
  const [neuerPreisEuro, setNeuerPreisEuro] = useState("");
  const [vertraege, setVertraege] = useState<LizenzVertrag[]>([]);
  const [alleKundenAnzeigen, setAlleKundenAnzeigen] = useState(false);
  const [offeneGruppen, setOffeneGruppen] = useState<Set<string>>(new Set());
  const [hardwareKategorien, setHardwareKategorien] = useState<HardwareKategorie[]>([]);
  const [hardwareEintraege, setHardwareEintraege] = useState<HardwareEintrag[]>([]);
  const [wartungsvertragStufen, setWartungsvertragStufen] = useState<WartungsvertragStufe[]>([]);
  const [subresellerListe, setSubresellerListe] = useState<Subreseller[]>([]);
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

    supabase
      .from("subreseller")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .order("name")
      .then(({ data }) => setSubresellerListe((data as Subreseller[]) ?? []));
  }, [organisationId]);

  useEffect(() => {
    ladeKennzahlen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, refreshKey, mergeVersion]);

  // Zähler für die Badges in der Liste: Dongles je Kunde und aktive
  // Lizenzverträge, die in <= 30 Tagen ablaufen und noch nicht bezahlt sind.
  async function ladeKennzahlen() {
    const [dongles, vertraegeAlle] = await Promise.all([
      ladeSeiten<{ kunde_id: string }>((von, bis) =>
        supabase
          .from("kunden_dongles")
          .select("kunde_id")
          .eq("organisation_id", organisationId)
          .not("kunde_id", "is", null)
          .range(von, bis),
      ),
      ladeSeiten<{ kunde_id: string; vertrag_ende: string | null; renewal_bezahlt: boolean; status: string | null }>(
        (von, bis) =>
          supabase
            .from("lizenz_vertraege")
            .select("kunde_id, vertrag_ende, renewal_bezahlt, status")
            .eq("organisation_id", organisationId)
            .not("kunde_id", "is", null)
            .range(von, bis),
      ),
    ]);
    const karte: Record<string, KundenKennzahl> = {};
    const eintrag = (id: string) => (karte[id] ??= { dongles: 0, renewalOffen: 0 });
    for (const d of dongles) eintrag(d.kunde_id).dongles++;
    const grenze = Date.now() + 30 * 86400000;
    for (const v of vertraegeAlle) {
      if (!v.vertrag_ende || v.renewal_bezahlt) continue;
      if (v.status && v.status.toLowerCase() !== "active") continue;
      if (new Date(v.vertrag_ende).getTime() <= grenze) eintrag(v.kunde_id).renewalOffen++;
    }
    setKennzahlen(karte);

    // Letzter Portal-Besuch je Kunde (Besuchserfassung, Abschnitt 84) - bei
    // fehlender Berechtigung oder Fehler einfach ohne diese Zeile.
    const { data: besuchDaten, error: besuchFehler } = await supabase.rpc("besuche_auswertung", {
      p_organisation_id: organisationId,
      p_von: vonDatum(90),
    });
    if (!besuchFehler) {
      setBesuche(Object.fromEntries(alsBesuchsZeilen(besuchDaten).map((b) => [b.nutzer_id, b])));
    }
  }

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
        "id, name, vorname, nachname, firmenname, avatar_url, telefonnummer, strasse, hausnummer, plz, ort, land, mwst_satz, ust_id, notizen, deaktiviert, zusammengefuehrt_in, wartungsvertrag_stufe_id, subreseller_id",
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
    setTab("stammdaten");
    setEntwurf(k);
    setNeuesPreisDatum(new Date().toISOString().slice(0, 10));
    setNeuerPreisEuro("");
    setHinweis(null);
    setKundeEmail(null);
    setEmailEntwurf("");
    setNeueZusatzEmail("");
    setZeigeZusammenfuehren(false);
    setZusammenfuehrenQuelleId("");
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
        firmenname: entwurf.firmenname?.trim() || null,
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
        subreseller_id: entwurf.subreseller_id || null,
      })
      .eq("id", offenId);
    setLaedt(false);
    if (error) {
      console.error(error);
      setHinweis(txt.fehlerSpeichern);
      return;
    }
    setHinweis(txt.erfolgGespeichert);
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
      const subresellerName = subresellerListe.find((s) => s.id === k.subreseller_id)?.name;
      const treffer = [k.name, k.firmenname, k.telefonnummer, k.strasse, k.hausnummer, k.plz, k.ort, subresellerName]
        .filter(Boolean)
        .some((feld) => feld!.toLowerCase().includes(begriff));
      if (!treffer) return false;
    }
    if (hardwareGefilterteKundenIds && !hardwareGefilterteKundenIds.has(k.id)) return false;
    return true;
  });
  const kundenSuchtAktiv = suchbegriff.trim() !== "" || (filterKategorieId !== "" && filterWert !== "");

  // Kunden eines Subresellers erscheinen eingerueckt unter dessen Gruppen-
  // Karte; alle anderen ("direkte Kunden") darunter wie bisher.
  const subresellerIds = new Set(subresellerListe.map((s) => s.id));
  const direkteKunden = gefilterteKunden.filter((k) => !k.subreseller_id || !subresellerIds.has(k.subreseller_id));
  const gruppen = subresellerListe
    .map((s) => ({ sub: s, kunden: gefilterteKunden.filter((k) => k.subreseller_id === s.id) }))
    .filter((g) => g.kunden.length > 0);
  const sichtbareKunden = kundenSuchtAktiv || alleKundenAnzeigen
    ? direkteKunden
    : direkteKunden.slice(0, KUNDEN_STANDARD_SICHTBAR);


  const feld =
    "w-full rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]";
  const lbl = "mb-1 block text-xs font-medium text-[var(--text-soft)]";
  const abschnitt = "text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-faint)]";
  const hinweisKlasse = "mt-1 text-xs text-[var(--text-faint)]";
  const aktuellerKunde = kunden.find((k) => k.id === offenId) ?? null;
  const datumsFormat = sprache === "en" ? "en-US" : "de-DE";

  const gruppeOffen = (id: string) => kundenSuchtAktiv || offeneGruppen.has(id) || aktuellerKunde?.subreseller_id === id;

  function gruppeUmschalten(id: string) {
    setOffeneGruppen((g) => {
      const kopie = new Set(g);
      if (kopie.has(id)) kopie.delete(id);
      else kopie.add(id);
      return kopie;
    });
  }

  function badges(k: Kunde, ohneSubreseller = false) {
    const stufe = wartungsvertragStufen.find((s) => s.id === k.wartungsvertrag_stufe_id);
    const sub = ohneSubreseller ? undefined : subresellerListe.find((s) => s.id === k.subreseller_id);
    const z = kennzahlen[k.id];
    if (!stufe && !sub && !z?.dongles && !z?.renewalOffen) return null;
    return (
      <span className="flex flex-wrap items-center gap-1">
        {stufe && (
          <span className="rounded-full px-2 py-0.5 text-[0.65rem] font-medium text-white" style={{ background: stufe.farbe }}>
            {stufe.name}
          </span>
        )}
        {sub && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[0.65rem] text-[var(--text-soft)]"
            title={txt.subresellerLabel}
          >
            <Handshake size={10} />
            {sub.name}
          </span>
        )}
        {!!z?.dongles && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-mittel-bg)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--badge-mittel-text)]"
            title={txt.badgeDonglesTitel}
          >
            <KeyRound size={10} />
            {z.dongles}
          </span>
        )}
        {!!z?.renewalOffen && (
          <span
            className="rounded-full bg-[var(--badge-kritisch-bg)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--badge-kritisch-text)]"
            title={txt.badgeRenewalTitel}
          >
            {txt.badgeRenewalOffen}
            {z.renewalOffen > 1 ? ` · ${z.renewalOffen}` : ""}
          </span>
        )}
      </span>
    );
  }

  function kundenKarte(k: Kunde, inGruppe: boolean) {
    return (
      <button
        key={k.id}
        onClick={() => (offenId === k.id ? setOffenId(null) : bearbeitenOeffnen(k))}
        className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
          offenId === k.id
            ? "border-akzent bg-[var(--bg-muted)]"
            : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-input)]"
        }`}
      >
        <span className="relative shrink-0">
          <Avatar name={k.name} avatarUrl={k.avatar_url} groesse="md" />
          {onlineIds?.has(k.id) && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)] bg-emerald-500"
              title={txt.online}
            />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium text-[var(--text-strong)]">{k.name ?? txt.unbenannt}</span>
          {(k.firmenname || k.telefonnummer) && (
            <span className="truncate text-xs text-[var(--text-faint)]">
              {[k.firmenname, k.telefonnummer].filter(Boolean).join(" · ")}
            </span>
          )}
          {badges(k, inGruppe)}
        </span>
      </button>
    );
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "stammdaten", label: txt.tabStammdaten },
    { id: "vertrag", label: txt.tabVertragPreise },
    { id: "dongles", label: txt.tabDongles },
    { id: "hardware", label: txt.tabHardware },
    { id: "dokumente", label: txt.tabDokumenteTodos },
    { id: "konto", label: txt.tabKonto },
  ];

  return (
    <div className="space-y-3">
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

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        {/* Liste */}
        <div className={`space-y-2 ${offenId ? "hidden lg:block" : ""}`}>
          {gefilterteKunden.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)]">
              {kunden.length === 0
                ? zeigeArchivierte
                  ? txt.keineDeaktiviertenKunden
                  : txt.nochKeineKunden
                : txt.keineTreffer}
            </p>
          ) : (
            <>
              {gruppen.map((g) => {
                const offen = gruppeOffen(g.sub.id);
                const summe = g.kunden.reduce(
                  (s, k) => ({
                    dongles: s.dongles + (kennzahlen[k.id]?.dongles ?? 0),
                    renewal: s.renewal + (kennzahlen[k.id]?.renewalOffen ?? 0),
                  }),
                  { dongles: 0, renewal: 0 },
                );
                return (
                  <div key={g.sub.id} className="space-y-2">
                    <button
                      onClick={() => gruppeUmschalten(g.sub.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3 text-left transition-colors hover:border-[var(--border-input)]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--badge-mittel-bg)] text-[var(--badge-mittel-text)]">
                        <Handshake size={18} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-sm font-semibold text-[var(--text-strong)]">{g.sub.name}</span>
                        <span className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-faint)]">
                          {txt.kundenAnzahlTemplate.replace("{n}", String(g.kunden.length))}
                          {summe.dongles > 0 && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-mittel-bg)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--badge-mittel-text)]"
                              title={txt.badgeDonglesTitel}
                            >
                              <KeyRound size={10} />
                              {summe.dongles}
                            </span>
                          )}
                          {summe.renewal > 0 && (
                            <span
                              className="rounded-full bg-[var(--badge-kritisch-bg)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--badge-kritisch-text)]"
                              title={txt.badgeRenewalTitel}
                            >
                              {txt.badgeRenewalOffen} · {summe.renewal}
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-[var(--text-faint)] transition-transform ${offen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {offen && (
                      <div className="ml-5 space-y-2 border-l-2 border-[var(--border)] pl-3">
                        {g.kunden.map((k) => kundenKarte(k, true))}
                      </div>
                    )}
                  </div>
                );
              })}
              {gruppen.length > 0 && sichtbareKunden.length > 0 && (
                <p className={`${abschnitt} pt-2`}>{txt.direkteKunden}</p>
              )}
              {sichtbareKunden.map((k) => kundenKarte(k, false))}
            </>
          )}

          {!kundenSuchtAktiv && direkteKunden.length > KUNDEN_STANDARD_SICHTBAR && (
            <button
              onClick={() => setAlleKundenAnzeigen((v) => !v)}
              className="w-full rounded border border-[var(--border-input)] px-3 py-2 text-sm text-[var(--text-soft)] hover:bg-[var(--bg-muted)]"
            >
              {alleKundenAnzeigen ? txt.wenigerAnzeigen : txt.alleAnzeigenTemplate.replace("{n}", String(direkteKunden.length))}
            </button>
          )}
        </div>

        {/* Detail */}
        <div className={offenId ? "" : "hidden lg:block"}>
          {!aktuellerKunde ? (
            <LeerZustand icon="👤" titel={txt.waehleKundeTitel} beschreibung={txt.waehleKundeHinweis} />
          ) : (
            (() => {
              const k = aktuellerKunde;
              return (
                <div className="overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
                  <div className="space-y-3 p-4 pb-2">
                    <button
                      onClick={() => setOffenId(null)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--text-soft)] hover:text-[var(--text-strong)] lg:hidden"
                    >
                      <ChevronLeft size={14} />
                      {txt.zurueckZurListe}
                    </button>
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <Avatar name={entwurf.name ?? k.name} avatarUrl={entwurf.avatar_url ?? null} groesse="lg" />
                        <label
                          title={txt.profilbildAendern}
                          className="absolute -bottom-1 -right-1 cursor-pointer rounded-full border border-[var(--border-input)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-soft)] hover:text-[var(--text-strong)]"
                        >
                          <Camera size={12} />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && avatarHochladen(k.id, e.target.files[0])}
                          />
                        </label>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <h3 className="truncate text-base font-semibold text-[var(--text-strong)]">{k.name ?? txt.unbenannt}</h3>
                        {k.firmenname && <p className="truncate text-sm text-[var(--text-soft)]">{k.firmenname}</p>}
                        <p className="truncate text-xs text-[var(--text-faint)]">
                          {[kundeEmail, k.telefonnummer].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="truncate text-[0.7rem] text-[var(--text-faint)]">
                          {txt.portalZuletzt}: {zuletztText(besuche[k.id]?.letzter_besuch ?? null, sprache)}
                          {besuche[k.id]?.sitzungen
                            ? ` · ${txt.besucheTemplate.replace("{n}", String(besuche[k.id].sitzungen))}`
                            : ""}
                        </p>
                        {badges(k)}
                      </div>
                      <button
                        onClick={() => setOffenId(null)}
                        title={txt.abbrechen}
                        className="hidden shrink-0 text-[var(--text-faint)] hover:text-[var(--text-strong)] lg:block"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="sticky top-0 z-10 bg-[var(--bg-surface)] px-4 py-2">
                    <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
                      {tabs.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTab(t.id)}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                            tab === t.id
                              ? "bg-[var(--bg-surface)] text-[var(--text-strong)] shadow-sm"
                              : "text-[var(--text-faint)] hover:text-[var(--text-soft)]"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5 p-4">
                    {tab === "stammdaten" && (
                      <>
                        <section className="space-y-2">
                          <h4 className={abschnitt}>{txt.gruppeName}</h4>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div>
                              <label className={lbl}>{txt.vorname}</label>
                              <input
                                type="text"
                                value={entwurf.vorname ?? ""}
                                onChange={(e) => setEntwurf({ ...entwurf, vorname: e.target.value })}
                                className={feld}
                              />
                            </div>
                            <div>
                              <label className={lbl}>{txt.nachname}</label>
                              <input
                                type="text"
                                value={entwurf.nachname ?? ""}
                                onChange={(e) => setEntwurf({ ...entwurf, nachname: e.target.value })}
                                className={feld}
                              />
                            </div>
                            <div>
                              <label className={lbl}>{txt.firmenname}</label>
                              <input
                                type="text"
                                value={entwurf.firmenname ?? ""}
                                onChange={(e) => setEntwurf({ ...entwurf, firmenname: e.target.value })}
                                className={feld}
                              />
                            </div>
                          </div>
                        </section>

                        <section className="space-y-3 border-t border-[var(--border)] pt-4">
                          <h4 className={abschnitt}>{txt.gruppeKontakt}</h4>
                          <div>
                            <label className={lbl}>{txt.emailLoginLabel}</label>
                            <p className="mb-1.5 rounded border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-strong)]">
                              {kundeEmail ?? "—"}
                            </p>
                            <div className="flex gap-2">
                              <input
                                type="email"
                                value={emailEntwurf}
                                onChange={(e) => setEmailEntwurf(e.target.value)}
                                placeholder={txt.neueEmailPlatzhalter}
                                className={`flex-1 ${feld}`}
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
                            <label className={lbl}>
                              {txt.weitereEmailsLabel}{" "}
                              <span className="font-normal text-[var(--text-faint)]">{txt.weitereEmailsHinweis}</span>
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
                                className={`flex-1 ${feld}`}
                              />
                              <button
                                onClick={() => zusatzEmailHinzufuegen(k.id)}
                                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                              >
                                +
                              </button>
                            </div>
                            <p className={hinweisKlasse}>{txt.zusatzEmailHinweis}</p>
                          </div>

                          <div>
                            <label className={lbl}>{txt.telefonWhatsapp}</label>
                            <input
                              type="text"
                              value={entwurf.telefonnummer ?? ""}
                              onChange={(e) => setEntwurf({ ...entwurf, telefonnummer: e.target.value })}
                              placeholder={txt.telefonPlatzhalter}
                              className={feld}
                            />
                          </div>
                        </section>

                        <section className="space-y-2 border-t border-[var(--border)] pt-4">
                          <h4 className={abschnitt}>{txt.gruppeAdresse}</h4>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={entwurf.strasse ?? ""}
                              onChange={(e) => setEntwurf({ ...entwurf, strasse: e.target.value })}
                              placeholder={txt.strassePlatzhalter}
                              className={`flex-1 ${feld}`}
                            />
                            <input
                              type="text"
                              value={entwurf.hausnummer ?? ""}
                              onChange={(e) => setEntwurf({ ...entwurf, hausnummer: e.target.value })}
                              placeholder={txt.nrPlatzhalter}
                              className="w-20 rounded border border-[var(--border-input)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-strong)]"
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
                              className={`flex-1 ${feld}`}
                            />
                          </div>
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
                            className={feld}
                          >
                            {LAENDER_LISTE.map((land) => (
                              <option key={land} value={land}>
                                {land}
                              </option>
                            ))}
                          </select>
                        </section>

                        <section className="space-y-2 border-t border-[var(--border)] pt-4">
                          <h4 className={abschnitt}>{txt.gruppeSteuer}</h4>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="flex items-center gap-1">
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
                                  className={feld}
                                />
                                <span className="text-xs text-[var(--text-faint)]">%</span>
                              </div>
                              <p className={hinweisKlasse}>{txt.mwstHinweis}</p>
                            </div>
                            <div>
                              <label className={lbl}>{txt.ustIdLabel}</label>
                              <input
                                type="text"
                                value={entwurf.ust_id ?? ""}
                                onChange={(e) => setEntwurf({ ...entwurf, ust_id: e.target.value })}
                                placeholder={txt.ustIdPlatzhalter}
                                className={feld}
                              />
                              <p className={hinweisKlasse}>{txt.ustIdHinweis}</p>
                            </div>
                          </div>
                        </section>

                        <section className="space-y-2 border-t border-[var(--border)] pt-4">
                          <h4 className={abschnitt}>{txt.notizenLabel}</h4>
                          <textarea
                            value={entwurf.notizen ?? ""}
                            onChange={(e) => setEntwurf({ ...entwurf, notizen: e.target.value })}
                            rows={3}
                            placeholder={txt.notizenPlatzhalter}
                            className={feld}
                          />
                        </section>
                      </>
                    )}

                    {tab === "vertrag" && (
                      <>
                        <section className="space-y-3">
                          <h4 className={abschnitt}>{txt.gruppeBetreuung}</h4>
                          <div>
                            <label className={lbl}>{txt.wartungsvertragLabel}</label>
                            <select
                              value={entwurf.wartungsvertrag_stufe_id ?? ""}
                              onChange={(e) => setEntwurf({ ...entwurf, wartungsvertrag_stufe_id: e.target.value || null })}
                              className={feld}
                            >
                              <option value="">{texte(sprache).wartungsvertrag.minutenpreis}</option>
                              {wartungsvertragStufen.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <p className={hinweisKlasse}>{txt.wartungsvertragHinweis}</p>
                          </div>
                          <div>
                            <label className={lbl}>{txt.subresellerLabel}</label>
                            <select
                              value={entwurf.subreseller_id ?? ""}
                              onChange={(e) => setEntwurf({ ...entwurf, subreseller_id: e.target.value || null })}
                              className={feld}
                            >
                              <option value="">{txt.keinSubreseller}</option>
                              {subresellerListe.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <p className={hinweisKlasse}>{txt.subresellerHinweis}</p>
                          </div>
                        </section>

                        <section className="space-y-2 border-t border-[var(--border)] pt-4">
                          <h4 className={abschnitt}>{txt.individuellerPreisLabel}</h4>
                          {preise.length === 0 ? (
                            <p className="text-xs text-[var(--text-faint)]">{txt.keinPreisGesetzt}</p>
                          ) : (
                            <div className="space-y-1">
                              {(() => {
                                const heute = new Date().toISOString().slice(0, 10);
                                const aktiveId = preise.find((p) => p.gueltig_ab <= heute)?.id;
                                return preise.map((p) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center justify-between gap-2 rounded bg-[var(--bg-muted)] px-3 py-1.5 text-sm"
                                  >
                                    <span className="text-[var(--text-strong)]">
                                      {txt.abPrefix} {new Date(p.gueltig_ab).toLocaleDateString(datumsFormat)}:{" "}
                                      {(p.preis_pro_minute_cent / 100).toLocaleString(datumsFormat, {
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
                              className={`flex-1 ${feld}`}
                            />
                            <button
                              onClick={() => preisHinzufuegen(k.id)}
                              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                            >
                              +
                            </button>
                          </div>
                          <p className={hinweisKlasse}>{txt.preisHinweis}</p>
                        </section>
                      </>
                    )}

                    {tab === "dongles" && (
                      <>
                        <section className="space-y-2">
                          <h4 className={abschnitt}>{txt.donglesLizenzen}</h4>
                          <DongleVerwaltung
                            key={`dongle-${k.id}-${mergeVersion}`}
                            kundeId={k.id}
                            organisationId={organisationId}
                          />
                        </section>

                        {vertraege.length > 0 && (
                          <section className="space-y-2 border-t border-[var(--border)] pt-4">
                            <h4 className={abschnitt}>{txt.lizenzvertraegeLabel}</h4>
                            <div className="space-y-2">
                              {vertraege.map((v) => {
                                const info = laufzeitInfo(v.vertrag_ende);
                                return (
                                  <div key={v.id} className="rounded bg-[var(--bg-muted)] px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm text-[var(--text-strong)]">{v.produkt_name}</span>
                                      <span className="font-mono text-xs text-[var(--text-faint)]">{v.lizenz_seriennummer}</span>
                                      {v.status && <span className="text-xs text-[var(--text-faint)]">· {v.status}</span>}
                                    </div>
                                    {v.vertrag_ende && info && (
                                      <div className="mt-1.5">
                                        <div className="mb-1 flex justify-between text-xs text-[var(--text-faint)]">
                                          <span>{txt.laufzeit}</span>
                                          <span style={{ color: info.farbe }} className="font-medium">
                                            {txt.bisPrefix} {new Date(v.vertrag_ende).toLocaleDateString(datumsFormat)}
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
                          </section>
                        )}
                      </>
                    )}

                    {tab === "hardware" && (
                      <section className="space-y-2">
                        <h4 className={abschnitt}>{txt.hardware}</h4>
                        <KundenHardware
                          key={`hardware-${k.id}-${mergeVersion}`}
                          kundeId={k.id}
                          organisationId={organisationId}
                        />
                      </section>
                    )}

                    {tab === "dokumente" && (
                      <>
                        <section className="space-y-2">
                          <h4 className={abschnitt}>{txt.dokumenteLabel}</h4>
                          <KundenDokumente
                            key={`dokumente-${k.id}-${mergeVersion}`}
                            kundeId={k.id}
                            organisationId={organisationId}
                          />
                        </section>
                        <section className="space-y-2 border-t border-[var(--border)] pt-4">
                          <h4 className={abschnitt}>{txt.todoListe}</h4>
                          <KundenTodoListe
                            key={`todos-${k.id}-${mergeVersion}`}
                            kundeId={k.id}
                            organisationId={organisationId}
                            modus="voll"
                          />
                        </section>
                      </>
                    )}

                    {tab === "konto" && (
                      <>
                        <section className="space-y-2">
                          <h4 className={abschnitt}>{txt.gruppeZugang}</h4>
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
                        </section>

                        {!zeigeArchivierte && (
                          <section className="space-y-2 border-t border-[var(--border)] pt-4">
                            <h4 className={abschnitt}>{txt.kontenZusammenfuehrenLabel}</h4>
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
                                  {txt.zusammenfuehrenBeschreibungVor} <strong>{k.name ?? txt.diesemKunden}</strong>
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
                          </section>
                        )}

                        <section className="space-y-2 border-t border-[var(--border)] pt-4">
                          <h4 className={abschnitt}>{txt.gruppeStatus}</h4>
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
                        </section>
                      </>
                    )}
                  </div>

                  {(tab === "stammdaten" || tab === "vertrag") && (
                    <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
                      <button
                        onClick={speichern}
                        disabled={laedt}
                        className="shrink-0 rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {txt.speichern}
                      </button>
                      {hinweis && <p className="text-xs text-[var(--text-soft)]">{hinweis}</p>}
                    </div>
                  )}
                  {hinweis && tab !== "stammdaten" && tab !== "vertrag" && (
                    <p className="px-4 pb-4 text-xs text-[var(--text-soft)]">{hinweis}</p>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
