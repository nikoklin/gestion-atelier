import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import { attendances } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const result = await db
  .select()
  .from(attendances)
  .where(and(eq(attendances.residentId, 30001), eq(attendances.packageId, 810002)))
  .orderBy(attendances.checkInTime);

console.log(`Pointages de Nicolas Klein (forfait 810002):`);
console.log(`Total: ${result.length} pointages`);

let cumulativeMinutes = 0;
result.forEach((att, index) => {
  const duration = att.durationMinutes || 0;
  cumulativeMinutes += duration;
  console.log(`\n${index + 1}. ${att.checkInTime} → ${att.checkOutTime}`);
  console.log(`   Durée: ${duration} min`);
  console.log(`   Cumulé AVANT: ${cumulativeMinutes - duration} min`);
  console.log(`   Cumulé APRÈS: ${cumulativeMinutes} min`);
  console.log(`   Hors forfait: ${cumulativeMinutes > 900 ? 'OUI' : 'NON'}`);
});

console.log(`\nTotal utilisé: ${cumulativeMinutes} minutes (${(cumulativeMinutes / 60).toFixed(2)}h)`);
console.log(`Total forfait: 900 minutes (15h)`);
console.log(`Heures hors forfait: ${Math.max(0, cumulativeMinutes - 900)} minutes`);
