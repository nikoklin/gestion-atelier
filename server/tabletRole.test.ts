/**
 * Compte de la tablette (rôle « user ») : pointage et « Mon espace » seulement ;
 * toutes les routes de gestion lui sont refusées. Résident de test 990175, inactif
 * et sans e-mail (absent de la tablette, aucun envoi).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents } from "../drizzle/schema";
import { appRouter } from "./routers";

const RID = 990175;
const ctx = (user: any) => ({ req: {} as any, res: {} as any, user } as any);
const tablet = appRouter.createCaller(ctx({ id: -2, role: "user", openId: "tablet-test", name: "Tablette" }));
const admin = appRouter.createCaller(ctx({ id: -1, role: "admin", openId: "admin-test", name: "Admin" }));

async function cleanup() {
  const database = await getDb();
  if (database) await database.delete(residents).where(eq(residents.id, RID));
}

describe.skipIf(!process.env.DATABASE_URL)("Compte de la tablette", () => {
  beforeAll(async () => {
    await cleanup();
    await db.createResident({ id: RID, firstName: "TEST", lastName: "Tablette", email: "", isActive: false } as any);
  });
  afterAll(cleanup);

  it("lit l'état du pointage et peut pointer (ici refusé car le résident de test est inactif)", async () => {
    const state = await tablet.attendances.kioskState();
    expect(Array.isArray(state.residents)).toBe(true);
    await expect(tablet.attendances.recordKioskEvent({
      eventId: `test-${Date.now()}`, residentId: RID, action: "checkin", occurredAt: new Date().toISOString(),
    } as any)).rejects.toThrow(/inactif/);
  });

  it("ouvre « Mon espace » d'un résident", async () => {
    const info = await tablet.residentAuth.getInfo({ residentId: RID });
    expect(info.resident?.id ?? (info as any).id).toBeDefined();
  });

  it("refuse toutes les routes de gestion", async () => {
    for (const call of [
      () => tablet.residents.getWithActivePackage(),
      () => tablet.packages.getByResidentId({ residentId: RID }),
      () => tablet.packages.delete({ id: 999999999 }),
      () => tablet.atelierSettings.getTabletAccount(),
      () => tablet.residents.delete({ id: RID }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(await db.getResidentById(RID)).toBeTruthy(); // rien n'a été supprimé
  });

  it("un administrateur garde l'accès", async () => {
    await expect(admin.residents.getWithActivePackage()).resolves.toBeDefined();
    await expect(admin.attendances.kioskState()).resolves.toBeDefined();
  });

  it("auth.me ne renvoie jamais le hash du mot de passe", async () => {
    const me = await appRouter.createCaller(ctx({ id: -1, role: "admin", openId: "x", passwordHash: "secret" })).auth.me();
    expect(me && "passwordHash" in me).toBe(false);
  });
});
