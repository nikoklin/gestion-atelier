/**
 * Noms affichés sur la tablette de pointage : premier prénom + initiale du nom
 * (« Jean Patrick Martin » → « Jean M. »). Un prénom composé avec un trait d'union
 * (« Marie-Claire ») est un seul prénom. Si deux résidents donneraient le même nom
 * court, on ajoute des lettres du nom jusqu'à les distinguer (« Jean Ma. » / « Jean Mo. »).
 */
export function kioskDisplayNames(residents: { id: number; firstName: string; lastName: string }[]): Map<number, string> {
  const parts = residents.map((r) => ({
    id: r.id,
    first: (r.firstName ?? "").trim().split(/\s+/)[0] ?? "",
    last: (r.lastName ?? "").trim(),
  }));
  const label = (first: string, last: string, letters: number) => {
    if (!last) return first;
    if (letters >= last.length) return `${first} ${last}`;
    const start = last.slice(0, letters);
    return `${first} ${start.charAt(0).toLocaleUpperCase("fr-FR")}${start.slice(1).toLocaleLowerCase("fr-FR")}.`;
  };
  const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const names = new Map<number, string>();
  const letters = new Map(parts.map((p) => [p.id, 1]));
  // Allonge le nom des seuls résidents en conflit, jusqu'à ce que tous soient distincts.
  for (let round = 0; round < 50; round++) {
    const groups = new Map<string, typeof parts>();
    for (const p of parts) {
      const k = key(label(p.first, p.last, letters.get(p.id)!));
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    let changed = false;
    for (const group of Array.from(groups.values())) {
      if (group.length < 2) continue;
      for (const p of group) {
        if (letters.get(p.id)! < p.last.length) {
          letters.set(p.id, letters.get(p.id)! + 1);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (const p of parts) names.set(p.id, label(p.first, p.last, letters.get(p.id)!));
  return names;
}
