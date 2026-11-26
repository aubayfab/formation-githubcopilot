#!/usr/bin/env node
/**
 * Script-grader du TP 17 : note sur 10 les deux critères qu'un script vérifie mieux qu'un modèle,
 * parce qu'il faut exécuter du code ou prouver une absence. Voir README.md.
 *
 *   C9   la logique du jeu ne fait aucun appel au DOM
 *   C11  la logique est couverte par des tests, le hasard est injectable
 *
 * La logique est src/games/<id>/logic.ts et les fichiers du jeu qu'il importe.
 *
 * Usage : node evaluation/script-grader.mjs <clone> <id-du-jeu>
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const [clone, id] = process.argv.slice(2);
if (!clone || !id) {
  console.error(
    "Usage : node evaluation/script-grader.mjs <clone> <id-du-jeu>",
  );
  process.exit(2);
}

const racine = path.resolve(clone);
const dossierJeu = path.join(racine, "src", "games", id);
if (!existsSync(dossierJeu)) {
  console.error(`Jeu introuvable : ${dossierJeu}`);
  process.exit(2);
}

/** API du navigateur : leur présence dans la logique est un appel au DOM. */
const NAVIGATEUR =
  /\b(document|window|globalThis|navigator|location|localStorage|sessionStorage|indexedDB|requestAnimationFrame|cancelAnimationFrame|addEventListener|fetch|XMLHttpRequest|HTMLElement|HTMLCanvasElement|CanvasRenderingContext2D|AudioContext|getContext)\b|\bnew\s+(Image|Audio)\s*\(/g;

/** Contenu d'un fichier, sans ses commentaires. */
function lire(fichier) {
  return readFileSync(fichier, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/** Modules importés pour leur valeur (les `import type` sont ignorés : ils n'exécutent rien). */
function imports(code) {
  const statiques = [
    ...code.matchAll(
      /\bimport\s+(type\s+)?([^;'"]*?\bfrom\s+)?['"]([^'"]+)['"]/g,
    ),
  ]
    .filter((m) => !m[1])
    .map((m) => m[3]);
  const dynamiques = [
    ...code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
  ].map((m) => m[1]);
  return [...statiques, ...dynamiques];
}

/** logic.ts et les fichiers du jeu qu'il importe, de proche en proche. */
function fichiersLogique() {
  const entree = path.join(dossierJeu, "logic.ts");
  if (!existsSync(entree)) return [];
  const vus = new Set([entree]);
  for (const fichier of vus) {
    for (const module of imports(lire(fichier))) {
      if (!module.startsWith(".")) continue;
      const cible = path.resolve(
        path.dirname(fichier),
        module.replace(/\.js$/, "") + ".ts",
      );
      if (cible.startsWith(dossierJeu) && existsSync(cible)) vus.add(cible);
    }
  }
  return [...vus];
}

function relatif(fichier) {
  return path.relative(racine, fichier).replaceAll("\\", "/");
}

const notes = {};
const details = {};

function noter(critere, points, max, constat) {
  notes[critere] = (notes[critere] ?? 0) + points;
  (details[critere] ??= []).push(`${points}/${max} : ${constat}`);
}

const logique = fichiersLogique();
const codeLogique = logique.map(lire).join("\n");

// C9 : aucune API du navigateur dans la logique, et aucun import hors du dossier du jeu.
if (logique.length === 0) {
  noter(
    "C9",
    0,
    10,
    `src/games/${id}/logic.ts absent : la logique n'est pas séparée du DOM`,
  );
} else {
  const apis = [
    ...new Set([...codeLogique.matchAll(NAVIGATEUR)].map((m) => m[0])),
  ];
  noter(
    "C9",
    apis.length === 0 ? 6 : 0,
    6,
    apis.length === 0
      ? "aucune API du navigateur dans la logique"
      : `API du navigateur : ${apis.join(", ")}`,
  );
  const externes = logique.flatMap((f) =>
    imports(lire(f))
      .filter((m) => !m.startsWith("./"))
      .map((m) => `${relatif(f)} → ${m}`),
  );
  noter(
    "C9",
    externes.length === 0 ? 4 : 0,
    4,
    externes.length === 0
      ? "la logique n'importe que des fichiers du jeu"
      : `imports hors du jeu : ${externes.join(", ")}`,
  );
}

// C11 : les tests du jeu passent, ils appellent les fonctions de la logique, le hasard est injecté.
const tests = (
  existsSync(path.join(racine, "test"))
    ? readdirSync(path.join(racine, "test"), { recursive: true })
    : []
)
  .map((nom) => path.join(racine, "test", String(nom)))
  .filter(
    (f) =>
      f.endsWith(".test.ts") &&
      readFileSync(f, "utf8").includes(`games/${id}/`),
  );

if (tests.length === 0) {
  noter("C11", 0, 4, `aucun fichier test/*.test.ts n'importe src/games/${id}/`);
} else {
  // Seuls les tests du jeu sont lancés : un échec ailleurs dans la borne ne compte pas.
  const commande = `npx vitest run ${tests.map((f) => `"${relatif(f)}"`).join(" ")}`;
  const resultat = spawnSync(commande, {
    cwd: racine,
    shell: true,
    encoding: "utf8",
    timeout: 120_000,
  });
  const ok = resultat.status === 0;
  noter(
    "C11",
    ok ? 4 : 0,
    4,
    `${tests.map(relatif).join(", ")} : ${ok ? "les tests passent" : "des tests échouent"}`,
  );
}

const codeTests = tests.map(lire).join("\n");
const exportees = [
  ...codeLogique.matchAll(
    /\bexport\s+(?:async\s+)?function\s+(\w+)|\bexport\s+const\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\w+\s*=>|\([^;]*?=>)/g,
  ),
].map((m) => m[1] ?? m[2]);
const testees = exportees.filter((nom) =>
  new RegExp(`\\b${nom}\\s*\\(`).test(codeTests),
);
noter(
  "C11",
  exportees.length === 0
    ? 0
    : Math.round((3 * testees.length) / exportees.length),
  3,
  exportees.length === 0
    ? "la logique n'exporte aucune fonction"
    : `fonctions de la logique appelées par les tests : ${testees.length}/${exportees.length}` +
        (testees.length < exportees.length
          ? ` (manquent : ${exportees.filter((n) => !testees.includes(n)).join(", ")})`
          : ""),
);

const hasard = /Math\.random\s*\(|crypto\.getRandomValues\s*\(/.test(
  codeLogique,
);
noter(
  "C11",
  logique.length > 0 && !hasard ? 3 : 0,
  3,
  logique.length === 0
    ? "pas de logique séparée : hasard non vérifiable"
    : hasard
      ? "la logique appelle Math.random() : le hasard n'est pas injectable"
      : "la logique n'appelle jamais Math.random() : le hasard lui est fourni",
);

console.log(
  JSON.stringify(
    { jeu: id, logique: logique.map(relatif), notes, details },
    null,
    2,
  ),
);
