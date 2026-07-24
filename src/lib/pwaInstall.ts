// PWA-Installation: Chrome/Edge/Android feuern "beforeinstallprompt" genau
// einmal und sehr frueh - oft bevor die HowTo-Komponente ueberhaupt
// gemountet ist. Deshalb wird das Event hier auf Modul-Ebene abgefangen
// (laeuft beim App-Start, da App.tsx dieses Modul importiert) und
// zwischengespeichert, damit die Hilfe es spaeter noch ausloesen kann.
//
// iOS/Safari kennt dieses Event nicht - dort gibt es nur den manuellen Weg
// ueber "Teilen -> Zum Home-Bildschirm", siehe HowTo.tsx.

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let gespeichertesEvent: InstallEvent | null = null;
const abonnenten = new Set<() => void>();

function benachrichtige() {
  abonnenten.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Verhindert den automatischen Browser-Banner - wir bieten die
    // Installation stattdessen bewusst in der Hilfe an.
    e.preventDefault();
    gespeichertesEvent = e as InstallEvent;
    benachrichtige();
  });

  window.addEventListener("appinstalled", () => {
    gespeichertesEvent = null;
    benachrichtige();
  });
}

export function installationMoeglich(): boolean {
  return gespeichertesEvent !== null;
}

export function aufAenderungHoeren(fn: () => void): () => void {
  abonnenten.add(fn);
  return () => {
    abonnenten.delete(fn);
  };
}

export async function installationStarten(): Promise<"accepted" | "dismissed" | "nicht_moeglich"> {
  if (!gespeichertesEvent) return "nicht_moeglich";
  await gespeichertesEvent.prompt();
  const { outcome } = await gespeichertesEvent.userChoice;
  // Das Event ist einmalig - nach der Nutzung ist es verbraucht.
  gespeichertesEvent = null;
  benachrichtige();
  return outcome;
}

// Laeuft die App bereits als installierte App (Standalone-Fenster ohne
// Browser-Adressleiste)? Dann ist der Installations-Hinweis ueberfluessig.
export function laeuftAlsApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function istIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
