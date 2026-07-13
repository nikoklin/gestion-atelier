import { getDb } from './db';
import { packages } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function test() {
  const residentId = 120009;
  
  console.log(`[TEST] Récupération des forfaits pour le résident ${residentId}...`);
  
  const db = await getDb();
  if (!db) {
    console.error('[TEST] Database not available');
    process.exit(1);
  }
  
  const allPackages = await db
    .select()
    .from(packages)
    .where(eq(packages.residentId, residentId));
  
  console.log(`[TEST] Nombre de forfaits trouvés: ${allPackages.length}`);
  
  let totalOutOfPackageMinutes = 0;
  
  for (const pkg of allPackages) {
    console.log(`[TEST] Forfait ${pkg.id}:`);
    console.log(`  - totalHours: ${pkg.totalHours}`);
    console.log(`  - usedHours: ${pkg.usedHours}`);
    console.log(`  - deductedMinutes: ${pkg.deductedMinutes}`);
    console.log(`  - isActive: ${pkg.isActive}`);
    
    if (pkg.usedHours > pkg.totalHours) {
      const outOfPackageHours = pkg.usedHours - pkg.totalHours;
      const outOfPackageMinutes = outOfPackageHours * 60;
      const alreadyDeducted = pkg.deductedMinutes || 0;
      const remainingOutOfPackage = Math.max(0, outOfPackageMinutes - alreadyDeducted);
      
      console.log(`  - outOfPackageHours: ${outOfPackageHours}`);
      console.log(`  - outOfPackageMinutes: ${outOfPackageMinutes}`);
      console.log(`  - alreadyDeducted: ${alreadyDeducted}`);
      console.log(`  - remainingOutOfPackage: ${remainingOutOfPackage}`);
      
      totalOutOfPackageMinutes += remainingOutOfPackage;
    } else {
      console.log(`  - Pas de dépassement`);
    }
  }
  
  console.log(`[TEST] Total: ${totalOutOfPackageMinutes} minutes hors forfait`);
  
  if (totalOutOfPackageMinutes > 0) {
    console.log(`[TEST] ✅ SUCCESS`);
  } else {
    console.log(`[TEST] ❌ FAIL`);
  }
  
  process.exit(0);
}

test().catch(error => {
  console.error('[TEST] ERROR:', error);
  process.exit(1);
});
