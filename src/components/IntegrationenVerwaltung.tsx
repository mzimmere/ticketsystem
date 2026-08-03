import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import ApiVerwaltung from "./ApiVerwaltung";
import KonfigurationsHilfe from "./KonfigurationsHilfe";

interface IntegrationenProps {
  organisationId: string;
}

interface Konfig {
  inbound_email_adresse: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_access_token: string | null;
  whatsapp_webhook_secret: string | null;
  whatsapp_app_secret: string | null;
}

function KopierenButton({ wert }: { wert: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).integrationenVerwaltung;
  const [kopiert, setKopiert] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(wert); setKopiert(true); setTimeout(() => setKopiert(false), 2000); }}
      className="rounded border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-muted)]"
    >
      {kopiert ? "✓" : txt.kopieren}
    </button>
  );
}

function GeheimnisInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).integrationenVerwaltung;
  const [sichtbar, setSichtbar] = useState(false);
  return (
    <div className="flex gap-1">
      <input
        type={sichtbar ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono"
      />
      <button type="button" onClick={() => setSichtbar(!sichtbar)}
        className="rounded-lg border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-muted)]">
        {sichtbar ? txt.verbergen : txt.anzeigen}
      </button>
    </div>
  );
}

interface SmtpKonfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  absender_email: string;
  imap_host: string;
  imap_port: string;
}

const SMTP_LEER: SmtpKonfig = {
  smtp_host: "", smtp_port: "587", smtp_user: "", smtp_password: "", absender_email: "",
  imap_host: "", imap_port: "993",
};

