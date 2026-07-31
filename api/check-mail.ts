// Vercel Function (Node.js-Laufzeit): fragt per IMAP ein Postfach nach
// ungelesenen Mails ab und gibt sie strukturiert zurueck. Grund fuer den
// Umweg ueber Vercel: Supabase Edge Functions laufen in einer Deno-
// Sandbox, die keine rohen TCP-Verbindungen nach aussen erlaubt - IMAP
// ist wie SMTP so eine rohe TCP-Verbindung (siehe api/send-mail.ts fuer
// den identischen Hintergrund beim Mail-Versand).
//
// Markiert abgerufene Mails als gelesen (\Seen), damit sie beim naechsten
// Abruf nicht nochmal geliefert werden. Zusaetzliche Absicherung gegen
// doppelte Tickets/Antworten liegt in der Datenbank (unique index auf
// ticket_nachrichten.email_message_id).
//
// Env-Variable in Vercel: MAIL_RELAY_SECRET (dieselbe wie bei send-mail.ts).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const MAX_MAILS_PRO_ABRUF = 20;
const MAX_ANHANG_BYTES = 8 * 1024 * 1024; // 8 MB - groessere Anhaenge werden ausgelassen

interface MailAnhang {
  filename: string;
  contentType: string;
  contentBase64: string;
}

interface AbgerufeneMail {
  messageId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  text: string;
  anhaenge: MailAnhang[];
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

  const { host, port, user, password } = (req.body ?? {}) as {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
  };
  if (!host || !port || !user || !password) {
    res.status(400).json({ ok: false, error: "Fehlende Felder" });
    return;
  }

  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass: password },
    logger: false,
  });

  const mails: AbgerufeneMail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const ungeleseneUids = await client.search({ seen: false });
      const zuVerarbeiten = (ungeleseneUids || []).slice(0, MAX_MAILS_PRO_ABRUF);

      for (const uid of zuVerarbeiten) {
        const nachricht = await client.fetchOne(uid, { source: true });
        if (!nachricht || !nachricht.source) continue;

        const geparst = await simpleParser(nachricht.source);
        const von = Array.isArray(geparst.from?.value) ? geparst.from?.value[0] : undefined;

        const anhaenge: MailAnhang[] = [];
        for (const anhang of geparst.attachments ?? []) {
          if (anhang.size > MAX_ANHANG_BYTES) continue;
          anhaenge.push({
            filename: anhang.filename ?? "anhang",
            contentType: anhang.contentType,
            contentBase64: anhang.content.toString("base64"),
          });
        }

        mails.push({
          messageId: geparst.messageId ?? `${uid}@${host}`,
          fromEmail: von?.address ?? "",
          fromName: von?.name || null,
          subject: geparst.subject ?? "",
          text: geparst.text ?? "",
          anhaenge,
        });

        await client.messageFlagsAdd(uid, ["\\Seen"]);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error("IMAP-Fehler:", err);
    res.status(200).json({ ok: false, error: String(err) });
    return;
  }

  res.status(200).json({ ok: true, mails });
}
