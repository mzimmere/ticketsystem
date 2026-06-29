-- ============================================================
-- IT-Ticketsystem – Multi-Tenant Schema (ENTWURF)
-- Für Supabase/Postgres. Vor Produktiveinsatz verfeinern,
-- besonders die RLS-Policies (siehe Hinweise unten).
-- ============================================================

-- ----------------------------------------------------------
-- 1. Organisationen (Mandanten = deine verwalteten Firmen)
-- ----------------------------------------------------------
create table organisationen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_phone_number_id text,   -- Meta phone_number_id, für Webhook-Routing
  whatsapp_business_number text,   -- z.B. +49...
  erstellt_am timestamptz default now()
);

-- ----------------------------------------------------------
-- 2. Rollen & Profile
-- ----------------------------------------------------------
create type user_rolle as enum ('super_admin', 'org_admin', 'techniker', 'kunde');

-- Erweitert Supabase auth.users um Rolle + Organisation
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references organisationen(id),  -- null bei super_admin
  rolle user_rolle not null default 'kunde',
  name text,
  telefonnummer text,                -- Schlüssel für WhatsApp-Zuordnung
  erstellt_am timestamptz default now()
);

create index idx_profiles_telefonnummer on profiles(telefonnummer);
create index idx_profiles_org on profiles(organisation_id);

-- ----------------------------------------------------------
-- 3. Tickets
-- ----------------------------------------------------------
create type ticket_status as enum
  ('offen', 'in_bearbeitung', 'wartet_auf_kunde', 'geloest', 'geschlossen');

create type ticket_prioritaet as enum
  ('niedrig', 'mittel', 'hoch', 'kritisch');

create table tickets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  kunde_id uuid references profiles(id),
  zugewiesen_an uuid references profiles(id),
  titel text not null,
  status ticket_status not null default 'offen',
  prioritaet ticket_prioritaet not null default 'mittel',
  quelle text not null default 'portal',   -- 'whatsapp' | 'portal'
  erstellt_am timestamptz default now(),
  aktualisiert_am timestamptz default now()
);

create index idx_tickets_org on tickets(organisation_id);
create index idx_tickets_status on tickets(organisation_id, status);
create index idx_tickets_zugewiesen on tickets(zugewiesen_an);

-- ----------------------------------------------------------
-- 4. Nachrichten / Verlauf je Ticket
-- ----------------------------------------------------------
create table ticket_nachrichten (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  autor_id uuid references profiles(id),
  quelle text not null,               -- 'whatsapp' | 'portal' | 'intern'
  inhalt text,
  whatsapp_message_id text,           -- für Dedupe bei Webhook-Retries
  erstellt_am timestamptz default now()
);

create index idx_nachrichten_ticket on ticket_nachrichten(ticket_id);
create unique index idx_nachrichten_wa_dedupe
  on ticket_nachrichten(whatsapp_message_id)
  where whatsapp_message_id is not null;

-- ----------------------------------------------------------
-- 5. Anhänge (Fotos/Screenshots aus WhatsApp oder Portal-Upload)
-- ----------------------------------------------------------
create table anhaenge (
  id uuid primary key default gen_random_uuid(),
  nachricht_id uuid references ticket_nachrichten(id) on delete cascade,
  storage_path text not null,
  dateityp text,
  erstellt_am timestamptz default now()
);

-- ============================================================
-- RLS – ENTWURF
-- Hinweis: Mehrere "permissive" Policies auf derselben Tabelle
-- werden von Postgres mit OR verknüpft. Vor dem Go-Live mit
-- echten Testnutzern (je Rolle) durchtesten!
-- ============================================================

alter table organisationen enable row level security;
alter table profiles enable row level security;
alter table tickets enable row level security;
alter table ticket_nachrichten enable row level security;
alter table anhaenge enable row level security;

-- Helper-Funktionen: Rolle/Org des eingeloggten Users
create or replace function current_user_org() returns uuid as $$
  select organisation_id from profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function current_user_rolle() returns user_rolle as $$
  select rolle from profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- Organisationen: nur super_admin sieht/verwaltet die Liste
create policy organisationen_select on organisationen for select
  using (
    current_user_rolle() = 'super_admin'
    or id = current_user_org()
  );

