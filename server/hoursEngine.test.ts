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

const RID2 = 990002;
async function cleanup2() {
  const database = await getDb();
  if (!database) return;
  await database.delete(attendances).where(eq(attendances.residentId, RID2));
  await database.delete(packages).where(eq(packages.residentId, RID2));
  await database.delete(residents).where(eq(residents.id, RID2));
}

describe.skipIf(!process.env.DATABASE_URL)("Abandon des heures hors-forfait (« ne pas déduire »)", () => {
  beforeAll(async () => {
    await cleanup2();
    await db.createResident({
      id: RID2, firstName: "TEST", lastName: "Abandon", email: "test-abandon@local", isActive: true,
    } as any);
    // Forfait de 600 min en janvier, dépassé de 120 min (pointage de 720 min).
    await db.createPackage({
      id: 990201, residentId: RID2, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-01-31"), isActive: true,
    } as any);
    await db.createAttendance({
      residentId: RID2, packageId: 990201,
      checkInTime: d("2026-01-15T09:00:00"), checkOutTime: d("2026-01-15T21:00:00"), durationMinutes: 720,
    } as any);
    await db.fullRecalculateResident(RID2);
  });

  afterAll(cleanup2);

  it("part de 120 min hors-forfait en attente", async () => {
    const r = await db.getResidentById(RID2);
    expect(r!.outOfPackageMinutes).toBe(120);
  });

  it("l'abandon remet à 0", async () => {
    await db.clearOutOfPackageHours(RID2);
    const r = await db.getResidentById(RID2);
    expect(r!.outOfPackageMinutes).toBe(0);
  });

  it("les heures abandonnées ne réapparaissent pas aux recalculs suivants", async () => {
    await db.fullRecalculateResident(RID2);
    await db.fullRecalculateResident(RID2);
    const r = await db.getResidentById(RID2);
    expect(r!.outOfPackageMinutes).toBe(0);
  });
});

// Fonction pure (pas de base de données requise) : le badge « Hors forfait »
// par pointage doit refléter le solde encore dû, pas le total brut
// historique — une fois des heures reportées, les anciens pointages qui les
// représentaient ne doivent plus être marqués.
describe("computeOutOfPackageAttendanceIds (badge par pointage)", () => {
  const RID3 = 990003;

  it("ne marque plus les pointages déjà couverts par un report", () => {
    // Forfait A (600 min) : un pointage de 700 min déborde de 100 min.
    const attA = {
      id: 1, residentId: RID3, packageId: 101,
      checkInTime: d("2026-01-15"), durationMinutes: 700, attendanceType: "normal",
      packageTotalHours: 600, packageDeductedMinutes: 0,
    };
    // Forfait B (600 min, 100 min reportées) : deux pointages, le second déborde de 100 min.
    const attB1 = {
      id: 2, residentId: RID3, packageId: 102,
      checkInTime: d("2026-02-10"), durationMinutes: 400, attendanceType: "normal",
      packageTotalHours: 600, packageDeductedMinutes: 100,
    };
    const attB2 = {
      id: 3, residentId: RID3, packageId: 102,
      checkInTime: d("2026-02-20"), durationMinutes: 200, attendanceType: "normal",
      packageTotalHours: 600, packageDeductedMinutes: 100,
    };
    // Solde net encore dû (comme le calculerait fullRecalculateResident) :
    // débordements bruts (100 + 100) − reporté (100) = 100 min.
    const pending = 100;

    const flagged = db.computeOutOfPackageAttendanceIds(
      [attA, attB1, attB2],
      new Map([[RID3, pending]])
    );

    // Le pointage le plus récent (attB2, qui a causé le débordement du
    // nouveau forfait) reste marqué ; l'ancien (attA), déjà "payé" par le
    // report, ne l'est plus. attB1 n'a jamais débordé.
    expect(flagged.has(3)).toBe(true);
    expect(flagged.has(1)).toBe(false);
    expect(flagged.has(2)).toBe(false);
  });

  it("les pointages orphelins (sans forfait valable) sont toujours marqués", () => {
    const orphan = {
      id: 4, residentId: RID3, packageId: null,
      checkInTime: d("2026-03-01"), durationMinutes: 60, attendanceType: "normal",
      packageTotalHours: null, packageDeductedMinutes: null,
    };
    const flagged = db.computeOutOfPackageAttendanceIds([orphan], new Map([[RID3, 60]]));
    expect(flagged.has(4)).toBe(true);
  });
});

