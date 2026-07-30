import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import * as db from "./db";

/**
 * Réception des webhooks Wix (paiements par lien de paiement — voir point 18).
 * Événement écouté : "Link Payment Created" (wix.paymentlinks.payments.v1.payment_link_payment,
 * slug "created"), déclenché quand un lien de paiement est réellement payé.
 *
 * Flux : paiement Wix reçu → résident retrouvé par e-mail acheteur → type de
 * forfait retrouvé par montant payé → forfait créé et activé immédiatement,
 * en reportant les heures hors-forfait en attente du résident (deductedMinutes).
 */
export const wixWebhookRoutes = Router();

function verifyWixWebhook(rawBody: string): any {
  const publicKey = process.env.WIX_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) {
    const err: any = new Error("WIX_WEBHOOK_PUBLIC_KEY not configured");
    err.code = "MISSING_CONFIG";
    throw err;
  }
  // Pas de restriction d'algorithme explicite : suit l'exemple officiel Wix
  // à l'identique (une restriction à RS256 pourrait rejeter un token valide
  // si Wix utilise une variante RSA différente).
  const decoded = jwt.verify(rawBody.trim(), publicKey);

  // Le contenu utile est enveloppé sur deux niveaux : le JWT décodé donne
  // {instanceId, eventType, identity, data}, et ce champ "data" (chaîne JSON)
  // contient à son tour l'événement réel {id, entityFqdn, slug, createdEvent}.
  let unwrapped: any = decoded;
  if (typeof unwrapped === "string") {
    unwrapped = JSON.parse(unwrapped);
  }
  while (unwrapped && typeof unwrapped.data === "string") {
    unwrapped = JSON.parse(unwrapped.data);
  }
  return unwrapped;
}

wixWebhookRoutes.post("/", async (req: Request, res: Response) => {
  let event: any;
  try {
    event = verifyWixWebhook(req.body);
  } catch (err: any) {
    if (err.code === "MISSING_CONFIG") {
      console.error("[WixWebhook] WIX_WEBHOOK_PUBLIC_KEY absente de la configuration serveur.");
      return res.status(500).send("Server misconfigured: WIX_WEBHOOK_PUBLIC_KEY missing");
    }
    console.error(`[WixWebhook] Échec de vérification (${err.name}): ${err.message}`);
    return res.status(400).send(`Invalid signature: ${err.name}`);
  }

  // Toujours répondre 200 une fois la signature validée : Wix réessaie sinon,
  // et une erreur métier (pas de résident trouvé, etc.) n'est pas un problème
  // de transport à corriger côté Wix.
  res.status(200).send();

  await processWixPaymentEvent(event);
});

/**
 * Traite un événement Wix déjà décodé (signature vérifiée en amont, ou fourni
 * directement par un test). Séparé de la route pour être testable sans avoir
 * à signer un vrai JWT.
 */
export async function processWixPaymentEvent(event: any): Promise<void> {
  try {
    if (event.entityFqdn !== "wix.paymentlinks.payments.v1.payment_link_payment" || event.slug !== "created") {
      console.log(`[WixWebhook] Événement ignoré: ${event.entityFqdn}/${event.slug}`);
      return;
    }

    const paymentEntity = event.createdEvent?.entity;
    const payment = paymentEntity?.regularPaymentLinkPayment;
    if (!payment) {
      console.log("[WixWebhook] Paiement par carte cadeau ou type non géré, ignoré.");
      return;
    }

    const wixPaymentId: string | undefined = paymentEntity.id;
    const amount: string | undefined = paymentEntity.amount;
    const buyerEmail: string | undefined = payment.contactDetails?.email;

    if (!wixPaymentId || !amount || !buyerEmail) {
      console.error("[WixWebhook] Payload incomplet, traitement annulé:", JSON.stringify(paymentEntity));
      return;
    }

    // Idempotence : ignorer si ce paiement a déjà généré un forfait (webhook renvoyé par Wix)
    const existing = await db.getPackageByWixPaymentId(wixPaymentId);
    if (existing) {
      console.log(`[WixWebhook] Paiement ${wixPaymentId} déjà traité (forfait #${existing.id}), ignoré.`);
      return;
    }

    const resident = await db.getResidentByEmail(buyerEmail);
    if (!resident) {
      console.error(`[WixWebhook] Aucun résident trouvé pour l'e-mail ${buyerEmail} (paiement ${wixPaymentId}, ${amount}€) — forfait NON créé, à traiter manuellement.`);
      return;
    }

    const paidAmount = Math.round(parseFloat(amount));
    const packageTypes = await db.getAllPackageTypes();
    const matchedType = packageTypes.find((t) => t.price === paidAmount);
    if (!matchedType) {
      console.error(`[WixWebhook] Aucun type de forfait au prix de ${paidAmount}€ (paiement ${wixPaymentId}, résident ${resident.id}) — forfait NON créé, à traiter manuellement.`);
      return;
    }

    const activePackage = await db.getActivePackageByResidentId(resident.id);
    if (activePackage && (activePackage.totalHours - activePackage.usedHours) > 0) {
      console.error(`[WixWebhook] Résident ${resident.id} a déjà un forfait actif avec des heures restantes — forfait NON créé pour le paiement ${wixPaymentId}, à traiter manuellement.`);
      return;
    }

    const openAttendance = await db.getOpenAttendance(resident.id);
    if (openAttendance) {
      console.error(`[WixWebhook] Résident ${resident.id} a un pointage en cours — forfait NON créé pour le paiement ${wixPaymentId}, à traiter manuellement.`);
      return;
    }

    const settings = await db.getAtelierSettings();
    const autoActivate = settings?.wixAutoActivatePackage ?? true;

    const outOfPackageMinutes = resident.outOfPackageMinutes ?? 0;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + matchedType.durationWeeks * 7);

    const newPackageId = await db.createPackage({
      residentId: resident.id,
      packageType: `custom_${matchedType.id}`,
      totalHours: matchedType.totalMinutes,
      usedHours: outOfPackageMinutes,
      deductedMinutes: outOfPackageMinutes,
      startDate,
      endDate,
      isActive: autoActivate,
      status: autoActivate ? 'active' : 'pending',
      reminderSent: false,
      expirationEmailSent: false,
      wixPaymentId,
    } as any);

    if (autoActivate) {
      await db.fullRecalculateResident(resident.id);
    }

    console.log(
      autoActivate
        ? `[WixWebhook] Forfait #${newPackageId} créé et activé pour ${resident.firstName} ${resident.lastName} (paiement ${wixPaymentId}, ${paidAmount}€, ${matchedType.label}).`
        : `[WixWebhook] Forfait #${newPackageId} créé EN ATTENTE de validation pour ${resident.firstName} ${resident.lastName} (paiement ${wixPaymentId}, ${paidAmount}€, ${matchedType.label}).`
    );

    // En mode "en attente", l'e-mail de confirmation est envoyé plus tard,
    // au moment où Nicolas valide le forfait (packages.activatePending).
    if (autoActivate && resident.email) {
      const { sendPackageActivatedEmail } = await import("./emailService");
      await sendPackageActivatedEmail(
        resident.email,
        resident.firstName,
        matchedType.label,
        startDate,
        endDate,
        matchedType.totalMinutes,
        resident.id,
        newPackageId
      ).catch((err) => console.error("[WixWebhook] Échec envoi e-mail de confirmation:", err));
    }
  } catch (err) {
    console.error("[WixWebhook] Erreur de traitement:", err);
  }
}