-- Tickets: super_admin & org_admin/techniker sehen ihre Organisation
create policy tickets_select_intern on tickets for select
  using (
    current_user_rolle() = 'super_admin'
    or (
      current_user_rolle() in ('org_admin', 'techniker')
      and organisation_id = current_user_org()
    )
  );

-- Tickets: Kunden sehen nur ihre eigenen
create policy tickets_select_kunde on tickets for select
  using (
    current_user_rolle() = 'kunde'
    and kunde_id = auth.uid()
  );

-- Nachrichten: interne Notizen ('intern') sind für Kunden nie sichtbar
create policy nachrichten_select on ticket_nachrichten for select
  using (
    quelle <> 'intern'
    or current_user_rolle() in ('super_admin', 'org_admin', 'techniker')
  );

-- TODO vor Produktiveinsatz:
-- - INSERT/UPDATE/DELETE-Policies analog ergänzen
-- - Prüfen, ob org_admin auch andere Profiles seiner Organisation
--   anlegen/bearbeiten darf
-- - Storage-Bucket-Policies für "anhaenge" passend zur RLS-Logik oben

-- ============================================================
-- 6. Zeiterfassung & Abrechnung (Ergänzung)
-- ============================================================

-- Minutenpreis: Standard pro Organisation, optionaler Override pro Kunde
alter table organisationen
  add column standard_preis_pro_minute_cent integer not null default 0;

alter table profiles
  add column preis_pro_minute_cent integer;  -- nur bei rolle='kunde' relevant, überschreibt Organisations-Standard

create type abrechnungsstatus as enum
  ('nicht_abgerechnet', 'in_rechnung', 'abgerechnet');

create table zeiteintraege (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  ticket_id uuid references tickets(id),            -- optional: auch Zeit ohne konkretes Ticket erfassbar
  kunde_id uuid not null references profiles(id),    -- der einzelne Endkunde (nicht die Firma)
  techniker_id uuid not null references profiles(id),
  minuten integer not null check (minuten > 0),
  beschreibung text,
  preis_pro_minute_cent_snapshot integer not null,   -- zum Erfassungszeitpunkt gültiger Satz
                                                       -- (Historie bleibt korrekt bei späteren Preisänderungen)
  abrechenbar boolean not null default true,
  abrechnungsstatus abrechnungsstatus not null default 'nicht_abgerechnet',
  erstellt_am timestamptz default now()
);

create index idx_zeit_ticket on zeiteintraege(ticket_id);
create index idx_zeit_kunde on zeiteintraege(kunde_id);
create index idx_zeit_org_status on zeiteintraege(organisation_id, abrechnungsstatus);

-- Zeit-/Kostensumme pro Ticket
create view ticket_zeitsumme as
select
  ticket_id,
  sum(minuten) as gesamt_minuten,
  sum(minuten * preis_pro_minute_cent_snapshot) as gesamt_cent
from zeiteintraege
where ticket_id is not null
group by ticket_id;

-- Zeit-/Kostensumme pro einzelnem Kunden (über alle dessen Tickets)
create view kunde_zeitsumme as
select
  kunde_id,
  organisation_id,
  sum(minuten) as gesamt_minuten,
  sum(minuten * preis_pro_minute_cent_snapshot) as gesamt_cent,
  sum(case when abrechnungsstatus = 'nicht_abgerechnet' then minuten else 0 end) as offene_minuten,
  sum(case when abrechnungsstatus = 'nicht_abgerechnet'
           then minuten * preis_pro_minute_cent_snapshot else 0 end) as offener_betrag_cent
from zeiteintraege
group by kunde_id, organisation_id;

alter table zeiteintraege enable row level security;

-- Zeiteinträge: nur intern sichtbar (super_admin/org_admin/techniker der eigenen Organisation)
create policy zeiteintraege_select on zeiteintraege for select
  using (
    current_user_rolle() = 'super_admin'
    or (
      current_user_rolle() in ('org_admin', 'techniker')
      and organisation_id = current_user_org()
    )
  );

