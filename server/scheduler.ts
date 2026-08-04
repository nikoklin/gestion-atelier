import cron from "node-cron";
import { checkAndSendReminders } from "./emailService";
import { performDailyBackup } from "./scheduledBackup";
import { checkAndProcessMissedCheckouts } from "./missedCheckoutService";
import { recalculateAllResidents, getAtelierSettings } from "./db";

let schedulerStarted = false;

// Heure actuelle (0-23) à Paris, indépendamment du fuseau horaire du serveur
// (Railway tourne en UTC) — nécessaire pour comparer correctement aux heures
// configurées par Nicolas dans les paramètres (points 10 et 17).
function getCurrentHourInParis(): number {
  const hourStr = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(hourStr, 10) % 24;
}

export function startScheduler() {
  if (schedulerStarted) {
    console.log("[Scheduler] Already started");
    return;
  }

  // Vérifie toutes les heures (à Paris) si c'est l'heure configurée pour
  // l'envoi des rappels automatiques (réglage "reminderSendHour", 9h par défaut).
  cron.schedule("0 * * * *", async () => {
    const settings = await getAtelierSettings();
    const targetHour = settings?.reminderSendHour ?? 9;
    if (getCurrentHourInParis() !== targetHour) return;
    console.log(`[Scheduler] Running daily email check at ${targetHour}:00 (Europe/Paris)`);
    await checkAndSendReminders();
  }, { timezone: "Europe/Paris" });

  // Recalcul quotidien de tous les résidents à 00h05 : désactive les forfaits
  // dont la date de fin est passée et maintient la cohérence des heures.
  cron.schedule("5 0 * * *", async () => {
    console.log("[Scheduler] Running daily recalculation at 00:05");
    try {
      const res = await recalculateAllResidents();
      console.log(`[Scheduler] Daily recalculation done: ${res.residents} residents`);
    } catch (error) {
      console.error("[Scheduler] Daily recalculation failed:", error);
    }
  }, { timezone: "Europe/Paris" });

  // Vérifie toutes les heures (à Paris) si c'est l'heure configurée pour la
  // clôture automatique des pointages oubliés (réglage "missedCheckoutCutoffHour", 22h par défaut).
  cron.schedule("0 * * * *", async () => {
    const settings = await getAtelierSettings();
    const targetHour = settings?.missedCheckoutCutoffHour ?? 22;
    if (getCurrentHourInParis() !== targetHour) return;
    console.log(`[Scheduler] Running missed checkout check at ${targetHour}:00 (Europe/Paris)`);
    try {
      await checkAndProcessMissedCheckouts();
    } catch (error) {
      console.error("[Scheduler] Missed checkout check failed:", error);
    }
  }, { timezone: "Europe/Paris" });

  // Planifier la sauvegarde quotidienne à 22h05 (après les pointages automatiques)
  cron.schedule("5 22 * * *", async () => {
    console.log("[Scheduler] Running daily backup at 22:05");
    try {
      await performDailyBackup();
    } catch (error) {
      console.error("[Scheduler] Daily backup failed:", error);
    }
  }, { timezone: "Europe/Paris" });

  schedulerStarted = true;
  console.log("[Scheduler] Email reminder scheduler started (heure configurable dans Paramètres, 9h par défaut)");
  console.log("[Scheduler] Missed checkout check scheduler started (heure configurable dans Paramètres, 22h par défaut)");
  console.log("[Scheduler] Daily backup scheduler started (daily at 22:05)");
}

export function stopScheduler() {
  // node-cron ne fournit pas de méthode directe pour arrêter toutes les tâches
  // mais on peut marquer le scheduler comme arrêté
  schedulerStarted = false;
  console.log("[Scheduler] Scheduler stopped");
}
