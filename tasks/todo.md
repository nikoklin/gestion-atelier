# Chantiers en cours (plan approuvé le 2026-09-25)

Plan détaillé : voir `~/.claude/plans/rosy-sniffing-blanket.md`.
Décisions : contrôle quotidien par règles (pas d'IA) ; adresse atelier = contact@atourdebras-atelier.com
(env `ATELIER_NOTIFICATION_EMAIL`, repli `EMAIL_USER`) ; étagère libérée par clic « Étagère vidée » ;
forfait payé d'avance démarre dès la fin du forfait en cours ; liens de paiement : Wix (clé d'API WIX_API_KEY + WIX_SITE_ID dans Railway).

- [x] Étape 0 : correctif « 1h45 » du rappel (poussé avec la phase 1)
- [x] Migration 0034 (autoStart, shelfEmailSent, enum emailLogs) appliquée en base
- [x] Phase 1 : forfait payé d'avance en file + démarrage automatique (5 tests + scénario webhook réel OK ; à commit/push)
- [x] Phase 2 : design unique des e-mails (poussé)
- [x] Phase 3 : e-mail « étagère à vider » J+7 + bouton « Étagère vidée » (poussé ; l'e-mail au résident part au clic « Étagère vidée », l'atelier est alerté à J+7)
- [x] Phase 4 : contrôle quotidien d'incohérences + alerte e-mail (poussé)
- [x] Phase 5 : liens de paiement Wix personnels valables 15 jours, créés au rappel (poussé ; clé à régénérer)

## Prochaine session de travail (liste du 2026-10-24)

### 1. Envoyer un e-mail à tous les résidents
- [ ] Écran admin « Annonce » : objet + message (éditeur existant `SimpleHtmlEditor`), mise en forme
      avec le design unique des e-mails (`wrapEmailHtml`)
- [ ] Choix des destinataires : résidents actifs (par défaut), option « avec forfait en cours » ;
      jamais les archivés
- [ ] Aperçu + e-mail de test à l'atelier avant l'envoi réel, puis confirmation avec le nombre de destinataires
- [ ] Envoi un par un (pas de destinataires visibles entre eux), trace dans `emailLogs` (nouveau type
      « announcement » → migration de l'enum), compte rendu envoyés / échecs
- [ ] Idée liée : proposer les créneaux de groupes du planning (point 4) dans l'annonce
      (« atelier complet samedi : stage »)

### 4. Affluence des résidents
Décisions de Nicolas : pointage inchangé (on ne demande pas l'espace), on compte les résidents présents ;
affichage dans l'espace résident uniquement ; période = maintenant + 7 jours.
- [ ] Lecture des 3 agendas Google (Initiations, front desk, back office : identifiants dans la tâche
      « Vérification hebdo planning de l'atelier ») via le compte de service Google déjà utilisé pour la
      sauvegarde Drive → Nicolas doit partager les 3 agendas avec l'e-mail du compte de service (lecture seule)
- [ ] Reprendre les règles de la tâche : réserve résidents 9 en modelage / 8 en tournage ; stage, masterclass
      et team building (« Option TB » = non confirmé) = espace privatisé ; dimanche = pas de résidents ;
      ignorer les événements « ANNULÉ – … »
- [ ] Espace résident : « N résidents à l'atelier en ce moment » + groupes / privatisations en cours,
      puis la liste des créneaux de groupes des 7 prochains jours (espace concerné, horaires)
- [ ] Ne jamais afficher de nom de client (team building) ni de participant : seulement le type de groupe
- [ ] Mise en cache de la lecture des agendas (pas un appel Google à chaque ouverture de page)
- [ ] À trancher en début de session : le nombre de résidents présents est-il visible par tous les résidents ?

### Préalable recommandé (faille de sécurité, non choisi par Nicolas à ce stade)
L'espace résident n'est pas protégé : `residentAuth.getInfo` renvoie sans connexion la fiche complète
(e-mail, téléphone, PIN, pointages) pour n'importe quel numéro de résident ; `createManualSession`,
`checkIn` et `checkOut` sont aussi ouverts à tout internet. Le point 4 ajoute des infos dans cet espace :
au minimum, ne plus renvoyer e-mail / téléphone / PIN / signature avant de commencer.

## À signaler à Nicolas
- Un forfait créé depuis l'admin a sa date de fin à 00:00 UTC du dernier jour : il cesse d'être valable
  vers 02h00 (Paris) ce jour-là, alors que l'écran affiche cette date comme date d'expiration.
