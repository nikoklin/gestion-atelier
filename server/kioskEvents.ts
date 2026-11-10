import { eq } from "drizzle-orm";
import * as db from "./db";
import { getDb } from "./db";
import { kioskEvents } from "../drizzle/schema";
import { OUT_OF_PACKAGE_LIMIT_MINUTES } from "./limits";
import { performCheckout } from "./checkoutLogic";
import { formatParisTime } from "./_core/timezone";

// Pointages de la tablette de l'atelier. La tablette décide elle-même s'il s'agit
// d'une arrivée ou d'un départ et envoie l'heure réelle de l'appui : un pointage
// gardé dans sa file pendant une coupure de réseau est ainsi enregistré à la bonne
// heure. Chaque pointage porte un identifiant (eventId) : renvoyé plusieurs fois,
// il n'est appliqué qu'une fois et la même réponse est renvoyée.

export type KioskAction = "checkin" | "checkout";

export type KioskEventInput = {
  eventId: string;
  residentId: number;
  action: KioskAction;
  occurredAt: Date;
};

export type KioskEventResult = {
  action: KioskAction;
  resident: { id: number; firstName: string; lastName: string };
  occurredAt: string;
  durationMinutes?: number;
  isOutOfPackage?: boolean;
  remainingHours?: number;
  remainingMinutes?: number;
};

// Erreur « métier » : le pointage est refusé pour de bon (la tablette ne le renvoie pas).
export class KioskEventRejected extends Error {
  constructor(message: string, public code: "BAD_REQUEST" | "NOT_FOUND" = "BAD_REQUEST") {
    super(message);
  }
}

// Le même pointage est en cours de traitement (deux envois simultanés) : à renvoyer plus tard.
export class KioskEventInProgress extends Error {}

const MAX_FUTURE_MS = 2 * 60 * 1000;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// Au-delà, le pointage vient de la file hors connexion : la personne était là, on ne
// le bloque plus sur la limite d'heures hors forfait (le contrôle de nuit le signale).
const LIVE_WINDOW_MS = 2 * 60 * 1000;

export async function recordKioskEvent(input: KioskEventInput, now: Date = new Date()): Promise<KioskEventResult> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");

  // Réserver l'identifiant avant de traiter : un second envoi du même pointage
  // trouve la ligne et ne l'applique pas une deuxième fois.
  try {
    await database.insert(kioskEvents).values({
      eventId: input.eventId,
      residentId: input.residentId,
      action: input.action,
      occurredAt: input.occurredAt,
    });
  } catch (err: any) {
    if (!isDuplicateKey(err)) throw err;
    const [existing] = await database.select().from(kioskEvents).where(eq(kioskEvents.eventId, input.eventId)).limit(1);
    if (!existing?.result) throw new KioskEventInProgress("Pointage en cours de traitement");
    const stored = JSON.parse(existing.result);
    if (stored.error) throw new KioskEventRejected(stored.error, stored.code);
    return stored as KioskEventResult;
  }

  try {
    const { result, attendanceId } = await applyKioskEvent(input, now);
    await database.update(kioskEvents)
      .set({ result: JSON.stringify(result), attendanceId: attendanceId ?? null })
      .where(eq(kioskEvents.eventId, input.eventId));
    return result;
  } catch (err) {
    if (err instanceof KioskEventRejected) {
      // Refus mémorisé : un renvoi du même pointage obtient le même refus.
      await database.update(kioskEvents)
        .set({ result: JSON.stringify({ error: err.message, code: err.code }) })
        .where(eq(kioskEvents.eventId, input.eventId));
    } else {
      // Panne (base, réseau…) : on libère l'identifiant pour que la tablette réessaie.
      await database.delete(kioskEvents).where(eq(kioskEvents.eventId, input.eventId)).catch(() => {});
    }
    throw err;
  }
}

function isDuplicateKey(err: any): boolean {
  const e = err?.cause ?? err;
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || /Duplicate entry/i.test(String(e?.message ?? err?.message));
}

