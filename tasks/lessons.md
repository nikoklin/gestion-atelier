# Leçons

## Tests et réglages partagés (23/10/2026)
- **Erreur :** deux fichiers de test modifiaient puis restauraient `autoPaymentLinksEnabled` dans la vraie base, en parallèle. L'entrelacement a laissé le réglage sur « désactivé » ; un vrai e-mail de rappel est parti avec les liens de secours.
- **Règle :** les tests utilisent la vraie base, réglages de l'atelier compris → `fileParallelism: false` dans `vitest.config.ts`. Après tout test qui touche `atelierSettings`, relire les réglages réels pour vérifier qu'ils sont intacts.

## Tests sur la base de production et tablette de pointage (10/11/2026)
- **Erreur :** les tests créent des résidents « TEST … » actifs dans la vraie base ; la tablette les affiche
  le temps du test. Un pointage fait sur l'un d'eux est resté en file après sa suppression : la base refusait
  la ligne (clé étrangère) → erreur 500 à chaque renvoi → toute la file de la tablette bloquée.
- **Règles :** une erreur serveur sur un pointage ne bloque que son résident ; un résident introuvable est un
  refus définitif (pas une erreur). Ne pas lancer la suite de tests pendant que l'atelier pointe ; à terme,
  une base de test séparée (voir « intégration continue » dans todo.md).
