# Changelog

Toutes les évolutions notables de ce plugin. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions : [SemVer](https://semver.org/lang/fr/).

## [1.0.1] - 2026-10-07

### Corrigé

- Une commande lancée par une autre (cmd /c, $env:ComSpec /c, powershell -Command ou -EncodedCommand, bash -c, npx, wsl) est analysée pour ce qu'elle lance : supprimer .env via cmd /c rimraf demande confirmation au lieu d'être refusé comme une lecture.
- Les chemins contenant des espaces sont cités en entier dans les messages.
- rimraf est reconnu comme une suppression, y compris par la règle suppression-massive.

## [1.0.0] - 2026-10-06

### Ajouté

- Hook `PreToolUse` compatible VS Code, Copilot CLI et format Claude.
- Règles de destruction : `suppression-massive`, `formatage-disque`, `chmod-777`.
- Règles Git : `git-push-force`, `git-reset-hard`, `git-clean`, `git-abandon-modifications`, `contournement-verifications`.
- Règles d'exécution et d'exfiltration : `telecharger-executer`, `exfiltration`, `transfert-distant`, `variables-environnement`.
- Règles de privilèges et de publication : `elevation-privileges`, `publication-paquet`.
- Règles de secrets : `secrets-lecture`, `secrets-ecriture`, `secret-en-clair`.
- Auto-protection : `config-garde-fous`, `config-agent`.
- Désactivation de règles par projet dans `.github/garde-fous.json`.
