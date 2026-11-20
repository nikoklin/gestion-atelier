/**
 * Forfaits terminés figés : seul le forfait « de référence » reste modifiable.
 * C'est le forfait en cours s'il y en a un, sinon le dernier forfait démarré
 * (pour pouvoir encore régulariser, par exemple avec « + Heures »). Les forfaits
 * plus anciens ont servi à calculer les suivants : on n'y touche plus.
 * Règle partagée par le serveur (refus) et la page résident (boutons grisés).
 */

type LockPackage = {
  id: number;
  status: string;
  totalHours: number;
  usedHours: number;
  startDate: Date | string;
  endDate: Date | string;
  createdAt?: Date | string | null;
};

const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

export function referencePackage<P extends LockPackage>(pkgs: P[], now: Date = new Date()): P | null {
  const real = pkgs
    .filter((p) => p.status !== "pending")
    .sort((a, b) => time(b.startDate) - time(a.startDate) || time(b.createdAt) - time(a.createdAt) || b.id - a.id);
  const current = real.find((p) => p.totalHours - p.usedHours > 0 && new Date(p.endDate) >= now);
  return current ?? real[0] ?? null;
}

/** Forfait terminé dont les heures et les dates ne peuvent plus être modifiées. */
export function isPackageLocked(pkg: LockPackage, pkgs: LockPackage[], now: Date = new Date()): boolean {
  if (pkg.status === "pending") return false;
  const ref = referencePackage(pkgs, now);
  return !!ref && ref.id !== pkg.id;
}

/**
 * Pointage qui ne peut plus être modifié ni supprimé. Avec un forfait en cours :
 * tout ce qui ne lui appartient pas (forfaits terminés, hors forfait reporté).
 * Sans forfait en cours : les pointages des forfaits plus anciens que le dernier ;
 * ceux du dernier forfait et les pointages hors forfait restent corrigeables.
 */
export function isAttendanceLocked(
  attendance: { packageId: number | null },
  pkgs: LockPackage[],
  now: Date = new Date()
): boolean {
  const ref = referencePackage(pkgs, now);
  if (!ref) return false;
  const isCurrent = ref.totalHours - ref.usedHours > 0 && new Date(ref.endDate) >= now;
  if (isCurrent) return attendance.packageId !== ref.id;
  return attendance.packageId !== null && attendance.packageId !== ref.id;
}
