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
    hilfeFrage: string;
    neueAnfrageStellen: string;
    neueAnfrageSub: string;
    meineAnfragen: string;
    meineAnfragenSub: string;
    warenAnfragen: string;
    wartetAufMich: string;
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
    hilfeFrage: "Wie können wir dir heute helfen?",
    neueAnfrageStellen: "Neue Anfrage stellen",
    neueAnfrageSub: "Beschreibe dein Anliegen – wir melden uns",
    meineAnfragen: "Meine Anfragen",
    meineAnfragenSub: "Status und Verlauf aller deiner Tickets",
    warenAnfragen: "Meine Anfragen",
    wartetAufMich: "Warten auf mich",
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
    hilfeFrage: "How can we help you today?",
    neueAnfrageStellen: "Submit new request",
    neueAnfrageSub: "Describe your issue – we'll get back to you",
    meineAnfragen: "My requests",
    meineAnfragenSub: "Status and history of all your tickets",
    warenAnfragen: "My requests",
    wartetAufMich: "Waiting on me",
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
};

const WOERTERBUCH: Record<Sprache, Uebersetzung> = { de, en };

export function texte(sprache: Sprache): Uebersetzung {
  return WOERTERBUCH[sprache];
}
