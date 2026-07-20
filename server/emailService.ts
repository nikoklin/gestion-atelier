import * as db from "./db";
import { getPublicSiteUrl } from "./_core/publicSiteUrl";

// Envoi via l'API HTTPS de Brevo (https://api.brevo.com/v3/smtp/email).
// NE PAS repasser par du SMTP direct (port 25/465/587) : les hébergeurs
// cloud (Railway inclus) voient ces connexions bloquées silencieusement par
// Gmail et d'autres fournisseurs — confirmé en testant depuis le conteneur
// (timeout même en connexion directe à l'IP, alors que le trafic HTTPS
// général fonctionne). L'API HTTPS de Brevo passe par le port 443.
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export type EmailAttachment = { name: string; content: string }; // content en base64

// Fonction pour envoyer un e-mail
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  silent: boolean = false,
  attachments?: EmailAttachment[]
): Promise<boolean> {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.EMAIL_USER;
    if (!apiKey || !senderEmail) {
      if (!silent) console.error("[Email] BREVO_API_KEY ou EMAIL_USER non configuré");
      return false;
    }

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: "Atelier À Tour de Bras", email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(attachments && attachments.length > 0 ? { attachment: attachments } : {}),
      }),
    });

    if (!response.ok) {
      if (!silent) {
        const errorBody = await response.text().catch(() => "");
        console.error(`[Email] Brevo a répondu ${response.status}: ${errorBody}`);
      }
      return false;
    }

    if (!silent) console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    if (!silent) console.error("[Email] Error sending email:", error);
    return false;
  }
}

// Fonction pour récupérer un template d'e-mail
async function getEmailTemplate(templateType: "reminder" | "expiration" | "session_summary"): Promise<{ subject: string; body: string } | null> {
  const template = await db.getEmailTemplate(templateType);
  return template;
}

// Fonction pour remplacer les variables dans le template
function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(value));
  }
  return result;
}

// Envoyer un e-mail de rappel (forfait expirant dans 7 jours)
export async function sendReminderEmail(
  email: string,
  residentName: string,
  residentId: number,
  packageId: number,
  silent: boolean = false
): Promise<boolean> {
  const template = await getEmailTemplate("reminder");
  const pkg = await db.getPackageById(packageId);

  if (!pkg) {
    if (!silent) console.error(`[Email] Package ${packageId} not found`);
    return false;
  }

  const subject = template?.subject || "Rappel : Ton forfait arrive à expiration";
  const bodyTemplate = template?.body || `
    <h2>Bonjour {{residentName}},</h2>
    <p>Ton forfait de <strong>{{totalHours}}h</strong> arrive à expiration dans 7 jours.</p>
    <p>Il te reste <strong>{{remainingHours}}h</strong> à utiliser.</p>
    <p>N'hésite pas à renouveler ton forfait pour continuer à profiter de l'atelier !</p>
  `;

  // Convertir les minutes en heures pour l'affichage
  const remainingMinutes = pkg.totalHours - pkg.usedHours;
  const remainingHours = Math.floor(remainingMinutes / 60);
  const totalHours = Math.floor(pkg.totalHours / 60);

  const baseUrl = getPublicSiteUrl();
  const dashboardUrl = `${baseUrl}/resident/dashboard?id=${residentId}`;

  // Récupérer les liens de paiement configurés dans les paramètres
  let paymentLinksHtml = '';
  try {
    const settings = await db.getAtelierSettings();
    if (settings?.paymentLinks) {
      const parsed = JSON.parse(settings.paymentLinks) as { links: { label: string; url: string }[] };
      if (parsed.links && parsed.links.length > 0) {
        const linkItems = parsed.links
          .map((l: { label: string; url: string }) => `<a href="${l.url}" style="display:inline-block; margin: 4px 0; color: #2c5f2e; font-weight: bold;">→ ${l.label}</a>`)
          .join('<br>');
        paymentLinksHtml = `<div style="margin: 12px 0; padding: 12px; background: #f0f7f0; border-radius: 6px;"><p style="margin: 0 0 8px; font-weight: bold;">Renouveler directement en ligne :</p>${linkItems}</div>`;
      }
    }
  } catch (e) { /* non bloquant */ }

  const body = replaceTemplateVariables(bodyTemplate, {
    residentName,
    totalHours: totalHours,
    remainingHours: Math.max(0, remainingHours),
    endDate: pkg.endDate ? new Date(pkg.endDate).toLocaleDateString("fr-FR") : "N/A",
    dashboardUrl,
    paymentLinks: paymentLinksHtml,
  });

  const success = await sendEmail(email, subject, body, silent);
  await db.createEmailLog({ residentId, packageId, emailType: 'reminder', recipientEmail: email, subject, success }).catch(() => {});
  return success;
}

