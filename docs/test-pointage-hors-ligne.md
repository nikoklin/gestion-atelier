# Tester le pointage hors connexion (tablette Fully Kiosk)

À faire une fois la nouvelle version en ligne. Prévoir 15 minutes, en dehors des heures
d'ouverture, avec un résident de test (ou soi-même) pour ne pas fausser les heures de quelqu'un.

## 0. Préparer la tablette (une seule fois)
1. Dans Fully Kiosk, ouvrir la page de pointage **avec le wifi actif** et attendre 10 secondes :
   la tablette enregistre la page pour pouvoir l'afficher sans réseau.
2. Recharger la page une fois (dans Fully : *Reload Start URL*, ou glisser vers le bas).
3. Vérifier en haut, sous « Pointage Atelier », l'indicateur **● En ligne**.

> Si Fully Kiosk affiche plus tard une page blanche sans réseau, vérifier dans ses réglages
> (*Advanced Web Settings*) que le cache n'est pas vidé au démarrage (*Clear Cache on Reload/Start*
> désactivé).

## 1. Pointer sans réseau
1. Couper le wifi de la tablette (paramètres Android, ou mode avion).
2. Appuyer sur le nom du résident de test.
   - Attendu : le bouton passe au vert et le cadre affiche **« Pointage enregistré sur la tablette.
     Il sera envoyé dès le retour du réseau. »**
   - L'indicateur affiche **Hors ligne – 1 pointage en attente**. Le résident apparaît présent.
3. Attendre une minute, appuyer de nouveau sur son nom (départ).
   - Attendu : **Hors ligne – 2 pointages en attente**, le cadre « SORTIE » avec la durée.

## 2. Recharger la page sans réseau
1. Toujours sans wifi, recharger la page (ou redémarrer Fully Kiosk).
   - Attendu : la page s'affiche, avec la liste des résidents et **2 pointages en attente**.

## 3. Retour du réseau
1. Rallumer le wifi. Attendre au plus 30 secondes (sans rien toucher).
   - Attendu : **En ligne – envoi de 2 pointages en attente…** puis **● En ligne**.
2. Sur un ordinateur, ouvrir la fiche du résident de test → historique des pointages :
   - une séance **aux heures réelles des appuis** (pas à l'heure du retour du réseau) ;
   - **une seule** séance (pas de doublon).

## 4. Coupure au mauvais moment (réponse perdue)
Difficile à provoquer volontairement ; c'est le cas couvert par les tests automatiques
(`client/src/lib/kioskQueue.test.ts`, `server/kioskEvents.test.ts`) : un même pointage reçu
deux fois n'est enregistré qu'une fois.

## 5. Après le test
Supprimer les pointages du résident de test depuis sa fiche (ou les garder s'il s'agit de vous).

## En cas de souci
- **« Session de la tablette expirée »** : se reconnecter sur la tablette (page /login). Les
  pointages en attente ne sont pas perdus, ils partiront après la reconnexion.
- **Un pointage refusé** (ex. départ sans arrivée) n'est pas renvoyé en boucle : il est retiré de
  la file ; le refus est enregistré côté serveur (table `kioskEvents`).
- Les pointages en attente restent sur la tablette même si elle s'éteint. **Ne pas vider les
  données de Fully Kiosk / du navigateur** tant que l'indicateur annonce des pointages en attente.
