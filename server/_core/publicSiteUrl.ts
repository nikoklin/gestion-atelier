/**
 * URL publique du site, utilisée pour construire les liens absolus dans les
 * e-mails (guide, rappels, correction de pointage, tableau de bord résident).
 *
 * Pas de fallback vers un domaine tiers : si PUBLIC_SITE_URL est absent, on
 * le signale bruyamment dans les logs plutôt que d'envoyer silencieusement
 * des liens cassés (piège identique à celui du PDF lors de la migration).
 */
export function getPublicSiteUrl(): string {
  const url = process.env.PUBLIC_SITE_URL;
  if (!url) {
    console.error(
      "[Config] PUBLIC_SITE_URL n'est pas configurée : les liens dans les e-mails seront cassés."
    );
    return "";
  }
  return url;
}
