# IT-Ticketsystem

React/Vite + Supabase, multi-tenant. WhatsApp-Anbindung ist vorbereitet, aber
standardmäßig inaktiv (siehe unten).

## Features

- Dark/Light Mode (oben rechts umschaltbar, merkt sich die Wahl)
- Firmenname + Logo pro Organisation im Header (über `organisationen.logo_url`)
- Profilbilder für Mitarbeiter (eigenes Profil → Bild ändern)
- Verwaltungsbereich (Zahnrad-Icon, nur für Org-Admin/Super-Admin):
  Firmenname/Logo, Personen einladen (Kunde/Techniker/Org-Admin),
  bei Super-Admin zusätzlich Organisationen anlegen
- Mehrfach-Mitgliedschaft: ein Techniker/Org-Admin-Account kann bei mehreren
  Firmen gleichzeitig aktiv sein (mit jeweils eigener Rolle), Umschalter
  dafür im Header sobald mehr als eine Mitgliedschaft besteht. Kunden-
  Accounts bleiben bewusst strikt einer Firma zugeordnet.

## 1. Supabase-Projekt einrichten

1. Neues Projekt auf [supabase.com](https://supabase.com) anlegen (ein einziges
   Projekt reicht für alle Firmen – Mandanten-Trennung läuft über die
   `organisationen`-Tabelle + RLS).
2. SQL-Editor öffnen, Inhalt von `supabase/schema.sql` komplett einfügen und
   ausführen.
3. **Authentication → URL Configuration**: Site URL und Redirect URLs auf
   deine spätere Vercel-Domain setzen (lokal zusätzlich `http://localhost:5173`).
