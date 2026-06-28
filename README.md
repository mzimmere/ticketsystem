# IT-Ticketsystem

React/Vite + Supabase, multi-tenant. WhatsApp-Anbindung ist vorbereitet, aber
standardmäßig inaktiv (siehe unten).

## Features

- Dark/Light Mode (oben rechts umschaltbar, merkt sich die Wahl)
- Firmenname + Logo pro Organisation im Header (über `organisationen.logo_url`)
- Profilbilder für Mitarbeiter (eigenes Profil → Bild ändern)
- Verfügbarkeit (Verfügbar/Abwesend/Urlaub) + Ein-Klick-Übergabe aller offenen
  Tickets an eine Kollegin/einen Kollegen

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
```

Die `whatsapp-webhook`-Function liegt bereit, aber **bewusst noch nicht
deployed/aktiviert** – siehe unten.

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

## Offene TODOs (bewusst für später zurückgestellt)

- Admin-Auth-Prüfung in `invite-kunde` (aktuell kann jeder eingeloggte
  Nutzer Einladungen auslösen – für den Start mit 2-5 eigenen Leuten okay,
  vor einem größeren Team nachrüsten)
- INSERT/UPDATE/DELETE-RLS-Policies (aktuell nur SELECT abgedeckt)
- Storage-Bucket-Policies für `anhaenge`
- Medien-Download (Bilder/Dokumente) im WhatsApp-Webhook
