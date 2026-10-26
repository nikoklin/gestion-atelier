import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Même règle que server/db.ts : le paramètre `?ssl={...}` de l'URL est ignoré
// (le shell en retire les guillemets et mysql2 le prend alors pour un nom de
// profil inconnu) ; TLS est activé d'office pour TiDB Cloud.
const url = new URL(connectionString);
const needsSsl = /tidbcloud\.com/i.test(url.hostname) || process.env.DB_SSL === "1";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: needsSsl ? { minVersion: "TLSv1.2" } : undefined,
  },
});
