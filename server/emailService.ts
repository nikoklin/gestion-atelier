import fs from "fs";
import path from "path";
import * as db from "./db";
import { getPublicSiteUrl } from "./_core/publicSiteUrl";
import { residentSpaceUrl } from "./_core/residentSession";
import { formatParisDate } from "./_core/timezone";

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

// Enveloppe commune de TOUS les e-mails : même design que l'e-mail de bienvenue
// (en-tête doré, pied de page adresse/contact). À appliquer à l'endroit où chaque
// e-mail est construit, pas dans sendEmail (le guide serait habillé deux fois).
// Clôture commune à tous les e-mails aux résidents : "Bonne journée." puis
// "L'équipe de l'atelier" à la ligne (même paragraphe, donc sans espace), en texte
// normal. Jamais de prénom.
const EMAIL_CLOSING_HTML = `<p style="margin: 24px 0 0;">Bonne journée.<br>L'équipe de l'atelier</p>`;

// Vrai pour un paragraphe qui ne contient que "Bonne journée." et/ou la signature
// de l'équipe (ceux des modèles enregistrés ou des anciens e-mails) : ils sont
// retirés pour n'avoir qu'une seule clôture, identique partout.
function isClosingParagraph(paragraphHtml: string): boolean {
  const text = paragraphHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return text !== "" && /^(bonne journée\.?)?\s*(l['’]équipe de l['’]atelier\.?)?$/.test(text);
}

export function wrapEmailHtml(
  rawInnerHtml: string,
  options: { closing?: boolean; dashboardUrl?: string; actionButton?: { href: string; label: string } } = {}
): string {
  // Signature "À Tour de Bras" en italique (présente dans les modèles enregistrés) : retirée partout.
  const withoutItalicSignature = rawInnerHtml.replace(
    /(?:\s*<br\b[^>]*>)?\s*<em\b[^>]*>\s*À Tour de Bras\s*<\/em>/gi,
    ""
  );
  // Avec dashboardUrl : le bouton « Consulter mon espace personnel » arrive tout
  // à la fin, après la clôture. Les paragraphes des modèles enregistrés qui
  // contiennent déjà un lien texte vers l'espace perso sont retirés (le bouton les remplace).
  let body = withoutItalicSignature;
  if (options.dashboardUrl) {
    const escaped = options.dashboardUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const paragraphWithDashboardLink = new RegExp(
      `<p\\b[^>]*>(?:(?!<\\/p>)[\\s\\S])*?<a\\b[^>]*href="${escaped}"[^>]*>[^<]*<\\/a>\\s*<\\/p>`,
      "gi"
    );
    body = body.replace(paragraphWithDashboardLink, "");
  }
  const withClosing =
    (options.closing ?? true)
      ? body.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (paragraph) =>
          isClosingParagraph(paragraph) ? "" : paragraph
        ) + EMAIL_CLOSING_HTML
      : body;
  const endButton = options.actionButton
    ? emailButton(options.actionButton.href, options.actionButton.label)
    : options.dashboardUrl
      ? emailButton(options.dashboardUrl, "Consulter mon espace personnel")
      : "";
  const innerHtml = withClosing + endButton;
  return `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; background-color: #fffdf7; color: #3a2e1e;">
        <!-- En-tête -->
        <div style="background-color: #c8860a; padding: 28px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px; color: #fff; letter-spacing: 1px;">À Tour de Bras</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #fde8b0; font-style: italic;">Atelier de céramique – Paris 12e</p>
        </div>
        <!-- Corps -->
        <div style="padding: 32px; line-height: 1.7;">
          ${innerHtml}
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
}

// Bouton d'action compatible Gmail/iPhone : un simple lien avec fond se coupe sur
// plusieurs lignes en petit écran ; le tableau garde le fond d'un seul bloc et
// le texte centré.
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width: 360px; margin: 36px auto 8px;">
          <tr>
            <td align="center" bgcolor="#c8860a" style="background-color: #c8860a; border-radius: 6px;">
              <a href="${href}" style="display: block; padding: 18px 12px; color: #ffffff; font-family: Arial, sans-serif; font-size: 17px; font-weight: bold; line-height: 24px; text-align: center; text-decoration: none;">${label}</a>
            </td>
          </tr>
        </table>`;
}

