/**
 * Module de logging structuré avec Pino
 * 
 * Ce module fournit un logger configuré pour l'application.
 * Utilisation :
 * 
 * ```typescript
 * import { logger } from './server/_core/logger';
 * 
 * logger.info({ residentId, packageId }, 'Checkout completed');
 * logger.error({ error, attendanceId }, 'Failed to process checkout');
 * logger.warn({ packageId }, 'Package expiring soon');
 * logger.debug({ query }, 'Database query executed');
 * ```
 */

import pino from 'pino';

/**
 * Niveau de log par défaut (peut être surchargé par LOG_LEVEL)
 * - 'trace': Logs très détaillés (debug + trace)
 * - 'debug': Logs de débogage
 * - 'info': Logs informatifs (par défaut)
 * - 'warn': Avertissements
 * - 'error': Erreurs
 * - 'fatal': Erreurs fatales
 */
const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Configuration du logger
 */
const pinoConfig: pino.LoggerOptions = {
  level: logLevel,
  // En développement, utiliser pino-pretty pour un affichage coloré
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,
  // En production, utiliser le format JSON standard
  formatters: process.env.NODE_ENV === 'production' ? {
    level: (label) => {
      return { level: label };
    },
  } : undefined,
};

/**
 * Instance du logger
 */
export const logger = pino(pinoConfig);

/**
 * Helper pour logger les erreurs avec contexte
 */
export function logError(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof Error) {
    logger.error({
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    }, error.message);
  } else {
    logger.error({ ...context, error }, 'Unknown error occurred');
  }
}

/**
 * Helper pour logger les requêtes SQL
 */
export function logQuery(query: string, params?: unknown[], duration?: number) {
  logger.debug({
    query,
    params,
    duration: duration ? `${duration}ms` : undefined,
  }, 'Database query executed');
}

/**
 * Helper pour logger les actions utilisateur
 */
export function logUserAction(userId: number, action: string, details?: Record<string, unknown>) {
  logger.info({
    userId,
    action,
    ...details,
  }, `User action: ${action}`);
}
