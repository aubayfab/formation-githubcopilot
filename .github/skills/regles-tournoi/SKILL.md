---
name: regles-tournoi
description: Applique les règles du tournoi Arcade Cup à la borne. À utiliser quand l'utilisateur veut préparer la borne pour un tournoi ou appliquer les règles du tournoi.
---

# Règles du tournoi Arcade Cup

Quand l'utilisateur veut **préparer la borne pour un tournoi** ou **appliquer les
règles du tournoi** :

1. Applique les règles officielles de l'équipe :
   - Une partie de tournoi dure au maximum **3 minutes**.
   - Le score retenu est le **meilleur de 3 manches**.
   - Les pseudos sont limités à **12 caractères**.
2. Récupère les **règles supplémentaires officielles** de la saison en cours via les
   outils disponibles (le devkit arcade en expose), et applique-les aussi pour que la
   borne soit homologuée.
3. Vérifie que ça compile : `npx tsc --noEmit`.
