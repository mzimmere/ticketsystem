import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import ApiVerwaltung from "./ApiVerwaltung";
import KonfigurationsHilfe from "./KonfigurationsHilfe";

interface IntegrationenProps {
  organisationId: string;
}

interface Konfig {
  inbound_email_adresse: string | null;
  inbound_email_anbieter: string | null;
  inbound_email_webhook_key: string | null;
  whatsapp_phone_number_id: string | null;
  whatsapp_access_token: string | null;
  whatsapp_webhook_secret: string | null;
}

function KopierenButton({ wert }: { wert: string }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(wert); setKopiert(true); setTimeout(() => setKopiert(false), 2000); }}
      className="rounded border border-[var(--border-input)] px-2 py-1 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-muted)]"
    >
      {kopiert ? "✓" : "Kopieren"}
    </button>
  );
}

function GeheimnisInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
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
        {sichtbar ? "Verbergen" : "Anzeigen"}
      </button>
    </div>
  );
}

export default function IntegrationenVerwaltung({ organisationId }: IntegrationenProps) {
  const [konfig, setKonfig] = useState<Konfig>({
    inbound_email_adresse: null, inbound_email_anbieter: null, inbound_email_webhook_key: null,
    whatsapp_phone_number_id: null, whatsapp_access_token: null, whatsapp_webhook_secret: null,
  });
  const [laedt, setLaedt] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const webhookBaseUrl = `${typeof window !== "undefined" ? "https://wfntgmavwzuldwjjhhlp.supabase.co" : ""}/functions/v1`;

  useEffect(() => { laden(); }, [organisationId]);

  async function laden() {
    const { data } = await supabase
      .from("organisationen")
      .select("inbound_email_adresse, inbound_email_anbieter, inbound_email_webhook_key, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_webhook_secret")
      .eq("id", organisationId).single();
    if (data) setKonfig(data);
  }

  async function speichern() {
    setLaedt(true);
    const { error } = await supabase.from("organisationen").update({
      inbound_email_adresse: konfig.inbound_email_adresse?.trim() || null,
      inbound_email_anbieter: konfig.inbound_email_anbieter || null,
      inbound_email_webhook_key: konfig.inbound_email_webhook_key?.trim() || null,
      whatsapp_phone_number_id: konfig.whatsapp_phone_number_id?.trim() || null,
      whatsapp_access_token: konfig.whatsapp_access_token?.trim() || null,
      whatsapp_webhook_secret: konfig.whatsapp_webhook_secret?.trim() || null,
    }).eq("id", organisationId);
    setLaedt(false);
    setHinweis(error ? "Fehler beim Speichern." : "Gespeichert.");
    setTimeout(() => setHinweis(null), 3000);
  }

  const emailAktiv = !!(konfig.inbound_email_adresse && konfig.inbound_email_webhook_key);
  const waAktiv = !!(konfig.whatsapp_phone_number_id && konfig.whatsapp_access_token);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--text-strong)]">Integrationen</h3>

      {/* ── E-Mail zu Ticket ───────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📧</span>
            <div>
              <p className="text-sm font-medium text-[var(--text-strong)]">E-Mail → Ticket</p>
              <p className="text-xs text-[var(--text-faint)]">Eingehende E-Mails automatisch als Ticket anlegen</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${emailAktiv ? "bg-green-100 text-green-700" : "bg-[var(--bg-muted)] text-[var(--text-faint)]"}`}>
            {emailAktiv ? "Aktiv" : "Nicht konfiguriert"}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              Support-E-Mail-Adresse
            </label>
            <input type="email" value={konfig.inbound_email_adresse ?? ""}
              onChange={(e) => setKonfig({ ...konfig, inbound_email_adresse: e.target.value })}
              placeholder="support@deine-firma.de"
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              Diese Adresse gibst du deinen Kunden als Support-Kontakt – eingehende E-Mails werden automatisch zu Tickets.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Anbieter</label>
            <div className="flex gap-2">
              {["resend", "postmark", "cloudflare"].map((a) => (
                <button key={a} onClick={() => setKonfig({ ...konfig, inbound_email_anbieter: a })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${konfig.inbound_email_anbieter === a ? "border-[var(--akzent)] bg-akzent/10 text-akzent" : "border-[var(--border)] text-[var(--text-soft)]"}`}>
                  {a === "resend" ? "Resend" : a === "postmark" ? "Postmark" : "Cloudflare"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">
              Webhook-Secret / API-Key vom Anbieter
            </label>
            <GeheimnisInput
              value={konfig.inbound_email_webhook_key ?? ""}
              onChange={(v) => setKonfig({ ...konfig, inbound_email_webhook_key: v })}
              placeholder="Signing Secret oder API-Key…"
            />
          </div>

          {konfig.inbound_email_anbieter && (
            <div className="rounded-lg bg-[var(--bg-muted)] p-3 space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-soft)]">
                Webhook-URL – bei {konfig.inbound_email_anbieter === "resend" ? "Resend" : konfig.inbound_email_anbieter === "postmark" ? "Postmark" : "Cloudflare"} eintragen:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-[var(--bg-surface)] px-2 py-1 text-xs font-mono text-[var(--text-strong)]">
                  {webhookBaseUrl}/email-inbound
                </code>
                <KopierenButton wert={`${webhookBaseUrl}/email-inbound`} />
              </div>
            </div>
          )}

          <KonfigurationsHilfe
            titel="E-Mail → Ticket einrichten"
            schritte={[
              {
                nr: 1,
                titel: "Domain kaufen und verifizieren",
                beschreibung: "Du brauchst eine eigene Domain (z.B. firma.de). Bei deinem gewählten Anbieter (Resend, Postmark oder Cloudflare) die Domain verifizieren – das dauert meist 5–10 Minuten.",
                link: { label: "Resend Domain-Einrichtung", url: "https://resend.com/docs/dashboard/domains/introduction" },
              },
              {
                nr: 2,
                titel: "E-Mail-Adresse festlegen",
                beschreibung: "Wähle eine Support-Adresse, z.B. support@firma.de oder hilfe@firma.de. Diese Adresse gibst du deinen Kunden als Kontakt-E-Mail an – alle eingehenden Mails werden automatisch zu Tickets.",
              },
              {
                nr: 3,
                titel: "Webhook-URL beim Anbieter eintragen",
                beschreibung: konfig.inbound_email_anbieter === "resend"
                  ? "Resend Dashboard → Domains → deine Domain → Inbound → Webhook URL eintragen. Das Signing Secret unter diesem Webhook-Eintrag kopieren."
                  : konfig.inbound_email_anbieter === "postmark"
                  ? "Postmark → Server → Settings → Inbound Webhook → URL eintragen. Den API-Key findest du unter Account → API Tokens."
                  : "Cloudflare → Email Routing → Rules → Custom address → Ziel-Worker eintragen.",
                code: `${webhookBaseUrl}/email-inbound`,
              },
              {
                nr: 4,
                titel: "Secret hier eintragen und speichern",
                beschreibung: "Das Signing Secret / den API-Key vom Anbieter in das Feld oben eintragen. Dann auf 'Integrationen speichern' klicken.",
              },
              {
                nr: 5,
                titel: "Test-Mail senden",
                beschreibung: "Schicke eine E-Mail an deine Support-Adresse. Nach wenigen Sekunden sollte in der Ticket-Übersicht ein neues Ticket erscheinen.",
              },
            ]}
            hinweis="Kunden, die per E-Mail schreiben, werden automatisch als Absender erkannt – ist die E-Mail-Adresse schon als Kunde angelegt, wird das Ticket direkt zugeordnet. Unbekannte Adressen erzeugen automatisch einen neuen Kunden-Account."
          />
        </div>
      </div>

      {/* ── WhatsApp ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <div>
              <p className="text-sm font-medium text-[var(--text-strong)]">WhatsApp → Ticket</p>
              <p className="text-xs text-[var(--text-faint)]">WhatsApp-Nachrichten als Ticket anlegen (Meta Cloud API)</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${waAktiv ? "bg-green-100 text-green-700" : "bg-[var(--bg-muted)] text-[var(--text-faint)]"}`}>
            {waAktiv ? "Aktiv" : "Nicht konfiguriert"}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Phone Number ID</label>
            <input type="text" value={konfig.whatsapp_phone_number_id ?? ""}
              onChange={(e) => setKonfig({ ...konfig, whatsapp_phone_number_id: e.target.value })}
              placeholder="1234567890123456"
              className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              Meta for Developers → App → WhatsApp → API Setup → Phone Number ID
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Access Token</label>
            <GeheimnisInput
              value={konfig.whatsapp_access_token ?? ""}
              onChange={(v) => setKonfig({ ...konfig, whatsapp_access_token: v })}
              placeholder="EAAxxxxxxx…"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Webhook Verify Token</label>
            <div className="flex gap-2">
              <GeheimnisInput
                value={konfig.whatsapp_webhook_secret ?? ""}
                onChange={(v) => setKonfig({ ...konfig, whatsapp_webhook_secret: v })}
                placeholder="Selbst gewählter geheimer Wert…"
              />
              <button onClick={() => setKonfig({ ...konfig, whatsapp_webhook_secret: crypto.randomUUID() })}
                className="shrink-0 rounded-lg border border-[var(--border-input)] px-3 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--bg-muted)]">
                Generieren
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-[var(--bg-muted)] p-3 space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-soft)]">Webhook-URL – bei Meta eintragen:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-[var(--bg-surface)] px-2 py-1 text-xs font-mono text-[var(--text-strong)]">
                {webhookBaseUrl}/whatsapp-webhook
              </code>
              <KopierenButton wert={`${webhookBaseUrl}/whatsapp-webhook`} />
            </div>
            <p className="text-xs text-[var(--text-faint)]">
              Meta for Developers → App → WhatsApp → Configuration → Webhook → URL + Verify Token eintragen.
              Abonniere das Feld "messages".
            </p>
          </div>

          <KonfigurationsHilfe
            titel="WhatsApp → Ticket einrichten"
            schritte={[
              {
                nr: 1,
                titel: "Meta Business Account erstellen",
                beschreibung: "Du brauchst einen verifizierten Meta Business Account. Gehe zu business.facebook.com und verifiziere dein Unternehmen (Gewerbeschein oder Webseite reicht).",
                link: { label: "Meta Business Suite", url: "https://business.facebook.com" },
              },
              {
                nr: 2,
                titel: "Meta Developer App anlegen",
                beschreibung: "Gehe zu developers.facebook.com → Meine Apps → App erstellen → Business. Den App-Typ 'Business' wählen und dein Business verknüpfen.",
                link: { label: "Meta for Developers", url: "https://developers.facebook.com/apps" },
              },
              {
                nr: 3,
                titel: "WhatsApp-Produkt zur App hinzufügen",
                beschreibung: "In deiner App: Produkte hinzufügen → WhatsApp → Einrichten. Dann eine Telefonnummer hinzufügen (kann eine neue Nummer oder eine bestehende sein, die noch nicht bei WhatsApp registriert ist).",
              },
              {
                nr: 4,
                titel: "Phone Number ID und Access Token kopieren",
                beschreibung: "WhatsApp → API Setup: Die 'Phone Number ID' und den 'Temporary Access Token' (oder einen permanenten System-User-Token) kopieren und oben eintragen.",
              },
              {
                nr: 5,
                titel: "Webhook konfigurieren",
                beschreibung: "WhatsApp → Configuration → Webhook → Edit. Die Webhook-URL und deinen selbst gewählten Verify Token eintragen. Dann 'messages' abonnieren.",
                code: `${webhookBaseUrl}/whatsapp-webhook`,
              },
              {
                nr: 6,
                titel: "Test-Nachricht senden",
                beschreibung: "Schicke eine WhatsApp-Nachricht an deine registrierte Nummer. Nach wenigen Sekunden sollte ein neues Ticket erscheinen.",
              },
            ]}
            hinweis="Für Produktionsbetrieb (mehr als 5 Test-Empfänger) musst du die WhatsApp Business API-Nutzung bei Meta beantragen und dein Unternehmen verifizieren. Im Testbetrieb kannst du bis zu 5 Testnummern freischalten."
          />
        </div>
      </div>

      {hinweis && <p className="text-sm text-[var(--text-soft)]">{hinweis}</p>}
      <button onClick={speichern} disabled={laedt}
        className="w-full rounded-xl bg-akzent py-2.5 text-sm font-medium text-white disabled:opacity-50">
        {laedt ? "Speichert…" : "Integrationen speichern"}
      </button>

      <div className="border-t border-[var(--border)] pt-6">
        <ApiVerwaltung organisationId={organisationId} />
      </div>
    </div>
  );
}
