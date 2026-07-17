import { eq, and, desc, gte, lte, isNull, inArray, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
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

/**
 * Construit le pool mysql2 à partir de DATABASE_URL.
 * Active TLS automatiquement pour TiDB Cloud (ou si DB_SSL=1), ce qui permet
 * de fournir un DATABASE_URL simple, sans le paramètre `?ssl={...}` (dont les
 * guillemets passent mal dans certaines interfaces d'hébergeur, ex. Railway).
 */
function createPool() {
  const url = process.env.DATABASE_URL!;
  const m = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
  const needsSsl = /tidbcloud\.com/i.test(url) || process.env.DB_SSL === "1";

  if (!m) {
    // Repli : laisser mysql2 parser l'URL telle quelle.
    return mysql.createPool(url);
  }

  const [, user, password, host, port, database] = m;
  return mysql.createPool({
    host,
    port: Number(port),
    user: decodeURIComponent(user),
    password: decodeURIComponent(password),
    database,
    ssl: needsSsl ? { minVersion: "TLSv1.2" } : undefined,
  });
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(createPool());
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

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
 * Heures hors-forfait EN ATTENTE pour tous les résidents.
 * Source unique : la colonne residents.outOfPackageMinutes, maintenue par
 * fullRecalculateResident. (Ne recalcule plus à la volée pour éviter toute
 * divergence entre les différents écrans.)
 * @returns Map residentId -> minutes hors-forfait en attente (seulement > 0)
 */
export async function getAllOutOfPackageHours(): Promise<Map<number, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ id: residents.id, outOfPackageMinutes: residents.outOfPackageMinutes })
    .from(residents);

  const map = new Map<number, number>();
  for (const r of rows) {
    const minutes = r.outOfPackageMinutes ?? 0;
    if (minutes > 0) map.set(r.id, minutes);
  }
  return map;
}

/**
 * Heures hors-forfait EN ATTENTE d'un résident.
 * Source unique : residents.outOfPackageMinutes (maintenue par
 * fullRecalculateResident).
 */
export async function getOutOfPackageHoursByResidentId(residentId: number): Promise<number> {
  const resident = await getResidentById(residentId);
  return resident?.outOfPackageMinutes ?? 0;
}

/**
 * Abandonne définitivement les heures hors-forfait actuellement EN ATTENTE
 * d'un résident (choix « ne pas déduire » à la création d'un forfait).
 * Les minutes en attente sont ajoutées au compteur SOLDÉ, de sorte que le
 * moteur ne les recompte plus jamais, puis on recalcule.
 */
export async function clearOutOfPackageHours(residentId: number): Promise<void> {
  const resident = await getResidentById(residentId);
  if (!resident) return;

  const pending = resident.outOfPackageMinutes ?? 0;
  const settled = resident.settledOutOfPackageMinutes ?? 0;
  if (pending > 0) {
    await updateResident(residentId, { settledOutOfPackageMinutes: settled + pending });
  }
  await fullRecalculateResident(residentId);
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
/**
 * Conservé pour compatibilité des appelants. Délègue au moteur unique
 * `fullRecalculateResident` (règle « par date »), qui met à jour à la fois
 * les forfaits et le cumul hors-forfait du résident.
 */
export async function recalculateOutOfPackageHours(residentId: number): Promise<void> {
  await fullRecalculateResident(residentId);
}

/**
 * Recalcule les heures d'un forfait.
 *
 * NOTE : le moteur unique de calcul est `fullRecalculateResident` (règle
 * « par date » : chaque pointage est imputé au forfait valable à sa date).
 * Cette fonction est conservée pour son interface de retour, utilisée par les
 * appelants (checkout, création/modification de pointage). Elle délègue au
 * moteur unique puis relit les valeurs à jour du forfait et du résident.
 *
 * Retourne, pour le forfait demandé :
 *  - usedHours : minutes imputées au forfait (plafonné à son total),
 *  - outOfPackageMinutes : heures hors-forfait EN ATTENTE du résident,
 *  - remainingMinutes : capacité restante du forfait.
 */
export async function recalculatePackageHours(packageId: number): Promise<{
  usedHours: number;
  outOfPackageMinutes: number;
  remainingMinutes: number;
}> {
  const pkg = await getPackageById(packageId);
  if (!pkg) throw new Error(`Package ${packageId} not found`);

  // Moteur unique (règle par date).
  await fullRecalculateResident(pkg.residentId);

  // Relire les valeurs à jour.
  const updated = await getPackageById(packageId);
  const resident = await getResidentById(pkg.residentId);
  const totalHours = updated?.totalHours ?? pkg.totalHours;
  const usedHours = updated?.usedHours ?? 0;

  return {
    usedHours,
    outOfPackageMinutes: resident?.outOfPackageMinutes ?? 0,
    remainingMinutes: Math.max(0, totalHours - usedHours),
  };
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

  // 7. Mettre à jour outOfPackageMinutes du résident.
  // outOfPackageMinutes = heures hors-forfait EN ATTENTE (ni reportées, ni abandonnées).
  // = total des débordements bruts
  //   − total déjà reporté dans un forfait suivant (deductedMinutes)
  //   − total déjà soldé/abandonné (settledOutOfPackageMinutes).
  // Sans ces soustractions, les heures déjà traitées seraient recomptées à
  // chaque recalcul (« heures fantômes »).
  const resident = await getResidentById(residentId);
  const settled = resident?.settledOutOfPackageMinutes ?? 0;
  const totalDeducted = pkgCapacities.reduce((sum, p) => sum + p.deductedMinutes, 0);
  const pendingOutOfPackageMinutes = Math.max(0, totalOutOfPackageMinutes - totalDeducted - settled);
  await updateResident(residentId, { outOfPackageMinutes: pendingOutOfPackageMinutes });

  console.log(
    `[fullRecalculateResident] resident=${residentId} packages=${pkgCapacities.length} attendances=${attendancesProcessed} débordements=${totalOutOfPackageMinutes}min reporté=${totalDeducted}min enAttente=${pendingOutOfPackageMinutes}min`
  );

  return {
    packagesProcessed: pkgCapacities.length,
    attendancesProcessed,
    totalOutOfPackageMinutes: pendingOutOfPackageMinutes,
  };
}

/**
 * Recalcule TOUS les résidents via le moteur unique. Sert à la tâche
 * quotidienne (désactive les forfaits dont la date de fin est passée et
 * maintient la cohérence des heures) et à un recalcul global ponctuel.
 */
export async function recalculateAllResidents(): Promise<{ residents: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ id: residents.id }).from(residents);
  for (const r of rows) {
    await fullRecalculateResident(r.id);
  }
  return { residents: rows.length };
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
