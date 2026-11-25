# TP N°1 – Prise en main de la borne d’arcade

> La complétion a-t-elle créé un paramètre « duree » en secondes ou en ms ?

> Quel est le format de sortie de la fonction ?

> Comparez avec le premier essai : le nom du paramètre, son unité et le format de sortie ont-ils changé ?

> La complétion a-t-elle fait le lien avec le modèle Score du fichier src/scores/scoreStore.ts ?

> Sinon, comment auriez-vous pu la guider vers le bon champ ?

> La complétion et les suggestions ont-elles couverts l’ensemble des modifications à réaliser ?

Problèmes rencontrés :

# TP N°2 – Mon premier bug

> Collez ici les scores copiés dans le presse-papiers :

> Quel est le fichier fautif ?

> Dans le chat, dépliez les appels d’outils (recherches, lectures) : comment Copilot a-t-il cherché le fichier fautif ?

> Le diagnostic a-t-il été plus rapide que si vous l’aviez fait à la main ?

> Combien avez-vous consommé de crédits IA en mode Ask ?

> Si le test échoue, est-ce pour la bonne raison ? Comparez ses données avec les lignes collées dans NOTES-TP.md.

> Quelle est la qualité de la génération du test par rapport à un code que vous auriez créé vous-même ?

> Combien de crédits IA avez-vous consommés pour créer un test qui atteste du problème ?

> Copiez ici votre fichier de test qui met en évidence le problème :

Problèmes rencontrés :

# TP N°3 – Un objectif, un agent

> Le plan proposé est-il pertinent ?

> Y a-t-il des impacts qui n’ont pas été identifiés (colspan="5") ? Ou en plus ?

> Quel effort a été nécessaire pour vérifier le plan, par rapport à l’effort de l’analyse d’impacts manuelle ?

> Comment ont été résolues les informations indéterminées (format de sortie, position de la colonne…) ?

> La colonne a-t-elle été ajoutée ?

> Le code est-il acceptable et de bonne qualité ?

> Des tests unitaires ont-ils été ajoutés ?

> Combien de crédits IA ont été consommés ?

> L’agent a-t-il réalisé un build de vérification ?

Problèmes rencontrés :

# TP N°4 – Des agents outillés

> Combien d’outils ajoutent ces deux serveurs MCP ?

> Quels outils avez-vous activés et ont été appelés par l’agent ?

> Combien de crédits IA consommés ?

> Survolez le contrôle de fenêtre de contexte du chat : quelle catégorie pèse le plus ?

> Fallait-il un MCP pour ouvrir un navigateur ? Et pour lister les issues ?

> Ces outils se basent-ils sur la vision ou sur le DOM?

Problèmes rencontrés :

# TP N°5 – Des agents compétents

> Avant correction : a-t-elle été chargée ? Le code suit-il l’ordre et les règles de la skill vus en cours ?

> Tapez / dans le chat, sans ouvrir de fichier : sous quel nom la skill apparaît-elle ?

> Lancez-la depuis ce menu, avec la même demande : l’agent la charge-t-il ? Pourquoi ?

> Après correction : session neuve, même demande : l’agent la charge-t-il cette fois ? Le code produit change-t-il ?

> L’agent l’a-t-il ouvert ? De quelles couleurs sont les raquettes et la balle ? Et si vous le citez dans SKILL.md ?

Problèmes rencontrés :

# TP N°6 – Des agents bien informés

> L’agent a-t-il reçu vos instructions ? Si oui, quand et pour quel fichier ?

> Vos instructions ont-elles été prises en compte ?

> L’agent a-t-il reçu vos instructions ? Qu’est-ce qui vous l’indique ?

Problèmes rencontrés :

# TP N°7 – Un prompt digne de ce nom

> Copiez ici votre prompt amélioré :

> Copiez ici le contenu du report.md :

# TP N°8 – Des actions approuvées

> Copiez ici vos permissions pour le terminal :

> Copiez ici vos permissions pour le web :

# TP N°9 – Un spécialiste

> Copiez ici votre agent retrodoc-writer :

