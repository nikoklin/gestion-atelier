/**
 * Étagère à vider : un résident dont le forfait est fini depuis 7 jours sans
 * être prolongé (ni forfait valable, ni forfait payé en attente) doit être
 * prévenu, puis rester listé « à vider » jusqu'à ce que l'atelier libère l'étagère.
 * Résidents de test sans e-mail ; aucun envoi réel n'est déclenché ici.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { renderShelfReleasedEmail, renderShelfNoticeForAtelier } from "./shelfService";

const d = (s: string) => new Date(s);
const IDS = [990020, 990021, 990022, 990023, 990024, 990025, 990026];

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
  await db.createResident({
    id, firstName: "TEST", lastName: `Shelf${id}`, email: "", isActive: true, shelfNumber: "14", ...extra,
  } as any);
}

describe.skipIf(!process.env.DATABASE_URL)("Étagère à vider (J+7 après la fin du forfait)", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("forfait terminé par date depuis plus de 7 jours → à prévenir ; depuis 3 jours → pas encore", async () => {
    await newResident(IDS[0]);
    await db.createPackage({
      id: 9902001, residentId: IDS[0], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-02-01"), endDate: d("2026-03-10"), isActive: false,
    } as any);

    const early = await db.findShelfReleaseCandidates(d("2026-03-13T09:00:00Z"), [IDS[0]]);
    expect(early).toHaveLength(0); // 3 jours

    const later = await db.findShelfReleaseCandidates(d("2026-03-20T09:00:00Z"), [IDS[0]]);
    expect(later).toHaveLength(1);
    expect(later[0].shelfNumber).toBe("14");
    expect(later[0].finishedAt.toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });

  it("heures épuisées avant la date de fin → la fin compte au dernier pointage", async () => {
    await newResident(IDS[1]);
    await db.createPackage({
      id: 9902101, residentId: IDS[1], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-02-01"), endDate: d("2099-01-01"), isActive: true,
    } as any);
    await db.createAttendance({
      residentId: IDS[1], packageId: null,
      checkInTime: d("2026-03-01T09:00:00Z"), checkOutTime: d("2026-03-01T19:00:00Z"), durationMinutes: 600,
    } as any);
    await db.fullRecalculateResident(IDS[1]);

    const list = await db.findShelfReleaseCandidates(d("2026-03-20T09:00:00Z"), [IDS[1]]);
    expect(list).toHaveLength(1);
    expect(list[0].finishedAt.toISOString()).toBe("2026-03-01T19:00:00.000Z");
  });

  it("forfait valable, ou forfait payé en attente → pas d'avis", async () => {
    await newResident(IDS[2]);
    await db.createPackage({
      id: 9902201, residentId: IDS[2], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2099-01-01"), isActive: true,
    } as any);
    expect(await db.findShelfReleaseCandidates(d("2026-03-20T09:00:00Z"), [IDS[2]])).toHaveLength(0);

    await newResident(IDS[3]);
    await db.createPackage({
      id: 9902301, residentId: IDS[3], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-02-01"), isActive: false,
    } as any);
    await db.createPackage({
      id: 9902302, residentId: IDS[3], packageType: "custom_999", totalHours: 900, usedHours: 0,
      startDate: d("2026-02-01"), endDate: d("2099-01-01"), isActive: false, status: "pending", autoStart: true,
    } as any);
    expect(await db.findShelfReleaseCandidates(d("2026-03-20T09:00:00Z"), [IDS[3]])).toHaveLength(0);
  });

  it("sans étagère ou résident inactif → ignoré", async () => {
    await newResident(IDS[4], { shelfNumber: null });
    await newResident(IDS[5], { isActive: false });
    for (const id of [IDS[4], IDS[5]]) {
      await db.createPackage({
        id: id * 100 + 1, residentId: id, packageType: "custom_999", totalHours: 600, usedHours: 0,
        startDate: d("2026-01-01"), endDate: d("2026-02-01"), isActive: false,
      } as any);
    }
    expect(await db.findShelfReleaseCandidates(d("2026-03-20T09:00:00Z"), [IDS[4], IDS[5]])).toHaveLength(0);
  });

  it("une fois prévenu (shelfEmailSent) : plus à prévenir, mais listé « à vider » tant que l'étagère est attribuée", async () => {
    await newResident(IDS[6]);
    await db.createPackage({
      id: 9902601, residentId: IDS[6], packageType: "custom_999", totalHours: 600, usedHours: 0,
      startDate: d("2026-01-01"), endDate: d("2026-02-01"), isActive: false,
    } as any);
    const now = d("2026-03-20T09:00:00Z");
    expect(await db.findShelfReleaseCandidates(now, [IDS[6]])).toHaveLength(1);

    await db.updatePackage(9902601, { shelfEmailSent: true } as any);
    expect(await db.findShelfReleaseCandidates(now, [IDS[6]])).toHaveLength(0);
    expect((await db.findShelvesToEmpty(now)).some((s) => s.residentId === IDS[6])).toBe(true);

    // L'atelier libère l'étagère : le résident sort de la liste.
    await db.updateResident(IDS[6], { shelfNumber: null });
    expect((await db.findShelvesToEmpty(now)).some((s) => s.residentId === IDS[6])).toBe(false);
  });
});

describe("Contenu des e-mails « étagère à vider »", () => {
  const c = {
    residentId: 1, firstName: "Niko", lastName: "Klein", email: "n@example.com", shelfNumber: "26",
    packageId: 1, finishedAt: d("2026-03-10T00:00:00Z"), noticeSent: false,
  };

  it("e-mail au résident (envoyé une fois l'étagère vidée) : poli, au passé, tutoiement, sans bouton, jamais un prénom en signature", () => {
    const { subject, html } = renderShelfReleasedEmail("Niko", "26");
    expect(subject).toBe("Ton étagère n°26 a été libérée");
    expect(html).toContain("nous avons libéré ton étagère");
    expect(html).toContain("n°26");
    expect(html).toContain("accueillir un autre résident");
    expect(html).not.toContain("séparés");
    expect(html).not.toContain("désolés");
    expect(html).not.toContain("Consulter mon espace personnel");
    expect(html).toContain("Bonne journée.<br>L'équipe de l'atelier");
    expect(html).not.toMatch(/\b(vous|votre)\b/i);
  });

  it("e-mail à l'atelier : résident, étagère, lien vers la fiche, sans clôture « Bonne journée »", () => {
    const { subject, html } = renderShelfNoticeForAtelier(c);
    expect(subject).toContain("Niko Klein");
    expect(html).toContain("n°26");
    expect(html).toContain("/residents/1");
    expect(html).toContain("Étagère vidée");
    expect(html).toContain("le résident en est informé par e-mail");
    expect(html).not.toContain("Bonne journée");
  });
});