// Envoyer un e-mail d'expiration (forfait expiré)
export async function sendExpirationEmail(
  email: string,
  residentName: string,
  residentId: number,
  packageId: number,
  silent: boolean = false
): Promise<boolean> {
  const template = await getEmailTemplate("expiration");
  const pkg = await db.getPackageById(packageId);

  if (!pkg) {
    if (!silent) console.error(`[Email] Package ${packageId} not found`);
    return false;
  }

  const subject = template?.subject || "Ton forfait est terminé";
  const bodyTemplate = template?.body || `
    <h2>Bonjour {{residentName}},</h2>
    <p>Ton forfait de <strong>{{totalHours}}h</strong> est maintenant terminé.</p>
    <p>Pour continuer à utiliser l'atelier, n'hésite pas à acheter un nouveau forfait !</p>
  `;

  // Convertir les minutes en heures pour l'affichage
  const totalHours = Math.floor(pkg.totalHours / 60);
  const usedHours = Math.floor(pkg.usedHours / 60);

  const baseUrl = getPublicSiteUrl();
  const dashboardUrl = `${baseUrl}/resident/dashboard?id=${residentId}`;

  // Récupérer les liens de paiement configurés dans les paramètres
  let paymentLinksHtml = '';
  try {
    const settings = await db.getAtelierSettings();
    if (settings?.paymentLinks) {
      const parsed = JSON.parse(settings.paymentLinks) as { links: { label: string; url: string }[] };
      if (parsed.links && parsed.links.length > 0) {
        const linkItems = parsed.links
          .map((l: { label: string; url: string }) => `<a href="${l.url}" style="display:inline-block; margin: 4px 0; color: #c0392b; font-weight: bold;">→ ${l.label}</a>`)
          .join('<br>');
        paymentLinksHtml = `<div style="margin: 12px 0; padding: 12px; background: #fdf0f0; border-radius: 6px;"><p style="margin: 0 0 8px; font-weight: bold;">Renouveler directement en ligne :</p>${linkItems}</div>`;
      }
    }
  } catch (e) { /* non bloquant */ }

  const body = replaceTemplateVariables(bodyTemplate, {
    residentName,
    totalHours: totalHours,
    usedHours: usedHours,
    endDate: pkg.endDate ? new Date(pkg.endDate).toLocaleDateString("fr-FR") : "N/A",
    dashboardUrl,
    paymentLinks: paymentLinksHtml,
  });

  const success = await sendEmail(email, subject, body, silent);
  await db.createEmailLog({ residentId, packageId, emailType: 'expiration', recipientEmail: email, subject, success }).catch(() => {});
  return success;
}

