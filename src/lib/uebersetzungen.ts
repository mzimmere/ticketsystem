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

export type Prioritaet = "niedrig" | "mittel" | "hoch" | "kritisch";

export interface Uebersetzung {
  status: Record<Status, string>;
  prioritaet: Record<Prioritaet, string>;
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
  ticketUebersicht: {
    alleKunden: string;
    unbenannt: string;
    kundeSuchen: string;
    keineTreffer: string;
    tickets: string;
    eintragEinzahl: string;
    eintragMehrzahl: string;
    neuesTicketAnlegen: string;
    suchePlatzhalter: string;
    nurMeine: string;
    slaVerletzt: string;
    offene: string;
    alleStatus: string;
    alsStandardTitle: string;
    standardMarkiert: string;
    alsStandard: string;
    allePrioritaeten: string;
    waehleFirmaHinweis: string;
    keineTrefferTitel: string;
    keineOffenenTickets: string;
    keinTicketEnthaelt: string;
    keinTicketMitTag: string;
    allesErledigt: string;
    spalteNr: string;
    spalteBetreffKunde: string;
    spalteStatus: string;
    spalteZeit: string;
    neueNachrichtVomKunden: string;
    unbekannterKunde: string;
  };
  ticketDetail: {
    laedt: string;
    betrachterBannerSuffix: string;
    unbekannterKunde: string;
    telefonKopierenTitle: string;
    emailKopierenTitle: string;
    nichtZugewiesen: string;
    unbenannt: string;
    urlaub: string;
    abwesend: string;
    keinDongleZugeordnet: string;
    dongleTitle: string;
    reaktionLabel: string;
    ueberfaellig: string;
    loesungLabel: string;
    tagButton: string;
    betrachterSchautEinzahl: string;
    betrachterSchautMehrzahl: string;
    betrachterWarnungSuffix: string;
    verlauf: string;
    technikerFallback: string;
    kundeWhatsapp: string;
    kunde: string;
    anhangFallback: string;
    makroEinfuegen: string;
    aufnahmeLaeuft: string;
    diktieren: string;
    spracheingabeNichtMoeglich: string;
    notizPlatzhalter: string;
    fuerKundenSichtbar: string;
    wirdGesendet: string;
    senden: string;
    todoListeKunde: string;
    hardwareKunde: string;
    anhangFehler: string;
    minutenErfasstSuffix: string;
    manuellSuffix: string;
  };
  abrechnung: {
    titel: string;
    drucken: string;
    laedt: string;
    keineDaten: string;
    monatsuebersicht: string;
    spalteKunde: string;
    spalteMin: string;
    spalteNetto: string;
    spalteMwst: string;
    spalteBrutto: string;
    gesamt: string;
    alsCsvExportieren: string;
    unbenannt: string;
    csvHeader: string;
  };
  rechnungDetail: {
    laedt: string;
    zurueckZurAbrechnung: string;
    druckenSpeichern: string;
    titel: string;
    kunde: string;
    unbenannt: string;
    ustIdLabel: string;
    keineZeit: string;
    spalteDatum: string;
    spalteBeschreibung: string;
    spalteMin: string;
    spaltePreisMin: string;
    spalteBetrag: string;
    entfernenTitle: string;
    gesamtzeitOhneAbzug: string;
    freiminutenTemplate: string;
    berechneteZeit: string;
    netto: string;
    mwstTemplate: string;
    gesamtBrutto: string;
    steuerfreiHinweis: string;
    rechnungsdatumHinweis: string;
    positionHinzufuegenTitel: string;
    positionHinzufuegenBeschreibung: string;
    produktAuswaehlen: string;
    bezeichnungPlatzhalter: string;
    mengeLabel: string;
    einzelpreisLabel: string;
    positionButton: string;
    gesamtLabel: string;
    rabattTitel: string;
    rabattBeschreibung: string;
    beschreibungRabattPlatzhalter: string;
    hinzufuegenButton: string;
    fehlerUngueltigerBetrag: string;
    fehlerHinzufuegen: string;
    fehlerBezeichnungErforderlich: string;
    fehlerUngueltigerEinzelpreis: string;
    fehlerPositionFehlgeschlagen: string;
  };
  plattformAbrechnung: {
    titel: string;
    tabRechnungen: string;
    tabTarife: string;
    tabAbsender: string;
    tabLogin: string;
    absenderHinweis: string;
    feldFirmenname: string;
    feldAdresse: string;
    feldEmail: string;
    feldTelefon: string;
    feldUstId: string;
    feldSteuernummer: string;
    feldIban: string;
    rechnungsangaben: string;
    zahlungszielLabel: string;
    rechtlicherHinweisLabel: string;
    freitextLabel: string;
    freitextPlatzhalter: string;
    gespeichertHaken: string;
    speichern: string;
    loginHinweis: string;
    titelLabel: string;
    spruchLabel: string;
    laedt: string;
    nochKeineFirmen: string;
    spalteFirma: string;
    spalteTarif: string;
    spalteMa: string;
    spalteBetrag: string;
    spalteAktion: string;
    keinTarif: string;
    versendet: string;
    entwurfAnsehen: string;
    rechnungErstellen: string;
    keinTarifZugewiesen: string;
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
  prioritaet: {
    niedrig: "Niedrig",
    mittel: "Mittel",
    hoch: "Hoch",
    kritisch: "Kritisch",
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
  ticketUebersicht: {
    alleKunden: "Alle Kunden",
    unbenannt: "Unbenannt",
    kundeSuchen: "Kunde suchen…",
    keineTreffer: "Keine Treffer.",
    tickets: "Tickets",
    eintragEinzahl: "Eintrag",
    eintragMehrzahl: "Einträge",
    neuesTicketAnlegen: "+ Neues Ticket anlegen",
    suchePlatzhalter: "Suche nach Titel, Kunde, Nr., Bearbeiter oder Verlauf…",
    nurMeine: "Nur meine",
    slaVerletzt: "SLA verletzt",
    offene: "Offene",
    alleStatus: "Alle Status",
    alsStandardTitle: "Diesen Status-Filter als deinen Standard speichern",
    standardMarkiert: "★ Standard",
    alsStandard: "☆ Als Standard",
    allePrioritaeten: "Alle Prioritäten",
    waehleFirmaHinweis: 'Wähle zuerst über das Zahnrad-Icon → "Alle Firmen" eine Firma aus, um deren Tickets zu sehen.',
    keineTrefferTitel: "Keine Treffer",
    keineOffenenTickets: "Keine offenen Tickets",
    keinTicketEnthaelt: "Kein Ticket enthält „{begriff}“ – weder im Titel noch im Verlauf.",
    keinTicketMitTag: "Kein Ticket ist mit dem Tag „{tag}“ versehen.",
    allesErledigt: "Alles erledigt! Neue Tickets erscheinen hier sobald Kunden eine Anfrage stellen.",
    spalteNr: "Nr.",
    spalteBetreffKunde: "Betreff & Kunde",
    spalteStatus: "Status",
    spalteZeit: "Zeit",
    neueNachrichtVomKunden: "Neue Nachricht vom Kunden",
    unbekannterKunde: "Unbekannter Kunde",
  },
  ticketDetail: {
    laedt: "Lädt…",
    betrachterBannerSuffix: "schaut sich dieses Ticket gerade auch an.",
    unbekannterKunde: "Unbekannter Kunde",
    telefonKopierenTitle: "Telefonnummer kopieren",
    emailKopierenTitle: "E-Mail-Adresse kopieren",
    nichtZugewiesen: "Nicht zugewiesen",
    unbenannt: "Unbenannt",
    urlaub: "Urlaub",
    abwesend: "abwesend",
    keinDongleZugeordnet: "Kein Dongle zugeordnet",
    dongleTitle: "Dongle / Lizenz",
    reaktionLabel: "Reaktion:",
    ueberfaellig: "ÜBERFÄLLIG",
    loesungLabel: "Lösung:",
    tagButton: "+ Tag",
    betrachterSchautEinzahl: "schaut",
    betrachterSchautMehrzahl: "schauen",
    betrachterWarnungSuffix: "gerade auch auf dieses Ticket.",
    verlauf: "Verlauf",
    technikerFallback: "Techniker",
    kundeWhatsapp: "Kunde (WhatsApp)",
    kunde: "Kunde",
    anhangFallback: "Anhang",
    makroEinfuegen: "📋 Makro einfügen…",
    aufnahmeLaeuft: "Aufnahme läuft… (klicken zum Stoppen)",
    diktieren: "Diktieren",
    spracheingabeNichtMoeglich: "Spracheingabe hier nicht möglich – geht mit Chrome, Edge oder Safari",
    notizPlatzhalter: "Notiz oder Antwort schreiben…",
    fuerKundenSichtbar: "Für Kunden sichtbar",
    wirdGesendet: "Wird gesendet…",
    senden: "Senden",
    todoListeKunde: "Todo-Liste dieses Kunden",
    hardwareKunde: "Hardware dieses Kunden",
    anhangFehler: "Mindestens ein Anhang konnte nicht gespeichert werden. Details siehe Browser-Konsole (F12).",
    minutenErfasstSuffix: "Min. erfasst",
    manuellSuffix: " (manuell)",
  },
  abrechnung: {
    titel: "Abrechnung",
    drucken: "Drucken / Als PDF",
    laedt: "Lädt…",
    keineDaten: "Keine erfassten Zeiten oder Anpassungen in diesem Monat.",
    monatsuebersicht: "Monatsübersicht –",
    spalteKunde: "Kunde",
    spalteMin: "Min.",
    spalteNetto: "Netto",
    spalteMwst: "MwSt.",
    spalteBrutto: "Brutto",
    gesamt: "Gesamt",
    alsCsvExportieren: "Als CSV exportieren",
    unbenannt: "Unbenannt",
    csvHeader: "Kunde;Minuten;Netto (EUR);MwSt (EUR);Brutto (EUR)",
  },
  rechnungDetail: {
    laedt: "Lädt…",
    zurueckZurAbrechnung: "← Zurück zur Abrechnung",
    druckenSpeichern: "Drucken / Als PDF speichern",
    titel: "Abrechnung",
    kunde: "Kunde",
    unbenannt: "Unbenannt",
    ustIdLabel: "USt-IdNr.:",
    keineZeit: "Keine erfasste Zeit in diesem Monat.",
    spalteDatum: "Datum",
    spalteBeschreibung: "Beschreibung",
    spalteMin: "Min.",
    spaltePreisMin: "Preis/Min.",
    spalteBetrag: "Betrag",
    entfernenTitle: "Entfernen",
    gesamtzeitOhneAbzug: "Gesamtzeit (ohne Abzug)",
    freiminutenTemplate: "− {n} Freiminuten (Dongle {seriennummer})",
    berechneteZeit: "Berechnete Zeit",
    netto: "Netto",
    mwstTemplate: "MwSt. ({prozent} %)",
    gesamtBrutto: "Gesamt (Brutto)",
    steuerfreiHinweis: "Steuerfreie innergemeinschaftliche Lieferung / Tax-free intra-Community supply (Art. 138 MwStSystRL)",
    rechnungsdatumHinweis: "Rechnungsdatum ist Lieferdatum.",
    positionHinzufuegenTitel: "Rechnungsposition hinzufügen",
    positionHinzufuegenBeschreibung: "Produkt/Leistung aus deiner Liste wählen oder frei eingeben. Menge × Einzelpreis wird als Position verrechnet.",
    produktAuswaehlen: "🛒 Produkt auswählen…",
    bezeichnungPlatzhalter: "Bezeichnung",
    mengeLabel: "Menge",
    einzelpreisLabel: "Einzelpreis (€, netto)",
    positionButton: "+ Position",
    gesamtLabel: "Gesamt:",
    rabattTitel: "Rabatt / Gutschrift / Zuschlag hinzufügen",
    rabattBeschreibung: "Negativer Betrag = Rabatt/Gutschrift, positiver Betrag = zusätzliche Position.",
    beschreibungRabattPlatzhalter: "Beschreibung, z.B. Treuerabatt",
    hinzufuegenButton: "Hinzufügen",
    fehlerUngueltigerBetrag: "Ungültiger Betrag.",
    fehlerHinzufuegen: "Hinzufügen fehlgeschlagen.",
    fehlerBezeichnungErforderlich: "Bitte eine Bezeichnung angeben.",
    fehlerUngueltigerEinzelpreis: "Ungültiger Einzelpreis.",
    fehlerPositionFehlgeschlagen: "Position konnte nicht hinzugefügt werden.",
  },
  plattformAbrechnung: {
    titel: "Plattform-Abrechnung",
    tabRechnungen: "Rechnungen",
    tabTarife: "Tarife",
    tabAbsender: "Absender",
    tabLogin: "Anmeldeseite",
    absenderHinweis: "Diese Angaben erscheinen als Absender auf den Rechnungen an die Firmen.",
    feldFirmenname: "Firmenname",
    feldAdresse: "Adresse",
    feldEmail: "E-Mail",
    feldTelefon: "Telefon",
    feldUstId: "USt-IdNr.",
    feldSteuernummer: "Steuernummer (falls keine USt-IdNr. vorhanden)",
    feldIban: "IBAN",
    rechnungsangaben: "Rechnungsangaben",
    zahlungszielLabel: "Zahlungsziel (Tage)",
    rechtlicherHinweisLabel: 'Rechtlicher Hinweis (z.B. "Rechnungsdatum ist Lieferdatum")',
    freitextLabel: "Freitext / Wunschtext (optional, z.B. Gruß oder Skonto-Hinweis)",
    freitextPlatzhalter: "Vielen Dank für die gute Zusammenarbeit!",
    gespeichertHaken: "Gespeichert ✓",
    speichern: "Speichern",
    loginHinweis: "Titel und Spruch, die auf der Anmeldeseite (vor dem Login) angezeigt werden.",
    titelLabel: "Titel",
    spruchLabel: "Spruch",
    laedt: "Lädt…",
    nochKeineFirmen: "Noch keine Firmen angelegt.",
    spalteFirma: "Firma",
    spalteTarif: "Tarif",
    spalteMa: "MA",
    spalteBetrag: "Betrag",
    spalteAktion: "Aktion",
    keinTarif: "– kein Tarif –",
    versendet: "✓ Versendet",
    entwurfAnsehen: "Entwurf ansehen",
    rechnungErstellen: "Rechnung erstellen",
    keinTarifZugewiesen: "Kein Tarif zugewiesen",
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
  prioritaet: {
    niedrig: "Low",
    mittel: "Medium",
    hoch: "High",
    kritisch: "Critical",
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
  ticketUebersicht: {
    alleKunden: "All customers",
    unbenannt: "Unnamed",
    kundeSuchen: "Search customer…",
    keineTreffer: "No matches.",
    tickets: "Tickets",
    eintragEinzahl: "entry",
    eintragMehrzahl: "entries",
    neuesTicketAnlegen: "+ Create new ticket",
    suchePlatzhalter: "Search by title, customer, number, assignee, or history…",
    nurMeine: "Only mine",
    slaVerletzt: "SLA breached",
    offene: "Open",
    alleStatus: "All statuses",
    alsStandardTitle: "Save this status filter as your default",
    standardMarkiert: "★ Default",
    alsStandard: "☆ Set as default",
    allePrioritaeten: "All priorities",
    waehleFirmaHinweis: 'First choose a company via the gear icon → "All companies" to see its tickets.',
    keineTrefferTitel: "No matches",
    keineOffenenTickets: "No open tickets",
    keinTicketEnthaelt: "No ticket contains “{begriff}” – neither in the title nor in the history.",
    keinTicketMitTag: "No ticket is tagged with “{tag}”.",
    allesErledigt: "All done! New tickets will appear here as soon as customers submit a request.",
    spalteNr: "No.",
    spalteBetreffKunde: "Subject & customer",
    spalteStatus: "Status",
    spalteZeit: "Time",
    neueNachrichtVomKunden: "New message from customer",
    unbekannterKunde: "Unknown customer",
  },
  ticketDetail: {
    laedt: "Loading…",
    betrachterBannerSuffix: "is also viewing this ticket right now.",
    unbekannterKunde: "Unknown customer",
    telefonKopierenTitle: "Copy phone number",
    emailKopierenTitle: "Copy email address",
    nichtZugewiesen: "Not assigned",
    unbenannt: "Unnamed",
    urlaub: "on vacation",
    abwesend: "away",
    keinDongleZugeordnet: "No dongle assigned",
    dongleTitle: "Dongle / License",
    reaktionLabel: "Response:",
    ueberfaellig: "OVERDUE",
    loesungLabel: "Resolution:",
    tagButton: "+ Tag",
    betrachterSchautEinzahl: "is",
    betrachterSchautMehrzahl: "are",
    betrachterWarnungSuffix: "also currently viewing this ticket.",
    verlauf: "History",
    technikerFallback: "Technician",
    kundeWhatsapp: "Customer (WhatsApp)",
    kunde: "Customer",
    anhangFallback: "Attachment",
    makroEinfuegen: "📋 Insert macro…",
    aufnahmeLaeuft: "Recording… (click to stop)",
    diktieren: "Dictate",
    spracheingabeNichtMoeglich: "Voice input not available here – works with Chrome, Edge, or Safari",
    notizPlatzhalter: "Write a note or reply…",
    fuerKundenSichtbar: "Visible to customer",
    wirdGesendet: "Sending…",
    senden: "Send",
    todoListeKunde: "This customer's to-do list",
    hardwareKunde: "This customer's hardware",
    anhangFehler: "At least one attachment could not be saved. See browser console (F12) for details.",
    minutenErfasstSuffix: "min logged",
    manuellSuffix: " (manual)",
  },
  abrechnung: {
    titel: "Billing",
    drucken: "Print / Save as PDF",
    laedt: "Loading…",
    keineDaten: "No tracked time or adjustments this month.",
    monatsuebersicht: "Monthly overview –",
    spalteKunde: "Customer",
    spalteMin: "Min.",
    spalteNetto: "Net",
    spalteMwst: "VAT",
    spalteBrutto: "Gross",
    gesamt: "Total",
    alsCsvExportieren: "Export as CSV",
    unbenannt: "Unnamed",
    csvHeader: "Customer;Minutes;Net (EUR);VAT (EUR);Gross (EUR)",
  },
  rechnungDetail: {
    laedt: "Loading…",
    zurueckZurAbrechnung: "← Back to billing",
    druckenSpeichern: "Print / Save as PDF",
    titel: "Invoice",
    kunde: "Customer",
    unbenannt: "Unnamed",
    ustIdLabel: "VAT ID:",
    keineZeit: "No time tracked this month.",
    spalteDatum: "Date",
    spalteBeschreibung: "Description",
    spalteMin: "Min.",
    spaltePreisMin: "Price/min",
    spalteBetrag: "Amount",
    entfernenTitle: "Remove",
    gesamtzeitOhneAbzug: "Total time (before deduction)",
    freiminutenTemplate: "− {n} free minutes (dongle {seriennummer})",
    berechneteZeit: "Billed time",
    netto: "Net",
    mwstTemplate: "VAT ({prozent} %)",
    gesamtBrutto: "Total (gross)",
    steuerfreiHinweis: "Steuerfreie innergemeinschaftliche Lieferung / Tax-free intra-Community supply (Art. 138 MwStSystRL)",
    rechnungsdatumHinweis: "Invoice date equals delivery date.",
    positionHinzufuegenTitel: "Add invoice line item",
    positionHinzufuegenBeschreibung: "Choose a product/service from your list or enter one freely. Quantity × unit price is billed as a line item.",
    produktAuswaehlen: "🛒 Select product…",
    bezeichnungPlatzhalter: "Description",
    mengeLabel: "Quantity",
    einzelpreisLabel: "Unit price (€, net)",
    positionButton: "+ Line item",
    gesamtLabel: "Total:",
    rabattTitel: "Add discount / credit / surcharge",
    rabattBeschreibung: "Negative amount = discount/credit, positive amount = additional charge.",
    beschreibungRabattPlatzhalter: "Description, e.g. loyalty discount",
    hinzufuegenButton: "Add",
    fehlerUngueltigerBetrag: "Invalid amount.",
    fehlerHinzufuegen: "Failed to add.",
    fehlerBezeichnungErforderlich: "Please enter a description.",
    fehlerUngueltigerEinzelpreis: "Invalid unit price.",
    fehlerPositionFehlgeschlagen: "Could not add the line item.",
  },
  plattformAbrechnung: {
    titel: "Platform billing",
    tabRechnungen: "Invoices",
    tabTarife: "Plans",
    tabAbsender: "Sender",
    tabLogin: "Login page",
    absenderHinweis: "This information appears as the sender on invoices sent to companies.",
    feldFirmenname: "Company name",
    feldAdresse: "Address",
    feldEmail: "Email",
    feldTelefon: "Phone",
    feldUstId: "VAT ID",
    feldSteuernummer: "Tax number (if no VAT ID available)",
    feldIban: "IBAN",
    rechnungsangaben: "Invoice details",
    zahlungszielLabel: "Payment term (days)",
    rechtlicherHinweisLabel: 'Legal notice (e.g. "Invoice date equals delivery date")',
    freitextLabel: "Free text / custom note (optional, e.g. thank-you or early-payment discount note)",
    freitextPlatzhalter: "Thank you for the great collaboration!",
    gespeichertHaken: "Saved ✓",
    speichern: "Save",
    loginHinweis: "Title and tagline shown on the login page (before signing in).",
    titelLabel: "Title",
    spruchLabel: "Tagline",
    laedt: "Loading…",
    nochKeineFirmen: "No companies created yet.",
    spalteFirma: "Company",
    spalteTarif: "Plan",
    spalteMa: "Staff",
    spalteBetrag: "Amount",
    spalteAktion: "Action",
    keinTarif: "– no plan –",
    versendet: "✓ Sent",
    entwurfAnsehen: "View draft",
    rechnungErstellen: "Create invoice",
    keinTarifZugewiesen: "No plan assigned",
  },
};

const WOERTERBUCH: Record<Sprache, Uebersetzung> = { de, en };

export function texte(sprache: Sprache): Uebersetzung {
  return WOERTERBUCH[sprache];
}
