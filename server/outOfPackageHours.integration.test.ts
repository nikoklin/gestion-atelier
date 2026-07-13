import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { residents, packages } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { 
  getOutOfPackageHoursByResidentId,
  clearOutOfPackageHours,
  markOutOfPackageHoursAsDeducted
} from "./db";

describe("Out of Package Hours - Integration Tests", () => {
  let testResidentId: number;
  let testPackageId1: number;
  let testPackageId2: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Créer un résident de test
    const residentResult = await db.insert(residents).values({
      firstName: "Test",
      lastName: "OutOfPackage",
      email: "test.outofpackage@test.com",
      phone: "0000000000",
    });

    testResidentId = Number(residentResult[0].insertId);

    // Créer un premier forfait épuisé avec 60 minutes hors forfait
    const package1Result = await db.insert(packages).values({
      residentId: testResidentId,
      packageType: "15h_8w",
      totalHours: 900, // 15 heures
      usedHours: 960, // 16 heures (60 minutes hors forfait)
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      isActive: false,
      deductedMinutes: 0,
    });

    testPackageId1 = Number(package1Result[0].insertId);

    // Créer un deuxième forfait épuisé avec 30 minutes hors forfait
    const package2Result = await db.insert(packages).values({
      residentId: testResidentId,
      packageType: "180h_6m",
      totalHours: 1800, // 30 heures
      usedHours: 1830, // 30h30 (30 minutes hors forfait)
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      isActive: false,
      deductedMinutes: 0,
    });

    testPackageId2 = Number(package2Result[0].insertId);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Nettoyer les données de test
    await db.delete(packages).where(eq(packages.residentId, testResidentId));
    await db.delete(residents).where(eq(residents.id, testResidentId));
  });

  it("should calculate total out of package hours correctly", async () => {
    const totalOutOfPackageMinutes = await getOutOfPackageHoursByResidentId(testResidentId);
    
    // 60 + 30 = 90 minutes hors forfait
    expect(totalOutOfPackageMinutes).toBe(90);
  });

  it("should exclude already deducted minutes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Marquer 30 minutes comme déduites sur le premier forfait
    await db.update(packages)
      .set({ deductedMinutes: 30 })
      .where(eq(packages.id, testPackageId1));

    const totalOutOfPackageMinutes = await getOutOfPackageHoursByResidentId(testResidentId);
    
    // (60 - 30) + 30 = 60 minutes restantes
    expect(totalOutOfPackageMinutes).toBe(60);

    // Remettre à zéro pour les tests suivants
    await db.update(packages)
      .set({ deductedMinutes: 0 })
      .where(eq(packages.id, testPackageId1));
  });

  it("should clear out of package hours", async () => {
    await clearOutOfPackageHours(testResidentId);

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Vérifier que usedHours a été plafonné à totalHours
    const updatedPackages = await db
      .select()
      .from(packages)
      .where(eq(packages.residentId, testResidentId));

    for (const pkg of updatedPackages) {
      expect(pkg.usedHours).toBeLessThanOrEqual(pkg.totalHours);
    }

    const totalOutOfPackageMinutes = await getOutOfPackageHoursByResidentId(testResidentId);
    expect(totalOutOfPackageMinutes).toBe(0);

    // Restaurer les heures hors forfait pour les tests suivants
    await db.update(packages)
      .set({ usedHours: 960 })
      .where(eq(packages.id, testPackageId1));
    await db.update(packages)
      .set({ usedHours: 1830 })
      .where(eq(packages.id, testPackageId2));
  });

  it("should mark out of package hours as deducted", async () => {
    await markOutOfPackageHoursAsDeducted(testResidentId, 90);

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Vérifier que deductedMinutes a été mis à jour
    const updatedPackages = await db
      .select()
      .from(packages)
      .where(eq(packages.residentId, testResidentId));

    const totalDeducted = updatedPackages.reduce(
      (sum, pkg) => sum + (pkg.deductedMinutes || 0),
      0
    );

    expect(totalDeducted).toBe(90);

    // Vérifier que getOutOfPackageHours retourne maintenant 0
    const totalOutOfPackageMinutes = await getOutOfPackageHoursByResidentId(testResidentId);
    expect(totalOutOfPackageMinutes).toBe(0);
  });
});
