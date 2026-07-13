import ExcelJS from "exceljs";
import { getDb } from "./db";
import { attendances, packages, residents } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

/**
 * Génère un fichier Excel contenant l'historique des pointages et des forfaits
 * @returns Buffer du fichier Excel
 */
export async function generateExcelExport(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Métadonnées du fichier
  workbook.creator = "Gestion d'Atelier";
  workbook.created = new Date();
  workbook.modified = new Date();

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Feuille 1: Historique des Pointages
  const attendancesSheet = workbook.addWorksheet("Pointages");
  
  // En-têtes pour les pointages
  attendancesSheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Résident", key: "resident", width: 25 },
    { header: "Date d'arrivée", key: "checkInTime", width: 20 },
    { header: "Date de départ", key: "checkOutTime", width: 20 },
    { header: "Durée (minutes)", key: "durationMinutes", width: 18 },
    { header: "Statut", key: "status", width: 12 },
  ];

  // Style des en-têtes
  attendancesSheet.getRow(1).font = { bold: true };
  attendancesSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Récupérer tous les pointages avec les informations des résidents
  const allAttendances = await db
    .select({
      id: attendances.id,
      residentId: attendances.residentId,
      checkInTime: attendances.checkInTime,
      checkOutTime: attendances.checkOutTime,
      durationMinutes: attendances.durationMinutes,
      residentFirstName: residents.firstName,
      residentLastName: residents.lastName,
    })
    .from(attendances)
    .leftJoin(residents, eq(residents.id, attendances.residentId))
    .orderBy(desc(attendances.checkInTime));

  // Ajouter les données des pointages
  allAttendances.forEach((attendance) => {
    attendancesSheet.addRow({
      id: attendance.id,
      resident: `${attendance.residentFirstName} ${attendance.residentLastName}`,
      checkInTime: attendance.checkInTime
        ? new Date(attendance.checkInTime).toLocaleString("fr-FR")
        : "",
      checkOutTime: attendance.checkOutTime
        ? new Date(attendance.checkOutTime).toLocaleString("fr-FR")
        : "En cours",
      durationMinutes: attendance.durationMinutes || 0,
      status: attendance.checkOutTime ? "Terminé" : "En cours",
    });
  });

  // Feuille 2: Historique des Forfaits
  const packagesSheet = workbook.addWorksheet("Forfaits");
  
  // En-têtes pour les forfaits
  packagesSheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Résident", key: "resident", width: 25 },
    { header: "Type", key: "type", width: 20 },
    { header: "Heures totales", key: "totalHours", width: 15 },
    { header: "Heures utilisées", key: "usedHours", width: 18 },
    { header: "Heures restantes", key: "remainingHours", width: 18 },
    { header: "Date de début", key: "startDate", width: 15 },
    { header: "Date de fin", key: "endDate", width: 15 },
    { header: "Actif", key: "isActive", width: 10 },
  ];

  // Style des en-têtes
  packagesSheet.getRow(1).font = { bold: true };
  packagesSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Récupérer tous les forfaits avec les informations des résidents
  const allPackages = await db
    .select({
      id: packages.id,
      residentId: packages.residentId,
      packageType: packages.packageType,
      totalHours: packages.totalHours,
      usedHours: packages.usedHours,
      startDate: packages.startDate,
      endDate: packages.endDate,
      isActive: packages.isActive,
      residentFirstName: residents.firstName,
      residentLastName: residents.lastName,
    })
    .from(packages)
    .leftJoin(residents, eq(residents.id, packages.residentId));

  // Trier les forfaits par ordre alphabétique des résidents (nom puis prénom)
  allPackages.sort((a, b) => {
    const lastNameCompare = (a.residentLastName || "").localeCompare(b.residentLastName || "", "fr");
    if (lastNameCompare !== 0) return lastNameCompare;
    return (a.residentFirstName || "").localeCompare(b.residentFirstName || "", "fr");
  });

  // Fonction pour formater le type de forfait
  const formatPackageType = (type: string): string => {
    const types: Record<string, string> = {
      "15h_8w": "15h / 8 semaines",
      "30h_8w": "30h / 8 semaines",
      "30h_4w": "30h / 4 semaines",
      "180h_6m": "180h / 6 mois",
    };
    return types[type] || type;
  };

  // Ajouter les données des forfaits
  allPackages.forEach((pkg) => {
    const totalHours = pkg.totalHours / 60; // Convertir minutes en heures
    const usedHours = pkg.usedHours / 60;
    const remainingHours = totalHours - usedHours;

    packagesSheet.addRow({
      id: pkg.id,
      resident: `${pkg.residentFirstName} ${pkg.residentLastName}`,
      type: formatPackageType(pkg.packageType),
      totalHours: totalHours.toFixed(2),
      usedHours: usedHours.toFixed(2),
      remainingHours: remainingHours.toFixed(2),
      startDate: pkg.startDate
        ? new Date(pkg.startDate).toLocaleDateString("fr-FR")
        : "",
      endDate: pkg.endDate
        ? new Date(pkg.endDate).toLocaleDateString("fr-FR")
        : "",
      isActive: pkg.isActive ? "Oui" : "Non",
    });
  });

  // Générer le buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Fonctions d'export CSV pour l'envoi automatique par e-mail
 */

