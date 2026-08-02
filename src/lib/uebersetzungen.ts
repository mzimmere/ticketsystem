import type { Sprache } from "./SpracheContext";

// Uebersetzungswoerterbuch, aufgebaut als typisiertes Objekt (kein
// String-Key-Lookup) - Tippfehler in Uebersetzungs-Keys fallen so schon beim
// Bauen (tsc) auf statt erst zur Laufzeit. Bewusst nach Screen gruppiert
// statt eine riesige flache Liste, damit man beim Uebersetzen eines
// einzelnen Screens nur den jeweiligen Abschnitt braucht.
//
// Deckt bisher nur die wichtigsten/meistgenutzten Screens ab (Login,
// Startseite, Kunden-Portal, Status-Badges) - der Rest der App bleibt
// vorerst Deutsch und wird schrittweise ergaenzt.

export type Status = "offen" | "in_bearbeitung" | "wartet_auf_kunde" | "geloest" | "geschlossen";

export interface Uebersetzung {
  status: Record<Status, string>;
  login: {
    ladenStatusDatenbank: string;
    ladenStatusAuth: string;
    ladenStatusWhatsapp: string;
    zustandOnline: string;
    zustandVorbereitet: string;
    passwortFestlegen: string;
    anmelden: string;
    letzterSchritt: string;
    schoenDassDuDaBist: string;
    email: string;
    passwort: string;
    neuesPasswort: string;
    passwortSpeichernWeiter: string;
    fehlerLogin: string;
    fehlerMindestZeichen: string;
    fehlerPasswortSetzen: string;
    passwortVergessenLink: string;
    passwortVergessenTitel: string;
    passwortVergessenText: string;
    linkGesendetText: string;
    fehlerEmailErforderlich: string;
    sendet: string;
    linkSenden: string;
    zurueckZumLogin: string;
  };
  startseite: {
    gutenMorgen: string;
    gutenTag: string;
    gutenAbend: string;
    allesAufEinenBlick: string;
    hilfeFrage: string;
    offeneTickets: string;
    mirZugewiesen: string;
    wartetAufAntwort: string;
    slaVerletzt: string;
    neueAnfrageStellen: string;
    neueAnfrageSub: string;
    meineAnfragen: string;
    meineAnfragenSub: string;
    warenAnfragen: string;
    wartetAufMich: string;
    schnellzugriff: string;
    neuesTicketIntern: string;
    neuesTicketInternSub: string;
    alleTickets: string;
    alleTicketsSub: string;
    dashboard: string;
    dashboardSubAlleFirmen: string;
    dashboardSubKpi: string;
    abrechnung: string;
    abrechnungSub: string;
    team: string;
    teamSub: string;
    kunden: string;
    kundenSub: string;
    firmenprofil: string;
    firmenprofilSub: string;
    werkzeuge: string;
    werkzeugeSub: string;
    integrationen: string;
    integrationenSub: string;
    ueberUns: string;
    ueberUnsSub: string;
    ticketWartetEinzahl: string;
    ticketsWartenMehrzahl: string;
    aufAntwortVomKunden: string;
    zurTicketuebersicht: string;
  };
  neuesTicket: {
    titelUeberschrift: string;
    vorlageVerwenden: string;
    vorlageAuswaehlen: string;
    vorlageHinweis: string;
    titelLabel: string;
    titelPlatzhalter: string;
    beschreibungLabel: string;
    beschreibungPlatzhalter: string;
    prioritaetLabel: string;
    prioritaetNiedrig: string;
    prioritaetMittel: string;
    prioritaetHoch: string;
    prioritaetKritisch: string;
    anhaengeLabel: string;
    anhaengeAuswaehlen: string;
    fehlerTitel: string;
    fehlerAllgemein: string;
    wirdGesendet: string;
    absenden: string;
  };
  meinTicketDetail: {
    bearbeitetVon: string;
    antwortPlatzhalter: string;
    senden: string;
    wirdGesendet: string;
    ticketSchliessen: string;
    anhangFallback: string;
    anhangFehler: string;
    statusWartetAufDich: string;
  };
  csat: {
    frage: string;
    ja: string;
    nein: string;
    bereitsBewertetJa: string;
    bereitsBewertetNein: string;
    danke: string;
  };
  meinProfil: {
    titel: string;
    bildAendern: string;
    verfuegbarkeit: string;
    verfuegbar: string;
    abwesend: string;
    urlaub: string;
    passwortAendern: string;
    neuesPasswort: string;
    passwortWiederholen: string;
    fehlerMindestZeichen: string;
    fehlerPasswoerterUngleich: string;
    fehlerPasswortAendern: string;
    erfolgPasswortGeaendert: string;
    aendert: string;
    offeneTicketsUebergeben: string;
    uebergabeBeschreibung: string;
    kollegeWaehlen: string;
    unbenannt: string;
    uebergeben: string;
    meineKontaktdaten: string;
    vornameLabel: string;
    nachnameLabel: string;
    telefonLabel: string;
    strassePlatzhalter: string;
    nrPlatzhalter: string;
    plzPlatzhalter: string;
    ortPlatzhalter: string;
    speichert: string;
    speichern: string;
    fehlerVornameErforderlich: string;
    fehlerSpeichern: string;
    erfolgProfilGespeichert: string;
    erfolgBildAktualisiert: string;
    fehlerHochladen: string;
    fehlerUebergabeFehlgeschlagen: string;
    ticketUebertragen: string;
    meineNutzung: string;
    nutzungLeer: string;
    minutenKuerzel: string;
  };
  dashboard: {
    titel: string;
    tage: string;
    laedt: string;
    ticketsGesamt: string;
    offenAktiv: string;
    kundenzufriedenheit: string;
    bewertungen: string;
    nochKeineBewertungen: string;
    slaEinhaltung: string;
    ticketsMitSla: string;
    keineSlaKonfiguriert: string;
    statusVerteilung: string;
    ticketVolumen: string;
    neu: string;
    reaktionszeitTrend: string;
    teamAuslastung: string;
    techniker: string;
    geloestZeitraum: string;
    oReaktion: string;
    unbenannt: string;
    csatTitel: string;
    positiv: string;
    negativ: string;
    zufriedenheit: string;
  };
}

