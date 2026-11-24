/**
 * Restaure une sauvegarde JSON (backup_….json du Drive) dans une AUTRE base que celle
 * de l'application : RESTORE_DATABASE_URL (dans .env). Garde-fous : refuse la base de
 * production, une base sans tables ou d'une autre version, et une base non vide.
 *
 *   npx tsx scripts/restore-backup.ts chemin/vers/backup_AAAA-MM-JJ_HHhMM.json
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "../server/db";
import { restoreJsonBackup, RestoreRefused, type JsonBackup } from "../server/jsonBackup";

const sameDatabase = (a: string, b: string) => {
  const key = (u: string) => { const x = new URL(u); return `${x.hostname}:${x.port || 3306}/${x.pathname.replace(/^\//, "")}`.toLowerCase(); };
  return key(a) === key(b);
};

const file = process.argv[2];
const targetUrl = process.env.RESTORE_DATABASE_URL;
if (!file) { console.error("Indiquer le fichier de sauvegarde (.json)."); process.exit(1); }
if (!targetUrl) { console.error("RESTORE_DATABASE_URL manquant dans .env (la base où restaurer)."); process.exit(1); }
if (process.env.DATABASE_URL && sameDatabase(targetUrl, process.env.DATABASE_URL)) {
  console.error("Refusé : RESTORE_DATABASE_URL désigne la base de l'application (production).");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf-8")) as JsonBackup;
const pool = createPool(targetUrl);
try {
  const restored = await restoreJsonBackup(drizzle(pool) as never, backup);
  console.log(`Sauvegarde du ${backup.createdAt} restaurée :`);
  for (const [table, n] of Object.entries(restored)) console.log(`  ${table.padEnd(16)} ${n}`);
} catch (error) {
  console.error(error instanceof RestoreRefused ? `Refusé : ${error.message}` : error);
  process.exitCode = 1;
} finally {
  await pool.promise().end();
}
