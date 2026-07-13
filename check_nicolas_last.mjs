import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc } from "drizzle-orm";
import { packages, residents } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const result = await db
  .select()
  .from(packages)
  .innerJoin(residents, eq(packages.residentId, residents.id))
  .where(eq(residents.id, 120003))
  .orderBy(desc(packages.createdAt))
  .limit(1);

console.log("Dernier forfait de Nicolas Klein:");
if (result.length > 0) {
  const pkg = result[0].packages;
  console.log(`ID: ${pkg.id}`);
  console.log(`Total: ${pkg.totalHours} minutes`);
  console.log(`Utilisé: ${pkg.usedHours} minutes`);
  console.log(`Date début: ${pkg.startDate}`);
  console.log(`Date fin: ${pkg.endDate}`);
  console.log(`Actif: ${pkg.isActive}`);
} else {
  console.log("Aucun forfait trouvé");
}
