# tests-vitest

Des tests Vitest qui prouvent un comportement et donnent le même résultat à chaque exécution, y compris pour du code qui dépend du temps, du hasard, du stockage ou du Canvas.

## Contenu

| Composant | Emplacement | Rôle |
| --- | --- | --- |
| Skill `ecrire-tests` | `skills/ecrire-tests/` | Procédure : comportements listés avant le code, un test par comportement, exécution, lecture du résultat ; reproduction d'un bug par un test rouge. |
| Script `rapport-vitest.mjs` | `skills/ecrire-tests/scripts/` | Lance Vitest et résume le résultat en quelques lignes : un échec = `fichier:ligne`, nom, message. Codes de sortie 0 / 1 / 2. |
| Référence `patterns.md` | `skills/ecrire-tests/references/` | Faux timers, `requestAnimationFrame` en environnement `node`, hasard, `localStorage`, DOM et Canvas : des exemples vérifiés sous Vitest 4. |
| Instructions « Tests Vitest » | `com.github.copilot/rules/tests-vitest.mdc` | Conventions courtes, jointes automatiquement quand l'agent travaille sur un fichier `*.test.*` ou `*.spec.*`. |
| Agent `testeur` | `com.github.copilot/agents/` | N'écrit que des tests ; rend la main avec un test rouge et un bouton « Corriger le bug » vers l'agent par défaut. |

Le plugin suit le format Agent Plugins 1.0 : la skill est portable ; les instructions et l'agent, propres à Copilot, sont sous `com.github.copilot/`.

Les instructions sont un fichier `.mdc`, le seul format que Copilot CLI charge depuis un plugin. Leur portée y est écrite deux fois : `applyTo` pour VS Code, `globs` pour Copilot CLI.

## Utilisation

- `/tests-vitest:ecrire-tests src/scores/scoreStore.ts` dans le chat, ou simplement « écris les tests de scoreStore » : la skill se charge d'après sa description.
- Pour un bug : sélectionnez l'agent **testeur**, décrivez le bug, puis cliquez sur **Corriger le bug** une fois le test rouge obtenu.
- Le script se lance aussi à la main, depuis la racine d'un projet : `node <dossier de la skill>/scripts/rapport-vitest.mjs [fichiers] [--nom motif]`.

## Prérequis

Node.js 20 ou plus récent, Vitest installé dans le projet (`npm install`).
