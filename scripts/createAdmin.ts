/**
 * Crée (ou met à jour) le compte administrateur email/mot de passe.
 *
 * Usage :
 *   DATABASE_URL="mysql://..." tsx scripts/createAdmin.ts <email> <motDePasse> [nom]
 *
 * ou via variables d'environnement :
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... tsx scripts/createAdmin.ts
 *
 * Si un utilisateur avec cet e-mail existe déjà, son mot de passe est
 * réinitialisé et son rôle passé à "admin". Sinon un nouvel utilisateur
 * admin est créé.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { users } from "../drizzle/schema";

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "").trim();
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? "";
  const name = (process.argv[4] ?? process.env.ADMIN_NAME ?? "Admin").trim();

  if (!process.env.DATABASE_URL) {
    console.error("[createAdmin] DATABASE_URL manquant.");
    process.exit(1);
  }
  if (!email || !password) {
    console.error(
      "[createAdmin] Usage: tsx scripts/createAdmin.ts <email> <motDePasse> [nom]"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("[createAdmin] Le mot de passe doit faire au moins 8 caractères.");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL);
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ passwordHash, role: "admin", name })
      .where(eq(users.email, email));
    console.log(`[createAdmin] Compte admin mis à jour : ${email}`);
  } else {
    const openId = `local:${randomBytes(16).toString("hex")}`;
    await db.insert(users).values({
      openId,
      email,
      name,
      passwordHash,
      role: "admin",
      loginMethod: "password",
    });
    console.log(`[createAdmin] Compte admin créé : ${email} (openId=${openId})`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("[createAdmin] Échec:", err);
  process.exit(1);
});
