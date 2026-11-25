---
name: creer-jeu
description: "Crée un nouveau jeu pour la borne d'arcade (Canvas 2D, TypeScript) à partir d'une demande comme « fais-moi un casse-briques », un pong, un démineur ou un jeu de réflexes. Utiliser pour tout nouveau jeu de la borne : boucle de jeu, score enregistré dans le tableau commun, thèmes sobre et néon."
---

# Créer un jeu pour la borne d'arcade

## Quand l'utiliser
L'utilisateur demande un nouveau jeu pour la borne. Si la demande est vague, choisis des valeurs raisonnables (taille de la zone, vitesse, nombre de vies) et indique-les dans ton résumé final plutôt que de poser des questions.

## 1. Repérer le projet
- Le jeu va dans `src/games/<nom-du-jeu>/`. Si ce dossier contient un écran d'attente, remplace-le.
- Utilise l'API des jeux de la borne (`ContexteJeu` dans `src/shell/menu.ts`, `src/games/snake/` en exemple). Déclare le jeu dans `NOMS_JEUX` et importe-le dans `src/main.ts`, sans rien modifier d'autre dans le shell.

## 2. Structure du code
- La logique (état, règles, score, durée) va dans `logic.ts`, sans accès au DOM. Le hasard lui est passé en paramètre.
- Le rendu va dans `render.ts` et l'orchestration dans `index.ts`.
- N'expose jamais le jeu ni son état sur `window`.

## 3. Contrôles
- Toutes les commandes passent par `contexte.surAction` (`haut`, `bas`, `gauche`, `droite`, `valider`). Échap est réservé au retour au menu.
- N'ajoute aucun écouteur clavier ou souris propre au jeu.

## 4. Règles et difficulté
- Implémente les règles classiques du jeu demandé.
- Fais monter la difficulté au fil de la partie (vitesse, densité d'ennemis, temps réduit).

## 5. Rendu et effets
- Couleurs : uniquement `contexte.couleur('--variable')`.
- Style rétro : formes en blocs (`fillRect`, pas d'`arc` ni de coins arrondis, balle carrée), police `"Silkscreen", monospace`.
- **Thème néon** (`!contexte.sobre`) : le jeu doit être très vivant. Au moins trois éléments animés en permanence (pulsation des briques ou des raquettes, scintillement, fond qui défile), des particules et une secousse à chaque événement, une lueur `shadowBlur`, un « GAME OVER » qui clignote.
- **Thème sobre** (`contexte.sobre`) : ni particules, ni secousse, ni pulsation, ni clignotement, et **aucun appel à `contexte.jouerSon`**. Ralentis les mouvements avec `contexte.lenteur`.
- Les bruitages passent par `contexte.jouerSon`, protégés par `if (!contexte.sobre)`.

## 6. Score
- Affiche le score en permanence en haut de l'écran.
- En fin de partie : `const pseudo = await contexte.demanderPseudo(points)`, puis, seulement si le pseudo n'est pas `null`, `ajouterScore(id, pseudo, points, dureeMs)` de `src/scores/scoreStore.ts`. N'écris aucun score, record ni compteur avant cette saisie. N'utilise ni `localStorage` ni `src/legacy/`.

## 7. Vérifier
- Lance `npx tsc --noEmit` et `npm test`.
- Ajoute des tests Vitest sur la logique (score, fin de partie, hasard injecté).

## 8. Résumé final
Indique les fichiers créés, les commandes de jeu et les valeurs choisies (vitesse, vies, taille).
