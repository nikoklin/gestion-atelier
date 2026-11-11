/**
 * Clôture automatique d'un départ oublié (heure limite du jour d'arrivée) : les
 * heures comptent tout de suite sur le forfait, sans attendre le recalcul de nuit
 * (qui sinon les corrigeait et le signalait comme une incohérence). Résident de test 990170, nettoyé à la fin ;
 * seule la clôture d'un pointage est testée (la tâche de 22 h parcourt toute la base).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { closeMissedCheckout } from "./missedCheckoutService";
import { formatParisTime, parisDateTimeToDate, getParisDateString } from "./_core/timezone";

const RID = 990170;
const DAY = 86400000;

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  await database.delete(attendances).where(eq(attendances.residentId, RID));
  await database.delete(packages).where(eq(packages.residentId, RID));
  await database.delete(residents).where(eq(residents.id, RID));
}

describe.skipIf(!process.env.DATABASE_URL)("Clôture automatique d'un départ oublié", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("départ à 22 h le jour de l'arrivée, forfait recalculé tout de suite, rien à signaler la nuit", async () => {
    // Arrivée hier à 16:15 (heure de Paris), jamais pointé au départ.
    const yesterday = getParisDateString(new Date(Date.now() - DAY));
    const checkIn = parisDateTimeToDate(yesterday, 16, 15);
    await db.createResident({ id: RID, firstName: "TEST", lastName: "Oubli", email: "", isActive: true } as any);
    await db.createPackage({ id: RID * 10, residentId: RID, packageType: "custom_1", totalHours: 1800, usedHours: 197,
      startDate: new Date(Date.now() - 20 * DAY), endDate: new Date(Date.now() + 20 * DAY), isActive: true, status: "active" } as any);
    await db.createAttendance({ id: RID * 10, residentId: RID, packageId: RID * 10, checkInTime: new Date(Date.now() - 18 * DAY),
      checkOutTime: new Date(Date.now() - 18 * DAY + 197 * 60000), durationMinutes: 197, attendanceType: "normal" } as any);
    await db.createAttendance({ id: RID * 10 + 1, residentId: RID, packageId: RID * 10, checkInTime: checkIn, attendanceType: "normal" } as any);

    const closed = await closeMissedCheckout({ id: RID * 10 + 1, residentId: RID, checkInTime: checkIn }, 22);
    expect(formatParisTime(closed.checkOutTime)).toBe("22:00");
    expect(closed.durationMinutes).toBe(345); // 16:15 → 22:00

    // Compteur du forfait à jour immédiatement : 197 + 345 minutes.
    expect((await db.getPackageById(RID * 10))!.usedHours).toBe(197 + 345);
    const r = (await db.getResidentById(RID))!;
    expect(r.hasMissedCheckout).toBe(true);
    expect(r.missedCheckoutAttendanceId).toBe(RID * 10 + 1);

    // Le recalcul de nuit ne change plus rien : pas d'alerte « heures corrigées ».
    await db.fullRecalculateResident(RID);
    expect((await db.getPackageById(RID * 10))!.usedHours).toBe(197 + 345);
  });
});
