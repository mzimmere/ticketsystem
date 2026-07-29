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
create view ticket_zeitsumme with (security_invoker = true) as
select
  ticket_id,
  sum(minuten) as gesamt_minuten,
  sum(minuten * preis_pro_minute_cent_snapshot) as gesamt_cent
from zeiteintraege
where ticket_id is not null
group by ticket_id;

-- Zeit-/Kostensumme pro einzelnem Kunden (über alle dessen Tickets)
create view kunde_zeitsumme with (security_invoker = true) as
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
declare
  v_preis integer;
begin
  if new.preis_pro_minute_cent_snapshot is null then
    select kp.preis_pro_minute_cent into v_preis
    from kunden_preise kp
    where kp.kunde_id = new.kunde_id
      and kp.gueltig_ab <= new.erstellt_am::date
    order by kp.gueltig_ab desc
    limit 1;

    if v_preis is null then
      select o.standard_preis_pro_minute_cent into v_preis
      from profiles p
      join organisationen o on o.id = p.organisation_id
      where p.id = new.kunde_id;
    end if;

    new.preis_pro_minute_cent_snapshot := v_preis;
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
  insert into public.profiles (
    id, organisation_id, rolle, vorname, nachname, telefonnummer,
    strasse, hausnummer, plz, ort
  )
  values (
    new.id,
    (new.raw_user_meta_data->>'organisation_id')::uuid,
    coalesce((new.raw_user_meta_data->>'rolle')::public.user_rolle, 'kunde'),
    new.raw_user_meta_data->>'vorname',
    new.raw_user_meta_data->>'nachname',
    new.raw_user_meta_data->>'telefonnummer',
    new.raw_user_meta_data->>'strasse',
    new.raw_user_meta_data->>'hausnummer',
    new.raw_user_meta_data->>'plz',
    new.raw_user_meta_data->>'ort'
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
    and (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      or exists (
        select 1 from profiles p
        where p.id::text = (storage.foldername(storage.objects.name))[1]
          and (
            current_user_rolle() = 'super_admin'
            or (p.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          )
      )
    )
  );

create policy avatare_update on storage.objects for update
  using (
    bucket_id = 'avatare'
    and (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      or exists (
        select 1 from profiles p
        where p.id::text = (storage.foldername(storage.objects.name))[1]
          and (
            current_user_rolle() = 'super_admin'
            or (p.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          )
      )
    )
  );

create policy avatare_select on storage.objects for select
  using (bucket_id = 'avatare');

create policy anhaenge_insert on storage.objects for insert
  with check (
    bucket_id = 'anhaenge'
    and exists (
      select 1 from tickets t
      where t.id::text = (storage.foldername(storage.objects.name))[1]
        and (
          current_user_rolle() = 'super_admin'
          or t.organisation_id = current_user_org()
          or t.kunde_id = auth.uid()
        )
    )
  );

create policy anhaenge_select on storage.objects for select
  using (
    bucket_id = 'anhaenge'
    and exists (
      select 1 from tickets t
      where t.id::text = (storage.foldername(storage.objects.name))[1]
        and (
          current_user_rolle() = 'super_admin'
          or t.organisation_id = current_user_org()
          or t.kunde_id = auth.uid()
        )
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

-- ============================================================
-- 15. Kundendokumente (ticket-unabhängig) + erweiterte
-- Avatar-Upload-Rechte
-- ============================================================
-- Voraussetzung: Storage-Bucket "kundendokumente" anlegen (privat).

create table kunden_dokumente (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  kunde_id uuid not null references profiles(id),
  storage_path text not null,
  dateiname text not null,
  dateityp text,
  hochgeladen_von uuid references profiles(id),
  erstellt_am timestamptz default now()
);

create index idx_kunden_dokumente_kunde on kunden_dokumente(kunde_id);

alter table kunden_dokumente enable row level security;

create policy kunden_dokumente_select on kunden_dokumente for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy kunden_dokumente_insert on kunden_dokumente for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy kunden_dokumente_delete on kunden_dokumente for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy kundendokumente_insert on storage.objects for insert
  with check (
    bucket_id = 'kundendokumente'
    and exists (
      select 1 from profiles p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and (
          current_user_rolle() = 'super_admin'
          or (p.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
        )
    )
  );

create policy kundendokumente_select on storage.objects for select
  using (
    bucket_id = 'kundendokumente'
    and exists (
      select 1 from profiles p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and (
          current_user_rolle() = 'super_admin'
          or (p.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
        )
    )
  );

create policy kundendokumente_delete on storage.objects for delete
  using (
    bucket_id = 'kundendokumente'
    and exists (
      select 1 from profiles p
      where p.id::text = (storage.foldername(storage.objects.name))[1]
        and (
          current_user_rolle() = 'super_admin'
          or (p.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
        )
    )
  );

-- ============================================================
-- 16. Fortlaufende Ticket-Nummer
-- ============================================================
alter table tickets add column ticket_nr serial;

-- ============================================================
-- 17. Adresse + Kontaktmöglichkeiten für die Organisation
-- ============================================================
alter table organisationen
  add column adresse text,
  add column telefon text,
  add column email text,
  add column website text,
  add column oeffnungszeiten text;

-- ============================================================
-- 18. Ungelesen-Markierung: Zeitstempel + Trigger
-- ============================================================
alter table tickets
  add column zuletzt_kunden_nachricht_am timestamptz,
  add column zuletzt_gelesen_am timestamptz;

create or replace function set_kunden_nachricht_zeit() returns trigger as $$
begin
  if new.quelle = 'whatsapp'
     or new.autor_id = (select kunde_id from tickets where id = new.ticket_id)
  then
    update tickets
    set zuletzt_kunden_nachricht_am = new.erstellt_am
    where id = new.ticket_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_set_kunden_nachricht_zeit
  after insert on ticket_nachrichten
  for each row execute function set_kunden_nachricht_zeit();

-- ============================================================
-- 19. Kunde darf sein eigenes Ticket schließen
-- ============================================================
-- (Policy "tickets_update_kunde" wird später in Abschnitt 36 erweitert
-- und dort final definiert.)

-- ============================================================
-- 20. Deaktivieren statt Löschen (Kunden + Mitarbeiter)
-- ============================================================
alter table profiles
  add column deaktiviert boolean not null default false;

-- ============================================================
-- 21. Monatsabrechnung-View + Kunde darf eigene Zeit lesen
-- ============================================================
create view kunde_monatsabrechnung with (security_invoker = true) as
select
  kunde_id,
  organisation_id,
  date_trunc('month', erstellt_am)::date as monat,
  sum(minuten) as gesamt_minuten,
  sum(minuten * preis_pro_minute_cent_snapshot) as gesamt_cent
from zeiteintraege
where minuten is not null
group by kunde_id, organisation_id, date_trunc('month', erstellt_am);

create policy zeiteintraege_select_kunde on zeiteintraege for select
  using (kunde_id = auth.uid());

-- ============================================================
-- 22. Rechnungsanpassungen: Rabatte/Gutschriften pro Kunde+Monat
-- ============================================================
create table rechnungsanpassungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  kunde_id uuid not null references profiles(id),
  monat date not null,
  betrag_cent integer not null,
  beschreibung text not null,
  erstellt_am timestamptz default now()
);

create index idx_rechnungsanpassungen_kunde_monat on rechnungsanpassungen(kunde_id, monat);

alter table rechnungsanpassungen enable row level security;

create policy rechnungsanpassungen_select on rechnungsanpassungen for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy rechnungsanpassungen_insert on rechnungsanpassungen for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy rechnungsanpassungen_delete on rechnungsanpassungen for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

-- ============================================================
-- 23. Preis-Historie pro Kunde (mit Gültigkeitsdatum)
-- ============================================================
create table kunden_preise (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid not null references profiles(id),
  organisation_id uuid not null references organisationen(id),
  preis_pro_minute_cent integer not null,
  gueltig_ab date not null,
  erstellt_am timestamptz default now()
);

create index idx_kunden_preise_kunde on kunden_preise(kunde_id, gueltig_ab);

alter table kunden_preise enable row level security;

create policy kunden_preise_select on kunden_preise for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or kunde_id = auth.uid()
  );

create policy kunden_preise_insert on kunden_preise for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy kunden_preise_delete on kunden_preise for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

-- ============================================================
-- 24. Adresse aufteilen: PLZ, Ort, Straße, Hausnummer
-- ============================================================
-- "adresse" (Freitext) bleibt als Altfeld bestehen, UI nutzt ab hier
-- nur noch die strukturierten Felder.
alter table profiles
  add column strasse text,
  add column hausnummer text,
  add column plz text,
  add column ort text;

-- ============================================================
-- 25. Land + MwSt-Satz pro Kunde
-- ============================================================
alter table profiles
  add column land text default 'Deutschland',
  add column mwst_satz numeric(5,2) default 19.00;

-- ============================================================
-- 26. Branding pro Firma: Motto, Akzentfarbe, Hero-Bild
-- ============================================================
alter table organisationen
  add column motto text,
  add column akzentfarbe text default '#f59e0b',
  add column hero_bild_url text;

-- ============================================================
-- 27. Interne Nachrichten: Org-Admin → Super-Admin
-- ============================================================
create table admin_nachrichten (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  von_id uuid not null references profiles(id),
  betreff text not null,
  inhalt text not null,
  gelesen boolean not null default false,
  antwort text,
  beantwortet_am timestamptz,
  erstellt_am timestamptz default now()
);

create index idx_admin_nachrichten_org on admin_nachrichten(organisation_id);

alter table admin_nachrichten enable row level security;

create policy admin_nachrichten_select on admin_nachrichten for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy admin_nachrichten_insert on admin_nachrichten for insert
  with check (
    organisation_id = current_user_org()
    and current_user_rolle() in ('org_admin', 'techniker')
  );

create policy admin_nachrichten_update on admin_nachrichten for update
  using (current_user_rolle() = 'super_admin');

-- ============================================================
-- 28. Hilfsfunktion: Auth-User-ID anhand E-Mail finden
-- ============================================================
create or replace function get_user_id_by_email(p_email text)
returns uuid as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$ language sql security definer set search_path = public, auth;

-- ============================================================
-- 29. Firmen-Slug + öffentliche View für Registrierungslink
-- ============================================================
alter table organisationen
  add column slug text unique;

create view organisationen_oeffentlich as
select id, name, logo_url, motto, akzentfarbe, slug
from organisationen
where slug is not null;

grant select on organisationen_oeffentlich to anon, authenticated;

-- ============================================================
-- 30. Korrektur: RPC-Funktion statt View für öffentliche
-- Registrierungs-Anzeige (zuverlässiger im PostgREST-Schema-Cache)
-- ============================================================
drop view if exists organisationen_oeffentlich;

drop function if exists get_organisation_by_slug(text);

create function get_organisation_by_slug(p_slug text)
returns table (
  id uuid,
  name text,
  logo_url text,
  motto text,
  akzentfarbe text,
  adresse text,
  telefon text,
  email text,
  website text,
  datenschutz_url text,
  datenschutz_text text
) as $$
  select id, name, logo_url, motto, akzentfarbe, adresse, telefon, email, website,
         datenschutz_url, datenschutz_text
  from organisationen
  where slug = p_slug
  limit 1;
$$ language sql stable security definer set search_path = public;

grant execute on function get_organisation_by_slug(text) to anon, authenticated;

-- ============================================================
-- 31. Vor-/Nachname getrennt halten (statt einem "name"-Feld)
-- ============================================================
alter table profiles add column vorname text;
alter table profiles add column nachname text;

update profiles
set vorname = split_part(name, ' ', 1),
    nachname = nullif(trim(substring(name from position(' ' in name) + 1)), '')
where vorname is null and name is not null and name <> '';

alter table profiles drop column if exists name;
alter table profiles add column name text
  generated always as (trim(both ' ' from coalesce(vorname, '') || ' ' || coalesce(nachname, ''))) stored;

-- ============================================================
-- 32. USt-IdNr. für Kunden (innergemeinschaftliche Lieferung)
-- ============================================================
alter table profiles add column ust_id text;

-- ============================================================
-- 33. Datenschutzerklärung pro Firma: Link ODER eigener Text
-- ============================================================
alter table organisationen
  add column datenschutz_url text,
  add column datenschutz_text text;

-- ============================================================
-- 34. Realtime für "anhaenge" aktivieren
-- ============================================================
alter publication supabase_realtime add table public.anhaenge;

-- ============================================================
-- 35. Einstellbare Logo-Breite speziell für die Rechnung
-- ============================================================
alter table organisationen
  add column rechnungslogo_breite integer default 80;

-- ============================================================
-- 36. Zendesk-artige Features: Vorlagen/Makros, Tags,
-- Volltextsuche, SLA-Frist, CSAT-Bewertung
-- ============================================================
create table vorlagen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  titel text not null,
  inhalt text not null,
  typ text not null default 'antwort',
  erstellt_am timestamptz default now()
);

create index idx_vorlagen_org on vorlagen(organisation_id, typ);

alter table vorlagen enable row level security;

create policy vorlagen_select on vorlagen for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy vorlagen_insert on vorlagen for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

create policy vorlagen_delete on vorlagen for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
  );

alter table tickets add column tags text[] not null default '{}';
alter table organisationen add column sla_stunden integer;
alter table tickets add column csat_bewertung smallint;
alter table tickets add column csat_kommentar text;

create policy tickets_update_kunde on tickets for update
  using (kunde_id = auth.uid())
  with check (kunde_id = auth.uid());

create or replace function ticket_ids_mit_nachricht(p_organisation_id uuid, p_begriff text)
returns setof uuid as $$
  select distinct t.id
  from tickets t
  join ticket_nachrichten n on n.ticket_id = t.id
  where t.organisation_id = p_organisation_id
    and n.inhalt ilike '%' || p_begriff || '%'
    and (
      current_user_rolle() = 'super_admin'
      or (t.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    );
$$ language sql stable security definer set search_path = public;

-- ============================================================
-- 37. Produktdatenbank (persönliche Leistungen/Produkte pro Mitarbeiter)
-- ============================================================
create table produkte (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  ersteller_id uuid not null references profiles(id),
  bezeichnung text not null,
  beschreibung text,
  einzelpreis_cent integer not null,
  einheit text not null default 'Stück',
  aktiv boolean not null default true,
  erstellt_am timestamptz default now()
);

create index idx_produkte_ersteller on produkte(ersteller_id);

alter table produkte enable row level security;

create policy produkte_select on produkte for select
  using (
    ersteller_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
  );

create policy produkte_insert on produkte for insert
  with check (
    ersteller_id = auth.uid()
    and (
      current_user_rolle() = 'super_admin'
      or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    )
  );

create policy produkte_update on produkte for update
  using (
    ersteller_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
  );

create policy produkte_delete on produkte for delete
  using (
    ersteller_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
  );

-- ============================================================
-- 38. Rechnungspositionen: rechnungsanpassungen um Produkt-Positionsfelder erweitern
-- ============================================================
alter table rechnungsanpassungen
  add column menge numeric,
  add column einzelpreis_cent integer,
  add column produkt_id uuid references produkte(id),
  add column art text default 'anpassung';

grant execute on function ticket_ids_mit_nachricht(uuid, text) to authenticated;

-- ============================================================
-- 39. Plattform-Abrechnung: Super-Admin berechnet/verschickt Rechnungen
-- an die Firmen (Tenants) selbst, nach Tarif mit Mitarbeiter-Staffeln.
-- ============================================================
create table tarife (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grundpreis_cent integer not null default 0,
  inklusive_mitarbeiter integer not null default 1,
  mwst_satz numeric not null default 19,
  aktiv boolean not null default true,
  erstellt_am timestamptz default now()
);

-- Staffeln beziehen sich auf absolute Mitarbeiterzahlen (nicht relativ zum
-- inklusiv-Kontingent): z.B. von=4 bis=10 -> 15€ je Mitarbeiter #4 bis #10.
-- bis_mitarbeiter = null bedeutet "nach oben offen".
create table tarif_staffeln (
  id uuid primary key default gen_random_uuid(),
  tarif_id uuid not null references tarife(id) on delete cascade,
  von_mitarbeiter integer not null,
  bis_mitarbeiter integer,
  preis_pro_mitarbeiter_cent integer not null,
  reihenfolge integer not null default 0
);

create index idx_tarif_staffeln_tarif on tarif_staffeln(tarif_id);

alter table organisationen add column tarif_id uuid references tarife(id) on delete set null;

-- Positionen/Betraege sind Snapshots zum Erstellungszeitpunkt, damit spaetere
-- Tarifaenderungen bereits verschickte Rechnungen nicht ruckwirkend aendern.
create table plattform_rechnungen (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  monat date not null,
  rechnungsnummer text not null unique,
  tarif_name text not null,
  mitarbeiter_anzahl integer not null,
  grundpreis_cent integer not null,
  staffel_betrag_cent integer not null default 0,
  positionen jsonb not null default '[]',
  netto_cent integer not null,
  mwst_satz numeric not null default 19,
  mwst_cent integer not null,
  brutto_cent integer not null,
  status text not null default 'entwurf' check (status in ('entwurf', 'versendet')),
  versendet_am timestamptz,
  erstellt_am timestamptz default now(),
  unique (organisation_id, monat)
);

create index idx_plattform_rechnungen_org on plattform_rechnungen(organisation_id, monat);

-- Singleton-Tabelle (immer genau eine Zeile) mit den Absenderdaten der
-- Plattform selbst fuer die Rechnungen an die Firmen.
create table plattform_einstellungen (
  id boolean primary key default true,
  firmenname text not null default '',
  adresse text,
  email text,
  telefon text,
  ust_id text,
  iban text,
  check (id)
);
insert into plattform_einstellungen (id) values (true);

-- ============================================================
-- 40. Zahlungsziel, rechtlicher Hinweis und Freitext fuer Plattform-
-- Rechnungen: global als Vorgabe in plattform_einstellungen, pro
-- Rechnung als Snapshot (spaetere Aenderungen wirken nicht rueckwirkend).
-- ============================================================
alter table plattform_einstellungen
  add column zahlungsziel_tage integer not null default 14,
  add column rechtlicher_hinweis text not null default 'Rechnungsdatum ist Lieferdatum.',
  add column freitext text,
  add column steuernummer text;

alter table plattform_rechnungen
  add column rechnungsdatum date not null default current_date,
  add column faellig_am date,
  add column zahlungsziel_tage integer not null default 14,
  add column rechtlicher_hinweis text,
  add column freitext text;

alter table tarife enable row level security;
alter table tarif_staffeln enable row level security;
alter table plattform_rechnungen enable row level security;
alter table plattform_einstellungen enable row level security;

create policy tarife_all on tarife for all
  using (current_user_rolle() = 'super_admin')
  with check (current_user_rolle() = 'super_admin');

create policy tarif_staffeln_all on tarif_staffeln for all
  using (current_user_rolle() = 'super_admin')
  with check (current_user_rolle() = 'super_admin');

create policy plattform_rechnungen_all on plattform_rechnungen for all
  using (current_user_rolle() = 'super_admin')
  with check (current_user_rolle() = 'super_admin');

create policy plattform_einstellungen_all on plattform_einstellungen for all
  using (current_user_rolle() = 'super_admin')
  with check (current_user_rolle() = 'super_admin');

-- ============================================================
-- 41. Echte Mehrfach-Mitgliedschaft: eine Person (ein Login) kann
-- Techniker/Org-Admin bei mehreren Firmen gleichzeitig sein, mit jeweils
-- eigener Rolle. profiles.organisation_id/rolle bleiben als "Home"-Werte
-- fuer Kunden (weiterhin strikt 1:1) und Super-Admin-Sonderfaelle
-- bestehen, fuer Techniker/Org-Admin ist firmen_mitgliedschaften die
-- Quelle der Wahrheit fuer Firmenzugehoerigkeit.
-- ============================================================
create table firmen_mitgliedschaften (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references profiles(id) on delete cascade,
  organisation_id uuid not null references organisationen(id) on delete cascade,
  rolle user_rolle not null,
  deaktiviert boolean not null default false,
  erstellt_am timestamptz default now(),
  constraint firmen_mitgliedschaften_rolle_check check (rolle in ('techniker', 'org_admin')),
  unique (profil_id, organisation_id)
);

create index idx_mitgliedschaften_profil on firmen_mitgliedschaften(profil_id);
create index idx_mitgliedschaften_org on firmen_mitgliedschaften(organisation_id);

-- Backfill: bestehende Techniker/Org-Admins bekommen eine Mitgliedschaft
-- fuer ihre bisherige "Home"-Firma, damit sich am Zugriff nichts aendert.
insert into firmen_mitgliedschaften (profil_id, organisation_id, rolle, deaktiviert)
select id, organisation_id, rolle, deaktiviert
from profiles
where organisation_id is not null and rolle in ('techniker', 'org_admin')
on conflict (profil_id, organisation_id) do nothing;

alter table firmen_mitgliedschaften enable row level security;

-- Ist der eingeloggte User Mitglied dieser Firma mit einer der angegebenen
-- Rollen? (security definer, um RLS-Rekursion zu vermeiden - gleiches
-- Muster wie current_user_org()/current_user_rolle()).
create or replace function hat_firmenzugriff(p_organisation_id uuid, p_rollen user_rolle[])
returns boolean as $$
  select exists (
    select 1 from firmen_mitgliedschaften m
    where m.profil_id = auth.uid()
      and m.organisation_id = p_organisation_id
      and m.rolle = any(p_rollen)
      and not m.deaktiviert
  )
$$ language sql stable security definer set search_path = public;

-- Ist der eingeloggte User ueberhaupt Mitglied dieser Firma (egal welche
-- Rolle)?
create or replace function ist_firmenmitglied(p_organisation_id uuid)
returns boolean as $$
  select exists (
    select 1 from firmen_mitgliedschaften m
    where m.profil_id = auth.uid()
      and m.organisation_id = p_organisation_id
      and not m.deaktiviert
  )
$$ language sql stable security definer set search_path = public;

create policy mitgliedschaften_select on firmen_mitgliedschaften for select
  using (
    profil_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

create policy mitgliedschaften_insert on firmen_mitgliedschaften for insert
  with check (
    current_user_rolle() = 'super_admin'
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

create policy mitgliedschaften_update on firmen_mitgliedschaften for update
  using (
    current_user_rolle() = 'super_admin'
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

create policy mitgliedschaften_delete on firmen_mitgliedschaften for delete
  using (
    current_user_rolle() = 'super_admin'
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

-- ============================================================
-- 42. RLS-Policies auf Mitgliedschaft umgestellt (44 Policies, 20
-- Tabellen). Additiv: die urspruengliche organisation_id/rolle-Bedingung
-- bleibt in jeder Policy erhalten, hat_firmenzugriff()/ist_firmenmitglied()
-- wird jeweils per OR ergaenzt - zusaetzliche Mitgliedschaften gewaehren
-- Zugriff, ohne bestehenden Zugriff zu veraendern.
-- ============================================================
drop policy tickets_select_intern on tickets;
create policy tickets_select_intern on tickets for select
  using (
    current_user_rolle() = 'super_admin'
    or (current_user_rolle() in ('org_admin', 'techniker') and organisation_id = current_user_org())
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy tickets_insert on tickets;
create policy tickets_insert on tickets for insert
  with check (
    organisation_id = current_user_org()
    or current_user_rolle() = 'super_admin'
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy tickets_update on tickets;
create policy tickets_update on tickets for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy nachrichten_insert on ticket_nachrichten;
create policy nachrichten_insert on ticket_nachrichten for insert
  with check (
    exists (
      select 1 from tickets t
      where t.id = ticket_nachrichten.ticket_id
        and (
          current_user_rolle() = 'super_admin'
          or (t.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or hat_firmenzugriff(t.organisation_id, array['org_admin', 'techniker']::user_rolle[])
          or (t.kunde_id = auth.uid() and ticket_nachrichten.quelle <> 'intern')
        )
    )
  );

drop policy ticket_tags_select on ticket_tags;
create policy ticket_tags_select on ticket_tags for select
  using (
    exists (
      select 1 from tickets t
      where t.id = ticket_tags.ticket_id
        and (
          current_user_rolle() = 'super_admin'
          or t.organisation_id = current_user_org()
          or ist_firmenmitglied(t.organisation_id)
          or t.kunde_id = auth.uid()
        )
    )
  );

drop policy ticket_tags_insert on ticket_tags;
create policy ticket_tags_insert on ticket_tags for insert
  with check (
    exists (
      select 1 from tickets t
      where t.id = ticket_tags.ticket_id
        and (
          current_user_rolle() = 'super_admin'
          or t.organisation_id = current_user_org()
          or ist_firmenmitglied(t.organisation_id)
        )
    )
  );

drop policy ticket_tags_delete on ticket_tags;
create policy ticket_tags_delete on ticket_tags for delete
  using (
    exists (
      select 1 from tickets t
      where t.id = ticket_tags.ticket_id
        and (
          current_user_rolle() = 'super_admin'
          or t.organisation_id = current_user_org()
          or ist_firmenmitglied(t.organisation_id)
        )
    )
  );

drop policy anhaenge_select on anhaenge;
create policy anhaenge_select on anhaenge for select
  using (
    exists (
      select 1 from ticket_nachrichten n join tickets t on t.id = n.ticket_id
      where n.id = anhaenge.nachricht_id
        and (
          current_user_rolle() = 'super_admin'
          or (t.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or hat_firmenzugriff(t.organisation_id, array['org_admin', 'techniker']::user_rolle[])
          or (t.kunde_id = auth.uid() and n.quelle <> 'intern')
        )
    )
  );

drop policy anhaenge_insert on anhaenge;
create policy anhaenge_insert on anhaenge for insert
  with check (
    exists (
      select 1 from ticket_nachrichten n join tickets t on t.id = n.ticket_id
      where n.id = anhaenge.nachricht_id
        and (
          current_user_rolle() = 'super_admin'
          or (t.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or hat_firmenzugriff(t.organisation_id, array['org_admin', 'techniker']::user_rolle[])
          or (t.kunde_id = auth.uid())
        )
    )
  );

drop policy zeiteintraege_insert on zeiteintraege;
create policy zeiteintraege_insert on zeiteintraege for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy zeiteintraege_select on zeiteintraege;
create policy zeiteintraege_select on zeiteintraege for select
  using (
    current_user_rolle() = 'super_admin'
    or (current_user_rolle() in ('org_admin', 'techniker') and organisation_id = current_user_org())
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy zeiteintraege_update on zeiteintraege;
create policy zeiteintraege_update on zeiteintraege for update
  using (
    techniker_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy produkte_select on produkte;
create policy produkte_select on produkte for select
  using (
    ersteller_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy produkte_insert on produkte;
create policy produkte_insert on produkte for insert
  with check (
    ersteller_id = auth.uid()
    and (
      current_user_rolle() = 'super_admin'
      or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
      or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
    )
  );

drop policy produkte_update on produkte;
create policy produkte_update on produkte for update
  using (
    ersteller_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy produkte_delete on produkte;
create policy produkte_delete on produkte for delete
  using (
    ersteller_id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy admin_nachrichten_insert on admin_nachrichten;
create policy admin_nachrichten_insert on admin_nachrichten for insert
  with check (
    (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy admin_nachrichten_select on admin_nachrichten;
create policy admin_nachrichten_select on admin_nachrichten for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy rechnungsanpassungen_select on rechnungsanpassungen;
create policy rechnungsanpassungen_select on rechnungsanpassungen for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy rechnungsanpassungen_insert on rechnungsanpassungen;
create policy rechnungsanpassungen_insert on rechnungsanpassungen for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy rechnungsanpassungen_delete on rechnungsanpassungen;
create policy rechnungsanpassungen_delete on rechnungsanpassungen for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy kunden_dokumente_select on kunden_dokumente;
create policy kunden_dokumente_select on kunden_dokumente for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy kunden_dokumente_insert on kunden_dokumente;
create policy kunden_dokumente_insert on kunden_dokumente for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy kunden_dokumente_delete on kunden_dokumente;
create policy kunden_dokumente_delete on kunden_dokumente for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy vorlagen_select on vorlagen;
create policy vorlagen_select on vorlagen for select
  using (
    current_user_rolle() = 'super_admin'
    or organisation_id = current_user_org()
    or ist_firmenmitglied(organisation_id)
  );

drop policy vorlagen_insert on vorlagen;
create policy vorlagen_insert on vorlagen for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy vorlagen_delete on vorlagen;
create policy vorlagen_delete on vorlagen for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy makros_select on makros;
create policy makros_select on makros for select
  using (
    current_user_rolle() = 'super_admin'
    or organisation_id = current_user_org()
    or ist_firmenmitglied(organisation_id)
  );

drop policy makros_insert on makros;
create policy makros_insert on makros for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy makros_update on makros;
create policy makros_update on makros for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy makros_delete on makros;
create policy makros_delete on makros for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy tags_select on tags;
create policy tags_select on tags for select
  using (
    current_user_rolle() = 'super_admin'
    or organisation_id = current_user_org()
    or ist_firmenmitglied(organisation_id)
  );

drop policy tags_insert on tags;
create policy tags_insert on tags for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy tags_delete on tags;
create policy tags_delete on tags for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy sla_select on sla_konfiguration;
create policy sla_select on sla_konfiguration for select
  using (
    current_user_rolle() = 'super_admin'
    or organisation_id = current_user_org()
    or ist_firmenmitglied(organisation_id)
  );

drop policy sla_insert on sla_konfiguration;
create policy sla_insert on sla_konfiguration for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy sla_update on sla_konfiguration;
create policy sla_update on sla_konfiguration for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy faq_insert on faq_eintraege;
create policy faq_insert on faq_eintraege for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy faq_update on faq_eintraege;
create policy faq_update on faq_eintraege for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

drop policy faq_delete on faq_eintraege;
create policy faq_delete on faq_eintraege for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy api_keys_select on api_keys;
create policy api_keys_select on api_keys for select
  using (
    current_user_rolle() = 'super_admin'
    or organisation_id = current_user_org()
    or ist_firmenmitglied(organisation_id)
  );

drop policy api_keys_insert on api_keys;
create policy api_keys_insert on api_keys for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy api_keys_update on api_keys;
create policy api_keys_update on api_keys for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy api_keys_delete on api_keys;
create policy api_keys_delete on api_keys for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy webhooks_select on webhook_endpunkte;
create policy webhooks_select on webhook_endpunkte for select
  using (
    current_user_rolle() = 'super_admin'
    or organisation_id = current_user_org()
    or ist_firmenmitglied(organisation_id)
  );

drop policy webhooks_insert on webhook_endpunkte;
create policy webhooks_insert on webhook_endpunkte for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy webhooks_update on webhook_endpunkte;
create policy webhooks_update on webhook_endpunkte for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy webhooks_delete on webhook_endpunkte;
create policy webhooks_delete on webhook_endpunkte for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

drop policy organisationen_select on organisationen;
create policy organisationen_select on organisationen for select
  using (
    current_user_rolle() = 'super_admin'
    or id = current_user_org()
    or ist_firmenmitglied(id)
  );

drop policy organisationen_update on organisationen;
create policy organisationen_update on organisationen for update
  using (
    current_user_rolle() = 'super_admin'
    or (id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(id, array['org_admin']::user_rolle[])
  );

drop policy profiles_select on profiles;
create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or (organisation_id = current_user_org() and current_user_rolle() = 'kunde' and rolle in ('techniker', 'org_admin'))
    or exists (
      select 1 from firmen_mitgliedschaften vm
      where vm.profil_id = profiles.id
        and hat_firmenzugriff(vm.organisation_id, array['org_admin', 'techniker']::user_rolle[])
    )
  );

drop policy profiles_update on profiles;
create policy profiles_update on profiles for update
  using (
    id = auth.uid()
    or current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or exists (
      select 1 from firmen_mitgliedschaften vm
      where vm.profil_id = profiles.id
        and hat_firmenzugriff(vm.organisation_id, array['org_admin']::user_rolle[])
    )
  );

-- storage.objects (Bucket "anhaenge") - bisher ohne Rollenpruefung, nur
-- Firmenzugehoerigkeit, additiv um Mitgliedschaften erweitert.
drop policy anhaenge_select on storage.objects;
create policy anhaenge_select on storage.objects for select
  using (
    bucket_id = 'anhaenge'
    and exists (
      select 1 from tickets t
      where t.id::text = (storage.foldername(objects.name))[1]
        and (
          current_user_rolle() = 'super_admin'
          or t.organisation_id = current_user_org()
          or ist_firmenmitglied(t.organisation_id)
          or t.kunde_id = auth.uid()
        )
    )
  );

drop policy anhaenge_insert on storage.objects;
create policy anhaenge_insert on storage.objects for insert
  with check (
    bucket_id = 'anhaenge'
    and exists (
      select 1 from tickets t
      where t.id::text = (storage.foldername(objects.name))[1]
        and (
          current_user_rolle() = 'super_admin'
          or t.organisation_id = current_user_org()
          or ist_firmenmitglied(t.organisation_id)
          or t.kunde_id = auth.uid()
        )
    )
  );

-- ============================================================
-- 43. handle_new_user(): neu eingeladene Techniker/Org-Admins bekommen
-- direkt auch eine Mitgliedschaft fuer ihre erste Firma.
-- ============================================================
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (
    id, organisation_id, rolle, vorname, nachname, telefonnummer,
    strasse, hausnummer, plz, ort
  )
  values (
    new.id,
    (new.raw_user_meta_data->>'organisation_id')::uuid,
    coalesce((new.raw_user_meta_data->>'rolle')::public.user_rolle, 'kunde'),
    new.raw_user_meta_data->>'vorname',
    new.raw_user_meta_data->>'nachname',
    new.raw_user_meta_data->>'telefonnummer',
    new.raw_user_meta_data->>'strasse',
    new.raw_user_meta_data->>'hausnummer',
    new.raw_user_meta_data->>'plz',
    new.raw_user_meta_data->>'ort'
  );

  if (new.raw_user_meta_data->>'organisation_id') is not null
     and (new.raw_user_meta_data->>'rolle') in ('techniker', 'org_admin') then
    insert into public.firmen_mitgliedschaften (profil_id, organisation_id, rolle)
    values (
      new.id,
      (new.raw_user_meta_data->>'organisation_id')::uuid,
      (new.raw_user_meta_data->>'rolle')::public.user_rolle
    )
    on conflict (profil_id, organisation_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================
-- 44. Team-Liste liest jetzt aus firmen_mitgliedschaften statt aus dem
-- fixen profiles.organisation_id-Feld, damit Personen mit mehreren
-- Mitgliedschaften in jeder ihrer Firmen im Team auftauchen - mit der
-- fuer GENAU DIESE Firma geltenden Rolle und Aktiv/Deaktiviert-Status.
-- ============================================================
drop function get_team_mit_email(uuid);

create function get_team_mit_email(p_organisation_id uuid)
returns table(
  id uuid,
  mitgliedschaft_id uuid,
  email text,
  name text,
  vorname text,
  nachname text,
  avatar_url text,
  telefonnummer text,
  rolle text,
  verfuegbarkeit text,
  deaktiviert boolean
)
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select
    p.id,
    m.id as mitgliedschaft_id,
    u.email,
    p.name,
    p.vorname,
    p.nachname,
    p.avatar_url,
    p.telefonnummer,
    m.rolle::text,
    p.verfuegbarkeit::text,
    m.deaktiviert
  from firmen_mitgliedschaften m
  join profiles p on p.id = m.profil_id
  join auth.users u on u.id = p.id
  where m.organisation_id = p_organisation_id
  order by m.rolle, p.name;
$$;

grant execute on function get_team_mit_email(uuid) to authenticated;

-- ============================================================
-- 42. app_branding: Texte fuer die Login-Seite (Titel/Spruch), vom
-- Super-Admin aenderbar. Oeffentlich lesbar (select using true), da die
-- Login-Seite VOR der Anmeldung angezeigt wird und noch keine Session hat.
-- ============================================================
create table app_branding (
  id boolean primary key default true,
  login_titel text not null default 'Ticketsystem',
  login_spruch text not null default 'Anfragen ankommen lassen,
ohne dass etwas verloren geht.',
  check (id)
);
insert into app_branding (id) values (true);

alter table app_branding enable row level security;

create policy app_branding_select on app_branding for select
  using (true);

create policy app_branding_update on app_branding for update
  using (current_user_rolle() = 'super_admin')
  with check (current_user_rolle() = 'super_admin');

-- ============================================================
-- 43. SLA-Konfiguration + automatische Fristen/Eskalation
--
-- sla_konfiguration wurde in einer frueheren, hier nicht dokumentierten
-- Migration angelegt (nur ihre Policies waren bereits oben in Abschnitt
-- "additive RLS-Rewrite" vorhanden) - der Vollstaendigkeit halber jetzt
-- nachgetragen.
-- ============================================================
create table if not exists sla_konfiguration (
  organisation_id uuid primary key references organisationen(id),
  reaktionszeit_stunden integer default 4,
  loesungszeit_stunden integer default 24,
  aktiv boolean default true
);
alter table sla_konfiguration enable row level security;

-- reaktion_faellig_am/loesung_faellig_am/erste_antwort_am auf tickets
-- existierten bereits (fruehere, ebenfalls nicht dokumentierte Migration),
-- wurden aber nirgends befuellt - die SLA-Anzeige lief damit ins Leere.
-- Jetzt per Trigger tatsaechlich gesetzt + Eskalations-Flags ergaenzt.
alter table tickets
  add column if not exists reaktion_faellig_am timestamptz,
  add column if not exists loesung_faellig_am timestamptz,
  add column if not exists erste_antwort_am timestamptz,
  add column if not exists reaktion_eskaliert boolean not null default false,
  add column if not exists loesung_eskaliert boolean not null default false;

create or replace function tickets_set_sla_fristen() returns trigger as $$
declare
  v_sla sla_konfiguration%rowtype;
begin
  select * into v_sla from sla_konfiguration where organisation_id = new.organisation_id;
  if found and v_sla.aktiv then
    new.reaktion_faellig_am := new.erstellt_am + (v_sla.reaktionszeit_stunden || ' hours')::interval;
    new.loesung_faellig_am := new.erstellt_am + (v_sla.loesungszeit_stunden || ' hours')::interval;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_tickets_set_sla_fristen
  before insert on tickets
  for each row execute function tickets_set_sla_fristen();

-- Erste Reaktion = erste Nachricht, die NICHT vom Kunden stammt (weder
-- WhatsApp noch autor_id = kunde_id) - analog zur Erkennung in
-- set_kunden_nachricht_zeit(), nur umgekehrt.
create or replace function ticket_nachrichten_set_erste_antwort() returns trigger as $$
declare
  v_kunde_id uuid;
  v_reaktion_faellig timestamptz;
  v_bereits_beantwortet timestamptz;
begin
  select kunde_id, reaktion_faellig_am, erste_antwort_am
    into v_kunde_id, v_reaktion_faellig, v_bereits_beantwortet
  from tickets where id = new.ticket_id;

  if v_bereits_beantwortet is null
     and new.autor_id is not null
     and new.autor_id <> v_kunde_id
  then
    update tickets
    set erste_antwort_am = new.erstellt_am,
        reaktion_eskaliert = case
          when reaktion_eskaliert and v_reaktion_faellig is not null and new.erstellt_am <= v_reaktion_faellig
          then false else reaktion_eskaliert
        end
    where id = new.ticket_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_ticket_nachrichten_set_erste_antwort
  after insert on ticket_nachrichten
  for each row execute function ticket_nachrichten_set_erste_antwort();

-- Eskalation (Edge Function sla-eskalation-pruefen, siehe supabase/functions)
-- wird alle 15 Minuten per pg_cron ausgefuehrt - siehe Abschnitt "Cron-Jobs"
-- unten fuer den genauen Aufruf.

-- ============================================================
-- 44. Volltextsuche ueber Ticket-Nachrichten: echte Postgres-FTS statt
-- ILIKE '%...%' (wortweise, reihenfolge-unabhaengig, einfaches deutsches
-- Stemming, per GIN-Index performant).
-- ============================================================
alter table ticket_nachrichten
  add column if not exists inhalt_tsv tsvector
  generated always as (to_tsvector('german', coalesce(inhalt, ''))) stored;

create index if not exists idx_ticket_nachrichten_inhalt_tsv on ticket_nachrichten using gin (inhalt_tsv);

create or replace function ticket_ids_mit_nachricht(p_organisation_id uuid, p_begriff text)
returns setof uuid as $$
  select distinct t.id
  from tickets t
  join ticket_nachrichten n on n.ticket_id = t.id
  where t.organisation_id = p_organisation_id
    and n.inhalt_tsv @@ websearch_to_tsquery('german', p_begriff)
    and (
      current_user_rolle() = 'super_admin'
      or (t.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    );
$$ language sql stable security definer set search_path = public;

-- Analog, aber auf die eigenen Tickets des eingeloggten Kunden beschraenkt
-- (Suche im Kundenportal, MeineTickets.tsx).
create or replace function meine_ticket_ids_mit_nachricht(p_begriff text)
returns setof uuid as $$
  select distinct t.id
  from tickets t
  join ticket_nachrichten n on n.ticket_id = t.id
  where t.kunde_id = auth.uid()
    and n.inhalt_tsv @@ websearch_to_tsquery('german', p_begriff);
$$ language sql stable security definer set search_path = public;

grant execute on function meine_ticket_ids_mit_nachricht(text) to authenticated;

-- ============================================================
-- 45. Cron-Jobs (pg_cron + pg_net -> Edge Functions)
--
-- Beide Functions haben verify_jwt=false und pruefen stattdessen selbst
-- gegen ein Shared Secret aus Supabase Vault (Funktion get_cron_secret(),
-- siehe oben), weil pg_cron kein echtes Supabase-JWT mitschickt. Das
-- Secret wird bewusst NICHT im Klartext hier hinterlegt oder im
-- Function-Quellcode hartkodiert, da dieses Repo oeffentlich auf GitHub
-- liegt - es liegt einmalig in vault.secrets (siehe Abschnitt 43-Setup,
-- via vault.create_secret(...) angelegt) und wird sowohl vom Cron-Job
-- als auch von den Functions zur Laufzeit per SQL/RPC abgerufen.
--
-- WICHTIG: der urspruengliche auto-schliessen-Job schickte einen
-- Platzhalter-Bearer-Wert, der NICHT mit dem in der Function erwarteten
-- SUPABASE_SERVICE_ROLE_KEY uebereinstimmte UND die Function hatte
-- verify_jwt=true - das Gateway haette den Aufruf also schon vorher mit
-- 401 abgelehnt. Der Job lief seit Einfuehrung vermutlich nie durch.
-- Behoben durch: verify_jwt=false + Vergleich gegen das Vault-Secret.
--
-- select cron.schedule(
--   'auto-schliessen-taeglich',
--   '0 2 * * *',
--   $cron$
--   select net.http_post(
--     url := 'https://wfntgmavwzuldwjjhhlp.supabase.co/functions/v1/auto-schliessen',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $cron$
-- );
--
-- select cron.schedule(
--   'sla-eskalation-alle-15min',
--   '*/15 * * * *',
--   $cron$
--   select net.http_post(
--     url := 'https://wfntgmavwzuldwjjhhlp.supabase.co/functions/v1/sla-eskalation-pruefen',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $cron$
-- );
--
-- select cron.schedule(
--   'lizenz-erinnerung-taeglich',
--   '0 3 * * *',
--   $cron$
--   select net.http_post(
--     url := 'https://wfntgmavwzuldwjjhhlp.supabase.co/functions/v1/lizenz-erinnerung-pruefen',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $cron$
-- );
-- ============================================================

-- ============================================================
-- 46. get_cron_secret(): liefert das Shared Secret aus Vault an die
-- Edge Functions (per supabase.rpc(), mit Service-Role aufgerufen).
-- Nur service_role darf das ausfuehren.
-- ============================================================
create or replace function get_cron_secret() returns text as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret';
$$ language sql stable security definer set search_path = public, vault;

revoke all on function get_cron_secret() from public, anon, authenticated;
grant execute on function get_cron_secret() to service_role;

-- Einmaliges Setup (Secret-Wert wird bewusst nicht hier dokumentiert):
-- select vault.create_secret('<zufaelliger-wert>', 'cron_shared_secret', 'Shared Secret fuer pg_cron -> Edge Function Auth.');

-- ============================================================
-- 47. Automatischer Slug (und damit oeffentliche Landingpage
-- ?neukunde=<slug>) beim Anlegen einer Firma. Vorher blieb slug null,
-- bis ein Org-Admin ihn manuell in Verwaltung -> Firma eintrug - eine
-- neue Firma hatte also standardmaessig GAR KEINE Landingpage.
-- Bereits gesetzte Slugs (manuell oder spaeter geaendert) werden nicht
-- angetastet.
-- ============================================================
create or replace function organisationen_set_slug() returns trigger as $$
declare
  v_basis text;
  v_kandidat text;
  v_zaehler integer := 1;
begin
  if new.slug is not null then
    return new;
  end if;

  v_basis := lower(trim(new.name));
  v_basis := replace(replace(replace(replace(v_basis, 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss');
  v_basis := regexp_replace(v_basis, '[^a-z0-9]+', '-', 'g');
  v_basis := trim(both '-' from v_basis);
  if v_basis = '' then
    v_basis := 'firma';
  end if;

  v_kandidat := v_basis;
  while exists (select 1 from organisationen where slug = v_kandidat) loop
    v_zaehler := v_zaehler + 1;
    v_kandidat := v_basis || '-' || v_zaehler;
  end loop;

  new.slug := v_kandidat;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_organisationen_set_slug
  before insert on organisationen
  for each row execute function organisationen_set_slug();

-- ============================================================
-- 48. HowTo: einmalige Anwendungs-Anleitung beim ersten Login (danach
-- jederzeit ueber das "?"-Icon im Header abrufbar, siehe HowTo.tsx).
-- Inhalt ist rollenabhaengig fest im Code (intern vs. Kunde) - keine
-- eigene Verwaltungsoberflaeche noetig.
-- ============================================================
alter table profiles add column if not exists howto_gesehen boolean not null default false;

-- ============================================================
-- 49. Persoenlicher Standard-Status-Filter fuer die Ticketuebersicht
-- (z.B. "In Bearbeitung" statt immer "Offene"), vom Nutzer selbst per
-- "Als Standard speichern"-Button in TicketUebersicht.tsx waehlbar.
-- ============================================================
alter table profiles add column if not exists standard_ticket_filter text;
alter table profiles add constraint profiles_standard_ticket_filter_check
  check (standard_ticket_filter is null or standard_ticket_filter in (
    'alle', 'offene', 'offen', 'in_bearbeitung', 'wartet_auf_kunde', 'geloest', 'geschlossen'
  ));

-- ============================================================
-- 50. Fix: mehrere Frontend-Stellen (Ticket-Zuweisung in Neues-Ticket/
-- Ticket-Detail, Dashboard-Techniker-Stats, FirmenInfo-Team, MeinProfil-
-- Kollegenliste) fragten Techniker/Org-Admins weiterhin direkt ueber
-- profiles.organisation_id + rolle ab, statt ueber firmen_mitgliedschaften
-- (get_team_mit_email) - Mitarbeiter, die nur per Mehrfach-Mitgliedschaft
-- (nicht als Home-Firma) mit einer Firma verknuepft sind, fehlten dort
-- komplett. PlattformAbrechnung's Mitarbeiterzahl-Zaehlung (fuer die
-- Abrechnung!) hatte denselben Fehler und zaehlte firmen_mitgliedschaften
-- jetzt direkt statt profiles.
-- ============================================================

-- ============================================================
-- 51. App Secret der Meta-App pro Firma. Noetig, wenn in Meta die Option
-- "App-Secret-Proof fuer Server-API-Aufrufe erforderlich" aktiv ist -
-- dann muss jeder Graph-API-Aufruf zusaetzlich
--   appsecret_proof = HMAC-SHA256(access_token, app_secret)
-- mitschicken (siehe whatsapp-webhook + whatsapp-verbindung-testen).
-- ============================================================
alter table organisationen add column if not exists whatsapp_app_secret text;

-- ============================================================
-- 52. Todo-Liste pro Kunde (abhakbar)
-- ============================================================
create table kunden_todos (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  kunde_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  erledigt boolean not null default false,
  erledigt_am timestamptz,
  reihenfolge integer not null default 0,
  erstellt_am timestamptz default now()
);
create index idx_kunden_todos_kunde on kunden_todos(kunde_id);
alter table kunden_todos enable row level security;

create policy kunden_todos_select on kunden_todos for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy kunden_todos_insert on kunden_todos for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy kunden_todos_update on kunden_todos for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy kunden_todos_delete on kunden_todos for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

-- ============================================================
-- 53. Dongles/Lizenzen pro Kunde (Seriennummer, Software,
-- Wartungsvertrag, Ticket-Freiminuten/Monat). kunde_id nullable =
-- "nicht zugeordnet"-Pool (z.B. frisch importierte Dongles, deren
-- Kunde noch nicht per Klick zugewiesen wurde).
-- ============================================================
create table kunden_dongles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  kunde_id uuid references profiles(id) on delete set null,
  seriennummer text not null,
  software text not null default 'exocad',
  wartungsvertrag text not null default 'nicht_gewuenscht'
    check (wartungsvertrag in ('aktiv', 'inaktiv', 'nicht_gewuenscht')),
  freiminuten_pro_monat integer not null default 0,
  gruppe text,
  liefer_datum date,
  notiz text,
  erstellt_am timestamptz default now(),
  unique (organisation_id, seriennummer)
);
create index idx_kunden_dongles_kunde on kunden_dongles(kunde_id);
create index idx_kunden_dongles_org on kunden_dongles(organisation_id);
alter table kunden_dongles enable row level security;

create policy kunden_dongles_select on kunden_dongles for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy kunden_dongles_insert on kunden_dongles for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy kunden_dongles_update on kunden_dongles for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy kunden_dongles_delete on kunden_dongles for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

-- ============================================================
-- 54. Software-Module pro Dongle (rein visuell aktiv/inaktiv, um
-- festzuhalten was der Kunde tatsaechlich gekauft/aktiviert hat).
-- Keine eigene organisation_id -> Absicherung ueber den Dongle.
-- ============================================================
create table dongle_module (
  id uuid primary key default gen_random_uuid(),
  dongle_id uuid not null references kunden_dongles(id) on delete cascade,
  name text not null,
  aktiv boolean not null default true,
  activation_key text,
  article_number text,
  liefer_datum date,
  erstellt_am timestamptz default now(),
  unique (dongle_id, name)
);
create index idx_dongle_module_dongle on dongle_module(dongle_id);
alter table dongle_module enable row level security;

create policy dongle_module_select on dongle_module for select
  using (
    exists (
      select 1 from kunden_dongles d
      where d.id = dongle_module.dongle_id
        and (
          current_user_rolle() = 'super_admin'
          or (d.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or hat_firmenzugriff(d.organisation_id, array['org_admin', 'techniker']::user_rolle[])
        )
    )
  );

create policy dongle_module_insert on dongle_module for insert
  with check (
    exists (
      select 1 from kunden_dongles d
      where d.id = dongle_module.dongle_id
        and (
          current_user_rolle() = 'super_admin'
          or (d.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or hat_firmenzugriff(d.organisation_id, array['org_admin', 'techniker']::user_rolle[])
        )
    )
  );

create policy dongle_module_update on dongle_module for update
  using (
    exists (
      select 1 from kunden_dongles d
      where d.id = dongle_module.dongle_id
        and (
          current_user_rolle() = 'super_admin'
          or (d.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or hat_firmenzugriff(d.organisation_id, array['org_admin', 'techniker']::user_rolle[])
        )
    )
  );

create policy dongle_module_delete on dongle_module for delete
  using (
    exists (
      select 1 from kunden_dongles d
      where d.id = dongle_module.dongle_id
        and (
          current_user_rolle() = 'super_admin'
          or (d.organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
          or hat_firmenzugriff(d.organisation_id, array['org_admin', 'techniker']::user_rolle[])
        )
    )
  );

-- ============================================================
-- 55. Optionale Dongle-Zuordnung bei Ticketerstellung (kein Pflichtfeld).
-- dongle_id ist nur ein informativer Hinweis, kein Pflichtfeld -> beim
-- Loeschen eines Dongles soll das Ticket erhalten bleiben und nur den
-- Link verlieren (ON DELETE SET NULL), statt das Loeschen zu blockieren.
-- Fix (urspruenglich ohne ON DELETE angelegt, dadurch NO ACTION-Default -
-- Dongle-Loeschung schlug fehl sobald ein Ticket ihn referenzierte, ohne
-- dass das Frontend den Fehler anzeigte):
-- ============================================================
alter table tickets add column if not exists dongle_id uuid references kunden_dongles(id);
alter table tickets drop constraint if exists tickets_dongle_id_fkey;
alter table tickets add constraint tickets_dongle_id_fkey
  foreign key (dongle_id) references kunden_dongles(id) on delete set null;

-- ============================================================
-- 56. Lizenzvertraege (2. exocad-Exportformat: Vertragslaufzeit/
-- Ablaufdatum, eigenstaendiger Identifikator, ueberschneidet sich
-- NICHT mit kunden_dongles.seriennummer). kunde_id nullable = "nicht
-- zugeordnet"-Pool wie bei kunden_dongles. dongle_id optional, falls
-- der Admin manuell weiss welcher physische Dongle gemeint ist.
-- ============================================================
create table lizenz_vertraege (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisationen(id),
  kunde_id uuid references profiles(id) on delete set null,
  dongle_id uuid references kunden_dongles(id) on delete set null,
  lizenz_seriennummer text not null,
  produkt_name text not null,
  lizenz_typ text,
  vertrag_start date,
  vertrag_ende date,
  aktiviert_am date,
  status text,
  frei_zeitraum_ende date,
  lizenz_attribut text,
  erinnerung_gesendet_am timestamptz,
  erstellt_am timestamptz default now(),
  unique (organisation_id, lizenz_seriennummer)
);
create index idx_lizenz_vertraege_kunde on lizenz_vertraege(kunde_id);
create index idx_lizenz_vertraege_org on lizenz_vertraege(organisation_id);
create index idx_lizenz_vertraege_ende on lizenz_vertraege(vertrag_ende);
alter table lizenz_vertraege enable row level security;

create policy lizenz_vertraege_select on lizenz_vertraege for select
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy lizenz_vertraege_insert on lizenz_vertraege for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy lizenz_vertraege_update on lizenz_vertraege for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

create policy lizenz_vertraege_delete on lizenz_vertraege for delete
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() in ('org_admin', 'techniker'))
    or hat_firmenzugriff(organisation_id, array['org_admin', 'techniker']::user_rolle[])
  );

-- ============================================================
-- 57. Konfigurierbare Frist fuer die Lizenz-Ablauf-Erinnerung
-- (Muster: sla_konfiguration - eine Zeile pro Organisation).
-- ============================================================
create table lizenz_konfiguration (
  organisation_id uuid primary key references organisationen(id),
  erinnerung_tage_vorher integer not null default 30
);
alter table lizenz_konfiguration enable row level security;

create policy lizenz_konfiguration_select on lizenz_konfiguration for select
  using (
    current_user_rolle() = 'super_admin'
    or organisation_id = current_user_org()
    or ist_firmenmitglied(organisation_id)
  );

create policy lizenz_konfiguration_insert on lizenz_konfiguration for insert
  with check (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );

create policy lizenz_konfiguration_update on lizenz_konfiguration for update
  using (
    current_user_rolle() = 'super_admin'
    or (organisation_id = current_user_org() and current_user_rolle() = 'org_admin')
    or hat_firmenzugriff(organisation_id, array['org_admin']::user_rolle[])
  );
