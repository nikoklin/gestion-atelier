/**
 * Test de non-régression du moteur de calcul des heures (règle « par date »).
 *
 * Règle métier :
 *  - un seul forfait valable à la fois ;
 *  - chaque pointage est imputé au forfait valable À SA DATE ;
 *  - dépassement du forfait, ou pointage hors de toute période → hors-forfait ;
 *  - les heures hors-forfait sont reportées explicitement (deductedMinutes) sur
 *    le forfait suivant, et ne doivent PAS être recomptées ensuite.
 *
 * Nécessite une base de données (DATABASE_URL). Sans elle, la suite est ignorée.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";

const RID = 990001;
const d = (s: string) => new Date(s);

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  await database.delete(attendances).where(eq(attendances.residentId, RID));
  await database.delete(packages).where(eq(packages.residentId, RID));
  await database.delete(residents).where(eq(residents.id, RID));
}

describe.skipIf(!process.env.DATABASE_URL)("Moteur de calcul des heures (règle par date)", () => {
  beforeAll(async () => {
    await cleanup();
    await db.createResident({
      id: RID, firstName: "TEST", lastName: "Calc", email: "test-calc@local", isActive: true,
    } as any);
  });

  afterAll(cleanup);

  it("S1 — dépassement pendant la période : usedHours plafonné, excédent hors-forfait", async () => {
    // Forfait A = 600 min, valable 01–31 janvier. Pointage de 720 min le 15.
    await db.createPackage({
      id: 990101, residentId: RID, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-01-31"), isActive: true,
    } as any);
    await db.createAttendance({
      residentId: RID, packageId: 990101,
      checkInTime: d("2026-01-15T09:00:00"), checkOutTime: d("2026-01-15T21:00:00"), durationMinutes: 720,
    } as any);
    await db.fullRecalculateResident(RID);

    const a = await db.getPackageById(990101);
    const r = await db.getResidentById(RID);
    expect(a!.usedHours).toBe(600);
    expect(r!.outOfPackageMinutes).toBe(120);
  });

  it("S2 — pointage hors de toute période de forfait → hors-forfait", async () => {
    await db.createAttendance({
      residentId: RID, packageId: null,
      checkInTime: d("2026-02-05T10:00:00"), checkOutTime: d("2026-02-05T11:00:00"), durationMinutes: 60,
    } as any);
    await db.fullRecalculateResident(RID);

    const r = await db.getResidentById(RID);
    expect(r!.outOfPackageMinutes).toBe(180); // 120 + 60
  });

  it("S3 — report des heures hors-forfait dans un nouveau forfait", async () => {
    // Forfait B = 600 min, valable février, avec 180 min reportées.
    await db.createPackage({
      id: 990102, residentId: RID, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-02-01"), endDate: d("2026-02-28"), isActive: true, deductedMinutes: 180,
    } as any);
    await db.fullRecalculateResident(RID);

    const b = await db.getPackageById(990102);
    const r = await db.getResidentById(RID);
    // 180 reportées + 60 (pointage du 5 février) = 240 utilisées ; hors-forfait remis à 0.
    expect(b!.usedHours).toBe(240);
    expect(r!.outOfPackageMinutes).toBe(0);
  });

  it("S4 — recalculs répétés ne font pas réapparaître d'heures « fantômes »", async () => {
    await db.fullRecalculateResident(RID);
    await db.fullRecalculateResident(RID);
    const r = await db.getResidentById(RID);
    expect(r!.outOfPackageMinutes).toBe(0);
  });
});
