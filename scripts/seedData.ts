import { drizzle } from "drizzle-orm/mysql2";
import { residents, packages } from "../drizzle/schema";
import { randomBytes } from "crypto";

const db = drizzle(process.env.DATABASE_URL!);

function generateQrCode(): string {
  return randomBytes(16).toString('hex');
}

function calculateEndDate(startDate: Date, packageType: string): Date {
  const end = new Date(startDate);
  switch (packageType) {
    case "15h_8w":
    case "30h_8w":
      end.setDate(end.getDate() + 56); // 8 semaines
      break;
    case "30h_4w":
      end.setDate(end.getDate() + 28); // 4 semaines
      break;
  }
  return end;
}

function getTotalHours(packageType: string): number {
  switch (packageType) {
    case "15h_8w":
      return 15 * 60; // en minutes
    case "30h_8w":
    case "30h_4w":
      return 30 * 60; // en minutes
    default:
      return 0;
  }
}

async function seedData() {
  console.log("Génération des données de test...");
  
  const baseUrl = process.env.BASE_URL || "https://3000-ixu8t3f4q3r023upl3b9y-f47e5d6c.manusvm.computer";

  // Créer 5 résidents de test
  const testResidents = [
    {
      firstName: "Marie",
      lastName: "Dupont",
      email: "marie.dupont@example.com",
      phone: "0612345678",
      qrCode: generateQrCode(),
      isActive: true,
    },
    {
      firstName: "Jean",
      lastName: "Martin",
      email: "jean.martin@example.com",
      phone: "0623456789",
      qrCode: generateQrCode(),
      isActive: true,
    },
    {
      firstName: "Sophie",
      lastName: "Bernard",
      email: "sophie.bernard@example.com",
      phone: "0634567890",
      qrCode: generateQrCode(),
      isActive: true,
    },
    {
      firstName: "Pierre",
      lastName: "Dubois",
      email: "pierre.dubois@example.com",
      phone: "0645678901",
      qrCode: generateQrCode(),
      isActive: true,
    },
    {
      firstName: "Claire",
      lastName: "Leroy",
      email: "claire.leroy@example.com",
      phone: "0656789012",
      qrCode: generateQrCode(),
      isActive: true,
    },
  ];

  for (const resident of testResidents) {
    await db.insert(residents).values(resident);
    console.log(`✓ Résident créé: ${resident.firstName} ${resident.lastName}`);
  }

  // Récupérer les IDs des résidents créés
  const createdResidents = await db.select().from(residents);

  // Créer des forfaits pour chaque résident
  const packageTypes = ["15h_8w", "30h_8w", "30h_4w"] as const;
  
  for (let i = 0; i < createdResidents.length; i++) {
    const resident = createdResidents[i];
    const packageType = packageTypes[i % packageTypes.length];
    
    // Créer un forfait actif avec différentes dates de début
    let startDate = new Date();
    
    // Pour tester les alertes:
    // - Résident 1: forfait expirant dans 5 jours
    // - Résident 2: forfait expirant dans 10 jours
    // - Résident 3: forfait expirant dans 20 jours
    // - Résident 4: forfait déjà expiré
    // - Résident 5: forfait avec heures presque épuisées
    
    if (i === 0) {
      // Forfait expirant dans 5 jours
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 51); // Commencé il y a 51 jours (expire dans 5 jours pour un forfait 8 semaines)
    } else if (i === 1) {
      // Forfait expirant dans 10 jours
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 46);
    } else if (i === 2) {
      // Forfait normal (expire dans 20 jours)
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 36);
    } else if (i === 3) {
      // Forfait expiré
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 60);
    } else {
      // Forfait récent avec heures presque épuisées
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    }

    const endDate = calculateEndDate(startDate, packageType);
    const totalHours = getTotalHours(packageType);
    
    // Simuler des heures utilisées
    let usedHours = 0;
    if (i === 4) {
      // Presque toutes les heures utilisées
      usedHours = totalHours - 60; // Il reste 1h
    } else {
      // Utilisation normale (30-50% des heures)
      usedHours = Math.floor(totalHours * (0.3 + Math.random() * 0.2));
    }

    await db.insert(packages).values({
      residentId: resident.id,
      packageType,
      totalHours,
      usedHours,
      startDate,
      endDate,
      isActive: true,
      reminderSent: false,
      expirationEmailSent: false,
    });

    console.log(`✓ Forfait créé pour ${resident.firstName}: ${packageType}`);
  }

  console.log("\n✅ Données de test générées avec succès!");
  console.log("\nRésumé:");
  console.log("- 5 résidents créés");
  console.log("- 5 forfaits créés (avec différents statuts pour tester les alertes)");
  console.log("\nVous pouvez maintenant tester l'application!");
}

seedData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erreur lors de la génération des données:", error);
    process.exit(1);
  });
