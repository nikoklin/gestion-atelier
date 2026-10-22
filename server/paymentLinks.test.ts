/**
 * Liens de paiement Wix personnels (15 jours) : l'API Wix et l'envoi d'e-mails
 * (Brevo) sont simulés ; résidents de test 99006x, nettoyés à la fin.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances, wixPaymentLinks } from "../drizzle/schema";
import { getPaymentLinksForResident, PAYMENT_LINK_VALIDITY_DAYS } from "./wixPaymentLinkService";
import { sendReminderEmail } from "./emailService";
import { processWixPaymentEvent } from "./wixWebhookRoutes";
import { appRouter } from "./routers";

const RID = 990060;
const RID2 = 990061;
const RID3 = 990062;
const EMAIL = "paylink-test@example.invalid";

type Call = { url: string; body: any; headers: Record<string, string> };
let wixCalls: Call[] = [];
let mails: { to: string; subject: string; html: string }[] = [];
let wixFails = false;
let seq = 0;

globalThis.fetch = (async (url: string, init: any) => {
  const body = JSON.parse(init.body);
  if (String(url).includes("wixapis.com/payment-links")) {
    wixCalls.push({ url: String(url), body, headers: init.headers });
    if (wixFails) return new Response("boom", { status: 500 });
    const id = `test-link-${Date.now()}-${++seq}`;
    return new Response(JSON.stringify({ paymentLink: { id, links: { url: { url: `https://pay.example/${id}` } } } }), { status: 200 });
  }
  mails.push({ to: body.to[0].email, subject: body.subject, html: body.htmlContent });
  return new Response("{}", { status: 201 });
}) as any;

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  for (const id of [RID, RID2, RID3]) {
    await database.delete(attendances).where(eq(attendances.residentId, id));
    await database.delete(packages).where(eq(packages.residentId, id));
    await database.delete(residents).where(eq(residents.id, id)); // liens supprimés en cascade
  }
}

const event = (paymentId: string, paymentLinkId: string, amount: string, email = "autre-adresse@example.invalid") => ({
  entityFqdn: "wix.paymentlinks.payments.v1.payment_link_payment",
  slug: "created",
  createdEvent: { entity: { id: paymentId, amount, paymentLinkId, regularPaymentLinkPayment: { contactDetails: { email } } } },
});

describe.skipIf(!process.env.DATABASE_URL)("Liens de paiement Wix personnels (15 jours)", () => {
  let saleTypes: Awaited<ReturnType<typeof db.getActivePackageTypes>> = [];
  let savedSettings: { autoPaymentLinksEnabled: boolean; paymentLinkValidityDays: number; paymentLinkPackageTypeIds: string | null };

  beforeAll(async () => {
    await cleanup();
    // Réglages de l'atelier : valeurs par défaut pendant les tests, restaurées à la fin
    const s = (await db.getAtelierSettings())!;
    savedSettings = { autoPaymentLinksEnabled: s.autoPaymentLinksEnabled, paymentLinkValidityDays: s.paymentLinkValidityDays, paymentLinkPackageTypeIds: s.paymentLinkPackageTypeIds };
    await db.updateAtelierSettings({ autoPaymentLinksEnabled: true, paymentLinkValidityDays: 15, paymentLinkPackageTypeIds: null });
    await db.createResident({ id: RID, firstName: "TEST", lastName: "PayLink", email: EMAIL, isActive: true } as any);
    saleTypes = (await db.getActivePackageTypes()).filter((t) => t.price > 0);
  });
  afterAll(async () => {
    await cleanup();
    if (savedSettings) await db.updateAtelierSettings(savedSettings);
    delete process.env.WIX_API_KEY;
    delete process.env.WIX_SITE_ID;
  });
  beforeEach(() => {
    wixCalls = [];
    mails = [];
    wixFails = false;
  });

  it("sans clé d'API Wix : aucun lien personnel (repli sur les liens fixes)", async () => {
    delete process.env.WIX_API_KEY;
    delete process.env.WIX_SITE_ID;
    expect(await getPaymentLinksForResident({ id: RID, firstName: "TEST", lastName: "PayLink" })).toBeNull();
    expect(wixCalls).toHaveLength(0);
  });

  it("avec la clé : un lien par forfait en vente, EUR, usage unique, 15 jours, au nom du résident", async () => {
    process.env.WIX_API_KEY = "test-key";
    process.env.WIX_SITE_ID = "test-site";
    const before = Date.now();
    const links = (await getPaymentLinksForResident({ id: RID, firstName: "TEST", lastName: "PayLink" }))!;
    expect(links).toHaveLength(saleTypes.length);
    expect(wixCalls).toHaveLength(saleTypes.length);

    const first = wixCalls[0];
    expect(first.headers.Authorization).toBe("test-key");
    expect(first.headers["wix-site-id"]).toBe("test-site");
    const pl = first.body.paymentLink;
    expect(pl.currency).toBe("EUR");
    expect(pl.type).toBe("ECOM");
    expect(pl.paymentsLimit).toBe(1);
    expect(pl.title).toContain("TEST PayLink");
    expect(pl.ecomPaymentLink.lineItems[0]).toEqual({
      type: "CUSTOM",
      customItem: { name: `Forfait ${saleTypes[0].label}`, price: String(saleTypes[0].price), quantity: 1 },
    });
    const days = (new Date(pl.expirationDate).getTime() - before) / 86400000;
    expect(days).toBeGreaterThan(PAYMENT_LINK_VALIDITY_DAYS - 0.01);
    expect(days).toBeLessThan(PAYMENT_LINK_VALIDITY_DAYS + 0.01);
  });

  it("appel suivant (e-mail « forfait terminé ») : les mêmes liens sont réutilisés, rien n'est recréé", async () => {
    const again = (await getPaymentLinksForResident({ id: RID, firstName: "TEST", lastName: "PayLink" }))!;
    expect(again).toHaveLength(saleTypes.length);
    expect(wixCalls).toHaveLength(0);
  });

  it("Wix en erreur : null, l'e-mail utilisera les liens fixes", async () => {
    const database = await getDb();
    await database!.delete(wixPaymentLinks).where(eq(wixPaymentLinks.residentId, RID));
    wixFails = true;
    expect(await getPaymentLinksForResident({ id: RID, firstName: "TEST", lastName: "PayLink" })).toBeNull();
  });

  it("e-mail de rappel : contient les liens personnels avec prix et date de validité", async () => {
    await db.createPackage({ id: 9906001, residentId: RID, packageType: `custom_${saleTypes[0].id}`, totalHours: 600, usedHours: 0,
      startDate: new Date(Date.now() - 20 * 86400000), endDate: new Date(Date.now() + 5 * 86400000), isActive: true } as any);
    await sendReminderEmail(EMAIL, "TEST", RID, 9906001);
    expect(mails).toHaveLength(1);
    expect(mails[0].html).toContain("https://pay.example/");
    expect(mails[0].html).toContain(`${saleTypes[0].label} – ${saleTypes[0].price} €`);
    expect(mails[0].html).toContain("Liens personnels valables jusqu'au");
  });

  it("paiement via le lien personnel avec une autre adresse : forfait en file pour le bon résident, lien marqué payé, rejeu sans doublon", async () => {
    const database = await getDb();
    const [link] = await database!.select().from(wixPaymentLinks).where(eq(wixPaymentLinks.residentId, RID)).limit(1);
    const type = saleTypes.find((t) => t.id === link.packageTypeId)!;

    await processWixPaymentEvent(event("test-pay-1", link.wixPaymentLinkId, String(type.price)));
    await processWixPaymentEvent(event("test-pay-1", link.wixPaymentLinkId, String(type.price)));

    const created = (await db.getPackagesByResidentId(RID)).filter((p) => p.wixPaymentId === "test-pay-1");
    expect(created).toHaveLength(1);
    expect(created[0].packageType).toBe(`custom_${type.id}`);
    expect(created[0].status).toBe("pending"); // un forfait était encore en cours → file d'attente
    const [after] = await database!.select().from(wixPaymentLinks).where(eq(wixPaymentLinks.id, link.id));
    expect(after.paidAt).not.toBeNull();

    // Le lien payé n'est plus proposé : un nouveau est créé pour ce forfait.
    wixCalls = [];
    await getPaymentLinksForResident({ id: RID, firstName: "TEST", lastName: "PayLink" });
    expect(wixCalls.filter((c) => c.body.paymentLink.ecomPaymentLink.lineItems[0].customItem.name === `Forfait ${type.label}`)).toHaveLength(1);
  });

  it("sans forfait en cours : le paiement via le lien crée et active le forfait", async () => {
    await db.createResident({ id: RID2, firstName: "TEST", lastName: "PayLink2", email: "paylink2@example.invalid", isActive: true } as any);
    const links = (await getPaymentLinksForResident({ id: RID2, firstName: "TEST", lastName: "PayLink2" }))!;
    const database = await getDb();
    const [row] = await database!.select().from(wixPaymentLinks).where(eq(wixPaymentLinks.url, links[0].url));
    await processWixPaymentEvent(event("test-pay-2", row.wixPaymentLinkId, String(links[0].price)));
    const pkg = (await db.getPackagesByResidentId(RID2)).find((p) => p.wixPaymentId === "test-pay-2")!;
    expect(pkg.status).toBe("active");
    expect(pkg.isActive).toBe(true);
    expect(pkg.packageType).toBe(`custom_${row.packageTypeId}`);
  });

  describe("réglages (Paramètres → Liens de paiement automatiques)", () => {
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 1, role: "admin" } as any });
    const resident = { id: RID3, firstName: "TEST", lastName: "PayLink3" };

    beforeAll(async () => {
      await db.createResident({ id: RID3, firstName: "TEST", lastName: "PayLink3", email: "paylink3@example.invalid", isActive: true } as any);
    });
    beforeEach(async () => {
      const database = await getDb();
      await database!.delete(wixPaymentLinks).where(eq(wixPaymentLinks.residentId, RID3));
    });
    afterAll(async () => {
      await db.updateAtelierSettings({ autoPaymentLinksEnabled: true, paymentLinkValidityDays: 15, paymentLinkPackageTypeIds: null });
    });

    it("désactivés : aucun lien créé (les e-mails gardent les liens de secours)", async () => {
      await caller.atelierSettings.update({ autoPaymentLinksEnabled: false });
      expect(await getPaymentLinksForResident(resident)).toBeNull();
      expect(wixCalls).toHaveLength(0);
      await caller.atelierSettings.update({ autoPaymentLinksEnabled: true });
    });

    it("durée de validité réglable : 30 jours", async () => {
      await caller.atelierSettings.update({ paymentLinkValidityDays: 30 });
      const before = Date.now();
      await getPaymentLinksForResident(resident);
      const days = (new Date(wixCalls[0].body.paymentLink.expirationDate).getTime() - before) / 86400000;
      expect(days).toBeGreaterThan(29.99);
      expect(days).toBeLessThan(30.01);
      await caller.atelierSettings.update({ paymentLinkValidityDays: 15 });
    });

    it("durée hors limites refusée", async () => {
      await expect(caller.atelierSettings.update({ paymentLinkValidityDays: 0 })).rejects.toThrow();
      await expect(caller.atelierSettings.update({ paymentLinkValidityDays: 91 })).rejects.toThrow();
    });

    it("choix des forfaits : seuls les forfaits cochés sont proposés ; null = tous", async () => {
      await caller.atelierSettings.update({ paymentLinkPackageTypeIds: [saleTypes[0].id] });
      expect((await db.getAtelierSettings())!.paymentLinkPackageTypeIds).toBe(JSON.stringify([saleTypes[0].id]));
      const links = (await getPaymentLinksForResident(resident))!;
      expect(links).toHaveLength(1);
      expect(links[0].label).toBe(saleTypes[0].label);

      await caller.atelierSettings.update({ paymentLinkPackageTypeIds: null });
      expect((await db.getAtelierSettings())!.paymentLinkPackageTypeIds).toBeNull();
      wixCalls = [];
      expect(await getPaymentLinksForResident(resident)).toHaveLength(saleTypes.length);
    });

    it("état de la connexion Wix : non configuré / connecté / refusé", async () => {
      delete process.env.WIX_API_KEY;
      expect(await caller.atelierSettings.getPaymentLinksStatus()).toMatchObject({ configured: false, ok: false });
      process.env.WIX_API_KEY = "test-key";
      expect(await caller.atelierSettings.getPaymentLinksStatus()).toMatchObject({ configured: true, ok: true });
      expect(wixCalls.at(-1)!.url).toContain("/payment-links/query");
      wixFails = true;
      expect(await caller.atelierSettings.getPaymentLinksStatus()).toMatchObject({ configured: true, ok: false });
    });
  });
});
