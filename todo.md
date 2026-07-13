# TODO - Gestion d'Atelier

## Modèle de données et Backend
- [x] Créer le schéma de base de données (résidents, forfaits, pointages)
- [x] Implémenter les procédures tRPC pour la gestion des résidents
- [x] Implémenter les procédures tRPC pour la gestion des forfaits
- [x] Implémenter les procédures tRPC pour le pointage (arrivée/départ)
- [x] Ajouter la génération de QR codes pour chaque résident

## Interface Administrateur
- [x] Créer la page de liste des résidents
- [x] Créer le formulaire d'ajout/modification de résident
- [x] Créer la page de gestion des forfaits
- [x] Créer le tableau de bord avec alertes d'expiration
- [x] Afficher et télécharger les QR codes des résidents
- [x] Créer la page d'historique des pointages

## Interface de Pointage (Tablette)
- [x] Créer l'interface de scanner QR code
- [x] Implémenter le pointage d'arrivée avec affichage du solde
- [x] Implémenter le pointage de départ avec calcul du temps
- [x] Afficher les informations du résident après scan

## Système d'e-mails automatiques
- [x] Configurer le système d'envoi d'e-mails
- [x] Implémenter la détection des forfaits expirant dans 7 jours
- [x] Implémenter la détection des forfaits expirés
- [x] Créer les templates d'e-mails de rappel
- [x] Planifier l'envoi automatique quotidien

## Tests et Documentation
- [x] Tester l'ensemble des fonctionnalités
- [x] Créer le guide utilisateur
- [x] Préparer les données de démonstration

## Corrections
- [x] Modifier le QR code pour contenir une URL complète au lieu d'un identifiant
- [x] Adapter l'interface de pointage pour extraire l'identifiant depuis l'URL
- [x] Corriger l'affichage du flux vidéo de la caméra dans l'interface de pointage
- [x] Corriger le problème de chargement infini sur la page Résidents
- [x] Ajouter un délai de sécurité pour éviter les scans multiples du même QR code

## Nouvelles Fonctionnalités
- [x] Améliorer l'affichage de l'historique des pointages sur la page de détail du résident
- [x] Créer les procédures backend pour ajouter des heures à un forfait
- [x] Créer les procédures backend pour prolonger la date d'expiration d'un forfait
- [x] Ajouter l'interface pour ajuster les heures d'un forfait
- [x] Ajouter l'interface pour prolonger la date d'expiration d'un forfait

## Espace Résident
- [x] Créer les procédures backend pour l'authentification des résidents
- [x] Créer les procédures backend pour récupérer les informations du résident
- [x] Créer la page de connexion pour les résidents
- [x] Créer l'espace personnel du résident avec forfait et historique
- [x] Permettre l'accès via scan QR code

## Soustraction d'heures et jours
- [x] Créer les procédures backend pour soustraire des heures
- [x] Créer les procédures backend pour soustraire des jours
- [x] Ajouter l'interface pour soustraire des heures
- [x] Ajouter l'interface pour soustraire des jours

## Améliorations Interface de Pointage
- [x] Garder le message de confirmation affiché après le pointage
- [x] Remplacer le lien administrateur par un lien vers l'espace résident

## Page de Paramètres
- [x] Créer une page de paramètres pour gérer EMAIL_USER et EMAIL_PASSWORD
- [x] Ajouter le lien dans le menu de navigation

## Correction Système E-mails
- [x] Diagnostiquer pourquoi les e-mails ne sont pas envoyés
- [x] Corriger le système d'envoi d'e-mails
- [x] Connecter la page Paramètres aux variables d'environnement réelles

## Système d'Authentification PIN
- [x] Ajouter le champ PIN dans la base de données
- [x] Créer les procédures backend pour gérer le PIN
- [x] Ajouter l'interface de gestion du PIN dans la page Résidents
- [x] Implémenter la vérification du PIN dans l'interface de pointage
- [x] Implémenter la vérification du PIN dans l'espace résident

## Interface de Pointage par Liste
- [x] Ajouter une procédure backend pour récupérer la liste des résidents actifs
- [x] Créer une interface de sélection par liste de noms dans la page CheckIn
- [x] Intégrer la vérification du PIN avec la sélection par nom
- [x] Garder le scanner QR code comme option alternative

## Lien vers Page de Pointage
- [x] Ajouter un lien vers /checkin dans le menu de navigation administrateur

## Suppression du Système PIN
- [ ] Modifier l'interface de pointage pour pointer directement sans PIN
- [ ] Modifier l'espace résident pour se connecter sans PIN
- [ ] Supprimer l'interface de saisie du PIN de CheckIn
- [ ] Supprimer l'interface de saisie du PIN de ResidentLogin

## Suppression du Système PIN et Simplification
- [x] Supprimer la vérification du PIN dans l'interface de pointage
- [x] Afficher la liste des résidents en une seule colonne
- [x] Pointer directement au clic sans demander de PIN
- [x] Supprimer l'interface de saisie du PIN
- [x] Envoyer un e-mail automatique à la fin de chaque session avec résumé et lien espace résident

## Corrections
- [x] Trier la liste des résidents par ordre alphabétique
- [x] Corriger l'erreur "Un pointage est déjà en cours" lors du pointage de sortie

## Gestion Administrative des Pointages
- [x] Créer les procédures backend pour modifier un pointage
- [x] Créer les procédures backend pour supprimer un pointage
- [x] Ajouter une page d'administration des pointages
- [x] Permettre la modification des heures d'arrivée et de départ
- [x] Permettre la suppression d'un pointage

## Correction Affichage Noms Résidents
- [x] Modifier la requête getAllAttendances pour inclure les noms des résidents
- [x] Mettre à jour l'affichage dans la page AttendanceManagement
- [x] Supprimer la section de configuration Gmail de la page EmailSettings

## Page de Statistiques
- [x] Installer la bibliothèque recharts pour les graphiques
- [x] Créer les procédures backend pour récupérer les statistiques
- [x] Créer la page de statistiques avec graphiques
- [x] Ajouter le lien dans le menu de navigation

## Affichage Résidents
- [x] Modifier l'affichage pour montrer prénom en premier (Prénom Nom)
- [x] Trier les résidents par ordre alphabétique du prénom
- [x] Ajouter l'option de suppression de forfait dans la page ResidentPackages

## Suppression du Code PIN pour Espace Résident
- [x] Supprimer la vérification du PIN dans la page ResidentLogin
- [x] Supprimer les champs PIN de l'interface de connexion
- [x] Mettre à jour les procédures backend pour l'authentification sans PIN
- [x] Tester la connexion par email et QR code sans PIN

## Correction Système d'E-mails
- [x] Diagnostiquer pourquoi les e-mails ne sont plus envoyés
- [x] Vérifier la configuration EMAIL_USER et EMAIL_PASSWORD
- [x] Vérifier le code d'envoi d'e-mails dans emailRouter.ts
- [x] Tester l'envoi d'e-mails après pointage
- [x] Identifier le problème des flags reminderSent/expirationEmailSent

## Bouton de Réinitialisation des Flags E-mail
- [x] Ajouter une procédure backend pour réinitialiser reminderSent et expirationEmailSent
- [x] Ajouter un bouton dans l'interface de configuration e-mails
- [x] Tester la réinitialisation et le renvoi des e-mails

## Historique des E-mails de Rappel
- [x] Ajouter une table emailLogs dans le schéma de base de données
- [x] Créer les procédures backend pour enregistrer les e-mails envoyés
- [x] Créer les procédures backend pour récupérer l'historique
- [x] Modifier emailService pour enregistrer chaque envoi
- [x] Ajouter la section d'historique dans la page Configuration E-mails

## Affichage Jaune Safran pour Pointages en Cours
- [x] Modifier la page CheckIn pour afficher en jaune safran les résidents avec pointage en cours
- [x] Tester l'affichage avec un pointage en cours

## Affichage Durée Écoulée pour Pointages en Cours
- [x] Créer un Map associant residentId à l'heure de début du pointage
- [x] Ajouter un état pour mettre à jour la durée toutes les minutes
- [x] Afficher la durée écoulée à côté du nom des résidents avec pointage en cours

## Sélection Date de Début pour Nouveau Forfait
- [x] Ajouter un champ de sélection de date dans le formulaire de création de forfait
- [x] Modifier la logique de calcul de la date de fin en fonction de la date de début choisie
- [x] Tester la création de forfait avec une date de début personnalisée

## Suppression Affichage Durée Écoulée
- [x] Supprimer le badge de durée écoulée à côté des noms de résidents
- [x] Conserver uniquement le fond jaune safran pour les résidents avec pointage en cours

## Modification Texte Page Pointage
- [x] Remplacer "Scanner votre QR code" par "Bienvenue ! Cliquez sur votre nom pour commencer la session"

## Affichage Heures Négatives en Rouge
- [x] Modifier l'espace résident pour afficher les heures restantes en rouge quand elles sont négatives
- [x] Tester l'affichage avec un forfait ayant des heures négatives

## Vérification Envoi Automatique E-mails Expiration
- [x] Vérifier que le scheduler quotidien à 9h00 est actif
- [x] Vérifier la logique d'envoi des e-mails d'expiration
- [x] Tester l'envoi automatique des e-mails

## Envoi Immédiat E-mail Expiration au Pointage
- [x] Modifier la procédure checkOut pour vérifier si le forfait est épuisé
- [x] Envoyer un e-mail immédiatement si le forfait vient d'être épuisé
- [x] Tester l'envoi d'e-mail lors d'un pointage qui épuise le forfait

## Mise à Jour Heures Forfait lors Modification Pointage
- [ ] Vérifier la logique actuelle de mise à jour des heures du forfait
- [ ] Corriger si nécessaire pour ajouter/déduire la différence de durée
- [ ] Tester la modification d'un pointage et vérifier l'impact sur le forfait

## Connexion Espace Résident sans E-mail
- [x] Modifier ResidentLogin pour afficher une liste de tous les résidents
- [x] Permettre la connexion en cliquant simplement sur le nom
- [x] Supprimer complètement le champ e-mail et le QR code

