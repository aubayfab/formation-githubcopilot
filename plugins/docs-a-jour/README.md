# docs-a-jour

Le modèle connaît les bibliothèques telles qu'elles étaient à la date de son entraînement. Ce plugin lui fait consulter la documentation de la version **installée** dans le projet, et citer sa source.

## Contenu

| Composant | Emplacement | Rôle |
| --- | --- | --- |
| Serveur MCP `context7` | `mcp.json` | Serveur distant [Context7](https://context7.com) : documentation et exemples à jour de milliers de bibliothèques (Vite, Vitest, TypeScript, MDN…). Outils : `resolve-library-id`, `query-docs`. |
| Skill `consulter-doc` | `skills/consulter-doc/` | Procédure : version installée → identifiant Context7 de cette version → question précise → réponse sourcée. |
| Script `versions.mjs` | `skills/consulter-doc/scripts/` | Version installée, verrouillée et déclarée de chaque dépendance. |

## Utilisation

- `/docs-a-jour:consulter-doc vitest faux timers et requestAnimationFrame` dans le chat ;
- ou une question qui porte sur l'API d'une dépendance : la skill se charge d'après sa description.

Le serveur apparaît dans **MCP: List Servers** et ses outils dans **Configure Tools**.

## Sécurité et confidentialité

- Le serveur MCP d'un plugin démarre sans invite de confiance : installer le plugin, c'est lui faire confiance. Ici, le serveur est distant (HTTPS) : il ne s'exécute pas sur votre machine et n'accède pas à vos fichiers ; il ne reçoit que les questions que l'agent lui envoie.
- Ces questions partent chez un tiers (Upstash, éditeur de Context7). La skill interdit d'y mettre du code du projet, des secrets ou des données personnelles.
- Sans clé d'API, les quotas de Context7 sont plus bas ; une clé gratuite ([context7.com/dashboard](https://context7.com/dashboard)) les relève. Le format Agent Plugins interdit d'embarquer un secret dans `mcp.json` : pour utiliser une clé, déclarez le serveur dans votre propre configuration MCP.

## Prérequis

Accès réseau à `https://mcp.context7.com`, Node.js 20 ou plus récent pour le script.
