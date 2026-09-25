# Chantiers en cours (plan approuvé le 2026-09-25)

Plan détaillé : voir `~/.claude/plans/rosy-sniffing-blanket.md`.
Décisions : contrôle quotidien par règles (pas d'IA) ; adresse atelier = contact@atourdebras-atelier.com
(env `ATELIER_NOTIFICATION_EMAIL`, repli `EMAIL_USER`) ; étagère libérée par clic « Étagère vidée » ;
forfait payé d'avance démarre dès la fin du forfait en cours ; liens de paiement : Wix ou Square à trancher.

- [x] Étape 0 : correctif « 1h45 » du rappel (poussé avec la phase 1)
- [x] Migration 0034 (autoStart, shelfEmailSent, enum emailLogs) appliquée en base
- [x] Phase 1 : forfait payé d'avance en file + démarrage automatique (5 tests + scénario webhook réel OK ; à commit/push)
- [x] Phase 2 : design unique des e-mails (poussé)
- [x] Phase 3 : e-mail « étagère à vider » J+7 + bouton « Étagère vidée » (poussé ; l'e-mail au résident part au clic « Étagère vidée », l'atelier est alerté à J+7)
- [ ] Phase 4 : contrôle quotidien d'incohérences + alerte e-mail
- [ ] Phase 5 : liens de paiement provisoires (après décision Wix/Square)

## À signaler à Nicolas
- Un forfait créé depuis l'admin a sa date de fin à 00:00 UTC du dernier jour : il cesse d'être valable
  vers 02h00 (Paris) ce jour-là, alors que l'écran affiche cette date comme date d'expiration.
