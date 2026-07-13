import { Router, Request, Response } from "express";
import { checkAndSendReminders } from "./emailService";
import { checkAndProcessMissedCheckouts } from "./missedCheckoutService";

/**
 * Middleware pour vérifier l'authentification
 * Accepte deux méthodes :
 * 1. Header x-cron-key avec la clé API
 * 2. HTTP Basic Auth (username: cron, password: CRON_API_KEY)
 */
function verifyHttpBasicAuth(req: Request, res: Response, next: Function) {
  const expectedApiKey = process.env.CRON_API_KEY;
  if (!expectedApiKey) {
    return res.status(500).json({
      success: false,
      error: "CRON_API_KEY not configured",
    });
  }

  // Méthode 1 : Vérifier le header x-cron-key
  const cronKey = req.headers['x-cron-key'];
  if (cronKey === expectedApiKey) {
    return next();
  }

  // Méthode 2 : Vérifier HTTP Basic Auth
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.substring(6);
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');

      if (username === 'cron' && password === expectedApiKey) {
        return next();
      }
    } catch (error) {
      // Continue vers l'erreur 401
    }
  }

  // Aucune méthode d'authentification valide
  return res.status(401).json({
    success: false,
    error: "Invalid or missing authentication",
  });
}

/**
 * Routes Express pour les tâches planifiées
 * Ces routes sont appelées par des services externes de cron jobs
 */
export const cronRoutes = Router();

/**
 * Endpoint de test pour vérifier que l'API fonctionne
 * GET /api/cron/ping
 */
cronRoutes.get('/ping', verifyHttpBasicAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Cron API is working",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Endpoint pour déclencher l'envoi des e-mails de rappel
 * POST /api/cron/send-daily-reminders
 * À appeler quotidiennement à 9h00
 */
cronRoutes.post('/send-daily-reminders', verifyHttpBasicAuth, async (req: Request, res: Response) => {
  console.log("[Cron API] Executing daily reminders task");
  
  try {
    const result = await checkAndSendReminders();
    res.json({
      success: true,
      message: "Daily reminders sent successfully",
      remindersSent: result.remindersSent,
      expirationsSent: result.expirationsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Cron API] Error sending daily reminders:", error);
    res.status(500).json({
      success: false,
      error: `Failed to send reminders: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Endpoint pour déclencher la vérification des pointages oubliés
 * POST /api/cron/check-missed-checkouts
 * À appeler quotidiennement à 22h00
 */
cronRoutes.post('/check-missed-checkouts', verifyHttpBasicAuth, async (req: Request, res: Response) => {
  console.log("[Cron API] Executing missed checkouts check");
  
  try {
    const result = await checkAndProcessMissedCheckouts();
    res.json({
      success: true,
      message: "Missed checkouts processed successfully",
      processed: result.processed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Cron API] Error checking missed checkouts:", error);
    res.status(500).json({
      success: false,
      error: `Failed to check missed checkouts: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Endpoint pour déclencher l'export quotidien des données par e-mail
 * GET /api/cron/daily-export
 * À appeler quotidiennement à 22h00
 */
cronRoutes.get('/daily-export', verifyHttpBasicAuth, async (req: Request, res: Response) => {
  console.log("[Cron API] Executing data export task");
  
  try {
    const { sendDataExportEmail } = await import("./emailService");
    const emailUser = process.env.EMAIL_USER;
    
    if (!emailUser) {
      return res.status(500).json({
        success: false,
        error: "EMAIL_USER not configured",
      });
    }
    
    await sendDataExportEmail(emailUser);
    
    // Réponse courte pour cron-job.org
    res.send("OK");
  } catch (error: any) {
    console.error("[Cron API] Error sending data export:", error);
    res.status(500).send("ERROR");
  }
});
