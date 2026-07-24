import { google } from "googleapis";
import { Readable } from "stream";

/**
 * Upload un fichier vers un dossier Google Drive partagé avec le compte de
 * service de l'atelier. Nécessite GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 (le JSON
 * de la clé du compte de service, encodé en base64) et
 * GOOGLE_DRIVE_BACKUP_FOLDER_ID (l'ID du dossier Drive, partagé en Éditeur
 * avec l'e-mail du compte de service) — configurés en variables Railway.
 */
export async function uploadToAtelierDrive(
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ uploaded: boolean; reason?: string; fileId?: string }> {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;

  if (!keyBase64 || !folderId) {
    return { uploaded: false, reason: "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 ou GOOGLE_DRIVE_BACKUP_FOLDER_ID non configuré" };
  }

  const credentials = JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
  });

  return { uploaded: true, fileId: res.data.id ?? undefined };
}
