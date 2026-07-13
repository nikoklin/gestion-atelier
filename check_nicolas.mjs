import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import { residents, packages } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const nicolasResidents = await db.select().from(residents).where(
  and(
    eq(residents.firstName, "Nicolas"),
    eq(residents.lastName, "Klein")
  )
);

console.log("Résidents Nicolas Klein:", JSON.stringify(nicolasResidents, null, 2));

if (nicolasResidents.length > 0) {
  const nicolasPackages = await db.select().from(packages).where(eq(packages.residentId, nicolasResidents[0].id));
  console.log("\nForfaits de Nicolas Klein:", JSON.stringify(nicolasPackages, null, 2));
}