const de: Uebersetzung = {
  status: {
    offen: "Offen",
    in_bearbeitung: "In Bearbeitung",
    wartet_auf_kunde: "Wartet auf Kunde",
    geloest: "Gelöst",
    geschlossen: "Geschlossen",
  },
  login: {
    ladenStatusDatenbank: "Datenbank",
    ladenStatusAuth: "Authentifizierung",
    ladenStatusWhatsapp: "WhatsApp-Anbindung",
    zustandOnline: "online",
    zustandVorbereitet: "vorbereitet",
    passwortFestlegen: "Passwort festlegen",
    anmelden: "Anmelden",
    letzterSchritt: "Letzter Schritt, dann bist du drin.",
    schoenDassDuDaBist: "Schön, dass du da bist.",
    email: "E-Mail",
    passwort: "Passwort",
    neuesPasswort: "Neues Passwort",
    passwortSpeichernWeiter: "Passwort speichern & weiter",
    fehlerLogin: "E-Mail oder Passwort stimmt nicht.",
    fehlerMindestZeichen: "Mindestens 8 Zeichen.",
    fehlerPasswortSetzen: "Konnte das Passwort nicht setzen. Bitte Link erneut anfordern.",
    passwortVergessenLink: "Passwort vergessen?",
    passwortVergessenTitel: "Passwort vergessen",
    passwortVergessenText: "Wir schicken dir einen Link zum Zurücksetzen.",
    linkGesendetText: "Falls ein Konto mit dieser Adresse existiert, wurde ein Link zum Zurücksetzen verschickt.",
    fehlerEmailErforderlich: "Bitte E-Mail-Adresse eingeben.",
    sendet: "Sendet…",
    linkSenden: "Link senden",
    zurueckZumLogin: "← Zurück zum Login",
  },
  startseite: {
    gutenMorgen: "Guten Morgen",
    gutenTag: "Guten Tag",
    gutenAbend: "Guten Abend",
    allesAufEinenBlick: "Hier findest du alles auf einen Blick.",
    hilfeFrage: "Wie können wir dir heute helfen?",
    offeneTickets: "Offene Tickets",
    mirZugewiesen: "Mir zugewiesen",
    wartetAufAntwort: "Wartet auf Antwort",
    slaVerletzt: "SLA verletzt",
    neueAnfrageStellen: "Neue Anfrage stellen",
    neueAnfrageSub: "Beschreibe dein Anliegen – wir melden uns",
    meineAnfragen: "Meine Anfragen",
    meineAnfragenSub: "Status und Verlauf aller deiner Tickets",
    warenAnfragen: "Meine Anfragen",
    wartetAufMich: "Warten auf mich",
    schnellzugriff: "Schnellzugriff",
    neuesTicketIntern: "Neues Ticket",
    neuesTicketInternSub: "Ticket direkt anlegen",
    alleTickets: "Alle Tickets",
    alleTicketsSub: "Übersicht, Suche und Filter",
    dashboard: "Dashboard",
    dashboardSubAlleFirmen: "Alle Firmen im Überblick",
    dashboardSubKpi: "Auswertungen & KPIs",
    abrechnung: "Abrechnung",
    abrechnungSub: "Rechnungen & Zeiterfassung",
    team: "Team",
    teamSub: "Mitarbeiter & Techniker",
    kunden: "Kunden",
    kundenSub: "Kundenstamm verwalten",
    firmenprofil: "Firmenprofil",
    firmenprofilSub: "Einstellungen & Branding",
    werkzeuge: "Werkzeuge",
    werkzeugeSub: "Makros, Tags, SLA, FAQ",
    integrationen: "Integrationen",
    integrationenSub: "E-Mail, WhatsApp",
    ueberUns: "Über uns",
    ueberUnsSub: "Kontakt & Öffnungszeiten",
    ticketWartetEinzahl: "Ticket wartet",
    ticketsWartenMehrzahl: "Tickets warten",
    aufAntwortVomKunden: "auf eine Antwort vom Kunden",
    zurTicketuebersicht: "Zur Ticketübersicht →",
  },
  neuesTicket: {
    titelUeberschrift: "Neue Anfrage",
    vorlageVerwenden: "Vorlage verwenden (optional)",
    vorlageAuswaehlen: "📋 Vorlage auswählen…",
    vorlageHinweis: "Füllt das Formular vor – bleibt danach bearbeitbar.",
    titelLabel: "Titel",
    titelPlatzhalter: 'Kurz zusammengefasst, z.B. "Drucker im Büro offline"',
    beschreibungLabel: "Beschreibung",
    beschreibungPlatzhalter: "Was genau ist das Problem?",
    prioritaetLabel: "Priorität",
    prioritaetNiedrig: "Niedrig",
    prioritaetMittel: "Mittel",
    prioritaetHoch: "Hoch",
    prioritaetKritisch: "Kritisch",
    anhaengeLabel: "Anhänge (Screenshots, Dokumente)",
    anhaengeAuswaehlen: "Anhänge auswählen",
    fehlerTitel: "Bitte einen Titel angeben.",
    fehlerAllgemein: "Da ist etwas schiefgelaufen. Bitte nochmal versuchen.",
    wirdGesendet: "Wird gesendet…",
    absenden: "Anfrage absenden",
  },
  meinTicketDetail: {
    bearbeitetVon: "Bearbeitet von",
    antwortPlatzhalter: "Antworten…",
    senden: "Senden",
    wirdGesendet: "Wird gesendet…",
    ticketSchliessen: "Für mich erledigt – Ticket schließen",
    anhangFallback: "Anhang",
    anhangFehler: "Mindestens ein Anhang konnte nicht gespeichert werden. Details siehe Browser-Konsole (F12).",
    statusWartetAufDich: "Wartet auf dich",
  },
  csat: {
    frage: "War diese Hilfe nützlich?",
    ja: "Ja, danke",
    nein: "Nicht wirklich",
    bereitsBewertetJa: "Du hast dieses Ticket bewertet: 👍 Hilfreich – Danke!",
    bereitsBewertetNein: "Du hast dieses Ticket bewertet: 👎 Nicht hilfreich – Danke!",
    danke: "Danke für dein Feedback! 🙏",
  },
  meinProfil: {
    titel: "Mein Profil",
    bildAendern: "Bild ändern",
    verfuegbarkeit: "Verfügbarkeit",
    verfuegbar: "Verfügbar",
    abwesend: "Abwesend",
    urlaub: "Urlaub",
    passwortAendern: "Passwort ändern",
    neuesPasswort: "Neues Passwort",
    passwortWiederholen: "Passwort wiederholen",
    fehlerMindestZeichen: "Mindestens 8 Zeichen.",
    fehlerPasswoerterUngleich: "Passwörter stimmen nicht überein.",
    fehlerPasswortAendern: "Passwort konnte nicht geändert werden.",
    erfolgPasswortGeaendert: "Passwort geändert.",
    aendert: "Ändert…",
    offeneTicketsUebergeben: "Offene Tickets übergeben",
    uebergabeBeschreibung: "Übergibt alle dir zugewiesenen, noch offenen Tickets an eine Kollegin/einen Kollegen – z.B. bei Urlaub oder Abwesenheit.",
    kollegeWaehlen: "Kollege wählen…",
    unbenannt: "Unbenannt",
    uebergeben: "Übergeben",
    meineKontaktdaten: "Meine Kontaktdaten",
    vornameLabel: "Vorname *",
    nachnameLabel: "Nachname",
    telefonLabel: "Telefon / WhatsApp",
    strassePlatzhalter: "Straße",
    nrPlatzhalter: "Nr.",
    plzPlatzhalter: "PLZ",
    ortPlatzhalter: "Ort",
    speichert: "Speichert…",
    speichern: "Speichern",
    fehlerVornameErforderlich: "Vorname ist erforderlich.",
    fehlerSpeichern: "Fehler beim Speichern.",
    erfolgProfilGespeichert: "Profil gespeichert.",
    erfolgBildAktualisiert: "Profilbild aktualisiert.",
    fehlerHochladen: "Hochladen fehlgeschlagen.",
    fehlerUebergabeFehlgeschlagen: "Übergabe fehlgeschlagen.",
    ticketUebertragen: "Ticket(s) übertragen.",
    meineNutzung: "Meine Nutzung",
    nutzungLeer: "Noch keine erfasste Zeit – hier siehst du, sobald Arbeit an deinen Tickets erfasst wurde, wie viele Minuten und Kosten das pro Monat ausmacht.",
    minutenKuerzel: "Min.",
  },
  dashboard: {
    titel: "Dashboard",
    tage: "Tage",
    laedt: "Lädt…",
    ticketsGesamt: "Tickets gesamt",
    offenAktiv: "Offen / aktiv",
    kundenzufriedenheit: "Kundenzufriedenheit",
    bewertungen: "Bewertungen",
    nochKeineBewertungen: "Noch keine Bewertungen",
    slaEinhaltung: "SLA-Einhaltung",
    ticketsMitSla: "Tickets mit SLA",
    keineSlaKonfiguriert: "Keine SLA konfiguriert",
    statusVerteilung: "Status-Verteilung",
    ticketVolumen: "Ticket-Volumen",
    neu: "Neu",
    reaktionszeitTrend: "Ø Reaktionszeit (Minuten)",
    teamAuslastung: "Team-Auslastung",
    techniker: "Techniker",
    geloestZeitraum: "Gelöst",
    oReaktion: "Ø Reaktion",
    unbenannt: "Unbenannt",
    csatTitel: "Kundenzufriedenheit (CSAT)",
    positiv: "Positiv",
    negativ: "Negativ",
    zufriedenheit: "Zufriedenheit",
  },
};

