# Marketplace de la formation GitHub Copilot

Des plugins GitHub Copilot pour VS Code et Copilot CLI : des garde-fous pour l'agent, des tests fiables, une documentation à jour, et l'outillage pour publier vos propres plugins.

Cette branche (`marketplace`) ne contient que la marketplace : le catalogue [`.github/plugin/marketplace.json`](.github/plugin/marketplace.json) et les plugins qu'il référence, dans [`plugins/`](plugins).

## Plugins

| Plugin | Composants | À quoi il sert |
| --- | --- | --- |
| [garde-fous](plugins/garde-fous) | hook `PreToolUse` | Refuse ou soumet à confirmation les commandes destructrices, la lecture et l'envoi de secrets, et la modification de la configuration de l'agent. Chaque décision cite sa règle et propose une alternative. |
| [tests-vitest](plugins/tests-vitest) | skill, instructions, agent | Des tests Vitest déterministes, même quand le code dépend du temps, du hasard, du stockage ou du Canvas ; un rapport de tests court ; un agent testeur qui ne touche pas au code de production. |
| [docs-a-jour](plugins/docs-a-jour) | serveur MCP, skill | Fait consulter à l'agent la documentation de la version installée dans le projet (serveur Context7), source citée. |
| [atelier-plugins](plugins/atelier-plugins) | 2 skills | Créer un plugin, valider la marketplace, publier une nouvelle version sans oublier de fichier. |

Les versions à jour sont dans le catalogue et dans le `CHANGELOG.md` de chaque plugin.

## Ajouter la marketplace

La marketplace est la branche `marketplace` du dépôt `aubayfab/formation-githubcopilot`. Sa référence s'écrit donc `aubayfab/formation-githubcopilot#marketplace`, et son nom, une fois ajoutée, est `formation-copilot`.

### VS Code

1. Dans les paramètres utilisateur (**Preferences: Open User Settings (JSON)**) :

   ```json
   "chat.plugins.marketplaces": [
     "aubayfab/formation-githubcopilot#marketplace"
   ]
   ```

2. Vue **Extensions**, tapez `@agentPlugins` tel quel dans la recherche : ce filtre affiche les plugins des marketplaces configurées. Ajoutez un mot pour affiner, sans `@` (`@agentPlugins garde-fous`). **Install** sur celui qui vous intéresse. À la première installation depuis cette marketplace, VS Code demande de lui faire confiance.

   On y accède aussi par **Chat: Open Customizations**, onglet **Plugins**, **Browse Marketplace**.

Les plugins installés sont listés dans la vue **Agent Plugins - Installed**, d'où on les active, les désactive ou les désinstalle.

### Copilot CLI

```sh
copilot plugin marketplace add aubayfab/formation-githubcopilot#marketplace
copilot plugin marketplace browse formation-copilot
copilot plugin install garde-fous@formation-copilot
copilot plugin list
```

### Pour toute une équipe

Un dépôt peut recommander la marketplace et ses plugins à tous ceux qui l'ouvrent, dans `.github/copilot/settings.json` :

```json
{
  "extraKnownMarketplaces": {
    "formation-copilot": {
      "source": { "source": "github", "repo": "aubayfab/formation-githubcopilot", "ref": "marketplace" }
    }
  },
  "enabledPlugins": {
    "garde-fous@formation-copilot": true
  }
}
```

VS Code les propose au premier message de chat ; la vue Extensions les liste avec `@agentPlugins @recommended`.

## Mettre à jour

Un plugin se met à jour quand sa nouvelle version est poussée sur la branche `marketplace`.

- **VS Code** : commande **Extensions: Check for Extension Updates** ; la vérification est aussi automatique toutes les 24 heures si `extensions.autoUpdate` est actif.
- **Copilot CLI** :

  ```sh
  copilot plugin marketplace update formation-copilot
  copilot plugin update garde-fous@formation-copilot   # ou : copilot plugin update --all
  ```

## Sécurité

Un plugin exécute du code sur votre machine : ses hooks à chaque appel d'outil, ses serveurs MCP dès son activation, sans invite de confiance supplémentaire. Lisez un plugin avant de l'installer ; ceux de cette marketplace documentent dans leur README ce qu'ils exécutent et ce qu'ils envoient hors de la machine.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md). En bref : `npm test`, `npm run valider`, une nouvelle version pour chaque plugin modifié. L'intégration continue refuse un plugin modifié dont la version n'a pas changé.