// Envoyer un e-mail de résumé de session (après chaque pointage de départ)
export async function sendSessionSummaryEmail(
  email: string,
  residentName: string,
  durationMinutes: number,
  remainingHours: number,
  remainingMinutes: number,
  dashboardUrl: string,
  silent: boolean = false,
  residentId?: number,
  packageId?: number,
  outOfPackageMinutes: number = 0
): Promise<boolean> {
  const template = await getEmailTemplate("session_summary");

  // Extraire le prénom (premier mot du nom complet)
  const firstName = residentName.split(' ')[0];

  // Formater la durée en heures et minutes
  const durationHours = Math.floor(durationMinutes / 60);
  const durationMins = durationMinutes % 60;
  let duration = '';
  if (durationHours > 0) {
    duration = `${durationHours}h${durationMins > 0 ? ` ${durationMins}min` : ''}`;
  } else {
    duration = `${durationMins}min`;
  }

  // Calculer les heures hors forfait
  const outOfPackageHours = Math.floor(outOfPackageMinutes / 60);
  const outOfPackageMins = outOfPackageMinutes % 60;
  const outOfPackageStr = outOfPackageMinutes > 0
    ? (outOfPackageHours > 0 ? `${outOfPackageHours}h${outOfPackageMins > 0 ? ` ${outOfPackageMins}min` : ''}` : `${outOfPackageMins}min`)
    : '0';

  // Récupérer les liens de paiement configurés en base
  let paymentLinksHtml = '';
  try {
    const settings = await db.getAtelierSettings();
    if (settings?.paymentLinks) {
      const parsed = JSON.parse(settings.paymentLinks) as { links: { label: string; url: string }[] };
      if (parsed.links && parsed.links.length > 0) {
        const linkItems = parsed.links
          .map((l: { label: string; url: string }) => `<a href="${l.url}" style="color:#c0392b;">${l.label}</a>`)
          .join('<br>');
        paymentLinksHtml = `<p>Tu peux en prendre un nouveau directement en ligne :</p><p>${linkItems}</p>`;
      }
    }
  } catch (e) { /* non bloquant */ }

  // Bloc HTML conditionnel pour les heures hors forfait
  const outOfPackageBlock = outOfPackageMinutes > 0
    ? `<p style="color:#c0392b;"><strong>⚠️ Heures hors forfait cette session :</strong> ${outOfPackageStr}</p>
  <p>Ton forfait est épuisé.${paymentLinksHtml ? '' : ''}</p>
  ${paymentLinksHtml}`
    : '';

  const subject = template?.subject || "Résumé de ta session";
  const bodyTemplate = template?.body || `
    <h2>Bonjour {{firstName}},</h2>
    <p>Merci d'avoir utilisé l'atelier aujourd'hui !</p>
    <p><strong>Durée de ta session :</strong> {{duration}}</p>
    <p><strong>Temps restant sur ton forfait :</strong> {{remainingHours}}h {{remainingMinutes}}min</p>
    {{outOfPackageBlock}}
    <p><a href="{{dashboardUrl}}">Consulter mon espace personnel</a></p>
  `;

  const body = replaceTemplateVariables(bodyTemplate, {
    firstName,
    residentName,
    duration,
    durationMinutes,
    remainingHours,
    remainingMinutes,
    dashboardUrl,
    outOfPackageBlock,
    outOfPackageHours,
    outOfPackageMins,
    outOfPackageStr,
  });

  const success = await sendEmail(email, subject, body, silent);
  if (residentId) {
    await db.createEmailLog({ residentId, packageId: packageId ?? null, emailType: 'session_summary', recipientEmail: email, subject, success }).catch(() => {});
  }
  return success;
}

// Envoyer un e-mail de pointage oublié
export async function sendMissedCheckoutEmail(
  email: string,
  residentName: string,
  silent: boolean = false
): Promise<boolean> {
  const subject = "Oubli de pointage de départ";
  const body = `
    <h2>Bonjour ${residentName},</h2>
    <p>Il semble que tu aies oublié de pointer en partant de l'atelier.</p>
    <p>Nous avons automatiquement fermé ta session à 22h00.</p>
    <p>N'oublie pas de pointer en partant la prochaine fois !</p>
  `;

  return sendEmail(email, subject, body, silent);
}

