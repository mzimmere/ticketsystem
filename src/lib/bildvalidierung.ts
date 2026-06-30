// Prüft eine Bilddatei vor dem Hochladen auf Dateigröße und Mindestmaße.
// Gibt eine Fehlermeldung zurück (string) wenn etwas nicht passt, sonst null.
export async function pruefeBild(
  datei: File,
  optionen: { maxSizeMb?: number; minDimensionPx?: number } = {},
): Promise<string | null> {
  const { maxSizeMb = 5, minDimensionPx } = optionen;

  if (datei.size > maxSizeMb * 1024 * 1024) {
    return `Datei ist zu groß (max. ${maxSizeMb} MB).`;
  }

  if (minDimensionPx) {
    const massE = await ladeBildmasse(datei);
    if (massE && (massE.breite < minDimensionPx || massE.hoehe < minDimensionPx)) {
      return `Bild ist sehr klein (${massE.breite}×${massE.hoehe}px) – empfohlen sind mindestens ${minDimensionPx}×${minDimensionPx}px für eine scharfe Darstellung. Wird trotzdem hochgeladen.`;
    }
  }

  return null;
}

function ladeBildmasse(datei: File): Promise<{ breite: number; hoehe: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ breite: img.naturalWidth, hoehe: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