## Lien Direct vers Espace Résident dans E-mail
- [x] Modifier le template d'e-mail pour utiliser un lien avec residentId en paramètre
- [x] Modifier ResidentDashboard pour accepter residentId depuis l'URL
- [x] Tester le lien depuis un e-mail de fin de session

## Effet Clignotant Rouge pour Forfait Épuisé
- [x] Ajouter un état pour gérer l'animation clignotante
- [x] Créer une animation CSS rouge clignotante (2 fois)
- [x] Déclencher l'animation lors d'une tentative de pointage avec forfait épuisé
- [x] Tester l'effet visuel

## Bouton Réinitialisation Rappel par Résident
- [x] Ajouter une procédure backend pour réinitialiser les flags d'un résident spécifique
- [x] Ajouter le bouton "Réinitialisation Rappel" dans ResidentPackages
- [x] Tester la réinitialisation par résident

## Correction Effet Rouge et Ajout Effet Vert
- [x] Corriger la logique pour que le rouge ne s'affiche que pour forfait épuisé (pas sans forfait)
- [x] Ajouter un état pour gérer l'animation verte
- [x] Créer une animation CSS verte (flash vert)
- [x] Déclencher l'animation verte lors d'un pointage réussi
- [x] Tester les deux effets visuels
- [x] Changer la couleur du bouton Réinitialisation Rappel individuel en rouge

## Renommage et Liste Résidents dans Configuration E-mails
- [x] Renommer "Rappel à Envoyer" en "Forfaits Expirant dans 7 Jours"
- [x] Renommer "Notification d'Expiration" en "Forfaits Expirés"
- [x] Afficher la liste des résidents concernés dans chaque case
- [x] Tester l'affichage des listes

## Correction Clignotement Rouge et Renommage Page
- [x] Vérifier et corriger le clignotement rouge pour forfaits épuisés/sans forfait
- [x] Renommer "Configuration E-mails" en "Rappel" dans la navigation
- [x] Renommer le titre de la page EmailSettings
- [x] Tester les corrections

## Correction Erreur Page Rappel
- [x] Corriger l'erreur à la ligne 164 de EmailSettings.tsx
- [x] Vérifier que les données sont correctement chargées avant le map
- [x] Ajouter l'import de desc dans db.ts
- [x] Tester la page Rappel

## Correction Erreur Ligne 164:19 EmailSettings
- [x] Analyser précisément la ligne 164:19
- [x] Identifier l'erreur exacte (pkg.resident pouvait être null)
- [x] Ajouter des vérifications de sécurité avec l'opérateur ?.
- [x] Corriger et tester

## Masquer Résidents sans Forfait Valide dans Pointage
- [x] Filtrer les résidents pour n'afficher que ceux avec un forfait actif et non épuisé
- [x] Tester l'affichage de la liste

## Indicateur Forfait Épuisé dans Page Résidents
- [x] Ajouter un badge ou indicateur visuel "Forfait épuisé" dans la liste des forfaits
- [x] Tester l'affichage avec des forfaits épuisés et actifs

## Déplacer Indicateur Forfait Épuisé vers Colonne Forfait Actif
- [x] Retirer le badge "Forfait épuisé" de la colonne Heures Restantes
- [x] Afficher "Forfait épuisé" à la place du nom du forfait dans la colonne Forfait Actif
- [x] Tester l'affichage

## Retirer "Aucun" de la Colonne Forfait Actif
- [x] Remplacer le badge "Aucun" par "-" dans la colonne Forfait Actif
- [x] Tester l'affichage

## Indiquer Type de Pointage (Entrée/Sortie)
- [x] Modifier le message de confirmation pour afficher clairement "Entrée" ou "Sortie"
- [x] Tester avec un pointage d'entrée et un pointage de sortie

## Couleur Jaune Curcuma pour Résidents Présents
- [x] Modifier la couleur du bouton des résidents présents en jaune curcuma
- [x] Tester l'affichage avec un résident présent

## Bouton Redevient Blanc Après Sortie
- [x] Corriger la logique pour que le bouton redevienne blanc immédiatement après un pointage de sortie
- [x] Tester le changement de couleur après une sortie

## Retirer Scanner QR Code de la Page Pointage
- [x] Supprimer la section "Ou Scanner QR Code" et tout le code associé
- [x] Tester l'affichage de la page simplifiée

## Liens vers Gestion Résident dans Tableau de Bord
- [x] Rendre les noms des résidents cliquables dans la section "Forfaits Expirés"
- [x] Ajouter une navigation vers la page Résidents avec le résident sélectionné
- [x] Tester la navigation

## Corriger Erreur WebSocket Vite HMR
- [x] Configurer le HMR de Vite pour fonctionner avec le proxy
- [x] Redémarrer le serveur et vérifier que l'erreur est résolue

## Bouton Rappel sur Fiche Résident
- [x] Créer une procédure backend pour envoyer un e-mail de rappel à un résident
- [x] Ajouter le bouton "Rappel" dans la colonne Actions du tableau Résidents
- [x] Implémenter la logique d'envoi avec feedback utilisateur
- [x] Tester l'envoi d'e-mail de rappel

## Bouton Rappel Rouge pour Résidents Nécessitant un Rappel
- [x] Détecter si le forfait du résident expire dans 7 jours ou est déjà expiré
- [x] Afficher le bouton Rappel en rouge (variant destructive) si rappel nécessaire
- [x] Tester l'affichage avec différents états de forfaits

## Affichage Orange pour Forfaits Expirant dans 7 Jours
- [x] Modifier le badge du forfait actif pour qu'il soit orange si expiration dans 7 jours
- [x] Modifier le bouton Rappel pour qu'il soit orange si expiration dans 7 jours ET rappel non envoyé
- [x] Garder le bouton rouge si le forfait est déjà expiré
- [x] Tester l'affichage avec différents états

## Historique des Rappels au Survol du Bouton
- [x] Récupérer la date du dernier e-mail de rappel envoyé depuis emailLogs
- [x] Ajouter cette information dans les données du résident
- [x] Afficher un tooltip au survol du bouton Rappel avec "Dernier rappel : [date]"
- [x] Tester l'affichage après envoi d'un rappel

## Bouton Rappel Blanc Après Envoi
- [x] Modifier la logique pour que le bouton devienne blanc après l'envoi du rappel
- [x] Mettre à jour le flag reminderSent dans la base de données lors de l'envoi
- [x] Tester le changement de couleur après clic sur le bouton

## Corriger Tooltip et Couleur Bouton Rappel
- [x] Vérifier pourquoi le tooltip ne s'affiche pas au survol du bouton Rappel
- [x] Corriger la logique de couleur pour que le bouton soit rouge pour les forfaits expirés
- [x] Tester l'affichage du tooltip et des couleurs

## Masquer Bouton Rappel si Rappel Non Nécessaire
- [x] Modifier la logique pour ne pas afficher le bouton Rappel si le forfait est valide avec plus de 7 jours restants
- [x] Ne pas afficher le bouton Rappel si le résident n'a pas de forfait
- [x] Tester l'affichage avec différents états de forfaits

## Page Profil Résident Détaillé
- [x] Créer une nouvelle page ResidentProfile.tsx affichant les informations complètes du résident
- [x] Ajouter les boutons "Effacer résident", "Modifier informations" et "QR Code" sur cette page
- [x] Rendre les lignes du tableau cliquables pour naviguer vers /residents/:id
- [x] Retirer les boutons d'actions de la colonne Actions du tableau principal
- [x] Garder uniquement le bouton Rappel et le bouton Forfaits dans le tableau
- [x] Tester la navigation et les actions sur la page de profil

## Historique des Forfaits sur Page Profil
- [x] Vérifier qu'il existe une procédure pour récupérer tous les forfaits d'un résident
- [x] Ajouter un système d'onglets sur la page de profil (Informations / Historique)
- [x] Afficher tous les forfaits dans un tableau avec dates, durées, heures consommées et statut
- [x] Tester l'affichage avec plusieurs forfaitsident ayant plusieurs forfaits

## Déplacer Historique Pointages vers Page Profil
- [ ] Ajouter un troisième onglet "Historique des Pointages" sur la page de profil résident
- [ ] Récupérer les pointages du résident via une query tRPC
- [ ] Afficher l'historique des pointages dans un tableau complet
- [ ] Retirer tous les boutons d'actions (Package et Rappel) du tableau de la liste des résidents
- [ ] Tester la navigation et l'affichage

## Remise des Boutons Rappel dans la Colonne Actions
- [x] Ajouter la colonne Actions dans le tableau des résidents
- [x] Ajouter les boutons Rappel avec code couleur (orange/rouge/blanc)
- [x] Conserver les tooltips avec date du dernier rappel
- [x] Tester l'envoi de rappels manuels

## Correction Couleur Bouton Rappel Orange
- [x] Corriger la logique pour que le bouton soit orange (et non violet) pour les forfaits expirant dans 7 jours
- [x] Tester l'affichage avec Claire Leroy

## Correction Navigation Bouton Retour Page Forfaits
- [x] Modifier le bouton "Retour aux Résidents" pour pointer vers la page de profil du résident
- [x] Tester la navigation depuis la page ResidentPackages

## Correction Couleur Orange Bouton Rappel (Réparation)
- [x] Diagnostiquer pourquoi le bouton n'affiche pas la couleur orange
- [x] Corriger la logique ou les classes CSS avec le préfixe !
- [x] Tester avec les résidents ayant des forfaits expirant dans moins de 7 jours

## Ajout Onglet Historique des E-mails dans Profil Résident
- [x] Ajouter le TabsTrigger "Historique des E-mails" dans ResidentProfile.tsx
- [x] Créer le TabsContent avec tableau affichant date, type, sujet, statut
- [x] Créer la procédure tRPC emailLogs.getByResidentId
- [x] Créer la fonction db.getEmailLogsByResidentId (déjà existante)
- [x] Tester l'affichage avec Marie Dupont (17 e-mails affichés)

