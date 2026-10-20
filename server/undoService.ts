import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb, fullRecalculateResident } from "./db";
import { attendances, packages, residents, undoActions } from "../drizzle/schema";

// « Annuler » de la page de gestion des forfaits.
//
// Chaque action enregistre l'état du résident avant et après. Annuler ne remet
// en arrière QUE les lignes modifiées par cette action (pas un retour global en
// arrière), et seulement si elles n'ont pas été modifiées depuis : un pointage
// fait à la borne entre-temps n'est donc jamais effacé. Les valeurs calculées
// (heures utilisées, forfait actif, rattachement des pointages, solde hors
// forfait) sont ensuite recalculées par le moteur.

const MAX_ACTIONS_PER_RESIDENT = 20;
const MAX_AGE_DAYS = 7;

type Row = Record<string, unknown>;
type State = {
  packages: Row[];
  attendances: Row[];
  resident: Row | null;
};

// Champs « saisis » (ce que les actions modifient). Les champs calculés par le
// moteur et les indicateurs d'envoi d'e-mails sont volontairement exclus.
const PACKAGE_FIELDS = ["residentId", "packageType", "totalHours", "deductedMinutes", "startDate", "endDate", "status", "autoStart", "wixPaymentId"];
const ATTENDANCE_FIELDS = ["residentId", "checkInTime", "checkOutTime", "durationMinutes", "attendanceType", "note"];
const RESIDENT_FIELDS = ["settledOutOfPackageMinutes", "hasMissedCheckout", "missedCheckoutAttendanceId"];

const toPlain = (row: object): Row =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));

async function captureState(residentId: number): Promise<State> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [pkgRows, attRows, resRows] = await Promise.all([
    db.select().from(packages).where(eq(packages.residentId, residentId)),
    db.select().from(attendances).where(eq(attendances.residentId, residentId)),
    db.select().from(residents).where(eq(residents.id, residentId)).limit(1),
  ]);
  return {
    packages: pkgRows.map(toPlain),
    attendances: attRows.map(toPlain),
    resident: resRows[0] ? toPlain(resRows[0]) : null,
  };
}

// Pour un pointage normal, le forfait de rattachement est recalculé par le
// moteur ; pour un ajustement (+/- heures), il fait partie de la saisie.
const attendanceFields = (row: Row | undefined) =>
  row && row.attendanceType !== "normal" ? [...ATTENDANCE_FIELDS, "packageId"] : ATTENDANCE_FIELDS;

const sameFields = (a: Row | undefined, b: Row | undefined, fields: string[]) => {
  if (!a || !b) return a === b;
  return fields.every((f) => (a[f] ?? null) === (b[f] ?? null));
};

type Change = { id: number; before?: Row; after?: Row };

function diffRows(before: Row[], after: Row[], fieldsFor: (row: Row | undefined) => string[]): Change[] {
  const b = new Map(before.map((r) => [r.id as number, r]));
  const a = new Map(after.map((r) => [r.id as number, r]));
  const ids = new Set([...Array.from(b.keys()), ...Array.from(a.keys())]);
  const changes: Change[] = [];
  for (const id of Array.from(ids)) {
    const rb = b.get(id);
    const ra = a.get(id);
    if (!sameFields(rb, ra, fieldsFor(rb ?? ra))) changes.push({ id, before: rb, after: ra });
  }
  return changes;
}

const hasChanges = (before: State, after: State) =>
  diffRows(before.packages, after.packages, () => PACKAGE_FIELDS).length > 0 ||
  diffRows(before.attendances, after.attendances, attendanceFields).length > 0 ||
  !sameFields(before.resident ?? undefined, after.resident ?? undefined, RESIDENT_FIELDS);

/**
 * Exécute une action en mémorisant l'état avant/après pour pouvoir l'annuler.
 * L'action est mémorisée même si elle lève une erreur après avoir modifié les
 * données (certaines actions renvoient un avertissement une fois l'enregistrement fait).
 */
