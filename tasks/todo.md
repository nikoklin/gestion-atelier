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

### Prolongation des forfaits pendant les fermetures (vacances)
Aujourd'hui : il faut faire « + Jours » forfait par forfait, sinon les résidents perdent les semaines de fermeture.
- [ ] Paramètres : liste des périodes de fermeture (du … au …, libellé ex. « Vacances de Noël »),
      ajout / modification / suppression
- [ ] À l'enregistrement d'une fermeture : chaque forfait dont la période chevauche la fermeture est
      prolongé du nombre de jours de chevauchement (fermeture partielle = prolongation partielle) ;
      forfaits en attente « payés d'avance » : leur démarrage suit la nouvelle fin du forfait en cours
- [ ] Nouveaux forfaits créés plus tard (admin ou paiement Wix) dont la période couvre une fermeture
      déjà enregistrée : prolongés automatiquement à la création
- [ ] Une même fermeture ne prolonge jamais deux fois le même forfait (garder la trace : quel forfait,
      quelle fermeture, combien de jours) ; supprimer ou raccourcir une fermeture retire la prolongation
- [ ] Recalcul derrière : rappel « fin de forfait » (remettre `reminderSent` à faux si la nouvelle date
      repousse le rappel), e-mail « étagère à vider », statut actif / terminé, contrôle de nuit
- [ ] Compte rendu avant de valider : « 12 forfaits prolongés de 14 jours, 3 de 5 jours » + bouton
      « Annuler » (historique `undoActions` existant)
- [ ] Option : prévenir les résidents concernés par e-mail (s'appuie sur le point 1, annonce)
- [ ] Tests : chevauchement total / partiel / aucun, forfait en file d'attente, double application,
      suppression de la fermeture
À trancher en début de session :
- Source des fermetures : saisie dans l'appli, ou lecture des vacances déjà notées dans l'agenda Google
  « front desk » (même accès Google que le point 4) ?
- Les dimanches et jours fériés comptent-ils dans les jours prolongés, ou seulement les jours où l'atelier
  aurait été ouvert aux résidents ?
- Un forfait qui se termine pendant la fermeture : prolongé seulement des jours restants à partir du
  début de la fermeture (logique) — à confirmer

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

### Sécurité (à faire EN PREMIER : le point 4 ajoute des infos dans l'espace résident)
Constaté le 24/10 sur une copie locale : sans aucune connexion,
`/api/trpc/residentAuth.getInfo?input={"json":{"residentId":1}}` renvoie nom, e-mail, téléphone, PIN et
pointages ; en essayant 1, 2, 3… on récupère toute la base (sujet RGPD).
- [ ] Correctif immédiat, sans effet visible pour les résidents : `getInfo` ne renvoie plus e-mail,
      téléphone, PIN, signature ni les champs internes (juste prénom, forfait, pointages) ;
      `residents.getActiveByResidentId` (public lui aussi) : même vérification
- [ ] Protéger l'espace résident : aujourd'hui `loginByEmail` ouvre l'espace avec la seule adresse e-mail
      et l'identifiant est gardé dans `localStorage` (n'importe qui peut le changer). À décider avec Nicolas :
      lien personnel secret envoyé par e-mail (session résident signée, comme pour l'admin) ou code PIN
      (le champ `pin` existe en base mais ne sert nulle part)
- [ ] `residentAuth.createManualSession` (public) : n'importe qui peut ajouter une séance sur le compte
      de n'importe quel résident et consommer ses heures → exiger la session résident ci-dessus
- [ ] `attendances.checkIn` / `checkOut` (publics) : la page de pointage utilise déjà `residents.list`
      (réservé à l'admin), donc la tablette est connectée en admin → passer ces actions en accès protégé
      ne change rien pour la tablette ; vérifier `checkOut` et `getOpenAttendances` (qui est présent)
- [ ] Tablette de pointage connectée avec le compte admin (cookie d'un an) : quelqu'un devant la tablette
      peut ouvrir /residents ou /settings. À décider : compte « tablette » limité au pointage
- [ ] Clé d'API Wix à régénérer (noté en phase 5, à confirmer que c'est fait)
- [ ] Tests : un test par point ci-dessus (accès refusé sans session, champs sensibles absents)

Autres points relevés le 24/10 (moins urgents) :
- [ ] Pas d'intégration continue : chaque envoi sur `main` part en production sans lancer les tests
      (GitHub Actions + base MySQL de test ; attention : les tests écrivent dans la base indiquée par
      DATABASE_URL, ne jamais pointer sur la base de production)
- [ ] Contrôle de nuit : envoyer aussi un e-mail « rien à signaler », sinon l'absence d'e-mail ne permet
      pas de savoir si la tâche a tourné

## À signaler à Nicolas
- Un forfait créé depuis l'admin a sa date de fin à 00:00 UTC du dernier jour : il cesse d'être valable
  vers 02h00 (Paris) ce jour-là, alors que l'écran affiche cette date comme date d'expiration.
