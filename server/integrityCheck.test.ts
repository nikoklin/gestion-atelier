/**
 * Contrôle quotidien d'incohérences : une anomalie semée par règle sur des
 * résidents de test (assertions limitées à ces résidents : la vraie base
 * contient d'autres résidents), plus des tests purs de la détection de dérive
 * et de l'e-mail d'alerte. Aucun e-mail n'est envoyé.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { runIntegrityCheck, detectDrift, buildIntegrityEmail, type StateSnapshot } from "./integrityCheck";

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const daysAhead = (n: number) => new Date(now.getTime() + n * 86400000);
const d = (s: string) => new Date(s);
const IDS = Array.from({ length: 13 }, (_, i) => 990030 + i); // 990030 … 990042

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  for (const id of IDS) {
    await database.delete(attendances).where(eq(attendances.residentId, id));
    await database.delete(packages).where(eq(packages.residentId, id));
    await database.delete(residents).where(eq(residents.id, id));
  }
}

async function newResident(id: number, extra: Record<string, unknown> = {}) {
  await db.createResident({ id, firstName: "TEST", lastName: `Integrity${id}`, email: "", isActive: true, ...extra } as any);
}

async function rulesFor(id: number) {
  return (await runIntegrityCheck({ now, onlyResidentIds: [id] })).map((a) => a.rule);
}

describe.skipIf(!process.env.DATABASE_URL)("Contrôle d'incohérences (règles)", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("pointage jamais clôturé d'un jour précédent", async () => {
    await newResident(IDS[0]);
    await db.createAttendance({ residentId: IDS[0], packageId: null, checkInTime: daysAgo(3), checkOutTime: null } as any);
    expect(await rulesFor(IDS[0])).toContain("open_attendance");
  });

  it("durée incohérente : sortie avant l'arrivée, ou durée enregistrée fausse", async () => {
    await newResident(IDS[1]);
    await db.createAttendance({ residentId: IDS[1], packageId: null,
      checkInTime: daysAgo(5), checkOutTime: new Date(daysAgo(5).getTime() - 3600000), durationMinutes: 60 } as any);
    await db.createAttendance({ residentId: IDS[1], packageId: null,
      checkInTime: daysAgo(4), checkOutTime: new Date(daysAgo(4).getTime() + 3600000), durationMinutes: 200 } as any);
    const found = (await runIntegrityCheck({ now, onlyResidentIds: [IDS[1]] })).filter((a) => a.rule === "bad_duration");
    expect(found).toHaveLength(2);
  });

  it("session très longue (à traiter) et pointage dans le futur (erreur)", async () => {
    await newResident(IDS[2]);
    await db.createAttendance({ residentId: IDS[2], packageId: null,
      checkInTime: daysAgo(6), checkOutTime: new Date(daysAgo(6).getTime() + 15 * 3600000), durationMinutes: 900 } as any);
    await db.createAttendance({ residentId: IDS[2], packageId: null,
      checkInTime: daysAhead(2), checkOutTime: new Date(daysAhead(2).getTime() + 3600000), durationMinutes: 60 } as any);
    const rules = await rulesFor(IDS[2]);
    expect(rules).toContain("long_session");
    expect(rules).toContain("future_attendance");
  });

  it("forfait : dates incohérentes, heures utilisées > total, statut actif faux", async () => {
    await newResident(IDS[3]);
    await db.createPackage({ id: 9903301, residentId: IDS[3], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-03-01"), endDate: d("2026-02-01"), isActive: false } as any);
    expect(await rulesFor(IDS[3])).toContain("package_dates");

    await newResident(IDS[4]);
    await db.createPackage({ id: 9903401, residentId: IDS[4], packageType: "custom_999", totalHours: 600, usedHours: 700,
      startDate: daysAgo(30), endDate: daysAhead(30), isActive: false } as any);
    expect(await rulesFor(IDS[4])).toContain("used_over_total");

    await newResident(IDS[5]);
    await db.createPackage({ id: 9903501, residentId: IDS[5], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: daysAgo(60), endDate: daysAgo(10), isActive: true } as any);
    expect(await rulesFor(IDS[5])).toContain("active_flag");
  });

  it("deux forfaits qui se chevauchent de plus d'un jour", async () => {
    await newResident(IDS[6]);
    await db.createPackage({ id: 9903601, residentId: IDS[6], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-03-01"), isActive: false } as any);
    await db.createPackage({ id: 9903602, residentId: IDS[6], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-02-01"), endDate: d("2026-04-01"), isActive: false } as any);
    expect(await rulesFor(IDS[6])).toContain("package_overlap");
  });

  it("forfait payé d'avance qui n'a pas démarré alors que le précédent est terminé", async () => {
    await newResident(IDS[7]);
    await db.createPackage({ id: 9903701, residentId: IDS[7], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-02-01"), isActive: false } as any);
    await db.createPackage({ id: 9903702, residentId: IDS[7], packageType: "custom_999", totalHours: 900, usedHours: 0,
      startDate: d("2026-02-01"), endDate: daysAhead(300), isActive: false, status: "pending", autoStart: true } as any);
    expect(await rulesFor(IDS[7])).toContain("queued_not_started");
  });

  it("alerte « pointage oublié » sans pointage, et heures hors forfait au plafond", async () => {
    await newResident(IDS[8], { hasMissedCheckout: true, missedCheckoutAttendanceId: null, outOfPackageMinutes: 400 });
    const rules = await rulesFor(IDS[8]);
    expect(rules).toContain("missed_flag");
    expect(rules).toContain("out_of_package_limit");
  });

  it("étagère attribuée à deux résidents actifs", async () => {
    await newResident(IDS[9], { shelfNumber: "88" });
    await newResident(IDS[10], { shelfNumber: "88" });
    const found = (await runIntegrityCheck({ now, onlyResidentIds: [IDS[9], IDS[10]] })).filter((a) => a.rule === "duplicate_shelf");
    expect(found).toHaveLength(1);
  });

  it("e-mail en échec sur les dernières 24 h", async () => {
    await newResident(IDS[11]);
    await db.createEmailLog({ residentId: IDS[11], packageId: null, emailType: "reminder",
      recipientEmail: "x@example.com", subject: "test", success: false });
    expect(await rulesFor(IDS[11])).toContain("failed_email");
  });

  it("un résident sain ne remonte rien", async () => {
    await newResident(IDS[12], { shelfNumber: "89" });
    await db.createPackage({ id: 9904201, residentId: IDS[12], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: daysAgo(10), endDate: daysAhead(300), isActive: true } as any);
    await db.createAttendance({ residentId: IDS[12], packageId: null,
      checkInTime: daysAgo(2), checkOutTime: new Date(daysAgo(2).getTime() + 3600000), durationMinutes: 60 } as any);
    expect(await rulesFor(IDS[12])).toEqual([]);
  });
});

describe("Dérive du moteur pendant le recalcul de nuit (fonction pure)", () => {
  const pkg = (o: Partial<StateSnapshot["packages"] extends Map<number, infer V> ? V : never> = {}) => ({
    residentId: 1, totalHours: 600, usedHours: 100, isActive: true, status: "active", endDate: d("2099-01-01"), ...o,
  });
  const snap = (packages: [number, ReturnType<typeof pkg>][], residentsList: [number, { name: string; outOfPackageMinutes: number }][] = [[1, { name: "A B", outOfPackageMinutes: 0 }]]): StateSnapshot => ({
    packages: new Map(packages), residents: new Map(residentsList),
  });

  it("heures utilisées corrigées par le recalcul → signalé", () => {
    const out = detectDrift(snap([[10, pkg()]]), snap([[10, pkg({ usedHours: 160 })]]), now);
    expect(out.map((a) => a.rule)).toEqual(["drift_used_hours"]);
  });

  it("expiration par date (actif → inactif, date passée) → normal, rien à signaler", () => {
    const before = snap([[10, pkg({ endDate: daysAgo(1) })]]);
    const after = snap([[10, pkg({ endDate: daysAgo(1), isActive: false })]]);
    expect(detectDrift(before, after, now)).toEqual([]);
  });

  it("statut actif changé sans raison (forfait valable devenu inactif) → signalé", () => {
    const out = detectDrift(snap([[10, pkg()]]), snap([[10, pkg({ isActive: false })]]), now);
    expect(out.map((a) => a.rule)).toEqual(["drift_active_flag"]);
  });

  it("démarrage d'un forfait payé d'avance → changements normaux, ignorés", () => {
    const before = snap([[10, pkg({ isActive: false })], [11, pkg({ status: "pending", isActive: false, usedHours: 0 })]],
      [[1, { name: "A B", outOfPackageMinutes: 30 }]]);
    const after = snap([[10, pkg({ isActive: false, usedHours: 600 })], [11, pkg({ status: "active", usedHours: 30 })]],
      [[1, { name: "A B", outOfPackageMinutes: 0 }]]);
    expect(detectDrift(before, after, now)).toEqual([]);
  });

  it("solde hors forfait corrigé par le recalcul → signalé", () => {
    const out = detectDrift(snap([[10, pkg()]]), snap([[10, pkg()]], [[1, { name: "A B", outOfPackageMinutes: 45 }]]), now);
    expect(out.map((a) => a.rule)).toEqual(["drift_out_of_package"]);
  });
});

describe("E-mail d'alerte", () => {
  it("aucune anomalie → aucun e-mail", () => {
    expect(buildIntegrityEmail([])).toBeNull();
  });

  it("liste les points, avec lien vers la fiche, sans clôture « Bonne journée », HTML échappé", () => {
    const mail = buildIntegrityEmail([
      { severity: "error", rule: "open_attendance", residentId: 7, residentName: "Niko Klein", message: "Pointage jamais clôturé <b>" },
      { severity: "todo", rule: "out_of_package_limit", message: "Quelque chose à traiter" },
    ])!;
    expect(mail.subject).toBe("Contrôle quotidien : 2 points à vérifier");
    expect(mail.html).toContain("Niko Klein");
    expect(mail.html).toContain("/residents/7");
    expect(mail.html).toContain("Incohérences à corriger (1)");
    expect(mail.html).toContain("À traiter (1)");
    expect(mail.html).toContain("&lt;b&gt;");
    expect(mail.html).not.toContain("Bonne journée");
  });
});
