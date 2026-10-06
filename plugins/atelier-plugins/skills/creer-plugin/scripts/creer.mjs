#!/usr/bin/env node
// Crée un plugin au format Agent Plugins 1.0 dans une marketplace et l'inscrit au
// catalogue ; peut y copier des skills, agents, instructions et prompts existants.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { ajouterAuTableau, aujourdhui, lireFrontmatter, lireJson, trouverMarketplace } from '../../publier-plugin/scripts/marketplace.mjs';

const AIDE = `Usage : node creer.mjs <nom> --description "texte" [--depuis <chemin>]… [--racine <dossier>]

Crée plugins/<nom>/ au format Agent Plugins 1.0, en version 0.1.0, et l'inscrit au
catalogue de la marketplace : plugin.json, README.md, CHANGELOG.md, et les
composants copiés depuis chaque --depuis :

  dossier contenant un SKILL.md   → skills/<dossier>/
  fichier *.agent.md              → com.github.copilot/agents/
  fichier *.instructions.md       → com.github.copilot/rules/<nom>.mdc
  fichier *.prompt.md             → com.github.copilot/commands/<nom>.md
  dossier .github                 → ses skills/, agents/, instructions/ et prompts/

Les instructions deviennent des fichiers .mdc, seul format que Copilot CLI lit dans
un plugin : leur « applyTo », lu par VS Code, est recopié dans « globs », lu par le
CLI. Les hooks ne sont pas copiés : leur commande doit être réécrite pour désigner
les scripts du plugin (voir la skill creer-plugin).

Options :
  --description <texte>  ce que fait le plugin et pour qui (obligatoire)
  --depuis <chemin>      composant ou dossier .github à copier, répétable
  --racine <dossier>     racine de la marketplace (défaut : répertoire courant)
  --aide                 affiche cette aide

Codes de sortie : 0 plugin créé, 1 nom déjà pris ou source invalide, 2 usage incorrect.`;

const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';

function usage(message) {
  process.stderr.write(`${message}\nVoir --aide.\n`);
  process.exit(2);
}

function echec(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function lireArguments(argv) {
  const options = { nom: null, description: null, depuis: [], racine: '.' };
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (['--aide', '--help', '-h'].includes(argument)) {
      process.stdout.write(`${AIDE}\n`);
      process.exit(0);
    } else if (['--description', '--depuis', '--racine'].includes(argument)) {
      const valeur = argv[++i];
      if (!valeur) usage(`${argument} attend une valeur.`);
      if (argument === '--depuis') options.depuis.push(valeur);
      else options[argument.slice(2)] = valeur;
    } else if (argument.startsWith('--')) {
      usage(`Option inconnue : ${argument}.`);
    } else if (options.nom) {
      usage(`Argument en trop : ${argument}.`);
    } else {
      options.nom = argument;
    }
  }
  return options;
}

/**
 * Instructions VS Code (.instructions.md) → instructions de plugin (.mdc) : « applyTo »
 * est conservé pour VS Code et recopié dans « globs » pour Copilot CLI.
 */
function versMdc(texte, nom) {
  const avertissements = [];
  const { champs } = lireFrontmatter(texte);
  if (!champs?.description) avertissements.push(`instructions ${nom} : ajoutez une « description », sans laquelle Copilot CLI les ignore.`);
  if (!champs?.applyTo || champs.globs) return { texte, avertissements };
  const motifs = champs.applyTo.split(',').map((motif) => `'${motif.trim().replaceAll("'", "''")}'`);
  const avecGlobs = texte.replace(/^(applyTo:.*)$/m, `$1\nglobs: [${motifs.join(', ')}]`);
  return { texte: avecGlobs, avertissements };
}

