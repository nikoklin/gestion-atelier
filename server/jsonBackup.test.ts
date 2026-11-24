/**
 * Sauvegarde JSON restaurable : contient toutes les tables du schéma, et la
 * restauration refuse une base qui n'est pas vide (sans jamais rien y écrire).
 * Lecture seule sur la vraie base ; la base cible est simulée.
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";
import { is, getTableName } from "drizzle-orm";
import { MySqlTable } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema";
import { BACKUP_TABLES, generateJsonBackup, restoreJsonBackup, RestoreRefused } from "./jsonBackup";

describe("Sauvegarde JSON", () => {
  it("contient toutes les tables du schéma (une nouvelle table ne peut pas être oubliée)", () => {
    const schemaTables = Object.values(schema).filter((v) => is(v, MySqlTable)).map((t) => getTableName(t as MySqlTable)).sort();
    expect(BACKUP_TABLES.map((t) => getTableName(t)).sort()).toEqual(schemaTables);
  });

  it.skipIf(!process.env.DATABASE_URL)("lit toutes les tables de la vraie base, avec la version du schéma", async () => {
    const backup = await generateJsonBackup();
    expect(Object.keys(backup.tables)).toHaveLength(BACKUP_TABLES.length);
    expect(backup.tables.residents.length).toBeGreaterThan(0);
    expect(backup.schemaVersion).toBeTruthy();
    const roundTrip = JSON.parse(JSON.stringify(backup));
    expect(roundTrip.tables.attendances.length).toBe(backup.tables.attendances.length);
  });

  it("refuse une base cible non vide, sans rien y écrire", async () => {
    let inserts = 0;
    const target: any = {
      execute: async () => [[{ hash: "v1" }]],
      select: () => ({ from: async () => [{ n: 3 }] }),
      insert: () => { inserts++; return { values: async () => {} }; },
    };
    const backup = { format: "gestion-atelier-backup", version: 1, createdAt: "", schemaVersion: "v1", tables: {} } as any;
    await expect(restoreJsonBackup(target, backup)).rejects.toBeInstanceOf(RestoreRefused);
    expect(inserts).toBe(0);
  });

  it("refuse une base d'une autre version ou sans tables", async () => {
    const backup = { format: "gestion-atelier-backup", version: 1, createdAt: "", schemaVersion: "v2", tables: {} } as any;
    const old: any = { execute: async () => [[{ hash: "v1" }]], select: () => ({ from: async () => [{ n: 0 }] }) };
    await expect(restoreJsonBackup(old, backup)).rejects.toThrow(/même version/);
    const bare: any = { execute: async () => { throw new Error("Table '__drizzle_migrations' doesn't exist"); } };
    await expect(restoreJsonBackup(bare, backup)).rejects.toThrow(/migrations/);
  });
});
