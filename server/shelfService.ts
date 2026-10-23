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
        <p>Il n'y a plus d'étagère libre : son étagère <strong>n°${c.shelfNumber}</strong> est à vider (c'est le forfait terminé depuis le plus longtemps).</p>
        <p>Une fois l'étagère vidée, ouvre sa fiche et clique sur « Étagère vidée » : elle redevient non occupée, ${c.email ? "le résident en est informé par e-mail" : "le résident n'a pas d'adresse e-mail enregistrée (il faudra le prévenir directement)"} et il passe dans les résidents archivés.</p>
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

// Étagère à faire vider : seulement quand il n'en reste plus aucune de libre,
// une seule à la fois (pas de nouvel avis tant qu'une étagère signalée n'a pas
// été vidée), en commençant par le forfait terminé depuis le plus longtemps.
export function pickShelfToRelease(
  situations: db.ShelfSituation[],
  freeShelves: number,
  now: Date
): db.ShelfSituation | null {
  if (freeShelves > 0) return null;
  if (situations.some((c) => c.noticeSent)) return null;
  const due = situations
    .filter((c) => db.isShelfReleaseDue(c, now))
    .sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime());
  return due[0] ?? null;
}

// Tâche quotidienne (avec les rappels de 9h).
export async function checkAndSendShelfReleaseNotices(): Promise<{ notified: number }> {
  const now = new Date();
  const [situations, freeShelves] = await Promise.all([db.findFinishedPackageShelves(now), db.countFreeShelves()]);
  const shelf = pickShelfToRelease(situations, freeShelves, now);
  if (!shelf) {
    console.log(`[Shelf] Aucun avis : ${freeShelves} étagère(s) libre(s), ${situations.filter((c) => c.noticeSent).length} déjà à vider.`);
    return { notified: 0 };
  }
  try {
    const sent = await sendShelfReleaseNotice(shelf);
    console.log(`[Shelf] Plus d'étagère libre : avis pour l'étagère n°${shelf.shelfNumber} (forfait fini le ${shelf.finishedAt.toISOString()}) ${sent ? "envoyé" : "non envoyé"}.`);
    return { notified: sent ? 1 : 0 };
  } catch (err) {
    console.error(`[Shelf] Échec de l'avis étagère pour le résident ${shelf.residentId}:`, err);
    return { notified: 0 };
  }
}
