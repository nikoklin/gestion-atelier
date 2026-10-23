import ExcelJS from "exceljs";
import { getDb } from "./db";
import { atelierSettings, attendances, emailTemplates, notes, packages, packageTypes, residents } from "../drizzle/schema";
import { desc } from "drizzle-orm";
import { formatParisDate, formatParisDateTime } from "./_core/timezone";

/**
 * Génère le fichier Excel de sauvegarde (aussi téléchargeable depuis Paramètres) :
 * de quoi reconstruire l'atelier si la base était perdue — résidents, pointages,
 * forfaits, notes, types de forfaits, réglages et modèles d'e-mails.
 * Non exportée : la signature (image) des résidents.
 * @returns Buffer du fichier Excel
 */
export async function generateExcelExport(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestion d'Atelier";
  workbook.created = new Date();
  workbook.modified = new Date();

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [allResidents, allAttendances, allPackages, allNotes, allPackageTypes, settingsRows, templates] = await Promise.all([
    db.select().from(residents),
    db.select().from(attendances).orderBy(desc(attendances.checkInTime)),
    db.select().from(packages),
    db.select().from(notes).orderBy(desc(notes.createdAt)),
    db.select().from(packageTypes).orderBy(packageTypes.sortOrder, packageTypes.id),
    db.select().from(atelierSettings).limit(1),
    db.select().from(emailTemplates),
  ]);

  const addSheet = (name: string, columns: Partial<ExcelJS.Column>[], rows: Record<string, unknown>[]) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    rows.forEach((row) => sheet.addRow(row));
  };

  const residentName = new Map(allResidents.map((r) => [r.id, `${r.firstName} ${r.lastName}`]));
  const byResidentName = (a: { residentId: number }, b: { residentId: number }) =>
    (residentName.get(a.residentId) ?? "").localeCompare(residentName.get(b.residentId) ?? "", "fr");

  // Nom du forfait : type configurable (custom_{id}) ou ancien code
  const legacyTypes: Record<string, string> = {
    "15h_8w": "15h / 8 semaines",
    "30h_8w": "30h / 8 semaines",
    "30h_4w": "30h / 4 semaines",
    "180h_6m": "180h / 6 mois",
  };
  const typeLabel = new Map(allPackageTypes.map((t) => [`custom_${t.id}`, t.label]));
  const packageLabel = (type: string) => typeLabel.get(type) ?? legacyTypes[type] ?? type;
  const hours = (minutes: number) => (minutes / 60).toFixed(2);
  const yesNo = (value: boolean | null | undefined) => (value ? "Oui" : "Non");

  // Feuille 1 : Résidents (archivés compris)
  addSheet("Résidents", [
    { header: "ID", key: "id", width: 10 },
    { header: "Prénom", key: "firstName", width: 18 },
    { header: "Nom", key: "lastName", width: 18 },
    { header: "E-mail", key: "email", width: 30 },
    { header: "Téléphone", key: "phone", width: 16 },
    { header: "N° d'étagère", key: "shelfNumber", width: 12 },
    { header: "Statut", key: "status", width: 12 },
    { header: "Hors forfait en attente (min)", key: "outOfPackageMinutes", width: 26 },
    { header: "Inscrit le", key: "createdAt", width: 20 },
  ], [...allResidents]
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"))
    .map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone ?? "",
      shelfNumber: r.shelfNumber ?? "",
      status: r.isDeleted ? "Archivé" : r.isActive ? "Actif" : "Inactif",
      outOfPackageMinutes: r.outOfPackageMinutes,
      createdAt: formatParisDateTime(r.createdAt),
    })));

  // Feuille 2 : Pointages (y compris les ajouts/retraits d'heures de l'atelier)
  const attendanceType: Record<string, string> = {
    normal: "Pointage",
    adjustment_add: "Ajout atelier",
    adjustment_subtract: "Retrait atelier",
  };
  addSheet("Pointages", [
    { header: "ID", key: "id", width: 10 },
    { header: "ID résident", key: "residentId", width: 12 },
    { header: "Résident", key: "resident", width: 25 },
    { header: "Type", key: "type", width: 16 },
    { header: "Date d'arrivée", key: "checkInTime", width: 20 },
    { header: "Date de départ", key: "checkOutTime", width: 20 },
    { header: "Durée (minutes)", key: "durationMinutes", width: 16 },
    { header: "ID forfait", key: "packageId", width: 12 },
    { header: "Note", key: "note", width: 30 },
  ], allAttendances.map((a) => ({
    id: a.id,
    residentId: a.residentId,
    resident: residentName.get(a.residentId) ?? "Inconnu",
    type: attendanceType[a.attendanceType] ?? a.attendanceType,
    checkInTime: formatParisDateTime(a.checkInTime),
    checkOutTime: a.checkOutTime ? formatParisDateTime(a.checkOutTime) : "En cours",
    durationMinutes: a.durationMinutes ?? 0,
    packageId: a.packageId ?? "",
    note: a.note ?? "",
  })));

  // Feuille 3 : Forfaits
  addSheet("Forfaits", [
    { header: "ID", key: "id", width: 10 },
    { header: "ID résident", key: "residentId", width: 12 },
    { header: "Résident", key: "resident", width: 25 },
    { header: "Forfait", key: "type", width: 20 },
    { header: "Heures totales", key: "totalHours", width: 15 },
    { header: "Heures utilisées", key: "usedHours", width: 16 },
    { header: "Heures restantes", key: "remainingHours", width: 16 },
    { header: "Heures hors forfait reportées", key: "deductedHours", width: 26 },
    { header: "Date de début", key: "startDate", width: 15 },
    { header: "Date de fin", key: "endDate", width: 15 },
    { header: "Statut", key: "status", width: 26 },
    { header: "Paiement Wix", key: "wixPaymentId", width: 38 },
  ], [...allPackages].sort(byResidentName).map((p) => ({
    id: p.id,
    residentId: p.residentId,
    resident: residentName.get(p.residentId) ?? "Inconnu",
    type: packageLabel(p.packageType),
    totalHours: hours(p.totalHours),
    usedHours: hours(p.usedHours),
    remainingHours: hours(p.totalHours - p.usedHours),
    deductedHours: hours(p.deductedMinutes ?? 0),
    startDate: formatParisDate(p.startDate),
    endDate: formatParisDate(p.endDate),
    status: p.status === "pending"
      ? (p.autoStart ? "En attente (démarrage auto)" : "En attente de validation")
      : p.isActive ? "En cours" : "Terminé",
    wixPaymentId: p.wixPaymentId ?? "",
  })));

  // Feuille 4 : Notes sur les résidents
  addSheet("Notes", [
    { header: "ID", key: "id", width: 10 },
    { header: "ID résident", key: "residentId", width: 12 },
    { header: "Résident", key: "resident", width: 25 },
    { header: "Note", key: "content", width: 60 },
    { header: "Auteur", key: "createdBy", width: 18 },
    { header: "Date", key: "createdAt", width: 20 },
  ], allNotes.map((n) => ({
    id: n.id,
    residentId: n.residentId,
    resident: residentName.get(n.residentId) ?? "Inconnu",
    content: n.content,
    createdBy: n.createdBy,
    createdAt: formatParisDateTime(n.createdAt),
  })));

  // Feuille 5 : Types de forfaits
  addSheet("Types de forfaits", [
    { header: "ID", key: "id", width: 10 },
    { header: "Code", key: "code", width: 14 },
    { header: "Forfait", key: "label", width: 22 },
    { header: "Heures", key: "hours", width: 10 },
    { header: "Durée (semaines)", key: "durationWeeks", width: 16 },
    { header: "Prix (€)", key: "price", width: 10 },
    { header: "En vente", key: "isActive", width: 10 },
    { header: "Ordre", key: "sortOrder", width: 8 },
  ], allPackageTypes.map((t) => ({
    id: t.id,
    code: `custom_${t.id}`,
    label: t.label,
    hours: hours(t.totalMinutes),
    durationWeeks: t.durationWeeks,
    price: t.price,
    isActive: yesNo(t.isActive),
    sortOrder: t.sortOrder,
  })));

  // Feuille 6 : Réglages de l'atelier
  const s = settingsRows[0];
  const proposedTypes = (() => {
    if (!s?.paymentLinkPackageTypeIds) return "Tous les forfaits en vente";
    try {
      return (JSON.parse(s.paymentLinkPackageTypeIds) as number[]).map((id) => packageLabel(`custom_${id}`)).join(", ");
    } catch {
      return s.paymentLinkPackageTypeIds;
    }
  })();
  const fallbackLinks = (() => {
    if (!s?.paymentLinks) return "";
    try {
      return (JSON.parse(s.paymentLinks).links as { label: string; url: string }[]).map((l) => `${l.label} : ${l.url}`).join("\n");
    } catch {
      return s.paymentLinks;
    }
  })();
  addSheet("Réglages", [
    { header: "Réglage", key: "name", width: 45 },
    { header: "Valeur", key: "value", width: 70 },
  ], s ? [
    { name: "Nombre d'étagères", value: s.totalShelves },
    { name: "Rappel avant la fin du forfait (jours)", value: s.reminderDaysBeforeExpiry },
    { name: "Heure d'envoi des rappels", value: `${s.reminderSendHour}h` },
    { name: "Heure de clôture des pointages oubliés", value: `${s.missedCheckoutCutoffHour}h` },
    { name: "Guide des bonnes pratiques à l'inscription", value: yesNo(s.guideEmailEnabled) },
    { name: "Forfait payé sur Wix actif immédiatement", value: yesNo(s.wixAutoActivatePackage) },
    { name: "Liens de paiement automatiques", value: yesNo(s.autoPaymentLinksEnabled) },
    { name: "Validité des liens de paiement (jours)", value: s.paymentLinkValidityDays },
    { name: "Forfaits proposés dans les e-mails", value: proposedTypes },
    { name: "Liens de paiement de secours", value: fallbackLinks },
  ] : []);

  // Feuille 7 : Modèles d'e-mails personnalisés
  const templateName: Record<string, string> = {
    reminder: "Rappel avant la fin",
    expiration: "Forfait terminé",
    session_summary: "Résumé de séance",
  };
  addSheet("Modèles d'e-mails", [
    { header: "E-mail", key: "type", width: 22 },
    { header: "Objet", key: "subject", width: 45 },
    { header: "Contenu", key: "body", width: 100 },
  ], templates.map((t) => ({
    type: templateName[t.templateType] ?? t.templateType,
    subject: t.subject,
    body: t.body,
  })));

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
