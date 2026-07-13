/**
 * Helpers pour la gestion des forfaits
 * 
 * IMPORTANT: Les champs totalHours et usedHours dans la base de données
 * stockent des MINUTES malgré leur nom (pour des raisons historiques).
 * 
 * Utilisez toujours ces helpers pour éviter toute confusion.
 */

export type PackageType = "15h_8w" | "30h_8w" | "30h_4w" | "180h_6m";

/**
 * Obtenir le total de minutes selon le type de forfait
 * @param packageType Type de forfait
 * @returns Nombre total de minutes
 */
export function getTotalMinutes(packageType: PackageType): number {
  switch (packageType) {
    case "15h_8w":
      return 15 * 60; // 900 minutes
    case "30h_8w":
    case "30h_4w":
      return 30 * 60; // 1800 minutes
    case "180h_6m":
      return 180 * 60; // 10800 minutes
    default:
      return 0;
  }
}

/**
 * Calculer la date de fin selon le type de forfait
 * @param startDate Date de début
 * @param packageType Type de forfait
 * @returns Date de fin
 */
export function calculateEndDate(startDate: Date, packageType: PackageType): Date {
  const end = new Date(startDate);
  switch (packageType) {
    case "15h_8w":
    case "30h_8w":
      end.setDate(end.getDate() + 56); // 8 semaines
      break;
    case "30h_4w":
      end.setDate(end.getDate() + 28); // 4 semaines
      break;
    case "180h_6m":
      end.setMonth(end.getMonth() + 6); // 6 mois
      break;
  }
  return end;
}

/**
 * Obtenir le label d'affichage d'un type de forfait
 * @param packageType Type de forfait
 * @returns Label lisible
 */
export function getPackageLabel(packageType: PackageType): string {
  switch (packageType) {
    case "15h_8w":
      return "15h / 8 semaines";
    case "30h_8w":
      return "30h / 8 semaines";
    case "30h_4w":
      return "30h / 4 semaines";
    case "180h_6m":
      return "180h / 6 mois";
    default:
      return packageType;
  }
}

/**
 * Convertir des minutes en format lisible (heures et minutes)
 * @param totalMinutes Nombre total de minutes
 * @returns Objet avec heures et minutes séparées
 */
export function minutesToHoursAndMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}

/**
 * Formater des minutes en chaîne lisible (ex: "15h30")
 * @param totalMinutes Nombre total de minutes
 * @returns Chaîne formatée
 */
export function formatMinutesAsHours(totalMinutes: number): string {
  const { hours, minutes } = minutesToHoursAndMinutes(totalMinutes);
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

/**
 * Vérifier si un forfait est expiré par date
 * @param endDate Date de fin du forfait
 * @returns true si expiré
 */
export function isExpiredByDate(endDate: Date | null): boolean {
  if (!endDate) return false;
  return new Date() > new Date(endDate);
}

/**
 * Vérifier si un forfait est épuisé par heures
 * @param usedMinutes Minutes utilisées (valeur du champ usedHours en base)
 * @param totalMinutes Minutes totales (valeur du champ totalHours en base)
 * @returns true si épuisé
 */
export function isExhaustedByHours(usedMinutes: number, totalMinutes: number): boolean {
  return usedMinutes >= totalMinutes;
}

/**
 * Vérifier si un forfait est expiré (par date OU par heures)
 * @param endDate Date de fin du forfait
 * @param usedMinutes Minutes utilisées
 * @param totalMinutes Minutes totales
 * @returns true si expiré
 */
export function isPackageExpired(
  endDate: Date | null,
  usedMinutes: number,
  totalMinutes: number
): boolean {
  return isExpiredByDate(endDate) || isExhaustedByHours(usedMinutes, totalMinutes);
}
