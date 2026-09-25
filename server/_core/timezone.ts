// Le serveur (Railway) tourne en UTC, alors que l'atelier raisonne en heure de
// Paris. Tout affichage d'heure côté serveur (e-mails, exports) et toute
// construction d'une heure "du jour" doit passer par ces helpers, sinon on
// obtient un décalage de 1 à 2 heures selon la saison.
export const APP_TIMEZONE = "Europe/Paris";

export function formatParisDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("fr-FR", { timeZone: APP_TIMEZONE });
}

export function formatParisDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(date).toLocaleDateString("fr-FR", { timeZone: APP_TIMEZONE, ...options });
}

// Heure "HH:mm" d'un instant, vue depuis Paris.
export function formatParisTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("fr-FR", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Date civile (YYYY-MM-DD) d'un instant, vue depuis Paris.
export function getParisDateString(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

// Décalage (en ms) de Paris par rapport à UTC à un instant donné (+1h ou +2h).
function getParisOffsetMs(date: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIMEZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

// Construit l'instant correspondant à "dateStr (YYYY-MM-DD) à hour:minute,
// heure de Paris".
export function parisDateTimeToDate(dateStr: string, hour: number, minute: number): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  let result = utcGuess - getParisOffsetMs(new Date(utcGuess));
  // Deuxième passe pour les jours de changement d'heure.
  result = utcGuess - getParisOffsetMs(new Date(result));
  return new Date(result);
}