> Copiez ici le contenu du fichier docs/règles-métier-agent-seul.md :

> Collez ici le bloc rendu par /check-report pour vos deux rapports :

|                                               | Premier essai | Agent seul |
| --------------------------------------------- | ------------- | ---------- |
| Règles écrites dans le livrable (nombre brut) |               |            |
| Règles importantes retrouvées, sur 31         |               |            |
| Règles partielles (non comptées)              |               |            |
| Sources exactes, sur 31                       |               |            |
| Règles fausses (contredisent le référentiel)  |               |            |
| Anomalies signalées, sur 4                    |               |            |
| Crédits IA consommés                          |               |            |

Problèmes rencontrés :

# TP N°10 – Une équipe de professionnels

> Collez ici le bloc rendu par /check-report pour le livrable de l’équipe :

|                                               | Équipe |
| --------------------------------------------- | ------ |
| Règles écrites dans le livrable (nombre brut) |        |
| Règles importantes retrouvées, sur 31         |        |
| Règles partielles (non comptées)              |        |
| Sources exactes, sur 31                       |        |
| Règles fausses (contredisent le référentiel)  |        |
| Anomalies signalées, sur 4                    |        |
| Crédits IA consommés                          |        |

> Copiez ici le contenu du fichier docs/règles-métier-équipe-agents.md :

> Copiez ici votre orchestrateur :

> Copiez ici votre scanner de cas limites :

> Copiez ici votre vérificateur :

> Copiez ici votre analyste :

Problèmes rencontrés :

# TP N°11 – Des scripts sur évènements

> Quels évènements déclenchent les hooks ?

> Comment est architecturé le hook ?

> Quel est le comportement de l’agent quand on lui demande de lire le fichier ?

> Quel est le comportement de l’agent avec la commande Get-Content ? Pourquoi diffère-t-il du précédent ?

> Quelles sont les pistes de résolution ?

Problèmes rencontrés :

# TP N°12 – Des compétences spécifiques

> Comment s’est comporté le modèle dans ses estimations ? Les couleurs ont-elles été respectées ou dénaturées ?

> L’agent a-t-il chargé votre skill de lui-même ? Avez-vous dû autoriser d’autres actions que ses scripts ? Comparez avec la partie 1 : qu’observez-vous ?

> Copiez ici votre SKILL.md:

Problèmes rencontrés :

# TP N°13 – Un agent sous influence

> Remarquez-vous quelque chose de particulier ? Est-ce que ce comportement était bien intégré aux règles du tournois ?

> Quelle est la cause ?

> Quel est le risque d’une injection d’instructions et comment s’en prémunir ?

> D’où sortent ces mots de passe ? Comment sont-ils arrivés sur le serveur d’un attaquant ?

> Quel est le risque posé par l’exécution de MCP en local et comment s’en prémunir ?

Problèmes rencontrés :

# TP N°14 – Les marketplaces

> Où se trouve le script rapport-vitest.mjs qui a été exécuté ?

> Pourquoi cette lecture a échoué, d’où sort ce hook ?

> Quelles modifications cette skill a-t-elle automatisées ?

# TP N°15 – Faites votre propre MCP

> Quel module serveur_scores.py importe-t-il ?

> Le serveur démarre-t-il avec uv run serveur_scores.py ?

> Le client reçoit-il une erreur de protocole ou un résultat ? Qu’en fera le modèle ?

> Dépliez l’appel d’outil dans la conversation : quel outil l’agent a-t-il appelé pour répondre ?

Problèmes rencontrés :

# TP N°16 – Évaluer et améliorer une skill

> Quels critères peuvent être scriptés ?

> Les autres critères seront jugés par un seul model-grader (maitrise de consommation dans le cadre de ce TP). Qu’y gagne-t-on, qu’y perd-on ?

> Avez-vous réussi à améliorer votre skill ? Quels critères avez-vous améliorés ? Avec une seule passe par version, que pouvez-vous en conclure ?

> Copiez ici votre grille d’évaluation :

Problèmes rencontrés :