export async function withUndo<T>(residentId: number, label: string, action: () => Promise<T>): Promise<T> {
  let before: State | null = null;
  try {
    before = await captureState(residentId);
  } catch (err) {
    console.error("[Undo] Impossible de mémoriser l'état avant l'action:", err);
  }

  try {
    return await action();
  } finally {
    if (before) {
      try {
        const after = await captureState(residentId);
        if (after.resident && hasChanges(before, after)) {
          await saveUndoAction(residentId, label, before, after);
        }
      } catch (err) {
        console.error("[Undo] Impossible de mémoriser l'action:", err);
      }
    }
  }
}

async function saveUndoAction(residentId: number, label: string, before: State, after: State) {
  const db = await getDb();
  if (!db) return;
  await db.insert(undoActions).values({
    residentId,
    label: label.slice(0, 255),
    beforeState: JSON.stringify(before),
    afterState: JSON.stringify(after),
  });

  // Au-delà des 20 dernières actions du résident : supprimées. (Les actions de
  // plus de 7 jours sont purgées par la tâche de nuit, purgeOldUndoActions.)
  const kept = await db
    .select({ id: undoActions.id })
    .from(undoActions)
    .where(eq(undoActions.residentId, residentId))
    .orderBy(desc(undoActions.id));
  const extra = kept.slice(MAX_ACTIONS_PER_RESIDENT).map((r) => r.id);
  if (extra.length > 0) await db.delete(undoActions).where(inArray(undoActions.id, extra));
}

export async function purgeOldUndoActions() {
  const db = await getDb();
  if (!db) return;
  await db.delete(undoActions).where(lt(undoActions.createdAt, new Date(Date.now() - MAX_AGE_DAYS * 86400000)));
}

export async function getLastUndoAction(residentId: number) {
  const db = await getDb();
  if (!db) return null;
  const limit = new Date(Date.now() - MAX_AGE_DAYS * 86400000);
  const rows = await db
    .select({ id: undoActions.id, label: undoActions.label, createdAt: undoActions.createdAt })
    .from(undoActions)
    .where(eq(undoActions.residentId, residentId))
    .orderBy(desc(undoActions.id))
    .limit(1);
  const last = rows[0];
  if (!last || last.createdAt < limit) return null;
  const count = (await db.select({ id: undoActions.id }).from(undoActions).where(eq(undoActions.residentId, residentId))).length;
  return { ...last, remaining: count };
}

export class UndoConflictError extends Error {}

// Valeurs prêtes à écrire en base (dates ISO → Date).
const DATE_FIELDS = new Set(["startDate", "endDate", "checkInTime", "checkOutTime", "createdAt", "updatedAt"]);
const toDbValues = (row: Row, fields: string[]) =>
  Object.fromEntries(
    fields.map((f) => [f, DATE_FIELDS.has(f) && row[f] ? new Date(row[f] as string) : row[f] ?? null])
  );

/**
 * Annule la dernière action mémorisée pour ce résident. Refuse (UndoConflictError)
 * si les données concernées ont été modifiées depuis, pour ne rien écraser.
 */
