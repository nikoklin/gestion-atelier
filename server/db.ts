import { eq, and, desc, gte, lte, isNull, inArray, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  residents, 
  InsertResident, 
  packages, 
  InsertPackage, 
  attendances, 
  InsertAttendance,
  emailLogs,
  InsertEmailLog,
  emailTemplates,
  InsertEmailTemplate,
  notes,
  InsertNote,
  atelierSettings,
  packageTypes,
  InsertPackageType
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============= RESIDENTS =============

export async function createResident(resident: InsertResident) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(residents).values(resident);
  return result;
}

export async function getAllResidents() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(residents).orderBy(desc(residents.createdAt));
}

export async function getActiveResidents() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(residents)
    .where(and(eq(residents.isActive, true), eq(residents.isDeleted, false)))
    .orderBy(residents.lastName);
}

export async function getResidentById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(residents)
    .where(and(eq(residents.id, id), eq(residents.isDeleted, false)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getResidentByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(residents)
    .where(and(eq(residents.email, email), eq(residents.isDeleted, false)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateResident(id: number, data: Partial<InsertResident>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(residents).set(data).where(eq(residents.id, id));
}

export async function deleteResident(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Archiver le résident au lieu de le supprimer définitivement
  return await db.update(residents).set({ isDeleted: true, isActive: false }).where(eq(residents.id, id));
}

export async function getArchivedResidents() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(residents)
    .where(eq(residents.isDeleted, true))
    .orderBy(desc(residents.updatedAt));
}

export async function restoreResident(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Restaurer le résident archivé
  return await db.update(residents).set({ isDeleted: false, isActive: true }).where(eq(residents.id, id));
}

// ============= PACKAGES =============

export async function createPackage(pkg: InsertPackage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(packages).values(pkg);
  // result[0] est un ResultSetHeader avec insertId (mysql2)
  return (result[0] as any).insertId as number;
}

export async function getPackagesByResidentId(residentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(packages).where(eq(packages.residentId, residentId)).orderBy(desc(packages.createdAt));
}

export async function getActivePackageByResidentId(residentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Récupérer tous les forfaits du résident triés par date de création décroissante
  const allPkgs = await db.select().from(packages).where(
    eq(packages.residentId, residentId)
  ).orderBy(desc(packages.createdAt));

  const now = new Date();
  // Chercher le premier forfait valide : heures restantes > 0 ET date non dépassée
  for (const pkg of allPkgs) {
    const remainingHours = pkg.totalHours - pkg.usedHours;
    const isExpiredByDate = pkg.endDate && now > new Date(pkg.endDate);
    if (remainingHours > 0 && !isExpiredByDate) {
      // Corriger isActive si nécessaire
      if (!pkg.isActive) {
        await db.update(packages).set({ isActive: true }).where(eq(packages.id, pkg.id));
        pkg.isActive = true;
      }
      return pkg;
    }
  }

  return null;
}

export async function getPackageById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updatePackage(id: number, data: Partial<InsertPackage>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(packages).set(data).where(eq(packages.id, id));
}

export async function getAllPackages() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all packages without filtering by resident status
  const result = await db
    .select({
      id: packages.id,
      residentId: packages.residentId,
      packageType: packages.packageType,
      startDate: packages.startDate,
      endDate: packages.endDate,
      totalHours: packages.totalHours,
      usedHours: packages.usedHours,
      isActive: packages.isActive,
      reminderSent: packages.reminderSent,
      expirationEmailSent: packages.expirationEmailSent,
      createdAt: packages.createdAt,
      updatedAt: packages.updatedAt,
    })
    .from(packages);

  return result;
}

export async function getAllActivePackages() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Join with residents to exclude packages from deleted/inactive residents
  const result = await db
    .select({
      id: packages.id,
      residentId: packages.residentId,
      packageType: packages.packageType,
      startDate: packages.startDate,
      endDate: packages.endDate,
      totalHours: packages.totalHours,
      usedHours: packages.usedHours,
      isActive: packages.isActive,
      reminderSent: packages.reminderSent,
      expirationEmailSent: packages.expirationEmailSent,
      createdAt: packages.createdAt,
      updatedAt: packages.updatedAt,
    })
    .from(packages)
    .innerJoin(residents, eq(packages.residentId, residents.id))
    .where(eq(packages.isActive, true));

  return result;
}

export async function deletePackage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(packages).where(eq(packages.id, id));
}

