import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc } from "drizzle-orm";
import { attendances, packages } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

// Récupérer le dernier pointage de Nicolas Klein
const results = await db
  .select()
  .from(attendances)
  .where(eq(attendances.residentId, 30001))
  .orderBy(desc(attendances.checkOutTime))
  .limit(1);

if (results.length === 0) {
  console.log("Aucun pointage trouvé");
  process.exit(1);
}

const attendance = results[0];

console.log(`Pointage trouvé: ${attendance.id}`);
console.log(`Durée: ${attendance.durationMinutes} minutes`);
console.log(`PackageId: ${attendance.packageId}`);

// Récupérer le forfait
const pkgResults = await db
  .select()
  .from(packages)
  .where(eq(packages.id, attendance.packageId));

if (pkgResults.length === 0) {
  console.log("Forfait introuvable");
  process.exit(1);
}

const pkg = pkgResults[0];

console.log(`\nForfait AVANT:`);
console.log(`- Total: ${pkg.totalHours} minutes`);
console.log(`- Utilisé: ${pkg.usedHours} minutes`);
console.log(`- Restant: ${pkg.totalHours - pkg.usedHours} minutes`);

// Simuler la logique de checkout
const durationMinutes = attendance.durationMinutes || 0;
const now = new Date();
const isExpiredByDate = pkg.endDate && new Date(pkg.endDate) < now;
const isExhaustedByHours = pkg.usedHours >= pkg.totalHours;

console.log(`\nVérifications:`);
console.log(`- Expiré par date: ${isExpiredByDate}`);
console.log(`- Épuisé par heures: ${isExhaustedByHours}`);

if (!isExpiredByDate && !isExhaustedByHours) {
  const newUsedHours = Math.min(pkg.usedHours + durationMinutes, pkg.totalHours);
  console.log(`\nMise à jour:`);
  console.log(`- Ancien usedHours: ${pkg.usedHours}`);
  console.log(`- Nouveau usedHours: ${newUsedHours} (plafonné à ${pkg.totalHours})`);
  
  await db.update(packages)
    .set({ usedHours: newUsedHours })
    .where(eq(packages.id, pkg.id));
  
  console.log(`✅ Forfait mis à jour !`);
} else {
  console.log(`\n❌ Forfait expiré ou épuisé, pas de mise à jour`);
}

// Afficher le forfait APRÈS
const pkgAfterResults = await db
  .select()
  .from(packages)
  .where(eq(packages.id, attendance.packageId));

const pkgAfter = pkgAfterResults[0];

console.log(`\nForfait APRÈS:`);
console.log(`- Total: ${pkgAfter.totalHours} minutes`);
console.log(`- Utilisé: ${pkgAfter.usedHours} minutes`);
console.log(`- Restant: ${pkgAfter.totalHours - pkgAfter.usedHours} minutes`);

const outOfPackageMinutes = Math.max(0, (pkg.usedHours + durationMinutes) - pkg.totalHours);
console.log(`- Heures hors forfait: ${outOfPackageMinutes} minutes`);
