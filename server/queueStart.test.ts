/**
 * Forfait payé d'avance : il démarre à la fin réelle du dernier forfait terminé.
 * Cas rencontré : un ancien forfait épuisé en heures garde une date de fin
 * lointaine ; le forfait en file ne doit pas démarrer à son épuisement (des
 * jours plus tôt) mais à la fin du forfait qui était réellement en cours.
 * Résident de test 990120, sans e-mail (aucun envoi).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";

const RID = 990120;
const DAY = 86400000;

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  await database.delete(attendances).where(eq(attendances.residentId, RID));
  await database.delete(packages).where(eq(packages.residentId, RID));
  await database.delete(residents).where(eq(residents.id, RID));
}

describe("Fin réelle d'un forfait", () => {
  const atts = [
    { packageId: 1, checkInTime: new Date("2026-10-20T15:00:00Z"), checkOutTime: new Date("2026-10-20T16:19:00Z") },
  ];
  it("épuisé en heures : s'arrête au dernier pointage ; sinon à sa date de fin", () => {
    expect(db.packageEffectiveEnd({ id: 1, totalHours: 60, usedHours: 60, endDate: "2026-11-17T16:00:00Z" }, atts))
      .toEqual(new Date("2026-10-20T16:19:00Z"));
    expect(db.packageEffectiveEnd({ id: 1, totalHours: 60, usedHours: 30, endDate: "2026-11-17T16:00:00Z" }, atts))
      .toEqual(new Date("2026-11-17T16:00:00Z"));
  });
});

describe.skipIf(!process.env.DATABASE_URL)("Démarrage d'un forfait en file", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("démarre à la fin du forfait réellement en cours, pas à l'épuisement d'un forfait plus ancien", async () => {
    const t = Date.now();
    await db.createResident({ id: RID, firstName: "TEST", lastName: "File", email: "", isActive: true } as any);
    // A : épuisé il y a 6 jours, mais date de fin dans 3 semaines.
    await db.createPackage({ id: 9912001, residentId: RID, packageType: "custom_1", totalHours: 60, usedHours: 60,
      startDate: new Date(t - 10 * DAY), endDate: new Date(t + 21 * DAY), isActive: false, status: "active" } as any);
    await db.createAttendance({ residentId: RID, packageId: 9912001, checkInTime: new Date(t - 6 * DAY - 3600000),
      checkOutTime: new Date(t - 6 * DAY), durationMinutes: 60, attendanceType: "normal" } as any);
    // B : a pris le relais, terminé (date de fin) il y a 1 heure.
    const bEnd = new Date(t - 3600000);
    await db.createPackage({ id: 9912002, residentId: RID, packageType: "custom_1", totalHours: 600, usedHours: 0,
      startDate: new Date(t - 6 * DAY), endDate: bEnd, isActive: true, status: "active" } as any);
    // C : payé d'avance, en file.
    await db.createPackage({ id: 9912003, residentId: RID, packageType: "custom_1", totalHours: 900, usedHours: 0,
      startDate: bEnd, endDate: new Date(bEnd.getTime() + 56 * DAY), isActive: false, status: "pending", autoStart: true } as any);

    await db.fullRecalculateResident(RID);

    const c = (await db.getPackageById(9912003))!;
    expect(c.status).toBe("active");
    expect(Math.abs(new Date(c.startDate).getTime() - bEnd.getTime())).toBeLessThan(2000);
  });
});
