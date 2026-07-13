import { getDb } from "./server/db";
import { checkMissedCheckouts } from "./server/scheduler";
import { checkIns, residents } from "./drizzle/schema";
import { isNull, eq } from "drizzle-orm";

async function testMissedCheckouts() {
  console.log("=== Test de détection des pointages oubliés ===\n");
  
  const db = await getDb();
  if (!db) {
    console.error("Erreur: impossible de se connecter à la base de données");
    process.exit(1);
  }
  
  // Afficher les pointages en cours
  const openCheckIns = await db.select().from(checkIns).where(isNull(checkIns.checkOut));
  
  console.log(`Pointages en cours (sans heure de départ): ${openCheckIns.length}`);
  for (const checkIn of openCheckIns) {
    console.log(`  - Résident ID ${checkIn.residentId}, arrivée: ${checkIn.checkIn}`);
  }
  
  console.log("\n=== Exécution de la vérification des pointages oubliés ===\n");
  
  // Exécuter la fonction de vérification
  await checkMissedCheckouts();
  
  console.log("\n=== Vérification terminée ===");
  
  // Vérifier les flags hasMissedCheckout
  const residentsWithFlag = await db.select().from(residents).where(eq(residents.hasMissedCheckout, true));
  
  console.log(`\nRésidents avec flag hasMissedCheckout: ${residentsWithFlag.length}`);
  for (const resident of residentsWithFlag) {
    console.log(`  - ${resident.firstName} ${resident.lastName} (ID ${resident.id})`);
  }
  
  process.exit(0);
}

testMissedCheckouts().catch(console.error);
