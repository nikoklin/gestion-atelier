/**
 * Webhook Wix, couche HTTP (montage identique à server/_core/index.ts) : le
 * corps brut (JWT) doit arriver intact jusqu'à la vérification de signature.
 * Clé RSA générée pour le test ; événement d'un acheteur inconnu → aucun
 * forfait créé (lectures seules en base).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { wixWebhookRoutes } from "./wixWebhookRoutes";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
let server: Server;
let url = "";
const savedKey = process.env.WIX_WEBHOOK_PUBLIC_KEY;

beforeAll(async () => {
  process.env.WIX_WEBHOOK_PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
  const app = express();
  app.use("/api/webhooks/wix", express.text({ type: () => true }), wixWebhookRoutes);
  app.use(express.json());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/webhooks/wix`;
});

afterAll(() => {
  server?.close();
  if (savedKey === undefined) delete process.env.WIX_WEBHOOK_PUBLIC_KEY;
  else process.env.WIX_WEBHOOK_PUBLIC_KEY = savedKey;
});

// Même double enveloppe que Wix : { data: "<JSON de l'événement>" }.
const signedEvent = () =>
  jwt.sign({
    data: JSON.stringify({
      entityFqdn: "wix.paymentlinks.payments.v1.payment_link_payment",
      slug: "created",
      createdEvent: { entity: { id: "test-transport-1", amount: "99999", paymentLinkId: "inconnu",
        regularPaymentLinkPayment: { contactDetails: { email: "personne@example.invalid" } } } },
    }),
  }, privateKey, { algorithm: "RS256" });

describe.skipIf(!process.env.DATABASE_URL)("Webhook Wix : réception HTTP", () => {
  it("message signé (corps brut, sans Content-Type JSON) : signature vérifiée, réponse 200", async () => {
    const res = await fetch(url, { method: "POST", body: signedEvent() });
    expect(res.status).toBe(200);
  });

  it("même message envoyé avec Content-Type JSON : toujours lu comme texte brut, 200", async () => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: signedEvent() });
    expect(res.status).toBe(200);
  });

  it("signature invalide : 400", async () => {
    const res = await fetch(url, { method: "POST", body: "pas-un-jwt" });
    expect(res.status).toBe(400);
  });
});