async function applyKioskEvent(
  input: KioskEventInput,
  now: Date
): Promise<{ result: KioskEventResult; attendanceId?: number }> {
  if (input.occurredAt.getTime() > now.getTime() + MAX_FUTURE_MS) {
    throw new KioskEventRejected("L'heure du pointage est dans le futur : vérifier l'heure de la tablette.");
  }
  if (now.getTime() - input.occurredAt.getTime() > MAX_AGE_MS) {
    throw new KioskEventRejected("Pointage de plus de 14 jours : à saisir à la main.");
  }
  // Petite avance d'horloge de la tablette : ramenée à maintenant. À la seconde près,
  // comme la base (qui arrondirait les millisecondes et fausserait la durée d'une minute).
  const clamped = input.occurredAt > now ? now : input.occurredAt;
  const occurredAt = new Date(Math.floor(clamped.getTime() / 1000) * 1000);
  const isLive = now.getTime() - occurredAt.getTime() <= LIVE_WINDOW_MS;

  const resident = await db.getResidentById(input.residentId);
  if (!resident || !resident.isActive) throw new KioskEventRejected("Résident non trouvé ou inactif", "NOT_FOUND");
  const who = { id: resident.id, firstName: resident.firstName, lastName: resident.lastName };
  const base = { resident: who, occurredAt: occurredAt.toISOString() };

  const openAttendance = await db.getOpenAttendance(resident.id);

  if (input.action === "checkin") {
    if (openAttendance) {
      throw new KioskEventRejected(`${resident.firstName} est déjà pointé(e) présent(e) depuis ${formatParisTime(openAttendance.checkInTime)}.`);
    }
    if (isLive && (resident.outOfPackageMinutes ?? 0) >= OUT_OF_PACKAGE_LIMIT_MINUTES) {
      throw new KioskEventRejected("Le solde d'heures hors-forfait a atteint la limite de 5h. Il faut régulariser (nouveau forfait, ou « + Heures » sur le forfait) avant de pouvoir pointer à nouveau.");
    }
    // Même règle que l'ancien pointage : sans forfait valable, la séance compte hors forfait.
    const activePackage = await db.getActivePackageByResidentId(resident.id);
    const remaining = activePackage
      ? activePackage.totalHours - activePackage.usedHours
      : (resident.outOfPackageMinutes ?? 0);
    await db.createAttendance({
      residentId: resident.id,
      packageId: activePackage?.id ?? null,
      checkInTime: occurredAt,
      checkOutTime: null,
      durationMinutes: null,
    });
    const created = await db.getOpenAttendance(resident.id);
    return {
      result: {
        ...base,
        action: "checkin",
        isOutOfPackage: !activePackage,
        remainingHours: Math.floor(remaining / 60),
        remainingMinutes: remaining % 60,
      },
      attendanceId: created?.id,
    };
  }

  // Départ
  if (openAttendance) {
    if (occurredAt <= new Date(openAttendance.checkInTime)) {
      throw new KioskEventRejected("L'heure de départ est avant l'heure d'arrivée.");
    }
    const checkout = await performCheckout({
      attendanceId: openAttendance.id,
      packageId: openAttendance.packageId,
      residentEmail: resident.email,
      residentFirstName: resident.firstName,
      residentId: resident.id,
      checkOutTime: occurredAt,
    });
    return {
      result: {
        ...base,
        action: "checkout",
        durationMinutes: checkout.durationMinutes,
        isOutOfPackage: checkout.isOutOfPackage,
        remainingHours: checkout.remainingHours,
        remainingMinutes: checkout.remainingMinutes,
      },
      attendanceId: openAttendance.id,
    };
  }

  // Départ transmis après la clôture automatique de 22 h (tablette hors ligne) :
  // on remet la vraie heure de départ et on retire l'alerte « oubli de pointage ».
  if (resident.hasMissedCheckout && resident.missedCheckoutAttendanceId) {
    const closed = await db.getAttendanceById(resident.missedCheckoutAttendanceId);
    if (closed?.checkOutTime && new Date(closed.checkInTime) < occurredAt && occurredAt <= new Date(closed.checkOutTime)) {
      const durationMinutes = Math.floor((occurredAt.getTime() - new Date(closed.checkInTime).getTime()) / 60000);
      await db.updateAttendance(closed.id, { checkOutTime: occurredAt, durationMinutes });
      await db.updateResident(resident.id, { hasMissedCheckout: false, missedCheckoutAttendanceId: null });
      await db.fullRecalculateResident(resident.id);
      return { result: { ...base, action: "checkout", durationMinutes }, attendanceId: closed.id };
    }
  }

  throw new KioskEventRejected(`${resident.firstName} n'a pas de pointage d'arrivée en cours.`, "NOT_FOUND");
}

// Données de la tablette (gardées sur l'appareil pour fonctionner hors connexion) :
// le strict nécessaire, sans e-mail ni téléphone.
export async function getKioskState() {
  const [activeResidents, open, allPackages] = await Promise.all([
    db.getActiveResidents(),
    db.getAllOpenAttendances(),
    db.getAllPackages(),
  ]);
  const withValid = new Set(allPackages.filter((p) => p.isActive).map((p) => p.residentId));
  const withExpired = new Set(allPackages.filter((p) => !p.isActive && !withValid.has(p.residentId)).map((p) => p.residentId));
  return {
    residents: activeResidents
      .map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName, "fr")),
    openAttendances: open.map((a) => ({ residentId: a.residentId, checkInTime: new Date(a.checkInTime).toISOString() })),
    residentsWithValidPackage: Array.from(withValid),
    residentsWithExpiredPackage: Array.from(withExpired),
    generatedAt: new Date().toISOString(),
  };
}
