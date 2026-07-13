import { int, mysqlEnum, mysqlTable, text, mediumtext, timestamp, varchar, datetime, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Résidents de l'atelier
 */
export const residents = mysqlTable("residents", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  pin: varchar("pin", { length: 4 }), // Code PIN à 4 chiffres pour l'authentification
  isActive: boolean("isActive").default(true).notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(), // Archivage au lieu de suppression définitive
  hasMissedCheckout: boolean("hasMissedCheckout").default(false).notNull(), // Indique si le résident a oublié de pointer en partant
  missedCheckoutAttendanceId: int("missedCheckoutAttendanceId"), // ID du pointage oublié pour accès direct
  outOfPackageMinutes: int("outOfPackageMinutes").default(0).notNull(), // Cumul des minutes hors forfait (dépassements)
  shelfNumber: varchar("shelfNumber", { length: 20 }), // Numéro d'étagère attribué au résident
  artistSignature: mediumtext("artistSignature"), // Signature artistique en base64 (image PNG)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Resident = typeof residents.$inferSelect;
export type InsertResident = typeof residents.$inferInsert;

/**
 * Forfaits des résidents
 * Types de forfaits disponibles:
 * - 15h valables 8 semaines
 * - 30h valables 8 semaines
 * - 30h valables 4 semaines
 * - 180h valables 6 mois
 */
export const packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),
  residentId: int("residentId")
    .notNull()
    .references(() => residents.id, { onDelete: 'cascade' }),
  packageType: varchar("packageType", { length: 50 }).notNull(), // "15h_8w", "30h_8w", "30h_4w", "180h_6m" ou "custom_{id}"
  totalHours: int("totalHours").notNull(), // ATTENTION: Malgré le nom, ce champ stocke des MINUTES (ex: 900 = 15h)
  usedHours: int("usedHours").default(0).notNull(), // ATTENTION: Malgré le nom, ce champ stocke des MINUTES
  deductedMinutes: int("deductedMinutes").default(0), // Minutes déduites lors de la création (heures hors forfait reportées)
  startDate: datetime("startDate").notNull(),
  endDate: datetime("endDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  status: mysqlEnum("status", ["active", "pending", "expired"]).default("active").notNull(), // pending = en attente de validation par Nicolas
  reminderSent: boolean("reminderSent").default(false).notNull(), // E-mail de rappel envoyé (7 jours avant)
  expirationEmailSent: boolean("expirationEmailSent").default(false).notNull(), // E-mail d'expiration envoyé
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  residentIdIdx: index("packages_residentId_idx").on(table.residentId),
  isActiveIdx: index("packages_isActive_idx").on(table.isActive),
}));

export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

/**
 * Pointages des résidents (arrivées et départs)
 */
export const attendances = mysqlTable("attendances", {
  id: int("id").autoincrement().primaryKey(),
  residentId: int("residentId")
    .notNull()
    .references(() => residents.id, { onDelete: 'cascade' }),
  packageId: int("packageId")
    .references(() => packages.id, { onDelete: 'cascade' }),
  checkInTime: datetime("checkInTime").notNull(),
  checkOutTime: datetime("checkOutTime"),
  durationMinutes: int("durationMinutes"), // Durée en minutes
  attendanceType: mysqlEnum("attendanceType", ["normal", "adjustment_add", "adjustment_subtract"]).default("normal").notNull(), // Type de pointage
  note: varchar("note", { length: 255 }), // Note optionnelle (ex: raison de l'ajustement)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  residentIdIdx: index("attendances_residentId_idx").on(table.residentId),
  packageIdIdx: index("attendances_packageId_idx").on(table.packageId),
}));

export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = typeof attendances.$inferInsert;

/**
 * Historique des e-mails envoyés
 */
export const emailLogs = mysqlTable("emailLogs", {
  id: int("id").autoincrement().primaryKey(),
  residentId: int("residentId")
    .notNull()
    .references(() => residents.id, { onDelete: 'cascade' }),
  packageId: int("packageId")
    .references(() => packages.id, { onDelete: 'set null' }),
  emailType: mysqlEnum("emailType", ["reminder", "expiration", "session_summary"]).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  success: boolean("success").default(true).notNull(),
}, (table) => ({
  residentIdIdx: index("emailLogs_residentId_idx").on(table.residentId),
}));

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

/**
 * Notes et commentaires sur les résidents
 */
export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  residentId: int("residentId")
    .notNull()
    .references(() => residents.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  createdBy: varchar("createdBy", { length: 255 }).notNull(), // Nom de l'utilisateur qui a créé la note
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  residentIdIdx: index("notes_residentId_idx").on(table.residentId),
}));

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

/**
 * Configuration des templates d'emails
 */
export const emailTemplates = mysqlTable("emailTemplates", {
  id: int("id").autoincrement().primaryKey(),
  templateType: mysqlEnum("templateType", ["reminder", "expiration", "session_summary"]).notNull().unique(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

/**
 * Configuration générale de l'atelier (singleton : une seule ligne, id=1)
 */
export const atelierSettings = mysqlTable("atelierSettings", {
  id: int("id").autoincrement().primaryKey(),
  totalShelves: int("totalShelves").default(0).notNull(), // Nombre total d'étagères dans l'atelier
  reminderDaysBeforeExpiry: int("reminderDaysBeforeExpiry").default(7).notNull(), // Nombre de jours avant expiration pour envoyer le rappel
  guideEmailEnabled: boolean("guideEmailEnabled").default(true).notNull(), // Envoyer le guide des bonnes pratiques à l'inscription
  // Liens de paiement pour les emails (JSON stocké en texte)
  paymentLinks: text("paymentLinks"), // JSON: { links: [{ label: string, url: string }] }
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AtelierSettings = typeof atelierSettings.$inferSelect;
export type InsertAtelierSettings = typeof atelierSettings.$inferInsert;

/**
 * Types de forfaits configurables
 * Permet de créer, modifier et supprimer les types de forfaits proposés aux résidents
 */
export const packageTypes = mysqlTable("packageTypes", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 100 }).notNull(), // Ex: "15h / 8 semaines"
  totalMinutes: int("totalMinutes").notNull(), // Nombre d'heures en MINUTES (ex: 900 = 15h)
  durationWeeks: int("durationWeeks").notNull(), // Durée de validité en semaines
  price: int("price").notNull(), // Prix en euros
  isActive: boolean("isActive").default(true).notNull(), // Visible lors de la création d'un forfait
  sortOrder: int("sortOrder").default(0).notNull(), // Ordre d'affichage
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PackageType = typeof packageTypes.$inferSelect;
export type InsertPackageType = typeof packageTypes.$inferInsert;

/**
 * Tokens d'action à usage unique (correction heure de sortie, création forfait en attente)
 */
export const actionTokens = mysqlTable("actionTokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  actionType: mysqlEnum("actionType", ["fix_checkout", "create_pending_package"]).notNull(),
  residentId: int("residentId").notNull().references(() => residents.id, { onDelete: 'cascade' }),
  attendanceId: int("attendanceId").references(() => attendances.id, { onDelete: 'cascade' }), // Pour fix_checkout
  packageTypeId: int("packageTypeId"), // Pour create_pending_package
  usedAt: datetime("usedAt"), // NULL = pas encore utilisé
  expiresAt: datetime("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActionToken = typeof actionTokens.$inferSelect;
export type InsertActionToken = typeof actionTokens.$inferInsert;