-- TODO Zeiterfassung:
-- - INSERT-Policy: nur Techniker/Admin der eigenen Organisation dürfen Einträge anlegen
-- - Beim Anlegen eines Eintrags preis_pro_minute_cent_snapshot serverseitig befüllen:
--   coalesce(kunde.preis_pro_minute_cent, organisation.standard_preis_pro_minute_cent)
-- - Bei Bedarf: Kunden-Sicht freigeben, die NUR die Summen-Views zeigt (kein Einzeleintrag-Detail)

-- ============================================================
-- 7. Start/Stop-Timer (Ergänzung zu Zeiterfassung)
-- ============================================================

alter table zeiteintraege
  add column erfassungsart text not null default 'manuell',  -- 'manuell' | 'timer'
  add column start_zeit timestamptz,
  add column end_zeit timestamptz;

-- Minuten dürfen NULL sein, solange ein Timer noch läuft
-- (wird beim Stoppen von der App berechnet und nachgetragen)
alter table zeiteintraege alter column minuten drop not null;

-- Verhindert, dass ein Techniker zwei Timer gleichzeitig laufen hat
create unique index idx_zeit_aktiver_timer
  on zeiteintraege(techniker_id)
  where erfassungsart = 'timer' and end_zeit is null;

-- TODO Timer:
-- - Beim Start: insert mit erfassungsart='timer', start_zeit=now(), minuten=null
-- - Beim Stop: update end_zeit=now(), minuten=round(extract(epoch from (end_zeit-start_zeit))/60)
-- - UI: "läuft gerade ein Timer?" einfach über idx_zeit_aktiver_timer / WHERE-Abfrage prüfen

-- ============================================================
-- 8. Automatischer Preis-Snapshot (Trigger statt Client-Eingabe)
-- ============================================================

create or replace function set_preis_snapshot() returns trigger as $$
begin
  if new.preis_pro_minute_cent_snapshot is null then
    select coalesce(p.preis_pro_minute_cent, o.standard_preis_pro_minute_cent)
      into new.preis_pro_minute_cent_snapshot
    from profiles p
    join organisationen o on o.id = p.organisation_id
    where p.id = new.kunde_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_set_preis_snapshot
  before insert on zeiteintraege
  for each row execute function set_preis_snapshot();

-- Damit muss der Client preis_pro_minute_cent_snapshot beim Insert
-- gar nicht mehr mitschicken – der Trigger befüllt ihn automatisch.

-- ============================================================
-- 9. Automatisches Profil bei Einladung/Registrierung
-- ============================================================
-- Wenn ein Kunde per Einladung (invite-kunde Edge Function) einen
-- echten Login bekommt, legt dieser Trigger automatisch die passende
-- profiles-Zeile an – organisation_id und rolle kommen aus den
-- user_metadata, die beim Einladen mitgegeben werden.

create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, organisation_id, rolle, name, telefonnummer)
  values (
    new.id,
    (new.raw_user_meta_data->>'organisation_id')::uuid,
    coalesce((new.raw_user_meta_data->>'rolle')::public.user_rolle, 'kunde'),
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'telefonnummer'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 10. Branding, Avatare, Verfügbarkeit, Ticket-Übergabe
-- ============================================================

alter table organisationen
  add column logo_url text;

alter table profiles
  add column avatar_url text,
  add column verfuegbarkeit text not null default 'verfuegbar';
  -- Werte: 'verfuegbar' | 'abwesend' | 'urlaub'

-- Übergibt alle offenen Tickets eines Technikers an einen anderen
-- (z.B. bei Urlaub/Abwesenheit). Gibt die Anzahl übertragener Tickets zurück.
create or replace function tickets_uebertragen(von_techniker_id uuid, an_techniker_id uuid)
returns integer as $$
declare
  anzahl integer;
begin
  update tickets
  set zugewiesen_an = an_techniker_id
  where zugewiesen_an = von_techniker_id
    and status not in ('geloest', 'geschlossen');
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$ language plpgsql security definer set search_path = public;

-- TODO Storage-Buckets in Supabase anlegen:
-- - "avatare" (öffentlich lesbar, damit Profilbilder einfach angezeigt werden können)
-- - "logos" (öffentlich lesbar, für Firmenlogos)

-- ============================================================
-- 11. Bugfix: fehlende SELECT-Policy für profiles
-- ============================================================
-- Ohne diese Policy wären Namen/Avatare (Kunde, zugewiesener Techniker,
-- Kollegen) nirgends sichtbar gewesen, da RLS ohne Policy alles sperrt.

create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (
      organisation_id = current_user_org()
      and current_user_rolle() in ('org_admin', 'techniker')
    )
    or (
      organisation_id = current_user_org()
      and current_user_rolle() = 'kunde'
      and rolle in ('techniker', 'org_admin')
    )
  );
