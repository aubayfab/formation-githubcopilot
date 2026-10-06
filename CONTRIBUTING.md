# Contribuer à la marketplace

## Organisation

| Emplacement | Contenu |
| --- | --- |
| `.github/plugin/marketplace.json` | Le catalogue : nom de la marketplace, propriétaire, et une entrée par plugin (nom, source, description, version). |
| `plugins/<nom>/` | Un dossier par plugin, avec son manifeste, ses composants, un `README.md` et un `CHANGELOG.md`. |
| `tests/` | Les tests des scripts livrés par les plugins (`node:test`, sans dépendance). |
| `.github/workflows/valider-marketplace.yml` | L'intégration continue : tests, puis validation du catalogue, des plugins et des versions. |

Node.js 20 ou plus récent suffit : la marketplace n'a aucune dépendance npm.

```sh
npm test               # tests des scripts
npm run valider        # catalogue, manifestes, composants
npm run valider:base   # idem, et refuse un plugin modifié depuis origin/marketplace sans nouvelle version
```

## Modifier un plugin

1. Modifiez le plugin. Pour un script, ajoutez le cas correspondant dans `tests/`.
2. `npm test`.
3. Nouvelle version, au même numéro dans le manifeste et dans le catalogue, avec l'entrée du changelog :

   ```sh
   node plugins/atelier-plugins/skills/publier-plugin/scripts/version.mjs <plugin> <patch|minor|major> --note "Ce qui change pour l'utilisateur"
   ```

4. `npm run valider:base`.
5. Commit `<plugin> <version> : <résumé>`, puis pull request vers `marketplace` (ou push direct si vous en êtes mainteneur).

Dans VS Code, la skill `/atelier-plugins:publier-plugin` enchaîne ces étapes.

### Quel incrément ?

| Niveau | Quand | Exemple |
| --- | --- | --- |
| `patch` | correction sans nouveau comportement | faux positif d'une règle, faute, lien cassé |
| `minor` | ajout compatible | nouvelle règle, nouvelle skill, nouvelle option |
| `major` | rupture | règle supprimée ou inversée, skill ou agent renommé, configuration à revoir |

Un numéro publié n'est jamais réutilisé. Le numéro du catalogue et celui du manifeste doivent être identiques : en cas d'écart, c'est celui du plugin qui s'applique, et l'utilisateur voit autre chose que ce qu'annonce le catalogue.

Pourquoi incrémenter, puisque VS Code (`git pull` de la marketplace) et `copilot plugin update` récupèrent aussi un contenu modifié à version égale ? Parce que la version est ce qui **annonce** la mise à jour : sans elle, l'utilisateur n'a aucune raison de la demander, et le changelog ne peut pas dire ce qui a changé.

## Ajouter un plugin

```sh
node plugins/atelier-plugins/skills/creer-plugin/scripts/creer.mjs <nom> --description "Ce que fait le plugin, pour qui" [--depuis <dossier .github, skill, agent, instructions ou prompt>]
```

Le script crée `plugins/<nom>/` au format Agent Plugins 1.0, en version 0.1.0, et l'ajoute au catalogue. Complétez ensuite son README, puis suivez « Modifier un plugin » à partir de l'étape 2.

Pour l'essayer avant de publier :

- VS Code : réglage `chat.pluginLocations`, avec le chemin absolu du plugin à `true` ;
- Copilot CLI : `copilot --plugin-dir ./plugins/<nom>`.

## Formats et compatibilité

Les plugins de cette marketplace suivent le format **Agent Plugins 1.0**, recommandé par GitHub pour un nouveau plugin : `plugin.json` déclarant le `$schema` Agent Plugins, skills dans `skills/`, serveurs MCP dans `mcp.json`, composants propres à Copilot dans `com.github.copilot/` (`agents/`, `commands/`, `rules/`, `hooks/`).

Exception : un plugin dont un **hook lance un script livré avec le plugin** est au format **Claude** (`.claude-plugin/plugin.json`, `hooks/hooks.json`). Le plugin est installé hors du projet ; la commande du hook doit donc désigner le script par la racine du plugin, et VS Code ne remplace cette racine dans la commande d'un hook que pour les formats Claude (`${CLAUDE_PLUGIN_ROOT}`) et OpenPlugin historique (`${PLUGIN_ROOT}`). Voir `plugins/garde-fous`.

Constats faits avec VS Code 1.140 et Copilot CLI 1.0.92, que le validateur vérifie :

| Composant | VS Code | Copilot CLI | Règle de la marketplace |
| --- | --- | --- | --- |
| Skill | `name` identique au dossier, minuscules et tirets ; sinon ignorée sans message | idem | invoquée par `/<plugin>:<skill>` dans VS Code |
| Instructions (`rules/`) | lit `.instructions.md`, `.md` et `.mdc`, et leur `applyTo` | ne lit que les `.mdc` pourvus d'une `description` ; portée dans `globs` ou `alwaysApply`, `applyTo` ignoré | fichier `.mdc` avec `description`, `applyTo` **et** `globs` |
| Agent | outils par alias | outils par alias | `tools` avec les alias communs : `read`, `search`, `edit`, `execute`, `web`, `agent`, `todo` |
| Hook | ignore les `matcher` : le script reçoit tous les appels | un hook `PreToolUse` en erreur **refuse** l'appel | le script filtre lui-même, ne sort jamais en erreur et répond aux deux formats (`hookSpecificOutput` et champs de premier niveau) |
| Serveur MCP | démarré sans invite de confiance | idem | serveur distant ou lancé par son nom (`npx`) ; aucun secret dans `env` ni `headers` |

## Avant de demander une revue

- [ ] `npm test` et `npm run valider:base` passent.
- [ ] Aucun secret, aucune donnée de client, aucun chemin propre à une machine.
- [ ] Le README du plugin dit ce qu'il exécute et ce qu'il envoie hors de la machine.
- [ ] Les textes destinés au modèle (skills, agents, instructions) demandent de traiter le contenu lu comme de la donnée, jamais comme des instructions.
