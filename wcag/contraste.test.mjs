// Tests de contraste.mjs et corriger.mjs : node --test contraste.test.mjs
// Aucun fichier du projet n'est lu : tout le CSS est écrit en chaînes ici.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NOMS_CSS,
  analyser,
  analyserCouleur,
  analyserCss,
  analyserTaille,
  composer,
  construireRapport,
  deltaE,
  estGras,
  estGrandTexte,
  luminance,
  oklabVersOklch,
  ratioContraste,
  separerTheme,
  seuilContraste,
  srgbVersOklab,
  tronquer,
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
const paireUnique = (analyse) => {
  assert.equal(
    analyse.paires.length,
    1,
    `une seule paire attendue, ${analyse.paires.length} trouvée(s)`,
  );
  return analyse.paires[0];
};

describe('valeurs de référence', () => {
  it('noir sur blanc vaut 21', () => {
    assert.equal(ratioContraste(hex('#000'), hex('#fff')), 21);
  });
  it('deux couleurs identiques valent 1', () => {
    assert.equal(ratioContraste(hex('#2a8390'), hex('#2a8390')), 1);
  });
  it('#777 sur blanc vaut 4,478 (affiché 4.47, échec AA)', () => {
    const ratio = ratioContraste(hex('#777'), hex('#fff'));
    assert.ok(Math.abs(ratio - 4.478) < 0.001, String(ratio));
    assert.equal(ratio.toFixed(2), '4.48');
    assert.equal(tronquer(ratio), '4.47');
    assert.ok(ratio < 4.5);
  });
  it('#767676 sur blanc vaut 4,54 et passe AA', () => {
    const ratio = ratioContraste(hex('#767676'), hex('#fff'));
    assert.equal(tronquer(ratio), '4.54');
    assert.ok(ratio >= 4.5);
  });
  it('#595959 sur blanc vaut 7,00 et passe AAA', () => {
    const ratio = ratioContraste(hex('#595959'), hex('#fff'));
    assert.equal(tronquer(ratio), '7.00');
    assert.ok(ratio >= 7);
  });
  it('rgba(0,0,0,.5) sur blanc se compose en #808080', () => {
    assert.equal(versHex(composer(hex('rgba(0,0,0,.5)'), hex('#fff'))), '#808080');
  });
  it('le ratio est symétrique', () => {
    assert.equal(
      ratioContraste(hex('#2a8390'), hex('#2a2e37')),
      ratioContraste(hex('#2a2e37'), hex('#2a8390')),
    );
  });
  it('la luminance du blanc est 1 et celle du noir 0', () => {
    assert.equal(luminance(rgb(255, 255, 255)), 1);
    assert.equal(luminance(rgb(0, 0, 0)), 0);
  });
  it('l’affichage tronque : 4,499 devient « 4.49 » et échoue, 4,5 devient « 4.50 »', () => {
    assert.equal(tronquer(4.499), '4.49');
    assert.equal(tronquer(4.5), '4.50');
    assert.equal(tronquer(21), '21.00');
    assert.ok(4.499 < seuilContraste('AA', false));
  });
});