// Fonction principale pour vérifier et envoyer les rappels
export async function checkAndSendReminders(): Promise<{ remindersSent: number; expirationsSent: number }> {
  console.log("[Email] Checking for packages requiring reminders...");

  try {
    const allPackages = await db.getAllPackages();
    const settings = await db.getAtelierSettings();
    const reminderDays = settings?.reminderDaysBeforeExpiry ?? 7;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000);

    // Grouper les forfaits par résident et garder le plus récent (ID le plus élevé)
    const latestPackagesByResident = new Map<number, typeof allPackages[0]>();
    for (const pkg of allPackages) {
      const existing = latestPackagesByResident.get(pkg.residentId);
      if (!existing || pkg.id > existing.id) {
        latestPackagesByResident.set(pkg.residentId, pkg);
      }
    }

    const latestPackages = Array.from(latestPackagesByResident.values());

    // Forfaits expirant dans 7 jours (uniquement le dernier forfait de chaque résident)
    const expiringPackages = latestPackages.filter((pkg) => {
      if (!pkg.endDate) return false; // Ignorer les forfaits en attente
      const endDate = new Date(pkg.endDate);
      return endDate >= now && endDate <= sevenDaysFromNow && !pkg.reminderSent;
    });

    console.log(`[Email] Found ${expiringPackages.length} packages expiring in 7 days`);

    for (const pkg of expiringPackages) {
      const resident = await db.getResidentById(pkg.residentId);
      if (resident && resident.email) {
        const sent = await sendReminderEmail(resident.email, resident.firstName, resident.id, pkg.id);
        if (sent) {
          await db.updatePackage(pkg.id, { reminderSent: true });
          console.log(`[Email] Reminder sent to ${resident.email}`);
        }
      }
    }

    // Forfaits expirés (uniquement le dernier forfait de chaque résident)
    const expiredPackages = latestPackages.filter((pkg) => {
      if (!pkg.endDate) return false; // Ignorer les forfaits en attente
      const endDate = new Date(pkg.endDate);
      const hasExpired = endDate < now || pkg.usedHours >= pkg.totalHours;
      return hasExpired && !pkg.expirationEmailSent;
    });

    console.log(`[Email] Found ${expiredPackages.length} expired packages`);

    for (const pkg of expiredPackages) {
      const resident = await db.getResidentById(pkg.residentId);
      if (resident && resident.email) {
        const sent = await sendExpirationEmail(resident.email, resident.firstName, resident.id, pkg.id);
        if (sent) {
          await db.updatePackage(pkg.id, { expirationEmailSent: true, isActive: false });
          console.log(`[Email] Expiration email sent to ${resident.email}`);
        }
      }
    }

    console.log("[Email] Reminder check completed");
    
    return {
      remindersSent: expiringPackages.length,
      expirationsSent: expiredPackages.length,
    };
  } catch (error) {
    console.error("[Email] Error checking reminders:", error);
    return { remindersSent: 0, expirationsSent: 0 };
  }
}

/**
 * Envoyer un e-mail d'export quotidien des données avec pièces jointes CSV
 */
export async function sendDataExportEmail(to: string): Promise<boolean> {
  try {
    if (!process.env.BREVO_API_KEY || !process.env.EMAIL_USER) {
      console.error("[Email] Email credentials not configured");
      return false;
    }

    // Importer la fonction d'export
    const { exportAllDataAsCSV } = await import("./exportService");

    // Générer les fichiers CSV
    const csvFiles = await exportAllDataAsCSV();

    // Préparer les pièces jointes (Brevo attend le contenu en base64)
    const attachments = csvFiles.map(file => ({
      name: file.filename,
      content: Buffer.from(file.content, 'utf-8').toString('base64'),
    }));

    const subject = `Export quotidien des données - ${new Date().toLocaleDateString("fr-FR")}`;
    const body = `
      <h2>Export quotidien des données de l'atelier</h2>
      <p>Bonjour,</p>
      <p>Voici l'export automatique quotidien de toutes les données de votre atelier.</p>
      
      <h3>Fichiers joints :</h3>
      <ul>
        <li><strong>residents_*.csv</strong> : Liste complète des résidents</li>
        <li><strong>packages_*.csv</strong> : Tous les forfaits (actifs et expirés)</li>
        <li><strong>attendances_*.csv</strong> : Historique complet des pointages</li>
        <li><strong>email_logs_*.csv</strong> : Historique des e-mails envoyés</li>
      </ul>
      
      <p>Ces fichiers peuvent être ouverts avec Excel, Google Sheets ou tout autre tableur.</p>
      
      <p><em>Cet e-mail est envoyé automatiquement chaque jour. Conservez ces fichiers comme sauvegarde de vos données.</em></p>
      
      <hr>
      <p style="color: #666; font-size: 12px;">
        Gestion d'Atelier - Export automatique<br>
        Date : ${new Date().toLocaleString("fr-FR")}
      </p>
    `;

    const success = await sendEmail(to, subject, body, false, attachments);
    if (success) {
      console.log(`[Email] Data export sent successfully to ${to}`);
    }
    return success;
  } catch (error) {
    console.error("[Email] Failed to send data export:", error);
    return false;
  }
}

/**
 * Envoyer le guide des bonnes pratiques à un nouveau résident
 */