interface CSVExportResult {
  filename: string;
  content: string;
}

/**
 * Convertit un tableau d'objets en format CSV
 */
function arrayToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) return headers.join(",") + "\n";

  const csvRows = [];
  
  // En-têtes
  csvRows.push(headers.join(","));
  
  // Données
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      
      // Gestion des valeurs null/undefined
      if (value === null || value === undefined) return "";
      
      // Gestion des dates
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      // Échappement des guillemets et virgules
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    
    csvRows.push(values.join(","));
  }
  
  return csvRows.join("\n");
}

/**
 * Exporte toutes les données en format CSV pour l'envoi par e-mail
 */
export async function exportAllDataAsCSV(): Promise<CSVExportResult[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results: CSVExportResult[] = [];
  const dateStr = new Date().toISOString().split('T')[0];

  // Export Résidents
  const residentsData = await db.select().from(residents);
  results.push({
    filename: `residents_${dateStr}.csv`,
    content: arrayToCSV(residentsData, ["id", "firstName", "lastName", "email", "phone", "isActive", "createdAt", "updatedAt"])
  });

  // Créer un Map pour associer residentId au nom complet
  const residentMap = new Map<number, string>();
  for (const resident of residentsData) {
    residentMap.set(resident.id, `${resident.firstName} ${resident.lastName}`);
  }

  // Export Forfaits avec nom du résident
  const packagesData = await db.select().from(packages);
  const packagesWithNames = packagesData.map(pkg => ({
    ...pkg,
    residentName: residentMap.get(pkg.residentId) || 'Inconnu'
  }));
  // Trier par nom de résident (ordre alphabétique)
  packagesWithNames.sort((a, b) => a.residentName.localeCompare(b.residentName));
  results.push({
    filename: `packages_${dateStr}.csv`,
    content: arrayToCSV(packagesWithNames, ["id", "residentName", "packageType", "totalHours", "usedHours", "startDate", "endDate", "isActive", "reminderSent", "expirationEmailSent", "createdAt"])
  });

  // Export Pointages avec nom du résident
  const attendancesData = await db.select().from(attendances);
  const attendancesWithNames = attendancesData.map(att => ({
    ...att,
    residentName: residentMap.get(att.residentId) || 'Inconnu'
  }));
  results.push({
    filename: `attendances_${dateStr}.csv`,
    content: arrayToCSV(attendancesWithNames, ["id", "residentName", "packageId", "checkInTime", "checkOutTime", "durationMinutes", "createdAt"])
  });

  // Export Logs E-mails avec nom du résident
  const { emailLogs } = await import("../drizzle/schema");
  const emailLogsData = await db.select().from(emailLogs);
  const emailLogsWithNames = emailLogsData.map(log => ({
    ...log,
    residentName: residentMap.get(log.residentId) || 'Inconnu'
  }));
  results.push({
    filename: `email_logs_${dateStr}.csv`,
    content: arrayToCSV(emailLogsWithNames, ["id", "residentName", "packageId", "emailType", "sentAt", "success", "errorMessage"])
  });

  return results;
}