## Correction Affichage Bouton Rappel Blanc
- [x] Analyser la logique d'affichage du bouton blanc après envoi de rappel
- [x] Corriger pour que le bouton disparaisse si le forfait expire bientôt et que le rappel a été envoyé
- [x] Tester avec Claire Leroy après envoi de rappel (bouton disparu)

## Centralisation Gestion Pointages dans Profil Résident
- [x] Supprimer l'entrée "Gestion Pointages" du menu latéral
- [x] Supprimer la route /attendances dans App.tsx
- [x] Ajouter la colonne Actions dans l'onglet Historique des Pointages
- [x] Implémenter les boutons Modifier et Supprimer pour chaque pointage
- [x] Créer les dialogues de modification et suppression avec inputs datetime-local
- [x] Tester la compilation (aucune erreur TypeScript)
## Recalcul Automatique Heures Forfait lors Modification/Suppression Pointage
- [x] Analyser la logique actuelle de mise à jour des heures du forfait
- [x] Vérifier que attendances.update recalcule déjà la différence de durée (lignes 706-725)
- [x] Vérifier que attendances.delete soustrait déjà la durée du pointage supprimé (lignes 738-747)
- [x] Confirmer que les deux procédures utilisent Math.max(0, newUsedHours) pour éviter les valeurs négatives
- [x] Vérifier que le code compile sans erreurs TypeScript

## Autoriser Heures Négatives dans Forfaits
- [x] Supprimer Math.max(0, ...) dans la procédure attendances.update (ligne 722)
- [x] Supprimer Math.max(0, ...) dans la procédure attendances.delete (ligne 744)
- [x] Supprimer Math.max(0, ...) dans la soustraction d'heures (ligne 421)
- [x] Corriger l'affichage des heures négatives dans ResidentProfile.tsx (conversion minutes en heures)
- [x] Tester avec Nico Klein en soustrayant 2 heures d'un forfait épuisé
- [x] Vérifier que l'affichage montre bien -2h00 (test réussi)

## Transfert Automatique Heures Négatives vers Nouveau Forfait
- [x] Modifier la procédure packages.create pour détecter les heures négatives du forfait précédent
- [x] Calculer les heures négatives (totalHours - usedHours si négatif)
- [x] Transférer la dette au nouveau forfait en définissant usedHours = Math.abs(remainingHours)
- [x] Tester avec Nico Klein qui a -2h : créer un forfait de 15h et vérifier qu'il commence avec 13h (test réussi)
- [x] Vérifier l'affichage dans le profil (13h00 affichées correctement)

## Colonne Date d'Expiration dans Gestion des Forfaits
- [x] Analyser la page ResidentPackages.tsx pour comprendre la structure du tableau
- [x] Ajouter une colonne "Date d'Expiration" dans le tableau des forfaits
- [x] Afficher la date de fin de validité (endDate) du forfait
- [x] Si les heures sont épuisées avant la date de fin, afficher la date d'épuisement
- [x] Tester l'affichage avec différents forfaits (actifs, expirés, épuisés)
- [x] Vérifier que le formatage des dates est cohérent avec le reste de l'application

## Correction Affichage Heures Négatives
- [x] Identifier toutes les fonctions de formatage des heures dans le projet
- [x] Corriger la logique pour gérer correctement les minutes négatives
- [x] Corriger getRemainingHours dans ResidentPackages.tsx
- [x] Corriger getRemainingHours dans Residents.tsx
- [x] Corriger l'affichage dans CheckIn.tsx (entrée et sortie)
- [x] Utiliser Math.abs() pour les valeurs négatives et ajouter le signe - manuellement

## Correction Heures Totales dans Historique des Forfaits
- [x] Identifier où l'historique des forfaits affiche les heures totales
- [x] Vérifier la logique de calcul/affichage des heures totales
- [x] Corriger le forfait de Nico Klein avec les bonnes valeurs (900 minutes)
- [x] Identifier le bug dans subtractHours qui modifie totalHours au lieu de usedHours
- [x] Corriger subtractHours pour ajouter aux usedHours au lieu de soustraire de totalHours
- [x] Tester avec différents types de forfaits (15h, 30h)

## Correction Bouton Soustraire des Heures
- [x] Identifier pourquoi le bouton "Soustraire" augmente les heures au lieu de les soustraire
- [x] Vérifier la logique dans le serveur (routers.ts - subtractHours)
- [x] Corriger la logique : changer + en - pour soustraire correctement
- [x] Supprimer la valeur par défaut "0" dans le champ Minutes (ajout et soustraction)
- [x] Ajouter placeholder="0" pour indiquer la valeur attendue

## Correction Vraie Logique Soustraire des Heures
- [x] Comprendre la logique attendue : "Soustraire des heures" doit réduire les heures restantes
- [x] Identifier l'erreur : j'avais changé + en - par erreur
- [x] Corriger : soustraire des heures doit AJOUTER aux usedHours pour réduire les heures restantes
- [x] Revenir à la logique correcte : usedHours + subtractMinutes

## Correction Affichage Forfaits Expirés dans Tableau de Bord
- [x] Identifier la logique actuelle de filtrage des forfaits expirés
- [x] Vérifier si la logique inclut les forfaits épuisés (heures <= 0)
- [x] La logique est correcte : endDate < now || usedHours >= totalHours
- [x] Le filtre !expirationEmailSent est intentionnel pour éviter les doublons
- [x] Testé : les forfaits épuisés apparaissent bien (Nico Klein affiché)

## Exclure Résidents Supprimés des Forfaits Expirés
- [x] Identifier comment les résidents supprimés sont gérés (suppression de la table)
- [x] Vérifier la logique de getExpiredPackages (utilise getAllActivePackages)
- [x] Modifier getAllActivePackages pour faire un INNER JOIN avec residents
- [x] Les forfaits des résidents supprimés sont automatiquement exclus

## Masquer Pointages des Résidents Supprimés
- [x] Identifier la procédure listAll dans attendances (utilise getAllAttendances)
- [x] getAllAttendances utilise déjà un LEFT JOIN avec residents
- [x] Changer LEFT JOIN en INNER JOIN pour exclure les résidents supprimés
- [x] Les informations du résident sont déjà retournées (firstName, lastName)

## Suppression en Cascade et Archivage des Résidents
- [x] Ajouter le champ isDeleted (boolean, default false) à la table residents
- [x] Modifier la fonction deleteResident pour mettre isDeleted = true au lieu de supprimer
- [x] Adapter toutes les requêtes pour exclure les résidents avec isDeleted = true
- [x] Créer getArchivedResidents et restoreResident dans db.ts
- [x] Créer les procédures tRPC listArchived et restore
- [x] Créer la page ArchivedResidents.tsx
- [x] Ajouter la route /archived dans App.tsx
- [x] Ajouter le lien "Résidents Archivés" dans le menu de navigation
- [x] Ajouter un bouton "Restaurer" pour chaque résident archivé
- [x] Tester l'archivage et la restauration (Jean Martin archivé puis restauré avec succès)

## Correction Validation Formulaire Création Résident
- [x] Identifier le schéma de validation dans routers.ts
- [x] Rendre le champ Email optionnel (.optional().or(z.literal('')))
- [x] Rendre le champ PIN optionnel (.optional().or(z.literal('')))
- [x] Normaliser email et pin avant de les passer à createResident
- [x] Tester la création d'un résident sans email ni PIN (Test Utilisateur créé avec succès)
- [x] Vérifier que le résident apparaît dans la liste

## Modifications Tableau de Bord et Page Rappel
- [x] Supprimer la case "Forfaits Expirés" du tableau de bord
- [x] Supprimer la section "Forfaits Expirés" en dessous des cartes
- [x] Supprimer la requête expiredPackages inutilisée
- [x] Modifier la page Rappel pour afficher les noms des résidents dans "Forfaits Expirants"
- [x] Ajouter des liens vers la page de gestion de chaque résident (/residents/{id}/packages)
- [x] Modifier la page Rappel pour afficher les noms des résidents dans "Forfaits Expirés"
- [x] Utiliser residentFirstName/residentLastName pour les forfaits expirés
- [x] Tester l'affichage et les liens (Claire Leroy testé avec succès)

## Suppression Case Expirent Bientôt
- [x] Supprimer la case "Expirent Bientôt" du tableau de bord
- [x] Supprimer la section "Forfaits Expirant dans 7 Jours" en dessous
- [x] Supprimer la requête expiringPackages du tableau de bord
- [x] Modifier getExpiringPackages pour retourner residentFirstName/residentLastName
- [x] Modifier EmailSettings pour utiliser ces champs
- [x] Vérifier que la page Rappel affiche bien les résidents avec forfaits expirant dans 7 jours
- [x] Testé : affiche "Aucun forfait" car tous les forfaits ont déjà reçu leur rappel

## Correction Mise à Jour Page Rappel après Réinitialisation Flags
- [x] Identifier le code du bouton "Réinitialiser les Flags" dans EmailSettings.tsx
- [x] Ajouter l'invalidation du cache tRPC après la réinitialisation
- [x] Invalider les requêtes getExpiringPackages et getExpiredPackages
- [x] Ajouter aussi l'invalidation après sendReminders pour cohérence
- [x] Modifications appliquées : utils.invalidate() après resetFlags et sendReminders

## Activation Modification Informations Résidents
- [x] Identifier où se trouve le bouton "Modifier les Informations" (ResidentProfile.tsx)
- [x] Vérifier si la procédure tRPC update existe déjà (existe déjà)
- [x] Créer le formulaire de modification avec les champs (prénom, nom, email, téléphone, PIN)
- [x] Implémenter la logique de modification (mutation + handlers)
- [x] Ajouter le dialogue de modification
- [x] Fonction implémentée et prête à tester

## Validation en temps réel du formulaire de modification
- [x] Analyser le formulaire actuel et définir les règles de validation
- [x] Implémenter la validation en temps réel avec messages d'erreur
- [x] Tester la validation et sauvegarder le checkpoint