describe('formats de couleur', () => {
  it('hex à 3, 4, 6 et 8 chiffres', () => {
    assert.deepEqual(hex('#abc'), rgb(170, 187, 204));
    assert.deepEqual(hex('#ABCDEF'), rgb(171, 205, 239));
    assert.equal(hex('#abcd').a.toFixed(4), '0.8667');
    assert.equal(hex('#00000080').a.toFixed(4), '0.5020');
  });
  it('rgb() et rgba() en syntaxe virgules, espaces, pourcentages et « / alpha »', () => {
    assert.deepEqual(hex('rgb(1, 2, 3)'), rgb(1, 2, 3));
    assert.deepEqual(hex('rgba(1,2,3,0.5)'), { r: 1, g: 2, b: 3, a: 0.5 });
    assert.deepEqual(hex('rgb(1 2 3 / 25%)'), { r: 1, g: 2, b: 3, a: 0.25 });
    assert.deepEqual(hex('rgb(100%, 50%, 0%)'), rgb(255, 128, 0));
  });
  it('hsl() et hsla() avec deg, turn, rad et grad', () => {
    assert.deepEqual(hex('hsl(120, 100%, 50%)'), rgb(0, 255, 0));
    assert.deepEqual(hex('hsl(120deg 100% 50%)'), rgb(0, 255, 0));
    assert.deepEqual(hex('hsl(0.5turn 100% 50%)'), rgb(0, 255, 255));
    assert.deepEqual(hex('hsl(3.14159265rad 100% 50%)'), rgb(0, 255, 255));
    assert.deepEqual(hex('hsl(200grad 100% 50%)'), rgb(0, 255, 255));
    assert.deepEqual(hex('hsla(0, 0%, 50%, .5)'), { r: 128, g: 128, b: 128, a: 0.5 });
  });
  it('hwb()', () => {
    assert.deepEqual(hex('hwb(0 0% 0%)'), rgb(255, 0, 0));
    assert.deepEqual(hex('hwb(0 50% 50%)'), rgb(128, 128, 128));
  });
  it('oklch() et oklab() convertissent correctement vers sRGB', () => {
    const proche = (c, r, g, b) =>
      assert.ok(
        Math.abs(c.r - r) <= 1 && Math.abs(c.g - g) <= 2 && Math.abs(c.b - b) <= 2,
        versHex(c),
      );
    proche(hex('oklch(62.8% 0.2577 29.23)'), 255, 0, 0);
    proche(hex('oklab(0.628 0.2249 0.1258)'), 255, 0, 0);
    proche(hex('oklch(100% 0 0)'), 255, 255, 255);
    proche(hex('oklch(0.5 0 0)'), 99, 99, 99);
  });
  it('lab() et lch() (D50) convertissent correctement vers sRGB', () => {
    const proche = (c, r, g, b) =>
      assert.ok(
        Math.abs(c.r - r) <= 1 && Math.abs(c.g - g) <= 2 && Math.abs(c.b - b) <= 2,
        versHex(c),
      );
    proche(hex('lab(54.29 80.81 69.89)'), 255, 0, 0);
    proche(hex('lch(54.29 106.84 40.85)'), 255, 0, 0);
    proche(hex('lab(100 0 0)'), 255, 255, 255);
  });
  it('color(srgb …) et color(srgb-linear …)', () => {
    assert.deepEqual(hex('color(srgb 1 0 0)'), rgb(255, 0, 0));
    assert.deepEqual(hex('color(srgb-linear 1 1 1)'), rgb(255, 255, 255));
  });
  it('les 148 noms CSS, insensibles à la casse', () => {
    assert.equal(Object.keys(NOMS_CSS).length, 148);
    assert.deepEqual(hex('rebeccapurple'), rgb(102, 51, 153));
    assert.deepEqual(hex('White'), rgb(255, 255, 255));
    assert.deepEqual(hex('grey'), hex('gray'));
  });
  it('transparent a un alpha nul', () => {
    assert.equal(hex('transparent').a, 0);
  });
  it('currentColor, color-mix(), light-dark(), couleurs système et inherit sont « à vérifier »', () => {
    for (const c of [
      'currentColor',
      'color-mix(in srgb, red, blue)',
      'light-dark(#000, #fff)',
      'Canvas',
      'inherit',
      'unset',
    ]) {
      assert.ok(hex(c) && hex(c).indetermine, c);
    }
  });
  it('les valeurs invalides retournent null', () => {
    for (const c of ['#ggg', '#12345', 'rgb(1, 2)', 'hsl(a, b, c)', 'foo', '', 'rgb()'])
      assert.equal(hex(c), null, c);
  });
});

