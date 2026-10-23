# Leçons

## Tests et réglages partagés (23/10/2026)
- **Erreur :** deux fichiers de test modifiaient puis restauraient `autoPaymentLinksEnabled` dans la vraie base, en parallèle. L'entrelacement a laissé le réglage sur « désactivé » ; un vrai e-mail de rappel est parti avec les liens de secours.
- **Règle :** les tests utilisent la vraie base, réglages de l'atelier compris → `fileParallelism: false` dans `vitest.config.ts`. Après tout test qui touche `atelierSettings`, relire les réglages réels pour vérifier qu'ils sont intacts.