// Bouton « Mon espace » des e-mails : lien personnel signé qui connecte le résident en un clic.
export function dashboardUrlFor(residentId: number): Promise<string> {
  return residentSpaceUrl(residentId);
}

// Lien de connexion à l'espace résident (demandé depuis la page « Mon espace »).
export async function sendResidentLoginLinkEmail(email: string, firstName: string, url: string): Promise<boolean> {
  const html = wrapEmailHtml(`
      <p style="margin-top: 0;">Bonjour ${firstName},</p>
      <p>Voici ton lien pour ouvrir ton espace personnel à l'atelier. Il est valable 7 jours ; une fois ouvert, ton téléphone ou ton ordinateur restera connecté.</p>
      <p>Si tu n'as pas demandé ce lien, tu peux simplement ignorer cet e-mail.</p>
  `, { actionButton: { href: url, label: "Ouvrir mon espace" } });
  return sendEmail(email, "Ton lien pour ouvrir ton espace – À Tour de Bras", html);
}

// Adresse qui reçoit les e-mails destinés à l'atelier (alertes, étagères à vider) :
// variable d'environnement ATELIER_NOTIFICATION_EMAIL, sinon l'adresse d'expédition.
export function getAtelierNotificationEmail(): string | null {
  return process.env.ATELIER_NOTIFICATION_EMAIL || process.env.EMAIL_USER || null;
}

