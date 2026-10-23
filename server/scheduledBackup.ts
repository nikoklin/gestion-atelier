import { generateExcelExport } from "./exportService";
import { uploadToAtelierDrive } from "./driveUpload";
import { formatParisTime, getParisDateString } from "./_core/timezone";

/**
 * Fonction de sauvegarde automatique quotidienne
 * Génère un export Excel et l'envoie dans le dossier Drive de l'atelier.
 * (Un enregistrement sur le disque du serveur ne servirait à rien : Railway
 * n'a pas de disque persistant, le fichier serait perdu au prochain déploiement.)
 */
export async function performDailyBackup() {
  try {
    console.log("[Backup] Starting daily backup...");

    // Générer l'export Excel
    const buffer = await generateExcelExport();

    // Nom du fichier avec la date et l'heure de Paris (le serveur tourne en UTC)
    const date = new Date();
    const filename = `backup_${getParisDateString(date)}_${formatParisTime(date).replace(":", "h")}.xlsx`;

    const result = await uploadToAtelierDrive(
      filename,
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    if (!result.uploaded) {
      console.error(`[Backup] Drive upload skipped: ${result.reason}`);
      return { success: false, filename, reason: result.reason };
    }

    console.log(`[Backup] Backup uploaded to Drive: ${filename} (fileId=${result.fileId})`);

    return { success: true, filename, fileId: result.fileId };
  } catch (error) {
    console.error("[Backup] Error during backup:", error);
    throw error;
  }
}