/**
 * Récupère les heures hors forfait pour TOUS les résidents en une seule requête optimisée
 * @returns Map avec residentId comme clé et totalOutOfPackageMinutes comme valeur
 */
export async function getAllOutOfPackageHours(): Promise<Map<number, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Récupérer TOUS les forfaits de TOUS les résidents
    const allPackages = await db.select().from(packages);

  if (allPackages.length === 0) {
    return new Map();
  }

  // Récupérer TOUS les pointages en une seule requête
  const packageIds = allPackages.map(pkg => pkg.id);
  const allAttendances = await db
    .select()
    .from(attendances)
    .where(inArray(attendances.packageId, packageIds));

  // Grouper les pointages par forfait
  const attendancesByPackage = new Map<number, typeof allAttendances>();
  for (const att of allAttendances) {
    if (att.packageId === null) continue; // Ignorer les pointages sans forfait
    if (!attendancesByPackage.has(att.packageId)) {
      attendancesByPackage.set(att.packageId, []);
    }
    attendancesByPackage.get(att.packageId)!.push(att);
  }

  // Calculer les heures hors forfait par résident
  const outOfPackageByResident = new Map<number, number>();

  for (const pkg of allPackages) {
    const packageAttendances = attendancesByPackage.get(pkg.id) || [];

    // Calculer le total réel des minutes utilisées pour ce forfait
    const actualUsedMinutes = packageAttendances.reduce(
      (sum, att) => sum + (att.durationMinutes || 0),
      0
    );

    // Si le total réel dépasse totalHours (qui stocke des minutes), la différence est hors forfait
    if (actualUsedMinutes > pkg.totalHours) {
      const outOfPackageMinutes = actualUsedMinutes - pkg.totalHours;
      // Soustraire les minutes déjà déduites (si elles existent)
      const alreadyDeducted = pkg.deductedMinutes || 0;
      const remainingOutOfPackage = Math.max(0, outOfPackageMinutes - alreadyDeducted);
      
      // Ajouter au cumul du résident
      const currentTotal = outOfPackageByResident.get(pkg.residentId) || 0;
      outOfPackageByResident.set(pkg.residentId, currentTotal + remainingOutOfPackage);
    }
  }

    return outOfPackageByResident;
  } catch (error) {
    console.error("[Database] Failed to get all out-of-package hours:", error);
    throw error;
  }
}

export async function getOutOfPackageHoursByResidentId(residentId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Récupérer tous les forfaits du résident (actifs ET inactifs)
    const allPackages = await db
      .select()
      .from(packages)
      .where(eq(packages.residentId, residentId));

    if (allPackages.length === 0) {
      return 0;
    }

    // OPTIMISATION: Récupérer TOUS les pointages en une seule requête
    // au lieu de faire une requête par forfait (problème N+1)
    const packageIds = allPackages.map(pkg => pkg.id);
    const allAttendances = await db
      .select()
      .from(attendances)
      .where(inArray(attendances.packageId, packageIds));

    // Grouper les pointages par forfait
    const attendancesByPackage = new Map<number, typeof allAttendances>();
    for (const att of allAttendances) {
      if (att.packageId === null) continue; // Ignorer les pointages sans forfait
      if (!attendancesByPackage.has(att.packageId)) {
        attendancesByPackage.set(att.packageId, []);
      }
      attendancesByPackage.get(att.packageId)!.push(att);
    }

    // Calculer le cumul des heures hors forfait (en excluant celles déjà déduites)
    let totalOutOfPackageMinutes = 0;

    for (const pkg of allPackages) {
      const packageAttendances = attendancesByPackage.get(pkg.id) || [];

      // Calculer le total réel des minutes utilisées pour ce forfait
      const actualUsedMinutes = packageAttendances.reduce(
        (sum, att) => sum + (att.durationMinutes || 0),
        0
      );

      // Si le total réel dépasse totalHours (qui stocke des minutes), la différence est hors forfait
      if (actualUsedMinutes > pkg.totalHours) {
        const outOfPackageMinutes = actualUsedMinutes - pkg.totalHours;
        // NE PAS soustraire deductedMinutes ici, car on veut afficher le cumul total
        // jusqu'à ce que les heures soient complètement consommées dans un nouveau forfait
        totalOutOfPackageMinutes += outOfPackageMinutes;
      }
    }

    return totalOutOfPackageMinutes;
  } catch (error) {
    console.error("[Database] Failed to get out-of-package hours for resident:", error);
    throw error;
  }
}