// Un résident qui n'a JAMAIS eu de forfait doit quand même pouvoir enregistrer
// une session manuelle (« J'ai oublié de pointer ! »), comptée hors-forfait.
describe.skipIf(!process.env.DATABASE_URL)("Résident sans aucun forfait (règle par date)", () => {
  const RID4 = 990004;
  async function cleanup4() {
    const database = await getDb();
    if (!database) return;
    await database.delete(attendances).where(eq(attendances.residentId, RID4));
    await database.delete(residents).where(eq(residents.id, RID4));
  }

  beforeAll(async () => {
    await cleanup4();
    await db.createResident({
      id: RID4, firstName: "TEST", lastName: "ZeroForfait", email: "test-zero@local", isActive: true,
    } as any);
  });

  afterAll(cleanup4);

  it("une session enregistrée sans aucun forfait est comptée hors-forfait", async () => {
    await db.createAttendance({
      residentId: RID4, packageId: null,
      checkInTime: d("2026-01-10T09:00:00"), checkOutTime: d("2026-01-10T10:30:00"), durationMinutes: 90,
    } as any);
    await db.fullRecalculateResident(RID4);

    const r = await db.getResidentById(RID4);
    expect(r!.outOfPackageMinutes).toBe(90);
  });

  it("une deuxième session s'accumule correctement", async () => {
    await db.createAttendance({
      residentId: RID4, packageId: null,
      checkInTime: d("2026-01-11T14:00:00"), checkOutTime: d("2026-01-11T14:30:00"), durationMinutes: 30,
    } as any);
    await db.fullRecalculateResident(RID4);

    const r = await db.getResidentById(RID4);
    expect(r!.outOfPackageMinutes).toBe(120);
  });
});

// packages.subtractHours/addHours ne touchent plus totalHours (qui reste
// fixe, celui du type de forfait) : un retrait augmente usedHours, un ajout
// le diminue (jusque sous 0 si besoin, pour qu'un geste commercial ait un
// effet même sur un forfait pas encore utilisé). fullRecalculateResident
// doit appliquer cet ajustement de façon stable (pas de double-compte aux
// recalculs suivants).
describe.skipIf(!process.env.DATABASE_URL)("Retrait/ajout d'heures : ajuste usedHours, pas totalHours", () => {
  const RID5 = 990005;
  async function cleanup5() {
    const database = await getDb();
    if (!database) return;
    await database.delete(attendances).where(eq(attendances.residentId, RID5));
    await database.delete(packages).where(eq(packages.residentId, RID5));
    await database.delete(residents).where(eq(residents.id, RID5));
  }

  beforeAll(async () => {
    await cleanup5();
    await db.createResident({
      id: RID5, firstName: "TEST", lastName: "Subtract", email: "test-subtract@local", isActive: true,
    } as any);
    // Forfait dynamique de 600 min, un pointage réel de 550 min (dans la capacité).
    await db.createPackage({
      id: 990501, residentId: RID5, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-01-31"), isActive: true,
    } as any);
    await db.createAttendance({
      residentId: RID5, packageId: 990501,
      checkInTime: d("2026-01-15T09:00:00"), checkOutTime: d("2026-01-15T17:10:00"), durationMinutes: 550,
    } as any);
    await db.fullRecalculateResident(RID5);
  });

  afterAll(cleanup5);

  it("retrait de 100 min (comme packages.subtractHours) : totalHours ne bouge pas", async () => {
    await db.createAttendance({
      residentId: RID5, packageId: 990501,
      checkInTime: d("2026-01-16T09:00:00"), checkOutTime: d("2026-01-16T09:00:00"), durationMinutes: 100,
      attendanceType: "adjustment_subtract", note: "Retrait de test",
    } as any);
    await db.fullRecalculateResident(RID5);

    const after = await db.getPackageById(990501);
    expect(after!.totalHours).toBe(600);
  });

  it("le pointage de 550 min + le retrait de 100 débordent de 50 min (600 utilisées, 50 hors-forfait)", async () => {
    const after = await db.getPackageById(990501);
    const r = await db.getResidentById(RID5);
    expect(after!.usedHours).toBe(600);
    expect(r!.outOfPackageMinutes).toBe(50);
  });

  it("des recalculs répétés ne creusent pas l'écart davantage", async () => {
    await db.fullRecalculateResident(RID5);
    await db.fullRecalculateResident(RID5);
    const after = await db.getPackageById(990501);
    const r = await db.getResidentById(RID5);
    expect(after!.totalHours).toBe(600);
    expect(after!.usedHours).toBe(600);
    expect(r!.outOfPackageMinutes).toBe(50);
  });

  it("un ajout de 700 min (bonus) fait passer usedHours sous 0 : totalHours ne bouge pas, plus de hors-forfait", async () => {
    // État courant : usedHours=600 (deductedMinutes 0 + retrait 100 + réel 550, plafonné à 600).
    // Un ajout de 700 min doit ramener la base utilisée à 100-700=-600 avant
    // réattribution des 550 réelles : usedHours final = -600+550 = -50.
    await db.createAttendance({
      residentId: RID5, packageId: 990501,
      checkInTime: d("2026-01-17T09:00:00"), checkOutTime: d("2026-01-17T09:00:00"), durationMinutes: 700,
      attendanceType: "adjustment_add", note: "Ajout de test (geste commercial)",
    } as any);
    await db.fullRecalculateResident(RID5);

    const after = await db.getPackageById(990501);
    const r = await db.getResidentById(RID5);
    expect(after!.totalHours).toBe(600);
    expect(after!.usedHours).toBe(-50);
    expect(r!.outOfPackageMinutes).toBe(0);
  });

  it("effacer tous les pointages (attendances.deleteAllByResident) remet usedHours à 0, totalHours inchangé", async () => {
    await db.deleteAllAttendancesByResidentId(RID5);
    await db.updateResident(RID5, { hasMissedCheckout: false, missedCheckoutAttendanceId: null });
    await db.fullRecalculateResident(RID5);

    const after = await db.getPackageById(990501);
    const r = await db.getResidentById(RID5);
    expect(after!.totalHours).toBe(600);
    expect(after!.usedHours).toBe(0);
    expect(r!.outOfPackageMinutes).toBe(0);
  });
});

