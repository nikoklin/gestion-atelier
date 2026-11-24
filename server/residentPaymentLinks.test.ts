/**
 * « Mon espace » : régler un nouveau forfait. Le résident connecté obtient ses liens
 * personnels Wix (créés au clic, réutilisés ensuite) ; l'identifiant envoyé par le
 * navigateur est ignoré ; sans session, refus. Wix est simulé (aucun vrai lien créé).
 * Résidents de test 990150/990151, inactifs et sans e-mail.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, wixPaymentLinks } from "../drizzle/schema";
import { appRouter } from "./routers";

const RID = 990150;
const OTHER = 990151;
let wixCreations = 0;
globalThis.fetch = (async (url: string) => {
  if (String(url).includes("wixapis.com/payment-links")) {
    const id = `test-link-${Date.now()}-${++wixCreations}`;
    return new Response(JSON.stringify({ paymentLink: { id, links: { url: { url: `https://pay.example/${id}` } } } }), { status: 200 });
  }
  throw new Error(`Appel réseau inattendu : ${url}`);
}) as any;

const residentCaller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null, residentId: RID } as any);
const anonymousCaller = appRouter.createCaller({ req: {} as any, res: {} as any, user: null } as any);

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  for (const id of [RID, OTHER]) {
    await database.delete(wixPaymentLinks).where(eq(wixPaymentLinks.residentId, id));
    await database.delete(residents).where(eq(residents.id, id));
  }
}

describe.skipIf(!process.env.DATABASE_URL)("Mon espace : régler un nouveau forfait", () => {
  const savedEnv = { key: process.env.WIX_API_KEY, site: process.env.WIX_SITE_ID };
  beforeAll(async () => {
    process.env.WIX_API_KEY = "test-key";
    process.env.WIX_SITE_ID = "test-site";
    await cleanup();
    await db.createResident({ id: RID, firstName: "TEST", lastName: "Paiement", email: "", isActive: false } as any);
    await db.createResident({ id: OTHER, firstName: "TEST", lastName: "Autre", email: "", isActive: false } as any);
  });
  afterAll(async () => {
    await cleanup();
    if (savedEnv.key === undefined) delete process.env.WIX_API_KEY; else process.env.WIX_API_KEY = savedEnv.key;
    if (savedEnv.site === undefined) delete process.env.WIX_SITE_ID; else process.env.WIX_SITE_ID = savedEnv.site;
  });

  it("liens personnels créés au premier clic, réutilisés au suivant, pour le seul résident connecté", async () => {
    const first = await residentCaller.residentAuth.preparePaymentLinks({ residentId: OTHER });
    expect(first.links.length).toBeGreaterThan(0);
    expect(first.links.every((l) => l.url.startsWith("https://pay.example/") && l.price !== null)).toBe(true);
    expect(first.validUntil).not.toBeNull();
    const database = (await getDb())!;
    expect((await database.select().from(wixPaymentLinks).where(eq(wixPaymentLinks.residentId, RID))).length).toBe(first.links.length);
    expect((await database.select().from(wixPaymentLinks).where(eq(wixPaymentLinks.residentId, OTHER))).length).toBe(0);

    const created = wixCreations;
    const second = await residentCaller.residentAuth.preparePaymentLinks();
    expect(wixCreations).toBe(created); // aucun nouveau lien chez Wix
    expect(second.links.map((l) => l.url).sort()).toEqual(first.links.map((l) => l.url).sort());
  });

  it("sans session : refusé", async () => {
    await expect(anonymousCaller.residentAuth.preparePaymentLinks({ residentId: RID })).rejects.toThrow(/Connecte-toi/);
  });
});