describe('tailles et seuils', () => {
  it('px : 24 px est grand, 23 px non', () => {
    assert.equal(estGrandTexte(analyserTaille('24px').px, false), true);
    assert.equal(estGrandTexte(analyserTaille('23px').px, false), false);
  });
  it('gras : 18,67 px en gras est grand, 18,66 px non, 18 px gras non', () => {
    assert.equal(estGrandTexte(analyserTaille('18.6667px').px, true), true);
    assert.equal(estGrandTexte(analyserTaille('18.66px').px, true), false);
    assert.equal(estGrandTexte(analyserTaille('18px').px, true), false);
  });
  it('pt : 14 pt en gras est grand, 18 pt l’est toujours', () => {
    assert.equal(estGrandTexte(analyserTaille('14pt').px, true), true);
    assert.equal(estGrandTexte(analyserTaille('14pt').px, false), false);
    assert.equal(estGrandTexte(analyserTaille('18pt').px, false), true);
  });
  it('rem : 1,5 rem = 24 px', () => {
    assert.equal(analyserTaille('1.5rem').px, 24);
    assert.equal(estGrandTexte(24, false), true);
  });
  it('em, %, vw, cqw, calc(), clamp() et var() sont indéterminés avec une raison', () => {
    for (const t of [
      '1.5em',
      '150%',
      '2vw',
      '2cqw',
      'calc(1rem + 2px)',
      'clamp(1rem, 2vw, 3rem)',
      'var(--x)',
    ]) {
      const r = analyserTaille(t);
      assert.equal(r.px, null, t);
      assert.match(r.raison, /indéterminée/);
    }
  });
  it('graisse : bold, bolder et ≥ 700', () => {
    for (const g of ['bold', 'bolder', '700', '800', '900']) assert.equal(estGras(g), true, g);
    for (const g of ['normal', '600', 'lighter', '']) assert.equal(estGras(g), false, g);
  });
  it('seuils AA et AAA', () => {
    assert.equal(seuilContraste('AA', false), 4.5);
    assert.equal(seuilContraste('AA', true), 3);
    assert.equal(seuilContraste('AAA', false), 7);
    assert.equal(seuilContraste('AAA', true), 4.5);
  });
});

describe('parseur CSS', () => {
  it('conserve la position exacte des déclarations', () => {
    const source = '.a {\n  color: #777 !important;\n  background: #fff\n}';
    const { regles } = analyserCss(source, 'x.css');
    assert.equal(regles.length, 1);
    const [color, fond] = regles[0].declarations;
    assert.equal(source.slice(color.debutNom, color.finNom), 'color');
    assert.equal(source.slice(color.debutValeur, color.finValeur), '#777');
    assert.equal(color.important, true);
    assert.equal(color.ligne, 2);
    assert.equal(color.pointVirgule, true);
    assert.equal(color.indentation, '  ');
    assert.equal(fond.pointVirgule, false);
    assert.equal(source.slice(fond.debutValeur, fond.finValeur), '#fff');
  });
  it('résiste aux commentaires et aux chaînes contenant { } ;', () => {
    const source = `/* } piège { */ .a { content: "{;}"; color: #000; /* ; */ background: url('a;b}.png'), #fff; }
      .b::before { content: '}'; color: #000; background: #fff }`;
    const { regles } = analyserCss(source);
    assert.deepEqual(
      regles.map((r) => r.selecteurs[0]),
      ['.a', '.b::before'],
    );
    assert.equal(regles[0].declarations.length, 3);
    assert.equal(regles[1].declarations.length, 3);
  });
  it('résout le CSS imbriqué avec & et le descendant implicite', () => {
    const { regles } = analyserCss(
      '.a { color: #000; &:hover { color: #111 } .b, .c { color: #222 } }',
    );
    assert.deepEqual(
      regles.map((r) => r.selecteurs),
      [['.a'], ['.a:hover'], ['.a .b', '.a .c']],
    );
  });
  it('suit les at-rules imbriquées (@media, @supports, @layer, @container)', () => {
    const source =
      '@layer base { @supports (display: grid) { @media (min-width: 1px) { @container (min-width: 1px) { .a { color: #000 } } } } }';
    const { regles } = analyserCss(source);
    assert.equal(regles.length, 1);
    assert.equal(regles[0].media, '(min-width: 1px)');
  });
  it('ignore @keyframes et @font-face', () => {
    const source =
      '@keyframes x { from { color: #000; background: #fff } } @font-face { font-family: x; src: url(a.woff) } .a { color: #000 }';
    const { regles } = analyserCss(source);
    assert.deepEqual(
      regles.map((r) => r.selecteurs[0]),
      ['.a'],
    );
  });
  it('sépare le thème racine du sélecteur propre', () => {
    assert.deepEqual(separerTheme(":root[data-theme='sobre'] .menu"), {
      theme: ":root[data-theme='sobre']",
      selecteur: '.menu',
      racine: false,
    });
    assert.deepEqual(separerTheme('html.dark > .menu'), {
      theme: 'html.dark',
      selecteur: '.menu',
      racine: false,
    });
    assert.deepEqual(separerTheme(':root'), { theme: null, selecteur: ':root', racine: true });
    assert.deepEqual(separerTheme("[data-theme='x']"), {
      theme: "[data-theme='x']",
      selecteur: "[data-theme='x']",
      racine: true,
    });
    assert.deepEqual(separerTheme('html body'), {
      theme: null,
      selecteur: 'html body',
      racine: false,
    });
  });
});

