import * as db from "./db";
import { getPublicSiteUrl } from "./_core/publicSiteUrl";
import { formatParisDate } from "./_core/timezone";
import {
  sendEmail,
  wrapEmailHtml,
  getAtelierNotificationEmail,
} from "./emailService";

export function renderShelfReleasedEmail(firstName: string, shelfNumber: string): { subject: string; html: string } {
  return {
    subject: `Ton étagère n°${shelfNumber} a été libérée`,
    html: wrapEmailHtml(`
        <p style="margin-top: 0;">Bonjour ${firstName},</p>
        <p>Ton forfait étant terminé depuis plus d'une semaine, nous avons libéré ton étagère <strong>n°${shelfNumber}</strong> afin de pouvoir accueillir un autre résident à l'atelier.</p>
        <p>Si tu souhaites revenir, ce sera avec grand plaisir !</p>
      `),
  };
}

// Appelé quand l'atelier confirme « Étagère vidée » : prévient le résident, une fois qu'elle l'est vraiment.
export async function sendShelfReleasedEmail(
  resident: { id: number; firstName: string; email: string },
  shelfNumber: string
): Promise<boolean> {
  if (!resident.email) return false;
  const { subject, html } = renderShelfReleasedEmail(resident.firstName, shelfNumber);
  const sent = await sendEmail(resident.email, subject, html);
  await db
    .createEmailLog({ residentId: resident.id, packageId: null, emailType: "shelf_release", recipientEmail: resident.email, subject, success: sent })
    .catch(() => {});
  return sent;
}

export function renderShelfNoticeForAtelier(c: db.ShelfSituation): { subject: string; html: string } {
  const name = `${c.firstName} ${c.lastName}`;
  return {
    subject: `Étagère n°${c.shelfNumber} à vider – ${name}`,
    html: wrapEmailHtml(
      `
        <p style="margin-top: 0;">Le forfait de <strong>${name}</strong> est terminé depuis le ${formatParisDate(c.finishedAt, { day: "2-digit", month: "long", year: "numeric" })} et n'a pas été prolongé.</p>
        <p>Son étagère <strong>n°${c.shelfNumber}</strong> est à vider.</p>
        <p>Une fois l'étagère vidée, ouvre sa fiche et clique sur « Étagère vidée » : elle redevient non occupée, ${c.email ? "et le résident en est informé par e-mail." : "mais aucune adresse e-mail n'est enregistrée pour ce résident : il faudra le prévenir directement."}</p>
      `,
      {
        closing: false,
        actionButton: { href: `${getPublicSiteUrl()}/residents/${c.residentId}`, label: "Ouvrir la fiche du résident" },
      }
    ),
  };
}

// Alerte l'atelier (e-mail avec lien vers la fiche). Le résident, lui, n'est
// prévenu qu'une fois l'étagère réellement vidée (releaseShelf). Le forfait est
// marqué "signalé" dès que l'e-mail est parti, pour ne pas relancer tous les jours.
export async function sendShelfReleaseNotice(c: db.ShelfSituation): Promise<boolean> {
  const atelierEmail = getAtelierNotificationEmail();
  if (!atelierEmail) return false;

  const { subject, html } = renderShelfNoticeForAtelier(c);
  const sent = await sendEmail(atelierEmail, subject, html);
  await db
    .createEmailLog({ residentId: c.residentId, packageId: c.packageId, emailType: "shelf_release", recipientEmail: atelierEmail, subject, success: sent })
    .catch(() => {});
  if (sent) await db.updatePackage(c.packageId, { shelfEmailSent: true });
  return sent;
}

// Tâche quotidienne (avec les rappels de 9h) : signale à l'atelier les étagères
// dont le forfait est fini depuis 7 jours sans être prolongé.
export async function checkAndSendShelfReleaseNotices(): Promise<{ notified: number }> {
  const candidates = await db.findShelfReleaseCandidates();
  let notified = 0;
  for (const c of candidates) {
    try {
      if (await sendShelfReleaseNotice(c)) notified++;
    } catch (err) {
      console.error(`[Shelf] Échec de l'avis étagère pour le résident ${c.residentId}:`, err);
    }
  }
  console.log(`[Shelf] ${candidates.length} étagère(s) à signaler, ${notified} avis envoyé(s).`);
  return { notified };
}
