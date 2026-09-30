// Tests de corriger.mjs (recherche de couleur, plan, écriture) : node --test corriger.test.mjs
// Aucun fichier du projet n'est lu : tout le CSS est écrit en chaînes ici.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyser,
  analyserCouleur,
  composer,
  deltaE,
  luminance,
  oklabVersOklch,
  ratioContraste,
  srgbVersOklab,
  versHex,
} from './contraste.mjs';
import {
  analyserFormat,
  appliquerModifications,
  chercherCouleurTexte,
  chercherFond,
  corriger,
  planifier,
  renommerVariable,
  serialiserCouleur,
} from './corriger.mjs';

const dossier = dirname(fileURLToPath(import.meta.url));
const SCAN = join(dossier, 'contraste.mjs');
const CORRIGER = join(dossier, 'corriger.mjs');

const hex = (h) => analyserCouleur(h);
const rgb = (r, g, b) => ({ r, g, b, a: 1 });
const fichier = (source, chemin = 'test.css') => [{ chemin, source }];

describe('recherche de couleur', () => {
  const formatHex = analyserFormat('#000000');
  const contrainte = (fond, seuil = 4.5) => [{ fond: hex(fond), seuil }];

  it('éclaircit un texte sombre sur fond sombre et assombrit un texte clair sur fond clair', () => {
    const sombre = chercherCouleurTexte(hex('#333'), contrainte('#000'), formatHex);
    assert.ok(luminance(sombre.couleur) > luminance(hex('#333')));
    assert.ok(sombre.ratio >= 4.5);
    const clair = chercherCouleurTexte(hex('#ddd'), contrainte('#fff'), formatHex);
    assert.ok(luminance(clair.couleur) < luminance(hex('#ddd')));
    assert.ok(clair.ratio >= 4.5);
  });
  it('choisit le sens le plus proche en ΔE', () => {
    const r = chercherCouleurTexte(hex('#9a9a9a'), contrainte('#fff'), formatHex);
    assert.ok(luminance(r.couleur) < luminance(hex('#9a9a9a')));
    assert.ok(r.deltaE < deltaE(hex('#9a9a9a'), hex('#000')));
  });
  it('retourne null quand ni le noir ni le blanc ne suffisent', () => {
    assert.equal(chercherCouleurTexte(hex('#333'), contrainte('#808080', 7), formatHex), null);
    assert.notEqual(chercherCouleurTexte(hex('#333'), contrainte('#808080', 4.5), formatHex), null);
  });
  it('propose le fond conforme le plus proche pour un texte donné', () => {
    const r = chercherFond(hex('#333'), hex('#808080'), 7);
    assert.ok(ratioContraste(hex('#333'), r.couleur) >= 7);
    assert.ok(luminance(r.couleur) > luminance(hex('#808080')));
  });
  it('le résultat passe encore après arrondi 8 bits et sérialisation', () => {
    const r = chercherCouleurTexte(
      hex('#2a8390'),
      contrainte('#2a2e37'),
      analyserFormat('hsl(190, 55%, 36%)'),
    );
    const relu = analyserCouleur(r.texte);
    assert.ok(ratioContraste(relu, hex('#2a2e37')) >= 4.5, r.texte);
    assert.match(r.texte, /^hsl\([\d.]+, [\d.]+%, [\d.]+%\)$/);
  });
  it('garde l’alpha d’un texte semi-transparent et fait passer le rendu composé', () => {
    const r = chercherCouleurTexte(
      hex('rgba(120, 120, 120, 0.8)'),
      contrainte('#fff'),
      analyserFormat('rgba(120, 120, 120, 0.8)'),
    );
    assert.match(r.texte, /^rgba\(\d+, \d+, \d+, 0\.8\)$/);
    const relu = analyserCouleur(r.texte);
    assert.equal(relu.a, 0.8);
    assert.ok(ratioContraste(composer(relu, hex('#fff')), hex('#fff')) >= 4.5);
  });
  it('une couleur achromatique reste grise', () => {
    const r = chercherCouleurTexte(hex('#777'), contrainte('#fff'), formatHex);
    assert.equal(r.couleur.r, r.couleur.g);
    assert.equal(r.couleur.g, r.couleur.b);
  });
  it('conserve la teinte', () => {
    const origine = hex('#2a8390');
    const r = chercherCouleurTexte(origine, contrainte('#2a2e37'), formatHex);
    const h0 = oklabVersOklch(srgbVersOklab(origine)).h;
    const h1 = oklabVersOklch(srgbVersOklab(r.couleur)).h;
    assert.ok(Math.abs(h0 - h1) < 3, `${h0} vs ${h1}`);
  });
  it('propriété : sur 500 paires aléatoires, conforme, proche du seuil et jamais pire que noir ou blanc', () => {
    let graine = 20260930;
    const alea = () => {
      graine = (graine + 0x6d2b79f5) >>> 0;
      let t = graine;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const canal = () => Math.floor(alea() * 256);
    const seuils = [3, 4.5, 7];
    let corriges = 0;
    let impossibles = 0;
    for (let n = 0; n < 500; n++) {
      const texte = rgb(canal(), canal(), canal());
      const fond = rgb(canal(), canal(), canal());
      const seuil = seuils[Math.floor(alea() * 3)];
      const contraintes = [{ fond, seuil }];
      const noir = ratioContraste(hex('#000'), fond) >= seuil;
      const blanc = ratioContraste(hex('#fff'), fond) >= seuil;
      const r = chercherCouleurTexte(texte, contraintes, formatHex);
      if (!noir && !blanc) {
        assert.equal(
          r,
          null,
          `aucune solution attendue pour ${versHex(texte)} sur ${versHex(fond)} (${seuil})`,
        );
        impossibles++;
        continue;
      }
      assert.ok(r, `solution attendue pour ${versHex(texte)} sur ${versHex(fond)} (${seuil})`);
      const ratio = ratioContraste(r.couleur, fond);
      assert.ok(ratio >= seuil, `${r.texte} sur ${versHex(fond)} : ${ratio} < ${seuil}`);
      if (ratioContraste(texte, fond) < seuil) {
        assert.ok(
          ratio - seuil < 0.35,
          `dépassement ${ratio - seuil} pour ${versHex(texte)} sur ${versHex(fond)} (${seuil})`,
        );
        corriges++;
      } else assert.equal(r.texte, versHex(texte));
      const reference = Math.min(
        noir ? deltaE(texte, hex('#000')) : Infinity,
        blanc ? deltaE(texte, hex('#fff')) : Infinity,
      );
      assert.ok(r.deltaE <= reference + 1e-9, `ΔE ${r.deltaE} pire que noir/blanc ${reference}`);
    }
    assert.ok(
      corriges > 100 && impossibles > 10,
      `${corriges} corrigés, ${impossibles} impossibles`,
    );
  });
});

describe('formats conservés', () => {
  it('sérialise dans le format d’origine', () => {
    const c = rgb(74, 160, 172);
    assert.equal(serialiserCouleur(c, analyserFormat('#2a8390')), '#4aa0ac');
    assert.equal(serialiserCouleur(c, analyserFormat('#2A8390')), '#4AA0AC');
    assert.equal(serialiserCouleur(rgb(68, 170, 204), analyserFormat('#abc')), '#4ac');
    assert.equal(serialiserCouleur(c, analyserFormat('#abc')), '#4aa0ac');
    assert.equal(serialiserCouleur(c, analyserFormat('#abc8')), '#4aa0ac88');
    assert.equal(serialiserCouleur(rgb(68, 170, 204), analyserFormat('#abc8')), '#4ac8');
    assert.equal(serialiserCouleur(c, analyserFormat('rgb(42, 131, 144)')), 'rgb(74, 160, 172)');
    assert.equal(
      serialiserCouleur(c, analyserFormat('rgb(42 131 144 / 50%)')),
      'rgb(74 160 172 / 50%)',
    );
    assert.equal(
      serialiserCouleur(c, analyserFormat('rgba(42,131,144,0.5)')),
      'rgba(74,160,172,0.5)',
    );
    assert.equal(serialiserCouleur(c, analyserFormat('teal')), '#4aa0ac');
    assert.match(
      serialiserCouleur(c, analyserFormat('hsl(190 55% 36%)')),
      /^hsl\(\d+ \d+% \d+%\)$/,
    );
    assert.match(
      serialiserCouleur(c, analyserFormat('oklch(55% 0.08 200)'), 1),
      /^oklch\([\d.]+% [\d.]+ [\d.]+\)$/,
    );
    assert.match(
      serialiserCouleur(c, analyserFormat('lab(50 -20 -10)'), 1),
      /^lab\([\d.-]+ [\d.-]+ [\d.-]+\)$/,
    );
  });
  it('renomme une variable dans var() sans toucher au repli ni aux noms voisins', () => {
    assert.equal(
      renommerVariable('var(--t, var(--t-autre))', '--t', '--t-contraste'),
      'var(--t-contraste, var(--t-autre))',
    );
    assert.equal(renommerVariable('var( --t )', '--t', '--t-c'), 'var( --t-c )');
  });
  it('applique des modifications par décalages, insertions comprises', () => {
    const source = 'a: 1; b: 2; c: 3';
    const resultat = appliquerModifications(source, [
      { debut: 3, fin: 4, texte: 'un' },
      { debut: 5, fin: 5, texte: ' x: 0;' },
      { debut: 15, fin: 16, texte: 'trois' },
    ]);
    assert.equal(resultat, 'a: un; x: 0; b: 2; c: trois');
    assert.throws(() =>
      appliquerModifications(source, [
        { debut: 0, fin: 4, texte: '' },
        { debut: 2, fin: 6, texte: '' },
      ]),
    );
  });
});

describe('plan de correction', () => {
  const corrigerSource = (source, options) => {
    const resultat = corriger(fichier(source), options);
    return { ...resultat, apres: resultat.sourcesApres.get('test.css') };
  };

  it('modifie un littéral en place, format et !important conservés', () => {
    const { apres, plan, analyseApres } = corrigerSource(
      '.a {\n  /* gardé */\n  color: #ABC !important; /* aussi */\n  background: #fff;\n}',
    );
    assert.match(apres, /color: #[0-9A-F]{3,6} !important; \/\* aussi \*\//);
    assert.ok(apres.includes('/* gardé */'));
    assert.equal(plan.corrections[0].mode, 'litteral');
    assert.equal(analyseApres.paires[0].statut, 'conforme');
  });
  it('un nom CSS devient un hex, rgb() reste rgb(), hsl() garde assez de précision', () => {
    const { apres } = corrigerSource(
      '.a { color: gray; background: #fff } .b { color: rgb(153, 153, 153); background: #fff } .c { color: hsl(190, 55%, 46%); background: #fff }',
    );
    assert.match(apres, /\.a \{ color: #[0-9a-f]{3,6};/);
    assert.match(apres, /\.b \{ color: rgb\(\d+, \d+, \d+\);/);
    assert.match(apres, /\.c \{ color: hsl\([\d.]+, [\d.]+%, [\d.]+%\);/);
    const rescan = analyser(fichier(apres));
    assert.ok(rescan.paires.every((p) => p.statut === 'conforme'));
  });
  it('corrige une variable partagée par plusieurs paires avec une seule couleur', () => {
    const source =
      ':root { --t: #999 } .a { color: var(--t); background: #fff } .b { color: var(--t); background: #f0f0f0 }';
    const { apres, plan, analyseApres } = corrigerSource(source);
    assert.equal(plan.corrections.length, 1);
    assert.equal(plan.corrections[0].mode, 'variable');
    assert.equal(plan.corrections[0].paires.length, 2);
    assert.match(apres, /:root \{ --t: #[0-9a-f]{6} \}/);
    assert.ok(analyseApres.paires.every((p) => p.statut === 'conforme'));
  });
  it('les paires déjà conformes restent conformes, même dans une fenêtre étroite', () => {
    // .b échoue sur blanc, .c passe sur noir : une seule couleur doit satisfaire les deux (fenêtre de ~1 %).
    const source =
      ':root { --t: #949494 } .a { color: var(--t); background: #fff; font-size: 24px } .b { color: var(--t); background: #fff } .c { color: var(--t); background: #000 }';
    const { analyseApres, plan } = corrigerSource(source);
    assert.equal(plan.corrections.length, 1);
    assert.equal(plan.corrections[0].mode, 'variable');
    assert.ok(
      analyseApres.paires.every((p) => p.statut === 'conforme'),
      JSON.stringify(analyseApres.paires.map((p) => [p.selecteur, p.ratio])),
    );
  });
  it('crée une variable dédiée quand la variable sert aussi de bordure', () => {
    const source =
      ':root {\n  --t: #999;\n  --autre: #000;\n}\n.a { color: var(--t); background: #fff }\n.b { border: 1px solid var(--t) }';
    const { apres, plan } = corrigerSource(source);
    assert.equal(plan.corrections[0].mode, 'variable-dediee');
    assert.equal(plan.corrections[0].variableDediee, '--t-contraste');
    assert.match(apres, /  --t: #999;\n  --t-contraste: #[0-9a-f]{6};\n  --autre: #000;/);
    assert.ok(apres.includes('.a { color: var(--t-contraste); background: #fff }'));
    assert.ok(apres.includes('.b { border: 1px solid var(--t) }'));
    assert.equal(plan.corrections[0].raison, 'aussi utilisée comme border dans .b');
    assert.ok(plan.avertissements.some((a) => /fichier non analysé/.test(a)));
  });
  it('crée une variable dédiée quand la variable sert à une règle au fond inconnu', () => {
    const source =
      ':root { --t: #999 } .a { color: var(--t); background: #fff } .b { color: var(--t) }';
    const { apres, plan } = corrigerSource(source);
    assert.ok(apres.includes('--t-contraste:'));
    assert.ok(apres.includes('.b { color: var(--t) }'));
    assert.equal(plan.corrections[0].raison, 'aussi utilisée par .b (fond inconnu)');
  });
  it('la raison de la variable dédiée cite chaque usage gênant, alias et contexte compris', () => {
    const source =
      ":root { --t: #999; --alias: var(--t) } [data-theme='x'] { --t: #888 } .a { color: var(--t); background: #fff } .b { color: var(--t); background: rgba(0,0,0,.5) } .c { outline-color: var(--t) }";
    const { plan } = corrigerSource(source);
    const dediee = plan.corrections.find((c) => c.mode === 'variable-dediee');
    assert.match(dediee.raison, /par la variable --alias/);
    assert.match(dediee.raison, /par \.b \(à vérifier\)/);
    assert.match(dediee.raison, /comme outline-color dans \.c/);
  });
  it('signale une inversion clair/sombre dans le plan et le rapport', () => {
    // Jaune clair sur orange : ni le blanc ni un jaune plus clair ne suffisent, le texte devient sombre.
    const inverse = corrigerSource('.a { color: #fff09a; background: #ff8a1f }');
    assert.equal(inverse.plan.corrections[0].inversion, true);
    assert.equal(inverse.rapport.corrections[0].inversion, true);
    assert.ok(luminance(hex(inverse.plan.corrections[0].apres)) < luminance(hex('#ff8a1f')));
    // Gris sur blanc : le texte s'assombrit mais reste du même côté.
    const simple = corrigerSource('.a { color: #999; background: #fff }');
    assert.equal(simple.plan.corrections[0].inversion, false);
    // Variable partagée : l'inversion sur une seule des paires suffit (.b reste du même côté du blanc).
    const partagee = corrigerSource(
      ':root { --t: #fff09a } .a { color: var(--t); background: #ff8a1f } .b { color: var(--t); background: #fff }',
    );
    assert.equal(partagee.plan.corrections[0].mode, 'variable');
    assert.equal(partagee.plan.corrections[0].inversion, true);
  });
  it('crée une variable dédiée quand les contraintes sont incompatibles', () => {
    const source =
      ':root { --t: #999 } .a { color: var(--t); background: #fff } .b { color: var(--t); background: #000 }';
    const { apres, plan, analyseApres } = corrigerSource(source, { niveau: 'AAA' });
    assert.equal(plan.corrections[0].mode, 'variable-dediee');
    assert.match(plan.corrections[0].raison, /incompatibles/);
    assert.ok(apres.includes('.a { color: var(--t-contraste)'));
    assert.ok(apres.includes('.b { color: var(--t)'));
    assert.ok(analyseApres.paires.every((p) => p.statut === 'conforme'));
  });
  it('numérote la variable dédiée si le nom existe déjà', () => {
    const source =
      ':root { --t: #999; --t-contraste: #000 } .a { color: var(--t); background: #fff } .b { border-color: var(--t) }';
    const { apres } = corrigerSource(source);
    assert.ok(apres.includes('--t-contraste-2:'));
    assert.ok(apres.includes('color: var(--t-contraste-2)'));
  });
  it('redéfinit un alias avec un littéral sans toucher à la variable partagée', () => {
    const source = ':root { --b: #999; --a: var(--b) } .a { color: var(--a); background: #fff }';
    const { apres, plan } = corrigerSource(source);
    assert.equal(plan.corrections[0].mode, 'variable');
    assert.equal(plan.corrections[0].site.variable, '--a');
    assert.match(apres, /--b: #999; --a: #[0-9a-f]{6} \}/);
  });
  it('une variable redéfinie dans un thème est un site distinct', () => {
    const source =
      ":root { --t: #999 } [data-theme='x'] { --t: #aaa } .a { color: var(--t); background: #fff }";
    const { apres, plan, analyseApres } = corrigerSource(source);
    assert.equal(plan.corrections.length, 2);
    assert.ok(plan.corrections.every((c) => c.mode === 'variable'));
    assert.doesNotMatch(apres, /#999|#aaa/);
    assert.ok(analyseApres.paires.every((p) => p.statut === 'conforme'));
  });
  it('les autres contextes qui redéfinissent la variable reçoivent l’alias vers l’original', () => {
    const source =
      ":root { --t: #999 } [data-theme='x'] { --t: #000 } .a { color: var(--t); background: #fff } .b { outline-color: var(--t) }";
    const { apres, analyseApres } = corrigerSource(source);
    assert.ok(apres.includes("[data-theme='x'] { --t: #000; --t-contraste: var(--t) }"));
    assert.ok(analyseApres.paires.every((p) => p.statut === 'conforme'));
  });
  it('corrige à travers plusieurs fichiers, dans le fichier qui définit la variable', () => {
    const resultat = corriger([
      { chemin: 'vars.css', source: ':root { --t: #999 }' },
      { chemin: 'regles.css', source: '.a { color: var(--t); background: #fff }' },
    ]);
    assert.notEqual(resultat.sourcesApres.get('vars.css'), ':root { --t: #999 }');
    assert.equal(
      resultat.sourcesApres.get('regles.css'),
      '.a { color: var(--t); background: #fff }',
    );
    assert.equal(resultat.plan.corrections[0].site.fichier, 'vars.css');
  });
  it('signale les cas impossibles et propose un fond, sans rien écrire pour eux', () => {
    const source = '.a { color: #333; background: #808080 } .b { color: #999; background: #fff }';
    const { apres, plan, analyseApres } = corrigerSource(source, { niveau: 'AAA' });
    assert.equal(plan.impossibles.length, 1);
    assert.equal(plan.impossibles[0].site.selecteur, '.a');
    assert.match(plan.impossibles[0].fondPropose, /^#[0-9a-f]{6}$/);
    assert.ok(apres.includes('.a { color: #333; background: #808080 }'));
    assert.equal(analyseApres.paires.find((p) => p.selecteur === '.b').statut, 'conforme');
  });
  it('garde l’alpha d’un texte semi-transparent', () => {
    const { apres, analyseApres } = corrigerSource(
      '.a { color: rgba(120, 120, 120, 0.8); background: #fff }',
    );
    assert.match(apres, /color: rgba\(\d+, \d+, \d+, 0\.8\)/);
    assert.equal(analyseApres.paires[0].statut, 'conforme');
  });
  it('un second passage ne change rien', () => {
    const source =
      ':root { --t: #999; --u: #999 } .a { color: var(--t); background: #fff } .b { color: var(--u); background: #fff } .c { border-color: var(--u) } .d { color: #ccc; background: #fff }';
    const premier = corriger(fichier(source));
    const second = corriger(fichier(premier.sourcesApres.get('test.css')));
    assert.equal(second.plan.corrections.length, 0);
    assert.equal(second.sourcesApres.get('test.css'), premier.sourcesApres.get('test.css'));
    assert.ok(premier.rapport.corrections.length >= 3);
    assert.ok(premier.rapport.corrections.every((c) => c.paires.every((p) => p.ratioApres >= 4.5)));
  });
  it('planifier ne touche pas aux paires « à vérifier »', () => {
    const a = analyser(fichier('.a { color: #999; background: #fff; text-shadow: 0 0 1px #000 }'));
    const plan = planifier(a, new Map([['test.css', '']]));
    assert.equal(plan.corrections.length, 0);
  });
});

describe('ligne de commande', () => {
  let temp;
  const executer = (script, args, options = {}) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: temp,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      ...options,
    });

  before(() => {
    temp = mkdtempSync(join(tmpdir(), 'wcag-test-'));
    writeFileSync(
      join(temp, 'echec.css'),
      ':root { --t: #777 }\n.a { color: var(--t); background: #fff }\n',
    );
    writeFileSync(join(temp, 'ok.css'), '.a { color: #000; background: #fff }\n');
  });
  after(() => {
    rmSync(temp, { recursive: true, force: true });
  });

  it('--aide documente usage, options et limites', () => {
    for (const script of [CORRIGER]) {
      const r = executer(script, ['--aide']);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /Usage/);
      assert.match(r.stdout, /--niveau/);
      assert.match(r.stdout, /Limites connues/);
    }
  });
  it('corriger sans --ecrire laisse le CSS intact et décrit l’état corrigé', () => {
    const avant = readFileSync(join(temp, 'echec.css'), 'utf8');
    const r = executer(CORRIGER, [
      'echec.css',
      '--sortie',
      'plan/apres.json',
      '--etiquette',
      'Après test',
    ]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /--t \(:root, echec\.css:1\) — variable/);
    assert.match(r.stdout, /Aucun fichier modifié/);
    assert.equal(readFileSync(join(temp, 'echec.css'), 'utf8'), avant);
    const rapport = JSON.parse(readFileSync(join(temp, 'plan/apres.json'), 'utf8'));
    assert.equal(rapport.etiquette, 'Après test');
    assert.equal(rapport.resume.echecs, 0);
    assert.equal(rapport.corrections.length, 1);
    assert.equal(rapport.corrections[0].mode, 'variable');
    assert.ok(rapport.corrections[0].paires[0].ratioApres >= 4.5);
    assert.equal(rapport.paires[0].id, 'echec.css|:root|.a');
  });
  it('corriger --ecrire applique, puis le scan passe et le second passage ne change rien', () => {
    mkdirSync(join(temp, 'ecriture'), { recursive: true });
    writeFileSync(join(temp, 'ecriture/theme.css'), readFileSync(join(temp, 'echec.css'), 'utf8'));
    const r = executer(CORRIGER, ['ecriture/theme.css', '--ecrire']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Fichier\(s\) modifié\(s\) : ecriture\/theme\.css/);
    const modifie = readFileSync(join(temp, 'ecriture/theme.css'), 'utf8');
    assert.doesNotMatch(modifie, /#777/);
    assert.equal(executer(SCAN, ['scan', 'ecriture/theme.css']).status, 0);
    const second = executer(CORRIGER, ['ecriture/theme.css', '--ecrire']);
    assert.match(second.stdout, /Aucune modification à écrire/);
    assert.equal(readFileSync(join(temp, 'ecriture/theme.css'), 'utf8'), modifie);
  });
  it('corriger retourne 1 quand il reste un cas impossible', () => {
    writeFileSync(join(temp, 'impossible.css'), '.a { color: #333; background: #808080 }\n');
    const r = executer(CORRIGER, ['impossible.css', '--niveau', 'AAA']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Impossible en ne modifiant que le texte/);
    assert.match(r.stdout, /fond conforme le plus proche/);
    assert.equal(executer(CORRIGER, ['absent.css']).status, 2);
    assert.ok(existsSync(join(temp, 'impossible.css')));
  });
  it('corriger avertit d’une inversion clair/sombre dans le plan', () => {
    writeFileSync(join(temp, 'inversion.css'), '.a { color: #fff09a; background: #ff8a1f }\n');
    const r = executer(CORRIGER, ['inversion.css']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Attention : inversion clair\/sombre, à valider visuellement/);
    assert.doesNotMatch(executer(CORRIGER, ['echec.css']).stdout, /inversion clair\/sombre/);
  });
});
