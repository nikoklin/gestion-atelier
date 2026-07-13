import { getOutOfPackageHoursByResidentId } from './db';

async function test() {
  // ID d'enka enka
  const residentId = 120009;
  
  console.log(`[TEST] Récupération des heures hors forfait pour le résident ${residentId}...`);
  
  const outOfPackageMinutes = await getOutOfPackageHoursByResidentId(residentId);
  
  console.log(`[TEST] Résultat: ${outOfPackageMinutes} minutes hors forfait`);
  
  if (outOfPackageMinutes > 0) {
    console.log(`[TEST] ✅ SUCCESS: ${outOfPackageMinutes} minutes détectées`);
  } else {
    console.log(`[TEST] ❌ FAIL: Aucune heure hors forfait détectée`);
  }
  
  process.exit(0);
}

test().catch(error => {
  console.error('[TEST] ERROR:', error);
  process.exit(1);
});
