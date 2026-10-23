/**
 * Rappel « bientôt terminé » et e-mail « forfait terminé » : jamais envoyés
 * quand le forfait suivant est déjà en attente (démarrage automatique ou
 * validation par l'atelier). La sélection de la tâche quotidienne est testée en
 * mémoire (la tâche elle-même parcourt les vrais résidents) ; le départ de
 * séance passe par la base avec les résidents de test 99008x, Brevo simulé.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { selectPackagesForReminderEmails } from "./emailService";
import { performCheckout } from "./checkoutLogic";

const DAY = 86400000;
const now = new Date("2026-10-23T12:00:00Z");

const pkg = (over: Partial<Parameters<typeof selectPackagesForReminderEmails>[0][number]>) => ({
  id: 1, residentId: 1, status: "active", endDate: new Date(now.getTime() + 3 * DAY),
  totalHours: 600, usedHours: 100, reminderSent: false, expirationEmailSent: false, ...over,
});

describe("Sélection de la tâche quotidienne (rappel / forfait terminé)", () => {
  it("sans forfait suivant : rappel pour le forfait qui finit dans 3 jours, e-mail de fin pour le forfait terminé", () => {
    const { expiringPackages, expiredPackages } = selectPackagesForReminderEmails([
      pkg({ id: 1, residentId: 1 }),
      pkg({ id: 2, residentId: 2, endDate: new Date(now.getTime() - DAY) }),
    ], now, 7);
    expect(expiringPackages.map((p) => p.id)).toEqual([1]);
    expect(expiredPackages.map((p) => p.id)).toEqual([2]);
  });

  it.each([
    ["à démarrage automatique", true],
    ["à valider par l'atelier", false],
  ])("forfait suivant en attente %s : ni rappel ni e-mail de fin", (_label, _autoStart) => {
    const { expiringPackages, expiredPackages } = selectPackagesForReminderEmails([
      pkg({ id: 1, residentId: 1 }),
      pkg({ id: 2, residentId: 1, status: "pending", endDate: new Date(now.getTime() + 60 * DAY), usedHours: 0 }),
      pkg({ id: 3, residentId: 2, endDate: new Date(now.getTime() - DAY) }),
      pkg({ id: 4, residentId: 2, status: "pending", endDate: new Date(now.getTime() + 60 * DAY), usedHours: 0 }),
    ], now, 7);
    expect(expiringPackages).toEqual([]);
    expect(expiredPackages).toEqual([]);
  });
});

const RID_NEXT = 990080;
const RID_NONE = 990081;
let mails: { to: string; subject: string }[] = [];
globalThis.fetch = (async (_url: string, init: any) => {
  const body = JSON.parse(init.body);
  mails.push({ to: body.to[0].email, subject: body.subject });
  return new Response("{}", { status: 201 });
}) as any;

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  for (const id of [RID_NEXT, RID_NONE]) {
    await database.delete(attendances).where(eq(attendances.residentId, id));
    await database.delete(packages).where(eq(packages.residentId, id));
    await database.delete(residents).where(eq(residents.id, id));
  }
}

// Les e-mails de départ partent en arrière-plan : attendre le résumé de séance.
async function waitForMails(email: string) {
  for (let i = 0; i < 50 && !mails.some((m) => m.to === email); i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 1500));
  return mails.filter((m) => m.to === email);
}

// Forfait d'1h ; séance d'1h30 en cours → le départ épuise le forfait.
async function exhaustOnCheckout(residentId: number, email: string, withPendingNext: boolean) {
  const t = Date.now();
  await db.createResident({ id: residentId, firstName: "TEST", lastName: "Rappel", email, isActive: true } as any);
  const pkgId = residentId * 10 + 1;
  await db.createPackage({ id: pkgId, residentId, packageType: "custom_1", totalHours: 60, usedHours: 0,
    startDate: new Date(t - 10 * DAY), endDate: new Date(t + 10 * DAY), isActive: true, status: "active" } as any);
  if (withPendingNext) {
    await db.createPackage({ id: pkgId + 1, residentId, packageType: "custom_1", totalHours: 600, usedHours: 0,
      startDate: new Date(t + 10 * DAY), endDate: new Date(t + 40 * DAY), isActive: false, status: "pending", autoStart: false } as any);
  }
  const attendanceId = pkgId;
  await db.createAttendance({ id: attendanceId, residentId, packageId: pkgId, checkInTime: new Date(t - 90 * 60000),
    attendanceType: "normal" } as any);
  await performCheckout({ attendanceId, packageId: pkgId, residentEmail: email, residentFirstName: "TEST", residentId });
  return waitForMails(email);
}

describe.skipIf(!process.env.DATABASE_URL)("Départ qui épuise le forfait", () => {
  beforeAll(async () => {
    await cleanup();
    delete process.env.WIX_API_KEY; // liens de secours, pas d'appel Wix
  });
  afterAll(cleanup);
  beforeEach(() => {
    mails = [];
  });

  it("forfait suivant payé, à valider par l'atelier : résumé de séance mais pas d'e-mail « terminé »", async () => {
    const sent = await exhaustOnCheckout(RID_NEXT, "rappel-next@example.invalid", true);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.some((m) => m.subject.includes("terminé"))).toBe(false);
  });

  it("sans forfait suivant : l'e-mail « terminé » part toujours", async () => {
    const sent = await exhaustOnCheckout(RID_NONE, "rappel-none@example.invalid", false);
    expect(sent.some((m) => m.subject.includes("terminé"))).toBe(true);
  });
});
