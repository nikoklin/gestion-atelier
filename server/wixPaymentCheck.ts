import { inArray } from "drizzle-orm";
import { getAtelierSettings, getDb, getResidentByEmail, getResidentById } from "./db";
import { packages } from "../drizzle/schema";
import type { Anomaly } from "./integrityCheck";
import { findWixPaymentLink, isWixPaymentLinksConfigured } from "./wixPaymentLinkService";
import { formatParisDate, formatParisTime } from "./_core/timezone";

const PAYMENTS_QUERY_URL = "https://www.wixapis.com/payment-links/v1/payment-link-payments/query";
const PAYMENT_LINKS_URL = "https://www.wixapis.com/payment-links/v1/payment-links";
// Paiements contrôlés : ceux des 48 dernières heures (chacun est donc vérifié par
// deux contrôles de nuit, pas indéfiniment), sauf la dernière demi-heure, le temps
// que le webhook arrive.
const WINDOW_MS = 48 * 3600_000;
const GRACE_MS = 30 * 60_000;

type WixPayment = {
  id: string;
  createdDate: string;
  amount: string;
  paymentLinkId?: string;
  regularPaymentLinkPayment?: { contactDetails?: { email?: string } };
};

/**
 * Contrôle de nuit : chaque paiement reçu par Wix (liens de paiement) doit avoir
 * créé un forfait (packages.wixPaymentId). Sinon le webhook n'a pas fonctionné —
 * app Wix désinstallée, clé de signature changée… (panne de septembre 2026) — ou le
 * paiement n'a pas pu être rattaché : l'atelier est alerté, rien n'est créé.
 */
export async function checkWixPaymentsProcessed(now: Date = new Date()): Promise<Anomaly[]> {
  if (!isWixPaymentLinksConfigured()) return [];

  let payments: WixPayment[];
  try {
    const response = await fetch(PAYMENTS_QUERY_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.WIX_API_KEY!,
        "wix-site-id": process.env.WIX_SITE_ID!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          sort: [{ fieldName: "createdDate", order: "DESC" }],
          filter: { createdDate: { $gte: new Date(now.getTime() - WINDOW_MS).toISOString() } },
          cursorPaging: { limit: 100 },
        },
      }),
    });
    if (!response.ok) {
      return [{ severity: "todo", rule: "wix_payments_unchecked",
        message: `Contrôle des paiements Wix impossible : Wix refuse l'accès (erreur ${response.status}). Vérifier la clé d'API Wix dans Railway.` }];
    }
    const data = (await response.json()) as { paymentLinkPayments?: WixPayment[] };
    payments = (data.paymentLinkPayments ?? []).filter((p) => new Date(p.createdDate).getTime() <= now.getTime() - GRACE_MS);
  } catch {
    return [{ severity: "todo", rule: "wix_payments_unchecked",
      message: "Contrôle des paiements Wix impossible : Wix ne répond pas." }];
  }
  if (payments.length === 0) return [];

  const db = await getDb();
  if (!db) return [];
  const processed = new Set(
    (await db.select({ wixPaymentId: packages.wixPaymentId }).from(packages)
      .where(inArray(packages.wixPaymentId, payments.map((p) => p.id))))
      .map((p) => p.wixPaymentId)
  );

  // Liens « forfait » fixes des Paramètres (repli des e-mails) : seuls les paiements
  // de forfaits sont contrôlés, pas ceux des autres liens (cours, stages…).
  const settings = await getAtelierSettings();
  let fixedUrls = new Set<string>();
  try {
    const parsed = settings?.paymentLinks ? JSON.parse(settings.paymentLinks) : null;
    fixedUrls = new Set((parsed?.links ?? []).map((l: { url: string }) => normalizeUrl(l.url)));
  } catch { /* réglage illisible : seuls les liens personnels sont contrôlés */ }

  const anomalies: Anomaly[] = [];
  const linkUrlCache = new Map<string, string | null>();
  for (const p of payments) {
    if (processed.has(p.id)) continue;
    const personal = p.paymentLinkId ? await findWixPaymentLink(p.paymentLinkId) : null;
    if (!personal) {
      const url = p.paymentLinkId ? await wixLinkUrl(p.paymentLinkId, linkUrlCache) : null;
      if (!url || !fixedUrls.has(normalizeUrl(url))) continue; // pas un lien de forfait
    }
    const payer = p.regularPaymentLinkPayment?.contactDetails?.email;
    const resident = personal
      ? await getResidentById(personal.residentId)
      : payer ? await getResidentByEmail(payer) : null;
    const when = `${formatParisDate(p.createdDate)} à ${formatParisTime(p.createdDate).replace(":", "h")}`;
    const reason = resident
      ? "le paiement n'est pas arrivé dans l'application (vérifier que l'app Wix est installée et la clé du webhook dans Railway)"
      : `aucun résident n'a l'adresse ${payer ?? "du payeur"} : créer le résident (ou corriger son adresse), puis son forfait`;
    anomalies.push({
      severity: "error",
      rule: "wix_payment_without_package",
      residentId: resident?.id,
      residentName: resident ? `${resident.firstName} ${resident.lastName}` : undefined,
      message: `Paiement Wix de ${p.amount} € du ${when} sans forfait créé : ${reason}.`,
    });
  }
  return anomalies;
}

const normalizeUrl = (url: string) => url.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();

// Adresse publique d'un lien de paiement Wix (pour le reconnaître parmi les liens fixes).
async function wixLinkUrl(paymentLinkId: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(paymentLinkId)) return cache.get(paymentLinkId)!;
  let url: string | null = null;
  try {
    const response = await fetch(`${PAYMENT_LINKS_URL}/${paymentLinkId}`, {
      headers: { Authorization: process.env.WIX_API_KEY!, "wix-site-id": process.env.WIX_SITE_ID! },
    });
    if (response.ok) {
      const data = (await response.json()) as { paymentLink?: { links?: { url?: { url?: string } } } };
      url = data.paymentLink?.links?.url?.url ?? null;
    }
  } catch { /* lien illisible : traité comme un lien qui n'est pas un forfait */ }
  cache.set(paymentLinkId, url);
  return url;
}
