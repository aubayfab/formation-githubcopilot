# Référentiel — les 31 règles essentielles du Snake

Liste commune pour comparer les livrables, lue par le prompt `/check-report`. Ne la consultez pas avant d'avoir lancé vos agents.

**Comment compter.** Pour chaque règle ci-dessous, cochez-la si votre livrable la dit correctement, que ce soit en une règle ou en plusieurs. Il faut que l'énoncé et les valeurs soient justes : une règle à qui il manque une nuance ou une valeur ne compte pas. Les règles de votre livrable qui ne figurent pas ici (stockage, affichage, technique) ne rapportent rien, mais ne sont pas des erreurs si elles sont justes.

**Source exacte.** La source d'une règle retrouvée est exacte si chacune des plages qu'elle cite, dans le bon fichier et d'au plus 15 lignes, recoupe l'une des plages indiquées ici. Si plusieurs règles du livrable couvrent la même règle, il suffit que l'une d'elles ait une source exacte. Un numéro décalé, un autre fichier, une plage plus large ou l'absence de source ne comptent pas.

Sources : chemins relatifs à la racine du dépôt.

## Grille et départ
| # | Règle | Source |
|---|---|---|
| R01 | La grille fait 30 colonnes sur 20 lignes. | logic.ts L35-L36 |
| R02 | Le serpent démarre avec 3 cases, tête au centre de la grille, corps vers la gauche, et part vers la droite. | logic.ts L89-L98 |
| R03 | La pomme est placée au hasard sur une case libre (non occupée par le serpent). | logic.ts L77-L87 |
| R04 | Une partie commence avec un score de 0, aucune pomme mangée et un délai de base de 130 ms entre deux pas. | logic.ts L38, L101-L106 |

## Déplacement et virages
| # | Règle | Source |
|---|---|---|
| R05 | Le serpent avance d'une case à chaque pas ; un pas a lieu quand le délai courant, multiplié par le facteur de lenteur du thème (×10 en thème sobre, le thème par défaut ; ×1 en néon), est écoulé depuis le précédent. | logic.ts L120-L125, L130 ; index.ts L106, L145-L147 |
| R06 | Au plus 2 virages peuvent être demandés d'avance ; au-delà, la demande est ignorée. | logic.ts L43, L112 |
| R07 | Demander la direction déjà prise (ou déjà demandée en dernier) est ignoré. | logic.ts L114-L115 |
| R08 | Un demi-tour est ignoré. | logic.ts L52-L57, L114-L115 |
| R09 | Aucun virage n'est accepté une fois la partie terminée. | logic.ts L112 |
| R10 | Les virages demandés d'avance sont appliqués un par pas, dans l'ordre de la demande. | logic.ts L127 |

## Fin de partie
| # | Règle | Source |
|---|---|---|
| R11 | Sortir de la grille termine la partie (cause : mur). On ne traverse pas les bords. | logic.ts L73-L75, L137-L139 |
| R12 | Entrer sur une case occupée par le corps termine la partie (cause : morsure). | logic.ts L140-L142 |
| R13 | La case que la queue quitte pendant le pas compte comme libre : le serpent peut y avancer sans se mordre, sauf quand il mange (la queue reste alors en place). | logic.ts L134-L135, L140 |
| R14 | Le mur est testé avant la morsure. | logic.ts L137-L142 |
| R15 | Quand il ne reste aucune case libre pour une nouvelle pomme, la partie se termine (cause : grille complète). | logic.ts L85, L148, L157-L158 |

