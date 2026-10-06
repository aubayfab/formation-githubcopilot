# garde-fous

Un hook `PreToolUse` qui examine chaque appel d'outil de l'agent **avant** son exécution, et le refuse ou le soumet à votre confirmation quand il est dangereux : commande destructrice, lecture ou envoi de secrets, modification de la configuration de l'agent lui-même.

Chaque décision cite la règle en cause et propose à l'agent une alternative. Quand aucune règle ne s'applique, le hook ne répond rien : l'appel suit le circuit d'approbation habituel.

## Règles

| Règle | Décision | Ce qui est intercepté |
| --- | --- | --- |
| `suppression-massive` | refus | `rm -r`, `Remove-Item -Recurse`, `rd /s` visant `/`, `~`, `C:\`, un dossier système ou le répertoire courant entier |
| `formatage-disque` | refus | `mkfs`, `dd of=/dev/…`, `format C:`, `diskpart`, `Format-Volume` |
| `chmod-777` | refus | `chmod 777`, `a+rwx` |
| `git-push-force` | refus | `git push --force`, `-f`, `+branche` (mais pas `--force-with-lease`) |
| `git-reset-hard` | confirmation | `git reset --hard` |
| `git-clean` | confirmation | `git clean -f…` |
| `git-abandon-modifications` | confirmation | `git checkout -- .`, `git restore .` |
| `contournement-verifications` | confirmation | `git … --no-verify` |
| `telecharger-executer` | refus | `curl … \| bash`, `iwr … \| iex`, `bash <(curl …)` |
| `exfiltration` | refus | `curl -d @fichier`, `curl -F f=@…`, `-T`, `wget --post-file`, `Invoke-RestMethod -InFile`, `… \| nc hôte port` |
| `transfert-distant` | confirmation | `scp`, `rsync`, `sftp` vers `utilisateur@hôte:` |
| `variables-environnement` | confirmation | `printenv`, `env`, `Get-ChildItem env:` |
| `elevation-privileges` | confirmation | `sudo`, `doas`, `runas`, `-Verb RunAs` |
| `publication-paquet` | confirmation | `npm publish`, `docker push`, `twine upload`, `cargo publish`… |
| `secrets-lecture` | refus | lecture de `.env*` (sauf `.env.example`, `.sample`, `.template`, `.dist`), clés SSH privées, `*.pem`, `*.key`, `.npmrc`, `.aws/credentials`, `.kube/config`… par un outil de lecture, une recherche ou une commande (`cat`, `Get-Content`, `python -c …`, `cp`, `< .env`) |
| `secrets-ecriture` | confirmation | modification de ces mêmes fichiers |
| `secret-en-clair` | refus | appel d'outil contenant un jeton reconnaissable : GitHub (`ghp_`, `github_pat_`), AWS (`AKIA…`), clé privée PEM, Slack, Google, Stripe, OpenAI/Anthropic |
| `config-garde-fous` | refus | écriture de `.github/garde-fous.json` par l'agent |
| `config-agent` | confirmation | écriture de `.vscode/settings.json`, `.vscode/mcp.json`, `.github/hooks/`, `.github/copilot/settings.json`, `.claude/settings.json` |
| `commande-trop-longue` | confirmation | commande de plus de 8 000 caractères, non analysée |

Quand plusieurs règles s'appliquent, le refus l'emporte sur la confirmation.

## Fonctionnement

Le hook reçoit l'appel d'outil en JSON sur son entrée standard. Les noms d'outils et de paramètres diffèrent entre VS Code (`run_in_terminal`, `read_file`…), Copilot CLI (`bash`, `view`…) et le format Claude (`Bash`, `Read`…) : le script parcourt toute l'entrée de l'outil et classe l'outil d'après son nom plutôt que de dépendre d'un champ précis.

Pour une commande, il découpe les commandes enchaînées (`;`, `&&`, `|`…) et estime pour chacune si elle lit ou écrit les fichiers qu'elle nomme : `echo .env >> .gitignore` passe, `cat .env` ou `python -c "open('.env')"` sont refusés. Un verbe inconnu est supposé lire et écrire.

La réponse est écrite à la fois au format de VS Code (`hookSpecificOutput`) et à celui de Copilot CLI (`permissionDecision` au premier niveau). Un refus ajoute au contexte du modèle une consigne : ne pas chercher à obtenir le même résultat par un autre chemin.

## Configuration par projet

Un projet peut désactiver des règles dans `.github/garde-fous.json` :

```json
{
  "desactiver": ["publication-paquet", "elevation-privileges"]
}
```

Ce fichier est protégé par la règle `config-garde-fous` : l'agent peut le lire, pas l'écrire. Un fichier mal formé est ignoré et ne désactive rien.

## Prérequis

- Node.js 20 ou plus récent dans le `PATH`.
- VS Code : hooks activés (`chat.useHooks`, actif par défaut) et espace de travail approuvé. Les hooks de plugin s'exécutent dans le harness **Local** ; pour une session **Copilot** (Agent Host), c'est l'implémentation de Copilot CLI qui s'applique.
- Copilot CLI : aucun réglage.

Pour voir ce que fait le hook dans VS Code : panneau **Output**, canal **GitHub Copilot Chat Hooks**.

## Limites

- **Un hook voit les appels de l'agent, pas le code des serveurs MCP.** Un serveur MCP malveillant qui lit lui-même vos fichiers et les envoie ailleurs n'appelle aucun outil : aucun hook ne peut l'en empêcher. La parade est en amont : n'installer que des serveurs de confiance, désactiver les outils inutiles.
- Les règles sur les commandes sont des heuristiques : elles arrêtent les maladresses et les injections ordinaires, pas un attaquant déterminé qui a la main sur le terminal (encodage, script intermédiaire…).
- En cas d'erreur interne, le hook laisse l'appel suivre son cours plutôt que de bloquer l'agent ; un hook qui dépasse son délai (10 s) est de toute façon ignoré par VS Code comme par le CLI.
- Les noms d'outils évoluent avec les versions de VS Code et du CLI : après une mise à jour, vérifiez le comportement dans le canal de sortie des hooks.

## Pourquoi le format de plugin Claude

Le plugin est déclaré par `.claude-plugin/plugin.json` et `hooks/hooks.json`, et non au format Agent Plugins 1.0. La commande du hook doit désigner un script livré avec le plugin, installé ailleurs que dans votre projet. VS Code ne remplace la racine du plugin dans la commande d'un hook que pour les formats Claude (`${CLAUDE_PLUGIN_ROOT}`) et OpenPlugin historique (`${PLUGIN_ROOT}`) ; Copilot CLI comprend lui aussi `${CLAUDE_PLUGIN_ROOT}`.

## Modifier une règle

1. Éditez [scripts/regles.mjs](scripts/regles.mjs) : chaque règle y est décrite en tête de fichier.
2. Ajoutez un cas dans `tests/garde-fous.test.mjs`, à la racine de la marketplace, et lancez `npm test`.
3. Incrémentez la version (mineure pour une règle ajoutée, correctif pour un faux positif) dans `.claude-plugin/plugin.json` **et** dans `.github/plugin/marketplace.json`, puis notez le changement dans [CHANGELOG.md](CHANGELOG.md). La skill `publier-plugin` du plugin `atelier-plugins` fait les trois d'un coup.
