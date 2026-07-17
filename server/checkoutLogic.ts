/**
 * Logique commune de checkout pour éviter la duplication de code
 */

import * as db from "./db";
import { isPackageExpired, minutesToHoursAndMinutes } from "../shared/packageHelpers";
import { Resident, InsertPackage } from "../drizzle/schema";
import { getPublicSiteUrl } from "./_core/publicSiteUrl";

export interface CheckoutResult {
  success: boolean;
  action: 'checkout';
  resident?: Resident;
  durationMinutes: number;
  remainingHours?: number;
  remainingMinutes?: number;
}

export interface CheckoutOptions {
  attendanceId: number;
  packageId: number | null;
  residentEmail?: string;
  residentFirstName?: string;
  residentId: number;
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
  const checkOutTime = new Date();
  const checkInTime = new Date(attendance.checkInTime);
  const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

  // Mettre à jour le pointage
  await db.updateAttendance(attendanceId, {
    checkOutTime,
    durationMinutes,
  });

  // Mettre à jour le forfait
  if (packageId === null) {
    return {
      success: true,
      action: 'checkout',
      durationMinutes,
    };
  }
  
  const pkg = await db.getPackageById(packageId);
  if (!pkg) {
    return {
      success: true,
      action: 'checkout',
      durationMinutes,
    };
  }

  // Recalculer depuis la base (usedHours plafonné, outOfPackageMinutes, remainingMinutes)
  const recalc = await db.recalculatePackageHours(packageId);
  const remainingMinutes = recalc.remainingMinutes;

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

  // Envoyer l'e-mail de fin de session avec conversion via helper
  if (residentEmail && residentFirstName) {
    const { hours, minutes } = minutesToHoursAndMinutes(remainingMinutes);
    const { sendSessionSummaryEmail } = await import('./emailService');
    const baseUrl = getPublicSiteUrl();
    const dashboardUrl = `${baseUrl}/resident/dashboard?id=${residentId}`;
    await sendSessionSummaryEmail(
      residentEmail,
      residentFirstName,
      durationMinutes,
      hours,
      minutes,
      dashboardUrl,
      false,
      residentId,
      pkg.id,
      recalc.outOfPackageMinutes
    ).catch(err => {
      console.error('[Email] Failed to send session summary:', err);
    });
  }

  // Vérifier si le forfait vient d'être épuisé et envoyer un e-mail d'expiration
  const isNowExpired = remainingMinutes <= 0 || packageExpired;
  if (isNowExpired && !pkg.expirationEmailSent && residentEmail && residentFirstName) {
    const { sendExpirationEmail } = await import('./emailService');
    await sendExpirationEmail(
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
