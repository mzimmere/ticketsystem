// PostgREST liefert pro Anfrage maximal 1000 Zeilen - bei grossen Bestaenden
// seitenweise nachladen, sonst stimmen Zaehler und Exporte nicht.
export async function ladeSeiten<T>(
  bauen: (von: number, bis: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const alle: T[] = [];
  for (let von = 0; ; von += 1000) {
    const { data } = await bauen(von, von + 999);
    alle.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return alle;
}
