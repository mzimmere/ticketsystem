import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return json({ error: "x-api-key Header fehlt." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Key validieren
  const keyHash = await hashKey(apiKey);
  const { data: keyDaten, error: keyFehler } = await supabase
    .from("api_keys")
    .select("id, organisation_id, berechtigungen, aktiv")
    .eq("key_hash", keyHash)
    .single();

  if (keyFehler || !keyDaten || !keyDaten.aktiv) {
    return json({ error: "Ungültiger oder deaktivierter API-Key." }, 401);
  }

  // Letzten Aufruf aktualisieren (fire and forget)
  supabase.from("api_keys").update({ zuletzt_genutzt_am: new Date().toISOString() })
    .eq("id", keyDaten.id).then(() => {});

  const { organisation_id: orgId, berechtigungen } = keyDaten;
  const url = new URL(req.url);
  const pfad = url.pathname.replace(/.*\/public-api/, "");

  // ── GET /tickets ──────────────────────────────────────────────────────────
  if (req.method === "GET" && pfad === "/tickets") {
    if (!berechtigungen.includes("tickets:read")) return json({ error: "Keine Leseberechtigung." }, 403);
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
    let q = supabase.from("tickets")
      .select("id, ticket_nr, titel, status, prioritaet, erstellt_am, kunde:kunde_id(name), zugewiesen:zugewiesen_an(name)")
      .eq("organisation_id", orgId)
      .order("erstellt_am", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);
    return json({ tickets: data, anzahl: data?.length ?? 0 });
  }

  // ── GET /tickets/:id ──────────────────────────────────────────────────────
  if (req.method === "GET" && pfad.startsWith("/tickets/")) {
    if (!berechtigungen.includes("tickets:read")) return json({ error: "Keine Leseberechtigung." }, 403);
    const ticketId = pfad.split("/")[2];
    const { data, error } = await supabase.from("tickets")
      .select("*, kunde:kunde_id(name, email:id), zugewiesen:zugewiesen_an(name), nachrichten:ticket_nachrichten(id, inhalt, quelle, erstellt_am)")
      .eq("id", ticketId).eq("organisation_id", orgId).single();
    if (error) return json({ error: "Ticket nicht gefunden." }, 404);
    return json(data);
  }

  // ── POST /tickets ─────────────────────────────────────────────────────────
  if (req.method === "POST" && pfad === "/tickets") {
    if (!berechtigungen.includes("tickets:create")) return json({ error: "Keine Schreibberechtigung." }, 403);
    const body = await req.json().catch(() => null);
    if (!body?.titel || !body?.kunde_email) {
      return json({ error: "titel und kunde_email sind Pflichtfelder." }, 400);
    }

    // Kunden per E-Mail suchen
    const { data: kundenDaten } = await supabase.from("profiles")
      .select("id").eq("organisation_id", orgId)
      .eq("rolle", "kunde")
      .eq("email:id", body.kunde_email).maybeSingle();

    // Falls kein Kunde gefunden, aus auth.users suchen
    let kundeId = kundenDaten?.id;
    if (!kundeId) {
      const { data: authUser } = await supabase.auth.admin.listUsers();
      const user = authUser?.users?.find((u) =>
        u.email === body.kunde_email &&
        u.user_metadata?.organisation_id === orgId
      );
      kundeId = user?.id;
    }

    if (!kundeId) return json({ error: `Kein Kunde mit der E-Mail ${body.kunde_email} gefunden.` }, 404);

    const { data: ticket, error } = await supabase.from("tickets").insert({
      organisation_id: orgId,
      titel: body.titel,
      beschreibung: body.beschreibung ?? null,
      prioritaet: body.prioritaet ?? "mittel",
      status: "offen",
      kunde_id: kundeId,
      quelle: "api",
    }).select("id, ticket_nr").single();

    if (error) return json({ error: error.message }, 500);

    // Erste Nachricht falls angegeben
    if (body.beschreibung) {
      await supabase.from("ticket_nachrichten").insert({
        ticket_id: ticket.id,
        quelle: "portal",
        inhalt: body.beschreibung,
      });
    }

    // Outbound-Webhooks auslösen
    ausloesenWebhooks(supabase, orgId, "ticket.created", ticket);

    return json({ id: ticket.id, ticket_nr: ticket.ticket_nr }, 201);
  }

  // ── PATCH /tickets/:id ────────────────────────────────────────────────────
  if (req.method === "PATCH" && pfad.startsWith("/tickets/")) {
    if (!berechtigungen.includes("tickets:update")) return json({ error: "Keine Schreibberechtigung." }, 403);
    const ticketId = pfad.split("/")[2];
    const body = await req.json().catch(() => null);
    const erlaubteFelder: Record<string, unknown> = {};
    if (body?.status) erlaubteFelder.status = body.status;
    if (body?.prioritaet) erlaubteFelder.prioritaet = body.prioritaet;
    if (body?.titel) erlaubteFelder.titel = body.titel;

    const { data, error } = await supabase.from("tickets").update(erlaubteFelder)
      .eq("id", ticketId).eq("organisation_id", orgId).select("id, ticket_nr, status").single();
    if (error) return json({ error: "Ticket nicht gefunden oder Update fehlgeschlagen." }, 404);

    if (body?.status) ausloesenWebhooks(supabase, orgId, "ticket.updated", data);
    return json(data);
  }

  // ── POST /tickets/:id/nachrichten ─────────────────────────────────────────
  if (req.method === "POST" && pfad.match(/^\/tickets\/[^/]+\/nachrichten$/)) {
    if (!berechtigungen.includes("tickets:create")) return json({ error: "Keine Schreibberechtigung." }, 403);
    const ticketId = pfad.split("/")[2];
    const body = await req.json().catch(() => null);
    if (!body?.inhalt) return json({ error: "inhalt ist ein Pflichtfeld." }, 400);

    const { data, error } = await supabase.from("ticket_nachrichten").insert({
      ticket_id: ticketId, quelle: "api", inhalt: body.inhalt,
    }).select("id").single();
    if (error) return json({ error: error.message }, 500);
    return json({ id: data.id }, 201);
  }

  // ── GET /kunden ───────────────────────────────────────────────────────────
  if (req.method === "GET" && pfad === "/kunden") {
    if (!berechtigungen.includes("kunden:read")) return json({ error: "Keine Leseberechtigung." }, 403);
    const { data, error } = await supabase.from("profiles")
      .select("id, name, telefonnummer, strasse, hausnummer, plz, ort")
      .eq("organisation_id", orgId).eq("rolle", "kunde").eq("deaktiviert", false)
      .order("name");
    if (error) return json({ error: error.message }, 500);
    return json({ kunden: data, anzahl: data?.length ?? 0 });
  }

  return json({ error: "Endpunkt nicht gefunden.", verfuegbar: [
    "GET /tickets", "GET /tickets/:id", "POST /tickets",
    "PATCH /tickets/:id", "POST /tickets/:id/nachrichten", "GET /kunden",
  ] }, 404);
});

async function ausloesenWebhooks(supabase: ReturnType<typeof createClient>, orgId: string, ereignis: string, payload: unknown) {
  const { data: webhooks } = await supabase.from("webhook_endpunkte")
    .select("id, url, secret").eq("organisation_id", orgId).eq("aktiv", true)
    .contains("ereignisse", [ereignis]);

  for (const wh of webhooks ?? []) {
    const body = JSON.stringify({ ereignis, daten: payload, zeitstempel: new Date().toISOString() });
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (wh.secret) {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(wh.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
      headers["X-Webhook-Signature"] = "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    fetch(wh.url, { method: "POST", headers, body })
      .then((r) => supabase.from("webhook_endpunkte").update({ letzter_status: r.status, letzter_call_am: new Date().toISOString() }).eq("id", wh.id))
      .catch(() => supabase.from("webhook_endpunkte").update({ letzter_status: 0, letzter_call_am: new Date().toISOString() }).eq("id", wh.id));
  }
}
