import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc } from "drizzle-orm";
import { packages } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const result = await db
  .select()
  .from(packages)
  .where(eq(packages.residentId, 30001))
  .orderBy(desc(packages.createdAt))
  .limit(1);

console.log("Forfait de Nicolas Klein (30001):");
if (result.length > 0) {
  const pkg = result[0];
  console.log(`ID: ${pkg.id}`);
  console.log(`Total: ${pkg.totalHours} minutes (${(pkg.totalHours / 60).toFixed(2)}h)`);
  console.log(`Utilisé: ${pkg.usedHours} minutes (${(pkg.usedHours / 60).toFixed(2)}h)`);
  console.log(`Restant: ${pkg.totalHours - pkg.usedHours} minutes (${((pkg.totalHours - pkg.usedHours) / 60).toFixed(2)}h)`);
  console.log(`Date début: ${pkg.startDate}`);
  console.log(`Date fin: ${pkg.endDate}`);
  console.log(`Actif: ${pkg.isActive}`);
  console.log(`Épuisé: ${pkg.usedHours >= pkg.totalHours}`);
} else {
  console.log("Aucun forfait trouvé");
}
