import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { residents, packages } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const enkaResidents = await db.select().from(residents).where(eq(residents.firstName, "enka"));
console.log("Résidents enka:", JSON.stringify(enkaResidents, null, 2));

if (enkaResidents.length > 0) {
  const enkaPackages = await db.select().from(packages).where(eq(packages.residentId, enkaResidents[0].id));
  console.log("\nForfaits de enka:", JSON.stringify(enkaPackages, null, 2));
}
