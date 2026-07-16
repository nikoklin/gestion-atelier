import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import { getSessionCookieOptions } from "./_core/cookies";
import { signSession } from "./_core/session";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { emailRouter } from "./emailRouter";
import { cronRouter } from "./cronRouter";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { validateToken, markTokenUsed } from "./actionTokenService";
import * as emailService from "./emailService";
import { eq } from "drizzle-orm";
import { attendances } from "../drizzle/schema";

// Helper pour calculer la date de fin selon le type de forfait
function calculateEndDate(startDate: Date, packageType: string): Date {
  const end = new Date(startDate);
  switch (packageType) {
    case "15h_8w":
    case "30h_8w":
      end.setDate(end.getDate() + 56); // 8 semaines
      break;
    case "30h_4w":
      end.setDate(end.getDate() + 28); // 4 semaines
      break;
    case "180h_6m":
      end.setMonth(end.getMonth() + 6); // 6 mois
      break;
  }
  return end;
}

// Helper pour obtenir les heures totales selon le type de forfait
function getTotalHours(packageType: string): number {
  switch (packageType) {
    case "15h_8w":
      return 15 * 60; // en minutes
    case "30h_8w":
    case "30h_4w":
      return 30 * 60; // en minutes
    case "180h_6m":
      return 180 * 60; // en minutes
    default:
      return 0;
  }
}

