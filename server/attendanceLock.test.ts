/**
 * Pointages d'un forfait terminé : ni modifiables ni supprimables tant qu'un autre forfait
 * est en cours (ils ont servi à le calculer). Passe par les vraies routes ;
 * résident de test 990090, nettoyé à la fin (annulations comprises, en cascade).
 */
import "dotenv/config";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { appRouter } from "./routers";

const RID = 990090;
const DAY = 86400000;
const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 1, role: "admin" } as any });

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  await database.delete(attendances).where(eq(attendances.residentId, RID));
  await database.delete(packages).where(eq(packages.residentId, RID));
  await database.delete(residents).where(eq(residents.id, RID));
}

// Forfait A terminé (1h épuisée il y a 40 jours), 15 min hors forfait entre les
// deux, forfait B en cours (sauf si withCurrent = false).
async function setup(withCurrent: boolean) {
  await cleanup();
  const t = Date.now();
  await db.createResident({ id: RID, firstName: "TEST", lastName: "Verrou", email: "", isActive: true } as any);
  await db.createPackage({ id: 9909001, residentId: RID, packageType: "custom_1", totalHours: 60, usedHours: 60,
    startDate: new Date(t - 60 * DAY), endDate: new Date(t - 30 * DAY), isActive: false, status: "active" } as any);
  await db.createAttendance({ id: 9909001, residentId: RID, packageId: 9909001, checkInTime: new Date(t - 40 * DAY),
    checkOutTime: new Date(t - 40 * DAY + 60 * 60000), durationMinutes: 60, attendanceType: "normal" } as any);
  await db.createAttendance({ id: 9909002, residentId: RID, packageId: null, checkInTime: new Date(t - 20 * DAY),
    checkOutTime: new Date(t - 20 * DAY + 15 * 60000), durationMinutes: 15, attendanceType: "normal" } as any);
  if (withCurrent) {
    // Les 15 min hors forfait ont été reportées sur ce forfait, comme en vrai.
    await db.createPackage({ id: 9909002, residentId: RID, packageType: "custom_1", totalHours: 600, usedHours: 15, deductedMinutes: 15,
      startDate: new Date(t - 10 * DAY), endDate: new Date(t + 20 * DAY), isActive: true, status: "active" } as any);
    await db.createAttendance({ id: 9909003, residentId: RID, packageId: 9909002, checkInTime: new Date(t - 2 * DAY),
      checkOutTime: new Date(t - 2 * DAY + 30 * 60000), durationMinutes: 30, attendanceType: "normal" } as any);
  }
}

const exists = async (id: number) => !!(await db.getAttendanceById(id));

describe.skipIf(!process.env.DATABASE_URL)("Modification et suppression des pointages d'un forfait terminé", () => {
  afterAll(cleanup);

  describe("avec un forfait en cours", () => {
    beforeEach(() => setup(true));

    it("pointage du forfait terminé : refusé", async () => {
      await expect(caller.attendances.delete({ id: 9909001 })).rejects.toThrow(/forfait terminé/);
      expect(await exists(9909001)).toBe(true);
    });

    it("heures hors forfait d'avant le forfait en cours : refusé", async () => {
      await expect(caller.attendances.delete({ id: 9909002 })).rejects.toThrow(/forfait terminé/);
      expect(await exists(9909002)).toBe(true);
    });

    it("modification d'un pointage du forfait terminé : refusée, horaires inchangés", async () => {
      const before = (await db.getAttendanceById(9909001))!;
      await expect(caller.attendances.update({
        id: 9909001,
        checkInTime: new Date(before.checkInTime.getTime() - 30 * 60000).toISOString(),
        checkOutTime: before.checkOutTime!.toISOString(),
      })).rejects.toThrow(/ne peut pas être modifié/);
      expect((await db.getAttendanceById(9909001))!.durationMinutes).toBe(60);
    });

    it("modification d'un pointage du forfait en cours : acceptée", async () => {
      const before = (await db.getAttendanceById(9909003))!;
      await caller.attendances.update({
        id: 9909003,
        checkInTime: new Date(before.checkInTime.getTime() - 15 * 60000).toISOString(),
        checkOutTime: before.checkOutTime!.toISOString(),
      });
      expect((await db.getAttendanceById(9909003))!.durationMinutes).toBe(45);
    });

    it("modification qui fait dépasser le forfait : enregistrée, avertissement renvoyé (pas d'erreur)", async () => {
      const before = (await db.getAttendanceById(9909003))!;
      const res = await caller.attendances.update({
        id: 9909003,
        checkInTime: before.checkInTime.toISOString(),
        checkOutTime: new Date(before.checkInTime.getTime() + 11 * 3600000).toISOString(),
      });
      expect(res.warning).toMatch(/Pointage enregistré, mais il dépasse le total du forfait \(10h\)/);
      expect((await db.getAttendanceById(9909003))!.durationMinutes).toBe(660);
    });

    it("création qui fait dépasser le forfait : créée, avertissement renvoyé (pas d'erreur)", async () => {
      const start = new Date(Date.now() - DAY);
      const res = await caller.attendances.create({
        residentId: RID,
        checkInTime: start.toISOString(),
        checkOutTime: new Date(start.getTime() + 12 * 3600000).toISOString(),
      });
      expect(res.warning).toMatch(/dépasse le total du forfait/);
      expect(await db.getAttendancesByResidentId(RID)).toHaveLength(4);
    });

    it("pointage du forfait en cours : supprimé", async () => {
      await caller.attendances.delete({ id: 9909003 });
      expect(await exists(9909003)).toBe(false);
    });

    it("« Effacer tous les pointages » : refusé, rien n'est effacé", async () => {
      await expect(caller.attendances.deleteAllByResident({ residentId: RID })).rejects.toThrow(/forfait est en cours/);
      expect(await db.getAttendancesByResidentId(RID)).toHaveLength(3);
    });
  });

  describe("heures et dates d'un forfait terminé, avec un forfait en cours", () => {
    beforeEach(() => setup(true));

    it("+ Heures, − Heures, + Jours, − Jours, Date de début : tous refusés, forfait inchangé", async () => {
      const before = (await db.getPackageById(9909001))!;
      const id = 9909001;
      for (const action of [
        () => caller.packages.addHours({ packageId: id, hours: 1, minutes: 0 }),
        () => caller.packages.subtractHours({ packageId: id, hours: 0, minutes: 30 }),
        () => caller.packages.extendDate({ packageId: id, days: 3 }),
        () => caller.packages.subtractDays({ packageId: id, days: 1 }),
        () => caller.packages.updateStartDate({ packageId: id, startDate: new Date(Date.now() - 50 * DAY) }),
      ]) {
        await expect(action()).rejects.toThrow(/ne peuvent plus être modifiées/);
      }
      const after = (await db.getPackageById(9909001))!;
      expect([after.usedHours, after.startDate, after.endDate]).toEqual([before.usedHours, before.startDate, before.endDate]);
      expect(await db.getAttendancesByResidentId(RID)).toHaveLength(3); // aucun ajout/retrait d'heures créé
    });

    it("le forfait en cours reste modifiable", async () => {
      await caller.packages.extendDate({ packageId: 9909002, days: 3 });
      await caller.packages.addHours({ packageId: 9909002, hours: 1, minutes: 0 });
    });
  });

  it("sans forfait en cours : la suppression reste possible", async () => {
    await setup(false);
    await caller.attendances.delete({ id: 9909001 });
    expect(await exists(9909001)).toBe(false);
  });
});
