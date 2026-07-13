import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { residents, packages } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const enkaResident = await db.select().from(residents).where(eq(residents.firstName, "enka")).limit(1);
console.log("Résident enka:", enkaResident);

if (enkaResident.length > 0) {
  const enkaPackages = await db.select().from(packages).where(eq(packages.residentId, enkaResident[0].id));
  console.log("\nForfaits de enka:");
  enkaPackages.forEach(pkg => {
    const remainingMinutes = pkg.totalHours - pkg.usedHours;
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMins = remainingMinutes % 60;
    console.log(`\nID: ${pkg.id}`);
    console.log(`Type: ${pkg.packageType}`);
    console.log(`Total: ${pkg.totalHours} minutes (${Math.floor(pkg.totalHours/60)}h)`);
    console.log(`Utilisé: ${pkg.usedHours} minutes (${Math.floor(pkg.usedHours/60)}h${pkg.usedHours%60})`);
    console.log(`Restant: ${remainingMinutes} minutes (${remainingHours}h${remainingMins})`);
    console.log(`Date fin: ${pkg.endDate}`);
    console.log(`Actif: ${pkg.isActive}`);
  });
}
