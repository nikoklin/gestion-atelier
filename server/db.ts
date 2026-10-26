import { eq, and, desc, gte, lte, isNull, isNotNull, inArray, ne, sql } from "drizzle-orm";
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
  // result[0] est un ResultSetHeader avec insertId (mysql2)
  return (result[0] as any).insertId as number;
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

// Résident archivé (étagère vidée ou supprimé) ayant cette adresse : sert à
// repérer un ancien résident qui repaie un forfait.
export async function getArchivedResidentByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(residents)
    .where(and(eq(residents.email, email), eq(residents.isDeleted, true)))
    .orderBy(desc(residents.updatedAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// Résident par identifiant, archivé ou non.
export async function getResidentByIdAnyStatus(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(residents).where(eq(residents.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
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
    // Un forfait en attente (en file ou en validation) n'est pas encore le forfait du résident.
    if (pkg.status === 'pending') continue;
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

// Le forfait à afficher en priorité pour un résident : le forfait réellement
// valide s'il y en a un, sinon le dernier créé (actif ou non) pour donner
// quand même un statut visible (ex: badge "Expiré"). Utilisé à la fois par
// la page personnelle du résident et la liste des résidents, pour éviter
// que ces deux vues divergent sur "quel est le forfait du résident".
export async function getDisplayPackageForResident(residentId: number) {
  const activePackage = await getActivePackageByResidentId(residentId);
  if (activePackage) return activePackage;

  const allPackages = await getPackagesByResidentId(residentId);
  return allPackages.length > 0 ? allPackages[0] : null;
}

// ─── Étagères à vider ──────────────────────────────────────────────────────

export const SHELF_RELEASE_DELAY_DAYS = 7;

export type ShelfSituation = {
  residentId: number;
  firstName: string;
  lastName: string;
  email: string;
  shelfNumber: string;
  packageId: number;
  finishedAt: Date;
  noticeSent: boolean;
};

// Résidents actifs qui gardent une étagère alors que leur dernier forfait est
// fini (date de fin passée, ou heures épuisées) et qu'ils n'ont ni forfait
// valable ni forfait payé en attente. finishedAt = moment où le forfait s'est
// terminé (le plus tôt entre la date de fin et le dernier pointage qui l'a épuisé).
export async function findFinishedPackageShelves(
  now: Date = new Date(),
  onlyResidentIds?: number[]
): Promise<ShelfSituation[]> {
  const db = await getDb();
  if (!db) return [];

  let rows = await db
    .select()
    .from(residents)
    .where(and(eq(residents.isActive, true), eq(residents.isDeleted, false)));
  rows = rows.filter((r) => (r.shelfNumber ?? "").trim() !== "");
  if (onlyResidentIds) rows = rows.filter((r) => onlyResidentIds.includes(r.id));

  const result: ShelfSituation[] = [];
  for (const r of rows) {
    const pkgs = await getPackagesByResidentId(r.id); // du plus récent au plus ancien
    if (pkgs.length === 0) continue;
    // A déjà payé (ou attend la validation d'un forfait) : l'étagère reste.
    if (pkgs.some((p) => p.status === "pending")) continue;
    // Un forfait encore valable : l'étagère reste.
    if (pkgs.some((p) => p.totalHours - p.usedHours > 0 && new Date(p.endDate) >= now)) continue;

    const latest = pkgs[0];
    const ends: Date[] = [];
    const endDate = new Date(latest.endDate);
    if (endDate <= now) ends.push(endDate);
    if (latest.totalHours - latest.usedHours <= 0) {
      const lastAttendance = await db
        .select({ checkOutTime: attendances.checkOutTime })
        .from(attendances)
        .where(and(eq(attendances.packageId, latest.id), eq(attendances.attendanceType, "normal")))
        .orderBy(desc(attendances.checkInTime))
        .limit(1);
      const exhaustedAt = lastAttendance[0]?.checkOutTime;
      ends.push(exhaustedAt ? new Date(exhaustedAt) : endDate);
    }
    if (ends.length === 0) continue;

    result.push({
      residentId: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      shelfNumber: (r.shelfNumber as string).trim(),
      packageId: latest.id,
      finishedAt: new Date(Math.min(...ends.map((d) => d.getTime()))),
      noticeSent: latest.shelfEmailSent,
    });
  }
  return result;
}

// Pouvant être signalée : forfait fini depuis au moins 7 jours, avis pas encore envoyé.
export function isShelfReleaseDue(c: ShelfSituation, now: Date): boolean {
  return !c.noticeSent && c.finishedAt.getTime() <= now.getTime() - SHELF_RELEASE_DELAY_DAYS * 86400000;
}

export async function findShelfReleaseCandidates(
  now: Date = new Date(),
  onlyResidentIds?: number[]
): Promise<ShelfSituation[]> {
  return (await findFinishedPackageShelves(now, onlyResidentIds)).filter((c) => isShelfReleaseDue(c, now));
}

// Étagères libres : nombre total (Paramètres) moins les numéros attribués à des
// résidents actifs — même calcul que la carte « Étagères » du tableau de bord.
export async function countFreeShelves(): Promise<number> {
  const [settings, active] = await Promise.all([getAtelierSettings(), getActiveResidents()]);
  const used = new Set(
    active.map((r) => parseInt((r.shelfNumber ?? "").trim(), 10)).filter((n) => !isNaN(n))
  );
  return Math.max(0, (settings?.totalShelves ?? 0) - used.size);
}

// Déjà prévenus et qui gardent encore leur étagère : à vider, puis à libérer par l'atelier.
export async function findShelvesToEmpty(now: Date = new Date()): Promise<ShelfSituation[]> {
  return (await findFinishedPackageShelves(now)).filter((c) => c.noticeSent);
}

// Liste des résidents actifs avec, pour chacun, le forfait à afficher, le
// dernier rappel et la présence d'un pointage en cours — en 4 requêtes au total
// (au lieu de 3 par résident). Même règle que getDisplayPackageForResident.
export async function getActiveResidentsOverview() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [residentRows, packageRows, openRows, reminderRows] = await Promise.all([
    getActiveResidents(),
    db.select().from(packages).orderBy(desc(packages.createdAt)),
    db.select({ residentId: attendances.residentId, checkInTime: attendances.checkInTime }).from(attendances).where(isNull(attendances.checkOutTime)),
    db
      .select({ residentId: emailLogs.residentId, sentAt: sql<string | Date | null>`max(${emailLogs.sentAt})` })
      .from(emailLogs)
      .where(eq(emailLogs.emailType, "reminder"))
      .groupBy(emailLogs.residentId),
  ]);

  const now = new Date();
  const packagesByResident = new Map<number, typeof packageRows>();
  for (const p of packageRows) {
    if (!packagesByResident.has(p.residentId)) packagesByResident.set(p.residentId, []);
    packagesByResident.get(p.residentId)!.push(p);
  }
  // Heure d'arrivée du pointage en cours (le plus récent s'il y en a plusieurs)
  const openCheckIn = new Map<number, Date>();
  for (const r of openRows) {
    const prev = openCheckIn.get(r.residentId);
    if (!prev || r.checkInTime > prev) openCheckIn.set(r.residentId, r.checkInTime);
  }
  // max() renvoie le texte brut de la base (heure UTC, sans fuseau) : converti en Date.
  const toUtcDate = (v: string | Date | null) =>
    v instanceof Date ? v : v ? new Date(`${String(v).replace(" ", "T")}Z`) : null;
  const lastReminder = new Map(reminderRows.map((r) => [r.residentId, toUtcDate(r.sentAt)]));

  return residentRows.map((resident) => {
    const list = packagesByResident.get(resident.id) ?? []; // du plus récent au plus ancien
    const valid = list.find(
      (p) => p.status !== "pending" && p.totalHours - p.usedHours > 0 && now <= new Date(p.endDate)
    );
    return {
      ...resident,
      activePackage: valid ?? list[0] ?? null,
      lastReminderDate: lastReminder.get(resident.id) ?? null,
      hasMissedCheckout: resident.hasMissedCheckout || false,
      missedCheckoutAttendanceId: resident.missedCheckoutAttendanceId || null,
      hasOpenAttendance: openCheckIn.has(resident.id),
      openCheckInTime: openCheckIn.get(resident.id) ?? null,
    };
  });
}

export async function getPackageById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPackageByWixPaymentId(wixPaymentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(packages).where(eq(packages.wixPaymentId, wixPaymentId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getRecentWixPaidPackages(limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      id: packages.id,
      residentId: packages.residentId,
      packageType: packages.packageType,
      totalHours: packages.totalHours,
      isActive: packages.isActive,
      status: packages.status,
      wixPaymentId: packages.wixPaymentId,
      createdAt: packages.createdAt,
      residentFirstName: residents.firstName,
      residentLastName: residents.lastName,
    })
    .from(packages)
    .innerJoin(residents, eq(packages.residentId, residents.id))
    .where(isNotNull(packages.wixPaymentId))
    .orderBy(desc(packages.createdAt))
    .limit(limit);
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
      status: packages.status,
      autoStart: packages.autoStart,
      shelfEmailSent: packages.shelfEmailSent,
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
      status: packages.status,
      autoStart: packages.autoStart,
      shelfEmailSent: packages.shelfEmailSent,
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
      packageDeductedMinutes: packages.deductedMinutes,
    })
    .from(attendances)
    .leftJoin(packages, eq(attendances.packageId, packages.id))
    .where(eq(attendances.residentId, residentId))
    .orderBy(desc(attendances.checkInTime));
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

// Vérifie si un créneau [checkInTime, checkOutTime] chevauche un pointage
// déjà enregistré pour ce résident (hors pointage exclu, utile en édition).
// Un pointage encore ouvert (checkOutTime null) est traité comme allant
// jusqu'à "maintenant" pour la comparaison.
export async function hasOverlappingAttendance(
  residentId: number,
  checkInTime: Date,
  checkOutTime: Date,
  excludeAttendanceId?: number
): Promise<boolean> {
  const existing = await getAttendancesByResidentId(residentId);
  return existing.some((att) => {
    if (excludeAttendanceId && att.id === excludeAttendanceId) return false;
    const existingStart = new Date(att.checkInTime).getTime();
    const existingEnd = att.checkOutTime ? new Date(att.checkOutTime).getTime() : Date.now();
    return checkInTime.getTime() < existingEnd && checkOutTime.getTime() > existingStart;
  });
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
      packageDeductedMinutes: packages.deductedMinutes,
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

export async function deleteAllAttendancesByResidentId(residentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(attendances).where(eq(attendances.residentId, residentId));
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
 * Conservé pour compatibilité des appelants. Délègue au moteur unique
 * `fullRecalculateResident` (règle « par date »), qui met à jour à la fois
 * les forfaits et le cumul hors-forfait du résident.
 */
export async function recalculateOutOfPackageHours(residentId: number): Promise<void> {
  await fullRecalculateResident(residentId);
}

type FlaggableAttendance = {
  id: number;
  residentId: number;
  packageId: number | null;
  checkInTime: Date | string;
  durationMinutes: number | null;
  attendanceType: string;
  packageTotalHours: number | null;
  packageDeductedMinutes: number | null;
};

/**
 * Détermine, pour un ensemble de pointages (avec leurs infos de forfait
 * jointes), lesquels afficher comme « Hors forfait » dans l'historique.
 *
 * Le badge représente le SOLDE ENCORE DÛ (résident.outOfPackageMinutes),
 * pas le total brut historique : une fois des heures reportées dans un
 * nouveau forfait (deductedMinutes) ou soldées (abandon), les anciens
 * pointages qui les représentaient ne doivent plus apparaître comme
 * « hors forfait ». La somme des pointages flagués correspond ainsi au
 * résumé affiché sur la fiche résident.
 *
 * Algorithme en deux passes :
 *  1. Calculer le débordement BRUT de chaque pointage, forfait par forfait,
 *     avec la même règle que `fullRecalculateResident` (les minutes déjà
 *     reportées consomment la capacité dès le départ).
 *  2. Pour chaque résident, parcourir ses pointages en débordement du PLUS
 *     RÉCENT au plus ancien et les marquer un par un jusqu'à couvrir le
 *     solde encore dû — les plus anciens (déjà reportés/soldés) ne sont
 *     plus marqués.
 *
 * `pendingByResident` : résidentId -> minutes encore dues (généralement
 * `resident.outOfPackageMinutes`, tel que maintenu par le moteur unique).
 */
export function computeOutOfPackageAttendanceIds(
  atts: FlaggableAttendance[],
  pendingByResident: Map<number, number>
): Set<number> {
  // Passe 1 : débordement brut par pointage (forfait par forfait).
  const overflowMinutesById = new Map<number, number>();
  const byPackage = new Map<number, FlaggableAttendance[]>();

  for (const att of atts) {
    if (att.attendanceType === 'adjustment_add' || att.attendanceType === 'adjustment_subtract') continue;
    if (!att.packageId || att.packageTotalHours == null) {
      overflowMinutesById.set(att.id, att.durationMinutes ?? 0); // orphelin = 100% hors forfait
      continue;
    }
    if (!byPackage.has(att.packageId)) byPackage.set(att.packageId, []);
    byPackage.get(att.packageId)!.push(att);
  }

  for (const [, list] of Array.from(byPackage)) {
    const sorted = [...list].sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime());
    const totalHours = sorted[0].packageTotalHours ?? Infinity;
    let cumul = sorted[0].packageDeductedMinutes ?? 0;
    for (const att of sorted) {
      const duration = att.durationMinutes ?? 0;
      if (!duration) {
        overflowMinutesById.set(att.id, 0);
        continue;
      }
      const cumulBefore = cumul;
      const cumulAfter = cumul + duration;
      let overflow = 0;
      if (cumulBefore >= totalHours) overflow = duration;
      else if (cumulAfter > totalHours) overflow = cumulAfter - totalHours;
      overflowMinutesById.set(att.id, overflow);
      cumul = cumulAfter;
    }
  }

  // Passe 2 : par résident, du plus récent au plus ancien, marquer jusqu'à
  // couvrir le solde encore dû.
  const byResident = new Map<number, FlaggableAttendance[]>();
  for (const att of atts) {
    if ((overflowMinutesById.get(att.id) ?? 0) <= 0) continue;
    if (!byResident.has(att.residentId)) byResident.set(att.residentId, []);
    byResident.get(att.residentId)!.push(att);
  }

  const flagged = new Set<number>();
  for (const [residentId, list] of Array.from(byResident)) {
    let remaining = pendingByResident.get(residentId) ?? 0;
    const sorted = [...list].sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
    for (const att of sorted) {
      if (remaining <= 0) break;
      flagged.add(att.id);
      remaining -= overflowMinutesById.get(att.id) ?? 0;
    }
  }

  return flagged;
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
// Heures hors forfait en attente = débordements restants − heures abandonnées.
// Les heures abandonnées ne peuvent pas dépasser les débordements qui existent
// encore : si des pointages sont effacés, le crédit d'abandon diminue d'autant.
// Sinon un crédit orphelin absorberait en silence les futurs débordements.
function settleOutOfPackage(grossMinutes: number, settled: number): { pending: number; settled: number } {
  const gross = Math.max(0, grossMinutes);
  const effectiveSettled = Math.min(Math.max(0, settled), gross);
  return { pending: gross - effectiveSettled, settled: effectiveSettled };
}

type RecalcResult = {
  packagesProcessed: number;
  attendancesProcessed: number;
  totalOutOfPackageMinutes: number;
};

export async function fullRecalculateResident(residentId: number): Promise<RecalcResult> {
  const { needsQueuedActivation, ...result } = await recalculateResidentCore(residentId);
  // Si le forfait en cours vient de finir, le forfait payé d'avance (en file)
  // démarre ici : couvre le recalcul de 00:05, chaque départ, les ajustements...
  if (needsQueuedActivation && (await activateNextQueuedPackage(residentId))) {
    const { needsQueuedActivation: _ignored, ...after } = await recalculateResidentCore(residentId);
    return after;
  }
  return result;
}

// Appelé quand un forfait en file démarre. Enregistré par emailService (pas
// d'import direct : emailService dépend déjà de db) ; sans écouteur (tests),
// aucun e-mail n'est envoyé.
export type QueuedPackageActivation = {
  residentId: number;
  packageId: number;
  packageType: string;
  totalHours: number;
  startDate: Date;
  endDate: Date;
};
let queuedActivationListener: ((info: QueuedPackageActivation) => Promise<void>) | null = null;
export function setQueuedActivationListener(
  listener: ((info: QueuedPackageActivation) => Promise<void>) | null
) {
  queuedActivationListener = listener;
}

// Fait démarrer le plus ancien forfait payé d'avance (status 'pending' +
// autoStart) quand le résident n'a plus de forfait valable. Début = fin du
// forfait précédent (date de fin, ou dernier pointage s'il a été épuisé
// avant), pour qu'il n'y ait ni trou ni heures hors forfait entre les deux.
// Fin réelle d'un forfait : sa date de fin, ou plus tôt le moment où ses heures
// se sont épuisées (dernier pointage ou ajustement qui lui est rattaché).
export function packageEffectiveEnd(
  pkg: { id: number; totalHours: number; usedHours: number; endDate: Date | string },
  residentAttendances: { packageId: number | null; checkInTime: Date | string; checkOutTime: Date | string | null }[]
): Date {
  const endDate = new Date(pkg.endDate);
  if (pkg.totalHours - pkg.usedHours > 0) return endDate;
  const outs = residentAttendances
    .filter((a) => a.packageId === pkg.id && a.checkOutTime)
    .map((a) => new Date(a.checkOutTime!).getTime());
  if (outs.length === 0) return endDate;
  return new Date(Math.min(endDate.getTime(), Math.max(...outs)));
}

export async function activateNextQueuedPackage(residentId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const queued = await db
    .select()
    .from(packages)
    .where(and(
      eq(packages.residentId, residentId),
      eq(packages.status, 'pending'),
      eq(packages.autoStart, true)
    ))
    .orderBy(packages.createdAt, packages.id);
  if (queued.length === 0) return false;
  if (await getActivePackageByResidentId(residentId)) return false;

  const next = queued[0];
  const now = new Date();

  // Le forfait en file démarre à la fin réelle du dernier forfait terminé (date
  // de fin, ou épuisement des heures s'il a eu lieu avant) — et non à la fin du
  // forfait dont la date de fin est la plus lointaine, qui a pu s'épuiser bien avant.
  const others = (await getPackagesByResidentId(residentId)).filter(
    (p) => p.status !== 'pending' && p.id !== next.id
  );
  let start = now;
  if (others.length > 0) {
    const residentAttendances = await db
      .select({ packageId: attendances.packageId, checkInTime: attendances.checkInTime, checkOutTime: attendances.checkOutTime })
      .from(attendances)
      .where(eq(attendances.residentId, residentId));
    const lastEnd = Math.max(...others.map((p) => packageEffectiveEnd(p, residentAttendances).getTime()));
    start = new Date(Math.min(lastEnd, now.getTime()));
  }

  let durationDays = 0;
  if (next.packageType.startsWith('custom_')) {
    const type = await getPackageTypeById(parseInt(next.packageType.replace('custom_', ''), 10));
    if (type) durationDays = type.durationWeeks * 7;
  }
  if (!durationDays) {
    // Type introuvable : conserver la durée prévue à la création.
    durationDays = Math.max(
      1,
      Math.round((new Date(next.endDate).getTime() - new Date(next.startDate).getTime()) / 86400000)
    );
  }
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays);

  await updatePackage(next.id, {
    status: 'active',
    isActive: true,
    startDate: start,
    endDate: end,
    deductedMinutes: 0,
    usedHours: 0,
  } as any);

  // Les pointages depuis `start` sont maintenant couverts par ce forfait ; on
  // ne reporte que les heures hors forfait qui restent après cette réattribution.
  await recalculateResidentCore(residentId);
  const resident = await getResidentById(residentId);
  const carry = resident?.outOfPackageMinutes ?? 0;
  if (carry > 0) await updatePackage(next.id, { deductedMinutes: carry } as any);

  console.log(
    `[QueuedPackage] Forfait #${next.id} démarré pour le résident ${residentId} (début ${start.toISOString()}, fin ${end.toISOString()}, reporté ${carry}min).`
  );

  if (queuedActivationListener) {
    await queuedActivationListener({
      residentId,
      packageId: next.id,
      packageType: next.packageType,
      totalHours: next.totalHours,
      startDate: start,
      endDate: end,
    }).catch((err) => console.error("[QueuedPackage] Écouteur d'activation en échec:", err));
  }
  return true;
}

async function recalculateResidentCore(residentId: number): Promise<RecalcResult & { needsQueuedActivation: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Tout est chargé en 3 requêtes, calculé en mémoire, et seules les valeurs qui
  // changent réellement sont réécrites : le serveur est loin de la base (≈ 0,2 s
  // par aller-retour), réécrire chaque pointage à chaque recalcul rendait
  // chaque pointage et chaque action sur un forfait très lent.
  const [packageRows, attendanceRows, residentRows] = await Promise.all([
    db.select().from(packages).where(eq(packages.residentId, residentId)).orderBy(packages.startDate, packages.id),
    db.select().from(attendances).where(eq(attendances.residentId, residentId)).orderBy(attendances.checkInTime, attendances.id),
    db.select().from(residents).where(eq(residents.id, residentId)).limit(1),
  ]);
  const resident = residentRows[0];
  const now = new Date();

  // Les forfaits en attente (en file ou en validation) ne participent pas au
  // moteur : ils n'absorbent aucun pointage et leur isActive/deductedMinutes est laissé tel quel.
  const allPackages = packageRows.filter((p) => p.status !== 'pending');
  const normalAttendances = attendanceRows.filter((a) => a.attendanceType === 'normal');

  // Un forfait en file démarre quand il n'y a plus de forfait valable.
  const hasQueued = packageRows.some((p) => p.status === 'pending' && p.autoStart);

  // Forfait de rattachement de chaque pointage normal (null = hors forfait).
  const targetPackageOf = new Map<number, number | null>();
  let totalOutOfPackageMinutes = 0;
  const packageUpdates: { id: number; usedHours: number; isActive: boolean }[] = [];
  let totalDeducted = 0;

  if (allPackages.length === 0) {
    // Aucun forfait : par définition, TOUS les pointages du résident sont
    // hors-forfait (sinon un résident sans forfait qui enregistre une session
    // via « J'ai oublié de pointer ! » verrait ses heures effacées à tort).
    for (const att of normalAttendances) {
      totalOutOfPackageMinutes += att.durationMinutes ?? 0;
    }
  } else {
    // 2. Le total de chaque forfait reste fixe (celui de son type). Un ajout
    // d'heures (+Heures) diminue les heures utilisées, un retrait les augmente.
    const pkgCapacities = allPackages.map((pkg) => {
      let manualUsedAdjustment = 0;
      for (const adj of attendanceRows) {
        if (adj.packageId !== pkg.id || adj.attendanceType === 'normal' || !adj.durationMinutes) continue;
        if (adj.attendanceType === 'adjustment_add') manualUsedAdjustment -= adj.durationMinutes;
        if (adj.attendanceType === 'adjustment_subtract') manualUsedAdjustment += adj.durationMinutes;
      }
      return {
        id: pkg.id,
        baseMinutes: pkg.totalHours,
        startDate: new Date(pkg.startDate),
        endDate: new Date(pkg.endDate),
        deductedMinutes: pkg.deductedMinutes ?? 0,
        manualUsedAdjustment,
      };
    });

    // Compteurs par forfait : minutes reportées du forfait précédent +
    // ajustements manuels. Un ajout peut faire passer ce compteur sous 0 (bonus
    // au-delà du total officiel) ; volontairement pas plafonné, pour que le geste
    // ait un effet même sur un forfait tout juste créé.
    const pkgUsed: Record<number, number> = {};
    for (const p of pkgCapacities) pkgUsed[p.id] = p.deductedMinutes + p.manualUsedAdjustment;

    // 5. Rattacher chaque pointage, dans l'ordre chronologique, au premier
    // forfait valable à sa date et qui a encore de la capacité.
    for (const att of normalAttendances) {
      targetPackageOf.set(att.id, null);
      if (!att.durationMinutes) continue;
      const checkInDate = new Date(att.checkInTime);
      let assigned = false;
      for (const p of pkgCapacities) {
        const withinDate = checkInDate >= p.startDate && checkInDate <= p.endDate;
        const remaining = p.baseMinutes - pkgUsed[p.id];
        if (withinDate && remaining > 0) {
          targetPackageOf.set(att.id, p.id);
          pkgUsed[p.id] += Math.min(att.durationMinutes, remaining);
          if (att.durationMinutes > remaining) totalOutOfPackageMinutes += att.durationMinutes - remaining;
          assigned = true;
          break;
        }
      }
      if (!assigned) totalOutOfPackageMinutes += att.durationMinutes;
    }

    // 6. usedHours et isActive de chaque forfait.
    for (const p of pkgCapacities) {
      const used = Math.min(pkgUsed[p.id], p.baseMinutes);
      packageUpdates.push({ id: p.id, usedHours: used, isActive: p.baseMinutes - used > 0 && now <= p.endDate });
    }
    totalDeducted = pkgCapacities.reduce((sum, p) => sum + p.deductedMinutes, 0);
  }

  // Écritures : seulement ce qui change.
  const writes: Promise<unknown>[] = [];
  const byTarget = new Map<number | null, number[]>();
  for (const att of normalAttendances) {
    const target = targetPackageOf.get(att.id) ?? (allPackages.length === 0 ? att.packageId : null);
    if (allPackages.length > 0 && att.packageId !== target) {
      if (!byTarget.has(target)) byTarget.set(target, []);
      byTarget.get(target)!.push(att.id);
    }
  }
  for (const [target, ids] of Array.from(byTarget.entries())) {
    writes.push(db.update(attendances).set({ packageId: target }).where(inArray(attendances.id, ids)));
  }
  for (const u of packageUpdates) {
    const current = allPackages.find((p) => p.id === u.id)!;
    if (current.usedHours !== u.usedHours || current.isActive !== u.isActive) {
      writes.push(updatePackage(u.id, { usedHours: u.usedHours, isActive: u.isActive }));
    }
  }

  // 7. Heures hors forfait EN ATTENTE = débordements − reporté (deductedMinutes)
  //    − abandonné (settledOutOfPackageMinutes). Sans ces soustractions, les heures
  //    déjà traitées seraient recomptées à chaque recalcul (« heures fantômes »).
  const storedSettled = resident?.settledOutOfPackageMinutes ?? 0;
  const { pending: pendingOutOfPackageMinutes, settled } = settleOutOfPackage(
    totalOutOfPackageMinutes - totalDeducted,
    storedSettled
  );
  if (resident && (resident.outOfPackageMinutes !== pendingOutOfPackageMinutes || settled !== storedSettled)) {
    writes.push(updateResident(residentId, {
      outOfPackageMinutes: pendingOutOfPackageMinutes,
      ...(settled !== storedSettled ? { settledOutOfPackageMinutes: settled } : {}),
    }));
  }
  await Promise.all(writes);

  const hasValidPackage = packageUpdates.some((u) => u.isActive);

  console.log(
    `[fullRecalculateResident] resident=${residentId} packages=${allPackages.length} attendances=${normalAttendances.length} débordements=${totalOutOfPackageMinutes}min reporté=${totalDeducted}min enAttente=${pendingOutOfPackageMinutes}min écritures=${writes.length}`
  );

  return {
    packagesProcessed: allPackages.length,
    attendancesProcessed: normalAttendances.length,
    totalOutOfPackageMinutes: pendingOutOfPackageMinutes,
    needsQueuedActivation: hasQueued && !hasValidPackage,
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

export async function updateAtelierSettings(data: Partial<{ totalShelves: number; reminderDaysBeforeExpiry: number; guideEmailEnabled: boolean; paymentLinks: string | null; wixAutoActivatePackage: boolean; reminderSendHour: number; missedCheckoutCutoffHour: number; autoPaymentLinksEnabled: boolean; paymentLinkValidityDays: number; paymentLinkPackageTypeIds: string | null }>) {
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
