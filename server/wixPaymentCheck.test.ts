/**
 * Contrôle de nuit des paiements Wix : un paiement de forfait (lien personnel ou
 * lien fixe des Paramètres) sans forfait créé est signalé ; les autres liens (cours…)
 * sont ignorés ; Wix en panne est signalé. Wix est simulé ; résident de test 990160,
 * inactif et sans e-mail réel. Les réglages de l'atelier ne sont pas modifiés.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, wixPaymentLinks } from "../drizzle/schema";
import { checkWixPaymentsProcessed } from "./wixPaymentCheck";

const RID = 990160;
const now = new Date();
const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
let payments: any[] = [];
let wixStatus = 200;
const linkUrls: Record<string, string> = {};

globalThis.fetch = (async (url: string) => {
  const u = String(url);
  if (wixStatus !== 200) return new Response("refusé", { status: wixStatus });
  if (u.endsWith("/payment-link-payments/query")) return new Response(JSON.stringify({ paymentLinkPayments: payments }), { status: 200 });
  const id = u.split("/").pop()!;
  return new Response(JSON.stringify({ paymentLink: { links: { url: { url: linkUrls[id] ?? "https://exemple.invalid/autre" } } } }), { status: 200 });
}) as any;

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  await database.delete(packages).where(eq(packages.residentId, RID));
  await database.delete(wixPaymentLinks).where(eq(wixPaymentLinks.residentId, RID));
  await database.delete(residents).where(eq(residents.id, RID));
}

describe.skipIf(!process.env.DATABASE_URL)("Contrôle des paiements Wix", () => {
  const savedEnv = { key: process.env.WIX_API_KEY, site: process.env.WIX_SITE_ID };
  beforeAll(async () => {
    process.env.WIX_API_KEY = "test-key";
    process.env.WIX_SITE_ID = "test-site";
    await cleanup();
    await db.createResident({ id: RID, firstName: "TEST", lastName: "Wix", email: "", isActive: false } as any);
    const database = (await getDb())!;
    await database.insert(wixPaymentLinks).values({ residentId: RID, packageTypeId: 3, wixPaymentLinkId: "test-perso-990160",
      url: "https://pay.example/perso", amount: 170, expiresAt: new Date(now.getTime() + 86400000) });
    await db.createPackage({ residentId: RID, packageType: "custom_3", totalHours: 1800, usedHours: 0, startDate: now,
      endDate: new Date(now.getTime() + 28 * 86400000), isActive: false, status: "active", wixPaymentId: "test-pay-traite" } as any);
  });
  afterAll(async () => {
    await cleanup();
    if (savedEnv.key === undefined) delete process.env.WIX_API_KEY; else process.env.WIX_API_KEY = savedEnv.key;
    if (savedEnv.site === undefined) delete process.env.WIX_SITE_ID; else process.env.WIX_SITE_ID = savedEnv.site;
  });

  it("signale un paiement de forfait sans forfait, avec le résident ; ignore le paiement traité et les autres liens", async () => {
    wixStatus = 200;
    payments = [
      { id: "test-pay-traite", createdDate: ago(120), amount: "170", paymentLinkId: "test-perso-990160" },
      { id: "test-pay-manque", createdDate: ago(90), amount: "170", paymentLinkId: "test-perso-990160" },
      { id: "test-pay-cours", createdDate: ago(60), amount: "60", paymentLinkId: "lien-cours" },
      { id: "test-pay-recent", createdDate: ago(5), amount: "170", paymentLinkId: "test-perso-990160" }, // laissé au webhook
    ];
    const anomalies = await checkWixPaymentsProcessed(now);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ severity: "error", rule: "wix_payment_without_package", residentId: RID });
    expect(anomalies[0].message).toMatch(/170 €.*n'est pas arrivé dans l'application/);
  });

  it("Wix refuse l'accès : contrôle impossible signalé", async () => {
    wixStatus = 403;
    const anomalies = await checkWixPaymentsProcessed(now);
    expect(anomalies.map((a) => a.rule)).toEqual(["wix_payments_unchecked"]);
    wixStatus = 200;
  });

  it("Wix non configuré : rien", async () => {
    const key = process.env.WIX_API_KEY;
    delete process.env.WIX_API_KEY;
    expect(await checkWixPaymentsProcessed(now)).toEqual([]);
    process.env.WIX_API_KEY = key;
  });
});