export default function IntegrationenVerwaltung({ organisationId }: IntegrationenProps) {
  const { sprache } = useSprache();
  const txt = texte(sprache).integrationenVerwaltung;
  const [konfig, setKonfig] = useState<Konfig>({
    inbound_email_adresse: null,
    whatsapp_phone_number_id: null, whatsapp_access_token: null, whatsapp_webhook_secret: null,
    whatsapp_app_secret: null,
  });
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [waTestLaedt, setWaTestLaedt] = useState(false);
  const [waTestErgebnis, setWaTestErgebnis] = useState<{ ok: boolean; text: string } | null>(null);
  const [smtpKonfig, setSmtpKonfig] = useState<SmtpKonfig>(SMTP_LEER);
  const [smtpLaedt, setSmtpLaedt] = useState(false);
  const [smtpHinweis, setSmtpHinweis] = useState<string | null>(null);

  const webhookBaseUrl = `${typeof window !== "undefined" ? "https://wfntgmavwzuldwjjhhlp.supabase.co" : ""}/functions/v1`;

  useEffect(() => { laden(); ladeSmtp(); }, [organisationId]);

  async function laden() {
    const { data } = await supabase
      .from("organisationen")
      .select("inbound_email_adresse, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_webhook_secret, whatsapp_app_secret")
      .eq("id", organisationId).single();
    if (data) setKonfig(data);
  }

  async function ladeSmtp() {
    const { data } = await supabase
      .from("organisation_smtp_konfiguration")
      .select("smtp_host, smtp_port, smtp_user, smtp_password, absender_email, imap_host, imap_port")
      .eq("organisation_id", organisationId)
      .maybeSingle();
    setSmtpKonfig(
      data
        ? {
            smtp_host: data.smtp_host ?? "",
            smtp_port: String(data.smtp_port ?? 587),
            smtp_user: data.smtp_user ?? "",
            smtp_password: data.smtp_password ?? "",
            absender_email: data.absender_email ?? "",
            imap_host: data.imap_host ?? "",
            imap_port: String(data.imap_port ?? 993),
          }
        : SMTP_LEER,
    );
  }

  // Speichert SMTP+IMAP-Zugangsdaten (ein Postfach, eine Tabelle) UND die
  // Support-Adresse fuer eingehende Mails (liegt auf organisationen) in
  // einem Rutsch, da beide Karten dasselbe Postfach beschreiben.
  async function smtpSpeichern() {
    setSmtpLaedt(true);
    const [{ error: smtpFehler }, { error: inboundFehler }] = await Promise.all([
      supabase.from("organisation_smtp_konfiguration").upsert({
        organisation_id: organisationId,
        smtp_host: smtpKonfig.smtp_host.trim() || null,
        smtp_port: Number(smtpKonfig.smtp_port) || 587,
        smtp_user: smtpKonfig.smtp_user.trim() || null,
        smtp_password: smtpKonfig.smtp_password.trim() || null,
        absender_email: smtpKonfig.absender_email.trim() || null,
        imap_host: smtpKonfig.imap_host.trim() || null,
        imap_port: Number(smtpKonfig.imap_port) || 993,
        aktualisiert_am: new Date().toISOString(),
      }),
      supabase.from("organisationen")
        .update({ inbound_email_adresse: konfig.inbound_email_adresse?.trim() || null })
        .eq("id", organisationId),
    ]);
    setSmtpLaedt(false);
    setSmtpHinweis(smtpFehler || inboundFehler ? txt.fehlerSpeichern : txt.gespeichert);
    setTimeout(() => setSmtpHinweis(null), 3000);
  }

  async function speichern() {
    setLaedt(true);
    const { error } = await supabase.from("organisationen").update({
      whatsapp_phone_number_id: konfig.whatsapp_phone_number_id?.trim() || null,
      whatsapp_access_token: konfig.whatsapp_access_token?.trim() || null,
      whatsapp_webhook_secret: konfig.whatsapp_webhook_secret?.trim() || null,
      whatsapp_app_secret: konfig.whatsapp_app_secret?.trim() || null,
    }).eq("id", organisationId);
    setLaedt(false);
    setHinweis(error ? txt.fehlerSpeichern : txt.gespeichert);
    setTimeout(() => setHinweis(null), 3000);
  }

  async function waVerbindungTesten() {
    setWaTestLaedt(true);
    setWaTestErgebnis(null);
    try {
      // Erst speichern, damit der Test garantiert die aktuell eingegebenen
      // Werte prüft und nicht einen älteren gespeicherten Stand.
      await speichern();
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-verbindung-testen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({ organisationId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setWaTestErgebnis({ ok: false, text: json.error ?? txt.testFehlgeschlagen });
      } else if (json.grund === "nicht_konfiguriert") {
        setWaTestErgebnis({ ok: false, text: txt.bitteZuerstEintragen });
      } else if (json.grund === "token_abgelaufen") {
        setWaTestErgebnis({ ok: false, text: txt.tokenAbgelaufen });
      } else if (json.ok) {
        setWaTestErgebnis({
          ok: true,
          text: txt.verbundenTemplate.replace("{name}", json.verifizierterName ?? json.telefonnummer ?? "OK") +
            (json.qualitaet ? txt.qualitaetTemplate.replace("{qualitaet}", json.qualitaet) : ""),
        });
      } else {
        setWaTestErgebnis({ ok: false, text: json.meldung ?? txt.testFehlgeschlagen });
      }
    } catch (err) {
      setWaTestErgebnis({ ok: false, text: String(err) });
    }
    setWaTestLaedt(false);
  }

  const versandAktiv = !!(smtpKonfig.smtp_host && smtpKonfig.smtp_user && smtpKonfig.smtp_password && smtpKonfig.absender_email);
  const empfangAktiv = !!(konfig.inbound_email_adresse && smtpKonfig.imap_host && smtpKonfig.smtp_user && smtpKonfig.smtp_password);
  const waAktiv = !!(konfig.whatsapp_phone_number_id && konfig.whatsapp_access_token);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>

      {/* ── E-Mail (Senden & Empfangen) ────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✉️</span>
            <div>
              <p className="text-sm font-medium text-[var(--text-strong)]">{txt.emailTitel}</p>
              <p className="text-xs text-[var(--text-faint)]">
                {txt.emailBeschreibung}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${versandAktiv ? "bg-green-100 text-green-700" : "bg-[var(--bg-muted)] text-[var(--text-faint)]"}`}>
              {txt.versandLabel} {versandAktiv ? txt.versandEigenesPostfach : txt.versandGemeinsam}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${empfangAktiv ? "bg-green-100 text-green-700" : "bg-[var(--bg-muted)] text-[var(--text-faint)]"}`}>
              {txt.empfangLabel} {empfangAktiv ? txt.empfangAktiv : txt.empfangNichtKonfiguriert}
            </span>
          </div>
        </div>

        <p className="text-xs text-[var(--text-faint)]">
          {txt.emailHinweis}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.smtpHost}</label>
            <input type="text" value={smtpKonfig.smtp_host}
              onChange={(e) => setSmtpKonfig({ ...smtpKonfig, smtp_host: e.target.value })}
              placeholder={txt.smtpHostPlatzhalter}
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.smtpPort}</label>
            <input type="number" value={smtpKonfig.smtp_port}
              onChange={(e) => setSmtpKonfig({ ...smtpKonfig, smtp_port: e.target.value })}
              placeholder="587"
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-[var(--text-faint)]">{txt.smtpPortHinweis}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.imapHost}</label>
            <input type="text" value={smtpKonfig.imap_host}
              onChange={(e) => setSmtpKonfig({ ...smtpKonfig, imap_host: e.target.value })}
              placeholder={txt.imapHostPlatzhalter}
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.imapPort}</label>
            <input type="number" value={smtpKonfig.imap_port}
              onChange={(e) => setSmtpKonfig({ ...smtpKonfig, imap_port: e.target.value })}
              placeholder="993"
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-[var(--text-faint)]">{txt.imapPortHinweis}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.benutzername}</label>
            <input type="text" value={smtpKonfig.smtp_user}
              onChange={(e) => setSmtpKonfig({ ...smtpKonfig, smtp_user: e.target.value })}
              placeholder={txt.benutzernamePlatzhalter}
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-[var(--text-faint)]">{txt.benutzernameHinweis}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.absenderadresse}</label>
            <input type="email" value={smtpKonfig.absender_email}
              onChange={(e) => setSmtpKonfig({ ...smtpKonfig, absender_email: e.target.value })}
              placeholder={txt.benutzernamePlatzhalter}
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.passwort}</label>
          <GeheimnisInput
            value={smtpKonfig.smtp_password}
            onChange={(v) => setSmtpKonfig({ ...smtpKonfig, smtp_password: v })}
            placeholder={txt.passwortPlatzhalter}
          />
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            {txt.passwortHinweis}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
            {txt.supportEmailLabel} <span className="font-normal text-[var(--text-faint)]">{txt.supportEmailKlammer}</span>
          </label>
          <input type="email" value={konfig.inbound_email_adresse ?? ""}
            onChange={(e) => setKonfig({ ...konfig, inbound_email_adresse: e.target.value })}
            placeholder={txt.supportEmailPlatzhalter}
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            {txt.supportEmailHinweis}
          </p>
        </div>

        {smtpHinweis && <p className="text-sm text-[var(--text-soft)]">{smtpHinweis}</p>}
        <button onClick={smtpSpeichern} disabled={smtpLaedt}
          className="w-full rounded-xl border border-[var(--border-input)] py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--bg-muted)] disabled:opacity-50">
          {smtpLaedt ? txt.speichert : txt.emailZugangsdatenSpeichern}
        </button>
      </div>

      {/* ── WhatsApp ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <div>
              <p className="text-sm font-medium text-[var(--text-strong)]">{txt.whatsappTitel}</p>
              <p className="text-xs text-[var(--text-faint)]">{txt.whatsappBeschreibung}</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${waAktiv ? "bg-green-100 text-green-700" : "bg-[var(--bg-muted)] text-[var(--text-faint)]"}`}>
            {waAktiv ? txt.aktiv : txt.nichtKonfiguriert}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.phoneNumberId}</label>
            <input type="text" value={konfig.whatsapp_phone_number_id ?? ""}
              onChange={(e) => setKonfig({ ...konfig, whatsapp_phone_number_id: e.target.value })}
              placeholder="1234567890123456"
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              {txt.phoneNumberIdHinweis}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.accessToken}</label>
            <GeheimnisInput
              value={konfig.whatsapp_access_token ?? ""}
              onChange={(v) => setKonfig({ ...konfig, whatsapp_access_token: v })}
              placeholder="EAAxxxxxxx…"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              {txt.appSecret} <span className="font-normal text-[var(--text-faint)]">{txt.appSecretKlammer}</span>
            </label>
            <GeheimnisInput
              value={konfig.whatsapp_app_secret ?? ""}
              onChange={(v) => setKonfig({ ...konfig, whatsapp_app_secret: v })}
              placeholder={txt.appSecretPlatzhalter}
            />
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              {txt.appSecretHinweis}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">{txt.webhookVerifyToken}</label>
            <div className="flex gap-2">
              <GeheimnisInput
                value={konfig.whatsapp_webhook_secret ?? ""}
                onChange={(v) => setKonfig({ ...konfig, whatsapp_webhook_secret: v })}
                placeholder={txt.webhookTokenPlatzhalter}
              />
              <button onClick={() => setKonfig({ ...konfig, whatsapp_webhook_secret: crypto.randomUUID() })}
                className="shrink-0 rounded-lg border border-[var(--border-input)] px-3 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                {txt.generieren}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-[var(--bg-muted)] p-3 space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-soft)]">{txt.webhookUrlLabel}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-[var(--bg-surface)] px-2 py-1 text-xs font-mono text-[var(--text-strong)]">
                {webhookBaseUrl}/whatsapp-webhook
              </code>
              <KopierenButton wert={`${webhookBaseUrl}/whatsapp-webhook`} />
            </div>
            <p className="text-xs text-[var(--text-faint)]">
              {txt.webhookUrlHinweis}
            </p>
          </div>

          <div>
            <button
              onClick={waVerbindungTesten}
              disabled={waTestLaedt || !konfig.whatsapp_phone_number_id || !konfig.whatsapp_access_token}
              className="rounded-lg border border-[var(--border-input)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
            >
              {waTestLaedt ? txt.prueft : txt.verbindungTesten}
            </button>
            {waTestErgebnis && (
              <p className={`mt-1.5 text-xs ${waTestErgebnis.ok ? "text-green-600" : "text-red-600"}`}>
                {waTestErgebnis.ok ? "✓ " : "✗ "}{waTestErgebnis.text}
              </p>
            )}
          </div>

          <KonfigurationsHilfe
            titel="WhatsApp → Ticket einrichten"
            schritte={[
              {
                nr: 1,
                titel: "App mit WhatsApp anlegen",
                beschreibung: "Bei developers.facebook.com → Meine Apps → App erstellen. Als Anwendungsfall 'Über WhatsApp mit deinen Kunden in Kontakt treten' wählen. Danach in der App den Anwendungsfall öffnen und 'Mit API integrieren' wählen (NICHT 'Partner werden').",
                link: { label: "Meta for Developers", url: "https://developers.facebook.com/apps" },
              },
              {
                nr: 2,
                titel: "Telefonnummer + Phone Number ID",
                beschreibung: "Im Anwendungsfall → 'Schritt 2: Produktionseinrichtung' öffnen und dort deine Telefonnummer hinzufügen/auswählen. Danach wird die 'Phone Number ID' angezeigt – diese oben ins Feld 'Phone Number ID' kopieren. (Sie steht auch jederzeit im WhatsApp Manager bei deiner Nummer.)",
                link: { label: "WhatsApp Manager", url: "https://business.facebook.com/wa/manage" },
              },
              {
                nr: 3,
                titel: "Permanenten Access Token erstellen (wichtig!)",
                beschreibung: "NICHT den befristeten Token aus der Produktionseinrichtung verwenden – der läuft nach 24 Stunden ab und die Anbindung reißt dann scheinbar grundlos ab. Stattdessen: Business-Einstellungen → Nutzer → Systemnutzer → Systemnutzer hinzufügen → Token generieren mit der Berechtigung 'whatsapp_business_messaging' und deinem WhatsApp-Konto als zugewiesenem Asset (ohne Ablaufdatum). Diesen Token oben ins Feld 'Access Token' eintragen.",
                link: { label: "Meta Business-Einstellungen", url: "https://business.facebook.com/settings/system-users" },
              },
              {
                nr: 4,
                titel: "Webhook eintragen",
                beschreibung: "Ebenfalls unter 'Schritt 2: Produktionseinrichtung' → Webhooks: die folgende URL und deinen oben selbst gewählten Verify Token eintragen, dann das Feld 'messages' abonnieren.",
                code: `${webhookBaseUrl}/whatsapp-webhook`,
              },
              {
                nr: 5,
                titel: "Hier speichern & Verbindung testen",
                beschreibung: "Oben auf 'Integrationen speichern' und dann auf 'Verbindung testen' klicken – zeigt sofort, ob Phone Number ID und Token stimmen.",
              },
              {
                nr: 6,
                titel: "Test-Nachricht senden",
                beschreibung: "Schicke eine WhatsApp-Nachricht an deine registrierte Nummer. Nach wenigen Sekunden sollte ein neues Ticket erscheinen.",
              },
            ]}
            hinweis="Für echte Kundennummern (statt nur bis zu 5 Testnummern) verlangt Meta 'Schritt 3: Unternehmensverifizierung'. Solange die nicht abgeschlossen ist, funktioniert WhatsApp nur mit den hinterlegten Testnummern."
          />
        </div>
      </div>

      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
      <button onClick={speichern} disabled={laedt}
        className="w-full rounded-xl bg-akzent py-2.5 text-sm font-medium text-white disabled:opacity-50">
        {laedt ? txt.speichert : txt.integrationenSpeichern}
      </button>

      <div className="border-t border-[var(--border)] pt-6">
        <ApiVerwaltung organisationId={organisationId} />
      </div>
    </div>
  );
}
