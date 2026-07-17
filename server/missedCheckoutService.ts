import { eq, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { attendances, residents } from "../drizzle/schema";
import { sendEmail } from "./emailService";
import { createFixCheckoutToken } from "./actionTokenService";
import { getPublicSiteUrl } from "./_core/publicSiteUrl";

/**
 * Vérifie les pointages non terminés et effectue un pointage automatique à 22h
 * Envoie un email au résident et marque le résident comme ayant oublié de pointer
 */
export async function checkAndProcessMissedCheckouts(): Promise<{ processed: number }> {
  const db = await getDb();
  if (!db) {
    console.error("[MissedCheckout] Database not available");
    return { processed: 0 };
  }

  console.log("[MissedCheckout] Checking for missed checkouts at 22:00");

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

      // Effectuer le pointage de sortie automatique à 22h
      const checkOutTime = new Date();
      checkOutTime.setHours(22, 0, 0, 0);

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

      // Formater la durée pour l'email
      const durationHours = Math.floor(durationMinutes / 60);
      const durationMins = durationMinutes % 60;

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
      const emailSubject = "Pointage de sortie automatique - Gestion d'Atelier";
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2c5f2e;">Pointage de sortie automatique</h2>
        <p>Bonjour ${attendance.resident.firstName},</p>
        <p>Nous avons remarqué que tu as oublié de pointer en partant de l'atelier aujourd'hui.</p>
        <p><strong>Détails du pointage :</strong></p>
        <ul>
          <li><strong>Arrivée :</strong> ${checkInTime.toLocaleString("fr-FR")}</li>
          <li><strong>Départ automatique :</strong> ${checkOutTime.toLocaleString("fr-FR")}</li>
          <li><strong>Durée de la session :</strong> ${durationHours}h${durationMins.toString().padStart(2, "0")}</li>
        </ul>
        <p>Un pointage de sortie automatique a été effectué à 22h00.</p>
        ${fixCheckoutUrl ? `
        <p style="margin: 20px 0;">
          <strong>Si l'heure de départ est incorrecte</strong>, tu peux la corriger en cliquant ici (lien valable 48h) :<br><br>
          <a href="${fixCheckoutUrl}" style="background-color: #e67e22; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">✏️ Corriger mon heure de sortie</a>
        </p>` : ''}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p>Merci de penser à pointer en partant la prochaine fois.</p>
        <p>Bonne journée.<br>Nicolas – <em>À Tour de Bras</em></p>
        </div>
      `;

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