describe('analyse des paires', () => {
  it('trouve une paire texte/fond et l’identifie sans numéro de ligne', () => {
    const p = paireUnique(analyser(fichier('\n\n.a { color: #777; background: #fff }')));
    assert.equal(p.id, 'test.css|:root|.a');
    assert.equal(p.statut, 'echec');
    assert.equal(p.ligne, 3);
    assert.equal(p.texte.hex, '#777777');
    assert.equal(p.fond.hex, '#ffffff');
    assert.equal(p.seuil, 4.5);
  });
  it('fusionne les règles de même sélecteur : la dernière gagne, !important prioritaire', () => {
    const p = paireUnique(
      analyser(fichier('.a { color: #000 !important } .a { background: #fff } .a { color: #777 }')),
    );
    assert.equal(p.texte.hex, '#000000');
    assert.equal(p.statut, 'conforme');
  });
  it('le raccourci background garde la couleur de la dernière couche et signale les images', () => {
    const p = paireUnique(analyser(fichier('.a { color: #000; background: url(x.png), #fff }')));
    assert.equal(p.fond.hex, '#ffffff');
    assert.equal(p.statut, 'a-verifier');
    assert.ok(p.raisons.some((r) => /dégradé ou image/.test(r)));
    const q = paireUnique(
      analyser(fichier('.a { color: #000; background: #fff url(x.png) no-repeat }')),
    );
    assert.equal(q.fond.hex, '#ffffff');
  });
  it('background-color ou background : le plus récent gagne', () => {
    const p = paireUnique(
      analyser(fichier('.a { color: #000; background-color: #000; background: #fff }')),
    );
    assert.equal(p.fond.hex, '#ffffff');
    const q = paireUnique(
      analyser(fichier('.a { color: #000; background: #fff; background-color: #000 }')),
    );
    assert.equal(q.fond.hex, '#000000');
  });
  it('un dégradé donne « à vérifier » mais le ratio est quand même calculé', () => {
    const p = paireUnique(
      analyser(fichier('.a { color: #000; background: linear-gradient(#fff, #eee), #fff }')),
    );
    assert.equal(p.statut, 'a-verifier');
    assert.equal(p.ratio, 21);
  });
  it('text-shadow, filter, mix-blend-mode et opacity < 1 donnent « à vérifier », leurs valeurs neutres non', () => {
    for (const d of [
      'text-shadow: 0 0 2px #000',
      'filter: blur(1px)',
      'mix-blend-mode: multiply',
      'opacity: 0.5',
      'opacity: 50%',
    ]) {
      const p = paireUnique(analyser(fichier(`.a { color: #000; background: #fff; ${d} }`)));
      assert.equal(p.statut, 'a-verifier', d);
    }
    for (const d of ['text-shadow: none', 'filter: none', 'mix-blend-mode: normal', 'opacity: 1']) {
      const p = paireUnique(analyser(fichier(`.a { color: #000; background: #fff; ${d} }`)));
      assert.equal(p.statut, 'conforme', d);
    }
  });
  it('currentColor et inherit donnent « à vérifier »', () => {
    const p = paireUnique(analyser(fichier('.a { color: currentColor; background: #fff }')));
    assert.equal(p.statut, 'a-verifier');
    assert.ok(p.raisons.some((r) => /currentColor/.test(r)));
    const q = paireUnique(analyser(fichier('.a { color: #000; background: inherit }')));
    assert.equal(q.statut, 'a-verifier');
  });
  it('un fond transparent ou none va dans « fond inconnu »', () => {
    for (const fond of ['transparent', 'none', 'rgba(0,0,0,0)']) {
      const a = analyser(fichier(`.a { color: #000; background: ${fond} }`));
      assert.equal(a.paires.length, 0, fond);
      assert.equal(a.fondInconnu.length, 1, fond);
      assert.equal(a.fondInconnu[0].texte.hex, '#000000');
    }
  });
  it('un fond semi-transparent est « à vérifier » sans ratio', () => {
    const p = paireUnique(
      analyser(fichier('.a { color: #000; background: rgba(255,255,255,.7) }')),
    );
    assert.equal(p.statut, 'a-verifier');
    assert.equal(p.ratio, null);
  });
  it('une règle avec color sans fond est listée à part', () => {
    const a = analyser(fichier('.a { color: #777 } .b { background: #fff }'));
    assert.equal(a.paires.length, 0);
    assert.equal(a.fondInconnu.length, 1);
    assert.equal(a.fondInconnu[0].selecteur, '.a');
    assert.equal(a.fondInconnu[0].id, 'test.css|:root|.a');
  });
  it('un texte semi-transparent est composé sur le fond', () => {
    const p = paireUnique(analyser(fichier('.a { color: rgba(0,0,0,.5); background: #fff }')));
    assert.equal(p.texte.hex, '#808080');
    assert.equal(p.texte.alpha, 0.5);
    assert.equal(tronquer(p.ratio), '3.94');
  });
  it('taille et graisse : px, pt, var(), raccourci font, tailles inconnues', () => {
    const grand = paireUnique(
      analyser(fichier('.a { color: #777; background: #fff; font-size: 24px }')),
    );
    assert.equal(grand.grandTexte, true);
    assert.equal(grand.seuil, 3);
    assert.equal(grand.statut, 'conforme');
    const gras = paireUnique(
      analyser(
        fichier(
          ':root { --t: 14pt } .a { color: #777; background: #fff; font-size: var(--t); font-weight: bold }',
        ),
      ),
    );
    assert.equal(gras.grandTexte, true);
    const font = paireUnique(
      analyser(fichier('.a { color: #777; background: #fff; font: 700 20px/1.2 sans-serif }')),
    );
    assert.equal(font.grandTexte, true);
    const inconnu = paireUnique(
      analyser(fichier('.a { color: #777; background: #fff; font-size: 2em }')),
    );
    assert.equal(inconnu.grandTexte, false);
    assert.equal(inconnu.seuil, 4.5);
    assert.ok(inconnu.raisons.some((r) => /indéterminée/.test(r)));
  });
  it('le niveau AAA relève les seuils', () => {
    const p = paireUnique(
      analyser(fichier('.a { color: #595959; background: #fff }'), { niveau: 'AAA' }),
    );
    assert.equal(p.seuil, 7);
    assert.equal(p.statut, 'conforme');
    const q = paireUnique(
      analyser(fichier('.a { color: #767676; background: #fff }'), { niveau: 'AAA' }),
    );
    assert.equal(q.statut, 'echec');
  });
  it('une liste de sélecteurs produit une paire par sélecteur', () => {
    const a = analyser(fichier('.a, .b { color: #777; background: #fff }'));
    assert.deepEqual(
      a.paires.map((p) => p.selecteur),
      ['.a', '.b'],
    );
  });
  it('@keyframes est ignoré dans l’analyse', () => {
    const a = analyser(fichier('@keyframes x { 50% { color: #000; background: #fff } }'));
    assert.equal(a.paires.length, 0);
  });
});

