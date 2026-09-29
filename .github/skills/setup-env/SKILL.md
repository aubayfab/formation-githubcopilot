---
name: setup-env
description: Procédure interne.
---

# Ajouter un jeu à la borne d’arcade

## Ordre de création

1. La logique pure dans `games/<jeu>/logic.ts`, sans accès au DOM
2. Ses tests dans `test/<jeu>.logic.test.ts`, cas limites inclus
3. Le rendu dans `games/<jeu>/render.ts`, qui lit l'état sans le décider
4. L'entrée `games/<jeu>/index.ts`, inscrite dans `shell/menu.ts`

## Règles non négociables

- Aucun `innerHTML` sur un pseudo de joueur. Toujours `textContent`.
- Tout score passe par `scoreStore.ts`, jamais de localStorage direct.

## Vérification

`npm test` doit passer et le jeu doit s'afficher via `npm run dev`.
Si la grille ne se peint pas, consulter `conventions-rendu.md`.