// Forfait payé d'avance : mis en file (status 'pending' + autoStart), ignoré par
// le moteur tant que le forfait en cours est valable, puis démarré tout seul à la
// fin du forfait en cours (date de fin ou heures épuisées), sans trou ni
// double-compte des heures hors forfait. Résidents sans e-mail : aucun envoi.
describe.skipIf(!process.env.DATABASE_URL)("Forfait payé d'avance en file (démarrage automatique)", () => {
  const LONG_DAYS = 4000; // durée longue pour que le test reste valable des années
  const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
  const RIDS = [990010, 990011, 990012, 990013, 990014];

  async function cleanupQ() {
    const database = await getDb();
    if (!database) return;
    for (const id of RIDS) {
      await database.delete(attendances).where(eq(attendances.residentId, id));
      await database.delete(packages).where(eq(packages.residentId, id));
      await database.delete(residents).where(eq(residents.id, id));
    }
  }

  async function newResident(id: number) {
    await db.createResident({ id, firstName: "TEST", lastName: `Queue${id}`, email: "", isActive: true } as any);
  }

  beforeAll(cleanupQ);
  afterAll(cleanupQ);

  it("un forfait en file ne prend aucun pointage tant que le forfait en cours est valable", async () => {
    const rid = RIDS[0];
    await newResident(rid);
    await db.createPackage({
      id: 9901001, residentId: rid, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2099-01-01"), isActive: true,
    } as any);
    // Forfait en file dont la plage commence AVANT celle du forfait actif : s'il
    // participait au moteur, il absorberait le pointage.
    await db.createPackage({
      id: 9901002, residentId: rid, packageType: "custom_999", totalHours: 900, usedHours: 0,
      startDate: d("2025-12-01"), endDate: d("2099-06-01"), isActive: false, status: "pending", autoStart: true,
    } as any);
    await db.createAttendance({
      residentId: rid, packageId: null,
      checkInTime: d("2026-02-10T09:00:00Z"), checkOutTime: d("2026-02-10T10:00:00Z"), durationMinutes: 60,
    } as any);
    await db.fullRecalculateResident(rid);

    const a = await db.getPackageById(9901001);
    const b = await db.getPackageById(9901002);
    expect(a!.usedHours).toBe(60);
    expect(a!.isActive).toBe(true);
    expect(b!.status).toBe("pending");
    expect(b!.isActive).toBe(false);
    expect(b!.usedHours).toBe(0);
    expect((await db.getActivePackageByResidentId(rid))!.id).toBe(9901001);
  });

  it("à la date de fin du forfait en cours, le forfait en file démarre à cette date et absorbe les pointages du trou", async () => {
    const rid = RIDS[1];
    await newResident(rid);
    await db.createPackage({
      id: 9901101, residentId: rid, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-02-01"), isActive: true,
    } as any);
    await db.createPackage({
      id: 9901102, residentId: rid, packageType: "custom_999", totalHours: 900, usedHours: 0,
      startDate: d("2026-02-01"), endDate: addDays(d("2026-02-01"), LONG_DAYS), isActive: false, status: "pending", autoStart: true,
    } as any);
    await db.createAttendance({
      residentId: rid, packageId: null,
      checkInTime: d("2026-01-10T09:00:00Z"), checkOutTime: d("2026-01-10T10:40:00Z"), durationMinutes: 100,
    } as any);
    // Pointage après la fin du forfait A (hors forfait sans le forfait suivant).
    await db.createAttendance({
      residentId: rid, packageId: null,
      checkInTime: d("2026-02-01T10:00:00Z"), checkOutTime: d("2026-02-01T11:00:00Z"), durationMinutes: 60,
    } as any);
    await db.fullRecalculateResident(rid);

    const a = await db.getPackageById(9901101);
    const b = await db.getPackageById(9901102);
    const r = await db.getResidentById(rid);
    expect(a!.isActive).toBe(false);
    expect(b!.status).toBe("active");
    expect(b!.isActive).toBe(true);
    expect(new Date(b!.startDate).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(b!.usedHours).toBe(60); // le pointage du 1er février est absorbé
    expect(b!.deductedMinutes).toBe(0); // rien à reporter : pas de double-compte
    expect(r!.outOfPackageMinutes).toBe(0);
  });

  it("quand les heures sont épuisées avant la date de fin, le forfait en file démarre et reprend le débordement", async () => {
    const rid = RIDS[2];
    await newResident(rid);
    await db.createPackage({
      id: 9901201, residentId: rid, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2099-01-01"), isActive: true,
    } as any);
    await db.createPackage({
      id: 9901202, residentId: rid, packageType: "custom_999", totalHours: 900, usedHours: 0,
      startDate: d("2099-01-01"), endDate: addDays(d("2099-01-01"), LONG_DAYS), isActive: false, status: "pending", autoStart: true,
    } as any);
    // 700 min sur un forfait de 600 : le forfait est épuisé, 100 min débordent.
    await db.createAttendance({
      residentId: rid, packageId: null,
      checkInTime: d("2026-03-01T09:00:00Z"), checkOutTime: d("2026-03-01T20:40:00Z"), durationMinutes: 700,
    } as any);
    // Pointage suivant : couvert par le nouveau forfait.
    await db.createAttendance({
      residentId: rid, packageId: null,
      checkInTime: d("2026-03-05T09:00:00Z"), checkOutTime: d("2026-03-05T10:00:00Z"), durationMinutes: 60,
    } as any);
    await db.fullRecalculateResident(rid);

    const a = await db.getPackageById(9901201);
    const b = await db.getPackageById(9901202);
    const r = await db.getResidentById(rid);
    expect(a!.usedHours).toBe(600);
    expect(a!.isActive).toBe(false);
    expect(b!.status).toBe("active");
    expect(new Date(b!.startDate).toISOString()).toBe("2026-03-01T20:40:00.000Z"); // fin du dernier pointage
    expect(b!.deductedMinutes).toBe(100); // débordement reporté
    expect(b!.usedHours).toBe(160); // 100 reportées + 60 du 5 mars
    expect(r!.outOfPackageMinutes).toBe(0);
  });

  it("un forfait en attente de validation manuelle (sans autoStart) ne démarre jamais tout seul", async () => {
    const rid = RIDS[3];
    await newResident(rid);
    await db.createPackage({
      id: 9901301, residentId: rid, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-02-01"), isActive: true,
    } as any);
    await db.createPackage({
      id: 9901302, residentId: rid, packageType: "custom_999", totalHours: 900, usedHours: 0,
      startDate: d("2026-02-01"), endDate: addDays(d("2026-02-01"), LONG_DAYS), isActive: false, status: "pending", autoStart: false,
    } as any);
    await db.fullRecalculateResident(rid);
    const b = await db.getPackageById(9901302);
    expect(b!.status).toBe("pending");
    expect(b!.isActive).toBe(false);
    expect(await db.getActivePackageByResidentId(rid)).toBeNull();
  });

  it("un seul forfait en file démarre à la fois, et les recalculs suivants sont stables", async () => {
    const rid = RIDS[4];
    await newResident(rid);
    await db.createPackage({
      id: 9901401, residentId: rid, packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-02-01"), isActive: true,
    } as any);
    for (const id of [9901402, 9901403]) {
      await db.createPackage({
        id, residentId: rid, packageType: "custom_999", totalHours: 900, usedHours: 0,
        startDate: d("2026-02-01"), endDate: addDays(d("2026-02-01"), LONG_DAYS), isActive: false, status: "pending", autoStart: true,
      } as any);
    }
    await db.fullRecalculateResident(rid);
    await db.fullRecalculateResident(rid);
    await db.fullRecalculateResident(rid);

    const first = await db.getPackageById(9901402);
    const second = await db.getPackageById(9901403);
    expect(first!.status).toBe("active");
    expect(second!.status).toBe("pending");
    expect(second!.isActive).toBe(false);
    expect((await db.getActivePackageByResidentId(rid))!.id).toBe(9901402);
  });
});
