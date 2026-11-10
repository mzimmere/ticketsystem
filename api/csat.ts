// Vercel Function: Landing-Seite fuer die 👍/👎-Links in der "Ticket
// geschlossen"-Mail. Die eigentliche Arbeit (Signatur pruefen, Bewertung und
// optionalen Text speichern) macht die Supabase Edge Function "csat-bewerten".
// Sie wird hier mit ?format=json abgefragt, weil Supabase HTML auf der
// Standard-Domain nur als text/plain mit CSP-Sandbox ausliefert - der Kunde
// wuerde sonst den HTML-Quelltext statt einer Seite sehen (und das Textfeld
// koennte nicht abgeschickt werden).
//
// Ohne eigene Geheimnisse: Das Vertrauen steckt in der Signatur im Link, die
// die Edge Function prueft. Hier wird nur weitergereicht und angezeigt.

import type { VercelRequest, VercelResponse } from "@vercel/node";

interface Formular {
  ticketId: string;
  wert: number;
  sig: string;
}

interface Antwort {
  titel: string;
  text: string;
  formular: Formular | null;
}

const ZEICHEN: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ZEICHEN[c]);

function ersterWert(wert: string | string[] | undefined): string {
  return Array.isArray(wert) ? (wert[0] ?? "") : (wert ?? "");
}

function seite(a: Antwort): string {
  const formular = a.formular
    ? `<form method="post" action="/api/csat" style="margin-top:20px;text-align:left">
  <input type="hidden" name="t" value="${esc(a.formular.ticketId)}">
  <input type="hidden" name="w" value="${a.formular.wert}">
  <input type="hidden" name="s" value="${esc(a.formular.sig)}">
  <label for="k" style="display:block;font-size:0.85rem;color:#4d5563;margin-bottom:6px">Möchtest du uns noch etwas mitteilen? (optional)</label>
  <textarea id="k" name="k" rows="4" maxlength="1000" placeholder="Was hat gut funktioniert, was können wir besser machen?"></textarea>
  <button type="submit">Senden</button>
</form>`
    : "";
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(a.titel)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background:#f4f5f7; margin:0; padding:0; }
  .box { max-width: 420px; margin: 15vh auto; background:#fff; border-radius:12px; padding:32px 28px; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  h1 { font-size: 1.2rem; margin: 0 0 8px; color:#14181f; }
  p { color:#4d5563; font-size:0.95rem; margin:0; line-height:1.5; }
  textarea { width:100%; box-sizing:border-box; border:1px solid #cfd4dc; border-radius:8px; padding:10px; font:inherit; font-size:0.9rem; }
  button { margin-top:10px; background:#0e6e8c; color:#fff; border:0; border-radius:8px; padding:9px 18px; font:inherit; font-size:0.9rem; cursor:pointer; }
</style></head>
<body><div class="box"><h1>${esc(a.titel)}</h1><p>${esc(a.text)}</p>${formular}</div></body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).send(seite({ titel: "Nicht erlaubt", text: "Diese Anfrage wird nicht unterstützt.", formular: null }));
    return;
  }

  const basis = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!basis) {
    res.status(500).send(seite({ titel: "Nicht verfügbar", text: "Die Bewertung ist gerade nicht erreichbar. Bitte versuche es später noch einmal.", formular: null }));
    return;
  }

  const felder = new URLSearchParams();
  const quelle = req.method === "POST" ? ((req.body ?? {}) as Record<string, string | string[]>) : req.query;
  for (const name of ["t", "w", "s", "k"]) {
    const wert = ersterWert(quelle[name]);
    if (wert) felder.set(name, wert);
  }

  try {
    const url = `${basis}/functions/v1/csat-bewerten?format=json${req.method === "GET" ? `&${felder.toString()}` : ""}`;
    const antwort =
      req.method === "POST"
        ? await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: felder.toString(),
          })
        : await fetch(url);
    const daten = (await antwort.json()) as Antwort;
    res.status(200).send(seite(daten));
  } catch (err) {
    console.error("[csat] Weiterleitung fehlgeschlagen:", err);
    res.status(502).send(seite({ titel: "Nicht verfügbar", text: "Die Bewertung konnte gerade nicht gespeichert werden. Bitte versuche es später noch einmal.", formular: null }));
  }
}
