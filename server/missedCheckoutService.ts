import { eq, isNull } from "drizzle-orm";
import { getDb, getAtelierSettings } from "./db";
import { attendances, residents } from "../drizzle/schema";
import { sendEmail, wrapEmailHtml } from "./emailService";
import { createFixCheckoutToken } from "./actionTokenService";
import { getPublicSiteUrl } from "./_core/publicSiteUrl";
import { formatParisDateTime, getParisDateString, parisDateTimeToDate } from "./_core/timezone";

export const MISSED_CHECKOUT_EMAIL_SUBJECT = "Pointage de sortie automatique - Gestion d'Atelier";

// Corps de l'e-mail envoyé quand un départ oublié est clôturé automatiquement.
export function renderMissedCheckoutEmail(params: {
  firstName: string;
  checkInTime: Date;
  checkOutTime: Date;
  durationMinutes: number;
  fixCheckoutUrl: string;
}): string {
  const durationHours = Math.floor(params.durationMinutes / 60);
  const durationMins = params.durationMinutes % 60;
  return wrapEmailHtml(`
        <p style="margin-top: 0;">Bonjour ${params.firstName},</p>
        <p>Nous avons remarqué que tu as oublié de pointer en partant de l'atelier aujourd'hui.</p>
        <p><strong>Détails du pointage :</strong></p>
        <ul>
          <li><strong>Arrivée :</strong> ${formatParisDateTime(params.checkInTime)}</li>
          <li><strong>Départ automatique :</strong> ${formatParisDateTime(params.checkOutTime)}</li>
          <li><strong>Durée de la session :</strong> ${durationHours}h${durationMins.toString().padStart(2, "0")}</li>
        </ul>
        <p>Un pointage de sortie automatique a été effectué.</p>
        ${params.fixCheckoutUrl ? `<p><strong>Si l'heure de départ est incorrecte</strong>, tu peux la corriger avec le bouton ci-dessous (lien valable 48h).</p>` : ''}
      `, params.fixCheckoutUrl ? { actionButton: { href: params.fixCheckoutUrl, label: "Corriger mon heure de sortie" } } : {});
}

/**
 * Vérifie les pointages non terminés et effectue un pointage automatique à
 * l'heure de clôture configurée dans Paramètres (missedCheckoutCutoffHour,
 * 22h par défaut).
 * Envoie un email au résident et marque le résident comme ayant oublié de pointer
 */
export async function checkAndProcessMissedCheckouts(): Promise<{ processed: number }> {
  const db = await getDb();
  if (!db) {
    console.error("[MissedCheckout] Database not available");
    return { processed: 0 };
  }

  const settings = await getAtelierSettings();
  const cutoffHour = settings?.missedCheckoutCutoffHour ?? 22;

  console.log(`[MissedCheckout] Checking for missed checkouts at ${cutoffHour}:00`);

  try {
    // Récupérer tous les pointages non terminés (checkOut = null)
    const openAttendances = await db
      .select({
        id: attendances.id,
        residentId: attendances.residentId,
        packageId: attendances.packageId,
        checkInTime: attendances.checkInTime,
        resident: {
          id: residents.id,
          firstName: residents.firstName,
          lastName: residents.lastName,
          email: residents.email,
        },
      })
      .from(attendances)
      .leftJoin(residents, eq(residents.id, attendances.residentId))
      .where(isNull(attendances.checkOutTime));

    if (openAttendances.length === 0) {
      console.log("[MissedCheckout] No missed checkouts found");
      return { processed: 0 };
    }

    console.log(`[MissedCheckout] Found ${openAttendances.length} missed checkout(s)`);

    // Pour chaque pointage non terminé
    for (const attendance of openAttendances) {
      if (!attendance.resident) {
        console.warn(`[MissedCheckout] Resident not found for attendance ${attendance.id}`);
        continue;
      }

      // Effectuer le pointage de sortie automatique à l'heure de clôture configurée
      // (heure de Paris : le serveur tourne en UTC).
      const checkOutTime = parisDateTimeToDate(getParisDateString(new Date()), cutoffHour, 0);

      // Calculer la durée de la session
      const checkInTime = new Date(attendance.checkInTime);
      const durationMs = checkOutTime.getTime() - checkInTime.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));

      await db
        .update(attendances)
        .set({
          checkOutTime: checkOutTime,
          durationMinutes: durationMinutes,
        })
        .where(eq(attendances.id, attendance.id));

      // Marquer le résident comme ayant oublié de pointer et stocker l'ID du pointage
      await db
        .update(residents)
        .set({
          hasMissedCheckout: true,
          missedCheckoutAttendanceId: attendance.id,
        })
        .where(eq(residents.id, attendance.residentId));

      // Générer un token de correction
      const baseUrl = getPublicSiteUrl();
      let fixCheckoutUrl = '';
      try {
        const token = await createFixCheckoutToken(attendance.residentId, attendance.id);
        fixCheckoutUrl = `${baseUrl}/fix-checkout?token=${token}`;
      } catch (tokenError) {
        console.error('[MissedCheckout] Failed to create fix checkout token:', tokenError);
      }

      // Envoyer un email au résident
      const emailSubject = MISSED_CHECKOUT_EMAIL_SUBJECT;
      const emailContent = renderMissedCheckoutEmail({
        firstName: attendance.resident.firstName,
        checkInTime,
        checkOutTime,
        durationMinutes,
        fixCheckoutUrl,
      });

      try {
        await sendEmail(
          attendance.resident.email,
          emailSubject,
          emailContent
        );

        console.log(
          `[MissedCheckout] Processed missed checkout for ${attendance.resident.firstName} ${attendance.resident.lastName} (ID: ${attendance.residentId})`
        );
      } catch (emailError) {
        console.error(
          `[MissedCheckout] Failed to send email to ${attendance.resident.email}:`,
          emailError
        );
      }
    }

    console.log(`[MissedCheckout] Processed ${openAttendances.length} missed checkout(s)`);
    return { processed: openAttendances.length };
  } catch (error) {
    console.error("[MissedCheckout] Error processing missed checkouts:", error);
    return { processed: 0 };
  }
}
