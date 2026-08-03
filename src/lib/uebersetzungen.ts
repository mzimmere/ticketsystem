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
  verwaltung: {
    titel: string;
    tabFirma: string;
    tabTeam: string;
    tabKunden: string;
    tabDongles: string;
    tabWerkzeuge: string;
    tabIntegrationen: string;
    bitteFirmaWaehlen: string;
    firmenprofil: string;
    logoAendern: string;
    logoHinweis: string;
    logoBreiteLabel: string;
    pxHinweis: string;
    slaReaktionszeitLabel: string;
    slaPlatzhalter: string;
    stunden: string;
    slaHinweis: string;
    firmennamePlatzhalter: string;
    adresseLabel: string;
    adressePlatzhalter: string;
    telefonLabel: string;
    telefonPlatzhalter: string;
    emailLabel: string;
    emailPlatzhalter: string;
    websiteLabel: string;
    oeffnungszeitenLabel: string;
    oeffnungszeitenPlatzhalter: string;
    standardpreisLabel: string;
    individualisierung: string;
    mottoLabel: string;
    mottoPlatzhalter: string;
    akzentfarbeLabel: string;
    akzentfarbeHinweis: string;
    heroBildLabel: string;
    heroBildAendern: string;
    heroBildHochladen: string;
    heroBildHinweis: string;
    registrierungslinkLabel: string;
    kopiert: string;
    kopieren: string;
    registrierungslinkHinweis: string;
    datenschutzLabel: string;
    datenschutzHinweis: string;
    datenschutzUrlPlatzhalter: string;
    datenschutzTextPlatzhalter: string;
    speichert: string;
    speichern: string;
    fehlerUngueltigerPreis: string;
    fehlerSlugVergeben: string;
    fehlerSpeichern: string;
    erfolgGespeichert: string;
    erfolgLogoAktualisiert: string;
    fehlerLogoUpload: string;
    erfolgBildAktualisiert: string;
    fehlerBildUpload: string;
    team: string;
    abbrechen: string;
    bestehendenNutzerZuweisen: string;
    mitarbeiterAnlegenPlus: string;
    zuweisenHinweis: string;
    emailBestehenderAccount: string;
    techniker: string;
    orgAdmin: string;
    wirdZugewiesen: string;
    zuweisen: string;
    emailEinladungPlatzhalter: string;
    vornamePlatzhalter: string;
    nachnamePlatzhalter: string;
    telefonOptionalPlatzhalter: string;
    passwortOptionalPlatzhalter: string;
    generieren: string;
    passwortHinweis: string;
    wirdAngelegt: string;
    mitarbeiterMitPasswort: string;
    mitarbeiterLinkErzeugen: string;
    abgebrochenNiemand: string;
    istJetztTeilDieserFirma: string;
    kunden: string;
    kundeAnlegenPlus: string;
    telefonWhatsappOptional: string;
    strasseOptional: string;
    nrLabel: string;
    plzLabel: string;
    ortLabel: string;
    ustIdOptional: string;
    notizenOptional: string;
    kundeMitPasswort: string;
    kundeLinkErzeugen: string;
    fehlerAnlegenFehlgeschlagen: string;
    fehlerZuweisenFehlgeschlagen: string;
    trotzdemZuweisen: string;
  };
  mitarbeiterListe: {
    superAdmin: string;
    orgAdmin: string;
    techniker: string;
    kunde: string;
    fehlerLaden: string;
    fehlerAktion: string;
    fehlerSpeichern: string;
    fehlerEmailUngueltig: string;
    fehlerEmailAendern: string;
    erfolgEmailGeaendert: string;
    fehlerAvatarUpload: string;
    fehlerLinkFehlgeschlagen: string;
    fehlerNeuerLink: string;
    keineDeaktivierten: string;
    nochKeineTeamMitglieder: string;
    zurueckZumAktivenTeam: string;
    deaktivierteAnzeigen: string;
    online: string;
    unbenannt: string;
    urlaub: string;
    abwesend: string;
    profilbildAendern: string;
    vorname: string;
    nachname: string;
    telefon: string;
    rolle: string;
    verfuegbarkeitLabel: string;
    verfuegbar: string;
    speichern: string;
    emailAendernTitel: string;
    aktuellLabel: string;
    neueEmailPlatzhalter: string;
    aendern: string;
    neuenZugangslinkErzeugen: string;
    wiederAktivieren: string;
    ausFirmaEntfernen: string;
    ausFirmaEntfernenTitle: string;
  };
  kundenListe: {
    fehlerLaden: string;
    unbenannt: string;
    fehlerAktion: string;
    fehlerEmailVergeben: string;
    fehlerEmailHinzufuegen: string;
    fehlerZusammenfuehren: string;
    erfolgZusammengefuehrt: string;
    fehlerUngueltigerPreis: string;
    fehlerPreisHinzufuegen: string;
    fehlerSpeichern: string;
    fehlerAvatarUpload: string;
    fehlerDokumentUpload: string;
    fehlerDokumentOeffnen: string;
    fehlerLinkFehlgeschlagen: string;
    fehlerNeuerLink: string;
    suchePlatzhalter: string;
    zurueckAktive: string;
    archiv: string;
    nachHardwareFiltern: string;
    wertWaehlen: string;
    zuruecksetzen: string;
    keineDeaktiviertenKunden: string;
    nochKeineKunden: string;
    keineTreffer: string;
    online: string;
    profilbildAendern: string;
    vorname: string;
    nachname: string;
    emailLoginLabel: string;
    nichtAenderbar: string;
    weitereEmailsLabel: string;
    weitereEmailsHinweis: string;
    entfernen: string;
    weitereEmailPlatzhalter: string;
    zusatzEmailHinweis: string;
    telefonWhatsapp: string;
    telefonPlatzhalter: string;
    strassePlatzhalter: string;
    nrPlatzhalter: string;
    plzPlatzhalter: string;
    ortPlatzhalter: string;
    mwstHinweis: string;
    ustIdLabel: string;
    ustIdPlatzhalter: string;
    ustIdHinweis: string;
    notizenLabel: string;
    notizenPlatzhalter: string;
    individuellerPreisLabel: string;
    keinPreisGesetzt: string;
    abPrefix: string;
    aktuell: string;
    geplant: string;
    preisPlatzhalter: string;
    preisHinweis: string;
    speichern: string;
    dokumenteLabel: string;
    loeschen: string;
    dokumentHochladen: string;
    todoListe: string;
    hardware: string;
    donglesLizenzen: string;
    lizenzvertraegeLabel: string;
    laufzeit: string;
    bisPrefix: string;
    tageSuffix: string;
    abgelaufen: string;
    kontenZusammenfuehrenLabel: string;
    mitAnderemKontoZusammenfuehren: string;
    zusammenfuehrenBeschreibungVor: string;
    zusammenfuehrenBeschreibungNach: string;
    diesemKunden: string;
    wirdZusammengefuehrt: string;
    zusammenfuehren: string;
    abbrechen: string;
    bitteAnderesKontoWaehlen: string;
    neuenZugangslinkErzeugen: string;
    kontoZusammengefuehrtInVor: string;
    kontoZusammengefuehrtInNach: string;
    einAnderesKonto: string;
    wiederAktivieren: string;
    kundeDeaktivieren: string;
    wenigerAnzeigen: string;
    alleAnzeigenTemplate: string;
  };
  tagVerwaltung: {
    titel: string;
    nameErforderlich: string;
    tagExistiertBereits: string;
    fehler: string;
    tagLoeschenConfirm: string;
    nochKeineTags: string;
    neuerTagPlatzhalter: string;
  };
  slaVerwaltung: {
    titel: string;
    slaAktivLabel: string;
    ersteReaktion: string;
    loesung: string;
    autoSchliessenLabel: string;
    autoSchliessenPlatzhalter: string;
    tage: string;
    autoSchliessenHinweis: string;
    fehlerSpeichern: string;
    gespeichert: string;
    speichert: string;
    speichern: string;
  };
  hardwareKategorienVerwaltung: {
    titel: string;
    beschreibung: string;
    nameErforderlich: string;
    kategorieExistiertBereits: string;
    fehler: string;
    loeschenConfirmTemplate: string;
    nochKeineKategorien: string;
    neueKategoriePlatzhalter: string;
  };
  makroVerwaltung: {
    titelUndInhaltErforderlich: string;
    fehlerSpeichern: string;
    makroLoeschenConfirm: string;
    titel: string;
    neuesMakro: string;
    titelPlatzhalter: string;
    inhaltPlatzhalter: string;
    speichern: string;
    abbrechen: string;
    nochKeineMakros: string;
    loeschen: string;
  };
  vorlagenVerwaltung: {
    titelUndBeschreibungErforderlich: string;
    fehlerSpeichern: string;
    vorlageLoeschenConfirm: string;
    titel: string;
    neueVorlage: string;
    beschreibung: string;
    titelPlatzhalter: string;
    beschreibungPlatzhalter: string;
    speichern: string;
    abbrechen: string;
    nochKeineVorlagen: string;
    loeschen: string;
  };
  faqVerwaltung: {
    frageUndAntwortPflicht: string;
    loeschenConfirm: string;
    titel: string;
    neuerEintrag: string;
    oeffentlicherLink: string;
    kopiert: string;
    kopieren: string;
    vorschau: string;
    slugHinweisVor: string;
    firmaRegistrierungslink: string;
    slugHinweisNach: string;
    sichtbarkeitHinweis: string;
    fragePlatzhalter: string;
    antwortPlatzhalter: string;
    kategoriePlatzhalter: string;
    oeffentlich: string;
    speichern: string;
    abbrechen: string;
    nochKeineEintraege: string;
    intern: string;
    loeschen: string;
    kategorieLabel: string;
  };
  reportingExport: {
    titel: string;
    beschreibung: string;
    von: string;
    bis: string;
    ticketsLabel: string;
    ticketsSub: string;
    zeitLabel: string;
    zeitSub: string;
    csatLabel: string;
    csatSub: string;
    csvTicketsKopf: string[];
    csvZeitKopf: string[];
    csvCsatKopf: string[];
    positiv: string;
    negativ: string;
    positivMitEmoji: string;
    negativMitEmoji: string;
  };
  tarifVerwaltung: {
    laedt: string;
    beschreibung: string;
    neuerTarif: string;
    namePflicht: string;
    anlegenFehlgeschlagen: string;
    tarifNamePlatzhalter: string;
    anlegen: string;
    nochKeineTarife: string;
    aktiv: string;
    loeschen: string;
    loeschenConfirm: string;
    loeschenFehlgeschlagen: string;
    grundgebuehr: string;
    inklusiveMitarbeiter: string;
    mwst: string;
    staffelnLabel: string;
    staffelHinzufuegen: string;
    keineStaffeln: string;
    von: string;
    bis: string;
    proMa: string;
  };
  plattformRechnungDetail: {
    laedt: string;
    nichtGefunden: string;
    zurueck: string;
    sende: string;
    perEmailVersenden: string;
    versendetAm: string;
    drucken: string;
    keineEmailHinterlegt: string;
    smtpNichtKonfiguriert: string;
    versandFehlgeschlagen: string;
    versandFehlgeschlagenNetzwerk: string;
    ustIdLabel: string;
    steuernummerLabel: string;
    rechnungTitel: string;
    leistungszeitraum: string;
    rechnungsdatum: string;
    faelligAm: string;
    tageSuffix: string;
    firma: string;
    tarifTemplate: string;
    positionSpalte: string;
    betragSpalte: string;
    netto: string;
    mwstTemplate: string;
    gesamtBrutto: string;
    ueberweisungVor: string;
    faelligkeitsdatum: string;
    ueberweisungNach: string;
  };
  integrationenVerwaltung: {
    kopieren: string;
    verbergen: string;
    anzeigen: string;
    titel: string;
    emailTitel: string;
    emailBeschreibung: string;
    versandLabel: string;
    versandEigenesPostfach: string;
    versandGemeinsam: string;
    empfangLabel: string;
    empfangAktiv: string;
    empfangNichtKonfiguriert: string;
    emailHinweis: string;
    smtpHost: string;
    smtpHostPlatzhalter: string;
    smtpPort: string;
    smtpPortHinweis: string;
    imapHost: string;
    imapHostPlatzhalter: string;
    imapPort: string;
    imapPortHinweis: string;
    benutzername: string;
    benutzernamePlatzhalter: string;
    benutzernameHinweis: string;
    absenderadresse: string;
    passwort: string;
    passwortPlatzhalter: string;
    passwortHinweis: string;
    supportEmailLabel: string;
    supportEmailKlammer: string;
    supportEmailPlatzhalter: string;
    supportEmailHinweis: string;
    fehlerSpeichern: string;
    gespeichert: string;
    speichert: string;
    emailZugangsdatenSpeichern: string;
    whatsappTitel: string;
    whatsappBeschreibung: string;
    aktiv: string;
    nichtKonfiguriert: string;
    phoneNumberId: string;
    phoneNumberIdHinweis: string;
    accessToken: string;
    appSecret: string;
    appSecretKlammer: string;
    appSecretPlatzhalter: string;
    appSecretHinweis: string;
    webhookVerifyToken: string;
    webhookTokenPlatzhalter: string;
    generieren: string;
    webhookUrlLabel: string;
    webhookUrlHinweis: string;
    bitteZuerstEintragen: string;
    tokenAbgelaufen: string;
    testFehlgeschlagen: string;
    verbundenTemplate: string;
    qualitaetTemplate: string;
    prueft: string;
    verbindungTesten: string;
    integrationenSpeichern: string;
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
  verwaltung: {
    titel: "Verwaltung",
    tabFirma: "🏢 Firma",
    tabTeam: "👥 Team",
    tabKunden: "🤝 Kunden",
    tabDongles: "🔑 Dongles & Lizenzen",
    tabWerkzeuge: "🔧 Werkzeuge",
    tabIntegrationen: "🔌 Integrationen",
    bitteFirmaWaehlen: "Bitte zuerst eine Firma auswählen.",
    firmenprofil: "Firmenprofil",
    logoAendern: "Logo ändern",
    logoHinweis: "Empfohlen: quadratisch, mind. 400×400px, max. 3 MB. Wird auf der Registrierungsseite bis zu 192×192px groß angezeigt.",
    logoBreiteLabel: "Logo-Breite auf der Rechnung",
    pxHinweis: "px (20–300, Standard 80)",
    slaReaktionszeitLabel: "SLA-Reaktionszeit (optional)",
    slaPlatzhalter: "leer = kein SLA",
    stunden: "Stunden",
    slaHinweis: "Tickets ohne Antwort innerhalb dieser Frist werden in der Übersicht als überfällig markiert.",
    firmennamePlatzhalter: "Firmenname",
    adresseLabel: "Adresse",
    adressePlatzhalter: "Straße, PLZ, Ort",
    telefonLabel: "Telefon",
    telefonPlatzhalter: "+49 ...",
    emailLabel: "E-Mail",
    emailPlatzhalter: "support@firma.de",
    websiteLabel: "Website",
    oeffnungszeitenLabel: "Öffnungs- / Erreichbarkeitszeiten",
    oeffnungszeitenPlatzhalter: "z.B. Mo–Fr 8–17 Uhr",
    standardpreisLabel: "Standard-Minutenpreis in Euro (für die Abrechnung)",
    individualisierung: "Individualisierung",
    mottoLabel: "Motto / Begrüßungszeile",
    mottoPlatzhalter: 'z.B. "Schnelle Hilfe, persönlich betreut"',
    akzentfarbeLabel: "Akzentfarbe",
    akzentfarbeHinweis: "Ersetzt die Button- und Akzentfarbe überall in der App für eure Mitarbeiter und Kunden.",
    heroBildLabel: "Bild für die Startseite (optional)",
    heroBildAendern: "Bild ändern",
    heroBildHochladen: "+ Bild hochladen",
    heroBildHinweis: "Empfohlen: Querformat, mind. 800px breit, max. 5 MB.",
    registrierungslinkLabel: "Registrierungslink für Kunden",
    kopiert: "Kopiert ✓",
    kopieren: "Kopieren",
    registrierungslinkHinweis: "Diesen Link auf eurer Website verlinken – Kunden können sich darüber selbst registrieren und landen direkt bei eurer Firma.",
    datenschutzLabel: "Datenschutzerklärung",
    datenschutzHinweis: "Wird Kunden bei der Registrierung als Pflicht-Link angezeigt. Entweder eine bestehende Seite verlinken, oder euren eigenen Text einfügen (z.B. von einem Generator wie eRecht24 oder Datenschutz-Generator.de erstellt) – dann zeigen wir ihn als eigene Seite innerhalb der App an. Link hat Vorrang, falls beides ausgefüllt ist.",
    datenschutzUrlPlatzhalter: "https://eure-firma.de/datenschutz (optional)",
    datenschutzTextPlatzhalter: "Oder hier den vollständigen Text eurer Datenschutzerklärung einfügen…",
    speichert: "Speichert…",
    speichern: "Speichern",
    fehlerUngueltigerPreis: "Ungültiger Standardpreis – andere Felder wurden trotzdem gespeichert.",
    fehlerSlugVergeben: "Dieser Link-Name ist schon vergeben, bitte einen anderen wählen.",
    fehlerSpeichern: "Speichern fehlgeschlagen.",
    erfolgGespeichert: "Gespeichert.",
    erfolgLogoAktualisiert: "Logo aktualisiert.",
    fehlerLogoUpload: "Logo-Upload fehlgeschlagen.",
    erfolgBildAktualisiert: "Bild aktualisiert.",
    fehlerBildUpload: "Bild-Upload fehlgeschlagen.",
    team: "Team",
    abbrechen: "Abbrechen",
    bestehendenNutzerZuweisen: "Bestehenden Nutzer zuweisen",
    mitarbeiterAnlegenPlus: "+ Mitarbeiter anlegen",
    zuweisenHinweis: "Für Personen, die schon einen Account haben – kein neuer Account nötig. Als Techniker/Org-Admin arbeitet die Person danach zusätzlich hier, bestehende Mitgliedschaften bei anderen Firmen bleiben bestehen. Nur als Kunde ist ein Account weiterhin nur einer Firma zugeordnet (du bekommst dort vorher eine Warnung, falls die Person schon Kunde woanders ist).",
    emailBestehenderAccount: "E-Mail des bestehenden Accounts",
    techniker: "Techniker",
    orgAdmin: "Org-Admin",
    wirdZugewiesen: "Wird zugewiesen…",
    zuweisen: "Zuweisen",
    emailEinladungPlatzhalter: "E-Mail (für die Einladung)",
    vornamePlatzhalter: "Vorname",
    nachnamePlatzhalter: "Nachname",
    telefonOptionalPlatzhalter: "Telefon (optional)",
    passwortOptionalPlatzhalter: "Passwort (optional, statt Mail-Einladung)",
    generieren: "Generieren",
    passwortHinweis: "Leer lassen, um einen Einladungslink zu erzeugen. Mit Passwort: Account ist sofort nutzbar, keine Mail wird verschickt – du gibst die Zugangsdaten selbst weiter. Für WhatsApp empfehlenswert (Links können dort vorab verbraucht werden).",
    wirdAngelegt: "Wird angelegt…",
    mitarbeiterMitPasswort: "Mitarbeiter mit Passwort anlegen",
    mitarbeiterLinkErzeugen: "Mitarbeiter anlegen & Link erzeugen",
    abgebrochenNiemand: "Abgebrochen – niemand wurde umgezogen.",
    istJetztTeilDieserFirma: "ist jetzt Teil dieser Firma.",
    kunden: "Kunden",
    kundeAnlegenPlus: "+ Kunde anlegen",
    telefonWhatsappOptional: "Telefon / WhatsApp (optional)",
    strasseOptional: "Straße (optional)",
    nrLabel: "Nr.",
    plzLabel: "PLZ",
    ortLabel: "Ort",
    ustIdOptional: "USt-IdNr. (optional, z.B. ATU12345678)",
    notizenOptional: "Notizen / Besonderheiten (optional)",
    kundeMitPasswort: "Kunde mit Passwort anlegen",
    kundeLinkErzeugen: "Kunde anlegen & Link erzeugen",
    fehlerAnlegenFehlgeschlagen: "Anlegen fehlgeschlagen.",
    fehlerZuweisenFehlgeschlagen: "Zuweisen fehlgeschlagen.",
    trotzdemZuweisen: "Trotzdem zuweisen?",
  },
  mitarbeiterListe: {
    superAdmin: "Super-Admin",
    orgAdmin: "Org-Admin",
    techniker: "Techniker",
    kunde: "Kunde",
    fehlerLaden: "Team konnte nicht geladen werden (Details in der Browser-Konsole).",
    fehlerAktion: "Aktion fehlgeschlagen.",
    fehlerSpeichern: "Speichern fehlgeschlagen.",
    fehlerEmailUngueltig: "Bitte eine gültige E-Mail-Adresse eingeben.",
    fehlerEmailAendern: "E-Mail-Änderung fehlgeschlagen.",
    erfolgEmailGeaendert: "E-Mail geändert.",
    fehlerAvatarUpload: "Profilbild-Upload fehlgeschlagen.",
    fehlerLinkFehlgeschlagen: "Fehlgeschlagen",
    fehlerNeuerLink: "Neuer Link konnte nicht erzeugt werden. Ist resend-zugang deployt?",
    keineDeaktivierten: "Keine deaktivierten Mitglieder.",
    nochKeineTeamMitglieder: "Noch keine Team-Mitglieder.",
    zurueckZumAktivenTeam: "← Zurück zum aktiven Team",
    deaktivierteAnzeigen: "Deaktivierte Mitglieder anzeigen",
    online: "Online",
    unbenannt: "Unbenannt",
    urlaub: "Urlaub",
    abwesend: "Abwesend",
    profilbildAendern: "Profilbild ändern",
    vorname: "Vorname",
    nachname: "Nachname",
    telefon: "Telefon",
    rolle: "Rolle",
    verfuegbarkeitLabel: "Verfügbarkeit",
    verfuegbar: "Verfügbar",
    speichern: "Speichern",
    emailAendernTitel: "E-Mail-Adresse ändern",
    aktuellLabel: "Aktuell:",
    neueEmailPlatzhalter: "neue@email.de",
    aendern: "Ändern",
    neuenZugangslinkErzeugen: "Neuen Zugangslink erzeugen",
    wiederAktivieren: "Wieder aktivieren",
    ausFirmaEntfernen: "Aus dieser Firma entfernen",
    ausFirmaEntfernenTitle: "Entfernt die Person nur aus DIESER Firma - andere Mitgliedschaften bleiben bestehen.",
  },
  kundenListe: {
    fehlerLaden: "Kunden konnten nicht geladen werden (Details in der Browser-Konsole).",
    unbenannt: "Unbenannt",
    fehlerAktion: "Aktion fehlgeschlagen.",
    fehlerEmailVergeben: "Diese E-Mail-Adresse ist bereits einem Kunden zugeordnet.",
    fehlerEmailHinzufuegen: "E-Mail-Adresse konnte nicht hinzugefügt werden.",
    fehlerZusammenfuehren: "Zusammenführen fehlgeschlagen.",
    erfolgZusammengefuehrt: "Konten zusammengeführt.",
    fehlerUngueltigerPreis: "Ungültiger Preis – bitte z.B. 1,99 eingeben.",
    fehlerPreisHinzufuegen: "Preis konnte nicht hinzugefügt werden.",
    fehlerSpeichern: "Speichern fehlgeschlagen.",
    fehlerAvatarUpload: "Profilbild-Upload fehlgeschlagen.",
    fehlerDokumentUpload: "Dokument-Upload fehlgeschlagen.",
    fehlerDokumentOeffnen: "Konnte Dokument nicht öffnen.",
    fehlerLinkFehlgeschlagen: "Fehlgeschlagen",
    fehlerNeuerLink: "Neuer Link konnte nicht erzeugt werden. Ist resend-zugang deployt?",
    suchePlatzhalter: "Suche nach Name, Telefon, Straße, PLZ oder Ort…",
    zurueckAktive: "← Aktive",
    archiv: "Archiv",
    nachHardwareFiltern: "Nach Hardware filtern…",
    wertWaehlen: "Wert wählen…",
    zuruecksetzen: "Zurücksetzen",
    keineDeaktiviertenKunden: "Keine deaktivierten Kunden.",
    nochKeineKunden: "Noch keine Kunden vorhanden.",
    keineTreffer: "Keine Treffer für diese Suche.",
    online: "Online",
    profilbildAendern: "Profilbild ändern",
    vorname: "Vorname",
    nachname: "Nachname",
    emailLoginLabel: "E-Mail (Login)",
    nichtAenderbar: "– nicht änderbar",
    weitereEmailsLabel: "Weitere E-Mail-Adressen",
    weitereEmailsHinweis: "– z.B. wenn per Mail von einer anderen Adresse geschrieben wird",
    entfernen: "Entfernen",
    weitereEmailPlatzhalter: "weitere.adresse@beispiel.de",
    zusatzEmailHinweis: "Mails von hinterlegten Adressen landen automatisch bei diesem Kunden (statt einen neuen Account anzulegen).",
    telefonWhatsapp: "Telefon / WhatsApp",
    telefonPlatzhalter: "z.B. 4915112345678",
    strassePlatzhalter: "Straße",
    nrPlatzhalter: "Nr.",
    plzPlatzhalter: "PLZ",
    ortPlatzhalter: "Ort",
    mwstHinweis: "Vorschlagswert nach Land, Steuersatz bleibt frei änderbar (z.B. Kleinunternehmer, Reverse-Charge).",
    ustIdLabel: "USt-IdNr. (für steuerfreie innergemeinschaftliche Lieferung)",
    ustIdPlatzhalter: "z.B. ATU12345678",
    ustIdHinweis: 'Wenn ausgefüllt, weist die Rechnung automatisch 0% MwSt. aus und vermerkt "Steuerfreie innergemeinschaftliche Lieferung / Tax-free intra-Community supply".',
    notizenLabel: "Notizen / Besonderheiten",
    notizenPlatzhalter: "z.B. bevorzugte Erreichbarkeit, technische Besonderheiten…",
    individuellerPreisLabel: "Individueller Minutenpreis (Verlauf, optional)",
    keinPreisGesetzt: "Noch kein individueller Preis gesetzt – es gilt der Standardpreis der Firma.",
    abPrefix: "ab",
    aktuell: "Aktuell",
    geplant: "Geplant",
    preisPlatzhalter: "z.B. 1,99",
    preisHinweis: "Gilt automatisch ab dem gewählten Datum – ältere Zeiterfassungen bleiben mit ihrem damaligen Preis unangetastet.",
    speichern: "Speichern",
    dokumenteLabel: "Dokumente (unabhängig von Tickets)",
    loeschen: "Löschen",
    dokumentHochladen: "+ Dokument hochladen",
    todoListe: "Todo-Liste",
    hardware: "Hardware",
    donglesLizenzen: "Dongles / Lizenzen",
    lizenzvertraegeLabel: "Lizenzverträge (Ablauf/Verlängerung)",
    laufzeit: "Laufzeit",
    bisPrefix: "bis",
    tageSuffix: "Tage",
    abgelaufen: "(abgelaufen)",
    kontenZusammenfuehrenLabel: "Konten zusammenführen",
    mitAnderemKontoZusammenfuehren: "Mit anderem Kundenkonto zusammenführen…",
    zusammenfuehrenBeschreibungVor: "Wähle das doppelte/ältere Konto (z.B. weil der Kunde von einer anderen Mail-Adresse geschrieben hat). Alle Tickets, Zeiteinträge, Dokumente, Preise, Todos, Dongles, Lizenzverträge und Hardware wandern zu",
    zusammenfuehrenBeschreibungNach: ", dessen Login-Mail wird als zusätzliche Adresse hinterlegt und das doppelte Konto anschließend deaktiviert.",
    diesemKunden: "diesem Kunden",
    wirdZusammengefuehrt: "Wird zusammengeführt…",
    zusammenfuehren: "Zusammenführen",
    abbrechen: "Abbrechen",
    bitteAnderesKontoWaehlen: "Bitte ein anderes Konto wählen.",
    neuenZugangslinkErzeugen: "Neuen Zugangslink erzeugen",
    kontoZusammengefuehrtInVor: "Dieses Konto wurde in",
    kontoZusammengefuehrtInNach: " zusammengeführt. Alle Tickets und Daten liegen dort – ein erneutes Aktivieren würde die Zuordnung nicht rückgängig machen.",
    einAnderesKonto: "ein anderes Konto",
    wiederAktivieren: "Wieder aktivieren",
    kundeDeaktivieren: "Kunde deaktivieren",
    wenigerAnzeigen: "Weniger anzeigen",
    alleAnzeigenTemplate: "Alle {n} anzeigen",
  },
  tagVerwaltung: {
    titel: "Tags / Kategorien",
    nameErforderlich: "Name erforderlich.",
    tagExistiertBereits: "Dieser Tag existiert bereits.",
    fehler: "Fehler.",
    tagLoeschenConfirm: "Tag löschen? Er wird auch von allen Tickets entfernt.",
    nochKeineTags: "Noch keine Tags.",
    neuerTagPlatzhalter: "Neuer Tag…",
  },
  slaVerwaltung: {
    titel: "SLA & Automatisierung",
    slaAktivLabel: "SLA-Fristen aktiv (werden beim Anlegen neuer Tickets berechnet)",
    ersteReaktion: "Erste Reaktion (Stunden)",
    loesung: "Lösung (Stunden)",
    autoSchliessenLabel: "Auto-Schließen (Tage ohne Kunden-Antwort, leer = deaktiviert)",
    autoSchliessenPlatzhalter: "z.B. 7",
    tage: "Tage",
    autoSchliessenHinweis: 'Tickets im Status "Wartet auf Kunde" werden nach dieser Zeit automatisch geschlossen.',
    fehlerSpeichern: "Fehler beim Speichern.",
    gespeichert: "Gespeichert.",
    speichert: "Speichert…",
    speichern: "Speichern",
  },
  hardwareKategorienVerwaltung: {
    titel: "Hardware-Kategorien",
    beschreibung: "Frei definierbare Kategorien, z.B. Intraoral-Scanner, Desktop-Scanner, Exocad-Datenbank, Fräsmaschine, Drucker. Erscheinen dann bei jedem Kunden zur schnellen Erfassung per Klick.",
    nameErforderlich: "Name erforderlich.",
    kategorieExistiertBereits: "Diese Kategorie existiert bereits.",
    fehler: "Fehler.",
    loeschenConfirmTemplate: 'Kategorie "{name}" löschen? Alle dazu erfassten Werte bei Kunden werden mitgelöscht.',
    nochKeineKategorien: "Noch keine Kategorien.",
    neueKategoriePlatzhalter: "Neue Kategorie, z.B. Intraoral-Scanner…",
  },
  makroVerwaltung: {
    titelUndInhaltErforderlich: "Titel und Inhalt sind erforderlich.",
    fehlerSpeichern: "Fehler beim Speichern.",
    makroLoeschenConfirm: "Makro wirklich löschen?",
    titel: "Makros (Textbausteine)",
    neuesMakro: "+ Neues Makro",
    titelPlatzhalter: "Titel (z.B. Passwort zurücksetzen)",
    inhaltPlatzhalter: "Inhalt der Antwort…",
    speichern: "Speichern",
    abbrechen: "Abbrechen",
    nochKeineMakros: "Noch keine Makros angelegt.",
    loeschen: "Löschen",
  },
  vorlagenVerwaltung: {
    titelUndBeschreibungErforderlich: "Titel und Beschreibung sind erforderlich.",
    fehlerSpeichern: "Fehler beim Speichern.",
    vorlageLoeschenConfirm: "Vorlage wirklich löschen?",
    titel: "Ticket-Vorlagen",
    neueVorlage: "+ Neue Vorlage",
    beschreibung: "Vorlagen füllen beim Anlegen eines neuen Tickets Titel, Beschreibung und Priorität automatisch aus.",
    titelPlatzhalter: "Titel (z.B. VPN funktioniert nicht)",
    beschreibungPlatzhalter: "Beschreibung, die das Ticket vorausfüllt…",
    speichern: "Speichern",
    abbrechen: "Abbrechen",
    nochKeineVorlagen: "Noch keine Vorlagen angelegt.",
    loeschen: "Löschen",
  },
  faqVerwaltung: {
    frageUndAntwortPflicht: "Frage und Antwort sind Pflichtfelder.",
    loeschenConfirm: "FAQ-Eintrag wirklich löschen?",
    titel: "FAQ / Wissensdatenbank",
    neuerEintrag: "+ Neuer Eintrag",
    oeffentlicherLink: "🔗 Öffentlicher Link:",
    kopiert: "✓ Kopiert",
    kopieren: "Kopieren",
    vorschau: "↗ Vorschau",
    slugHinweisVor: "Trage unter",
    firmaRegistrierungslink: "Firma → Registrierungslink",
    slugHinweisNach: "einen Slug ein, damit der öffentliche FAQ-Link aktiviert wird.",
    sichtbarkeitHinweis: "Öffentliche Einträge sind für Kunden im Portal sichtbar. Interne Einträge nur für dein Team.",
    fragePlatzhalter: "Frage (z.B. Wie setze ich mein Passwort zurück?)",
    antwortPlatzhalter: "Antwort…",
    kategoriePlatzhalter: "Kategorie (optional)",
    oeffentlich: "Öffentlich",
    speichern: "Speichern",
    abbrechen: "Abbrechen",
    nochKeineEintraege: "Noch keine Einträge. Füge häufig gestellte Fragen hinzu, damit Kunden sich selbst helfen können.",
    intern: "Intern",
    loeschen: "Löschen",
    kategorieLabel: "Kategorie",
  },
  reportingExport: {
    titel: "Daten exportieren",
    beschreibung: "Alle Exporte als CSV-Datei (UTF-8, Komma-getrennt) – direkt in Excel oder Google Sheets öffenbar.",
    von: "Von",
    bis: "Bis",
    ticketsLabel: "🎫 Tickets exportieren",
    ticketsSub: "Alle Tickets mit Status, SLA, CSAT",
    zeitLabel: "⏱ Zeiterfassung exportieren",
    zeitSub: "Alle Zeiteinträge mit Minuten und Beschreibung",
    csatLabel: "⭐ CSAT-Bewertungen exportieren",
    csatSub: "Nur Tickets mit Kundenbewertung",
    csvTicketsKopf: ["Ticket-Nr", "Titel", "Status", "Priorität", "Erstellt", "Erste Antwort", "Reaktion fällig", "Lösung fällig", "CSAT", "Kunde", "Zugewiesen"],
    csvZeitKopf: ["Datum", "Minuten", "Stunden", "Beschreibung", "Art", "Ticket-Nr", "Ticket", "Techniker", "Kunde"],
    csvCsatKopf: ["Ticket-Nr", "Titel", "Bewertung", "Bewertet am", "Kunde", "Techniker"],
    positiv: "Positiv",
    negativ: "Negativ",
    positivMitEmoji: "Positiv 👍",
    negativMitEmoji: "Negativ 👎",
  },
  tarifVerwaltung: {
    laedt: "Lädt…",
    beschreibung: "Grundgebühr deckt eine bestimmte Mitarbeiterzahl ab. Darüber hinaus greifen die Staffeln (nach absoluter Mitarbeiterzahl gestaffelt).",
    neuerTarif: "+ Neuer Tarif",
    namePflicht: "Bitte einen Namen angeben.",
    anlegenFehlgeschlagen: "Anlegen fehlgeschlagen.",
    tarifNamePlatzhalter: "Tarifname (z.B. Starter, Business)",
    anlegen: "Anlegen",
    nochKeineTarife: "Noch keine Tarife angelegt.",
    aktiv: "Aktiv",
    loeschen: "Löschen",
    loeschenConfirm: "Tarif wirklich löschen? Geht nur, wenn er keiner Firma zugewiesen ist.",
    loeschenFehlgeschlagen: "Löschen fehlgeschlagen – Tarif ist noch mindestens einer Firma zugewiesen.",
    grundgebuehr: "Grundgebühr (€/Monat)",
    inklusiveMitarbeiter: "Inklusive Mitarbeiter",
    mwst: "MwSt. (%)",
    staffelnLabel: "Staffeln (ab Mitarbeiter #)",
    staffelHinzufuegen: "+ Staffel",
    keineStaffeln: "Keine Staffeln – über die Inklusivzahl hinaus wird nichts berechnet.",
    von: "von",
    bis: "bis",
    proMa: "€/MA",
  },
  plattformRechnungDetail: {
    laedt: "Lädt…",
    nichtGefunden: "Rechnung nicht gefunden.",
    zurueck: "← Zurück",
    sende: "Sende…",
    perEmailVersenden: "Per E-Mail versenden",
    versendetAm: "✓ Versendet",
    drucken: "Drucken / Als PDF",
    keineEmailHinterlegt: "Diese Firma hat keine E-Mail-Adresse hinterlegt.",
    smtpNichtKonfiguriert: "Mail-Versand ist noch nicht eingerichtet (SMTP_HOST/SMTP_USER/SMTP_PASSWORD fehlen).",
    versandFehlgeschlagen: "Versand fehlgeschlagen.",
    versandFehlgeschlagenNetzwerk: "Versand fehlgeschlagen (Netzwerkfehler).",
    ustIdLabel: "USt-IdNr.:",
    steuernummerLabel: "Steuernummer:",
    rechnungTitel: "Rechnung",
    leistungszeitraum: "Leistungszeitraum:",
    rechnungsdatum: "Rechnungsdatum:",
    faelligAm: "Fällig am:",
    tageSuffix: "Tage",
    firma: "Firma",
    tarifTemplate: 'Tarif "{name}" · {n} aktive Mitarbeiter',
    positionSpalte: "Position",
    betragSpalte: "Betrag",
    netto: "Netto",
    mwstTemplate: "MwSt. ({satz} %)",
    gesamtBrutto: "Gesamt (Brutto)",
    ueberweisungVor: "Bitte überweise den Betrag bis zum",
    faelligkeitsdatum: "Fälligkeitsdatum",
    ueberweisungNach: "auf IBAN {iban}.",
  },
  integrationenVerwaltung: {
    kopieren: "Kopieren",
    verbergen: "Verbergen",
    anzeigen: "Anzeigen",
    titel: "Integrationen",
    emailTitel: "E-Mail (Senden & Empfangen)",
    emailBeschreibung: "Ein Postfach für Kunden-Benachrichtigungen (SMTP) und automatische Tickets aus eingehenden Mails (IMAP)",
    versandLabel: "Versand:",
    versandEigenesPostfach: "Eigenes Postfach",
    versandGemeinsam: "Gemeinsam",
    empfangLabel: "Empfang:",
    empfangAktiv: "Aktiv",
    empfangNichtKonfiguriert: "Nicht konfiguriert",
    emailHinweis: "Ohne eigene Angaben hier wird für den Versand das zentrale, gemeinsame Postfach der Plattform verwendet. Trage die Zugangsdaten eines eigenen Postfachs dieser Firma ein, damit Kunden Mails von der eigenen Adresse erhalten und Antworten an diese Adresse automatisch zu Tickets werden.",
    smtpHost: "SMTP-Host (Versand)",
    smtpHostPlatzhalter: "smtp-mail.outlook.com",
    smtpPort: "SMTP-Port",
    smtpPortHinweis: "587 = STARTTLS (üblich), 465 = TLS",
    imapHost: "IMAP-Host (Empfang)",
    imapHostPlatzhalter: "imap-mail.outlook.com",
    imapPort: "IMAP-Port",
    imapPortHinweis: "993 = IMAP über TLS (üblich)",
    benutzername: "Benutzername",
    benutzernamePlatzhalter: "firma@ihre-domain.de",
    benutzernameHinweis: "Gilt für SMTP und IMAP – ein Postfach-Login.",
    absenderadresse: "Absenderadresse",
    passwort: "Passwort",
    passwortPlatzhalter: "Postfach-Passwort oder App-Passwort…",
    passwortHinweis: "Zu finden in den SMTP-/IMAP-/E-Mail-Client-Einstellungen des E-Mail-Anbieters. Bei manchen Anbietern (z.B. Outlook, Gmail) wird ein separat generiertes App-Passwort benötigt statt des normalen Login-Passworts.",
    supportEmailLabel: "Support-E-Mail-Adresse",
    supportEmailKlammer: "(für automatische Tickets)",
    supportEmailPlatzhalter: "support@deine-firma.de",
    supportEmailHinweis: 'Diese Adresse gibst du Kunden als Support-Kontakt – meist identisch mit der Absenderadresse oben. Alle paar Minuten wird das Postfach automatisch nach neuen Mails durchsucht und daraus Tickets angelegt (kleine Verzögerung statt sofortiger Zustellung, dafür ohne Drittanbieter-Konto/Domain-Einrichtung). Unbekannte Absenderadressen erzeugen automatisch einen neuen Kunden-Account; antwortet jemand auf eine Ticket-Mail mit "#123" im Betreff (unverändert), wird die Antwort dem bestehenden Ticket zugeordnet statt ein neues zu öffnen.',
    fehlerSpeichern: "Fehler beim Speichern.",
    gespeichert: "Gespeichert.",
    speichert: "Speichert…",
    emailZugangsdatenSpeichern: "E-Mail-Zugangsdaten speichern",
    whatsappTitel: "WhatsApp → Ticket",
    whatsappBeschreibung: "WhatsApp-Nachrichten als Ticket anlegen (Meta Cloud API)",
    aktiv: "Aktiv",
    nichtKonfiguriert: "Nicht konfiguriert",
    phoneNumberId: "Phone Number ID",
    phoneNumberIdHinweis: "Meta → Anwendungsfall → Schritt 2: Produktionseinrichtung → Telefonnummer (oder im WhatsApp Manager bei deiner Nummer)",
    accessToken: "Access Token",
    appSecret: "App Secret",
    appSecretKlammer: "(optional)",
    appSecretPlatzhalter: "App-Geheimnis aus Meta…",
    appSecretHinweis: 'Nur nötig, wenn Meta "API calls require an appsecret_proof" meldet. Zu finden unter Meta → App-Einstellungen → Allgemein → App-Geheimnis.',
    webhookVerifyToken: "Webhook Verify Token",
    webhookTokenPlatzhalter: "Selbst gewählter geheimer Wert…",
    generieren: "Generieren",
    webhookUrlLabel: "Webhook-URL – bei Meta eintragen:",
    webhookUrlHinweis: 'Bei Meta unter "Schritt 2: Produktionseinrichtung" → Webhooks: diese URL + deinen Verify Token eintragen und das Feld "messages" abonnieren.',
    bitteZuerstEintragen: "Bitte zuerst Phone Number ID und Access Token eintragen und speichern.",
    tokenAbgelaufen: "Access Token ist ungültig/abgelaufen. Bitte einen permanenten System-User-Token erstellen (siehe Anleitung unten).",
    testFehlgeschlagen: "Test fehlgeschlagen.",
    verbundenTemplate: "Verbunden: {name}",
    qualitaetTemplate: " · Qualität: {qualitaet}",
    prueft: "Prüft…",
    verbindungTesten: "Verbindung testen",
    integrationenSpeichern: "Integrationen speichern",
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
  verwaltung: {
    titel: "Administration",
    tabFirma: "🏢 Company",
    tabTeam: "👥 Team",
    tabKunden: "🤝 Customers",
    tabDongles: "🔑 Dongles & Licenses",
    tabWerkzeuge: "🔧 Tools",
    tabIntegrationen: "🔌 Integrations",
    bitteFirmaWaehlen: "Please choose a company first.",
    firmenprofil: "Company profile",
    logoAendern: "Change logo",
    logoHinweis: "Recommended: square, at least 400×400px, max. 3 MB. Displayed up to 192×192px on the registration page.",
    logoBreiteLabel: "Logo width on the invoice",
    pxHinweis: "px (20–300, default 80)",
    slaReaktionszeitLabel: "SLA response time (optional)",
    slaPlatzhalter: "empty = no SLA",
    stunden: "hours",
    slaHinweis: "Tickets without a reply within this deadline are marked as overdue in the overview.",
    firmennamePlatzhalter: "Company name",
    adresseLabel: "Address",
    adressePlatzhalter: "Street, ZIP, city",
    telefonLabel: "Phone",
    telefonPlatzhalter: "+1 ...",
    emailLabel: "Email",
    emailPlatzhalter: "support@company.com",
    websiteLabel: "Website",
    oeffnungszeitenLabel: "Opening / availability hours",
    oeffnungszeitenPlatzhalter: "e.g. Mon–Fri 8am–5pm",
    standardpreisLabel: "Default price per minute in EUR (for billing)",
    individualisierung: "Customization",
    mottoLabel: "Motto / greeting line",
    mottoPlatzhalter: 'e.g. "Fast help, personal service"',
    akzentfarbeLabel: "Accent color",
    akzentfarbeHinweis: "Replaces the button and accent color throughout the app for your staff and customers.",
    heroBildLabel: "Homepage image (optional)",
    heroBildAendern: "Change image",
    heroBildHochladen: "+ Upload image",
    heroBildHinweis: "Recommended: landscape, at least 800px wide, max. 5 MB.",
    registrierungslinkLabel: "Registration link for customers",
    kopiert: "Copied ✓",
    kopieren: "Copy",
    registrierungslinkHinweis: "Link this on your website – customers can register through it themselves and land directly at your company.",
    datenschutzLabel: "Privacy policy",
    datenschutzHinweis: "Shown to customers as a required link during registration. Either link an existing page, or paste your own text (e.g. generated by a tool like eRecht24 or a privacy policy generator) – we'll then show it as its own page within the app. The link takes precedence if both are filled in.",
    datenschutzUrlPlatzhalter: "https://your-company.com/privacy (optional)",
    datenschutzTextPlatzhalter: "Or paste the full text of your privacy policy here…",
    speichert: "Saving…",
    speichern: "Save",
    fehlerUngueltigerPreis: "Invalid default price – other fields were saved anyway.",
    fehlerSlugVergeben: "This link name is already taken, please choose another.",
    fehlerSpeichern: "Failed to save.",
    erfolgGespeichert: "Saved.",
    erfolgLogoAktualisiert: "Logo updated.",
    fehlerLogoUpload: "Logo upload failed.",
    erfolgBildAktualisiert: "Image updated.",
    fehlerBildUpload: "Image upload failed.",
    team: "Team",
    abbrechen: "Cancel",
    bestehendenNutzerZuweisen: "Assign existing user",
    mitarbeiterAnlegenPlus: "+ Add staff member",
    zuweisenHinweis: "For people who already have an account – no new account needed. As a technician/org admin, the person will then also work here; existing memberships at other companies remain. Only as a customer is an account still limited to a single company (you'll get a warning beforehand if the person is already a customer elsewhere).",
    emailBestehenderAccount: "Email of the existing account",
    techniker: "Technician",
    orgAdmin: "Org admin",
    wirdZugewiesen: "Assigning…",
    zuweisen: "Assign",
    emailEinladungPlatzhalter: "Email (for the invitation)",
    vornamePlatzhalter: "First name",
    nachnamePlatzhalter: "Last name",
    telefonOptionalPlatzhalter: "Phone (optional)",
    passwortOptionalPlatzhalter: "Password (optional, instead of email invite)",
    generieren: "Generate",
    passwortHinweis: "Leave empty to generate an invite link. With a password: the account is usable immediately, no email is sent – you pass on the credentials yourself. Recommended for WhatsApp (links can get consumed there in advance).",
    wirdAngelegt: "Creating…",
    mitarbeiterMitPasswort: "Create staff member with password",
    mitarbeiterLinkErzeugen: "Create staff member & generate link",
    abgebrochenNiemand: "Cancelled – nobody was moved.",
    istJetztTeilDieserFirma: "is now part of this company.",
    kunden: "Customers",
    kundeAnlegenPlus: "+ Add customer",
    telefonWhatsappOptional: "Phone / WhatsApp (optional)",
    strasseOptional: "Street (optional)",
    nrLabel: "No.",
    plzLabel: "ZIP",
    ortLabel: "City",
    ustIdOptional: "VAT ID (optional, e.g. ATU12345678)",
    notizenOptional: "Notes / special details (optional)",
    kundeMitPasswort: "Create customer with password",
    kundeLinkErzeugen: "Create customer & generate link",
    fehlerAnlegenFehlgeschlagen: "Failed to create.",
    fehlerZuweisenFehlgeschlagen: "Assignment failed.",
    trotzdemZuweisen: "Assign anyway?",
  },
  mitarbeiterListe: {
    superAdmin: "Super admin",
    orgAdmin: "Org admin",
    techniker: "Technician",
    kunde: "Customer",
    fehlerLaden: "Could not load the team (see browser console for details).",
    fehlerAktion: "Action failed.",
    fehlerSpeichern: "Failed to save.",
    fehlerEmailUngueltig: "Please enter a valid email address.",
    fehlerEmailAendern: "Failed to change email.",
    erfolgEmailGeaendert: "Email changed.",
    fehlerAvatarUpload: "Profile picture upload failed.",
    fehlerLinkFehlgeschlagen: "Failed",
    fehlerNeuerLink: "Could not generate a new link. Is resend-zugang deployed?",
    keineDeaktivierten: "No deactivated members.",
    nochKeineTeamMitglieder: "No team members yet.",
    zurueckZumAktivenTeam: "← Back to active team",
    deaktivierteAnzeigen: "Show deactivated members",
    online: "Online",
    unbenannt: "Unnamed",
    urlaub: "On vacation",
    abwesend: "Away",
    profilbildAendern: "Change profile picture",
    vorname: "First name",
    nachname: "Last name",
    telefon: "Phone",
    rolle: "Role",
    verfuegbarkeitLabel: "Availability",
    verfuegbar: "Available",
    speichern: "Save",
    emailAendernTitel: "Change email address",
    aktuellLabel: "Current:",
    neueEmailPlatzhalter: "new@email.com",
    aendern: "Change",
    neuenZugangslinkErzeugen: "Generate new access link",
    wiederAktivieren: "Reactivate",
    ausFirmaEntfernen: "Remove from this company",
    ausFirmaEntfernenTitle: "Removes the person only from THIS company - other memberships remain.",
  },
  kundenListe: {
    fehlerLaden: "Customers could not be loaded (details in the browser console).",
    unbenannt: "Unnamed",
    fehlerAktion: "Action failed.",
    fehlerEmailVergeben: "This email address is already assigned to a customer.",
    fehlerEmailHinzufuegen: "Could not add email address.",
    fehlerZusammenfuehren: "Merge failed.",
    erfolgZusammengefuehrt: "Accounts merged.",
    fehlerUngueltigerPreis: "Invalid price – please enter e.g. 1.99.",
    fehlerPreisHinzufuegen: "Could not add price.",
    fehlerSpeichern: "Save failed.",
    fehlerAvatarUpload: "Profile picture upload failed.",
    fehlerDokumentUpload: "Document upload failed.",
    fehlerDokumentOeffnen: "Could not open document.",
    fehlerLinkFehlgeschlagen: "Failed",
    fehlerNeuerLink: "Could not generate new link. Is resend-zugang deployed?",
    suchePlatzhalter: "Search by name, phone, street, zip code, or city…",
    zurueckAktive: "← Active",
    archiv: "Archive",
    nachHardwareFiltern: "Filter by hardware…",
    wertWaehlen: "Select value…",
    zuruecksetzen: "Reset",
    keineDeaktiviertenKunden: "No deactivated customers.",
    nochKeineKunden: "No customers yet.",
    keineTreffer: "No matches for this search.",
    online: "Online",
    profilbildAendern: "Change profile picture",
    vorname: "First name",
    nachname: "Last name",
    emailLoginLabel: "Email (login)",
    nichtAenderbar: "– not changeable",
    weitereEmailsLabel: "Additional email addresses",
    weitereEmailsHinweis: "– e.g. when writing in from a different address",
    entfernen: "Remove",
    weitereEmailPlatzhalter: "additional.address@example.com",
    zusatzEmailHinweis: "Emails from saved addresses are automatically assigned to this customer (instead of creating a new account).",
    telefonWhatsapp: "Phone / WhatsApp",
    telefonPlatzhalter: "e.g. 4915112345678",
    strassePlatzhalter: "Street",
    nrPlatzhalter: "No.",
    plzPlatzhalter: "Zip code",
    ortPlatzhalter: "City",
    mwstHinweis: "Suggested value based on country, tax rate remains freely adjustable (e.g. small business, reverse charge).",
    ustIdLabel: "VAT ID (for tax-exempt intra-Community supply)",
    ustIdPlatzhalter: "e.g. ATU12345678",
    ustIdHinweis: 'If filled in, the invoice automatically shows 0% VAT and notes "Steuerfreie innergemeinschaftliche Lieferung / Tax-free intra-Community supply".',
    notizenLabel: "Notes / special notes",
    notizenPlatzhalter: "e.g. preferred availability, technical specifics…",
    individuellerPreisLabel: "Individual per-minute price (history, optional)",
    keinPreisGesetzt: "No individual price set yet – the company's standard price applies.",
    abPrefix: "from",
    aktuell: "Current",
    geplant: "Planned",
    preisPlatzhalter: "e.g. 1.99",
    preisHinweis: "Applies automatically from the selected date – older time entries remain unaffected at their price at the time.",
    speichern: "Save",
    dokumenteLabel: "Documents (independent of tickets)",
    loeschen: "Delete",
    dokumentHochladen: "+ Upload document",
    todoListe: "Todo list",
    hardware: "Hardware",
    donglesLizenzen: "Dongles / Licenses",
    lizenzvertraegeLabel: "License contracts (expiry/renewal)",
    laufzeit: "Term",
    bisPrefix: "until",
    tageSuffix: "days",
    abgelaufen: "(expired)",
    kontenZusammenfuehrenLabel: "Merge accounts",
    mitAnderemKontoZusammenfuehren: "Merge with another customer account…",
    zusammenfuehrenBeschreibungVor: "Choose the duplicate/older account (e.g. because the customer wrote from a different email address). All tickets, time entries, documents, prices, todos, dongles, license contracts, and hardware will move to",
    zusammenfuehrenBeschreibungNach: ", whose login email will be saved as an additional address and the duplicate account will then be deactivated.",
    diesemKunden: "this customer",
    wirdZusammengefuehrt: "Merging…",
    zusammenfuehren: "Merge",
    abbrechen: "Cancel",
    bitteAnderesKontoWaehlen: "Please select a different account.",
    neuenZugangslinkErzeugen: "Generate new access link",
    kontoZusammengefuehrtInVor: "This account was merged into",
    kontoZusammengefuehrtInNach: ". All tickets and data are located there – reactivating it would not undo the assignment.",
    einAnderesKonto: "another account",
    wiederAktivieren: "Reactivate",
    kundeDeaktivieren: "Deactivate customer",
    wenigerAnzeigen: "Show less",
    alleAnzeigenTemplate: "Show all {n}",
  },
  tagVerwaltung: {
    titel: "Tags / Categories",
    nameErforderlich: "Name required.",
    tagExistiertBereits: "This tag already exists.",
    fehler: "Error.",
    tagLoeschenConfirm: "Delete tag? It will also be removed from all tickets.",
    nochKeineTags: "No tags yet.",
    neuerTagPlatzhalter: "New tag…",
  },
  slaVerwaltung: {
    titel: "SLA & automation",
    slaAktivLabel: "SLA deadlines active (calculated when new tickets are created)",
    ersteReaktion: "First response (hours)",
    loesung: "Resolution (hours)",
    autoSchliessenLabel: "Auto-close (days without customer reply, empty = disabled)",
    autoSchliessenPlatzhalter: "e.g. 7",
    tage: "days",
    autoSchliessenHinweis: 'Tickets with status "Waiting for customer" are automatically closed after this time.',
    fehlerSpeichern: "Error saving.",
    gespeichert: "Saved.",
    speichert: "Saving…",
    speichern: "Save",
  },
  hardwareKategorienVerwaltung: {
    titel: "Hardware categories",
    beschreibung: "Freely definable categories, e.g. intraoral scanner, desktop scanner, exocad database, milling machine, printer. They then appear for every customer for quick one-click entry.",
    nameErforderlich: "Name required.",
    kategorieExistiertBereits: "This category already exists.",
    fehler: "Error.",
    loeschenConfirmTemplate: 'Delete category "{name}"? All values recorded for customers will also be deleted.',
    nochKeineKategorien: "No categories yet.",
    neueKategoriePlatzhalter: "New category, e.g. intraoral scanner…",
  },
  makroVerwaltung: {
    titelUndInhaltErforderlich: "Title and content are required.",
    fehlerSpeichern: "Error saving.",
    makroLoeschenConfirm: "Really delete this macro?",
    titel: "Macros (text snippets)",
    neuesMakro: "+ New macro",
    titelPlatzhalter: "Title (e.g. Reset password)",
    inhaltPlatzhalter: "Reply content…",
    speichern: "Save",
    abbrechen: "Cancel",
    nochKeineMakros: "No macros created yet.",
    loeschen: "Delete",
  },
  vorlagenVerwaltung: {
    titelUndBeschreibungErforderlich: "Title and description are required.",
    fehlerSpeichern: "Error saving.",
    vorlageLoeschenConfirm: "Really delete this template?",
    titel: "Ticket templates",
    neueVorlage: "+ New template",
    beschreibung: "Templates automatically fill in the title, description, and priority when creating a new ticket.",
    titelPlatzhalter: "Title (e.g. VPN not working)",
    beschreibungPlatzhalter: "Description that pre-fills the ticket…",
    speichern: "Save",
    abbrechen: "Cancel",
    nochKeineVorlagen: "No templates created yet.",
    loeschen: "Delete",
  },
  faqVerwaltung: {
    frageUndAntwortPflicht: "Question and answer are required fields.",
    loeschenConfirm: "Really delete this FAQ entry?",
    titel: "FAQ / Knowledge base",
    neuerEintrag: "+ New entry",
    oeffentlicherLink: "🔗 Public link:",
    kopiert: "✓ Copied",
    kopieren: "Copy",
    vorschau: "↗ Preview",
    slugHinweisVor: "Enter a slug under",
    firmaRegistrierungslink: "Company → Registration link",
    slugHinweisNach: "to activate the public FAQ link.",
    sichtbarkeitHinweis: "Public entries are visible to customers in the portal. Internal entries are only visible to your team.",
    fragePlatzhalter: "Question (e.g. How do I reset my password?)",
    antwortPlatzhalter: "Answer…",
    kategoriePlatzhalter: "Category (optional)",
    oeffentlich: "Public",
    speichern: "Save",
    abbrechen: "Cancel",
    nochKeineEintraege: "No entries yet. Add frequently asked questions so customers can help themselves.",
    intern: "Internal",
    loeschen: "Delete",
    kategorieLabel: "Category",
  },
  reportingExport: {
    titel: "Export data",
    beschreibung: "All exports as CSV files (UTF-8, comma-separated) – can be opened directly in Excel or Google Sheets.",
    von: "From",
    bis: "To",
    ticketsLabel: "🎫 Export tickets",
    ticketsSub: "All tickets with status, SLA, CSAT",
    zeitLabel: "⏱ Export time tracking",
    zeitSub: "All time entries with minutes and description",
    csatLabel: "⭐ Export CSAT ratings",
    csatSub: "Only tickets with customer rating",
    csvTicketsKopf: ["Ticket no.", "Title", "Status", "Priority", "Created", "First response", "Response due", "Resolution due", "CSAT", "Customer", "Assigned"],
    csvZeitKopf: ["Date", "Minutes", "Hours", "Description", "Type", "Ticket no.", "Ticket", "Technician", "Customer"],
    csvCsatKopf: ["Ticket no.", "Title", "Rating", "Rated on", "Customer", "Technician"],
    positiv: "Positive",
    negativ: "Negative",
    positivMitEmoji: "Positive 👍",
    negativMitEmoji: "Negative 👎",
  },
  tarifVerwaltung: {
    laedt: "Loading…",
    beschreibung: "The base fee covers a certain number of employees. Beyond that, the tiers apply (staggered by absolute employee count).",
    neuerTarif: "+ New plan",
    namePflicht: "Please enter a name.",
    anlegenFehlgeschlagen: "Failed to create.",
    tarifNamePlatzhalter: "Plan name (e.g. Starter, Business)",
    anlegen: "Create",
    nochKeineTarife: "No plans created yet.",
    aktiv: "Active",
    loeschen: "Delete",
    loeschenConfirm: "Really delete this plan? Only possible if it isn't assigned to any company.",
    loeschenFehlgeschlagen: "Delete failed – this plan is still assigned to at least one company.",
    grundgebuehr: "Base fee (€/month)",
    inklusiveMitarbeiter: "Included employees",
    mwst: "VAT (%)",
    staffelnLabel: "Tiers (from employee #)",
    staffelHinzufuegen: "+ Tier",
    keineStaffeln: "No tiers – nothing is charged beyond the included number.",
    von: "from",
    bis: "to",
    proMa: "€/employee",
  },
  plattformRechnungDetail: {
    laedt: "Loading…",
    nichtGefunden: "Invoice not found.",
    zurueck: "← Back",
    sende: "Sending…",
    perEmailVersenden: "Send by email",
    versendetAm: "✓ Sent",
    drucken: "Print / Save as PDF",
    keineEmailHinterlegt: "This company has no email address on file.",
    smtpNichtKonfiguriert: "Mail sending is not set up yet (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing).",
    versandFehlgeschlagen: "Sending failed.",
    versandFehlgeschlagenNetzwerk: "Sending failed (network error).",
    ustIdLabel: "VAT ID:",
    steuernummerLabel: "Tax number:",
    rechnungTitel: "Invoice",
    leistungszeitraum: "Billing period:",
    rechnungsdatum: "Invoice date:",
    faelligAm: "Due on:",
    tageSuffix: "days",
    firma: "Company",
    tarifTemplate: 'Plan "{name}" · {n} active employees',
    positionSpalte: "Item",
    betragSpalte: "Amount",
    netto: "Net",
    mwstTemplate: "VAT ({satz} %)",
    gesamtBrutto: "Total (gross)",
    ueberweisungVor: "Please transfer the amount by",
    faelligkeitsdatum: "the due date",
    ueberweisungNach: "to IBAN {iban}.",
  },
  integrationenVerwaltung: {
    kopieren: "Copy",
    verbergen: "Hide",
    anzeigen: "Show",
    titel: "Integrations",
    emailTitel: "Email (send & receive)",
    emailBeschreibung: "One mailbox for customer notifications (SMTP) and automatic tickets from incoming mail (IMAP)",
    versandLabel: "Sending:",
    versandEigenesPostfach: "Own mailbox",
    versandGemeinsam: "Shared",
    empfangLabel: "Receiving:",
    empfangAktiv: "Active",
    empfangNichtKonfiguriert: "Not configured",
    emailHinweis: "Without your own settings here, the platform's central shared mailbox is used for sending. Enter this company's own mailbox credentials so customers receive mail from your own address and replies to that address automatically become tickets.",
    smtpHost: "SMTP host (sending)",
    smtpHostPlatzhalter: "smtp-mail.outlook.com",
    smtpPort: "SMTP port",
    smtpPortHinweis: "587 = STARTTLS (common), 465 = TLS",
    imapHost: "IMAP host (receiving)",
    imapHostPlatzhalter: "imap-mail.outlook.com",
    imapPort: "IMAP port",
    imapPortHinweis: "993 = IMAP over TLS (common)",
    benutzername: "Username",
    benutzernamePlatzhalter: "company@your-domain.com",
    benutzernameHinweis: "Applies to both SMTP and IMAP – one mailbox login.",
    absenderadresse: "Sender address",
    passwort: "Password",
    passwortPlatzhalter: "Mailbox password or app password…",
    passwortHinweis: "Found in the email provider's SMTP/IMAP/email client settings. Some providers (e.g. Outlook, Gmail) require a separately generated app password instead of the normal login password.",
    supportEmailLabel: "Support email address",
    supportEmailKlammer: "(for automatic tickets)",
    supportEmailPlatzhalter: "support@your-company.com",
    supportEmailHinweis: 'You give this address to customers as the support contact – usually identical to the sender address above. Every few minutes, the mailbox is automatically checked for new mail and tickets are created from it (small delay instead of instant delivery, but without a third-party account/domain setup). Unknown sender addresses automatically create a new customer account; if someone replies to a ticket email with "#123" in the subject (unchanged), the reply is assigned to the existing ticket instead of opening a new one.',
    fehlerSpeichern: "Error saving.",
    gespeichert: "Saved.",
    speichert: "Saving…",
    emailZugangsdatenSpeichern: "Save email credentials",
    whatsappTitel: "WhatsApp → Ticket",
    whatsappBeschreibung: "Create tickets from WhatsApp messages (Meta Cloud API)",
    aktiv: "Active",
    nichtKonfiguriert: "Not configured",
    phoneNumberId: "Phone Number ID",
    phoneNumberIdHinweis: "Meta → Use case → Step 2: Production setup → Phone number (or in WhatsApp Manager under your number)",
    accessToken: "Access Token",
    appSecret: "App Secret",
    appSecretKlammer: "(optional)",
    appSecretPlatzhalter: "App secret from Meta…",
    appSecretHinweis: 'Only needed if Meta reports "API calls require an appsecret_proof". Found under Meta → App settings → Basic → App secret.',
    webhookVerifyToken: "Webhook Verify Token",
    webhookTokenPlatzhalter: "Your own secret value…",
    generieren: "Generate",
    webhookUrlLabel: "Webhook URL – enter at Meta:",
    webhookUrlHinweis: 'At Meta under "Step 2: Production setup" → Webhooks: enter this URL + your verify token and subscribe to the "messages" field.',
    bitteZuerstEintragen: "Please enter and save the Phone Number ID and Access Token first.",
    tokenAbgelaufen: "Access Token is invalid/expired. Please create a permanent system-user token (see instructions below).",
    testFehlgeschlagen: "Test failed.",
    verbundenTemplate: "Connected: {name}",
    qualitaetTemplate: " · Quality: {qualitaet}",
    prueft: "Checking…",
    verbindungTesten: "Test connection",
    integrationenSpeichern: "Save integrations",
  },
};

const WOERTERBUCH: Record<Sprache, Uebersetzung> = { de, en };

export function texte(sprache: Sprache): Uebersetzung {
  return WOERTERBUCH[sprache];
}
