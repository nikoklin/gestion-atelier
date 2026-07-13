import { drizzle } from 'drizzle-orm/mysql2';
import { packages } from './drizzle/schema.ts';
import { eq, desc } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

const result = await db.select().from(packages).where(eq(packages.residentId, 120001)).orderBy(desc(packages.id)).limit(1);

console.log('Forfait de enka enka:');
console.log('ID:', result[0].id);
console.log('totalHours:', result[0].totalHours, 'minutes');
console.log('usedHours:', result[0].usedHours, 'minutes');
console.log('Heures restantes:', Math.floor((result[0].totalHours - result[0].usedHours) / 60) + 'h' + String((result[0].totalHours - result[0].usedHours) % 60).padStart(2, '0'));
console.log('endDate:', result[0].endDate);
console.log('isActive:', result[0].isActive);

process.exit(0);
