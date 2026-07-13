import crypto from "crypto";
import { eq, and, lt } from "drizzle-orm";
import { getDb } from "./db";
import { actionTokens } from "../drizzle/schema";

/**
 * Génère un token aléatoire sécurisé
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Crée un token pour corriger l'heure de sortie d'un pointage
 * Valable 48h
 */
export async function createFixCheckoutToken(
  residentId: number,
  attendanceId: number
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db.insert(actionTokens).values({
    token,
    actionType: "fix_checkout",
    residentId,
    attendanceId,
    expiresAt,
  });

  return token;
}


/**
 * Valide et retourne un token d'action (non expiré, non utilisé)
 */
export async function validateToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const rows = await db
    .select()
    .from(actionTokens)
    .where(eq(actionTokens.token, token))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];

  if (row.usedAt) return null; // Déjà utilisé
  if (row.expiresAt < now) return null; // Expiré

  return row;
}

/**
 * Marque un token comme utilisé
 */
export async function markTokenUsed(tokenId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(actionTokens)
    .set({ usedAt: new Date() })
    .where(eq(actionTokens.id, tokenId));
}

/**
 * Nettoie les tokens expirés (à appeler périodiquement)
 */
export async function cleanExpiredTokens(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  await db.delete(actionTokens).where(lt(actionTokens.expiresAt, now));
}
