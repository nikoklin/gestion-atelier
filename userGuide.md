# Guide Utilisateur - Gestion d'Atelier

## Vue d'ensemble

**Gestion d'Atelier** est une application web complète conçue pour gérer les résidents d'un atelier en libre accès. L'application permet de suivre les forfaits horaires, d'enregistrer les pointages via QR code et d'envoyer automatiquement des rappels par e-mail.

**Accès :** L'application nécessite une authentification pour accéder à l'interface administrateur. L'interface de pointage est accessible publiquement à l'adresse `/checkin`.

## Powered by Manus

Cette application a été développée avec des technologies modernes et performantes pour garantir une expérience utilisateur optimale et une gestion efficace de votre atelier.

**Stack Technique :**
- **Frontend :** React 19 avec TypeScript pour une interface utilisateur réactive et type-safe
- **UI Components :** shadcn/ui et Tailwind CSS 4 pour un design moderne et cohérent
- **Backend :** Express 4 avec tRPC 11 pour une communication type-safe entre client et serveur
- **Base de données :** MySQL/TiDB avec Drizzle ORM pour une gestion robuste des données
- **Authentification :** Système OAuth Manus intégré pour une connexion sécurisée
- **E-mails :** Nodemailer avec Gmail pour l'envoi automatique de notifications
- **Planification :** Node-cron pour l'automatisation quotidienne des rappels
- **Déploiement :** Infrastructure auto-scalable avec CDN global pour des performances optimales

Cette stack technologique garantit une application rapide, sécurisée et facile à maintenir, capable de gérer efficacement tous les aspects de votre atelier.

## Utilisation de l'Application

### Tableau de Bord

Le tableau de bord offre une vue d'ensemble complète de l'activité de votre atelier. Dès votre connexion, vous accédez à quatre indicateurs clés affichés sous forme de cartes : le nombre de résidents actifs, le nombre de forfaits actifs, les forfaits expirant bientôt (dans les 7 prochains jours) et les forfaits déjà expirés. Ces statistiques vous permettent d'avoir une vision immédiate de l'état de votre atelier.

En dessous des statistiques, vous trouvez des alertes visuelles importantes. Les forfaits expirant dans les 7 prochains jours apparaissent dans un encadré jaune avec la liste des résidents concernés, leur type de forfait et la date d'expiration. De même, les forfaits expirés sont affichés dans un encadré rouge. Ces alertes vous permettent d'identifier rapidement les résidents à contacter.

La section "Pointages Récents" affiche les 10 derniers pointages avec le nom du résident, l'heure d'arrivée, l'heure de départ et le statut (en cours ou terminé). Cette vue vous permet de suivre en temps réel l'activité de l'atelier.

### Gestion des Résidents

