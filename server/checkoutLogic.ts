/**
 * Logique commune de checkout pour éviter la duplication de code
 */

import * as db from "./db";
import { isPackageExpired, minutesToHoursAndMinutes } from "../shared/packageHelpers";
import { Resident, InsertPackage } from "../drizzle/schema";

export interface CheckoutResult {
  success: boolean;
  action: 'checkout';
  resident?: Resident;
  durationMinutes: number;
  isOutOfPackage?: boolean;
  remainingHours?: number;
  remainingMinutes?: number;
}

export interface CheckoutOptions {
  attendanceId: number;
  packageId: number | null;
  residentEmail?: string;
  residentFirstName?: string;
  residentId: number;
  // Heure réelle du départ (pointage arrivé en retard depuis la file de la tablette) ; par défaut maintenant.
  checkOutTime?: Date;
}

// Résumé de séance envoyé au résident, en arrière-plan (la borne n'attend pas
// l'envoi). Aussi pour une séance hors forfait (aucun forfait valable) : il y
// trouve ses heures hors forfait et les liens pour prendre un forfait.
async function sendSessionSummaryInBackground(
  options: CheckoutOptions,
  durationMinutes: number,
  remainingMinutes: number,
  packageId: number | null,
  outOfPackageMinutes: number
) {
  const { residentEmail, residentFirstName, residentId } = options;
  if (!residentEmail || !residentFirstName) return;
  const { hours, minutes } = minutesToHoursAndMinutes(remainingMinutes);
  const { sendSessionSummaryEmail, dashboardUrlFor } = await import('./emailService');
  const dashboardUrl = await dashboardUrlFor(residentId);
  void sendSessionSummaryEmail(
    residentEmail,
    residentFirstName,
    durationMinutes,
    hours,
    minutes,
    dashboardUrl,
    false,
    residentId,
    packageId ?? undefined,
    outOfPackageMinutes
  ).catch(err => {
    console.error('[Email] Failed to send session summary:', err);
  });
}

/**
 * Effectue le checkout d'un pointage et met à jour le forfait
 * @param options Options de checkout
 * @returns Résultat du checkout
 */