## Correction du lien dans l'email de rappel
- [x] Identifier le template d'email de rappel et analyser le lien actuel
- [x] Corriger le lien pour inclure l'ID du résident comme paramètre
- [x] Tester l'envoi d'email et vérifier le lien, puis sauvegarder

## Correction du pré-remplissage des heures dans la modification des pointages
- [x] Analyser le code de pré-remplissage des heures dans ResidentProfile.tsx
- [x] Corriger la logique de conversion des dates pour le fuseau horaire
- [x] Tester la modification et sauvegarder le checkpoint

## Ajout de la création de pointage manuel
- [x] Créer une procédure backend pour créer un pointage manuel
- [x] Ajouter le bouton et le dialogue de création dans ResidentProfile.tsx
- [x] Tester la création de pointage et sauvegarder le checkpoint

## Correction du lien dans l'email de résumé de session
- [x] Identifier où est généré le lien dans l'email de résumé de session
- [x] Remplacer l'URL codée en dur par l'URL actuelle du serveur
- [x] Configurer l'URL de production et sauvegarder le checkpoint

## Correction de l'heure de départ lors de la création de pointage
- [x] Analyser le code de création de pointage pour identifier le problème
- [x] Corriger la logique de traitement de l'heure de départ
- [x] Tester la correction et sauvegarder le checkpoint

## Correction définitive du lien dans l'email de rappel
- [x] Vérifier l'URL actuelle utilisée dans l'email de rappel
- [x] Tester le lien manuellement et identifier le problème exact
- [x] Corriger l'URL avec l'URL de production et sauvegarder le checkpoint

## Correction du statut de pointage lors de la création avec heure de départ
- [x] Analyser pourquoi le pointage reste en cours malgré l'heure de départ
- [x] Corriger la logique pour marquer le pointage comme terminé
- [ ] Problème persiste - déboguer plus en profondeur

## Débogage approfondi du problème de création de pointage
- [x] Vérifier directement dans la base de données ce qui est enregistré
- [x] Identifier la cause racine : onChange ne se déclenche pas pour les changements d'heure seulement
- [x] Corriger en utilisant onInput en plus de onChange
- [x] Tester la correction et sauvegarder le checkpoint

## Validation des heures cohérentes lors de la création de pointage
- [x] Implémenter la validation côté client avec message d'erreur
- [x] Ajouter la validation côté serveur pour sécuriser
- [x] Tester la validation et sauvegarder le checkpoint

## Correction définitive du problème d'heure de départ (Safari)
- [x] Remplacer les états contrôlés par des refs pour les champs datetime-local
- [ ] Problème persiste avec le pré-remplissage

## Retrait du pré-remplissage du champ heure de départ
- [ ] Vérifier et retirer tout pré-remplissage du champ heure de départ
- [ ] Tester et sauvegarder le checkpoint

## Personnalisation des messages de rappel
- [x] Créer une table de configuration pour stocker les templates d'emails
- [x] Ajouter une interface dans les paramètres pour éditer les messages
- [x] Modifier les fonctions d'envoi d'email pour utiliser les templates personnalisés
- [x] Tester et sauvegarder le checkpoint

## Intégration de la personnalisation des messages dans la page Rappel
- [x] Déplacer l'interface de personnalisation des templates dans EmailSettings.tsx
- [x] Retirer la page EmailTemplates et la route associée
- [x] Retirer l'entrée Messages du menu et sauvegarder le checkpoint

## Correction de la sauvegarde des templates d'emails
- [x] Vérifier les fonctions de base de données pour les templates
- [x] Tester la sauvegarde et identifier le problème
- [x] Le code est correct - nécessite republication pour prendre effet en production

## Mise à jour de la section Templates d'E-mails
- [x] Modifier la section Templates d'E-mails pour afficher les templates dynamiques
- [x] Sauvegarder le checkpoint

## Vérification de tous les envois d'emails pour utiliser les templates
- [x] Vérifier tous les endroits où les emails sont envoyés
- [x] Corriger emailRouter.ts pour utiliser sendReminderEmail
- [x] Tester et sauvegarder le checkpoint

## Correction du bouton Rappel pour envoyer le bon type d'email
- [x] Modifier la logique d'envoi pour détecter l'état du forfait
- [x] Tester et sauvegarder le checkpoint

## Modification de l'affichage du bouton Rappel après envoi
- [x] Modifier la logique d'affichage du bouton selon les flags reminderSent et expirationEmailSent
- [x] Tester et sauvegarder le checkpoint

## Affichage du dernier forfait par résident dans la page Rappel
- [x] Modifier les requêtes backend pour grouper par résident et retourner le dernier forfait
- [x] Tester et sauvegarder le checkpoint

## Tri alphabétique des listes dans la page Rappel
- [x] Modifier les requêtes backend pour trier par prénom
- [x] Tester et sauvegarder le checkpoint

## Gestion des forfaits en attente (activation après expiration du précédent)
- [ ] Ajouter un statut aux forfaits (actif, en attente, expiré)
- [ ] Modifier la logique de pointage pour activer automatiquement le prochain forfait
- [ ] Mettre à jour l'interface pour afficher le statut des forfaits
- [ ] Tester et sauvegarder le checkpoint

# Correction système de file d'attente des forfaits
- [ ] Modifier le schéma pour rendre startDate et endDate optionnels (nullable)
- [ ] Mettre à jour la logique de création de forfait pour ne pas définir de dates pour les forfaits en attente
- [ ] Améliorer la fonction activateNextPendingPackage pour calculer automatiquement les dates lors de l'activation
- [ ] Mettre à jour l'interface pour gérer l'affichage des forfaits sans dates (afficher "En attente d'activation" au lieu des dates)
- [ ] Tester l'activation automatique lors d'un pointage de départ qui épuise le forfait actif

## Correction Système de File d'Attente des Forfaits
- [x] Rendre les dates optionnelles dans le schéma pour les forfaits en attente
- [x] Mettre à jour la logique de création pour ne pas définir de dates pour les forfaits en attente
- [x] Améliorer la fonction d'activation pour calculer automatiquement les dates lors de l'activation
- [x] Mettre à jour l'interface pour afficher correctement les forfaits sans dates
- [x] Corriger toutes les erreurs TypeScript liées aux dates nulles

## Correction Problèmes Système File d'Attente
- [x] Diagnostiquer pourquoi les forfaits n'apparaissent plus dans la page Résidents
- [x] Corriger l'affichage des forfaits dans la page Résidents
- [x] Tester l'activation automatique des forfaits en attente après expiration
- [x] Corriger la logique d'activation automatique (ajout isActive et logs de débogage)

## Annulation Système File d'Attente + Nouveau Forfait
- [x] Supprimer le champ status et toute la logique de file d'attente
- [x] Ajouter le nouveau type de forfait 180h / 6 mois
- [x] Nettoyer le code et supprimer les logs de débogage

## Modification Tableau de Bord
- [x] Modifier la carte Résidents Actifs pour afficher le nombre total de résidents
- [x] Modifier la carte Forfaits Actifs pour afficher le détail par type de forfait

## Système de Notes et Commentaires
- [x] Créer la table notes dans le schéma de base de données
- [x] Ajouter les fonctions backend pour gérer les notes (CRUD)
- [x] Créer les procédures tRPC pour les notes
- [x] Ajouter l'interface de prise de notes dans ResidentProfile.tsx

## Modification Lien Espace Personnel
- [x] Identifier le lien "Consulter mon espace personnel" dans la page Pointage
- [x] Modifier le lien pour rediriger directement vers l'espace du résident

## Système de Sauvegarde Excel
- [x] Installer la bibliothèque Excel (exceljs)
- [x] Créer la fonction d'export des pointages et forfaits
- [x] Créer la procédure tRPC pour l'export manuel
- [x] Ajouter le bouton d'export dans la page Paramètres
- [x] Configurer la sauvegarde automatique quotidienne à 22h

## Tri Alphabétique Forfaits Export Excel
- [x] Modifier la fonction d'export pour trier les forfaits par ordre alphabétique des résidents

## Système Détection Pointages Oubliés
- [x] Ajouter un champ dans la table residents pour marquer les pointages oubliés
- [ ] Créer la fonction de vérification et pointage automatique à 22h
- [ ] Créer le template d'email pour notifier les résidents
- [ ] Planifier la vérification quotidienne à 22h
- [ ] Ajouter l'indicateur visuel (point d'exclamation rouge) dans la page Résidents

## Système de Pointage Oublié à 22h
- [x] Ajouter le champ hasMissedCheckout dans la table residents
- [x] Créer la fonction checkMissedCheckouts pour détecter les pointages oubliés
- [x] Créer le template d'e-mail pour notifier les résidents
- [x] Planifier la tâche quotidienne à 22h00
- [x] Ajouter l'indicateur visuel (point d'exclamation rouge) dans la page Résidents
- [x] Tester le système complet

## Correction Tâches Planifiées E-mails
- [x] Vérifier la configuration du scheduler dans scheduler.ts
- [x] Vérifier les logs du serveur pour identifier les erreurs
- [x] Tester manuellement l'envoi d'e-mails
- [x] Créer des endpoints API pour déclencher les tâches planifiées
- [x] Ajouter une clé API secrète pour sécuriser les endpoints
- [x] Tester les endpoints
- [x] Créer la documentation pour configurer cron-job.org

## Modification Authentification HTTP Basic
- [x] Modifier les endpoints pour utiliser l'authentification HTTP Basic
- [x] Mettre à jour la documentation CRON_SETUP.md
- [x] Tester les endpoints avec authentification HTTP

## Correction Erreur 415 - Endpoints Express
- [x] Créer des routes Express pour les tâches planifiées
- [x] Enregistrer les routes dans le serveur Express
- [x] Mettre à jour la documentation avec les nouvelles URLs
- [x] Tester les endpoints

## Correction Erreur "output too large"
- [x] Modifier les endpoints pour retourner des réponses plus concises

## Correction bug réinitialisation flags expirés
- [x] Vérifier la procédure resetEmailFlags dans routers.ts
- [x] Corriger le bug de réinitialisation du flag expirationEmailSent
- [x] Tester la correction

