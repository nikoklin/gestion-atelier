/**
 * Accès publics (sans connexion) à l'espace résident : en essayant des
 * identifiants, on ne doit récupérer ni e-mail, ni téléphone, ni nom complet,
 * ni champs internes. Résident de test 990130, nettoyé à la fin.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { appRouter } from "./routers";

const RID = 990130;
const DAY = 86400000;
const visitor = appRouter.createCaller({ req: {} as any, res: {} as any, user: null } as any);

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  await database.delete(attendances).where(eq(attendances.residentId, RID));
  await database.delete(packages).where(eq(packages.residentId, RID));
  await database.delete(residents).where(eq(residents.id, RID));
}

describe.skipIf(!process.env.DATABASE_URL)("Espace résident : données exposées sans connexion", () => {
  beforeAll(async () => {
    await cleanup();
    const t = Date.now();
    await db.createResident({ id: RID, firstName: "Camille", lastName: "Secret", email: "camille.secret@example.invalid",
      phone: "0600000000", shelfNumber: "42", isActive: true } as any);
    await db.createPackage({ id: 9913001, residentId: RID, packageType: "custom_1", totalHours: 900, usedHours: 60,
      startDate: new Date(t - 5 * DAY), endDate: new Date(t + 50 * DAY), isActive: true, status: "active",
      wixPaymentId: "paiement-secret-990130" } as any);
    await db.createAttendance({ residentId: RID, packageId: 9913001, checkInTime: new Date(t - DAY - 3600000),
      checkOutTime: new Date(t - DAY), durationMinutes: 60, attendanceType: "normal", note: "note interne" } as any);
  });
  afterAll(cleanup);

  it("getInfo : seulement prénom, initiale du nom, forfait et horaires des pointages", async () => {
    const info = await visitor.residentAuth.getInfo({ residentId: RID });
    expect(info.resident).toEqual({ id: RID, firstName: "Camille", lastName: "S." });
    expect(Object.keys(info.activePackage!).sort()).toEqual(["endDate", "packageType", "startDate", "totalHours", "usedHours"]);
    expect(Object.keys(info.attendances[0]).sort()).toEqual(["checkInTime", "checkOutTime", "durationMinutes", "id"]);

    const json = JSON.stringify(info);
    for (const secret of ["camille.secret@example.invalid", "0600000000", "Secret", "paiement-secret-990130", "note interne", "shelfNumber"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("packages.getActiveByResidentId : refusé sans connexion", async () => {
    await expect(visitor.packages.getActiveByResidentId({ residentId: RID })).rejects.toThrow(/login|UNAUTHORIZED/i);
  });
});