4. **Realtime aktivieren** (heißt im Dashboard je nach Version "Database →
   Replication" oder "Database → Publications" – zuverlässiger direkt per SQL):
   ```sql
   alter publication supabase_realtime add table public.tickets;
   alter publication supabase_realtime add table public.ticket_nachrichten;
   ```
5. **Storage**: Drei Buckets anlegen:
   - `anhaenge` (privat)
   - `avatare` (öffentlich lesbar) – für Profilbilder
   - `logos` (öffentlich lesbar) – für Firmenlogos

   Danach die zugehörigen RLS-Policies ausführen (Abschnitt 12 in
   `supabase/schema.sql`, oder die separate `fix_storage_policies.sql`,
   falls du sie schon mal vergessen hattest) – ohne die schlägt jeder
   Upload mit "new row violates row-level security policy" fehl.

## 2. Erste Organisation + ersten Admin anlegen

Da es noch keine Self-Signup-Oberfläche gibt, einmalig per SQL-Editor:

```sql
insert into organisationen (name) values ('Deine erste Firma')
returning id; -- merken für den nächsten Schritt
```

Danach im Auth-Dashboard einen Nutzer für dich selbst anlegen (oder per
`invite-kunde`-Function/`inviteUserByEmail` mit `rolle: 'org_admin'` statt
`'kunde'` in den user_metadata).

## 3. Projekt lokal starten

```bash
cp .env.example .env
# .env mit deinen echten Supabase-Werten füllen (Project Settings → API)
npm install
npm run dev
```

## 4. Edge Functions deployen (optional, für Kunden-Einladung)

```bash
supabase functions deploy invite-kunde
supabase functions deploy invite-mitarbeiter
```

Die `whatsapp-webhook`-Function liegt bereit, aber **bewusst noch nicht
deployed/aktiviert** – siehe unten.

## 4b. E-Mail-Versand (Kundenbenachrichtigung, Plattform-Rechnung, SLA/Lizenz-Erinnerung)

Läuft per SMTP über ein normales, bereits vorhandenes Postfach – keine
Domain-Verifizierung/DNS-Einrichtung nötig.

**Wichtig:** Supabase Edge Functions laufen in einer Deno-Sandbox, die keine
rohen TCP-Verbindungen nach außen erlaubt – ein direkter SMTP-Versuch von
dort stürzt sofort mit HTTP 503 ab. Der eigentliche SMTP-Versand läuft
deshalb über eine kleine Vercel-Function (`api/send-mail.ts`, Node.js-
Laufzeit, die echtes SMTP kann). Die Supabase-Functions schicken die
Mail-Daten nur noch per HTTPS an diese Vercel-Function weiter.

```bash
supabase functions deploy benachrichtige-kunde
supabase secrets set MAIL_RELAY_URL=https://deine-domain.vercel.app/api/send-mail MAIL_RELAY_SECRET=...
supabase secrets set SMTP_HOST=smtp.deinanbieter.de SMTP_PORT=587 SMTP_USER=deine@adresse.de SMTP_PASSWORD=... ABSENDER_EMAIL=deine@adresse.de
```

Zusätzlich in Vercel (Project Settings → Environment Variables) dieselbe
`MAIL_RELAY_SECRET` eintragen – muss auf beiden Seiten identisch sein, sonst
lehnt die Vercel-Function den Aufruf mit 401 ab.

- `MAIL_RELAY_URL`/`MAIL_RELAY_SECRET`: Adresse und geteiltes Secret der
  Vercel-Relay-Function (Infrastruktur, nicht pro Firma).
- `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`: von deinem E-Mail-Anbieter
  (steht meist unter "SMTP-Einstellungen" oder "E-Mail-Client einrichten").
  Port `465` = implizites TLS, Port `587` (Standard) = STARTTLS.
- `ABSENDER_EMAIL`: optional, falls abweichend von `SMTP_USER`. Fällt sonst
  automatisch auf `SMTP_USER` zurück.
- Ohne gesetzte Secrets bleibt der Versand aus, es gibt aber keinen Fehler –
  die App funktioniert auch ohne E-Mail-Versand normal weiter.
- `SMTP_*`/`ABSENDER_EMAIL` sind der **globale Fallback** für
  `benachrichtige-kunde`, `sla-eskalation-pruefen` und
  `lizenz-erinnerung-pruefen`. Jede Firma kann in der App unter Verwaltung →
  Integrationen eine **eigene** Absenderadresse hinterlegen (Tabelle
  `organisation_smtp_konfiguration`) – ist das gesetzt, wird das statt des
  globalen Postfachs verwendet (läuft ebenfalls über dieselbe Vercel-Relay-
  Function). `sende-plattform-rechnung` (Super-Admin → Firma) nutzt immer die
  globalen `SMTP_*`-Secrets (nie die Firmen-eigene Konfiguration), läuft aber
  ebenfalls über den Relay – auch diese Function ist eine Supabase Edge
  Function und kann daher genauso wenig direkt SMTP sprechen.

## 4c. E-Mail → Ticket (eingehende Mails automatisch als Ticket anlegen)

Läuft per IMAP-Abruf alle 5 Minuten (Cron `email-abrufen-alle-5min`), aus
demselben Grund wie beim Versand: Supabase Edge Functions können kein
IMAP (raw TCP), daher übernimmt eine weitere Vercel-Function
(`api/check-mail.ts`) den eigentlichen Postfach-Abruf.

Einrichtung läuft komplett über die App (Verwaltung → Integrationen →
"E-Mail (Senden & Empfangen)"): IMAP-Host/Port zusätzlich zu den
SMTP-Daten eintragen (gleiches Postfach, gleicher Benutzer/Passwort) und
die Support-E-Mail-Adresse angeben. Kein zusätzliches Secret nötig – nutzt
denselben `MAIL_RELAY_URL`/`MAIL_RELAY_SECRET` wie der Versand (URL wird
von `/send-mail` auf `/check-mail` umgeschrieben).

- Unbekannte Absenderadressen erzeugen automatisch einen neuen Kunden-Account.
- Enthält der Betreff „#123“ (unverändert aus einer Ticket-Mail), wird die
  Antwort dem bestehenden Ticket zugeordnet statt ein neues zu öffnen.
- Anhänge werden mit übernommen (bis 8 MB pro Datei).
- Dedupe über `ticket_nachrichten.email_message_id` (unique index) – auch
  bei mehrfachem Abruf derselben Mail kein doppeltes Ticket/Antwort.

## 5. Deployment auf Vercel

Wie bei deinen anderen Projekten: Repo zu GitHub pushen, in Vercel
importieren, die beiden `VITE_SUPABASE_*` Variablen als Environment
Variables setzen, fertig.

## 6. WhatsApp später aktivieren

1. Meta Business-Konto + WhatsApp Business Account (WABA) verifizieren.
2. In `organisationen` für die jeweilige Firma `whatsapp_phone_number_id`
   und `whatsapp_business_number` eintragen.
3. `supabase functions deploy whatsapp-webhook --no-verify-jwt`
4. Secrets setzen: `supabase secrets set WHATSAPP_VERIFY_TOKEN=... WHATSAPP_ACCESS_TOKEN=...`
5. Im Meta App Dashboard die Function-URL als Webhook eintragen.
6. Vor dem Live-Schalten: `X-Hub-Signature-256`-Prüfung in der Function
   ergänzen (als TODO markiert).

## 7. Plattform-Abrechnung (Super-Admin → Firmen)

Über das 🏦-Icon im Header (nur Super-Admin) lassen sich Tarife mit
Mitarbeiter-Staffeln anlegen, Firmen einem Tarif zuordnen und daraus
monatliche Rechnungen erzeugen. Der E-Mail-Versand läuft über dieselbe
SMTP-Konfiguration wie die Kundenbenachrichtigungen (siehe Abschnitt 8):

```bash
supabase functions deploy sende-plattform-rechnung
```

Ohne gesetzte Secrets bleibt die Rechnung als Entwurf gespeichert; der Versand
zeigt dann einen entsprechenden Hinweis statt eines Fehlers.

## Offene TODOs (bewusst für später zurückgestellt)

- Admin-Auth-Prüfung in `invite-kunde` (aktuell kann jeder eingeloggte
  Nutzer Einladungen auslösen – für den Start mit 2-5 eigenen Leuten okay,
  vor einem größeren Team nachrüsten)
- INSERT/UPDATE/DELETE-RLS-Policies (aktuell nur SELECT abgedeckt)
- Storage-Bucket-Policies für `anhaenge`
- Medien-Download (Bilder/Dokumente) im WhatsApp-Webhook
