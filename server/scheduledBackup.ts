import { generateExcelExport } from "./exportService";
import { writeFile } from "fs/promises";
import { join } from "path";

/**
 * Fonction de sauvegarde automatique quotidienne
 * Cette fonction génère un export Excel et le sauvegarde dans le dossier backups
 */
export async function performDailyBackup() {
  try {
    console.log("[Backup] Starting daily backup...");
    
    // Générer l'export Excel
    const buffer = await generateExcelExport();
    
    // Créer le nom du fichier avec la date
    const date = new Date();
    const filename = `backup_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}h${String(date.getMinutes()).padStart(2, '0')}.xlsx`;
    
    // Chemin du dossier de sauvegarde
    const backupDir = join(process.cwd(), "backups");
    const filePath = join(backupDir, filename);
    
    // Créer le dossier backups s'il n'existe pas
    const { mkdir } = await import("fs/promises");
    try {
      await mkdir(backupDir, { recursive: true });
    } catch (error) {
      // Le dossier existe déjà, on continue
    }
    
    // Sauvegarder le fichier
    await writeFile(filePath, buffer);
    
    console.log(`[Backup] Backup saved successfully: ${filename}`);
    console.log(`[Backup] File path: ${filePath}`);
    
    return { success: true, filename, filePath };
  } catch (error) {
    console.error("[Backup] Error during backup:", error);
    throw error;
  }
}

/**
 * Configuration du cron job pour la sauvegarde quotidienne à 22h
 * Cette fonction doit être appelée au démarrage du serveur
 */
export function scheduleDailyBackup() {
  // Utiliser node-cron pour planifier la sauvegarde
  const cron = require("node-cron");
  
  // Planifier la sauvegarde tous les jours à 22h00
  // Format: minute heure jour mois jour-de-la-semaine
  cron.schedule("0 22 * * *", async () => {
    console.log("[Backup] Running scheduled backup at 22:00...");
    try {
      await performDailyBackup();
    } catch (error) {
      console.error("[Backup] Scheduled backup failed:", error);
    }
  }, {
    timezone: "Europe/Paris" // Fuseau horaire français
  });
  
  console.log("[Backup] Daily backup scheduled at 22:00 (Europe/Paris)");
}