export async function performCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
  const { attendanceId, packageId, residentEmail, residentFirstName, residentId } = options;

  // Récupérer le pointage
  const attendance = await db.getAttendanceById(attendanceId);
  if (!attendance) {
    throw new Error("Attendance not found");
  }

  // Calculer la durée
  const checkOutTime = options.checkOutTime ?? new Date();
  const checkInTime = new Date(attendance.checkInTime);
  const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

  // Mettre à jour le pointage
  await db.updateAttendance(attendanceId, {
    checkOutTime,
    durationMinutes,
  });

  // Mettre à jour le forfait — sans forfait, la session est hors-forfait :
  // il faut quand même recalculer (sinon resident.outOfPackageMinutes reste
  // périmé jusqu'au recalcul nocturne), puis renvoyer le solde réel à jour.
  if (packageId === null) {
    await db.fullRecalculateResident(residentId);
    const resident = await db.getResidentById(residentId);
    const outOfPackageMinutes = resident?.outOfPackageMinutes ?? 0;
    await sendSessionSummaryInBackground(options, durationMinutes, 0, null, outOfPackageMinutes);
    return {
      success: true,
      action: 'checkout',
      durationMinutes,
      isOutOfPackage: true,
      remainingHours: Math.floor(outOfPackageMinutes / 60),
      remainingMinutes: outOfPackageMinutes % 60,
    };
  }

  const pkg = await db.getPackageById(packageId);
  if (!pkg) {
    await db.fullRecalculateResident(residentId);
    const resident = await db.getResidentById(residentId);
    const outOfPackageMinutes = resident?.outOfPackageMinutes ?? 0;
    await sendSessionSummaryInBackground(options, durationMinutes, 0, null, outOfPackageMinutes);
    return {
      success: true,
      action: 'checkout',
      durationMinutes,
      isOutOfPackage: true,
      remainingHours: Math.floor(outOfPackageMinutes / 60),
      remainingMinutes: outOfPackageMinutes % 60,
    };
  }

  // Recalculer depuis la base (usedHours plafonné, outOfPackageMinutes, remainingMinutes)
  const recalc = await db.recalculatePackageHours(packageId);

  // Si ce départ a épuisé le forfait et qu'un forfait payé d'avance a pris le
  // relais (voir db.activateNextQueuedPackage), le résident n'est pas à court :
  // pas d'e-mail « forfait terminé », et le temps restant est celui du nouveau forfait.
  const successor = await db.getActivePackageByResidentId(residentId);
  const tookOver = !!successor && successor.id !== packageId;
  const remainingMinutes = tookOver
    ? Math.max(0, successor!.totalHours - successor!.usedHours)
    : recalc.remainingMinutes;

  // Vérifier si le forfait est expiré (par date OU par heures) en utilisant le helper
  // Recharger le forfait après recalcul pour avoir les valeurs à jour
  const updatedPkg = await db.getPackageById(packageId);
  const packageExpired = isPackageExpired(
    updatedPkg?.endDate ?? pkg.endDate,
    updatedPkg?.usedHours ?? recalc.usedHours,
    pkg.totalHours
  );

  // Préparer les mises à jour supplémentaires du forfait (emails, isActive)
  const packageUpdates: Partial<InsertPackage> = {};

  // Envoyer l'e-mail de fin de session
  await sendSessionSummaryInBackground(options, durationMinutes, remainingMinutes, pkg.id, recalc.outOfPackageMinutes);

  // Vérifier si le forfait vient d'être épuisé et envoyer un e-mail d'expiration,
  // sauf si le forfait suivant est déjà payé et attend la validation de l'atelier.
  const isNowExpired = !tookOver && (remainingMinutes <= 0 || packageExpired);
  const hasNextPackage = isNowExpired && !pkg.expirationEmailSent
    && (await db.getPackagesByResidentId(residentId)).some((p) => p.status === 'pending');
  if (isNowExpired && !pkg.expirationEmailSent && !hasNextPackage && residentEmail && residentFirstName) {
    const { sendExpirationEmail } = await import('./emailService');
    // Envoyé en arrière-plan ; le forfait est marqué « e-mail envoyé » dès maintenant
    // (comme avant, même en cas d'échec d'envoi, pour ne pas le renvoyer en boucle).
    void sendExpirationEmail(
      residentEmail,
      residentFirstName,
      residentId,
      pkg.id
    ).catch(err => {
      console.error('[Email] Failed to send expiration email:', err);
    });

    // Marquer l'e-mail d'expiration comme envoyé
    packageUpdates.expirationEmailSent = true;
  }

  // Désactiver automatiquement le forfait s'il est épuisé
  if (isNowExpired && pkg.isActive) {
    packageUpdates.isActive = false;
  }

  // Appliquer toutes les mises à jour en une seule fois
  if (Object.keys(packageUpdates).length > 0) {
    await db.updatePackage(pkg.id, packageUpdates);
  }

  // Réinitialiser le flag hasMissedCheckout si ce checkout correspond au pointage signalé
  try {
    const resident = await db.getResidentById(residentId);
    if (resident && resident.hasMissedCheckout && resident.missedCheckoutAttendanceId === attendanceId) {
      await db.updateResident(residentId, {
        hasMissedCheckout: false,
        missedCheckoutAttendanceId: null,
      });
    }
  } catch (e) {
    console.error('[Checkout] Failed to reset hasMissedCheckout:', e);
  }

  // Le cumul hors forfait a déjà été mis à jour par recalculatePackageHours

  // Retourner le résultat avec conversion via helper
  const { hours, minutes } = minutesToHoursAndMinutes(remainingMinutes);
  return {
    success: true,
    action: 'checkout',
    durationMinutes,
    remainingHours: hours,
    remainingMinutes: minutes,
  };
}
