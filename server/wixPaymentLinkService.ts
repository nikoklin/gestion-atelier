import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, getActivePackageTypes } from "./db";
import { wixPaymentLinks } from "../drizzle/schema";

// Liens de paiement Wix personnels : un par forfait en vente, au nom du résident,
// à usage unique et valables 15 jours. Créés au rappel (une semaine avant la fin
// du forfait), réutilisés par l'e-mail « forfait terminé » tant qu'ils sont
// valables. Au paiement, le webhook retrouve résident et forfait par l'identifiant du lien.

const WIX_PAYMENT_LINKS_URL = "https://www.wixapis.com/payment-links/v1/payment-links";
export const PAYMENT_LINK_VALIDITY_DAYS = 15;

export type ResidentPaymentLink = { label: string; price: number; url: string; expiresAt: Date };

export function isWixPaymentLinksConfigured(): boolean {
  return !!process.env.WIX_API_KEY && !!process.env.WIX_SITE_ID;
}

async function createWixPaymentLink(params: {
  title: string;
  itemName: string;
  price: number;
  expiresAt: Date;
}): Promise<{ id: string; url: string }> {
  const response = await fetch(WIX_PAYMENT_LINKS_URL, {
    method: "POST",
    headers: {
      Authorization: process.env.WIX_API_KEY!,
      "wix-site-id": process.env.WIX_SITE_ID!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentLink: {
        title: params.title.slice(0, 200),
        currency: "EUR",
        type: "ECOM",
        ecomPaymentLink: {
          lineItems: [
            {
              type: "CUSTOM",
              customItem: { name: params.itemName.slice(0, 200), price: String(params.price), quantity: 1 },
            },
          ],
        },
        paymentsLimit: 1,
        expirationDate: params.expiresAt.toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Wix a répondu ${response.status} à la création du lien de paiement : ${body.slice(0, 300)}`);
  }
  const data = (await response.json()) as { paymentLink?: { id?: string; links?: { url?: { url?: string } } } };
  const id = data.paymentLink?.id;
  const url = data.paymentLink?.links?.url?.url;
  if (!id || !url) throw new Error("Réponse de Wix sans identifiant ou sans adresse de lien.");
  return { id, url };
}

/**
 * Liens de paiement du résident pour tous les forfaits en vente. Réutilise ceux
 * qui sont encore valables et non payés (même prix) ; crée les manquants pour 15 jours.
 * Renvoie null si Wix n'est pas configuré ou ne répond pas : l'e-mail utilise alors
 * les liens fixes des Paramètres.
 */
export async function getPaymentLinksForResident(resident: {
  id: number;
  firstName: string;
  lastName: string;
}): Promise<ResidentPaymentLink[] | null> {
  if (!isWixPaymentLinksConfigured()) return null;
  const db = await getDb();
  if (!db) return null;

  try {
    const types = (await getActivePackageTypes()).filter((t) => t.price > 0);
    if (types.length === 0) return null;

    const now = new Date();
    const existing = await db
      .select()
      .from(wixPaymentLinks)
      .where(and(eq(wixPaymentLinks.residentId, resident.id), isNull(wixPaymentLinks.paidAt), gt(wixPaymentLinks.expiresAt, now)));

    const expiresAt = new Date(now.getTime() + PAYMENT_LINK_VALIDITY_DAYS * 86400000);
    const links: ResidentPaymentLink[] = [];
    for (const type of types) {
      const reusable = existing
        .filter((l) => l.packageTypeId === type.id && l.amount === type.price)
        .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime())[0];
      if (reusable) {
        links.push({ label: type.label, price: type.price, url: reusable.url, expiresAt: new Date(reusable.expiresAt) });
        continue;
      }
      const created = await createWixPaymentLink({
        title: `Forfait ${type.label} – ${resident.firstName} ${resident.lastName}`,
        itemName: `Forfait ${type.label}`,
        price: type.price,
        expiresAt,
      });
      await db.insert(wixPaymentLinks).values({
        residentId: resident.id,
        packageTypeId: type.id,
        wixPaymentLinkId: created.id,
        url: created.url,
        amount: type.price,
        expiresAt,
      });
      links.push({ label: type.label, price: type.price, url: created.url, expiresAt });
    }
    return links;
  } catch (error) {
    console.error(`[WixPaymentLinks] Liens personnels indisponibles pour le résident ${resident.id}, repli sur les liens fixes:`, error);
    return null;
  }
}

export async function findWixPaymentLink(wixPaymentLinkId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(wixPaymentLinks).where(eq(wixPaymentLinks.wixPaymentLinkId, wixPaymentLinkId)).limit(1);
  return rows[0] ?? null;
}

export async function markWixPaymentLinkPaid(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(wixPaymentLinks).set({ paidAt: new Date() }).where(eq(wixPaymentLinks.id, id));
}