const en: Uebersetzung = {
  status: {
    offen: "Open",
    in_bearbeitung: "In progress",
    wartet_auf_kunde: "Waiting for customer",
    geloest: "Resolved",
    geschlossen: "Closed",
  },
  login: {
    ladenStatusDatenbank: "Database",
    ladenStatusAuth: "Authentication",
    ladenStatusWhatsapp: "WhatsApp integration",
    zustandOnline: "online",
    zustandVorbereitet: "ready",
    passwortFestlegen: "Set password",
    anmelden: "Sign in",
    letzterSchritt: "Last step, then you're in.",
    schoenDassDuDaBist: "Great to have you here.",
    email: "Email",
    passwort: "Password",
    neuesPasswort: "New password",
    passwortSpeichernWeiter: "Save password & continue",
    fehlerLogin: "Email or password is incorrect.",
    fehlerMindestZeichen: "At least 8 characters.",
    fehlerPasswortSetzen: "Could not set the password. Please request a new link.",
    passwortVergessenLink: "Forgot password?",
    passwortVergessenTitel: "Forgot password",
    passwortVergessenText: "We'll send you a reset link.",
    linkGesendetText: "If an account with this address exists, a reset link has been sent.",
    fehlerEmailErforderlich: "Please enter an email address.",
    sendet: "Sending…",
    linkSenden: "Send link",
    zurueckZumLogin: "← Back to login",
  },
  startseite: {
    gutenMorgen: "Good morning",
    gutenTag: "Good afternoon",
    gutenAbend: "Good evening",
    allesAufEinenBlick: "Here's everything at a glance.",
    hilfeFrage: "How can we help you today?",
    offeneTickets: "Open tickets",
    mirZugewiesen: "Assigned to me",
    wartetAufAntwort: "Waiting for reply",
    slaVerletzt: "SLA breached",
    neueAnfrageStellen: "Submit new request",
    neueAnfrageSub: "Describe your issue – we'll get back to you",
    meineAnfragen: "My requests",
    meineAnfragenSub: "Status and history of all your tickets",
    warenAnfragen: "My requests",
    wartetAufMich: "Waiting on me",
    schnellzugriff: "Quick access",
    neuesTicketIntern: "New ticket",
    neuesTicketInternSub: "Create a ticket directly",
    alleTickets: "All tickets",
    alleTicketsSub: "Overview, search and filters",
    dashboard: "Dashboard",
    dashboardSubAlleFirmen: "Overview of all companies",
    dashboardSubKpi: "Analytics & KPIs",
    abrechnung: "Billing",
    abrechnungSub: "Invoices & time tracking",
    team: "Team",
    teamSub: "Staff & technicians",
    kunden: "Customers",
    kundenSub: "Manage customer records",
    firmenprofil: "Company profile",
    firmenprofilSub: "Settings & branding",
    werkzeuge: "Tools",
    werkzeugeSub: "Macros, tags, SLA, FAQ",
    integrationen: "Integrations",
    integrationenSub: "Email, WhatsApp",
    ueberUns: "About us",
    ueberUnsSub: "Contact & opening hours",
    ticketWartetEinzahl: "ticket is",
    ticketsWartenMehrzahl: "tickets are",
    aufAntwortVomKunden: "waiting for a reply from the customer",
    zurTicketuebersicht: "Go to ticket overview →",
  },
  neuesTicket: {
    titelUeberschrift: "New request",
    vorlageVerwenden: "Use template (optional)",
    vorlageAuswaehlen: "📋 Select template…",
    vorlageHinweis: "Pre-fills the form – stays editable afterwards.",
    titelLabel: "Title",
    titelPlatzhalter: 'Short summary, e.g. "Printer in the office offline"',
    beschreibungLabel: "Description",
    beschreibungPlatzhalter: "What exactly is the problem?",
    prioritaetLabel: "Priority",
    prioritaetNiedrig: "Low",
    prioritaetMittel: "Medium",
    prioritaetHoch: "High",
    prioritaetKritisch: "Critical",
    anhaengeLabel: "Attachments (screenshots, documents)",
    anhaengeAuswaehlen: "Select attachments",
    fehlerTitel: "Please enter a title.",
    fehlerAllgemein: "Something went wrong. Please try again.",
    wirdGesendet: "Sending…",
    absenden: "Submit request",
  },
  meinTicketDetail: {
    bearbeitetVon: "Handled by",
    antwortPlatzhalter: "Reply…",
    senden: "Send",
    wirdGesendet: "Sending…",
    ticketSchliessen: "Resolved for me – close ticket",
    anhangFallback: "Attachment",
    anhangFehler: "At least one attachment could not be saved. See browser console (F12) for details.",
    statusWartetAufDich: "Waiting for you",
  },
  csat: {
    frage: "Was this helpful?",
    ja: "Yes, thanks",
    nein: "Not really",
    bereitsBewertetJa: "You've rated this ticket: 👍 Helpful – thank you!",
    bereitsBewertetNein: "You've rated this ticket: 👎 Not helpful – thank you!",
    danke: "Thanks for your feedback! 🙏",
  },
  meinProfil: {
    titel: "My Profile",
    bildAendern: "Change picture",
    verfuegbarkeit: "Availability",
    verfuegbar: "Available",
    abwesend: "Away",
    urlaub: "On vacation",
    passwortAendern: "Change password",
    neuesPasswort: "New password",
    passwortWiederholen: "Repeat password",
    fehlerMindestZeichen: "At least 8 characters.",
    fehlerPasswoerterUngleich: "Passwords don't match.",
    fehlerPasswortAendern: "Could not change the password.",
    erfolgPasswortGeaendert: "Password changed.",
    aendert: "Changing…",
    offeneTicketsUebergeben: "Hand over open tickets",
    uebergabeBeschreibung: "Transfers all open tickets assigned to you to a colleague – e.g. during vacation or absence.",
    kollegeWaehlen: "Select colleague…",
    unbenannt: "Unnamed",
    uebergeben: "Hand over",
    meineKontaktdaten: "My contact details",
    vornameLabel: "First name *",
    nachnameLabel: "Last name",
    telefonLabel: "Phone / WhatsApp",
    strassePlatzhalter: "Street",
    nrPlatzhalter: "No.",
    plzPlatzhalter: "ZIP",
    ortPlatzhalter: "City",
    speichert: "Saving…",
    speichern: "Save",
    fehlerVornameErforderlich: "First name is required.",
    fehlerSpeichern: "Error saving.",
    erfolgProfilGespeichert: "Profile saved.",
    erfolgBildAktualisiert: "Profile picture updated.",
    fehlerHochladen: "Upload failed.",
    fehlerUebergabeFehlgeschlagen: "Transfer failed.",
    ticketUebertragen: "ticket(s) transferred.",
    meineNutzung: "My usage",
    nutzungLeer: "No time tracked yet – as soon as work on your tickets is logged, you'll see how many minutes and costs that adds up to per month.",
    minutenKuerzel: "min.",
  },
  dashboard: {
    titel: "Dashboard",
    tage: "days",
    laedt: "Loading…",
    ticketsGesamt: "Total tickets",
    offenAktiv: "Open / active",
    kundenzufriedenheit: "Customer satisfaction",
    bewertungen: "ratings",
    nochKeineBewertungen: "No ratings yet",
    slaEinhaltung: "SLA compliance",
    ticketsMitSla: "tickets with SLA",
    keineSlaKonfiguriert: "No SLA configured",
    statusVerteilung: "Status distribution",
    ticketVolumen: "Ticket volume",
    neu: "New",
    reaktionszeitTrend: "Avg. response time (minutes)",
    teamAuslastung: "Team workload",
    techniker: "Technician",
    geloestZeitraum: "Resolved",
    oReaktion: "Avg. response",
    unbenannt: "Unnamed",
    csatTitel: "Customer satisfaction (CSAT)",
    positiv: "Positive",
    negativ: "Negative",
    zufriedenheit: "satisfaction",
  },
};

const WOERTERBUCH: Record<Sprache, Uebersetzung> = { de, en };

export function texte(sprache: Sprache): Uebersetzung {
  return WOERTERBUCH[sprache];
}