-- Kunden sehen damit sich selbst + Techniker/Admins ihrer Organisation
-- (um z.B. den Bearbeiter ihres Tickets zu sehen), aber keine anderen Kunden.

-- ============================================================
-- 12. Storage-RLS-Policies (avatare, anhaenge, logos)
-- ============================================================
-- Voraussetzung: Buckets "avatare", "anhaenge", "logos" im Storage-Dashboard
-- anlegen, dann diese Policies ausführen.

create policy avatare_insert on storage.objects for insert
  with check (
    bucket_id = 'avatare'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatare_update on storage.objects for update
  using (
    bucket_id = 'avatare'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatare_select on storage.objects for select
  using (bucket_id = 'avatare');

create policy anhaenge_insert on storage.objects for insert
  with check (
    bucket_id = 'anhaenge'
    and exists (
      select 1 from tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.organisation_id = current_user_org() or t.kunde_id = auth.uid())
    )
  );

create policy anhaenge_select on storage.objects for select
  using (
    bucket_id = 'anhaenge'
    and exists (
      select 1 from tickets t
      where t.id::text = (storage.foldername(name))[1]
        and (t.organisation_id = current_user_org() or t.kunde_id = auth.uid())
    )
  );

create policy logos_insert on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and current_user_rolle() in ('super_admin', 'org_admin')
  );

create policy logos_select on storage.objects for select
  using (bucket_id = 'logos');

-- ============================================================
-- 13. Fehlende Schreib-Policies (INSERT/UPDATE)
-- ============================================================
-- Bugfix: bisher gab es fast überall nur SELECT-Policies, das blockierte
-- Ticket anlegen, Status ändern, Zeit erfassen, Nachricht schreiben,
-- Firmenprofil bearbeiten usw.

create policy organisationen_update on organisationen for update
  using (
    current_user_rolle() = 'super_admin'
    or (id = current_user_org() and current_user_rolle() = 'org_admin')
  );

create policy organisationen_insert on organisationen for insert
  with check (current_user_rolle() = 'super_admin');

create policy profiles_update on profiles for update
  using (
    id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
  );

create policy tickets_insert on tickets for insert
  with check (
    organisation_id = current_user_org()
    or current_user_rolle() = 'super_admin'
  );

create policy tickets_update on tickets for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy nachrichten_insert on ticket_nachrichten for insert
  with check (
    exists (
      select 1 from tickets t
      where t.id = ticket_nachrichten.ticket_id
        and (
          current_user_rolle() = 'super_admin'
          or (t.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or (t.kunde_id = auth.uid() and ticket_nachrichten.quelle <> 'intern')
        )
    )
  );

create policy zeiteintraege_insert on zeiteintraege for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy zeiteintraege_update on zeiteintraege for update
  using (
    techniker_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
  );

create policy anhaenge_select on anhaenge for select
  using (
    exists (
      select 1 from ticket_nachrichten n
      join tickets t on t.id = n.ticket_id
      where n.id = anhaenge.nachricht_id
        and (
          current_user_rolle() = 'super_admin'
          or (t.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or t.kunde_id = auth.uid()
        )
    )
  );

create policy anhaenge_insert on anhaenge for insert
  with check (
    exists (
      select 1 from ticket_nachrichten n
      join tickets t on t.id = n.ticket_id
      where n.id = anhaenge.nachricht_id
        and (
          current_user_rolle() = 'super_admin'
          or (t.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or t.kunde_id = auth.uid()
        )
    )
  );

-- ============================================================
-- 14. Kundendaten: Adresse + Notizen/Besonderheiten
-- ============================================================
alter table profiles
  add column adresse text,
  add column notizen text;
