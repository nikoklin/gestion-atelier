import { count, sql, getTableColumns, getTableName } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { getDb } from "./db";
import {
  users, packageTypes, atelierSettings, emailTemplates, residents, packages, attendances,
  notes, emailLogs, actionTokens, undoActions, wixPaymentLinks, kioskEvents,
} from "../drizzle/schema";

/**
 * Sauvegarde complète et restaurable : toutes les tables, valeurs brutes (l'export
 * Excel, lui, est fait pour être lu : valeurs mises en forme, tables techniques absentes).
 * Ordre = ordre de restauration (une table après celles qu'elle référence).
 */
export const BACKUP_TABLES = [
  users, packageTypes, atelierSettings, emailTemplates, residents, packages, attendances,
  notes, emailLogs, actionTokens, undoActions, wixPaymentLinks, kioskEvents,
] as const;

export type JsonBackup = {
  format: "gestion-atelier-backup";
  version: 1;
  createdAt: string;
  schemaVersion: string | null; // dernière migration appliquée à la base sauvegardée
  tables: Record<string, Record<string, unknown>[]>;
};

type Db = MySql2Database<Record<string, never>>;

async function latestMigrationHash(database: Db): Promise<string | null> {
  const [rows] = (await database.execute(
    sql`SELECT hash FROM __drizzle_migrations ORDER BY created_at DESC, id DESC LIMIT 1`
  )) as unknown as [{ hash: string }[]];
  return rows[0]?.hash ?? null;
}

export async function generateJsonBackup(database?: Db): Promise<JsonBackup> {
  const db = database ?? ((await getDb()) as unknown as Db | null);
  if (!db) throw new Error("Database not available");
  const tables: JsonBackup["tables"] = {};
  for (const table of BACKUP_TABLES) {
    tables[getTableName(table)] = (await db.select().from(table)) as Record<string, unknown>[];
  }
  return {
    format: "gestion-atelier-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    schemaVersion: await latestMigrationHash(db),
    tables,
  };
}

export class RestoreRefused extends Error {}

/**
 * Restaure une sauvegarde dans une base VIDE dont les tables ont été créées par les
 * migrations (même version que la base sauvegardée). Renvoie le nombre de lignes par table.
 */
export async function restoreJsonBackup(target: Db, backup: JsonBackup): Promise<Record<string, number>> {
  if (backup.format !== "gestion-atelier-backup" || backup.version !== 1) {
    throw new RestoreRefused("Ce fichier n'est pas une sauvegarde de gestion-atelier.");
  }
  const targetVersion = await latestMigrationHash(target).catch(() => null);
  if (!targetVersion) {
    throw new RestoreRefused("La base cible n'a pas de tables : lancer d'abord les migrations (drizzle-kit migrate) sur cette base.");
  }
  if (backup.schemaVersion && targetVersion !== backup.schemaVersion) {
    throw new RestoreRefused("La base cible n'est pas à la même version que la sauvegarde : appliquer les mêmes migrations.");
  }
  for (const table of BACKUP_TABLES) {
    const [{ n }] = await target.select({ n: count() }).from(table);
    if (n > 0) throw new RestoreRefused(`La base cible n'est pas vide (table ${getTableName(table)}) : restauration refusée.`);
  }

  const restored: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const name = getTableName(table);
    const rows = backup.tables[name] ?? [];
    // Les dates ont été écrites en texte dans le JSON : les remettre en dates.
    const dateKeys = Object.entries(getTableColumns(table))
      .filter(([, col]) => /Timestamp|DateTime|Date$/.test(col.columnType))
      .map(([key]) => key);
    const typed = rows.map((row) => {
      const copy: Record<string, unknown> = { ...row };
      for (const key of dateKeys) if (typeof copy[key] === "string") copy[key] = new Date(copy[key] as string);
      return copy;
    });
    for (let i = 0; i < typed.length; i += 200) {
      await target.insert(table).values(typed.slice(i, i + 200) as never);
    }
    restored[name] = typed.length;
  }
  return restored;
}