// Les modèles modifiables (reminder, expiration, session_summary) sont enregistrés
// avec leur propre <div style="font-family: Arial…"> extérieur : on le retire à
// l'envoi pour ne garder que le contenu, et on passe les liens en doré.
// L'éditeur et la base restent inchangés.
export function prepareTemplateBodyForWrap(html: string): string {
  const outerDiv = /^\s*<div\b[^>]*font-family[^>]*>([\s\S]*)<\/div>\s*$/i;
  const inner = outerDiv.test(html) ? html.replace(outerDiv, "$1") : html;
  return inner.replace(/<a\b[^>]*>/gi, (tag) =>
    tag.replace(/#c0392b|rgb\(192,\s*57,\s*43\)|#2c5f2e/gi, "#c8860a")
  );
}

// Bloc « Renouveler directement en ligne » des e-mails : liens Wix personnels
// (un par forfait en vente, valables 15 jours, à usage unique) si l'API Wix est
// configurée, sinon les liens fixes des Paramètres.
async function buildPaymentLinksHtml(
  residentId: number | undefined,
  intro: string = "Renouveler directement en ligne :"
): Promise<string> {
  const linkStyle = "display:inline-block; margin: 4px 0; color: #c8860a; font-weight: bold;";
  const box = (items: string, footer = "") =>
    `<div style="margin: 12px 0; padding: 12px; background: #f5ead8; border-radius: 6px;"><p style="margin: 0 0 8px; font-weight: bold;">${intro}</p>${items}${footer}</div>`;

  try {
    const resident = residentId ? await db.getResidentById(residentId) : null;
    if (resident) {
      const { getPaymentLinksForResident } = await import("./wixPaymentLinkService");
      const personal = await getPaymentLinksForResident(resident);
      if (personal && personal.length > 0) {
        const items = personal
          .map((l) => `<a href="${l.url}" style="${linkStyle}">→ ${l.label} – ${l.price} €</a>`)
          .join("<br>");
        const until = new Date(Math.min(...personal.map((l) => l.expiresAt.getTime())));
        return box(items, `<p style="margin: 8px 0 0; font-size: 12px; color: #7a6040;">Liens personnels valables jusqu'au ${formatParisDate(until, { day: "2-digit", month: "long", year: "numeric" })}.</p>`);
      }
    }

    const settings = await db.getAtelierSettings();
    if (settings?.paymentLinks) {
      const parsed = JSON.parse(settings.paymentLinks) as { links: { label: string; url: string }[] };
      if (parsed.links && parsed.links.length > 0) {
        return box(parsed.links.map((l) => `<a href="${l.url}" style="${linkStyle}">→ ${l.label}</a>`).join("<br>"));
      }
    }
  } catch (e) {
    console.error("[Email] Liens de paiement indisponibles:", e);
  }
  return "";
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

// Rend le corps du rappel. {{remainingHours}} est un nombre d'heures entières :
// les modèles écrits "{{remainingHours}}h" (dont celui enregistré en base) sont
// complétés par les minutes restantes, pour afficher "1h45" et non "1h".
export function renderReminderBody(
  bodyTemplate: string,
  variables: Record<string, string | number>,
  remainingMinutesTotal: number
): string {
  const remaining = Math.max(0, remainingMinutesTotal);
  const withMinutes = bodyTemplate.replace(
    /\{\{remainingHours\}\}h(?!\s*\{\{remainingMinutes\}\})/g,
    "{{remainingHours}}h{{remainingMinutes}}"
  );
  return replaceTemplateVariables(withMinutes, {
    ...variables,
    remainingHours: Math.floor(remaining / 60),
    remainingMinutes: String(remaining % 60).padStart(2, "0"),
  });
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
    <p>Il te reste <strong>{{remainingHours}}h{{remainingMinutes}}</strong> à utiliser.</p>
    <p>N'hésite pas à renouveler ton forfait pour continuer à profiter de l'atelier !</p>
  `;

  const remainingMinutesTotal = pkg.totalHours - pkg.usedHours;
  const totalHours = Math.floor(pkg.totalHours / 60);

  const baseUrl = getPublicSiteUrl();
  const dashboardUrl = await dashboardUrlFor(residentId);

  const paymentLinksHtml = await buildPaymentLinksHtml(residentId);

  const body = renderReminderBody(bodyTemplate, {
    residentName,
    totalHours: totalHours,
    endDate: pkg.endDate ? formatParisDate(pkg.endDate) : "N/A",
    dashboardUrl,
    paymentLinks: paymentLinksHtml,
  }, remainingMinutesTotal);

  const success = await sendEmail(email, subject, wrapEmailHtml(prepareTemplateBodyForWrap(body), { dashboardUrl }), silent);
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
  const dashboardUrl = await dashboardUrlFor(residentId);

  const paymentLinksHtml = await buildPaymentLinksHtml(residentId);

  const body = replaceTemplateVariables(bodyTemplate, {
    residentName,
    totalHours: totalHours,
    usedHours: usedHours,
    endDate: pkg.endDate ? formatParisDate(pkg.endDate) : "N/A",
    dashboardUrl,
    paymentLinks: paymentLinksHtml,
  });

  const success = await sendEmail(email, subject, wrapEmailHtml(prepareTemplateBodyForWrap(body), { dashboardUrl }), silent);
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

  // Liens de paiement seulement si la session a débordé (forfait épuisé).
  const paymentLinksHtml = outOfPackageMinutes > 0
    ? await buildPaymentLinksHtml(residentId, "Tu peux en prendre un nouveau directement en ligne :")
    : '';

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

  const success = await sendEmail(email, subject, wrapEmailHtml(prepareTemplateBodyForWrap(body), { dashboardUrl }), silent);
  if (residentId) {
    await db.createEmailLog({ residentId, packageId: packageId ?? null, emailType: 'session_summary', recipientEmail: email, subject, success }).catch(() => {});
  }
  return success;
}

// Fonction principale pour vérifier et envoyer les rappels
// Choix des forfaits qui reçoivent le rappel (fin dans `reminderDays` jours) ou
// l'e-mail « forfait terminé » : uniquement le dernier forfait de chaque résident.
// Un résident qui a déjà un forfait suivant en attente (payé d'avance, à démarrage
// automatique ou à valider par l'atelier) ne reçoit ni l'un ni l'autre.
export function selectPackagesForReminderEmails<P extends {
  id: number; residentId: number; status: string | null; endDate: Date | null;
  totalHours: number; usedHours: number; reminderSent: boolean | null; expirationEmailSent: boolean | null;
}>(allPackages: P[], now: Date, reminderDays: number): { expiringPackages: P[]; expiredPackages: P[] } {
  const reminderLimit = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000);
  const residentsWithNextPackage = new Set(
    allPackages.filter((p) => p.status === 'pending').map((p) => p.residentId)
  );

  const latestPackagesByResident = new Map<number, P>();
  for (const pkg of allPackages) {
    if (pkg.status === 'pending') continue;
    if (residentsWithNextPackage.has(pkg.residentId)) continue;
    const existing = latestPackagesByResident.get(pkg.residentId);
    if (!existing || pkg.id > existing.id) latestPackagesByResident.set(pkg.residentId, pkg);
  }
  const latestPackages = Array.from(latestPackagesByResident.values());

  const expiringPackages = latestPackages.filter((pkg) => {
    if (!pkg.endDate) return false;
    const endDate = new Date(pkg.endDate);
    return endDate >= now && endDate <= reminderLimit && !pkg.reminderSent;
  });
  const expiredPackages = latestPackages.filter((pkg) => {
    if (!pkg.endDate) return false;
    const hasExpired = new Date(pkg.endDate) < now || pkg.usedHours >= pkg.totalHours;
    return hasExpired && !pkg.expirationEmailSent;
  });
  return { expiringPackages, expiredPackages };
}

export async function checkAndSendReminders(): Promise<{ remindersSent: number; expirationsSent: number }> {
  console.log("[Email] Checking for packages requiring reminders...");

  try {
    const allPackages = await db.getAllPackages();
    const settings = await db.getAtelierSettings();
    const reminderDays = settings?.reminderDaysBeforeExpiry ?? 7;
    const now = new Date();
    const { expiringPackages, expiredPackages } = selectPackagesForReminderEmails(allPackages, now, reminderDays);

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

// Le PDF est copié par `vite build` dans dist/public (voir vite.config.ts,
// publicDir) ; en dev (tsx, non bundlé) il reste dans client/public.
function resolveGuidePdfPath(): string {
  const devPath = path.resolve(import.meta.dirname, "..", "client", "public", "guidedesbonnespratiques.pdf");
  if (fs.existsSync(devPath)) return devPath;
  return path.resolve(import.meta.dirname, "public", "guidedesbonnespratiques.pdf");
}

/**
 * Envoyer le guide des bonnes pratiques à un nouveau résident
 */
export async function sendGuideEmail(email: string, firstName: string, residentId?: number): Promise<boolean> {
  try {
    if (!process.env.EMAIL_USER || !process.env.BREVO_API_KEY) {
      console.error("[Email] Email credentials not configured");
      return false;
    }

    const guidePdf = fs.readFileSync(resolveGuidePdfPath());

    const subject = `Bienvenue à l'atelier À Tour de Bras – Guide des bonnes pratiques`;
    const html = wrapEmailHtml(`
          <h2 style="color: #000000; font-size: 20px; margin-top: 0;">Bienvenue à l'atelier !</h2>
          <p style="line-height: 1.7;">Avant de te lancer, jette un œil à notre guide des bonnes pratiques : il rassemble tout ce qu'il faut savoir sur le fonctionnement de l'atelier, les règles communes et les petits gestes qui font la différence pour que chacun s'y sente bien.</p>
          <p style="line-height: 1.7;">Si tu le souhaites, tu peux t'inscrire au <a href="https://chat.whatsapp.com/L5o3XOK6bKkJulLPl2k1Sy?s=cl&p=i&ilr=1" style="color: #c8860a;">groupe WhatsApp de l'atelier ici</a>.</p>
          <p style="line-height: 1.7;">N'hésite pas à consulter le <a href="https://www.atourdebras-atelier.com/#planning" style="color: #c8860a;">planning de l'atelier</a> pour éviter de venir lors d'une privatisation par exemple.</p>

          <p style="line-height: 1.7;">N'hésite pas à nous contacter si tu as des questions. À très vite à l'atelier !</p>
    `, { dashboardUrl: residentId ? await dashboardUrlFor(residentId) : `${getPublicSiteUrl()}/resident/login` });

    const sent = await sendEmail(email, subject, html, false, [
      { name: "guide-des-bonnes-pratiques.pdf", content: guidePdf.toString("base64") },
    ]);
    if (sent) {
      console.log(`[Email] Guide sent to ${email}`);
    }
    if (residentId) {
      await db.createEmailLog({
        residentId, packageId: null, emailType: 'guide', recipientEmail: email, subject, success: sent,
      }).catch(() => {});
    }
    return sent;
  } catch (error) {
    console.error("[Email] Failed to send guide email:", error);
    return false;
  }
}

/**
 * Un résident archivé a repayé un forfait en ligne : rien n'est créé
 * automatiquement, l'atelier doit le désarchiver puis créer le forfait.
 */
export async function sendArchivedResidentPaymentAlert(
  resident: { id: number; firstName: string; lastName: string; email: string },
  amount: string,
  wixPaymentId: string
): Promise<boolean> {
  const to = getAtelierNotificationEmail();
  if (!to) return false;
  const name = `${resident.firstName} ${resident.lastName}`;
  const subject = `Paiement reçu d'un résident archivé – ${name}`;
  const html = wrapEmailHtml(`
      <p style="margin-top: 0;"><strong>${name}</strong> (${resident.email}) vient de payer <strong>${amount} €</strong> en ligne, mais ce résident est archivé : aucun forfait n'a été créé automatiquement.</p>
      <p>Pour traiter le paiement : ouvre la page des résidents archivés, restaure ce résident, puis crée son forfait (et réattribue-lui une étagère).</p>
      <p style="color: #7a6040; font-size: 13px;">Référence du paiement Wix : ${wixPaymentId}</p>
    `, { closing: false, actionButton: { href: `${getPublicSiteUrl()}/archived`, label: "Ouvrir les résidents archivés" } });
  const sent = await sendEmail(to, subject, html);
  await db.createEmailLog({ residentId: resident.id, packageId: null, emailType: 'payment_queued', recipientEmail: to, subject, success: sent }).catch(() => {});
  return sent;
}

/**
 * Paiement reçu alors que le forfait en cours n'est pas fini : le nouveau
 * forfait est en file et démarrera tout seul.
 */
export async function sendPaymentQueuedEmail(
  email: string,
  firstName: string,
  packageLabel: string,
  expectedStart: Date,
  residentId: number,
  packageId: number
): Promise<boolean> {
  const startStr = formatParisDate(expectedStart, { day: '2-digit', month: 'long', year: 'numeric' });
  const subject = `Paiement reçu – ton prochain forfait démarrera automatiquement`;
  const html = wrapEmailHtml(`
      <p style="margin-top: 0;">Bonjour ${firstName},</p>
      <p>Nous avons bien reçu ton paiement pour le forfait <strong>${packageLabel}</strong>. Merci !</p>
      <p>Ton forfait actuel n'est pas encore terminé : le nouveau démarrera automatiquement à la fin de l'actuel (aux alentours du <strong>${startStr}</strong>, ou dès que ses heures seront épuisées si c'est avant). Tu n'as rien à faire.</p>
      <p>À bientôt à l'atelier !</p>
  `, { dashboardUrl: await dashboardUrlFor(residentId) });
  const sent = await sendEmail(email, subject, html);
  await db.createEmailLog({ residentId, packageId, emailType: 'payment_queued', recipientEmail: email, subject, success: sent }).catch(() => {});
  return sent;
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
  residentId: number,
  packageId: number
): Promise<boolean> {
  try {
    if (!process.env.EMAIL_USER || !process.env.BREVO_API_KEY) {
      console.error("[Email] Email credentials not configured");
      return false;
    }
    const siteUrl = getPublicSiteUrl();
    const dashboardUrl = await dashboardUrlFor(residentId);
    const startStr = formatParisDate(startDate, { day: '2-digit', month: 'long', year: 'numeric' });
    const endStr = endDate
      ? formatParisDate(endDate, { day: '2-digit', month: 'long', year: 'numeric' })
      : 'Non définie';

    const subject = `Ton forfait a été activé – À Tour de Bras`;
    const html = wrapEmailHtml(`
        <p style="margin-top: 0;">Bonjour ${firstName},</p>
        <p>Ton forfait <strong>${packageLabel}</strong> vient d'être activé.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #eee; background: #f9f9f9; font-weight: bold;">Forfait</td>
            <td style="padding: 8px; border: 1px solid #eee;">${packageLabel}</td>
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
    `, { dashboardUrl });
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

// Quand un forfait payé d'avance démarre (voir db.activateNextQueuedPackage),
// le résident reçoit le même e-mail de confirmation qu'une activation manuelle.
db.setQueuedActivationListener(async (info) => {
  const resident = await db.getResidentById(info.residentId);
  if (!resident?.email) return;
  let label = info.packageType;
  if (info.packageType.startsWith("custom_")) {
    const type = await db.getPackageTypeById(parseInt(info.packageType.replace("custom_", ""), 10));
    if (type) label = type.label;
  }
  await sendPackageActivatedEmail(
    resident.email,
    resident.firstName,
    label,
    info.startDate,
    info.endDate,
    resident.id,
    info.packageId
  );
});