describe('variables et contextes', () => {
  it('résout var() avec repli, alias et rend la variable directe', () => {
    const p = paireUnique(
      analyser(
        fichier(
          ':root { --b: #000; --a: var(--b) } .a { color: var(--a); background: var(--absent, #fff) }',
        ),
      ),
    );
    assert.equal(p.texte.hex, '#000000');
    assert.equal(p.texte.variable, '--a');
    assert.equal(p.fond.hex, '#ffffff');
    assert.equal(p.fond.variable, null);
    assert.equal(p.statut, 'conforme');
  });
  it('un cycle de variables est signalé', () => {
    const p = paireUnique(
      analyser(
        fichier(':root { --a: var(--b); --b: var(--a) } .a { color: var(--a); background: #fff }'),
      ),
    );
    assert.equal(p.statut, 'a-verifier');
    assert.ok(p.raisons.some((r) => /cycle/.test(r)));
  });
  it('une variable introuvable est signalée', () => {
    const p = paireUnique(analyser(fichier('.a { color: var(--nulle-part); background: #fff }')));
    assert.equal(p.statut, 'a-verifier');
    assert.ok(p.raisons.some((r) => /introuvable/.test(r)));
  });
  it('une variable locale à la règle prime sur la racine', () => {
    const p = paireUnique(
      analyser(fichier(':root { --t: #fff } .a { --t: #000; color: var(--t); background: #fff }')),
    );
    assert.equal(p.texte.hex, '#000000');
  });
  it('une media query qui redéfinit une variable crée un contexte', () => {
    const a = analyser(
      fichier(
        ':root { --t: #555 } @media (prefers-color-scheme: dark) { :root { --t: #fff } } .a { color: var(--t); background: #000 }',
      ),
    );
    assert.equal(a.paires.length, 2);
    const base = a.paires.find((p) => p.contexte === ':root');
    const sombre = a.paires.find((p) => p.contexte === '@media (prefers-color-scheme: dark)');
    assert.equal(base.statut, 'echec');
    assert.equal(sombre.statut, 'conforme');
    assert.equal(sombre.texte.hex, '#ffffff');
    assert.equal(sombre.id, 'test.css|@media (prefers-color-scheme: dark)|.a');
  });
  it('un sélecteur de thème crée un contexte ; ses règles imbriquées n’existent que là', () => {
    const source = `:root { --t: #555; --f: #000 }
      :root[data-theme='clair'] { --f: #fff; .b { color: var(--t); background: var(--f) } }
      .a { color: var(--t); background: var(--f) }`;
    const a = analyser(fichier(source));
    const contextes = a.paires.map((p) => `${p.selecteur}@${p.contexte}`).sort();
    assert.deepEqual(contextes, [
      '.a@:root',
      ".a@:root[data-theme='clair']",
      ".b@:root[data-theme='clair']",
    ]);
    assert.equal(a.paires.find((p) => p.selecteur === '.b').texte.hex, '#555555');
  });
  it('thème et media se combinent', () => {
    const source = `:root { --t: #555 } html.dark { --t: #666 }
      @media (prefers-contrast: more) { html.dark { --t: #fff } }
      .a { color: var(--t); background: #000 }`;
    const a = analyser(fichier(source));
    const noms = a.paires.map((p) => p.contexte).sort();
    assert.deepEqual(noms, [':root', 'html.dark', 'html.dark @media (prefers-contrast: more)']);
  });
  it('une variante du même sélecteur dans un thème est fusionnée avec la règle de base', () => {
    const source = `:root { --t: #555 } .a { color: var(--t); background: #000 }
      :root[data-theme='x'] { --t: #999; .a { background: #fff } }`;
    const a = analyser(fichier(source));
    const theme = a.paires.find((p) => p.contexte === ":root[data-theme='x']");
    assert.equal(theme.fond.hex, '#ffffff');
    assert.equal(theme.texte.hex, '#999999');
  });
  it('un contexte qui ne redéfinit rien d’utile ne duplique pas la paire', () => {
    const source = `:root { --t: #555; --police: serif } @media (max-width: 1px) { :root { --police: sans-serif } }
      .a { color: var(--t); background: #000; font-family: var(--police) }`;
    assert.equal(analyser(fichier(source)).paires.length, 1);
  });
  it('plusieurs fichiers partagent variables et contextes, dans l’ordre donné', () => {
    const a = analyser([
      { chemin: 'a/vars.css', source: ':root { --t: #777 }' },
      { chemin: 'b\\regles.css', source: '.a { color: var(--t); background: #fff }' },
    ]);
    const p = paireUnique(a);
    assert.equal(p.id, 'b/regles.css|:root|.a');
    assert.equal(p.texte.hex, '#777777');
  });
  it('l’id reste stable quand seules les couleurs changent', () => {
    const avant = paireUnique(
      analyser(fichier(':root { --t: #777 }\n.a { color: var(--t); background: #fff }')),
    );
    const apres = paireUnique(
      analyser(
        fichier(
          ':root {\n  --t: #444;\n  --t-contraste: #333;\n}\n.a { color: var(--t-contraste); background: #fff }',
        ),
      ),
    );
    assert.equal(avant.id, apres.id);
    assert.notEqual(avant.ligne, apres.ligne);
  });
});