export async function clearOutOfPackageHours(residentId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Simplement remettre à zéro le compteur outOfPackageMinutes du résident
  await db
    .update(residents)
    .set({ outOfPackageMinutes: 0 })
    .where(eq(residents.id, residentId));
}

export async function markOutOfPackageHoursAsDeducted(residentId: number, deductedMinutes: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Simplement remettre à zéro le compteur outOfPackageMinutes du résident
  // (les minutes ont déjà été déduites lors de la création du forfait)
  await db
    .update(residents)
    .set({ outOfPackageMinutes: 0 })
    .where(eq(residents.id, residentId));
}
// ============= ATTENDANCES =============

export async function createAttendance(attendance: InsertAttendance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(attendances).values(attendance);
}

export async function getAttendancesByResidentId(residentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      id: attendances.id,
      residentId: attendances.residentId,
      packageId: attendances.packageId,
      checkInTime: attendances.checkInTime,
      checkOutTime: attendances.checkOutTime,
      durationMinutes: attendances.durationMinutes,
      attendanceType: attendances.attendanceType,
      note: attendances.note,
      // Informations du forfait pour détecter les heures hors forfait
      packageEndDate: packages.endDate,
      packageTotalHours: packages.totalHours,
      packageUsedHours: packages.usedHours,
    })
    .from(attendances)
    .leftJoin(packages, eq(attendances.packageId, packages.id))
    .where(eq(attendances.residentId, residentId))
    .orderBy(desc(attendances.checkInTime));
}

export async function getAttendancesByPackageId(packageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(attendances).where(eq(attendances.packageId, packageId)).orderBy(desc(attendances.checkInTime));
}

export async function getOpenAttendance(residentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(attendances).where(
    and(
      eq(attendances.residentId, residentId),
      isNull(attendances.checkOutTime)
    )
  ).orderBy(desc(attendances.checkInTime)).limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateAttendance(id: number, data: Partial<InsertAttendance>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(attendances).set(data).where(eq(attendances.id, id));
}

export async function getAllAttendances() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .select({
      id: attendances.id,
      residentId: attendances.residentId,
      residentFirstName: residents.firstName,
      residentLastName: residents.lastName,
      packageId: attendances.packageId,
      checkInTime: attendances.checkInTime,
      checkOutTime: attendances.checkOutTime,
      durationMinutes: attendances.durationMinutes,
      attendanceType: attendances.attendanceType,
      note: attendances.note,
      // Informations du forfait pour détecter les heures hors forfait
      packageEndDate: packages.endDate,
      packageTotalHours: packages.totalHours,
      packageUsedHours: packages.usedHours,
    })
    .from(attendances)
    .innerJoin(residents, eq(attendances.residentId, residents.id))
    .leftJoin(packages, eq(attendances.packageId, packages.id))
    .orderBy(desc(attendances.checkInTime));
}

export async function getAttendanceById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(attendances).where(eq(attendances.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function deleteAttendance(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(attendances).where(eq(attendances.id, id));
}

export async function deleteAttendancesByPackageId(packageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Les pointages normaux (type 'normal') sont remis à packageId = null
  // plutôt que supprimés, pour ne pas perdre l'historique des heures réelles.
  // Seuls les ajustements (add/subtract) spécifiques à ce forfait sont supprimés.
  await db
    .update(attendances)
    .set({ packageId: null })
    .where(and(
      eq(attendances.packageId, packageId),
      eq(attendances.attendanceType, 'normal')
    ));

  // Supprimer les ajustements liés à ce forfait
  return await db
    .delete(attendances)
    .where(and(
      eq(attendances.packageId, packageId),
      ne(attendances.attendanceType, 'normal')
    ));
}

// ==================== Email Logs ====================

export async function createEmailLog(log: InsertEmailLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(emailLogs).values(log);
}

export async function clearEmailLogs() {
  const db = await getDb();
  if (!db) return;
  await db.delete(emailLogs);
}

export async function getRecentEmailLogs(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(emailLogs)
    .orderBy(desc(emailLogs.sentAt))
    .limit(limit);
}

export async function getEmailLogsByResidentId(residentId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.residentId, residentId))
    .orderBy(desc(emailLogs.sentAt));
}