export const appRouter = router({
  system: systemRouter,
  email: emailRouter,
  cron: cronRouter,
  stats: router({
    getAttendanceStats: protectedProcedure.query(async () => {
      const attendances = await db.getAllAttendances();
      
      // Statistiques par résident
      const statsByResident = attendances.reduce((acc: any, att: any) => {
        const name = `${att.residentFirstName} ${att.residentLastName}`;
        if (!acc[name]) {
          acc[name] = { name, totalMinutes: 0, sessions: 0 };
        }
        if (att.durationMinutes) {
          acc[name].totalMinutes += att.durationMinutes;
          acc[name].sessions += 1;
        }
        return acc;
      }, {});

      // Statistiques par jour (7 derniers jours)
      const last7Days = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayAttendances = attendances.filter((att: any) => {
          const checkIn = new Date(att.checkInTime);
          return checkIn >= date && checkIn < nextDate;
        });
        
        const totalMinutes = dayAttendances.reduce((sum: number, att: any) => 
          sum + (att.durationMinutes || 0), 0);
        
        last7Days.push({
          date: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
          hours: Math.round(totalMinutes / 60 * 10) / 10,
          sessions: dayAttendances.length
        });
      }

      return {
        byResident: Object.values(statsByResident)
          .sort((a: any, b: any) => b.totalMinutes - a.totalMinutes)
          .slice(0, 10),
        last7Days,
        totalSessions: attendances.length,
        totalHours: Math.round(attendances.reduce((sum: number, att: any) => 
          sum + (att.durationMinutes || 0), 0) / 60 * 10) / 10
      };
    }),

    getPackageStats: protectedProcedure
      .input(z.object({
        residentId: z.number().optional(),
        period: z.enum(["month", "quarter", "year", "all"]).default("all"),
      }))
      .query(async ({ input }) => {
        // Prix des forfaits (en euros)
        const PACKAGE_PRICES: Record<string, number> = {
          "15h_8w": 175,
          "30h_8w": 270,
          "30h_4w": 170,
          "180h_6m": 850,
        };

        // Récupérer tous les forfaits (avec infos résident)
        const allPackages = await db.getAllPackages();
        const allResidents = await db.getAllResidents();

        // Créer un map residentId -> nom
        const residentNames = new Map<number, string>();
        for (const r of allResidents) {
          residentNames.set(r.id, `${r.firstName} ${r.lastName}`);
        }

        // Filtrer par résident si demandé
        let filteredPackages = allPackages;
        if (input.residentId) {
          filteredPackages = allPackages.filter(p => p.residentId === input.residentId);
        }

        // Filtrer par période (basé sur createdAt)
        const now = new Date();
        if (input.period !== "all") {
          const cutoff = new Date(now);
          if (input.period === "month") cutoff.setMonth(cutoff.getMonth() - 1);
          else if (input.period === "quarter") cutoff.setMonth(cutoff.getMonth() - 3);
          else if (input.period === "year") cutoff.setFullYear(cutoff.getFullYear() - 1);
          filteredPackages = filteredPackages.filter(p => new Date(p.createdAt) >= cutoff);
        }

        // 1. Forfaits par catégorie
        const byCategory: Record<string, { count: number; revenue: number }> = {
          "15h_8w": { count: 0, revenue: 0 },
          "30h_8w": { count: 0, revenue: 0 },
          "30h_4w": { count: 0, revenue: 0 },
          "180h_6m": { count: 0, revenue: 0 },
        };
        for (const pkg of filteredPackages) {
          if (byCategory[pkg.packageType]) {
            byCategory[pkg.packageType].count++;
            byCategory[pkg.packageType].revenue += PACKAGE_PRICES[pkg.packageType] ?? 0;
          }
        }

        // 2. Forfaits par mois (pour graphique temporel)
        const byMonth: Record<string, { count: number; revenue: number }> = {};
        for (const pkg of filteredPackages) {
          const d = new Date(pkg.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!byMonth[key]) byMonth[key] = { count: 0, revenue: 0 };
          byMonth[key].count++;
          byMonth[key].revenue += PACKAGE_PRICES[pkg.packageType] ?? 0;
        }
        const byMonthSorted = Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({
            month,
            label: new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
            ...data,
          }));

        // 3. Totaux globaux
        const totalPackages = filteredPackages.length;
        const totalRevenue = filteredPackages.reduce((sum, p) => sum + (PACKAGE_PRICES[p.packageType] ?? 0), 0);

        // 4. Forfaits expirés prématurément (heures épuisées avant la date de fin)
        // isActive=false ET usedHours >= totalHours ET endDate > now (date pas encore atteinte)
        const expiredEarly = filteredPackages.filter(p => {
          if (p.isActive) return false;
          const hoursExhausted = p.usedHours >= p.totalHours;
          const dateNotReached = new Date(p.endDate) > now;
          return hoursExhausted && dateNotReached;
        });

        // 5. Forfaits expirés par date (date atteinte avec heures non utilisées)
        // isActive=false ET endDate < now ET usedHours < totalHours
        const expiredByDate = filteredPackages.filter(p => {
          if (p.isActive) return false;
          const dateReached = new Date(p.endDate) <= now;
          const hasUnusedHours = p.usedHours < p.totalHours;
          return dateReached && hasUnusedHours;
        });

        const expiredByDateWithLostHours = expiredByDate.map(p => ({
          id: p.id,
          residentId: p.residentId,
          residentName: residentNames.get(p.residentId) ?? 'Inconnu',
          packageType: p.packageType,
          endDate: p.endDate,
          lostMinutes: p.totalHours - p.usedHours,
          lostHours: Math.round((p.totalHours - p.usedHours) / 60 * 10) / 10,
        }));

        const totalLostMinutes = expiredByDate.reduce((sum, p) => sum + (p.totalHours - p.usedHours), 0);

        // 6. Stats par résident (pour tableau détaillé)
        const byResident: Record<number, {
          residentId: number;
          residentName: string;
          totalPackages: number;
          totalRevenue: number;
          expiredEarlyCount: number;
          expiredByDateCount: number;
          lostHours: number;
        }> = {};

        for (const pkg of filteredPackages) {
          if (!byResident[pkg.residentId]) {
            byResident[pkg.residentId] = {
              residentId: pkg.residentId,
              residentName: residentNames.get(pkg.residentId) ?? 'Inconnu',
              totalPackages: 0,
              totalRevenue: 0,
              expiredEarlyCount: 0,
              expiredByDateCount: 0,
              lostHours: 0,
            };
          }
          const r = byResident[pkg.residentId];
          r.totalPackages++;
          r.totalRevenue += PACKAGE_PRICES[pkg.packageType] ?? 0;

          // Expiré prématurément
          if (!pkg.isActive && pkg.usedHours >= pkg.totalHours && new Date(pkg.endDate) > now) {
            r.expiredEarlyCount++;
          }
          // Expiré par date avec heures perdues
          if (!pkg.isActive && new Date(pkg.endDate) <= now && pkg.usedHours < pkg.totalHours) {
            r.expiredByDateCount++;
            r.lostHours += Math.round((pkg.totalHours - pkg.usedHours) / 60 * 10) / 10;
          }
        }

        return {
          totalPackages,
          totalRevenue,
          byCategory: Object.entries(byCategory).map(([type, data]) => ({
            type,
            label: type === '15h_8w' ? '15h/8sem' : type === '30h_8w' ? '30h/8sem' : type === '30h_4w' ? '30h/4sem' : '180h/6mois',
            price: PACKAGE_PRICES[type] ?? 0,
            ...data,
          })),
          byMonth: byMonthSorted,
          expiredEarlyCount: expiredEarly.length,
          expiredByDateCount: expiredByDate.length,
          totalLostHours: Math.round(totalLostMinutes / 60 * 10) / 10,
          expiredByDateDetails: expiredByDateWithLostHours,
          byResident: Object.values(byResident).sort((a, b) => b.totalRevenue - a.totalRevenue),
        };
      }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const invalidCredentials = new TRPCError({
          code: "UNAUTHORIZED",
          message: "E-mail ou mot de passe incorrect",
        });

        const user = await db.getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw invalidCredentials;
        }

        const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
        if (!passwordOk) {
          throw invalidCredentials;
        }

        const token = await signSession(
          { openId: user.openId, name: user.name ?? "" },
          { expiresInMs: ONE_YEAR_MS }
        );

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  residentAuth: router({
    loginByEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const resident = await db.getResidentByEmail(input.email);
        if (!resident || !resident.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Résident non trouvé ou inactif" });
        }
        return { success: true, residentId: resident.id };
      }),

    getInfo: publicProcedure
      .input(z.object({ residentId: z.number() }))
      .query(async ({ input }) => {
        const resident = await db.getResidentById(input.residentId);
        if (!resident) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Résident non trouvé" });
        }

        // Chercher d'abord un forfait actif, sinon prendre le dernier forfait (actif ou non)
        let activePackage = await db.getActivePackageByResidentId(input.residentId);
        if (!activePackage) {
          // Pas de forfait actif : récupérer le dernier forfait (terminé ou expiré)
          const allPkgs = await db.getPackagesByResidentId(input.residentId);
          activePackage = allPkgs.length > 0 ? allPkgs[0] : null;
        }
        // Afficher les pointages du forfait trouvé (en cours ou dernier)
        const attendances = activePackage
          ? await db.getAttendancesByPackageId(activePackage.id)
          : [];

        return {
          resident,
          activePackage,
          attendances,
        };
      }),

    createManualSession: publicProcedure
      .input(z.object({
        residentId: z.number(),
        checkInTime: z.string(),
        checkOutTime: z.string(),
      }))
      .mutation(async ({ input }) => {
        const resident = await db.getResidentById(input.residentId);
        if (!resident || !resident.isActive) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Résident non trouvé ou inactif' });
        }

        const checkInTime = new Date(input.checkInTime);
        const checkOutTime = new Date(input.checkOutTime);

        // Validation : heure de départ après heure d'arrivée
        if (checkOutTime <= checkInTime) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: "L'heure de départ doit être après l'heure d'arrivée.",
          });
        }

        // Validation : uniquement le jour même
        const today = new Date();
        const isToday = (d: Date) =>
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate();
        if (!isToday(checkInTime) || !isToday(checkOutTime)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'La session doit être enregistrée pour le jour même uniquement.',
          });
        }

        // Validation : pas de pointage en cours
        const openAttendance = await db.getOpenAttendance(input.residentId);
        if (openAttendance) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Un pointage est déjà en cours. Termine-le avant d\'enregistrer une session manuelle.',
          });
        }

        // Récupérer le forfait actif
        const activePackage = await db.getActivePackageByResidentId(input.residentId);
        if (!activePackage) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Aucun forfait actif. Contacte l\'atelier pour souscrire à un forfait.',
          });
        }

        // Validation : pas avant le début du forfait
        if (activePackage.startDate) {
          const packageStartDate = new Date(activePackage.startDate);
          if (checkInTime < packageStartDate) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `La session ne peut pas être avant le début du forfait (${packageStartDate.toLocaleDateString('fr-FR')}).`,
            });
          }
        }

        const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
        if (durationMinutes < 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'La durée de la session doit être d\'au moins 1 minute.',
          });
        }

        await db.createAttendance({
          residentId: input.residentId,
          packageId: activePackage.id,
          checkInTime,
          checkOutTime,
          durationMinutes,
        });

        // Recalcul global pour garantir la cohérence de tous les forfaits du résident
        await db.fullRecalculateResident(input.residentId);

        return { success: true, durationMinutes };
      }),
  }),

  residents: router({
    list: protectedProcedure.query(async () => {
      const residents = await db.getAllResidents();
      const residentsWithLastReminder = await Promise.all(
        residents.map(async (resident) => {
          const lastReminder = await db.getLastReminderByResidentId(resident.id);
          return {
            ...resident,
            lastReminderDate: lastReminder?.sentAt || null,
          };
        })
      );
      return residentsWithLastReminder;
    }),

    listActive: protectedProcedure.query(async () => {
      return await db.getActiveResidents();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const resident = await db.getResidentById(input.id);
        if (!resident) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Résident non trouvé" });
        }
        return resident;
      }),

    create: protectedProcedure
      .input(z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().max(320).optional().or(z.literal('')),
        phone: z.string().max(20).optional(),
        pin: z.string().regex(/^\d{4}$/).optional().or(z.literal('')),
        shelfNumber: z.string().max(20).optional().or(z.literal('')),
        artistSignature: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        await db.createResident({
          ...input,
          email: input.email || '',
          pin: input.pin || null,
          shelfNumber: input.shelfNumber || null,
          artistSignature: input.artistSignature || null,
          isActive: true,
        });
        // Envoyer le guide des bonnes pratiques si l'email est renseigné et l'option activée
        if (input.email) {
          const settings = await db.getAtelierSettings();
          if (settings?.guideEmailEnabled !== false) {
            const { sendGuideEmail } = await import('./emailService');
            sendGuideEmail(input.email, input.firstName).catch(err =>
              console.error('[Email] Failed to send guide email on create:', err)
            );
          }
        }
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().positive(),
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        email: z.string().email().max(320).optional(),
        phone: z.string().max(20).optional(),
        pin: z.string().regex(/^\d{4}$/).optional().nullable(),
        isActive: z.boolean().optional(),
        shelfNumber: z.string().max(20).optional().nullable(),
        artistSignature: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateResident(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteResident(input.id);
        return { success: true };
      }),

    listArchived: protectedProcedure.query(async () => {
      return await db.getArchivedResidents();
    }),

    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.restoreResident(input.id);
        return { success: true };
      }),

    getWithActivePackage: protectedProcedure.query(async () => {
      const residents = await db.getActiveResidents();
      const residentsWithPackages = await Promise.all(
        residents.map(async (resident) => {
          // Récupérer tous les forfaits du résident et garder le plus récent (ID le plus élevé)
          const allPackages = await db.getPackagesByResidentId(resident.id);
          const latestPackage = allPackages.length > 0 
            ? allPackages.reduce((latest, pkg) => pkg.id > latest.id ? pkg : latest, allPackages[0])
            : null;
          const lastReminder = await db.getLastReminderByResidentId(resident.id);
          const openAttendance = await db.getOpenAttendance(resident.id);
          return {
            ...resident,
            activePackage: latestPackage,
            lastReminderDate: lastReminder?.sentAt || null,
            hasMissedCheckout: resident.hasMissedCheckout || false,
            missedCheckoutAttendanceId: resident.missedCheckoutAttendanceId || null,
            hasOpenAttendance: !!openAttendance,
          };
        })
      );
      return residentsWithPackages;
    }),

  }),

  packages: router({
    getByResidentId: protectedProcedure
      .input(z.object({ residentId: z.number() }))
      .query(async ({ input }) => {
        const packages = await db.getPackagesByResidentId(input.residentId);
        const attendances = await db.getAttendancesByResidentId(input.residentId);
        const resident = await db.getResidentById(input.residentId);

        // Calculer chronologiquement pour chaque forfait quels pointages sont hors forfait
        // On trie les pointages par date croissante pour chaque forfait
        const outOfPackageAttendanceIds = new Set<number>();
        for (const pkg of packages) {
          // Pointages réels de ce forfait (hors ajustements), triés chronologiquement
          const pkgAtts = attendances
            .filter(a => a.packageId === pkg.id && a.attendanceType !== 'adjustment_add' && a.attendanceType !== 'adjustment_subtract')
            .sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime());
          
          let cumul = 0;
          for (const att of pkgAtts) {
            if (!att.durationMinutes) continue;
            const newCumul = cumul + att.durationMinutes;
            if (cumul >= pkg.totalHours) {
              // Le forfait était déjà épuisé avant ce pointage
              outOfPackageAttendanceIds.add(att.id);
            } else if (newCumul > pkg.totalHours) {
              // Ce pointage déborde partiellement — on le marque hors forfait
              outOfPackageAttendanceIds.add(att.id);
            }
            cumul = newCumul;
          }
        }
        // Pointages orphelins (sans forfait) = hors forfait
        for (const att of attendances) {
          if (!att.packageId && att.attendanceType !== 'adjustment_add' && att.attendanceType !== 'adjustment_subtract') {
            outOfPackageAttendanceIds.add(att.id);
          }
        }

        // Enrichir les attendances avec isOutOfPackage
        const enrichedAttendances = attendances.map(att => ({
          ...att,
          isOutOfPackage: outOfPackageAttendanceIds.has(att.id),
        }));

        // Les valeurs usedHours et totalHours en base sont maintenues à jour par fullRecalculateResident.
        // On les retourne telles quelles, comme le fait l'espace personnel du résident.
        // outOfPackageMinutes = heures hors forfait non encore déduites (pour le forfait le plus récent)
        const enrichedPackages = packages.map(pkg => {
          const isLatestPackage = packages[0]?.id === pkg.id;
          const outOfPackageMinutes = isLatestPackage ? (resident?.outOfPackageMinutes || 0) : 0;
          return { ...pkg, outOfPackageMinutes };
        });

        return { packages: enrichedPackages, attendances: enrichedAttendances };
      }),

    getActiveByResidentId: publicProcedure
      .input(z.object({ residentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getActivePackageByResidentId(input.residentId);
      }),

    getOutOfPackageHours: protectedProcedure
      .input(z.object({ residentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getOutOfPackageHoursByResidentId(input.residentId);
      }),

    getAllOutOfPackageHours: protectedProcedure
      .query(async () => {
        const map = await db.getAllOutOfPackageHours();
        // Convertir Map en objet pour la sérialisation tRPC
        return Object.fromEntries(map);
      }),

    clearOutOfPackageHours: protectedProcedure
      .input(z.object({ residentId: z.number() }))
      .mutation(async ({ input }) => {
        await db.clearOutOfPackageHours(input.residentId);
        return { success: true };
      }),

    create: protectedProcedure
      .input(z.object({
        residentId: z.number(),
        packageType: z.enum(["15h_8w", "30h_8w", "30h_4w", "180h_6m"]).optional(),
        packageTypeId: z.number().int().optional(), // ID d'un type de forfait dynamique
        startDate: z.date().optional(),
        deductOutOfPackageHours: z.boolean().optional(),
        outOfPackageMinutes: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // Résoudre le type de forfait : dynamique (packageTypeId) ou statique (packageType)
        let totalHours: number;
        let resolvedPackageType: string;
        let resolvedEndDate: Date;
        const startDate = input.startDate || new Date();

        if (input.packageTypeId) {
          // Type dynamique depuis la base de données
          const dynType = await db.getPackageTypeById(input.packageTypeId);
          if (!dynType) throw new TRPCError({ code: 'NOT_FOUND', message: 'Type de forfait introuvable.' });
          totalHours = dynType.totalMinutes;
          resolvedPackageType = `custom_${dynType.id}`;
          resolvedEndDate = new Date(startDate);
          resolvedEndDate.setDate(resolvedEndDate.getDate() + dynType.durationWeeks * 7);
        } else if (input.packageType) {
          // Type statique (rétro-compatibilité)
          totalHours = getTotalHours(input.packageType);
          resolvedPackageType = input.packageType;
          resolvedEndDate = calculateEndDate(startDate, input.packageType);
        } else {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Veuillez spécifier un type de forfait.' });
        }

        // Vérifier s'il existe déjà un forfait actif ET non expiré
        const activePackage = await db.getActivePackageByResidentId(input.residentId);
        
        // Empêcher la création si un forfait actif existe déjà ET qu'il a encore des heures restantes
        if (activePackage && (activePackage.totalHours - activePackage.usedHours) > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Un forfait est déjà actif pour ce résident. Attendez son expiration ou désactivez-le pour en créer un nouveau.',
          });
        }
        
        let initialUsedHours = 0;
        
        // Ajouter les heures hors forfait si demandé
        let deductedMinutes = 0;
        if (input.deductOutOfPackageHours && input.outOfPackageMinutes) {
          initialUsedHours += input.outOfPackageMinutes;
          deductedMinutes = input.outOfPackageMinutes; // Enregistrer les minutes déduites
        }

        // Bloquer la création si un pointage est en cours
        const openAttendance = await db.getOpenAttendance(input.residentId);
        if (openAttendance) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Un pointage est en cours. Veuillez terminer le pointage avant de créer un nouveau forfait.',
          });
        }

        const newPackageId = await db.createPackage({
          residentId: input.residentId,
          packageType: resolvedPackageType,
          totalHours,
          usedHours: initialUsedHours,
          deductedMinutes, // Enregistrer les minutes déduites pour éviter de les proposer à nouveau
          startDate,
          endDate: resolvedEndDate,
          isActive: true,
          reminderSent: false,
          expirationEmailSent: false,
        });

        // Si des heures ont été déduites, marquer les anciens forfaits
        if (deductedMinutes > 0) {
          await db.markOutOfPackageHoursAsDeducted(input.residentId, deductedMinutes);
        }

        // Rattacher les pointages orphelins (packageId = null) au nouveau forfait
        // UNIQUEMENT si aucune heure n'a été déduite manuellement.
        if (newPackageId && deductedMinutes === 0) {
          await db.recalculatePackageHours(newPackageId);
        }

        // Remettre à zéro les heures hors forfait après création d'un nouveau forfait
        await db.updateResident(input.residentId, { outOfPackageMinutes: 0 });

        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        isActive: z.boolean().optional(),
        reminderSent: z.boolean().optional(),
        expirationEmailSent: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePackage(id, data);
        return { success: true };
      }),

    activatePending: protectedProcedure
      .input(z.object({ packageId: z.number() }))
      .mutation(async ({ input }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Forfait introuvable.' });
        // Calculer la date de début et de fin à partir d'aujourd'hui
        const startDate = new Date();
        let endDate: Date | null = null;
        // Si le forfait a un packageType dynamique, récupérer la durée
        if (pkg.packageType && pkg.packageType.startsWith('custom_')) {
          const typeId = parseInt(pkg.packageType.replace('custom_', ''));
          const dynType = await db.getPackageTypeById(typeId);
          if (dynType) {
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + dynType.durationWeeks * 7);
          }
        }
        await db.updatePackage(input.packageId, {
          isActive: true,
          startDate,
          ...(endDate ? { endDate } : {}),
        } as any);
        await db.fullRecalculateResident(pkg.residentId);
        // Envoyer un email de confirmation au résident
        try {
          const resident = await db.getResidentById(pkg.residentId);
          if (resident?.email) {
            const pkgType = pkg.packageType?.startsWith('custom_')
              ? await db.getPackageTypeById(parseInt(pkg.packageType.replace('custom_', '')))
              : null;
            const label = pkgType?.label || pkg.packageType || 'Forfait';
            await emailService.sendPackageActivatedEmail(
              resident.email,
              resident.firstName,
              label,
              startDate,
              endDate,
              pkg.totalHours,
              resident.id,
              pkg.id
            );
          }
        } catch (e) { /* non bloquant */ }
        return { success: true };
      }),

    listAll: protectedProcedure.query(async () => {
      return await db.getAllPackages();
    }),

    getExpiringPackages: protectedProcedure.query(async () => {
      const allPackages = await db.getAllPackages();
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // Grouper tous les forfaits par résident et ne garder que le dernier (id le plus élevé)
      const latestPackageByResident = new Map<number, typeof allPackages[0]>();
      
      for (const pkg of allPackages) {
        const existing = latestPackageByResident.get(pkg.residentId);
        if (!existing || pkg.id > existing.id) {
          latestPackageByResident.set(pkg.residentId, pkg);
        }
      }

      // Filtrer pour ne garder que les derniers forfaits expirant dans 7 jours sans rappel
      const expiringPackages = Array.from(latestPackageByResident.values()).filter(pkg => {
        if (!pkg.endDate) return false; // Ignorer les forfaits en attente
        const endDate = new Date(pkg.endDate);
        return endDate >= now && endDate <= sevenDaysFromNow && !pkg.reminderSent;
      });

      // Fetch resident info for each package and filter out packages with missing residents
      const packagesWithResidents = await Promise.all(
        expiringPackages.map(async (pkg) => {
          const resident = await db.getResidentById(pkg.residentId);
          if (!resident) return null; // Exclure les forfaits sans résident
          return {
            ...pkg,
            residentFirstName: resident.firstName,
            residentLastName: resident.lastName,
          };
        })
      );

      // Filter out null values (packages without residents)
      const validPackages = packagesWithResidents.filter((pkg): pkg is NonNullable<typeof pkg> => pkg !== null);

      // Trier par prénom par ordre alphabétique
      return validPackages.sort((a, b) => 
        (a.residentFirstName || '').localeCompare(b.residentFirstName || '', 'fr', { sensitivity: 'base' })
      );
    }),

    getExpiredPackages: protectedProcedure.query(async () => {
      const allPackages = await db.getAllPackages();
      const now = new Date();

      // Grouper tous les forfaits par résident et ne garder que le dernier (id le plus élevé)
      const latestPackageByResident = new Map<number, typeof allPackages[0]>();
      
      for (const pkg of allPackages) {
        const existing = latestPackageByResident.get(pkg.residentId);
        if (!existing || pkg.id > existing.id) {
          latestPackageByResident.set(pkg.residentId, pkg);
        }
      }

      // Filtrer pour ne garder que les derniers forfaits expirés sans e-mail
      const expiredPackages = Array.from(latestPackageByResident.values()).filter(pkg => {
        if (!pkg.endDate) return false; // Ignorer les forfaits en attente
        const endDate = new Date(pkg.endDate);
        const hasExpired = endDate < now || pkg.usedHours >= pkg.totalHours;
        return hasExpired && !pkg.expirationEmailSent;
      });

      // Fetch resident info for each package and filter out packages with missing residents
      const packagesWithResidents = await Promise.all(
        expiredPackages.map(async (pkg) => {
          const resident = await db.getResidentById(pkg.residentId);
          if (!resident) return null; // Exclure les forfaits sans résident
          return {
            ...pkg,
            residentFirstName: resident.firstName,
            residentLastName: resident.lastName,
          };
        })
      );

      // Filter out null values (packages without residents)
      const validPackages = packagesWithResidents.filter((pkg): pkg is NonNullable<typeof pkg> => pkg !== null);

      // Trier par prénom par ordre alphabétique
      return validPackages.sort((a, b) => 
        (a.residentFirstName || '').localeCompare(b.residentFirstName || '', 'fr', { sensitivity: 'base' })
      );
    }),

    addHours: protectedProcedure
      .input(z.object({
        packageId: z.number(),
        hours: z.number().min(0),
        minutes: z.number().min(0).max(59),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Forfait non trouvé" });
        }

        const additionalMinutes = input.hours * 60 + input.minutes;
        if (additionalMinutes <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Le nombre de minutes doit être supérieur à 0" });
        }

        // Augmenter totalHours du forfait
        const newTotalHours = pkg.totalHours + additionalMinutes;
        await db.updatePackage(input.packageId, { totalHours: newTotalHours });

        // Créer un pointage d'ajustement visible dans l'historique
        const now = new Date();
        await db.createAttendance({
          residentId: pkg.residentId,
          packageId: input.packageId,
          checkInTime: now,
          checkOutTime: now,
          durationMinutes: additionalMinutes,
          attendanceType: 'adjustment_add',
          note: input.note || `Ajout de ${input.hours}h${input.minutes > 0 ? input.minutes + 'min' : ''} par l'atelier`,
        });

        // Recalculer les heures utilisées et hors forfait
        await db.recalculatePackageHours(input.packageId);

        return { success: true, addedMinutes: additionalMinutes };
      }),

    extendDate: protectedProcedure
      .input(z.object({
        packageId: z.number(),
        days: z.number().min(1),
      }))
      .mutation(async ({ input }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Forfait non trouvé" });
        }
        if (!pkg.endDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible de modifier la date d'un forfait en attente" });
        }

        const currentEndDate = new Date(pkg.endDate);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + input.days);

        await db.updatePackage(input.packageId, {
          endDate: newEndDate,
        });

        // Resynchroniser isActive après changement de date
        await db.fullRecalculateResident(pkg.residentId);

        return { success: true, newEndDate };
      }),

    subtractHours: protectedProcedure
      .input(z.object({
        packageId: z.number(),
        hours: z.number().min(0),
        minutes: z.number().min(0).max(59),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Forfait non trouvé" });
        }

        const subtractMinutes = input.hours * 60 + input.minutes;
        if (subtractMinutes <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Le nombre de minutes doit être supérieur à 0" });
        }

        // Réduire totalHours du forfait
        const newTotalHours = pkg.totalHours - subtractMinutes;
        if (newTotalHours < 0) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Impossible de soustraire plus d'heures que le total du forfait" 
          });
        }
        await db.updatePackage(input.packageId, { totalHours: newTotalHours });

        // Créer un pointage d'ajustement visible dans l'historique
        const now = new Date();
        await db.createAttendance({
          residentId: pkg.residentId,
          packageId: input.packageId,
          checkInTime: now,
          checkOutTime: now,
          durationMinutes: subtractMinutes,
          attendanceType: 'adjustment_subtract',
          note: input.note || `Retrait de ${input.hours}h${input.minutes > 0 ? input.minutes + 'min' : ''} par l'atelier`,
        });

        // Recalculer les heures utilisées et hors forfait
        await db.recalculatePackageHours(input.packageId);

        return { success: true, subtractedMinutes: subtractMinutes };
      }),

    subtractDays: protectedProcedure
      .input(z.object({
        packageId: z.number(),
        days: z.number().min(1),
      }))
      .mutation(async ({ input }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Forfait non trouvé" });
        }
        if (!pkg.endDate || !pkg.startDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible de modifier la date d'un forfait en attente" });
        }

        const currentEndDate = new Date(pkg.endDate);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() - input.days);

        // Ne pas permettre une date d'expiration dans le passé avant la date de début
        const startDate = new Date(pkg.startDate);
        if (newEndDate < startDate) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "La date d'expiration ne peut pas être antérieure à la date de début" 
          });
        }

        await db.updatePackage(input.packageId, {
          endDate: newEndDate,
        });

        // Resynchroniser isActive après changement de date
        await db.fullRecalculateResident(pkg.residentId);

        return { success: true, newEndDate };
      }),

    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const pkg = await db.getPackageById(input.id);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Forfait non trouvé" });
        }

        const residentId = pkg.residentId;

        // Remettre les pointages normaux à packageId = null (orphelins), supprimer les ajustements
        await db.deleteAttendancesByPackageId(input.id);

        // Supprimer le forfait
        await db.deletePackage(input.id);

        // Remettre à zéro les heures hors forfait du résident
        await db.updateResident(residentId, { outOfPackageMinutes: 0 });

        // Recalcul automatique : rattacher les pointages orphelins au forfait précédent
        const remainingPackages = await db.getPackagesByResidentId(residentId);
        if (remainingPackages.length > 0) {
          // Prendre le plus récent (trié par createdAt desc)
          await db.recalculatePackageHours(remainingPackages[0].id);
        } else {
          // Aucun forfait restant : recalculer uniquement les heures hors forfait
          await db.recalculateOutOfPackageHours(residentId);
        }

        return { success: true };
      }),

    forceRecalculate: protectedProcedure
      .input(z.object({
        residentId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Recalcul limité au forfait actif.
        // Si aucun forfait actif, on prend le plus récent (pour recalculer après suppression d'un forfait).
        let targetPackage = await db.getActivePackageByResidentId(input.residentId);
        if (!targetPackage) {
          const allPackages = await db.getPackagesByResidentId(input.residentId);
          if (allPackages.length === 0) {
            return { success: true, packagesRecalculated: 0 };
          }
          // Prendre le plus récent (déjà trié par createdAt desc)
          targetPackage = allPackages[0];
        }
        await db.recalculatePackageHours(targetPackage.id);
        return { success: true, packagesRecalculated: 1 };
      }),
  }),

  attendances: router({
    // Version avec logs de débogage - 2026-01-27 17:28
    checkIn: publicProcedure
      .input(z.object({
        residentId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Vérifier si le résident existe
        const resident = await db.getResidentById(input.residentId);
        if (!resident || !resident.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Résident non trouvé ou inactif" });
        }

        // Vérifier s'il y a déjà un pointage ouvert
        const openAttendance = await db.getOpenAttendance(resident.id);
        if (openAttendance) {
          // Si un pointage est ouvert, on fait le checkout automatiquement
          // Utiliser la logique commune de checkout
          const { performCheckout } = await import('./checkoutLogic');
          const result = await performCheckout({
            attendanceId: openAttendance.id,
            packageId: openAttendance.packageId,
            residentEmail: resident.email,
            residentFirstName: resident.firstName,
            residentId: resident.id,
          });
          
          return {
            ...result,
            resident,
          };
        }

        // Récupérer le forfait actif (ou le dernier forfait même s'il est expiré)
        let activePackage = await db.getActivePackageByResidentId(resident.id);
        
        // Si pas de forfait actif, récupérer le dernier forfait du résident
        if (!activePackage) {
          const allPackages = await db.getPackagesByResidentId(resident.id);
          if (!allPackages || allPackages.length === 0) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Aucun forfait trouvé" });
          }
          // Prendre le forfait le plus récent
          activePackage = allPackages.sort((a, b) => b.id - a.id)[0];
        }

        // Calculer les heures restantes (peut être négatif)
        const remainingMinutes = activePackage.totalHours - activePackage.usedHours;

        // Créer le pointage d'arrivée même si le forfait est expiré
        await db.createAttendance({
          residentId: resident.id,
          packageId: activePackage.id,
          checkInTime: new Date(),
          checkOutTime: null,
          durationMinutes: null,
        });

        return {
          success: true,
          action: 'checkin' as const,
          resident,
          remainingHours: Math.floor(remainingMinutes / 60),
          remainingMinutes: remainingMinutes % 60,
        };
      }),

    checkOut: publicProcedure
      .input(z.object({
        residentId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Vérifier si le résident existe
        const resident = await db.getResidentById(input.residentId);
        if (!resident) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Résident non trouvé" });
        }

        // Récupérer le pointage ouvert
        const openAttendance = await db.getOpenAttendance(resident.id);
        if (!openAttendance) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Aucun pointage en cours" });
        }

        // Utiliser la logique commune de checkout
        const { performCheckout } = await import('./checkoutLogic');
        return await performCheckout({
          attendanceId: openAttendance.id,
          packageId: openAttendance.packageId,
          residentEmail: resident.email,
          residentFirstName: resident.firstName,
          residentId: resident.id,
        });
      }),

    getByResidentId: protectedProcedure
      .input(z.object({ residentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAttendancesByResidentId(input.residentId);
      }),

    listAll: protectedProcedure.query(async () => {
      const allAttendances = await db.getAllAttendances();
      // Grouper par forfait pour calculer isOutOfPackage chronologiquement
      const outOfPackageIds = new Set<number>();
      // Regrouper les pointages réels (hors ajustements) par packageId
      const byPackage = new Map<number, typeof allAttendances>();
      for (const att of allAttendances) {
        if (att.attendanceType === 'adjustment_add' || att.attendanceType === 'adjustment_subtract') continue;
        if (!att.packageId) {
          outOfPackageIds.add(att.id); // orphelins = hors forfait
          continue;
        }
        if (!byPackage.has(att.packageId)) byPackage.set(att.packageId, []);
        byPackage.get(att.packageId)!.push(att);
      }
      // Pour chaque forfait, parcourir chronologiquement
      for (const [, atts] of Array.from(byPackage)) {
        const sorted = [...atts].sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime());
        // Récupérer totalHours depuis le premier pointage (packageTotalHours)
        const totalHours = (sorted[0] as any)?.packageTotalHours ?? Infinity;
        let cumul = 0;
        for (const att of sorted) {
          if (!att.durationMinutes) continue;
          const newCumul = cumul + att.durationMinutes;
          if (cumul >= totalHours || newCumul > totalHours) {
            outOfPackageIds.add(att.id);
          }
          cumul = newCumul;
        }
      }
      return allAttendances.map(att => ({ ...att, isOutOfPackage: outOfPackageIds.has(att.id) }));
    }),

    getOpenAttendances: publicProcedure.query(async () => {
      return await db.getAllOpenAttendances();
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        checkInTime: z.string(),
        checkOutTime: z.string().nullable(),
      }))
      .mutation(async ({ input }) => {
        const attendance = await db.getAttendanceById(input.id);
        if (!attendance) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pointage non trouvé" });
        }

        const checkInTime = new Date(input.checkInTime);
        const checkOutTime = input.checkOutTime ? new Date(input.checkOutTime) : null;
        
        // Validation : l'heure de départ doit être postérieure à l'heure d'arrivée
        if (checkOutTime && checkOutTime <= checkInTime) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "L'heure de départ doit être postérieure à l'heure d'arrivée" 
          });
        }
        
        let durationMinutes = attendance.durationMinutes;
        if (checkOutTime) {
          durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
        }

        await db.updateAttendance(input.id, {
          checkInTime,
          checkOutTime,
          durationMinutes,
        });

        // Si une heure de sortie vient d'être ajoutée, réinitialiser le flag hasMissedCheckout
        // si ce pointage est celui qui avait déclenché l'alerte
        if (checkOutTime) {
          const resident = await db.getResidentById(attendance.residentId);
          if (resident && resident.hasMissedCheckout && resident.missedCheckoutAttendanceId === input.id) {
            await db.updateResident(attendance.residentId, {
              hasMissedCheckout: false,
              missedCheckoutAttendanceId: null,
            });
          }
        }

        // Recalcul complet depuis la base
        if (attendance.packageId) {
          const recalc = await db.recalculatePackageHours(attendance.packageId);
          // Avertissement si le total dépasse le forfait
          if (recalc.outOfPackageMinutes > 0) {
            const pkg = await db.getPackageById(attendance.packageId);
            const totalH = Math.floor((pkg?.totalHours ?? 0) / 60);
            const totalM = (pkg?.totalHours ?? 0) % 60;
            const excessH = Math.floor(recalc.outOfPackageMinutes / 60);
            const excessM = recalc.outOfPackageMinutes % 60;
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Attention : ce pointage dépasse le total du forfait (${totalH}h${totalM > 0 ? totalM + 'min' : ''}). Dépassement : ${excessH > 0 ? excessH + 'h' : ''}${excessM > 0 ? excessM + 'min' : ''}. Les heures en excès sont comptabilisées comme heures hors forfait.`,
            });
          }
        } else {
          // Pointage orphelin : recalculer les heures hors forfait
          await db.recalculateOutOfPackageHours(attendance.residentId);
          // Et aussi recalculer le forfait actif pour rattacher les orphelins si possible
          const activePackage = await db.getActivePackageByResidentId(attendance.residentId);
          if (activePackage) {
            await db.recalculatePackageHours(activePackage.id);
          }
        }

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const attendance = await db.getAttendanceById(input.id);
        if (!attendance) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pointage non trouvé" });
        }

        const residentId = attendance.residentId;
        const packageId = attendance.packageId;

        // Si c'est un pointage d'ajustement, il faut annuler son effet sur totalHours
        // avant de supprimer le pointage, car recalculatePackageHours ne touche pas totalHours
        if (packageId && attendance.attendanceType === 'adjustment_add' && attendance.durationMinutes) {
          // L'ajout avait augmenté totalHours → on le diminue
          const pkg = await db.getPackageById(packageId);
          if (pkg) {
            const newTotal = pkg.totalHours - attendance.durationMinutes;
            await db.updatePackage(packageId, { totalHours: Math.max(0, newTotal) });
          }
        } else if (packageId && attendance.attendanceType === 'adjustment_subtract' && attendance.durationMinutes) {
          // La soustraction avait diminué totalHours → on le réaugmente
          const pkg = await db.getPackageById(packageId);
          if (pkg) {
            const newTotal = pkg.totalHours + attendance.durationMinutes;
            await db.updatePackage(packageId, { totalHours: newTotal });
          }
        }

        await db.deleteAttendance(input.id);
        
        // Recalcul complet depuis la base après suppression
        if (packageId) {
          await db.recalculatePackageHours(packageId);
        } else {
          // Pointage orphelin supprimé : recalculer les heures hors forfait
          await db.recalculateOutOfPackageHours(residentId);
          // Et recalculer le forfait actif pour ré-absorber les orphelins restants
          const activePackage = await db.getActivePackageByResidentId(residentId);
          if (activePackage) {
            await db.recalculatePackageHours(activePackage.id);
          }
        }
        
        return { success: true };
      }),

    create: protectedProcedure
      .input(z.object({
        residentId: z.number(),
        checkInTime: z.string(),
        checkOutTime: z.string().nullable(),
      }))
      .mutation(async ({ input }) => {
        const resident = await db.getResidentById(input.residentId);
        if (!resident) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Résident non trouvé" });
        }

        const checkInTime = new Date(input.checkInTime);
        const checkOutTime = input.checkOutTime ? new Date(input.checkOutTime) : null;
        
        // Validation : l'heure de départ doit être postérieure à l'heure d'arrivée
        if (checkOutTime && checkOutTime <= checkInTime) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "L'heure de départ doit être postérieure à l'heure d'arrivée" 
          });
        }
        
        // Récupérer le forfait actif pour validation
        const activePackage = await db.getActivePackageByResidentId(input.residentId);
        
        // Validation : le pointage ne peut pas être avant le début du forfait actif
        if (activePackage && activePackage.startDate) {
          const packageStartDate = new Date(activePackage.startDate);
          if (checkInTime < packageStartDate) {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: `Le pointage ne peut pas être avant le début du forfait (${packageStartDate.toLocaleDateString('fr-FR')})` 
            });
          }
        }
        
        let durationMinutes = null;
        if (checkOutTime) {
          durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
        }
        
        // Créer le pointage
        const attendanceData: any = {
          residentId: input.residentId,
          checkInTime,
          checkOutTime,
          durationMinutes,
        };
        
        // Ajouter packageId seulement s'il existe
        if (activePackage) {
          attendanceData.packageId = activePackage.id;
        }
        
        const attendanceId = await db.createAttendance(attendanceData);

        // Recalcul complet depuis la base
        if (activePackage && durationMinutes) {
          const recalc = await db.recalculatePackageHours(activePackage.id);
          // Avertissement si le total dépasse le forfait
          if (recalc.outOfPackageMinutes > 0) {
            const totalH = Math.floor(activePackage.totalHours / 60);
            const totalM = activePackage.totalHours % 60;
            const excessH = Math.floor(recalc.outOfPackageMinutes / 60);
            const excessM = recalc.outOfPackageMinutes % 60;
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Attention : ce pointage dépasse le total du forfait (${totalH}h${totalM > 0 ? totalM + 'min' : ''}). Dépassement : ${excessH > 0 ? excessH + 'h' : ''}${excessM > 0 ? excessM + 'min' : ''}. Les heures en excès sont comptabilisées comme heures hors forfait.`,
            });
          }
        } else if (!activePackage) {
          // Pas de forfait actif, recalcul hors forfait uniquement
          await db.recalculateOutOfPackageHours(input.residentId);
        }

        return { success: true, attendanceId };
      }),
  }),

  emailLogs: router({
    getByResidentId: protectedProcedure
      .input(z.object({ residentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmailLogsByResidentId(input.residentId);
      }),
  }),
  emailTemplates: router({
    getAll: protectedProcedure
      .query(async () => {
        return await db.getAllEmailTemplates();
      }),
    upsert: protectedProcedure
      .input(z.object({
        templateType: z.enum(["reminder", "expiration", "session_summary"]),
        subject: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertEmailTemplate(input);
        return { success: true };
      }),
  }),

  notes: router({
    getByResidentId: protectedProcedure
      .input(z.object({ residentId: z.number() }))
      .query(async ({ input }) => {
        return await db.getNotesByResidentId(input.residentId);
      }),

    create: protectedProcedure
      .input(z.object({
        residentId: z.number().positive(),
        content: z.string().min(1).max(5000),
        createdBy: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        await db.createNote(input);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().positive(),
        content: z.string().min(1).max(5000),
      }))
      .mutation(async ({ input }) => {
        await db.updateNote(input.id, input.content);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteNote(input.id);
        return { success: true };
      }),
  }),

  atelierSettings: router({
    get: protectedProcedure
      .query(async () => {
        const settings = await db.getAtelierSettings();
        return settings ?? { id: 0, totalShelves: 0, reminderDaysBeforeExpiry: 7, guideEmailEnabled: true, paymentLinks: null as string | null, updatedAt: new Date() };
      }),

    // Retourne les numéros d'étagères disponibles (non occupées par un résident actif)
    getAvailableShelves: protectedProcedure
      .input(z.object({ excludeResidentId: z.number().int().optional() }))
      .query(async ({ input }) => {
        const settings = await db.getAtelierSettings();
        const total = settings?.totalShelves ?? 0;
        if (total === 0) return { total: 0, available: [], occupied: [] };

        // Récupérer tous les résidents actifs avec un numéro d'étagère
        const allResidents = await db.getAllResidents();
        const occupiedShelves = new Set<number>();
        allResidents
          .filter(r => r.isActive && r.shelfNumber && r.id !== (input.excludeResidentId ?? -1))
          .forEach(r => {
            const n = parseInt(r.shelfNumber as string, 10);
            if (!isNaN(n) && n >= 1 && n <= total) occupiedShelves.add(n);
          });

        const available: number[] = [];
        for (let i = 1; i <= total; i++) {
          if (!occupiedShelves.has(i)) available.push(i);
        }

        return {
          total,
          available,
          occupied: Array.from(occupiedShelves).sort((a, b) => a - b),
        };
      }),

    update: protectedProcedure
      .input(z.object({
        totalShelves: z.number().int().min(0).max(500).optional(),
        reminderDaysBeforeExpiry: z.number().int().min(1).max(30).optional(),
        guideEmailEnabled: z.boolean().optional(),
        paymentLinks: z.string().nullable().optional(), // JSON string
      }))
      .mutation(async ({ input }) => {
        await db.updateAtelierSettings(input);
        return { success: true };
      }),
  }),
   export: router({
    generateExcel: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { generateExcelExport } = await import("./exportService");
        const buffer = await generateExcelExport();
        
        // Convertir le buffer en base64 pour le transférer via tRPC
        const base64 = buffer.toString("base64");
        
        return {
          success: true,
          data: base64,
          filename: `export_${new Date().toISOString().split('T')[0]}.xlsx`,
        };
      }),
  }),

  actionTokens: router({
    validateFixCheckout: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const tokenData = await validateToken(input.token);
        if (!tokenData || tokenData.actionType !== 'fix_checkout' || !tokenData.attendanceId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lien invalide ou expiré' });
        }
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const attendance = await database.select().from(attendances).where(eq(attendances.id, tokenData.attendanceId)).limit(1);
        if (!attendance.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pointage introuvable' });
        const resident = await db.getResidentById(tokenData.residentId);
        return {
          residentFirstName: resident?.firstName || '',
          checkInTime: attendance[0].checkInTime,
          currentCheckOutTime: attendance[0].checkOutTime,
        };
      }),
    applyFixCheckout: publicProcedure
      .input(z.object({ token: z.string(), checkoutTime: z.string() }))
      .mutation(async ({ input }) => {
        const tokenData = await validateToken(input.token);
        if (!tokenData || tokenData.actionType !== 'fix_checkout' || !tokenData.attendanceId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lien invalide ou expiré' });
        }
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const attendance = await database.select().from(attendances).where(eq(attendances.id, tokenData.attendanceId)).limit(1);
        if (!attendance.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pointage introuvable' });
        const checkInTime = new Date(attendance[0].checkInTime);
        const checkOutTime = new Date(input.checkoutTime);
        if (checkOutTime <= checkInTime) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: "L'heure de sortie doit être après l'heure d'arrivée" });
        }
        const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
        await database.update(attendances).set({ checkOutTime, durationMinutes }).where(eq(attendances.id, tokenData.attendanceId));
        await markTokenUsed(tokenData.id);
        // Recalculer le forfait
        await db.fullRecalculateResident(tokenData.residentId);
        // Réinitialiser le flag hasMissedCheckout
        const resident = await db.getResidentById(tokenData.residentId);
        if (resident?.hasMissedCheckout && resident.missedCheckoutAttendanceId === tokenData.attendanceId) {
          const resDb = await db.getDb();
          const { residents: residentsTable } = await import('../drizzle/schema');
          if (resDb) await resDb.update(residentsTable).set({ hasMissedCheckout: false, missedCheckoutAttendanceId: null }).where(eq(residentsTable.id, tokenData.residentId));
        }
        return { success: true };
      }),
  }),

  packageTypes: router({
    getAll: protectedProcedure.query(async () => {
      return await db.getAllPackageTypes();
    }),

    getActive: publicProcedure.query(async () => {
      return await db.getActivePackageTypes();
    }),

    create: protectedProcedure
      .input(z.object({
        label: z.string().min(1).max(100),
        totalMinutes: z.number().int().min(60), // minimum 1h
        durationWeeks: z.number().int().min(1),
        price: z.number().int().min(0),
        isActive: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createPackageType(input);
        return { success: true, id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        label: z.string().min(1).max(100).optional(),
        totalMinutes: z.number().int().min(60).optional(),
        durationWeeks: z.number().int().min(1).optional(),
        price: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePackageType(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await db.deletePackageType(input.id);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
