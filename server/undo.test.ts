/**
 * Bouton « Annuler » de la page de gestion des forfaits : chaque action passe
 * par les vraies routes (appRouter.createCaller), puis est annulée. Résidents de
 * test sans e-mail ; l'envoi d'e-mails est neutralisé.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { appRouter } from "./routers";

vi.stubGlobal("fetch", async () => new Response("{}", { status: 201 }));

const RID = 990050;
const RID2 = 990051;
const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 1, role: "admin" } as any });
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  for (const id of [RID, RID2]) {
    await database.delete(attendances).where(eq(attendances.residentId, id));
    await database.delete(packages).where(eq(packages.residentId, id));
    await database.delete(residents).where(eq(residents.id, id)); // l'historique suit (cascade)
  }
}

async function state(rid = RID) {
  const pkgs = (await db.getPackagesByResidentId(rid)).map((p) => ({
    id: p.id, totalHours: p.totalHours, usedHours: p.usedHours, isActive: p.isActive,
    startDate: new Date(p.startDate).toISOString(), endDate: new Date(p.endDate).toISOString(), status: p.status,
  })).sort((a, b) => a.id - b.id);
  const atts = (await db.getAttendancesByResidentId(rid)).map((a) => ({
    id: a.id, checkInTime: new Date(a.checkInTime).toISOString(),
    checkOutTime: a.checkOutTime ? new Date(a.checkOutTime).toISOString() : null,
    durationMinutes: a.durationMinutes, attendanceType: a.attendanceType,
  })).sort((a, b) => a.id - b.id);
  const r = await db.getResidentById(rid);
  return { pkgs, atts, out: r?.outOfPackageMinutes, settled: r?.settledOutOfPackageMinutes };
}

describe.skipIf(!process.env.DATABASE_URL)("Annuler (page de gestion des forfaits)", () => {
  let PKG = 0;
  let initial: Awaited<ReturnType<typeof state>>;

  beforeAll(async () => {
    await cleanup();
    await db.createResident({ id: RID, firstName: "TEST", lastName: "Undo", email: "", isActive: true } as any);
    await db.createPackage({ id: 9905001, residentId: RID, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: daysAgo(10), endDate: new Date(now.getTime() + 300 * 86400000), isActive: true } as any);
    PKG = 9905001;
    await db.createAttendance({ residentId: RID, packageId: null,
      checkInTime: daysAgo(3), checkOutTime: new Date(daysAgo(3).getTime() + 2 * 3600000), durationMinutes: 120 } as any);
    await db.fullRecalculateResident(RID);
    initial = await state();
  });
  afterAll(cleanup);

  it("aucune action → rien à annuler", async () => {
    expect(await caller.undo.getLast({ residentId: RID })).toBeNull();
  });

  it("retrait d'heures puis Annuler → état identique, libellé correct", async () => {
    await caller.packages.subtractHours({ packageId: PKG, hours: 1, minutes: 0 });
    expect((await state()).pkgs[0].usedHours).toBe(180);
    expect((await caller.undo.getLast({ residentId: RID }))?.label).toBe("retrait de 1h00");
    const res = await caller.undo.undoLast({ residentId: RID });
    expect(res.label).toBe("retrait de 1h00");
    expect(await state()).toEqual(initial);
    expect(await caller.undo.getLast({ residentId: RID })).toBeNull();
  });

  it("plusieurs actions s'annulent l'une après l'autre, dans l'ordre inverse", async () => {
    await caller.packages.addHours({ packageId: PKG, hours: 2, minutes: 30 });
    const afterAdd = await state();
    await caller.packages.extendDate({ packageId: PKG, days: 5 });
    await caller.packages.updateStartDate({ packageId: PKG, startDate: daysAgo(20) });

    expect((await caller.undo.getLast({ residentId: RID }))?.remaining).toBe(3);
    expect((await caller.undo.undoLast({ residentId: RID })).label).toBe("changement de la date de début");
    expect((await caller.undo.undoLast({ residentId: RID })).label).toBe("prolongation de 5 jours");
    expect(await state()).toEqual(afterAdd);
    expect((await caller.undo.undoLast({ residentId: RID })).label).toBe("ajout de 2h30");
    expect(await state()).toEqual(initial);
  });

  it("pointage ajouté, modifié, supprimé : chaque action s'annule", async () => {
    const t = daysAgo(1);
    await caller.attendances.create({ residentId: RID, checkInTime: t.toISOString(), checkOutTime: new Date(t.getTime() + 3600000).toISOString() });
    const afterCreate = await state();
    const created = afterCreate.atts.find((a) => !initial.atts.some((i) => i.id === a.id))!;
    await caller.attendances.update({ id: created.id, checkInTime: t.toISOString(), checkOutTime: new Date(t.getTime() + 3 * 3600000).toISOString() });
    await caller.attendances.delete({ id: created.id });
    expect((await state()).atts.some((a) => a.id === created.id)).toBe(false);

    expect((await caller.undo.undoLast({ residentId: RID })).label).toBe("suppression d'un pointage");
    expect((await state()).atts.find((a) => a.id === created.id)?.durationMinutes).toBe(180);
    expect((await caller.undo.undoLast({ residentId: RID })).label).toBe("modification d'un pointage");
    expect(await state()).toEqual(afterCreate);
    expect((await caller.undo.undoLast({ residentId: RID })).label).toBe("ajout d'un pointage");
    expect(await state()).toEqual(initial);
  });

  it("« Effacer tous les pointages » puis Annuler → pointages et heures restaurés", async () => {
    await caller.attendances.deleteAllByResident({ residentId: RID });
    expect((await state()).atts).toHaveLength(0);
    await caller.undo.undoLast({ residentId: RID });
    expect(await state()).toEqual(initial);
  });

  it("suppression d'un forfait puis Annuler → forfait recréé à l'identique", async () => {
    await caller.packages.delete({ id: PKG });
    expect((await state()).pkgs).toHaveLength(0);
    await caller.undo.undoLast({ residentId: RID });
    expect(await state()).toEqual(initial);
  });

  it("refus si la ligne concernée a été modifiée depuis, sans rien toucher", async () => {
    await caller.packages.subtractHours({ packageId: PKG, hours: 0, minutes: 30 });
    const adjustment = (await state()).atts.find((a) => a.attendanceType === "adjustment_subtract")!;
    // La ligne créée par l'action est modifiée en dehors du suivi « Annuler ».
    await db.updateAttendance(adjustment.id, { durationMinutes: 45 } as any);
    await db.fullRecalculateResident(RID);
    const modified = await state();
    await expect(caller.undo.undoLast({ residentId: RID })).rejects.toThrow(/Impossible d'annuler/);
    expect(await state()).toEqual(modified); // rien n'a été écrasé

    await db.updateAttendance(adjustment.id, { durationMinutes: 30 } as any);
    await caller.undo.undoLast({ residentId: RID });
    expect(await state()).toEqual(initial);
  });

  it("un pointage fait à la borne après l'action n'est pas effacé par l'annulation", async () => {
    await caller.packages.subtractHours({ packageId: PKG, hours: 0, minutes: 15 });
    const kioskId = await db.createAttendance({ residentId: RID, packageId: null,
      checkInTime: daysAgo(0.5), checkOutTime: new Date(daysAgo(0.5).getTime() + 3600000), durationMinutes: 60 } as any);
    await caller.undo.undoLast({ residentId: RID });
    const s = await state();
    expect(s.atts).toHaveLength(initial.atts.length + 1); // le pointage « borne » est toujours là
    expect(s.pkgs[0].usedHours).toBe(initial.pkgs[0].usedHours + 60);
    await db.deleteAttendance((kioskId as any)[0].insertId);
    await db.fullRecalculateResident(RID);
  });

  it("création d'un forfait : les heures hors forfait sont reportées d'office, et l'annulation remet tout", async () => {
    await db.createResident({ id: RID2, firstName: "TEST", lastName: "Undo2", email: "", isActive: true } as any);
    await db.createAttendance({ residentId: RID2, packageId: null,
      checkInTime: daysAgo(2), checkOutTime: new Date(daysAgo(2).getTime() + 3600000), durationMinutes: 60 } as any);
    await db.fullRecalculateResident(RID2);
    const before2 = await state(RID2);
    expect(before2.out).toBe(60);

    // Forfait qui commence aujourd'hui : le pointage d'avant-hier reste hors forfait et est reporté.
    const types = await db.getActivePackageTypes();
    const created = await caller.packages.create({ residentId: RID2, packageTypeId: types[0].id, startDate: new Date() });
    const pkg = await db.getPackageById(created.packageId!);
    expect(pkg!.deductedMinutes).toBe(60);
    expect(pkg!.usedHours).toBe(60);
    expect((await state(RID2)).out).toBe(0);
    expect((await caller.undo.getLast({ residentId: RID2 }))?.remaining).toBe(1);

    await caller.undo.undoLast({ residentId: RID2 });
    expect(await state(RID2)).toEqual(before2);
  });

  it("forfait daté en arrière : le pointage couvert par ses dates est absorbé, pas compté deux fois", async () => {
    const types = await db.getActivePackageTypes();
    const created = await caller.packages.create({ residentId: RID2, packageTypeId: types[0].id, startDate: daysAgo(5) });
    const pkg = await db.getPackageById(created.packageId!);
    expect(pkg!.deductedMinutes).toBe(0);
    expect(pkg!.usedHours).toBe(60);
    expect((await state(RID2)).out).toBe(0);
    await caller.undo.undoLast({ residentId: RID2 });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("Création manuelle pendant un forfait en cours → file d'attente", () => {
  const RQ = 990052;
  async function cleanupQ() {
    const database = await getDb();
    if (!database) return;
    await database.delete(attendances).where(eq(attendances.residentId, RQ));
    await database.delete(packages).where(eq(packages.residentId, RQ));
    await database.delete(residents).where(eq(residents.id, RQ));
  }
  beforeAll(cleanupQ);
  afterAll(cleanupQ);

  it("le nouveau forfait part en file, démarre à la fin de l'actuel, et la création s'annule", async () => {
    await db.createResident({ id: RQ, firstName: "TEST", lastName: "QueueManual", email: "", isActive: true } as any);
    const currentEnd = new Date(now.getTime() + 20 * 86400000);
    await db.createPackage({ id: 9905201, residentId: RQ, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: daysAgo(10), endDate: currentEnd, isActive: true } as any);
    await db.fullRecalculateResident(RQ);

    const types = await db.getActivePackageTypes();
    const first = await caller.packages.create({ residentId: RQ, packageTypeId: types[0].id });
    expect(first.queued).toBe(true);
    const q1 = await db.getPackageById(first.packageId!);
    expect(q1!.status).toBe("pending");
    expect(q1!.autoStart).toBe(true);
    const storedCurrentEnd = (await db.getPackageById(9905201))!.endDate;
    expect(new Date(q1!.startDate).toISOString()).toBe(new Date(storedCurrentEnd).toISOString());
    expect((await db.getActivePackageByResidentId(RQ))!.id).toBe(9905201); // l'actuel reste le forfait du résident

    // Deuxième forfait en file : démarre après le premier.
    const second = await caller.packages.create({ residentId: RQ, packageTypeId: types[0].id });
    const q2 = await db.getPackageById(second.packageId!);
    expect(new Date(q2!.startDate).toISOString()).toBe(new Date(q1!.endDate).toISOString());

    // Annuler la 2e création → elle disparaît ; la 1re reste.
    expect((await caller.undo.undoLast({ residentId: RQ })).label).toBe("création d'un forfait");
    expect(await db.getPackageById(second.packageId!)).toBeNull();
    expect(await db.getPackageById(first.packageId!)).not.toBeNull();

    // Activation manuelle refusée tant que le forfait actuel est valable.
    await expect(caller.packages.activatePending({ packageId: first.packageId! })).rejects.toThrow(/encore en cours/);
    expect((await db.getPackageById(first.packageId!))!.status).toBe("pending");

    // Le forfait actuel se termine → le forfait en file démarre tout seul.
    await db.updatePackage(9905201, { endDate: daysAgo(1) } as any);
    await db.fullRecalculateResident(RQ);
    const started = await db.getPackageById(first.packageId!);
    expect(started!.status).toBe("active");
    expect(started!.isActive).toBe(true);
  });
});