export async function undoLastAction(residentId: number): Promise<{ label: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(undoActions)
    .where(eq(undoActions.residentId, residentId))
    .orderBy(desc(undoActions.id))
    .limit(1);
  const entry = rows[0];
  if (!entry) throw new UndoConflictError("Aucune action à annuler.");

  const before = JSON.parse(entry.beforeState) as State;
  const after = JSON.parse(entry.afterState) as State;
  const current = await captureState(residentId);

  const pkgChanges = diffRows(before.packages, after.packages, () => PACKAGE_FIELDS);
  const attChanges = diffRows(before.attendances, after.attendances, attendanceFields);
  const residentChanged = !sameFields(before.resident ?? undefined, after.resident ?? undefined, RESIDENT_FIELDS);

  // Les lignes à remettre doivent être exactement dans l'état laissé par l'action.
  const curPkgs = new Map(current.packages.map((r) => [r.id as number, r]));
  const curAtts = new Map(current.attendances.map((r) => [r.id as number, r]));
  const conflict =
    pkgChanges.some((c) => !sameFields(curPkgs.get(c.id), c.after, PACKAGE_FIELDS)) ||
    attChanges.some((c) => !sameFields(curAtts.get(c.id), c.after, attendanceFields(c.after ?? c.before))) ||
    (residentChanged && !sameFields(current.resident ?? undefined, after.resident ?? undefined, RESIDENT_FIELDS)) ||
    // Une ligne à recréer ne doit pas avoir été recréée entre-temps.
    pkgChanges.some((c) => !c.after && curPkgs.has(c.id)) ||
    attChanges.some((c) => !c.after && curAtts.has(c.id));
  if (conflict) {
    throw new UndoConflictError(
      "Impossible d'annuler : ces forfaits ou pointages ont été modifiés depuis cette action. Annule d'abord les actions plus récentes, ou corrige à la main."
    );
  }

  // 1. Recréer les forfaits supprimés par l'action.
  for (const c of pkgChanges.filter((c) => c.before && !c.after)) {
    const row = c.before!;
    await db.insert(packages).values({
      id: row.id as number,
      ...toDbValues(row, [...PACKAGE_FIELDS, "usedHours", "isActive", "reminderSent", "expirationEmailSent", "shelfEmailSent", "createdAt"]),
    } as any);
  }
  // 2. Remettre les forfaits modifiés.
  for (const c of pkgChanges.filter((c) => c.before && c.after)) {
    await db.update(packages).set(toDbValues(c.before!, PACKAGE_FIELDS) as any).where(eq(packages.id, c.id));
  }
  // 3. Recréer / remettre les pointages.
  const existingPackageIds = new Set(
    (await db.select({ id: packages.id }).from(packages).where(eq(packages.residentId, residentId))).map((r) => r.id)
  );
  for (const c of attChanges.filter((c) => c.before)) {
    const row = c.before!;
    const pkgId = row.packageId as number | null;
    const values = {
      ...toDbValues(row, ATTENDANCE_FIELDS),
      packageId: pkgId && existingPackageIds.has(pkgId) ? pkgId : null,
    };
    if (c.after) {
      await db.update(attendances).set(values as any).where(eq(attendances.id, c.id));
    } else {
      await db.insert(attendances).values({ id: row.id as number, ...values, createdAt: new Date(row.createdAt as string) } as any);
    }
  }
  // 4. Supprimer les pointages créés par l'action.
  const createdAttendanceIds = attChanges.filter((c) => !c.before).map((c) => c.id);
  if (createdAttendanceIds.length > 0) {
    await db.delete(attendances).where(inArray(attendances.id, createdAttendanceIds));
  }
  // 5. Supprimer les forfaits créés par l'action, sans emporter les pointages
  //    normaux qui y sont rattachés (le moteur les réattribuera).
  for (const c of pkgChanges.filter((c) => !c.before)) {
    await db
      .update(attendances)
      .set({ packageId: null })
      .where(and(eq(attendances.packageId, c.id), eq(attendances.attendanceType, "normal")));
    await db.delete(packages).where(eq(packages.id, c.id));
  }
  // 6. Champs du résident.
  if (residentChanged && before.resident) {
    await db.update(residents).set(toDbValues(before.resident, RESIDENT_FIELDS) as any).where(eq(residents.id, residentId));
  }

  await db.delete(undoActions).where(eq(undoActions.id, entry.id));
  await fullRecalculateResident(residentId);
  return { label: entry.label };
}

export async function clearUndoHistory(residentId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(undoActions).where(eq(undoActions.residentId, residentId));
}

export async function residentOfPackage(packageId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ residentId: packages.residentId }).from(packages).where(eq(packages.id, packageId)).limit(1);
  return rows[0]?.residentId ?? 0;
}

export async function residentOfAttendance(attendanceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ residentId: attendances.residentId }).from(attendances).where(eq(attendances.id, attendanceId)).limit(1);
  return rows[0]?.residentId ?? 0;
}
