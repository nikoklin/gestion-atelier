import { router, protectedProcedure } from "./_core/trpc";
import { checkAndSendReminders } from "./emailService";
import * as db from "./db";
import { z } from "zod";

export const emailRouter = router({
  // Déclencher manuellement la vérification et l'envoi des e-mails
  sendReminders: protectedProcedure.mutation(async () => {
    await checkAndSendReminders();
    return { success: true, message: "Vérification des rappels effectuée" };
  }),

  // Réinitialiser les flags d'envoi d'e-mails pour tous les forfaits (uniquement le dernier de chaque résident)
  resetEmailFlags: protectedProcedure.mutation(async () => {
    const allPackages = await db.getAllPackages();
    
    // Grouper les forfaits par résident et garder le plus récent (ID le plus élevé)
    const latestPackagesByResident = new Map<number, typeof allPackages[0]>();
    for (const pkg of allPackages) {
      const existing = latestPackagesByResident.get(pkg.residentId);
      if (!existing || pkg.id > existing.id) {
        latestPackagesByResident.set(pkg.residentId, pkg);
      }
    }

    const latestPackages = Array.from(latestPackagesByResident.values());
    let resetCount = 0;

    for (const pkg of latestPackages) {
      if (pkg.reminderSent || pkg.expirationEmailSent) {
        await db.updatePackage(pkg.id, {
          reminderSent: false,
          expirationEmailSent: false,
        });
        resetCount++;
      }
    }

    return { 
      success: true, 
      message: `Flags réinitialisés pour ${resetCount} forfait(s)`,
      resetCount 
    };
  }),

  // Réinitialiser les flags d'envoi d'e-mails pour un résident spécifique
  resetResidentEmailFlags: protectedProcedure
    .input(z.object({ residentId: z.number() }))
    .mutation(async ({ input }) => {
      const packages = await db.getPackagesByResidentId(input.residentId);
      let resetCount = 0;

      for (const pkg of packages) {
        if (pkg.isActive && (pkg.reminderSent || pkg.expirationEmailSent)) {
          await db.updatePackage(pkg.id, {
            reminderSent: false,
            expirationEmailSent: false,
          });
          resetCount++;
        }
      }

      return { 
        success: true, 
        message: `Flags réinitialisés pour ${resetCount} forfait(s)`,
        resetCount 
      };
    }),

  // Envoyer un e-mail de rappel à un résident spécifique
  sendReminderToResident: protectedProcedure
    .input(z.object({ residentId: z.number() }))
    .mutation(async ({ input }) => {
      const resident = await db.getResidentById(input.residentId);
      if (!resident) {
        throw new Error("Résident non trouvé");
      }

      // Récupérer le forfait actif OU le dernier forfait du résident (même expiré)
      const activePackage = await db.getActivePackageByResidentId(input.residentId);
      
      // Si pas de forfait actif, chercher le dernier forfait (même terminé)
      let targetPackage = activePackage;
      if (!targetPackage) {
        const allPackages = await db.getPackagesByResidentId(input.residentId);
        if (allPackages.length > 0) {
          targetPackage = allPackages[0]; // déjà trié par createdAt desc
        }
      }
      
      const packageId = targetPackage?.id || 0;
      
      // Déterminer le type d'email à envoyer selon l'état du forfait
      const remainingMinutes = targetPackage ? targetPackage.totalHours - targetPackage.usedHours : 0;
      const isExpiredByHours = remainingMinutes <= 0;
      const isExpiredByDate = targetPackage?.endDate && new Date(targetPackage.endDate) < new Date();
      const isExpired = isExpiredByHours || isExpiredByDate || !targetPackage;
      
      // Vérifier que le résident a un email
      if (!resident.email) {
        return {
          success: false,
          message: `Aucune adresse e-mail renseignée pour ${resident.firstName} ${resident.lastName}`
        };
      }
      
      let success = false;
      
      if (isExpired) {
        // Forfait épuisé ou expiré : envoyer un email d'expiration
        const { sendExpirationEmail } = await import("./emailService");
        success = await sendExpirationEmail(
          resident.email,
          resident.firstName,
          input.residentId,
          packageId
        );
        
        if (success && targetPackage) {
          await db.updatePackage(targetPackage.id, {
            expirationEmailSent: true,
          });
        }
      } else {
        // Forfait actif : envoyer un email de rappel
        const { sendReminderEmail } = await import("./emailService");
        success = await sendReminderEmail(
          resident.email,
          resident.firstName,
          input.residentId,
          packageId
        );
        
        if (success && targetPackage) {
          await db.updatePackage(targetPackage.id, {
            reminderSent: true,
          });
        }
      }

      return {
        success,
        message: success 
          ? `E-mail de rappel envoyé à ${resident.firstName} ${resident.lastName}` 
          : "Échec de l'envoi de l'e-mail"
      };
    }),

  // Effacer l'historique des e-mails
  clearEmailHistory: protectedProcedure.mutation(async () => {
    await db.clearEmailLogs();
    return { success: true };
  }),

  // Récupérer l'historique des e-mails envoyés
  getEmailHistory: protectedProcedure.query(async () => {
    const logs = await db.getRecentEmailLogs(100);
    
    // Enrichir avec les informations des résidents
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const resident = await db.getResidentById(log.residentId);
        return {
          ...log,
          residentName: resident ? `${resident.firstName} ${resident.lastName}` : 'Inconnu',
        };
      })
    );
    
    return enrichedLogs;
  }),
});

