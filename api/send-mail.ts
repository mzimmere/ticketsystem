// Vercel Function (Node.js-Laufzeit statt Deno): nimmt Mail-Versand-
// Anfragen von den Supabase Edge Functions entgegen und schickt sie per
// echtem SMTP raus. Grund fuer diesen Umweg: Supabase Edge Functions
// laufen in einer Deno-Sandbox, die keine rohen TCP-Verbindungen nach
// aussen zulaesst - jeder direkte SMTP-Versuch dort schlaegt mit einem
// sofortigen 503 fehl (kein JS-Fehler, sondern ein Absturz der gesamten
// Funktion, siehe Logs). Vercel Functions laufen dagegen auf echtem
// Node.js und duerfen normale SMTP-Verbindungen aufbauen.
//
// Nur ueber ein geteiltes Secret (Header X-Relay-Secret) erreichbar -
// sonst koennte jeder diese URL missbrauchen, um beliebige Mails ueber
// die hier uebergebenen SMTP-Zugangsdaten zu verschicken.
//
// Env-Variable in Vercel setzen: MAIL_RELAY_SECRET=<selbes Secret wie
// in Supabase>.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

interface MailAnfrage {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string | string[];
  subject: string;
  text: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const relaySecret = process.env.MAIL_RELAY_SECRET;
  const gesendetesSecret = req.headers["x-relay-secret"];
  if (!relaySecret || gesendetesSecret !== relaySecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { host, port, user, password, from, to, subject, text } = (req.body ?? {}) as Partial<MailAnfrage>;
  if (!host || !port || !user || !password || !from || !to || !subject || !text) {
    res.status(400).json({ ok: false, error: "Fehlende Felder" });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
    await transporter.sendMail({ from, to, subject, text });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("SMTP-Relay-Fehler:", err);
    res.status(200).json({ ok: false, error: String(err) });
  }
}
