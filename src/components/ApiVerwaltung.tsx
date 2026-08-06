import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import KonfigurationsHilfe from "./KonfigurationsHilfe";
import { useSprache } from "../lib/SpracheContext";
import { texte } from "../lib/uebersetzungen";
import type { Sprache } from "../lib/SpracheContext";

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  berechtigungen: string[];
  aktiv: boolean;
  erstellt_am: string;
  zuletzt_genutzt_am: string | null;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  ereignisse: string[];
  aktiv: boolean;
  letzter_status: number | null;
  letzter_call_am: string | null;
}

const SUPABASE_URL = "https://wfntgmavwzuldwjjhhlp.supabase.co";

function formatRelativ(iso: string | null, sprache: Sprache): string {
  if (!iso) return sprache === "en" ? "Never" : "Noch nie";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (sprache === "en") {
    if (min < 1) return "Just now";
    if (min < 60) return `${min} min ago`;
    if (min < 1440) return `${Math.floor(min / 60)}h ago`;
    return `${Math.floor(min / 1440)} days ago`;
  }
  if (min < 1) return "Gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  if (min < 1440) return `vor ${Math.floor(min / 60)} Std.`;
  return `vor ${Math.floor(min / 1440)} Tagen`;
}

async function generiereKey(): Promise<string> {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "ts_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ApiVerwaltung({ organisationId }: { organisationId: string }) {
  const { sprache } = useSprache();
  const txt = texte(sprache).apiVerwaltung;
  const ALLE_BERECHTIGUNGEN = [
    { id: "tickets:read", label: txt.berechtigungTicketsLesen },
    { id: "tickets:create", label: txt.berechtigungTicketsErstellen },
    { id: "tickets:update", label: txt.berechtigungTicketsAktualisieren },
    { id: "kunden:read", label: txt.berechtigungKundenLesen },
  ];
  const ALLE_EREIGNISSE = [
    { id: "ticket.created", label: txt.ereignisTicketErstellt },
    { id: "ticket.updated", label: txt.ereignisTicketAktualisiert },
    { id: "ticket.closed", label: txt.ereignisTicketGeschlossen },
  ];
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [neuerKeyName, setNeuerKeyName] = useState("");
  const [neuerKeyBerechtigungen, setNeuerKeyBerechtigungen] = useState(["tickets:read", "tickets:create"]);
  const [generierterKey, setGenerierterKey] = useState<string | null>(null);
  const [neuerWebhookName, setNeuerWebhookName] = useState("");
  const [neuerWebhookUrl, setNeuerWebhookUrl] = useState("");
  const [neuerWebhookEreignisse, setNeuerWebhookEreignisse] = useState(["ticket.created"]);
  const [laedt, setLaedt] = useState(false);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => { laden(); }, [organisationId]);

  async function laden() {
    const [keysRes, webhooksRes] = await Promise.all([
      supabase.from("api_keys").select("id, name, key_preview, berechtigungen, aktiv, erstellt_am, zuletzt_genutzt_am").eq("organisation_id", organisationId).order("erstellt_am"),
      supabase.from("webhook_endpunkte").select("id, name, url, ereignisse, aktiv, letzter_status, letzter_call_am").eq("organisation_id", organisationId).order("erstellt_am"),
    ]);
    setApiKeys(keysRes.data ?? []);
    setWebhooks(webhooksRes.data ?? []);
  }

  async function apiKeyErstellen() {
    if (!neuerKeyName.trim()) return;
    setLaedt(true);
    const key = await generiereKey();
    const hash = await hashKey(key);
    await supabase.from("api_keys").insert({
      organisation_id: organisationId,
      name: neuerKeyName.trim(),
      key_hash: hash,
      key_preview: key.slice(0, 8),
      berechtigungen: neuerKeyBerechtigungen,
    });
    setGenerierterKey(key);
    setNeuerKeyName("");
    setLaedt(false);
    laden();
  }

  async function apiKeyToggle(id: string, aktiv: boolean) {
    await supabase.from("api_keys").update({ aktiv: !aktiv }).eq("id", id);
    laden();
  }

  async function apiKeyLoeschen(id: string) {
    if (!confirm(txt.loeschenKeyBestaetigen)) return;
    await supabase.from("api_keys").delete().eq("id", id);
    laden();
  }

  async function webhookErstellen() {
    if (!neuerWebhookName.trim() || !neuerWebhookUrl.trim()) return;
    setLaedt(true);
    const secret = await generiereKey();
    await supabase.from("webhook_endpunkte").insert({
      organisation_id: organisationId,
      name: neuerWebhookName.trim(),
      url: neuerWebhookUrl.trim(),
      secret,
      ereignisse: neuerWebhookEreignisse,
    });
    setNeuerWebhookName("");
    setNeuerWebhookUrl("");
    setLaedt(false);
    laden();
  }

  async function webhookToggle(id: string, aktiv: boolean) {
    await supabase.from("webhook_endpunkte").update({ aktiv: !aktiv }).eq("id", id);
    laden();
  }

  async function webhookLoeschen(id: string) {
    if (!confirm(txt.loeschenWebhookBestaetigen)) return;
    await supabase.from("webhook_endpunkte").delete().eq("id", id);
    laden();
  }

  function kopierenKey(key: string) {
    navigator.clipboard.writeText(key);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  }

  const apiBaseUrl = `${SUPABASE_URL}/functions/v1/public-api`;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-[var(--text-strong)]">{txt.titel}</h3>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          {txt.beschreibung}
        </p>
      </div>

      {/* API-Dokumentation */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4 space-y-2">
        <p className="text-xs font-medium text-[var(--text-soft)]">{txt.apiBasisUrl}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono text-[var(--text-strong)]">
            {apiBaseUrl}
          </code>
          <button onClick={() => navigator.clipboard.writeText(apiBaseUrl)}
            className="shrink-0 rounded border border-[var(--border-input)] px-2 py-1.5 text-xs text-[var(--text-faint)] hover:bg-[var(--bg-muted)]">
            {txt.kopieren}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1 text-xs text-[var(--text-faint)]">
          {[
            ["GET", "/tickets", txt.endpointTicketsAbrufen],
            ["GET", "/tickets/:id", txt.endpointTicketEinzeln],
            ["POST", "/tickets", txt.endpointTicketErstellen],
            ["PATCH", "/tickets/:id", txt.endpointTicketAktualisieren],
            ["POST", "/tickets/:id/nachrichten", txt.endpointNachrichtHinzufuegen],
            ["GET", "/kunden", txt.endpointKundenAbrufen],
          ].map(([m, p, d]) => (
            <div key={p} className="flex items-start gap-2 py-0.5">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold ${m === "GET" ? "bg-blue-100 text-blue-700" : m === "POST" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{m}</span>
              <code className="text-[var(--text-soft)]">{p}</code>
              <span className="text-[var(--text-faint)]">– {d}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-faint)]">
          {txt.headerHinweis} <code className="font-mono">x-api-key: ts_xxxxxxxx…</code>
        </p>
      </div>

      <KonfigurationsHilfe
        titel="API-Key erstellen und verwenden"
        schritte={[
          {
            nr: 1,
            titel: "API-Key generieren",
            beschreibung: "Unten einen Namen für den Key eingeben (z.B. den Namen des Systems, das sich verbindet), die benötigten Berechtigungen auswählen und auf 'API-Key generieren' klicken.",
          },
          {
            nr: 2,
            titel: "Key sicher speichern",
            beschreibung: "Der generierte Key wird nur einmal angezeigt – sofort kopieren und sicher ablegen (z.B. in einem Passwortmanager). Danach ist nur noch ein Vorschau der ersten 8 Zeichen sichtbar.",
          },
          {
            nr: 3,
            titel: "In der Fremdsoftware eintragen",
            beschreibung: "Den Key als HTTP-Header bei jedem API-Aufruf mitschicken:",
            code: `curl -H "x-api-key: ts_deinkey..." ${apiBaseUrl}/tickets`,
          },
          {
            nr: 4,
            titel: "Ticket erstellen (Beispiel)",
            beschreibung: "So erstellt ein externes System automatisch ein Ticket:",
            code: `curl -X POST ${apiBaseUrl}/tickets \\\n  -H "x-api-key: ts_deinkey..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"titel":"Server offline","kunde_email":"kunde@firma.de","prioritaet":"kritisch"}'`,
          },
        ]}
        hinweis="Vergib Keys immer nur mit den minimal notwendigen Berechtigungen. Einen Key, der nur Tickets lesen soll, braucht keine Schreibberechtigung."
      />

      <KonfigurationsHilfe
        titel="Webhook-Endpunkt einrichten"
        schritte={[
          {
            nr: 1,
            titel: "Empfänger-URL vorbereiten",
            beschreibung: "Die URL muss öffentlich erreichbar sein und POST-Requests entgegennehmen. Gängige Optionen: Zapier Webhook, Make (Integromat), n8n, ein eigener Server oder Slack Incoming Webhooks.",
            link: { label: "Zapier Webhooks", url: "https://zapier.com/apps/webhook/integrations" },
          },
          {
            nr: 2,
            titel: "Webhook hier anlegen",
            beschreibung: "Name, URL und Ereignisse eintragen. Ein HMAC-Signing-Secret wird automatisch generiert – damit kann der Empfänger die Echtheit der Anfrage prüfen.",
          },
          {
            nr: 3,
            titel: "Signatur prüfen (optional, empfohlen)",
            beschreibung: "Jede Anfrage enthält den Header X-Webhook-Signature: sha256=... – der Empfänger kann damit sicherstellen, dass die Anfrage wirklich vom Ticketsystem kommt.",
            code: `HMAC-SHA256(body, dein-secret) == X-Webhook-Signature`,
          },
          {
            nr: 4,
            titel: "Payload-Format",
            beschreibung: "Jede Webhook-Anfrage enthält JSON mit Ereignistyp, Daten und Zeitstempel:",
            code: `{\n  "ereignis": "ticket.created",\n  "daten": { "id": "...", "ticket_nr": 42 },\n  "zeitstempel": "2026-01-01T12:00:00Z"\n}`,
          },
        ]}
        hinweis="Der letzte HTTP-Statuscode wird direkt in der Liste angezeigt (grün = OK, rot = Fehler). Schlägt ein Webhook-Aufruf fehl, wird kein automatischer Retry versucht – überprüfe die URL und die Empfänger-Seite."
      />

      {/* Generierter Key – einmalig anzeigen */}
      {generierterKey && (
        <div className="rounded-xl border-2 border-green-400 bg-green-50 p-4 dark:bg-green-900/20">
          <p className="mb-2 text-sm font-semibold text-green-800 dark:text-green-200">
            {txt.neuerKeyHinweis}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs font-mono text-green-900 dark:bg-green-900/30 dark:text-green-100">
              {generierterKey}
            </code>
            <button onClick={() => kopierenKey(generierterKey)}
              className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700">
              {kopiert ? txt.neuerKeyKopieren : txt.kopieren}
            </button>
          </div>
          <button onClick={() => setGenerierterKey(null)} className="mt-2 text-xs text-green-700 underline dark:text-green-400">
            {txt.neuerKeyAusblenden}
          </button>
        </div>
      )}

      {/* API-Keys */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">{txt.apiKeysUeberschrift}</p>

        {apiKeys.map((k) => (
          <div key={k.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${k.aktiv ? "bg-green-500" : "bg-[var(--text-faint)]"}`} />
                <p className="text-sm font-medium text-[var(--text-strong)]">{k.name}</p>
                <code className="text-xs text-[var(--text-faint)]">{k.key_preview}…</code>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                {k.berechtigungen.join(", ")} · {txt.zuletzt}: {formatRelativ(k.zuletzt_genutzt_am, sprache)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button onClick={() => apiKeyToggle(k.id, k.aktiv)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs ${k.aktiv ? "border-[var(--border)] text-[var(--text-soft)]" : "border-green-300 text-green-600"}`}>
                {k.aktiv ? txt.deaktivieren : txt.aktivieren}
              </button>
              <button onClick={() => apiKeyLoeschen(k.id)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-500">
                {txt.loeschen}
              </button>
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
          <p className="text-xs font-medium text-[var(--text-soft)]">{txt.neuenKeyErstellen}</p>
          <input type="text" value={neuerKeyName} onChange={(e) => setNeuerKeyName(e.target.value)}
            placeholder={txt.keyNamePlatzhalter}
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            {ALLE_BERECHTIGUNGEN.map((b) => (
              <label key={b.id} className="flex items-center gap-1.5 text-xs text-[var(--text-soft)]">
                <input type="checkbox" className="accent-amber-500"
                  checked={neuerKeyBerechtigungen.includes(b.id)}
                  onChange={(e) => setNeuerKeyBerechtigungen(e.target.checked
                    ? [...neuerKeyBerechtigungen, b.id]
                    : neuerKeyBerechtigungen.filter((x) => x !== b.id))} />
                {b.label}
              </label>
            ))}
          </div>
          <button onClick={apiKeyErstellen} disabled={laedt || !neuerKeyName.trim()}
            className="w-full rounded-lg bg-akzent py-2 text-sm font-medium text-white disabled:opacity-50">
            {txt.keyGenerieren}
          </button>
        </div>
      </div>

      {/* Webhooks */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">{txt.webhooksUeberschrift}</p>

        {webhooks.map((wh) => (
          <div key={wh.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${wh.aktiv ? "bg-green-500" : "bg-[var(--text-faint)]"}`} />
                <p className="truncate text-sm font-medium text-[var(--text-strong)]">{wh.name}</p>
                {wh.letzter_status && (
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-medium ${wh.letzter_status >= 200 && wh.letzter_status < 300 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {wh.letzter_status}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => webhookToggle(wh.id, wh.aktiv)}
                  className={`rounded border px-2 py-1 text-xs ${wh.aktiv ? "border-[var(--border)] text-[var(--text-soft)]" : "border-green-300 text-green-600"}`}>
                  {wh.aktiv ? txt.pause : txt.aktivieren}
                </button>
                <button onClick={() => webhookLoeschen(wh.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-500">✕</button>
              </div>
            </div>
            <p className="truncate text-xs font-mono text-[var(--text-faint)]">{wh.url}</p>
            <p className="text-xs text-[var(--text-faint)]">
              {wh.ereignisse.join(", ")} · {txt.letzterCall}: {formatRelativ(wh.letzter_call_am, sprache)}
            </p>
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
          <p className="text-xs font-medium text-[var(--text-soft)]">{txt.neuenWebhookHinzufuegen}</p>
          <input type="text" value={neuerWebhookName} onChange={(e) => setNeuerWebhookName(e.target.value)}
            placeholder={txt.webhookNamePlatzhalter}
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm" />
          <input type="url" value={neuerWebhookUrl} onChange={(e) => setNeuerWebhookUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-mono" />
          <div className="flex flex-wrap gap-2">
            {ALLE_EREIGNISSE.map((e) => (
              <label key={e.id} className="flex items-center gap-1.5 text-xs text-[var(--text-soft)]">
                <input type="checkbox" className="accent-amber-500"
                  checked={neuerWebhookEreignisse.includes(e.id)}
                  onChange={(x) => setNeuerWebhookEreignisse(x.target.checked
                    ? [...neuerWebhookEreignisse, e.id]
                    : neuerWebhookEreignisse.filter((ev) => ev !== e.id))} />
                {e.label}
              </label>
            ))}
          </div>
          <button onClick={webhookErstellen} disabled={laedt || !neuerWebhookName.trim() || !neuerWebhookUrl.trim()}
            className="w-full rounded-lg bg-akzent py-2 text-sm font-medium text-white disabled:opacity-50">
            {txt.webhookHinzufuegen}
          </button>
        </div>
      </div>
    </div>
  );
}
