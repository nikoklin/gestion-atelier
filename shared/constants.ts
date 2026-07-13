/**
 * Constantes centralisées de l'application
 * 
 * Ce fichier regroupe toutes les constantes magiques dispersées dans le code
 * pour faciliter la maintenance et éviter les valeurs en dur.
 */

/**
 * Configuration des rappels et notifications
 */
export const PACKAGE_REMINDER_DAYS_BEFORE = 7; // Jours avant expiration pour envoyer un rappel
export const MISSED_CHECKOUT_CHECK_TIME = "22:00"; // Heure de vérification des checkouts oubliés
export const MISSED_CHECKOUT_CHECK_HOUR = 22; // Heure de vérification (format 24h)

/**
 * Types d'emails
 */
export const EMAIL_TYPES = {
  REMINDER: 'reminder',
  EXPIRATION: 'expiration',
  SESSION_SUMMARY: 'session_summary',
  MISSED_CHECKOUT: 'missed_checkout',
} as const;

export type EmailType = typeof EMAIL_TYPES[keyof typeof EMAIL_TYPES];

/**
 * Configuration des forfaits
 * 
 * Chaque type de forfait contient :
 * - minutes : Durée totale en minutes
 * - label : Libellé affiché dans l'interface
 * - weeks ou months : Durée de validité
 */
export const PACKAGE_TYPES = {
  "15h_8w": { 
    minutes: 900, 
    label: "15h / 8 semaines", 
    weeks: 8,
    description: "Forfait 15 heures valable 8 semaines"
  },
  "30h_8w": { 
    minutes: 1800, 
    label: "30h / 8 semaines", 
    weeks: 8,
    description: "Forfait 30 heures valable 8 semaines"
  },
  "30h_4w": { 
    minutes: 1800, 
    label: "30h / 4 semaines", 
    weeks: 4,
    description: "Forfait 30 heures valable 4 semaines"
  },
  "180h_6m": { 
    minutes: 10800, 
    label: "180h / 6 mois", 
    months: 6,
    description: "Forfait 180 heures valable 6 mois"
  },
} as const;

export type PackageType = keyof typeof PACKAGE_TYPES;

/**
 * Limites de validation
 */
export const VALIDATION_LIMITS = {
  RESIDENT_NAME_MAX: 100,
  EMAIL_MAX: 320,
  PHONE_MAX: 20,
  PIN_LENGTH: 4,
  NOTE_CONTENT_MAX: 5000,
  CREATED_BY_MAX: 255,
} as const;

/**
 * Rôles utilisateur
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Statuts de forfait
 */
export const PACKAGE_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  EXHAUSTED: 'exhausted',
} as const;

export type PackageStatus = typeof PACKAGE_STATUS[keyof typeof PACKAGE_STATUS];