export async function getAllOpenAttendances() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(attendances)
    .where(isNull(attendances.checkOutTime))
    .orderBy(desc(attendances.checkInTime));
}

export async function getLastReminderByResidentId(residentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(emailLogs)
    .where(
      and(
        eq(emailLogs.residentId, residentId),
        eq(emailLogs.emailType, "reminder")
      )
    )
    .orderBy(desc(emailLogs.sentAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// ============= EMAIL TEMPLATES =============

export async function getEmailTemplate(templateType: "reminder" | "expiration" | "session_summary") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(emailTemplates).where(eq(emailTemplates.templateType, templateType)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllEmailTemplates() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(emailTemplates);
}

export async function upsertEmailTemplate(template: InsertEmailTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(emailTemplates).values(template).onDuplicateKeyUpdate({
    set: {
      subject: template.subject,
      body: template.body,
    },
  });
}



// ============================================
// Notes Functions
// ============================================

export async function getNotesByResidentId(residentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(notes).where(eq(notes.residentId, residentId)).orderBy(desc(notes.createdAt));
}

export async function createNote(note: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(notes).values(note);
}

export async function updateNote(id: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(notes).set({ content }).where(eq(notes.id, id));
}

export async function deleteNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(notes).where(eq(notes.id, id));
}

/**
 * Recalcule les heures hors forfait pour un résident donné
 * Parcourt tous les pointages dans l'ordre chronologique et détermine
 * lesquels sont hors forfait en fonction du forfait actif
 */
export async function recalculateOutOfPackageHours(residentId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot recalculate out of package hours: database not available");
    return;
  }

  try {
    // Récupérer TOUS les forfaits du résident triés chronologiquement
    const allPackages = await db
      .select()
      .from(packages)
      .where(eq(packages.residentId, residentId))
      .orderBy(packages.startDate);

    if (allPackages.length === 0) {
      await updateResident(residentId, { outOfPackageMinutes: 0 });
      return;
    }

    // Construire un index packageId -> totalHours pour accès rapide
    const pkgMap = new Map<number, number>();
    for (const pkg of allPackages) {
      pkgMap.set(pkg.id, pkg.totalHours);
    }

    // Récupérer TOUS les pointages réels du résident (hors ajustements), triés par ordre chronologique
    const allAttendances = await db
      .select()
      .from(attendances)
      .where(and(
        eq(attendances.residentId, residentId),
        ne(attendances.attendanceType, 'adjustment_add'),
        ne(attendances.attendanceType, 'adjustment_subtract')
      ))
      .orderBy(attendances.checkInTime);

    let totalOutOfPackageMinutes = 0;

    // Compteur d'heures utilisées par forfait
    const usedByPkg = new Map<number, number>();

    // Parcourir les pointages dans l'ordre chronologique
    for (const att of allAttendances) {
      if (!att.durationMinutes) continue;

      // Si le pointage n'a pas de packageId, il est hors forfait
      if (att.packageId === null || att.packageId === undefined) {
        totalOutOfPackageMinutes += att.durationMinutes;
        continue;
      }

      const pkgTotal = pkgMap.get(att.packageId);
      if (pkgTotal === undefined) {
        // Forfait inconnu, considérer hors forfait
        totalOutOfPackageMinutes += att.durationMinutes;
        continue;
      }

      const currentUsed = usedByPkg.get(att.packageId) ?? 0;
      const newUsed = currentUsed + att.durationMinutes;

      if (currentUsed >= pkgTotal) {
        // Forfait déjà épuisé : tout hors forfait
        totalOutOfPackageMinutes += att.durationMinutes;
      } else if (newUsed > pkgTotal) {
        // Débordement partiel
        totalOutOfPackageMinutes += newUsed - pkgTotal;
      }

      usedByPkg.set(att.packageId, newUsed);
    }

    // Mettre à jour le champ outOfPackageMinutes du résident
    await updateResident(residentId, { outOfPackageMinutes: totalOutOfPackageMinutes });
    
    console.log(`[Database] Recalculated out of package hours for resident ${residentId}: ${totalOutOfPackageMinutes} minutes`);
  } catch (error) {
    console.error("[Database] Failed to recalculate out of package hours:", error);
    throw error;
  }
}

/**
 * Recalcule les heures utilisées et hors forfait pour un forfait donné,
 * en triant les pointages par ordre chronologique et en cumulant de façon
 * séquentielle. Les premières minutes (dans l'ordre chronologique) sont
 * imputées au forfait jusqu'à son total ; l'excédent est hors forfait.
 * Met à jour packages.usedHours et residents.outOfPackageMinutes.
 * Retourne { usedHours, outOfPackageMinutes, remainingMinutes }.
 */
export async function recalculatePackageHours(packageId: number): Promise<{
  usedHours: number;
  outOfPackageMinutes: number;
  remainingMinutes: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const pkg = await getPackageById(packageId);
  if (!pkg) throw new Error(`Package ${packageId} not found`);

  // Relire TOUS les pointages réels du forfait (hors ajustements), triés chronologiquement
  // Les ajustements (adjustment_add / adjustment_subtract) ne représentent pas du temps réel
  // mais des modifications du plafond totalHours — ils sont exclus du calcul de temps
  const pkgAttendances = await db
    .select()
    .from(attendances)
    .where(and(
      eq(attendances.packageId, packageId),
      ne(attendances.attendanceType, 'adjustment_add'),
      ne(attendances.attendanceType, 'adjustment_subtract')
    ))
    .orderBy(attendances.checkInTime); // tri chronologique ascendant

  // Parcourir dans l'ordre : les premières minutes vont dans le forfait,
  // l'excédent est hors forfait
  let cumulatedMinutes = 0;
  let outOfPackageMinutes = 0;

  for (const att of pkgAttendances) {
    if (!att.durationMinutes) continue;

    const newCumul = cumulatedMinutes + att.durationMinutes;

    if (cumulatedMinutes >= pkg.totalHours) {
      // Le forfait était déjà épuisé avant ce pointage : tout est hors forfait
      outOfPackageMinutes += att.durationMinutes;
    } else if (newCumul > pkg.totalHours) {
      // Ce pointage déborde : une partie dans le forfait, le reste hors forfait
      outOfPackageMinutes += newCumul - pkg.totalHours;
    }
    // sinon : tout le pointage est dans le forfait

    cumulatedMinutes = newCumul;
  }

  // usedHours est plafonné au total du forfait
  let usedHours = Math.min(cumulatedMinutes, pkg.totalHours);
  let remainingMinutes = pkg.totalHours - usedHours;

  // Si le forfait a encore de la capacité, rattacher les pointages orphelins du résident
  // (pointages sans packageId, triés chronologiquement)
  if (remainingMinutes > 0) {
    const orphanAttendances = await db
      .select()
      .from(attendances)
      .where(and(
        eq(attendances.residentId, pkg.residentId),
        isNull(attendances.packageId)
      ))
      .orderBy(attendances.checkInTime);

    for (const orphan of orphanAttendances) {
      // Rattacher les pointages en cours (sans durationMinutes) directement, sans décompter
      if (!orphan.durationMinutes) {
        // Pointage en cours : le rattacher au forfait sans modifier usedHours
        // Les heures seront décomptées au check-out
        await db
          .update(attendances)
          .set({ packageId })
          .where(eq(attendances.id, orphan.id));
        continue;
      }
      if (remainingMinutes <= 0) break;

      // Rattacher ce pointage orphelin au forfait
      await db
        .update(attendances)
        .set({ packageId })
        .where(eq(attendances.id, orphan.id));

      const absorbed = Math.min(orphan.durationMinutes, remainingMinutes);
      usedHours += absorbed;
      remainingMinutes -= absorbed;
      cumulatedMinutes += orphan.durationMinutes;

      // Si le pointage déborde encore après absorption partielle, le reste reste hors forfait
      // (il sera recalculé par recalculateOutOfPackageHours)
    }
  }

  // Recalculer remainingMinutes après rattachement des orphelins
  remainingMinutes = pkg.totalHours - Math.min(usedHours, pkg.totalHours);

  // Mettre à jour le forfait
  const packageUpdates: Partial<InsertPackage> = { usedHours: Math.min(usedHours, pkg.totalHours) };
  // Désactiver le forfait s'il est épuisé
  if (remainingMinutes <= 0 && pkg.isActive) {
    packageUpdates.isActive = false;
  } else if (remainingMinutes > 0 && !pkg.isActive) {
    // Réactiver si des pointages ont été supprimés ou des heures ajoutées
    packageUpdates.isActive = true;
  }
  await updatePackage(packageId, packageUpdates);

  // Mettre à jour le cumul hors forfait du résident (inclut les pointages orphelins restants)
  await recalculateOutOfPackageHours(pkg.residentId);

  console.log(
    `[recalculatePackageHours] pkg=${packageId} used=${usedHours}min outOfPkg=${outOfPackageMinutes}min remaining=${remainingMinutes}min (chronological)`
  );

  return { usedHours, outOfPackageMinutes, remainingMinutes };
}

/**
 * Recalcul global complet pour un résident.
 * Algorithme :
 *  1. Charger tous les forfaits triés chronologiquement par startDate.
 *  2. Pour chaque forfait, recalculer totalHours = base du type + somme des ajustements rattachés.
 *  3. Détacher tous les pointages normaux du résident (packageId = null).
 *  4. Charger tous les pointages normaux triés par checkInTime (chronologique).
 *  5. Pour chaque pointage, le rattacher au premier forfait dont la plage [startDate, endDate]
 *     contient la date du pointage ET qui a encore de la capacité.
 *  6. Mettre à jour usedHours et isActive de chaque forfait.
 *  7. Recalculer outOfPackageMinutes du résident.
 */
export async function fullRecalculateResident(residentId: number): Promise<{
  packagesProcessed: number;
  attendancesProcessed: number;
  totalOutOfPackageMinutes: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Charger tous les forfaits du résident triés par startDate
  const allPackages = await db
    .select()
    .from(packages)
    .where(eq(packages.residentId, residentId))
    .orderBy(packages.startDate);

  if (allPackages.length === 0) {
    await updateResident(residentId, { outOfPackageMinutes: 0 });
    return { packagesProcessed: 0, attendancesProcessed: 0, totalOutOfPackageMinutes: 0 };
  }

  // 2. Pour chaque forfait, recalculer totalHours = base du type + ajustements
  // Les types standard ont une base fixe ; les types custom_* utilisent la valeur en base
  const standardPackageBaseMinutes: Record<string, number> = {
    '15h_8w': 900,
    '30h_8w': 1800,
    '30h_4w': 1800,
    '180h_6m': 10800,
  };

  const pkgCapacities: { id: number; baseMinutes: number; startDate: Date; endDate: Date; deductedMinutes: number }[] = [];

  for (const pkg of allPackages) {
    // Récupérer tous les ajustements de ce forfait
    const adjustments = await db
      .select()
      .from(attendances)
      .where(and(
        eq(attendances.packageId, pkg.id),
        ne(attendances.attendanceType, 'normal')
      ));

    let adjustmentDelta = 0;
    for (const adj of adjustments) {
      if (!adj.durationMinutes) continue;
      if (adj.attendanceType === 'adjustment_add') adjustmentDelta += adj.durationMinutes;
      if (adj.attendanceType === 'adjustment_subtract') adjustmentDelta -= adj.durationMinutes;
    }

    // Pour les types custom_*, utiliser la valeur totalHours déjà en base (définie à la création)
    // Pour les types standard, utiliser la base fixe + ajustements
    const isCustomType = pkg.packageType.startsWith('custom_');
    const base = isCustomType ? pkg.totalHours : (standardPackageBaseMinutes[pkg.packageType] ?? pkg.totalHours);
    const newTotalHours = Math.max(0, base + adjustmentDelta);

    // Mettre à jour totalHours seulement si différent ET si type standard (ne pas écraser les custom)
    if (!isCustomType && newTotalHours !== pkg.totalHours) {
      await updatePackage(pkg.id, { totalHours: newTotalHours });
    }

    pkgCapacities.push({
      id: pkg.id,
      baseMinutes: newTotalHours,
      startDate: new Date(pkg.startDate),
      endDate: new Date(pkg.endDate),
      deductedMinutes: pkg.deductedMinutes ?? 0,
    });
  }

  // 3. Détacher tous les pointages normaux du résident
  await db
    .update(attendances)
    .set({ packageId: null })
    .where(and(
      eq(attendances.residentId, residentId),
      eq(attendances.attendanceType, 'normal')
    ));

  // 4. Charger tous les pointages normaux triés chronologiquement
  const allNormalAttendances = await db
    .select()
    .from(attendances)
    .where(and(
      eq(attendances.residentId, residentId),
      eq(attendances.attendanceType, 'normal')
    ))
    .orderBy(attendances.checkInTime);

  // Initialiser les compteurs par forfait
  const pkgUsed: Record<number, number> = {};
  for (const p of pkgCapacities) {
    pkgUsed[p.id] = p.deductedMinutes; // Déduire les minutes reportées du forfait précédent
  }

  let totalOutOfPackageMinutes = 0;
  let attendancesProcessed = 0;

  // 5. Réattribuer chaque pointage au bon forfait
  for (const att of allNormalAttendances) {
    if (!att.durationMinutes) {
      attendancesProcessed++;
      continue;
    }

    const checkInDate = new Date(att.checkInTime);

    // Trouver le forfait dont la plage contient la date du pointage ET qui a de la capacité
    let assigned = false;
    for (const p of pkgCapacities) {
      const withinDate = checkInDate >= p.startDate && checkInDate <= p.endDate;
      const remaining = p.baseMinutes - pkgUsed[p.id];

      if (withinDate && remaining > 0) {
        // Rattacher ce pointage à ce forfait
        await db
          .update(attendances)
          .set({ packageId: p.id })
          .where(eq(attendances.id, att.id));

        const absorbed = Math.min(att.durationMinutes, remaining);
        pkgUsed[p.id] += absorbed;

        // Si le pointage déborde, le reste est hors forfait
        if (att.durationMinutes > remaining) {
          totalOutOfPackageMinutes += att.durationMinutes - remaining;
        }

        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // Pointage hors de toute plage de forfait valide → hors forfait
      totalOutOfPackageMinutes += att.durationMinutes;
    }

    attendancesProcessed++;
  }

  // 6. Mettre à jour usedHours et isActive de chaque forfait
  for (const p of pkgCapacities) {
    const used = Math.min(pkgUsed[p.id], p.baseMinutes);
    const remaining = p.baseMinutes - used;
    const now = new Date();
    const isExpiredByDate = now > p.endDate;

    await updatePackage(p.id, {
      usedHours: used,
      isActive: remaining > 0 && !isExpiredByDate,
    });
  }

  // 7. Mettre à jour outOfPackageMinutes du résident
  await updateResident(residentId, { outOfPackageMinutes: totalOutOfPackageMinutes });

  console.log(
    `[fullRecalculateResident] resident=${residentId} packages=${pkgCapacities.length} attendances=${attendancesProcessed} outOfPkg=${totalOutOfPackageMinutes}min`
  );

  return {
    packagesProcessed: pkgCapacities.length,
    attendancesProcessed,
    totalOutOfPackageMinutes,
  };
}

// ─── Paramètres de l'atelier ───────────────────────────────────────────────

export async function getAtelierSettings() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(atelierSettings).limit(1);
  if (rows.length > 0) return rows[0];
  // Créer la ligne singleton si elle n'existe pas encore
  await db.insert(atelierSettings).values({ totalShelves: 0 });
  const created = await db.select().from(atelierSettings).limit(1);
  return created[0] ?? null;
}

export async function updateAtelierSettings(data: Partial<{ totalShelves: number; reminderDaysBeforeExpiry: number; guideEmailEnabled: boolean; paymentLinks: string | null }>) {
  const db = await getDb();
  if (!db) return;
  const existing = await getAtelierSettings();
  if (existing) {
    await db.update(atelierSettings).set(data).where(eq(atelierSettings.id, existing.id));
  } else {
    await db.insert(atelierSettings).values(data);
  }
}

// ─── Types de forfaits configurables ────────────────────────────────────────

export async function getAllPackageTypes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageTypes).orderBy(packageTypes.sortOrder, packageTypes.createdAt);
}

export async function getActivePackageTypes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(packageTypes)
    .where(eq(packageTypes.isActive, true))
    .orderBy(packageTypes.sortOrder, packageTypes.createdAt);
}

export async function getPackageTypeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(packageTypes).where(eq(packageTypes.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function createPackageType(data: Omit<InsertPackageType, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("DB non disponible");
  const result = await db.insert(packageTypes).values(data);
  return (result[0] as any).insertId as number;
}

export async function updatePackageType(id: number, data: Partial<Omit<InsertPackageType, 'id' | 'createdAt' | 'updatedAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("DB non disponible");
  await db.update(packageTypes).set(data).where(eq(packageTypes.id, id));
}

export async function deletePackageType(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB non disponible");
  await db.delete(packageTypes).where(eq(packageTypes.id, id));
}
