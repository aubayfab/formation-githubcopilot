# Arcade

Une arcade rétro dans le navigateur. Le shell affiche un cadre d'arcade avec effet cathodique et un menu qui lance trois mini-jeux. Un tableau des scores commun aux trois jeux est conservé dans le `localStorage` et partagé avec le fichier `mcp-scores/scores.json`, qui contient les scores initiaux.

TypeScript strict, Vite, Vitest et Prettier. Aucun framework de rendu : tout est dessiné en DOM et en Canvas 2D. Pas de backend : en développement, le serveur Vite expose seulement la route `/api/scores`, qui lit et complète `mcp-scores/scores.json`. Au démarrage, l'arcade fusionne ce fichier avec son `localStorage` ; après chaque partie, elle y ajoute le score. Sans ce serveur (build de `dist/`), le tableau démarre vide.

## Prérequis

Node 20.19 ou plus récent.

## Commandes

```sh
npm install      # installe les dépendances
npm run dev      # lance l'arcade en local et ouvre le navigateur
npm run build    # vérifie les types et produit dist/
npm test         # lance les tests Vitest
npm run lint     # vérifie le formatage avec Prettier
```

## Commandes de jeu

Flèches pour se déplacer, Entrée pour valider, Échap pour revenir au menu. La manette et les boutons du pupitre sont aussi cliquables.

## Thèmes

Le thème sobre est affiché par défaut : une fenêtre neutre qui suit le mode clair ou sombre du système, sans effet cathodique, lueur ni clignotement, et avec le son coupé. Le serpent y avance dix fois moins vite, son compte à rebours se réduit à un chiffre dans un coin, et le 2048 est affiché plus petit. Le sélecteur en haut à droite bascule vers le thème néon, la borne d'arcade d'origine. Le choix est mémorisé dans le `localStorage`.

## Arborescence

- `src/` : point d'entrée `main.ts`
- `src/shell/` : cadre de l'arcade, effet CRT, menu, clavier, choix du thème
- `src/games/snake/` : logique, rendu et enregistrement du jeu
- `src/games/2048/` : fusion, grille, rendu et enregistrement du jeu
- `src/games/casse-briques/` : écran d'attente du jeu
- `src/scores/` : tableau des scores, stockage, partage
- `src/theme/` : palette néon et thème sobre
- `src/legacy/` : records, compteurs de parties et dernier joueur
- `mcp-scores/` : `scores.json`, scores initiaux et parties jouées, à partager avec un serveur MCP
- `test/` : tests Vitest