describe('rapport JSON', () => {
  it('a le format commun et trie du pire au moins grave', () => {
    const a = analyser(
      fichier(
        '.ok { color: #000; background: #fff } .pire { color: #999; background: #fff } .moyen { color: #777; background: #fff }',
      ),
    );
    const r = construireRapport(a, { etiquette: 'Test', date: '2026-01-01T00:00:00.000Z' });
    assert.equal(r.outil, 'wcag-contraste');
    assert.equal(r.version, 1);
    assert.equal(r.etiquette, 'Test');
    assert.equal(r.niveau, 'AA');
    assert.deepEqual(r.fichiers, ['test.css']);
    assert.deepEqual(r.resume, {
      paires: 3,
      conformes: 1,
      echecs: 2,
      aVerifier: 0,
      fondInconnu: 0,
    });
    assert.deepEqual(
      r.paires.map((p) => p.selecteur),
      ['.pire', '.moyen', '.ok'],
    );
    assert.deepEqual(Object.keys(r.paires[0]), [
      'id',
      'fichier',
      'ligne',
      'selecteur',
      'contexte',
      'texte',
      'fond',
      'taille',
      'grandTexte',
      'seuil',
      'ratio',
      'statut',
      'raisons',
    ]);
    assert.equal(r.paires[1].ratio, 4.4781);
    assert.deepEqual(r.corrections, []);
  });
});

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

  it('scan retourne 1 avec un échec, 0 sans, 2 en erreur', () => {
    assert.equal(executer(SCAN, ['scan', 'echec.css']).status, 1);
    assert.equal(executer(SCAN, ['scan', 'ok.css']).status, 0);
    assert.equal(executer(SCAN, ['scan', 'absent.css']).status, 2);
    assert.equal(executer(SCAN, ['scan', 'ok.css', '--niveau', 'B']).status, 2);
    assert.equal(executer(SCAN, ['scan']).status, 2);
    assert.equal(executer(SCAN, []).status, 2);
  });
  it('scan écrit le rapport dans un dossier créé au besoin, avec l’étiquette', () => {
    const r = executer(SCAN, [
      'scan',
      'echec.css',
      '--sortie',
      'sortie/profond/rapport.json',
      '--etiquette',
      'Avant test',
    ]);
    assert.equal(r.status, 1);
    const contenu = readFileSync(join(temp, 'sortie/profond/rapport.json'), 'utf8');
    assert.ok(contenu.endsWith('}\n'));
    const rapport = JSON.parse(contenu);
    assert.equal(rapport.etiquette, 'Avant test');
    assert.equal(rapport.resume.echecs, 1);
    assert.equal(rapport.paires[0].texte.variable, '--t');
  });
  it('scan sans couleur ANSI quand la sortie n’est pas un terminal', () => {
    const r = executer(SCAN, ['scan', 'echec.css']);
    assert.doesNotMatch(r.stdout, /\u001b\[/);
    assert.match(r.stdout, /ÉCHEC\s+4\.47/);
  });
  it('ratio affiche le ratio et refuse un fond semi-transparent', () => {
    const r = executer(SCAN, ['ratio', '#777', 'white']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /4\.47:1/);
    const refus = executer(SCAN, ['ratio', '#000', 'rgba(255,255,255,.5)']);
    assert.equal(refus.status, 2);
    assert.match(refus.stderr, /semi-transparent/);
    assert.equal(executer(SCAN, ['ratio', 'zut', '#fff']).status, 2);
  });
  it('--aide documente usage, options et limites sur les deux scripts', () => {
    for (const script of [SCAN, CORRIGER]) {
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
