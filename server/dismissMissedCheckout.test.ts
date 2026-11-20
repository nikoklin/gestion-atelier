/**
 * « Retirer l'alerte » : le « ! » rouge de pointage oublié se retire à la main,
 * même quand le pointage concerné appartient à un forfait terminé (plus modifiable).
 * Résident de test 990140, inactif et sans e-mail (absent de la tablette, aucun envoi).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { appRouter } from "./routers";

const RID = 990140;
const DAY = 86400000;
const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 1, role: "admin" } as any });

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  await database.delete(attendances).where(eq(attendances.residentId, RID));
  await database.delete(packages).where(eq(packages.residentId, RID));
  await database.delete(residents).where(eq(residents.id, RID));
}

describe.skipIf(!process.env.DATABASE_URL)("Retirer l'alerte de pointage oublié", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("retire le « ! » alors que le pointage signalé est verrouillé par un nouveau forfait", async () => {
    const t = Date.now();
    await db.createResident({ id: RID, firstName: "TEST", lastName: "Alerte", email: "", isActive: false } as any);
    await db.createPackage({ id: 9914001, residentId: RID, packageType: "custom_1", totalHours: 60, usedHours: 60,
      startDate: new Date(t - 20 * DAY), endDate: new Date(t - 5 * DAY), isActive: false, status: "active" } as any);
    await db.createAttendance({ id: 9914001, residentId: RID, packageId: 9914001, checkInTime: new Date(t - 10 * DAY),
      checkOutTime: new Date(t - 10 * DAY + 60 * 60000), durationMinutes: 60, attendanceType: "normal" } as any);
    await db.createPackage({ id: 9914002, residentId: RID, packageType: "custom_1", totalHours: 600, usedHours: 0,
      startDate: new Date(t - 2 * DAY), endDate: new Date(t + 20 * DAY), isActive: true, status: "active" } as any);
    await db.updateResident(RID, { hasMissedCheckout: true, missedCheckoutAttendanceId: 9914001 });

    // Le pointage ne peut plus être corrigé…
    await expect(caller.attendances.update({ id: 9914001, checkInTime: new Date(t - 10 * DAY).toISOString(),
      checkOutTime: new Date(t - 10 * DAY + 30 * 60000).toISOString() } as any)).rejects.toThrow(/forfait terminé/);
    // … mais l'alerte se retire.
    await caller.residents.dismissMissedCheckout({ residentId: RID });
    const r = await db.getResidentById(RID);
    expect([r?.hasMissedCheckout, r?.missedCheckoutAttendanceId]).toEqual([false, null]);
    expect((await db.getAttendanceById(9914001))?.durationMinutes).toBe(60); // pointage inchangé
  });
});
