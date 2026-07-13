import cron from "node-cron";
import { checkAndSendReminders } from "./emailService";
import { performDailyBackup } from "./scheduledBackup";
import { checkAndProcessMissedCheckouts } from "./missedCheckoutService";

let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) {
    console.log("[Scheduler] Already started");
    return;
  }

  // Planifier l'envoi quotidien à 9h00 (format: secondes minutes heures jour mois jour-semaine)
  // 0 9 * * * = tous les jours à 9h00
  cron.schedule("0 9 * * *", async () => {
    console.log("[Scheduler] Running daily email check at 9:00 AM");
    await checkAndSendReminders();
  });

  // Planifier la vérification des pointages oubliés à 22h00
  // 0 22 * * * = tous les jours à 22h00
  cron.schedule("0 22 * * *", async () => {
    console.log("[Scheduler] Running missed checkout check at 22:00");
    try {
      await checkAndProcessMissedCheckouts();
    } catch (error) {
      console.error("[Scheduler] Missed checkout check failed:", error);
    }
  });

  // Planifier la sauvegarde quotidienne à 22h05 (après les pointages automatiques)
  // 5 22 * * * = tous les jours à 22h05
  cron.schedule("5 22 * * *", async () => {
    console.log("[Scheduler] Running daily backup at 22:05");
    try {
      await performDailyBackup();
    } catch (error) {
      console.error("[Scheduler] Daily backup failed:", error);
    }
  });

  schedulerStarted = true;
  console.log("[Scheduler] Email reminder scheduler started (daily at 9:00 AM)");
  console.log("[Scheduler] Missed checkout check scheduler started (daily at 22:00)");
  console.log("[Scheduler] Daily backup scheduler started (daily at 22:05)");

  // Exécuter immédiatement au démarrage pour tester (optionnel)
  // Décommenter la ligne suivante si vous voulez tester immédiatement
  // checkAndSendReminders();
}

export function stopScheduler() {
  // node-cron ne fournit pas de méthode directe pour arrêter toutes les tâches
  // mais on peut marquer le scheduler comme arrêté
  schedulerStarted = false;
  console.log("[Scheduler] Scheduler stopped");
}