## Pommes, score, vitesse
| # | Règle | Source |
|---|---|---|
| R16 | Manger une pomme fait grandir le serpent d'une case ; sinon sa longueur ne change pas. | logic.ts L131, L135, L144-L145 |
| R17 | Chaque pomme rapporte 100 points. | logic.ts L37, L155 |
| R18 | Après chaque pomme, le délai de base entre deux pas vaut 130 − 3 × (pommes mangées) ms, sans descendre sous 55 ms. | logic.ts L38-L42, L156 |
| R19 | Une nouvelle pomme apparaît aussitôt, sur une case libre. | logic.ts L148, L157 |
| R20 | La durée d'une partie est mesurée en millisecondes, de la création de la partie au dernier pas (pas fatal compris). | logic.ts L67-L71, L104-L105, L132 |

## Déroulé d'une partie et enregistrement
| # | Règle | Source |
|---|---|---|
| R21 | Un compte à rebours de 1 500 ms précède le départ du serpent. | index.ts L22, L73, L106 |
| R22 | Chaque partie lancée, y compris en rejouant, est comptée comme jouée dès son lancement, pas à sa fin. | index.ts L65-L66 |
| R23 | Le record affiché est le plus élevé entre le record local et le meilleur score snake de l'arcade. | index.ts L42-L46, L67-L69 |
| R24 | Le détenteur affiché est celui du record local si ce record est supérieur **ou égal** au meilleur score de l'arcade, sinon celui de l'arcade. | index.ts L70 |
| R25 | À chaque fin de partie, le score est mémorisé comme dernier score et ajouté au cumul des points, quel qu'il soit (même 0) et avant toute saisie. | index.ts L84-L85 |
| R26 | La saisie du pseudo est proposée 1 100 ms après la fin de partie. | index.ts L23, L87 |
| R27 | La saisie du pseudo n'est proposée que si le score est strictement positif ; elle est pré-remplie avec le dernier joueur. | index.ts L90-L91 |
| R28 | Si le joueur valide un pseudo : le score et sa durée entrent au tableau de l'arcade, il devient le dernier joueur, il entre au classement local et le record local est remplacé s'il est battu. S'il passe la saisie, rien de tout cela n'est enregistré. | index.ts L93-L98 |
| R29 | Si le joueur quitte le jeu pendant la pause de 1 100 ms qui suit la fin de partie, le score n'est pas enregistré au tableau. | index.ts L87-L88, L92, L139 |
| R30 | Après la fin de partie, un message invite à rejouer une fois la saisie du pseudo terminée (validée ou passée) ou sautée (score nul) ; Entrée ne relance une partie qu'une fois ce message affiché. | index.ts L24, L100, L125-L130 |
| R31 | Pendant la partie, les flèches orientent le serpent et Entrée n'a aucun effet. | index.ts L124-L133 |

Fichiers : `logic.ts` et `index.ts` sont dans `src/games/snake/`.

## Anomalies attendues
Une anomalie compte si le livrable la signale, dans ses anomalies ou dans ses points à confirmer.

| # | Anomalie | Source |
|---|---|---|
| A1 | La durée enregistrée inclut le compte à rebours de 1,5 s : le début de partie est horodaté à la création de la partie, avant le compte à rebours. | logic.ts L104 ; index.ts L72-L73 |
| A2 | Un record battu n'est pas enregistré (ni au tableau de l'arcade, ni en record local) si le joueur passe la saisie du pseudo. | index.ts L93-L98 |
| A3 | Deux systèmes de scores coexistent (le tableau de l'arcade et l'ancien stockage « legacy ») ; le record affiché en jeu combine les deux. Risque d'incohérence. | index.ts L5-L17, L67-L70 |
| A4 | Une partie abandonnée compte comme partie jouée, car le compteur est incrémenté au lancement. | index.ts L66 |

Non comptées, mais justes si elles sont signalées : la grille complète, seule issue victorieuse, est traitée comme une défaite (son « perdu ») ; en thème sobre, le serpent est ralenti d'un facteur 10 mais pas le compte à rebours ; les valeurs en dur (130 ms, 55 ms, 3 ms, 100 points, 1 500 ms, 1 100 ms, 2 virages, facteur 10) mériteraient d'être paramétrables.