La page "Résidents" accessible depuis le menu latéral présente un tableau complet de tous vos résidents. Pour chaque résident, vous visualisez son nom, prénom, e-mail, téléphone, son forfait actif (s'il en a un), les heures restantes et la date de fin de validité.

Pour ajouter un nouveau résident, cliquez sur le bouton "Nouveau Résident" en haut à droite. Un formulaire s'ouvre où vous saisissez le prénom, le nom, l'e-mail et le téléphone (optionnel). Après validation, un QR code unique est automatiquement généré pour ce résident. Vous pouvez immédiatement visualiser et télécharger ce QR code pour l'imprimer et le remettre au résident.

Chaque ligne du tableau propose plusieurs actions via des boutons iconiques. Le bouton avec l'icône QR code permet d'afficher et de télécharger le QR code du résident à tout moment. Le bouton avec l'icône package vous dirige vers la page de gestion des forfaits de ce résident. Le bouton d'édition ouvre un formulaire pour modifier les informations du résident. Enfin, le bouton de suppression désactive le résident (il n'est pas supprimé définitivement de la base de données).

### Gestion des Forfaits

En cliquant sur l'icône package d'un résident, vous accédez à sa page de forfaits. Cette page affiche l'historique complet de tous les forfaits du résident, qu'ils soient actifs, expirés ou inactifs.

Le tableau des forfaits présente pour chaque forfait son type (15h/8 semaines, 30h/8 semaines ou 30h/4 semaines), la date de début, la date de fin, les heures utilisées, les heures restantes et le statut (actif, expiré ou inactif). Un badge de couleur indique visuellement le statut : vert pour actif, rouge pour expiré et gris pour inactif.

Pour créer un nouveau forfait, cliquez sur "Nouveau Forfait". Une boîte de dialogue s'ouvre où vous sélectionnez le type de forfait souhaité. Le forfait commence immédiatement à la date du jour et la date de fin est calculée automatiquement selon le type choisi. Le compteur d'heures est initialisé au maximum du forfait.

En bas de la page, la section "Historique des Pointages" affiche tous les pointages du résident avec l'heure d'arrivée, l'heure de départ et la durée de chaque session. Les pointages en cours sont clairement identifiés par un badge bleu.

### Interface de Pointage (Tablette)

L'interface de pointage est accessible à l'adresse `/checkin` et est conçue pour être utilisée sur une tablette placée à l'entrée de l'atelier. Cette interface ne nécessite pas d'authentification pour permettre aux résidents de pointer facilement.

Au chargement de la page, vous voyez un grand bouton "Démarrer le Scanner". Cliquez dessus pour activer la caméra de la tablette. Une fois la caméra activée, une zone de scan apparaît au centre de l'écran. Le résident présente simplement son QR code devant la caméra.

Lors d'un premier scan (arrivée), le système enregistre automatiquement le pointage d'arrivée et affiche un message de bienvenue avec le prénom du résident et le temps restant sur son forfait. Le message reste affiché pendant 5 secondes avec un fond vert.

Lors d'un second scan du même résident (départ), le système enregistre le pointage de départ, calcule la durée de la session et déduit les minutes du forfait. Un message d'au revoir s'affiche avec la durée de la session et le temps restant, sur fond bleu.

Si un résident tente de pointer alors qu'il n'a pas de forfait actif ou que son forfait est épuisé, un message d'erreur explicite s'affiche. Le scanner reste actif en permanence pour permettre des pointages successifs sans manipulation.

### Configuration des E-mails

La page "Configuration E-mails" accessible depuis le menu latéral vous permet de gérer le système de notifications automatiques. Cette page affiche d'abord les instructions détaillées pour configurer Gmail avec un mot de passe d'application.

Pour activer l'envoi d'e-mails, vous devez ajouter deux variables d'environnement dans les paramètres de votre projet : `EMAIL_USER` avec l'adresse contact@atourdebras-atelier.com et `EMAIL_PASSWORD` avec le mot de passe d'application généré depuis votre compte Google.

La section "Envoi Automatique" affiche deux compteurs : le nombre de rappels à envoyer (forfaits expirant dans 7 jours) et le nombre de notifications d'expiration (forfaits terminés). Ces compteurs se mettent à jour automatiquement.

Le système vérifie automatiquement tous les jours à 9h00 les forfaits nécessitant un rappel et envoie les e-mails correspondants. Vous pouvez également déclencher manuellement l'envoi avec le bouton "Envoyer les Rappels Maintenant" pour tester le système ou rattraper des envois manqués.

En bas de la page, vous trouvez les deux templates d'e-mails utilisés : le rappel (7 jours avant expiration) et la notification d'expiration. Ces templates incluent les liens de paiement pour permettre aux résidents de renouveler facilement leur forfait.

## Gestion de l'Application

### Panneau de Gestion

L'interface de gestion est accessible via l'icône dans l'en-tête de l'application. Ce panneau vous permet d'accéder à plusieurs fonctionnalités avancées :

**Prévisualisation :** Visualisez votre application en temps réel avec les états de connexion persistants.

**Code :** Accédez à l'arborescence complète des fichiers de votre projet et téléchargez tous les fichiers si nécessaire.

**Base de données :** Interface CRUD complète pour gérer directement vos données. Les informations de connexion complètes sont disponibles dans les paramètres en bas à gauche (pensez à activer SSL).

**Paramètres :** Plusieurs sous-sections sont disponibles :
- **Général :** Modifiez le nom et le logo de l'application (variables VITE_APP_TITLE et VITE_APP_LOGO)
- **Domaines :** Personnalisez le préfixe de votre domaine (xxx.manus.space) ou liez un domaine personnalisé
- **Secrets :** Gérez vos variables d'environnement de manière sécurisée, notamment EMAIL_USER et EMAIL_PASSWORD

**Publication :** Le bouton "Publish" dans l'en-tête devient actif après la création d'un checkpoint. Cliquez dessus pour déployer votre application en production.

### Configuration des E-mails Gmail

Pour activer l'envoi automatique d'e-mails, suivez ces étapes précises :

1. Connectez-vous à votre compte Google avec l'adresse contact@atourdebras-atelier.com
2. Activez la validation en deux étapes dans les paramètres de sécurité de votre compte
3. Accédez à la page "Mots de passe des applications" (https://myaccount.google.com/apppasswords)
4. Créez un nouveau mot de passe d'application en sélectionnant "Autre (nom personnalisé)"
5. Nommez-le "Gestion Atelier" et cliquez sur "Générer"
6. Copiez le mot de passe généré (16 caractères sans espaces)
7. Dans l'interface de gestion de votre application, allez dans "Paramètres" puis "Secrets"
8. Ajoutez la variable EMAIL_USER avec la valeur contact@atourdebras-atelier.com
9. Ajoutez la variable EMAIL_PASSWORD avec le mot de passe d'application copié
10. Redémarrez l'application pour que les changements prennent effet

Une fois configuré, le système enverra automatiquement les e-mails tous les jours à 9h00 du matin.

## Prochaines Étapes

Maintenant que votre application est configurée, commencez par ajouter vos premiers résidents via l'interface "Résidents". Pour chaque résident, créez un forfait correspondant à son inscription. Imprimez les QR codes générés et remettez-les aux résidents.

Installez une tablette à l'entrée de votre atelier et ouvrez l'interface de pointage à l'adresse `/checkin`. Laissez le scanner actif pour permettre aux résidents de pointer facilement à leur arrivée et à leur départ.

Configurez les identifiants Gmail pour activer l'envoi automatique des rappels. Vérifiez régulièrement le tableau de bord pour suivre l'activité de l'atelier et identifier les résidents dont le forfait arrive à expiration.

Consultez Manus AI à tout moment pour demander des modifications ou ajouter de nouvelles fonctionnalités à votre application.
