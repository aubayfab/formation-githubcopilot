# Script-grader du TP 17

Ce script est fourni pour économiser : le faire générer par un agent coûte environ 200 k tokens.

Il ne note que les deux critères qu'un script vérifie mieux qu'un modèle, parce qu'il faut exécuter du code ou prouver une absence : C9 et C11. Les autres critères demandent de comprendre le déroulement du code : ils reviennent au model-grader.

## Utilisation

Depuis la racine du projet :

```sh
node evaluation/script-grader.mjs <chemin-du-clone> <id-du-jeu>
```

`<id-du-jeu>` est le nom du dossier `src/games/<id>/` du jeu évalué. Le clone doit avoir ses dépendances (`node_modules`), car C11 lance vitest. L'exécution prend quelques secondes.

## Ce que le script appelle « la logique »

La logique est `src/games/<id>/logic.ts`, plus les fichiers du jeu qu'il importe. Un jeu sans `logic.ts` obtient 0 aux deux critères.

## Critères évalués

| Critère | Vérification | Points |
| --- | --- | --- |
| C9 La logique ne fait aucun appel au DOM | aucune API du navigateur dans la logique (`document`, `window`, `localStorage`, `requestAnimationFrame`, `addEventListener`, `fetch`, types `HTML…`, etc.) | 6 |
| | la logique n'importe que des fichiers du jeu (les `import type` sont admis) | 4 |
| C11 La logique est testée, le hasard est injectable | les fichiers `test/*.test.ts` qui importent le jeu passent avec vitest (eux seuls sont lancés) | 4 |
| | part des fonctions exportées par la logique qui sont appelées dans ces tests | 3 |
| | la logique n'appelle jamais `Math.random()` ni `crypto.getRandomValues()` : le hasard lui est fourni | 3 |

## Résultat

Un JSON sur la sortie standard, avec chaque note sur 10 et le constat de chaque vérification :

```json
{
  "jeu": "snake",
  "logique": ["src/games/snake/logic.ts"],
  "notes": { "C9": 10, "C11": 6 },
  "details": {
    "C11": [
      "4/4 : test/snake.tick.test.ts : les tests passent",
      "2/3 : fonctions de la logique appelées par les tests : 4/6 (manquent : estTerminee, dureePartie)",
      "0/3 : la logique appelle Math.random() : le hasard n'est pas injectable"
    ]
  }
}
```

Code de sortie 2 : usage incorrect ou jeu introuvable.

## Limites

- Une fonction appelée dans un test n'est pas forcément bien testée : la qualité des tests n'est pas notée.
- C11 exécute les tests du jeu évalué.