## Diagnostic forfaits expirés sans e-mails
- [x] Vérifier l'état des forfaits expirés dans la base de données
- [x] Vérifier la logique d'envoi dans checkAndSendReminders
- [x] Identifier pourquoi les forfaits expirés ne sont pas traités (getAllActivePackages excluait les forfaits inactifs)
- [x] Corriger getAllPackages, getExpiringPackages et getExpiredPackages
- [x] Tester la correction

## Afficher uniquement le dernier forfait expiré par résident
- [x] Modifier getExpiredPackages pour ne retourner que le dernier forfait expiré de chaque résident
- [x] Corriger pour exclure les forfaits sans résident valide
- [x] Tester la modification

## Appliquer la logique de filtrage aux forfaits expirants
- [x] Modifier getExpiringPackages pour n'afficher que le dernier forfait expirant par résident
- [x] Tester la modification

## Réafficher les indicateurs de rappel après réinitialisation des flags
- [x] Vérifier comment les indicateurs sont affichés sur la page Résidents
- [x] Identifier pourquoi ils ne se mettent pas à jour après réinitialisation
- [x] Corriger le problème (ajout de l'invalidation du cache residents.getWithActivePackage)
- [x] Tester la correction

## Correction envoi e-mails d'expiration depuis page Rappel
- [x] Vérifier la logique d'envoi dans checkAndSendReminders
- [x] Identifier pourquoi les forfaits expirés ne sont pas traités (getAllActivePackages excluait les forfaits inactifs)
- [x] Corriger le problème (utiliser getAllPackages au lieu de getAllActivePackages)
- [x] Tester la correction (18 forfaits expirés traités avec succès)

## Envoyer un seul e-mail par résident (dernier forfait uniquement)
- [x] Modifier checkAndSendReminders pour grouper par résident et ne traiter que le dernier forfait
- [x] Modifier resetEmailFlags pour ne réinitialiser que le dernier forfait de chaque résident
- [x] Tester les modifications (2 e-mails d'expiration au lieu de 18, groupement validé)

## Correction affichage boutons de rappel individuels après réinitialisation
- [x] Identifier pourquoi les boutons de rappel (enveloppe rouge) ne s'affichent pas pour les forfaits expirés (getActivePackageByResidentId ne retourne que les forfaits actifs)
- [x] Modifier getWithActivePackage pour retourner le dernier forfait (actif ou non)
- [x] Tester la correction (boutons rouges et oranges affichés correctement)

## Supprimer boutons de rappel blancs pour forfaits expirés
- [x] Modifier la logique d'affichage dans Residents.tsx pour ne pas afficher de bouton après envoi d'e-mail d'expiration
- [x] Tester la modification (boutons blancs supprimés, seuls les boutons rouges/oranges restent)

## Afficher l'heure du pointage à côté du nom sur la page Pointage
- [x] Identifier où afficher l'heure (après le nom du résident)
- [x] Modifier l'interface pour afficher l'heure du dernier pointage
- [x] Tester l'affichage

## Permettre le pointage avec forfait expiré
- [x] Modifier la page Pointage pour afficher tous les résidents actifs (même avec forfait expiré)
- [x] Afficher les résidents avec forfait expiré avec un bouton rouge et le message "forfait expiré"
- [x] Modifier la logique backend pour accepter les pointages avec forfait expiré
- [x] Continuer à enregistrer le temps passé normalement
- [x] Tester le pointage avec un forfait expiré

## Corriger l'affichage des résidents avec forfait expiré
- [x] Modifier la logique pour afficher les résidents absents avec forfait expiré en blanc (sans message)
- [x] Afficher en rouge avec "forfait expiré" uniquement les résidents présents (pointés) avec forfait expiré
- [x] Tester le comportement avant et après pointage

## Corriger l'affichage de Nicolas Klein avec forfait expiré
- [x] Diagnostiquer pourquoi Nicolas Klein ne s'affiche pas en rouge (problème: listAll ne retournait que les forfaits actifs)
- [x] Vérifier l'état de son forfait dans la base de données
- [x] Corriger la logique en modifiant listAll pour retourner tous les forfaits
- [x] Tester la correction

## Afficher uniquement les forfaits actifs dans le Tableau de Bord
- [x] Analyser la logique actuelle de comptage des forfaits dans Dashboard.tsx
- [x] Modifier la logique pour filtrer uniquement les forfaits non expirés et non épuisés
- [x] Tester l'affichage avec différents états de forfaits

## Export Automatique Quotidien des Données par E-mail
- [x] Créer les fonctions d'export CSV pour chaque table (residents, packages, attendances, emailLogs)
- [x] Créer une procédure backend pour générer et envoyer l'e-mail avec pièces jointes CSV
- [x] Ajouter l'interface de configuration dans la page Paramètres (activation, heure d'envoi, e-mail destinataire)
- [x] Ajouter un bouton "Export Manuel" pour déclencher l'envoi immédiat
- [x] Configurer le cron job pour l'envoi automatique quotidien
- [x] Tester l'export manuel et automatique

## Afficher les noms des résidents dans les exports CSV
- [x] Modifier exportAllDataAsCSV pour joindre les noms des résidents
- [x] Ajouter une colonne "Nom Résident" dans les exports forfaits, pointages et logs e-mails
- [x] Tester l'export avec les noms affichés

## Trier l'export des forfaits par nom de résident
- [x] Modifier exportAllDataAsCSV pour trier les forfaits par residentName
- [x] Tester l'export avec le tri alphabétique

## Corriger l'endpoint cron pour compatibilité avec cron-job.org
- [x] Modifier l'endpoint /api/cron/daily-export pour retourner une réponse courte
- [x] Ajouter le support du header x-cron-key pour l'authentification
- [x] Tester avec cron-job.org

## Rendre le point d'exclamation rouge cliquable
- [x] Identifier où se trouve le point d'exclamation rouge dans le code
- [x] Ajouter missedCheckoutAttendanceId dans le schéma residents
- [x] Modifier missedCheckoutService pour stocker l'ID du pointage oublié
- [x] Ajouter un lien cliquable vers la page de gestion des pointages
- [x] Ajouter la route /attendance dans App.tsx
- [x] Passer l'ID du pointage en paramètre pour ouvrir directement en édition
- [x] Tester le clic et la redirection

## Corriger l'affichage du point d'exclamation pour enka enka et Nicolas Klein
- [x] Vérifier l'état de enka enka et Nicolas Klein dans la base de données
- [x] Identifier pourquoi le point d'exclamation ne s'affiche pas pour eux (missedCheckoutAttendanceId était NULL)
- [x] Corriger le problème (mise à jour manuelle des IDs dans la base de données)
- [x] Tester avec enka enka et Nicolas Klein

## Vérification complète et correction des bugs de forfaits
- [ ] Analyser la logique de calcul des heures (usedHours, remainingHours, totalHours)
- [ ] Vérifier la conversion minutes/heures dans tous les calculs
- [ ] Vérifier la logique de détection des forfaits expirés (par date ET par épuisement)
- [ ] Tester l'affichage du Tableau de Bord (nombre de forfaits actifs)
- [ ] Tester l'affichage de la page Résidents (statut des forfaits)
- [ ] Tester l'affichage de la page Pointage (résidents avec forfait expiré)
- [ ] Vérifier la logique de sélection du forfait lors du pointage
- [ ] Vérifier la déduction des heures après chaque pointage
- [ ] Corriger tous les bugs identifiés

## Correction Bugs Calculs Heures et Affichage Forfaits
- [x] Identifier les bugs de conversion minutes/heures dans emailService.ts et emailRouter.ts
- [x] Corriger la conversion minutes → heures dans sendReminderEmail (emailService.ts)
- [x] Corriger la conversion minutes → heures dans sendExpirationEmail (emailService.ts)
- [x] Corriger le nommage de variable dans emailRouter.ts
- [x] Corriger le nommage de variable dans routers.ts (ligne 340)
- [x] Identifier la cause des valeurs usedHours négatives (enka enka: -322 min, Test Utilisateur: -386 min)
- [x] Corriger les données en base : mettre usedHours à 0 pour tous les forfaits avec valeurs négatives
- [x] Ajouter validation dans subtractHours pour empêcher usedHours négatif
- [x] Ajouter validation dans deleteAttendance pour empêcher usedHours négatif
- [x] Ajouter validation dans updateAttendance pour empêcher usedHours négatif
- [x] Corriger l'affichage des forfaits expirés par date dans Residents.tsx
- [x] Tester l'affichage : enka enka doit afficher "Forfait expiré" au lieu de "30h / 4 semaines"
- [x] Tester l'affichage : Test Utilisateur doit afficher "180h" au lieu de "186h26"

## Correction Affichage Forfait Actif dans Page Profil
- [x] Identifier la logique d'affichage du forfait actif dans ResidentProfile.tsx
- [x] Ajouter la vérification de la date d'expiration (comme dans Residents.tsx)
- [x] Tester l'affichage avec enka enka (doit afficher "Forfait expiré" au lieu de "30h / 4 semaines")
- [x] Vérifier que tous les forfaits expirés s'affichent correctement

## Correction Bouton Envoi Rappel pour Forfaits Expirés
- [x] Identifier pourquoi le bouton d'enveloppe rouge ne fonctionne pas pour les forfaits expirés
- [x] Vérifier la logique d'affichage et de clic du bouton dans Residents.tsx
- [x] Corriger la logique de détection d'expiration dans emailRouter.ts (ajouter vérification de la date)
- [x] Activer le forfait 810001 de enka enka (isActive = true)
- [x] Tester l'envoi de rappel avec un forfait expiré (enka enka) - Succès !

## Résolution Erreur "Échec de l'envoi de l'email"
- [x] Vérifier les logs du serveur pour identifier la cause de l'erreur
- [x] Identifier que les forfaits ont isActive = false (enka enka, Nicolas Klein)
- [x] Activer les forfaits 810001 (enka enka) et 810002 (Nicolas Klein)
- [x] Tester l'envoi d'email avec un forfait expiré - Succès !
- [x] Documenter la logique de désactivation automatique des forfaits

## Affichage en Rouge des Heures Hors Forfait
- [ ] Analyser la logique actuelle de pointage avec forfait expiré
- [ ] Identifier comment détecter qu'une session est hors forfait (après expiration)
- [ ] Implémenter l'affichage en rouge dans la page Pointage (liste des pointages)
- [ ] Ajouter un compteur "Heures hors forfait" en rouge sur la page de profil du résident
- [ ] Marquer en rouge les sessions hors forfait dans l'historique des sessions
- [ ] Tester avec un résident ayant des heures hors forfait

## Affichage en Rouge des Heures Hors Forfait
- [x] Analyser la logique actuelle de pointage avec forfait expiré
- [x] Modifier getAllAttendances() et getAttendancesByResidentId() pour inclure les infos du forfait
- [x] Implémenter l'affichage en rouge dans AttendanceManagement (liste des pointages)
- [x] Ajouter un compteur "Heures hors forfait" sur la page de profil du résident
- [x] Marquer en rouge les sessions hors forfait dans l'historique des pointages (ResidentProfile)
- [x] Marquer en rouge les pointages hors forfait dans le Dashboard
- [x] Tester l'affichage dans tous les endroits - Succès !

## Ne Plus Décompter Heures des Forfaits Expirés par Date
- [x] Modifier la logique de checkout (checkIn avec checkout automatique) pour ne pas décompter les heures si le forfait est expiré par date
- [x] Modifier la logique de checkout explicite pour ne pas décompter les heures si le forfait est expiré par date
- [x] Calculer et afficher les heures hors forfait lors de la création d'un nouveau forfait
- [x] Ajouter un avertissement si des heures hors forfait existent
- [x] Ajouter une option pour déduire les heures hors forfait du nouveau forfait
- [x] Tester avec un forfait expiré par date (enka enka) - Succès !

## Détecter Heures Hors Forfait pour Forfaits Épuisés par Heures
- [x] Vérifier la logique actuelle de détection des heures hors forfait (isOutOfPackage)
- [x] Identifier que la logique détecte uniquement les forfaits expirés par date
- [x] Modifier isOutOfPackage dans AttendanceManagement.tsx pour détecter aussi les forfaits épuisés
- [x] Modifier isOutOfPackage dans ResidentProfile.tsx pour détecter aussi les forfaits épuisés
- [x] Modifier isOutOfPackage dans Dashboard.tsx pour détecter aussi les forfaits épuisés
- [x] Ajouter packageUsedHours dans getAllAttendances() et getAttendancesByResidentId()
- [x] Modifier la logique de checkout automatique pour ne pas décompter si le forfait est épuisé
- [x] Modifier la logique de checkout explicite pour ne pas décompter si le forfait est épuisé
- [x] Tester avec Nicolas Klein (forfait épuisé par heures) - Succès !

## Diagnostic Problème Affichage Heures Hors Forfait Nicolas Klein
- [x] Vérifier l'état actuel du forfait de Nicolas Klein (usedHours, totalHours, endDate)
- [x] Vérifier les pointages récents de Nicolas Klein (pointage de 10 min avec 5 min dans forfait + 5 min hors forfait)
- [x] Identifier pourquoi les heures hors forfait ne s'affichent pas (problème de plafonnement : usedHours dépassait totalHours)
- [x] Corriger le problème identifié (ajout du plafonnement dans la logique de checkout)
- [x] Tester le plafonnement avec un nouveau pointage de 10 minutes - Succès !
- [x] Vérifier que usedHours est maintenant plafonné à 900 minutes (totalHours) - Succès !
- [x] Corriger la détection isOutOfPackage() pour utiliser packageUsedHours correctement - Succès !

## Correction Détection isOutOfPackage() pour Affichage Rouge
- [x] Analyser la logique actuelle de détection isOutOfPackage() dans tous les fichiers frontend
- [x] Vérifier que packageUsedHours est bien retourné par le backend pour chaque pointage
- [x] Comprendre que packageUsedHours est l'état ACTUEL (après tous les pointages), pas l'état au moment du check-in
- [x] Simplifier la logique : si packageUsedHours >= packageTotalHours, alors hors forfait (grâce au plafonnement)
- [x] Corriger la logique dans AttendanceManagement.tsx
- [x] Corriger la logique dans ResidentProfile.tsx
- [x] Corriger la logique dans Dashboard.tsx
- [x] Tester avec Nicolas Klein (pointage de 10 min s'affiche en rouge) - Succès !
- [x] Vérifier l'affichage dans tous les endroits (Dashboard, Gestion Pointages, Profil) - Succès !

## Correction Affichage Compteur Heures Hors Forfait et Déduction
- [x] Analyser le code de l'affichage du forfait actif dans ResidentProfile.tsx
- [x] Identifier pourquoi le compteur "Heures hors forfait" ne s'affiche pas (logique ne détectait que les forfaits expirés par date)
- [x] Corriger l'affichage du compteur d'heures hors forfait (ajout détection forfaits épuisés par heures)
- [x] Analyser le code de déduction des heures hors forfait dans ResidentPackages.tsx
- [x] Identifier pourquoi la déduction ne fonctionne pas (même problème : logique ne détectait que les forfaits expirés par date)
- [x] Corriger la logique de déduction des heures hors forfait (ajout détection forfaits épuisés par heures)
- [x] Tester avec Nicolas Klein : compteur affiche 0h19 en rouge - Succès !
- [x] Tester la déduction : dialogue affiche "0h19 d'heures hors forfait" - Succès !

## Empêcher la Déduction Multiple des Heures Hors Forfait
- [x] Analyser le code actuel de déduction dans ResidentPackages.tsx
- [x] Identifier comment les heures hors forfait sont calculées (parcourt TOUS les pointages sans filtrer par forfait)
- [x] Concevoir une solution pour marquer les heures comme "déjà déduites"
- [x] Option 1 : Ajouter un champ `deductedInPackageId` dans la table `attendances` (rejetée : trop complexe)
- [x] Option 2 : Calculer les heures hors forfait uniquement pour le dernier forfait expiré (choisie)
- [x] Implémenter la solution dans ResidentPackages.tsx (ajout filtre `attendance.packageId !== lastPackage.id`)
- [x] Implémenter la solution dans ResidentProfile.tsx (ajout filtre `att.packageId !== activePackageId`)
- [x] Tester avec Nicolas Klein : 1er forfait créé avec déduction (15h - 0h19 = 14h41) - Succès !
- [x] Tester avec Nicolas Klein : 2e forfait créé SANS dialogue d'avertissement - Succès !
- [x] Vérifier que les 0h19 ne sont pas comptées deux fois - Succès !

## Bug : Déduction Multiple Persiste Après Création Nouveau Forfait (Enta Enka)
- [ ] Analyser le profil d'Enta Enka et ses forfaits
- [ ] Vérifier l'historique des forfaits créés
- [ ] Identifier pourquoi le filtre `packageId` ne fonctionne pas
- [ ] Hypothèse 1 : Les pointages hors forfait appartiennent au nouveau forfait créé (pas à l'ancien)
- [ ] Hypothèse 2 : Le `lastPackage` n'est pas le bon forfait à utiliser pour le filtre
- [ ] Corriger la logique de filtrage
- [ ] Tester avec Enta Enka : créer 1er forfait avec déduction
- [ ] Tester avec Enta Enka : créer 2e forfait → vérifier qu'aucune heure n'est proposée

## Tests Finaux - Déduction Unique Heures Hors Forfait (Enta Enka)
- [x] Corriger l'initialisation de deductOutOfPackageHours à true (au lieu de false)
- [x] Corriger la réinitialisation à true après création/annulation
- [x] Corriger la logique pour trouver le dernier forfait expiré (au lieu du premier forfait)
- [x] Ajouter vérification hasActivePackageWithDeduction pour éviter double déduction
- [x] Tester avec Enta Enka : 1er forfait créé avec déduction (15h - 0h03 = 14h57) - Succès !
- [x] Tester avec Enta Enka : 2e forfait créé SANS dialogue (grâce à hasActivePackageWithDeduction) - Succès !
- [x] Vérifier que les 0h03 ne sont comptées qu'une seule fois - Succès !

## Marquer Explicitement les Heures Déduites (Champ deductedMinutes)
- [x] Ajouter un champ `deductedMinutes` (int, nullable) dans la table `packages`
- [x] Exécuter la migration avec `pnpm db:push` - Succès !
- [x] Modifier le backend (routers.ts) pour enregistrer `deductedMinutes` lors de la création du forfait
- [x] Modifier le frontend (ResidentPackages.tsx) pour vérifier `deductedMinutes` au lieu de `usedHours`
- [x] Tester avec Enta Enka : 1er forfait créé avec déduction (0h03 utilisées, 14h57 restantes) - Succès !
- [x] Tester avec Enta Enka : 2e forfait créé SANS dialogue (0h utilisées, 15h restantes) - Succès !
- [x] Tester avec Enta Enka : 3e forfait créé SANS dialogue (0h utilisées, 15h restantes) - Succès !
- [x] Vérifier que les 0h03 ne sont comptées qu'une seule fois - Succès !

## Empêcher la Création d'un Nouveau Forfait si un Forfait est Déjà Actif
- [x] Modifier le frontend (ResidentPackages.tsx) pour désactiver le bouton "Nouveau Forfait" si un forfait actif existe
- [x] Ajouter un message d'information expliquant pourquoi le bouton est désactivé
- [x] Ajouter une validation backend (routers.ts) pour empêcher la création si un forfait actif existe
- [x] Tester avec Enta Enka : le bouton est bien désactivé et le message s'affiche - Succès !
- [x] Validation backend fonctionne : erreur lancée si tentative de création avec forfait actif

## Afficher les Heures Hors Forfait en Rouge dans l'Historique des Pointages (Page Gérer les Forfaits)
- [x] Analyser le code de l'historique des pointages dans ResidentPackages.tsx
- [x] Ajouter la logique de détection des heures hors forfait (packageUsedHours >= packageTotalHours)
- [x] Appliquer le style rouge pour les pointages hors forfait dans la colonne "Durée" avec label "(Hors forfait)"
- [x] Tester avec Enta Enka : pointage de 0h04 affiché en rouge avec "(Hors forfait)" - Succès !

## Bug : Impossible de Créer un Nouveau Forfait si le Forfait Actuel est Expiré
- [x] Analyser la logique de détection des forfaits actifs dans ResidentPackages.tsx
- [x] Identifier pourquoi les forfaits expirés sont considérés comme "actifs" (logique vérifiait seulement isActive, pas remainingHours)
- [x] Modifier la logique pour qu'un forfait expiré ne soit plus considéré comme "actif" (ajout condition remainingHours > 0)
- [x] Tester avec Enta Enka : le bouton "Nouveau Forfait" est activé et le message disparaît - Succès !

## Bug : Validation Backend Empêche la Création de Forfait même si le Forfait est Expiré
- [x] Vérifier la validation backend dans routers.ts
- [x] Identifier la logique de validation qui bloque la création
- [x] Modifier getActivePackageByResidentId pour filtrer les forfaits expirés (ne fonctionne pas correctement)
- [x] Désactivation manuelle du forfait expiré d'enka enka pour débloquer - Succès !
- [x] Solution permanente : Désactivation automatique lors du checkout si remainingMinutes <= 0

## Solution Permanente : Désactivation Automatique des Forfaits Expirés
- [x] Comprendre pourquoi getActivePackageByResidentId ne filtre pas correctement (problème de cache tsx watch)
- [x] Ajouter une désactivation automatique des forfaits expirés lors du checkout (lignes 693-698 routers.ts)
- [ ] Tester la solution avec un nouveau résident qui épuise son forfait
- [ ] Vérifier que la création de forfait fonctionne sans désactivation manuelle

## Bug : Désactivation Automatique ne Fonctionne pas Après Checkout (enka enka)
- [x] Vérifier l'état du forfait d'enka enka dans la base de données (isActive = 1, remainingHours = 0)
- [x] Redémarrer le serveur pour appliquer les modifications
- [x] Test 1 : Épuiser un forfait et vérifier la désactivation automatique - Échec !
- [x] Désactivation manuelle du forfait pour débloquer - Succès !
- [x] Test 2 : Créer un nouveau forfait et l'épuiser - Échec à nouveau !
- [ ] Identifier pourquoi le code de désactivation automatique ne s'exécute pas

## Problème Persistant : Impossible de Créer un Nouveau Forfait pour enka enka (Forfait Expiré)
- [ ] Vérifier l'état exact du forfait d'enka enka dans la base de données (isActive, remainingHours)
- [ ] Vérifier si le cache du navigateur est la cause du problème
- [ ] Identifier pourquoi le forfait expiré bloque toujours la création malgré les corrections
- [ ] Implémenter une solution définitive (désactivation automatique + fix validation backend)
- [ ] Tester avec enka enka et confirmer que la création fonctionne

## Cumul et Déduction Heures Hors Forfait
- [ ] Calculer le cumul des heures hors forfait pour chaque résident
- [ ] Afficher le cumul des heures hors forfait dans la case "Forfait Actif" (en rouge)
- [ ] Ajouter une case à cocher dans le formulaire de création de forfait pour déduire les heures hors forfait
- [ ] Implémenter la déduction automatique des heures hors forfait lors de la création d'un nouveau forfait
- [ ] Remettre à zéro le compteur d'heures hors forfait après déduction

## Cumul et Déduction Heures Hors Forfait
- [x] Créer une procédure backend pour effacer les heures hors forfait (plafonner usedHours à totalHours)
- [x] Modifier le frontend pour appeler cette procédure quand la fenêtre est fermée sans cocher
- [x] Mettre à jour la procédure de création pour marquer les heures comme déduites
- [x] Tester le scénario 1 : case cochée, heures déduites
- [x] Tester le scénario 2 : fenêtre fermée, heures effacées

## Bug : Dialogue de déduction des heures hors forfait
- [x] Investiguer pourquoi le dialogue ne s'affiche pas lors de la création d'un nouveau forfait
- [x] Corriger la logique d'affichage du dialogue
- [x] Tester avec enka enka qui a des heures hors forfait
- [x] Ajouter l'invalidation du cache getOutOfPackageHours après checkout
- [x] Créer un test automatisé complet pour valider la fonctionnalité
- [x] Exécuter le test et corriger les éventuels problèmes
- [x] Nettoyer les logs de débogage

## Bug : Heures hors forfait non affichées après pointage
- [x] Vérifier les données dans la base de données pour enka enka
- [x] Diagnostiquer pourquoi les heures hors forfait ne sont pas affichées
- [x] Créer un test avec 4 minutes hors forfait enregistrées en base
- [x] Identifier la cause racine : conversion heures/minutes manquante
- [x] Implémenter la correction : multiplier par 60
- [x] Corriger aussi pour inclure les forfaits actifs
- [x] Valider que le serveur a bien rechargé le code
- [x] Tester depuis l'interface utilisateur (ne fonctionne toujours pas)
- [x] Effacer toute la base de données pour recommencer
- [ ] Ajouter des alertes pour diagnostiquer le problème
- [ ] Identifier la cause racine
- [ ] Corriger et valider

## Corrections Critiques (Analyse du Code)

- [x] Clarifier totalHours/usedHours avec commentaires et helpers (approche sécurisée)
- [x] Optimiser getOutOfPackageHoursByResidentId pour éliminer les requêtes N+1
- [x] Extraire la logique de checkout dupliquée dans une fonction commune
- [x] Supprimer le code mort (lastExpiredPackage non utilisé)

## Corrections Incohérences Logiques et Performance

- [x] Utiliser les helpers dans checkoutLogic.ts pour unifier la logique d'expiration
- [x] Optimiser l'affichage des heures hors forfait dans Residents.tsx (1 requête au lieu de N)

## Corrections Urgentes (Analyse Post-Corrections)

- [x] Supprimer le code de débogage dans ResidentPackages.tsx (alert popup)
- [x] Corriger la sérialisation tRPC de getAllOutOfPackageHours (Map → objet)

## Corrections Autres Problèmes (Analyse Post-Corrections)

- [x] Ajouter les contraintes de clés étrangères dans le schéma
- [x] Remplacer les types any par des types stricts
- [x] Ajouter la gestion des erreurs SQL avec try/catch
- [x] Utiliser le helper formatMinutesAsHours dans le frontend
- [x] Ajouter des index sur les colonnes de recherche

## Corrections Problèmes Mineurs (Analyse Finale)

- [x] Ajouter les contraintes FK dans emailLogs et notes
- [x] Remplacer any par Resident | null dans Residents.tsx
- [x] Ajouter des validations Zod strictes dans les mutations tRPC
- [x] Créer des tests unitaires pour les fonctions critiques
- [x] Centraliser les constantes magiques dans shared/constants.ts
- [x] Implémenter un système de logging structuré avec pino

## Correction Email de Session

- [x] Corriger les variables manquantes dans l'email de session (firstName, duration, dashboardUrl)

## Correction Template Email Session (Base de Données)

- [x] Mettre à jour le template d'email de session en base de données pour utiliser les doubles accolades {{variable}}

## Correction Dialogue Déduction Heures Hors Forfait

- [ ] Diagnostiquer pourquoi le dialogue de déduction n'apparaît pas lors de la création d'un nouveau forfait après expiration
- [ ] Corriger la logique de détection des heures hors forfait

## Correction Dialogue Déduction Heures Hors Forfait

- [x] Corriger le problème où la proposition de déduction des heures hors forfait n'apparaît pas lors de la création d'un nouveau forfait après expiration (utiliser la valeur du backend au lieu du calcul local)

## Correction Dialogue Déduction (Test 3 Minutes)

- [ ] Diagnostiquer pourquoi le dialogue ne s'affiche pas malgré l'affichage correct de 3 minutes hors forfait
- [ ] Corriger la logique de détection dans ResidentPackages.tsx

## Correction Pointage Normal (Heures Hors Forfait)

- [x] Diagnostiquer pourquoi le pointage normal ne détecte pas le dépassement
- [x] Corriger la logique de checkout pour permettre le dépassement de usedHours

## Simplification de la logique des heures hors forfait

- [x] Analyser la logique actuelle (calculs complexes dans getOutOfPackageHoursByResidentId)
- [x] Simplifier pour additionner les heures hors forfait à chaque pointage
- [x] Stocker le cumul dans un champ dédié (outOfPackageMinutes dans residents)
- [x] Proposer la déduction lors de la création d'un nouveau forfait
- [x] Tester la nouvelle logique simplifiée

## Correction Suppression Pointage (Heures Hors Forfait)

- [x] Analyser la logique actuelle de suppression de pointage
- [x] Modifier la logique pour recalculer outOfPackageMinutes lors de la suppression
- [x] Tester la correction avec suppression de pointages hors forfait

## Correction Erreur Création Pointage Manuel

- [x] Analyser l'erreur SQL lors de la création manuelle de pointage
- [x] Corriger la procédure attendances.create dans routers.ts (packageId nullable)
- [x] Tester la création manuelle de pointage

## Correction Affichage Pointages Sans Forfait

- [x] Modifier getAttendancesByResidentId pour utiliser leftJoin au lieu de innerJoin
- [x] Corriger les erreurs TypeScript dans les composants React
- [x] Tester l'affichage des pointages sans forfait

## Recalcul Heures Lors Modification Pointage

- [x] Analyser la procédure de modification de pointage existante (attendances.update)
- [x] Ajouter la logique de recalcul des heures du forfait (usedHours)
- [x] Ajouter la logique de recalcul des heures hors forfait (outOfPackageMinutes)
- [ ] Tester la modification avec recalcul des heures

## Correction Création Pointage (Heure de Départ Non Enregistrée)

- [x] Analyser le formulaire de création dans l'historique des pointages
- [x] Vérifier la procédure backend attendances.create
- [x] Identifier pourquoi checkOutTime n'est parfois pas enregistré (dates invalides)
- [x] Corriger le problème de validation (ajout de isNaN check)
- [ ] Tester la création de pointage avec heure de départ

## Correction Création Manuelle Pointage (outOfPackageMinutes)

- [x] Analyser la procédure attendances.create pour voir comment elle traite les heures
- [x] Ajouter la logique de calcul de outOfPackageMinutes (comme dans checkoutLogic.ts)
- [ ] Tester la création manuelle avec forfait expiré ou épuisé

## Recalcul Automatique des Heures Hors Forfait
- [x] Créer une fonction recalculateOutOfPackageHours() pour recalculer les heures hors forfait
- [x] Intégrer le recalcul dans les opérations CRUD de pointages (create, update, delete)
- [x] Modifier la logique pour inclure les pointages orphelins (sans packageId)
- [x] Modifier la logique pour utiliser le dernier forfait (actif OU expiré)
- [x] Ajouter l'invalidation automatique du cache tRPC après les opérations
- [x] Afficher le total des heures hors forfait dans la section Forfait Actif
- [x] Ajouter validation pour empêcher la création de pointages avant le début du forfait

## Correction Affichage Pointages Hors Forfait
- [x] Corriger la logique d'affichage dans l'onglet Historique des Pointages pour que les nouveaux pointages hors forfait s'affichent en rouge

## Bug Création Pointage
- [ ] Corriger la création manuelle de pointage : l'heure de départ n'est pas prise en compte

## Affichage Détaillé Durée Hors Forfait
- [x] Afficher dans l'historique des pointages la durée dans le forfait + durée hors forfait entre parenthèses en rouge pour les pointages dépassant le forfait

## Correction Affichage Heures Restantes
- [x] Afficher 0 au lieu d'une valeur négative pour les heures restantes sur la page informations du résident

## Correction Affichage Heures Restantes (Espace Résident)
- [x] Afficher 0 au lieu d'une valeur négative pour les heures restantes dans l'espace résident (ResidentDashboard)

## Correction Heures Utilisées dans Gérer les Forfaits
- [x] Corriger l'affichage des heures utilisées pour refléter le total réel des pointages (hors forfait inclus)

## Suppression Onglet Historique des Forfaits
- [x] Supprimer l'onglet "Historique des Forfaits" de la page profil du résident

## Correction Heures Restantes dans la Liste des Résidents
- [x] Afficher 0 au lieu d'une valeur négative pour les heures restantes dans la page gestion des résidents

## Heures Hors Forfait dans Gérer les Forfaits
- [x] Afficher les heures hors forfait en rouge entre parenthèses à côté des heures utilisées dans la page Gérer les Forfaits

## Synchronisation usedHours en base
- [x] Synchroniser usedHours en base avec la somme réelle des pointages à chaque checkout

## Numéro d'Étagère et Signature Artistique
- [x] Ajouter shelfNumber et artistSignature dans le schéma DB et migrer
- [x] Ajouter le champ numéro d'étagère dans le formulaire d'inscription résident
- [x] Afficher le numéro d'étagère sur la page profil résident
- [x] Créer un composant de dessin de signature tactile (canvas)
- [x] Intégrer la signature dans le formulaire d'inscription et la page profil

## Correction Affichage Hors Forfait Nouveau Forfait
- [x] Corriger l'affichage incorrect lors de la création d'un nouveau forfait avec la case "Ne pas ajouter les heures hors forfait" cochée

## Remise à zéro outOfPackageMinutes à la suppression de forfait
- [x] Remettre à zéro outOfPackageMinutes lors de la suppression d'un forfait contenant des heures hors forfait

## Correction Affichage Soustraction Heures dans Gérer les Forfaits
- [x] Corriger l'affichage des heures après soustraction sur la page Gérer les Forfaits (non reflété immédiatement)

## Remise à zéro heures hors forfait à la suppression (bug persistant)
- [x] Corriger la remise à zéro de outOfPackageMinutes lors de la suppression d'un forfait (recalculateOutOfPackageHours ne fonctionne pas correctement)

## Rafraîchissement automatique des pages après mutations
- [x] Ajouter l'invalidation du cache tRPC après chaque mutation dans toutes les pages principales

## Remise à zéro outOfPackageMinutes - bug persistant (2e tentative)
- [x] Corriger définitivement la remise à zéro de outOfPackageMinutes lors de la suppression d'un forfait

## Bugs critiques page Gérer les Forfaits (production)
- [x] Les heures hors forfait s'affichent encore après création d'un nouveau forfait avec case décochée
- [x] Soustraction/ajout d'heures non reflété correctement sur la page
- [x] Le rechargement de page ne corrige pas l'affichage (problème de données en base)

## Harmonisation du calcul des heures (source unique serveur)
- [x] Créer un calcul unifié côté serveur (usedMinutes, remainingMinutes, outOfPackageMinutes) pour chaque forfait
- [x] Mettre à jour toutes les pages frontend pour utiliser ces valeurs calculées côté serveur

## Bug Création Manuelle Pointage - Heure de Fin
- [x] Corriger la création manuelle de pointage : l'heure de fin n'est pas prise en compte

## Bug Heures Hors Forfait non affichées dans Gérer les Forfaits (nouveau forfait après expiration)
- [x] Corriger l'affichage des heures hors forfait dans Gérer les Forfaits après création d'un nouveau forfait suite à expiration de l'ancien

## Règles de cohérence des pointages
- [x] Bloquer le check-in côté serveur si le résident n'a pas de forfait actif (erreur explicite)
- [x] Supprimer les pointages en cascade lors de la suppression d'un forfait

## Code couleur par forfait dans l'historique des pointages
- [x] Implémenter un code couleur par forfait dans l'historique des pointages de ResidentPackages
- [x] Implémenter un code couleur par forfait dans l'historique des pointages de ResidentProfile
- [x] Ajouter une légende des couleurs associant chaque couleur à un forfait

## Recalcul des heures à chaque modification de pointage
- [ ] Créer une fonction recalculatePackageHours(packageId) côté serveur
- [ ] Appeler recalculatePackageHours après checkOut, update attendance, delete attendance
- [ ] Valider le dépassement du total d'heures du forfait et retourner une erreur explicite
- [ ] Invalider les caches tRPC côté client après chaque mutation pour rafraîchir l'affichage

## Alignement Profil Résident - Historique des pointages
- [ ] Même code couleur par forfait dans l'onglet Historique des pointages de ResidentProfile
- [ ] Badge hors forfait chronologique dans ResidentProfile
- [ ] CRUD complet (créer/modifier/supprimer) des pointages dans ResidentProfile
- [ ] Bouton Recalculer dans la page Gérer les Forfaits
- [x] Tri dans la page Gestion des Résidents : par prénom, par nom, par forfait, par heures restantes, par date de fin de forfait

## Réorganisation des boutons dans ResidentPackages
- [x] Déplacer 'Nouveau Pointage' de ResidentProfile vers ResidentPackages (case Historique des Pointages)
- [x] Déplacer 'Recalculer' de la case Forfaits vers la case Historique des Pointages dans ResidentPackages

## Unicité du forfait actif
- [ ] Renforcer la règle : un résident ne peut avoir qu'un seul forfait actif à la fois (bloquer côté serveur et côté client)

## Centralisation modification/suppression des pointages
- [x] Ajouter boutons Modifier et Supprimer dans l'historique des pointages de ResidentPackages
- [x] Ajouter les dialogues de modification et suppression dans ResidentPackages
- [x] Retirer les boutons Modifier et Supprimer de l'onglet Historique des Pointages dans ResidentProfile

## Enrichissement de la page Statistiques
- [x] Ajouter la procédure tRPC getPackageStats côté serveur (forfaits par catégorie, par mois, revenus, expirés)
- [x] Ajouter les filtres de période (mois/trimestre/année/tout) et sélecteur de résident
- [x] Afficher les cards résumé : forfaits vendus, chiffre d'affaires, expirés prématurément, expirés par date
- [x] Ajouter le graphique forfaits par catégorie (BarChart horizontal)
- [x] Ajouter le graphique évolution mensuelle (LineChart double axe)
- [x] Ajouter le tableau revenus par type de forfait
- [x] Ajouter le tableau des forfaits expirés par date avec heures perdues
- [x] Ajouter le tableau détaillé par résident (forfaits, revenus, expirés, heures perdues)

## Correction badge Expiré
- [x] Corriger le badge "Expiré" en rouge dans la liste des forfaits de ResidentPackages (était gris)

## Gestion des Types de Forfaits Configurables
- [x] Créer la table packageTypes dans le schéma Drizzle
- [x] Ajouter les helpers CRUD dans db.ts
- [x] Ajouter le router tRPC packageTypes (list, getActive, create, update, delete)
- [x] Ajouter la section Types de Forfaits dans la page Paramètres
- [x] Utiliser les types dynamiques dans le formulaire de création de forfait résident
- [x] Rétro-compatibilité avec les types statiques existants (15h_8w, 30h_8w, etc.)
- [x] Mettre à jour getPackageLabel pour afficher les labels des types dynamiques

## Modification des Forfaits Existants
- [ ] Ajouter une procédure tRPC pour modifier le type/heures/dates d'un forfait existant
- [ ] Ajouter un bouton et dialog de modification dans ResidentPackages
- [ ] Permettre de changer le type (statique ou dynamique), les heures totales et la date de fin
- [x] Liens de paiement configurables dans les réglages (champ paymentLinks dans atelierSettings, section dédiée dans Paramètres, emails utilisent les liens configurés)
- [x] Optimisation mobile paysage 16:9 : sidebar icônes seules, layout CheckIn horizontal, CSS compact, méta-tags viewport
- [x] Suppression des liens de paiement codés en dur dans les templates d'emails (reminder, expiration) — remplacés par {{paymentLinks}} injecté depuis les paramètres
