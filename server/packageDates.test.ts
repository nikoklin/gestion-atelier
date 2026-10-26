/**
 * Forfait créé à la main : valable du début du jour choisi (00:00 à Paris)
 * jusqu'à la fin du jour affiché comme date de fin (23:59 à Paris), même quand
 * un changement d'heure tombe pendant le forfait. Résident de test 990110.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages } from "../drizzle/schema";
import { appRouter } from "./routers";
import { addDaysToDateString, endOfParisDay, formatParisDateTime, startOfParisDay } from "./_core/timezone";

const RID = 990110;
const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 1, role: "admin" } as any });

describe("Jours civils de Paris", () => {
  it("début et fin de journée, y compris le jour du passage à l'heure d'hiver", () => {
    expect(formatParisDateTime(startOfParisDay(new Date("2026-10-25T10:00:00Z")))).toBe("25/10/2026 00:00:00");
    expect(formatParisDateTime(endOfParisDay(new Date("2026-10-25T10:00:00Z")))).toBe("25/10/2026 23:59:59");
    expect(addDaysToDateString("2026-10-23", 56)).toBe("2026-12-18");
  });
});

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  await database.delete(packages).where(eq(packages.residentId, RID));
  await database.delete(residents).where(eq(residents.id, RID));
}

describe.skipIf(!process.env.DATABASE_URL)("Création d'un forfait à la main", () => {
  beforeAll(async () => {
    await cleanup();
    await db.createResident({ id: RID, firstName: "TEST", lastName: "Dates", email: "", isActive: true } as any);
  });
  afterAll(cleanup);

  it("forfait de 8 semaines au 23/10 (heure d'été) : du 23/10 00:00 au 18/12 23:59 (heure d'hiver)", async () => {
    const type = (await db.getAllPackageTypes()).find((t) => t.durationWeeks === 8)!;
    // Le sélecteur de date envoie le jour à minuit UTC.
    const { packageId } = await caller.packages.create({ residentId: RID, packageTypeId: type.id, startDate: new Date("2026-10-23") });
    const pkg = (await db.getPackageById(packageId!))!;
    expect(formatParisDateTime(pkg.startDate)).toBe("23/10/2026 00:00:00");
    expect(formatParisDateTime(pkg.endDate)).toBe("18/12/2026 23:59:59");
  });
});
