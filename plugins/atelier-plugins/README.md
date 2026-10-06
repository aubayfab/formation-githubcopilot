# atelier-plugins

L'outillage du mainteneur de marketplace : créer un plugin, le vérifier comme le feront VS Code et Copilot CLI, puis publier une nouvelle version sans oublier un des fichiers qui la portent.

## Contenu

| Composant | Emplacement | Rôle |
| --- | --- | --- |
| Skill `creer-plugin` | `skills/creer-plugin/` | Cadrage, inventaire et reprise de composants existants dans un nouveau plugin Agent Plugins 1.0, inscrit au catalogue. |
| Script `creer.mjs` | `skills/creer-plugin/scripts/` | Crée `plugins/<nom>/`, copie skills, agents, instructions et prompts, ajoute l'entrée au catalogue sans reformater le fichier. |
| Skill `publier-plugin` | `skills/publier-plugin/` | Validation, choix du niveau de version, changelog, commit et push avec l'accord de l'utilisateur. |
| Script `valider.mjs` | `skills/publier-plugin/scripts/` | Vérifie catalogue, manifestes, skills (nom, description, liens), agents, instructions, hooks (événements, racine du plugin, scripts présents), `mcp.json` (spécification Agent Plugins 1.0) et l'accord des versions. `--base <réf>` refuse un plugin modifié sans nouvelle version. Annote les fichiers dans GitHub Actions. |
| Script `version.mjs` | `skills/publier-plugin/scripts/` | Nouvelle version dans le manifeste et dans le catalogue, entrée datée dans le CHANGELOG ; seule la ligne de version change dans les JSON. |

## Utilisation

Depuis la racine d'une marketplace ouverte dans VS Code :

- `/atelier-plugins:publier-plugin garde-fous` après une modification du plugin `garde-fous` ;
- `/atelier-plugins:creer-plugin` pour empaqueter, par exemple, les skills du dossier `.github` d'un projet.

Les scripts se lancent aussi à la main, avec Node.js 20 ou plus récent :

```sh
node <skill>/scripts/valider.mjs --base origin/marketplace
node <skill>/scripts/version.mjs garde-fous minor --note "Nouvelle règle npm-install-global"
node <skill>/scripts/creer.mjs mon-plugin --description "…" --depuis ../mon-projet/.github
```

La marketplace qui héberge ce plugin exécute `valider.mjs` dans son intégration continue.
