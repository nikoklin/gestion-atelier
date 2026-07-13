import { getOutOfPackageHoursByResidentId } from './db';

async function test() {
  const residentId = 120009;
  
  console.log(`[TEST] Récupération des heures hors forfait pour enka enka (ID ${residentId})...`);
  
  const totalOutOfPackageMinutes = await getOutOfPackageHoursByResidentId(residentId);
  
  console.log(`[TEST] Résultat: ${totalOutOfPackageMinutes} minutes hors forfait`);
  
  if (totalOutOfPackageMinutes > 0) {
    console.log(`[TEST] ✅ SUCCESS: ${totalOutOfPackageMinutes} minutes détectées`);
  } else {
    console.log(`[TEST] ❌ FAIL: Aucune heure hors forfait détectée`);
  }
  
  process.exit(0);
}

test().catch(error => {
  console.error('[TEST] ERROR:', error);
  process.exit(1);
});
