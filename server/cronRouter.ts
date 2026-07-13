import { router, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { checkAndSendReminders } from "./emailService";
import { checkAndProcessMissedCheckouts } from "./missedCheckoutService";

/**
 * Helper pour vérifier l'authentification HTTP Basic
 * Format attendu: Authorization: Basic base64(username:password)
 */
function verifyHttpBasicAuth(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const expectedApiKey = process.env.CRON_API_KEY;
  if (!expectedApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "CRON_API_KEY not configured",
    });
  }

  try {
    // Extraire les credentials du header Authorization
    const base64Credentials = authHeader.substring(6); // Enlever "Basic "
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // Vérifier que username = "cron" et password = CRON_API_KEY
    return username === 'cron' && password === expectedApiKey;
  } catch (error) {
    return false;
  }
}

/**
 * Router pour les endpoints de tâches planifiées
 * Ces endpoints sont appelés par des services externes de cron jobs (cron-job.org, EasyCron, etc.)
 * Ils sont sécurisés par authentification HTTP Basic
 */
export const cronRouter = router({
  /**
   * Endpoint pour déclencher l'envoi des e-mails de rappel
   * À appeler quotidiennement à 9h00
   * URL: /api/trpc/cron.sendDailyReminders
   * Authentification: HTTP Basic (username: cron, password: CRON_API_KEY)
   */
  sendDailyReminders: publicProcedure
    .mutation(async ({ ctx }) => {
      // Vérifier l'authentification HTTP Basic
      const authHeader = ctx.req.headers.authorization;
      if (!verifyHttpBasicAuth(authHeader)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      // Exécuter la tâche
      console.log("[Cron API] Executing daily reminders task");
      try {
        await checkAndSendReminders();
        return {
          success: true,
          message: "Daily reminders sent successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error("[Cron API] Error sending daily reminders:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send reminders: ${error.message}`,
        });
      }
    }),

  /**
   * Endpoint pour déclencher la vérification des pointages oubliés
   * À appeler quotidiennement à 22h00
   * URL: /api/trpc/cron.checkMissedCheckouts
   * Authentification: HTTP Basic (username: cron, password: CRON_API_KEY)
   */
  checkMissedCheckouts: publicProcedure
    .mutation(async ({ ctx }) => {
      // Vérifier l'authentification HTTP Basic
      const authHeader = ctx.req.headers.authorization;
      if (!verifyHttpBasicAuth(authHeader)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      // Exécuter la tâche
      console.log("[Cron API] Executing missed checkouts check");
      try {
        await checkAndProcessMissedCheckouts();
        return {
          success: true,
          message: "Missed checkouts processed successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error("[Cron API] Error checking missed checkouts:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to check missed checkouts: ${error.message}`,
        });
      }
    }),

  /**
   * Endpoint pour déclencher l'export quotidien des données par e-mail
   * À appeler quotidiennement à 23h00
   * URL: /api/trpc/cron.sendDataExport
   * Authentification: HTTP Basic (username: cron, password: CRON_API_KEY)
   */
  sendDataExport: publicProcedure
    .mutation(async ({ ctx }) => {
      // Vérifier l'authentification HTTP Basic
      const authHeader = ctx.req.headers.authorization;
      if (!verifyHttpBasicAuth(authHeader)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      // Exécuter la tâche
      console.log("[Cron API] Executing data export task");
      try {
        const { sendDataExportEmail } = await import("./emailService");
        const emailUser = process.env.EMAIL_USER;
        
        if (!emailUser) {
          throw new Error("EMAIL_USER not configured");
        }
        
        await sendDataExportEmail(emailUser);
        return {
          success: true,
          message: "Data export sent successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error("[Cron API] Error sending data export:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send data export: ${error.message}`,
        });
      }
    }),

  /**
   * Endpoint de test pour vérifier que l'API fonctionne
   * URL: /api/trpc/cron.ping
   * Authentification: HTTP Basic (username: cron, password: CRON_API_KEY)
   */
  ping: publicProcedure
    .query(({ ctx }) => {
      // Vérifier l'authentification HTTP Basic
      const authHeader = ctx.req.headers.authorization;
      if (!verifyHttpBasicAuth(authHeader)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      return {
        success: true,
        message: "Cron API is working",
        timestamp: new Date().toISOString(),
      };
    }),
});