export async function sendGuideEmail(email: string, firstName: string): Promise<boolean> {
  try {
    if (!process.env.EMAIL_USER || !process.env.BREVO_API_KEY) {
      console.error("[Email] Email credentials not configured");
      return false;
    }

    const siteUrl = getPublicSiteUrl();
    const guideUrl = `${siteUrl}/guidedesbonnespratiques.pdf`;

    const subject = `Bienvenue à l'atelier À Tour de Bras – Guide des bonnes pratiques`;
    const html = `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; background-color: #fffdf7; color: #3a2e1e;">
        <!-- En-tête -->
        <div style="background-color: #c8860a; padding: 28px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px; color: #fff; letter-spacing: 1px;">À Tour de Bras</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #fde8b0; font-style: italic;">Atelier de céramique – Paris 12e</p>
        </div>
        <!-- Corps -->
        <div style="padding: 32px;">
          <h2 style="color: #c8860a; font-size: 20px; margin-top: 0;">Bienvenue à l'atelier !</h2>
          <p style="line-height: 1.7;">Avant de te lancer, jette un œil à notre guide des bonnes pratiques : il rassemble tout ce qu'il faut savoir sur le fonctionnement de l'atelier, les règles communes et les petits gestes qui font la différence pour que chacun s'y sente bien.</p>
          <p style="margin: 28px 0; text-align: center;">
            <a href="${guideUrl}" style="display: inline-block; background-color: #c8860a; color: #fff; padding: 11px 22px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold; font-family: Arial, sans-serif;">Télécharger le guide</a>
          </p>
          <p style="line-height: 1.7;">N'hésite pas à nous contacter si tu as des questions. À très vite à l'atelier !</p>
          <p style="color: #c8860a; font-weight: bold; margin-bottom: 0;">L'équipe de l'atelier</p>
        </div>
        <!-- Pied de page -->
        <div style="background-color: #f5ead8; padding: 16px 32px; border-radius: 0 0 8px 8px; border-top: 2px solid #e8c87a;">
          <p style="margin: 0; font-size: 12px; color: #7a6040; font-family: Arial, sans-serif;">
            À Tour de Bras – 13 Rue Abel, 75012 Paris &nbsp;|&nbsp;
            <a href="mailto:contact@atourdebras-atelier.com" style="color: #c8860a;">contact@atourdebras-atelier.com</a>
          </p>
        </div>
      </div>
    `;

    const sent = await sendEmail(email, subject, html);
    if (sent) {
      console.log(`[Email] Guide sent to ${email}`);
    }
    return sent;
  } catch (error) {
    console.error("[Email] Failed to send guide email:", error);
    return false;
  }
}

/**
 * Envoyer un email de confirmation d'activation de forfait au résident
 */
export async function sendPackageActivatedEmail(
  email: string,
  firstName: string,
  packageLabel: string,
  startDate: Date,
  endDate: Date | null,
  totalHours: number,
  residentId: number,
  packageId: number
): Promise<boolean> {
  try {
    if (!process.env.EMAIL_USER || !process.env.BREVO_API_KEY) {
      console.error("[Email] Email credentials not configured");
      return false;
    }
    const siteUrl = getPublicSiteUrl();
    const dashboardUrl = `${siteUrl}/resident/dashboard?id=${residentId}`;
    const startStr = startDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const endStr = endDate
      ? endDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'Non définie';
    const totalHoursDisplay = Math.floor(totalHours / 60);

    const subject = `Votre forfait a été activé – À Tour de Bras`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2c5f2e;">Bonjour ${firstName},</h2>
        <p>Votre forfait <strong>${packageLabel}</strong> vient d'être activé.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold;">Forfait</td>
            <td style="padding: 8px; border: 1px solid #eee;">${packageLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold;">Heures disponibles</td>
            <td style="padding: 8px; border: 1px solid #eee;">${totalHoursDisplay}h</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold;">Date de début</td>
            <td style="padding: 8px; border: 1px solid #eee;">${startStr}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold;">Date d'expiration</td>
            <td style="padding: 8px; border: 1px solid #eee;">${endStr}</td>
          </tr>
        </table>
        <p style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="background-color: #2c5f2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Consulter mon espace personnel
          </a>
        </p>
        <p>À bientôt à l'atelier !</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #666; font-size: 12px;">
          À Tour de Bras – 13 Rue Abel, 75012 Paris<br>
          <a href="mailto:contact@atourdebras-atelier.com">contact@atourdebras-atelier.com</a>
        </p>
      </div>
    `;
    const sent = await sendEmail(email, subject, html);
    if (sent) {
      await db.createEmailLog({ residentId, packageId, emailType: 'reminder', recipientEmail: email, subject, success: true }).catch(() => {});
      console.log(`[Email] Package activated email sent to ${email}`);
    }
    return sent;
  } catch (error) {
    console.error("[Email] Failed to send package activated email:", error);
    return false;
  }
}
