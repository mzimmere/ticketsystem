// Erzeugt ein zufälliges Passwort, das sich noch halbwegs gut vorlesen/
// abtippen lässt (keine verwechselbaren Zeichen wie 0/O oder 1/l).
const ZEICHEN = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generierePasswort(laenge = 12): string {
  let ergebnis = "";
  for (let i = 0; i < laenge; i++) {
    ergebnis += ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)];
  }
  return ergebnis;
}