/** Composants à copier : [{ type, source, cible }] relatifs au dossier du plugin. */
function composantsDepuis(chemin) {
  if (!existsSync(chemin)) echec(`Introuvable : ${chemin}`);
  const nom = basename(chemin);
  if (statSync(chemin).isDirectory()) {
    if (existsSync(join(chemin, 'SKILL.md'))) {
      const { champs } = lireFrontmatter(readFileSync(join(chemin, 'SKILL.md'), 'utf8'));
      const nomSkill = champs?.name || nom;
      return [{ type: 'skill', source: chemin, cible: join('skills', nomSkill), nom: nomSkill }];
    }
    if (nom === '.github') {
      const sousDossiers = { skills: null, agents: '.agent.md', instructions: '.instructions.md', prompts: '.prompt.md' };
      return Object.entries(sousDossiers).flatMap(([dossier, suffixe]) => {
        const base = join(chemin, dossier);
        if (!existsSync(base)) return [];
        return readdirSync(base)
          .filter((element) => (suffixe ? element.endsWith(suffixe) : existsSync(join(base, element, 'SKILL.md'))))
          .flatMap((element) => composantsDepuis(join(base, element)));
      });
    }
    echec(`${chemin} : ni une skill (pas de SKILL.md), ni un dossier .github.`);
  }
  if (nom.endsWith('.agent.md')) return [{ type: 'agent', source: chemin, cible: join('com.github.copilot', 'agents', nom), nom }];
  if (nom.endsWith('.instructions.md')) {
    const regle = nom.slice(0, -'.instructions.md'.length);
    return [{ type: 'instructions', source: chemin, cible: join('com.github.copilot', 'rules', `${regle}.mdc`), nom: regle, conversion: versMdc }];
  }
  if (nom.endsWith('.prompt.md')) {
    const commande = nom.slice(0, -'.prompt.md'.length);
    return [{ type: 'commande', source: chemin, cible: join('com.github.copilot', 'commands', `${commande}.md`), nom: commande }];
  }
  echec(`${chemin} : type de fichier non pris en charge (.agent.md, .instructions.md, .prompt.md ou dossier de skill).`);
}

const options = lireArguments(process.argv.slice(2));
const { nom, description } = options;
if (!nom) usage('Attendu : le nom du plugin.');
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nom) || nom.length > 64) usage(`Nom invalide : ${nom} (minuscules, chiffres et tirets simples, 64 caractères au plus).`);
if (!description?.trim()) usage('--description est obligatoire.');
if (description.length > 1024) usage('--description dépasse 1024 caractères.');

const racine = resolve(options.racine);
const marketplace = trouverMarketplace(racine);
if (!marketplace) echec(`Aucun catalogue de marketplace dans ${racine}.`);
const { texte: texteCatalogue, donnees: catalogue } = lireJson(marketplace.chemin);
if ((catalogue.plugins ?? []).some((entree) => entree?.name === nom)) echec(`Le catalogue contient déjà un plugin « ${nom} ».`);
const dossier = join(racine, 'plugins', nom);
if (existsSync(dossier)) echec(`Le dossier ${relative(racine, dossier)} existe déjà.`);

const composants = options.depuis.flatMap((chemin) => composantsDepuis(resolve(chemin)));
const cibles = new Set();
for (const { cible } of composants) {
  if (cibles.has(cible)) echec(`Deux composants iraient au même endroit : ${cible}.`);
  cibles.add(cible);
}

mkdirSync(dossier, { recursive: true });
writeFileSync(join(dossier, 'plugin.json'), `${JSON.stringify({ $schema: SCHEMA, name: nom, version: '0.1.0', description }, null, 2)}\n`);
const avertissements = [];
for (const { source, cible, nom: nomComposant, conversion } of composants) {
  if (conversion) {
    const resultat = conversion(readFileSync(source, 'utf8'), nomComposant);
    mkdirSync(join(dossier, cible, '..'), { recursive: true });
    writeFileSync(join(dossier, cible), resultat.texte);
    avertissements.push(...resultat.avertissements);
  } else {
    cpSync(source, join(dossier, cible), { recursive: true });
  }
}

const lignes = composants.map(({ type, nom: nomComposant, cible }) => `| ${type} \`${nomComposant}\` | \`${cible.replaceAll('\\', '/')}\` |`);
writeFileSync(
  join(dossier, 'README.md'),
  `# ${nom}\n\n${description}\n${lignes.length ? `\n## Contenu\n\n| Composant | Emplacement |\n| --- | --- |\n${lignes.join('\n')}\n` : ''}`,
);
const contenu = composants.length ? composants.map(({ type, nom: n }) => `${type} \`${n}\``).join(', ') : 'manifeste';
writeFileSync(
  join(dossier, 'CHANGELOG.md'),
  `# Changelog\n\nToutes les évolutions notables de ce plugin. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions : [SemVer](https://semver.org/lang/fr/).\n\n## [0.1.0] - ${aujourdhui()}\n\n### Ajouté\n\n- Première version : ${contenu}.\n`,
);

const entree = { name: nom, source: `./plugins/${nom}`, description, version: '0.1.0' };
writeFileSync(marketplace.chemin, ajouterAuTableau(texteCatalogue, ['plugins'], entree));

console.log(`Plugin ${nom} 0.1.0 créé dans ${relative(racine, dossier).replaceAll('\\', '/')} et inscrit dans ${marketplace.relatif}.`);
for (const { type, nom: nomComposant, cible } of composants) console.log(`  ${type} ${nomComposant} → ${cible.replaceAll('\\', '/')}`);
for (const avertissement of avertissements) console.log(`ATTENTION ${avertissement}`);
