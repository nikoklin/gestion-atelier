# Configuration des Tâches Planifiées Automatiques

Ce guide vous explique comment configurer les tâches planifiées automatiques pour l'envoi d'e-mails et la vérification des pointages oubliés en utilisant un service externe gratuit.

## Pourquoi utiliser un service externe ?

Les tâches planifiées internes (node-cron) ne fonctionnent pas de manière fiable sur certaines plateformes d'hébergement. Pour garantir l'exécution quotidienne des tâches automatiques (envoi d'e-mails à 9h00 et vérification des pointages oubliés à 22h00), nous utilisons un service externe de cron jobs qui appelle des endpoints API sécurisés.

## Étape 1 : Récupérer vos identifiants d'authentification

Les endpoints sont sécurisés par **authentification HTTP Basic** :

- **Username** : `cron`
- **Password** : Votre clé API (variable `CRON_API_KEY`)
  - Valeur : `451041a247b2a5a84ae9a743f42a930307ff691e271b1cf2dae3fd476ebc34c1`

⚠️ **Important** : Ces identifiants doivent rester confidentiels. Ne les partagez jamais publiquement.

## Étape 2 : Récupérer l'URL de votre application

Votre application est hébergée à l'adresse suivante :

- **URL de production** : `https://gestatier-lv5dds56.manus.space`

## Étape 3 : Créer un compte sur cron-job.org

1. Allez sur [https://cron-job.org](https://cron-job.org)
2. Cliquez sur "Sign up" pour créer un compte gratuit
3. Confirmez votre adresse e-mail

## Étape 4 : Configurer les tâches planifiées

### Tâche 1 : Envoi quotidien des e-mails de rappel (9h00)

1. Dans le tableau de bord cron-job.org, cliquez sur "Create cronjob"
2. Configurez les paramètres suivants :

   - **Title** : `Gestion Atelier - Rappels quotidiens`
   - **URL** : `https://gestatier-lv5dds56.manus.space/api/cron/send-daily-reminders`
   - **Schedule** : 
     - Type : `Every day`
     - Time : `09:00` (heure de Paris/France)
   - **Request method** : `POST`
   - **Authentication** :
     - Type : `HTTP Basic Auth`
     - Username : `cron`
     - Password : `451041a247b2a5a84ae9a743f42a930307ff691e271b1cf2dae3fd476ebc34c1`

3. Cliquez sur "Create cronjob"

### Tâche 2 : Vérification des pointages oubliés (22h00)

1. Cliquez à nouveau sur "Create cronjob"
2. Configurez les paramètres suivants :

   - **Title** : `Gestion Atelier - Pointages oubliés`
   - **URL** : `https://gestatier-lv5dds56.manus.space/api/cron/check-missed-checkouts`
   - **Schedule** : 
     - Type : `Every day`
     - Time : `22:00` (heure de Paris/France)
   - **Request method** : `POST`
   - **Authentication** :
     - Type : `HTTP Basic Auth`
     - Username : `cron`
     - Password : `451041a247b2a5a84ae9a743f42a930307ff691e271b1cf2dae3fd476ebc34c1`

3. Cliquez sur "Create cronjob"

### Tâche 3 : Export quotidien des données par e-mail (23h00)

1. Cliquez à nouveau sur "Create cronjob"
2. Configurez les paramètres suivants :

   - **Title** : `Gestion Atelier - Export quotidien des données`
   - **URL** : `https://gestatier-lv5dds56.manus.space/api/cron/send-data-export`
   - **Schedule** : 
     - Type : `Every day`
     - Time : `23:00` (heure de Paris/France)
   - **Request method** : `POST`
   - **Authentication** :
     - Type : `HTTP Basic Auth`
     - Username : `cron`
     - Password : `451041a247b2a5a84ae9a743f42a930307ff691e271b1cf2dae3fd476ebc34c1`

3. Cliquez sur "Create cronjob"

## Étape 5 : Tester les tâches

Pour vérifier que tout fonctionne correctement :

1. Dans cron-job.org, cliquez sur le bouton "Execute now" à côté de chaque tâche
2. Vérifiez dans l'historique d'exécution que la réponse est :
   ```json
   {
     "success": true,
     "message": "Daily reminders sent successfully",
     "timestamp": "2025-12-10T09:00:00.000Z"
   }
   ```
3. Si vous voyez une erreur, vérifiez que :
   - L'URL est correcte
   - Les identifiants HTTP Basic sont corrects (username: `cron`, password: votre clé API)
   - Le type d'authentification est bien "HTTP Basic Auth"

## Étape 6 : Surveiller les exécutions

cron-job.org vous permet de :

- Voir l'historique de toutes les exécutions
- Recevoir des notifications par e-mail en cas d'échec
- Consulter les logs de chaque exécution

## Test manuel avec curl

Si vous souhaitez tester les endpoints manuellement depuis votre terminal :

```bash
# Test de l'endpoint ping
curl -X GET \
  -u cron:451041a247b2a5a84ae9a743f42a930307ff691e271b1cf2dae3fd476ebc34c1 \
  https://gestatier-lv5dds56.manus.space/api/cron/ping

# Test de l'envoi des rappels
curl -X POST \
  -u cron:451041a247b2a5a84ae9a743f42a930307ff691e271b1cf2dae3fd476ebc34c1 \
  https://gestatier-lv5dds56.manus.space/api/cron/send-daily-reminders

# Test de la vérification des pointages oubliés
curl -X POST \
  -u cron:451041a247b2a5a84ae9a743f42a930307ff691e271b1cf2dae3fd476ebc34c1 \
  https://gestatier-lv5dds56.manus.space/api/cron/check-missed-checkouts

# Test de l'export quotidien des données
curl -X POST \
  -u cron:451041a247b2a5a84ae9a743f42a930307ff691e271b1cf2dae3fd476ebc34c1 \
  https://gestatier-lv5dds56.manus.space/api/cron/send-data-export
```

## Alternatives à cron-job.org

Si vous préférez utiliser un autre service, voici quelques alternatives gratuites :

- **EasyCron** : [https://www.easycron.com](https://www.easycron.com)
- **cron-job.de** : [https://cron-job.de](https://cron-job.de)
- **Uptime Robot** : [https://uptimerobot.com](https://uptimerobot.com) (avec monitoring)

Tous ces services supportent l'authentification HTTP Basic de la même manière.

## Dépannage

### Les e-mails ne sont pas envoyés

1. Vérifiez que les variables `EMAIL_USER` et `EMAIL_PASSWORD` sont bien configurées dans Settings → Secrets
2. Vérifiez que les tâches s'exécutent bien dans cron-job.org (historique d'exécution)
3. Vérifiez qu'il y a bien des résidents avec des forfaits expirant dans 7 jours ou déjà expirés

### Erreur "Invalid credentials" ou "Unauthorized"

Vérifiez que :
- Le username est bien `cron`
- Le password correspond exactement à la valeur de `CRON_API_KEY`
- L'authentification est bien configurée en "HTTP Basic Auth" dans cron-job.org

### Erreur "CRON_API_KEY not configured"

La variable d'environnement n'est pas configurée. Allez dans Settings → Secrets de l'interface Manus et ajoutez `CRON_API_KEY`.

## Support

Si vous rencontrez des problèmes, consultez :

- La page Rappel de l'application (pour tester manuellement l'envoi d'e-mails)
- L'historique des e-mails dans la page Rappel
- Les logs d'exécution dans cron-job.org
