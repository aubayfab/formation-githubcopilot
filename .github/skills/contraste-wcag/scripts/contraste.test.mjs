// Tests de contraste.mjs (calcul, analyse, rapport, page) : node --test contraste.test.mjs
// Aucun fichier du projet n'est lu : tout le CSS est écrit en chaînes ici.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
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
  ratioContraste,
  separerTheme,
  seuilContraste,
  tronquer,
  injecterRapports,
  serialiserPourScript,
  validerRapport,
  versHex,
} from './contraste.mjs';

const dossier = dirname(fileURLToPath(import.meta.url));
const SCAN = join(dossier, 'contraste.mjs');
// Le modèle est à côté des scripts, ou dans assets/ quand ils sont rangés dans un skill.
const MODELE = [join(dossier, 'rapport.html'), join(dossier, '..', 'assets', 'rapport.html')].find(
  (chemin) => existsSync(chemin),
);

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
  it('--aide documente usage, options et limites', () => {
    for (const script of [SCAN]) {
      const r = executer(script, ['--aide']);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /Usage/);
      assert.match(r.stdout, /--niveau/);
      assert.match(r.stdout, /Limites connues/);
    }
  });
});

describe('commande page', () => {
  let temp;
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  const PIEGE = '.a</script><img src=x onerror=alert(1)>' + LS + 'suite' + PS + 'fin';
  const rapportDe = (css, etiquette) =>
    construireRapport(analyser(fichier(css, 'neon.css')), {
      etiquette,
      date: '2026-01-01T00:00:00.000Z',
    });
  const executer = (args, options = {}) =>
    spawnSync(process.execPath, [SCAN, 'page', ...args], {
      cwd: temp,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      ...options,
    });
  const blocDe = (html) => {
    const m = /<script type="application\/json" id="rapports-integres">([\s\S]*?)<\/script>/.exec(
      html,
    );
    assert.ok(m, 'bloc de données intégrées absent');
    return JSON.parse(m[1]);
  };
  const lire = (chemin) => JSON.parse(readFileSync(join(temp, chemin), 'utf8'));

  before(() => {
    temp = mkdtempSync(join(tmpdir(), 'wcag-page-'));
    const ecrire = (nom, objet) =>
      writeFileSync(join(temp, nom), JSON.stringify(objet, null, 2) + '\n');
    ecrire('avant.json', rapportDe('.a { color: #777; background: #fff }', 'Avant'));
    ecrire('apres-llm.json', rapportDe('.a { color: #707070; background: #fff }', 'Après LLM'));
    ecrire('apres-js.json', rapportDe('.a { color: #757575; background: #fff }', 'Après JS'));
    const piege = rapportDe('.a { color: #777; background: #fff }', 'Piège');
    piege.paires[0].selecteur = PIEGE;
    piege.paires[0].id = `neon.css|:root|${PIEGE}`;
    ecrire('piege.json', piege);
    writeFileSync(join(temp, 'invalide.json'), '{ "outil": "autre", "version": 1 }\n');
    writeFileSync(join(temp, 'casse.json'), '{ pas du json');
  });
  after(() => {
    rmSync(temp, { recursive: true, force: true });
  });

  it('écrit la page à côté du premier rapport, avec un seul rapport', () => {
    const r = executer(['avant.json']);
    assert.equal(r.status, 0, r.stderr);
    const attendu = join(temp, 'rapport-contraste.html');
    assert.match(r.stdout, /Page écrite : (.+)/);
    assert.equal(/Page écrite : (.+)/.exec(r.stdout)[1].trim(), attendu);
    const bloc = blocDe(readFileSync(attendu, 'utf8'));
    assert.deepEqual(bloc, [{ nom: 'avant.json', rapport: lire('avant.json') }]);
  });
  it('intègre trois rapports dans l’ordre et crée le dossier de sortie', () => {
    const r = executer([
      'avant.json',
      'apres-llm.json',
      'apres-js.json',
      '--sortie',
      'sous/dossier/page.html',
    ]);
    assert.equal(r.status, 0, r.stderr);
    const bloc = blocDe(readFileSync(join(temp, 'sous/dossier/page.html'), 'utf8'));
    assert.deepEqual(
      bloc.map((e) => e.nom),
      ['avant.json', 'apres-llm.json', 'apres-js.json'],
    );
    assert.deepEqual(
      bloc.map((e) => e.rapport.etiquette),
      ['Avant', 'Après LLM', 'Après JS'],
    );
    assert.deepEqual(bloc[2].rapport, lire('apres-js.json'));
  });
  it('échappe un sélecteur contenant </script>, U+2028 et U+2029 sans altérer les données', () => {
    const r = executer(['piege.json', '--sortie', 'piege.html']);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(join(temp, 'piege.html'), 'utf8');
    const modele = readFileSync(MODELE, 'utf8');
    const compter = (texte) => texte.split('</script>').length - 1;
    assert.equal(compter(html), compter(modele));
    assert.ok(!html.includes(LS) && !html.includes(PS));
    assert.ok(!html.includes('<img src=x'));
    const bloc = blocDe(html);
    assert.equal(bloc[0].rapport.paires[0].selecteur, PIEGE);
    assert.deepEqual(bloc[0].rapport, lire('piege.json'));
  });
  it('serialiserPourScript et injecterRapports sont sûrs et réversibles', () => {
    const donnees = [{ nom: 'x', rapport: { selecteur: PIEGE } }];
    const texte = serialiserPourScript(donnees);
    assert.ok(!texte.includes('<') && !texte.includes(LS) && !texte.includes(PS));
    assert.deepEqual(JSON.parse(texte), donnees);
    const page = injecterRapports(
      '<script type="application/json" id="rapports-integres"></script><script>1</script>',
      donnees,
    );
    assert.equal(page.split('</script>').length - 1, 2);
    assert.equal(injecterRapports('<script></script>', donnees), null);
  });
  it('refuse un rapport invalide, illisible ou absent (code 2)', () => {
    const invalide = executer(['invalide.json']);
    assert.equal(invalide.status, 2);
    assert.match(invalide.stderr, /invalide.json.*ne vient pas de wcag-contraste/);
    const casse = executer(['casse.json']);
    assert.equal(casse.status, 2);
    assert.match(casse.stderr, /illisible/);
    assert.equal(executer(['absent.json']).status, 2);
    assert.equal(executer([]).status, 2);
    assert.equal(validerRapport(lire('avant.json')).ok, true);
    assert.equal(validerRapport({ outil: 'wcag-contraste', version: 2 }).ok, false);
  });
  it('signale un modèle introuvable avec les chemins essayés (code 2)', () => {
    const explicite = executer(['avant.json', '--modele', 'absent.html']);
    assert.equal(explicite.status, 2);
    assert.ok(explicite.stderr.includes(join(temp, 'absent.html')), explicite.stderr);
    mkdirSync(join(temp, 'scripts'), { recursive: true });
    copyFileSync(SCAN, join(temp, 'scripts', 'contraste.mjs'));
    const parDefaut = spawnSync(process.execPath, ['scripts/contraste.mjs', 'page', 'avant.json'], {
      cwd: temp,
      encoding: 'utf8',
    });
    assert.equal(parDefaut.status, 2);
    assert.ok(parDefaut.stderr.includes(join(temp, 'scripts', 'rapport.html')), parDefaut.stderr);
    assert.ok(parDefaut.stderr.includes(join(temp, 'assets', 'rapport.html')), parDefaut.stderr);
  });
  it('trouve le modèle dans ../assets/ (disposition scripts/ + assets/ d’un skill)', () => {
    mkdirSync(join(temp, 'scripts'), { recursive: true });
    mkdirSync(join(temp, 'assets'), { recursive: true });
    copyFileSync(SCAN, join(temp, 'scripts', 'contraste.mjs'));
    copyFileSync(MODELE, join(temp, 'assets', 'rapport.html'));
    const r = spawnSync(
      process.execPath,
      [
        'scripts/contraste.mjs',
        'page',
        'avant.json',
        'apres-js.json',
        '--sortie',
        'skill/page.html',
      ],
      { cwd: temp, encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(blocDe(readFileSync(join(temp, 'skill/page.html'), 'utf8')).length, 2);
  });
  it('--ouvrir avec CONTRASTE_SANS_OUVRIR=1 affiche la commande sans la lancer', () => {
    const r = executer(['avant.json', '--sortie', 'ouverte.html', '--ouvrir'], {
      env: { ...process.env, NO_COLOR: '1', CONTRASTE_SANS_OUVRIR: '1' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Commande d'ouverture \(non exécutée/);
    assert.ok(r.stdout.includes(join(temp, 'ouverte.html')));
    const attendu =
      { win32: /cmd \/c start "" "/, darwin: /open "/ }[process.platform] || /xdg-open "/;
    assert.match(r.stdout, attendu);
  });
  it('page --aide documente les options', () => {
    const r = executer(['--aide']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /--modele/);
    assert.match(r.stdout, /CONTRASTE_SANS_OUVRIR/);
  });
});

describe('page de rapport : fonctions pures', () => {
  // Le script de la page est extrait tel quel et chargé comme module CommonJS.
  const page = (() => {
    const html = readFileSync(MODELE, 'utf8');
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
    const chemin = join(tmpdir(), `wcag-page-${process.pid}-${Date.now()}.cjs`);
    writeFileSync(chemin, script);
    try {
      return createRequire(import.meta.url)(chemin);
    } finally {
      rmSync(chemin, { force: true });
    }
  })();
  const p = (id, hex, statut) => ({ id, texte: { hex }, statut });

  it('lit le bloc intégré : vide, tableau valide, JSON cassé, non tableau', () => {
    assert.deepEqual(page.lireRapportsIntegres(''), { rapports: [], erreur: null });
    assert.deepEqual(page.lireRapportsIntegres('  \n '), { rapports: [], erreur: null });
    const valide = page.lireRapportsIntegres(
      '[{"nom":"a.json","rapport":{"outil":"wcag-contraste"}}, {"rapport":{}}]',
    );
    assert.equal(valide.erreur, null);
    assert.deepEqual(
      valide.rapports.map((r) => r.nom),
      ['a.json', 'rapport intégré 2'],
    );
    assert.deepEqual(valide.rapports[0].rapport, { outil: 'wcag-contraste' });
    const casse = page.lireRapportsIntegres('[{');
    assert.equal(casse.rapports.length, 0);
    assert.match(casse.erreur, /illisibles/);
    assert.match(page.lireRapportsIntegres('{"nom":"x"}').erreur, /tableau/);
  });
  it('valide les rapports avec la même règle que le script', () => {
    const cas = [
      null,
      [],
      { outil: 'autre', version: 1 },
      { outil: 'wcag-contraste', version: 2 },
      { outil: 'wcag-contraste', version: 1, paires: [] },
      { outil: 'wcag-contraste', version: 1, paires: [], fondInconnu: [], resume: {} },
    ];
    for (const objet of cas) assert.deepEqual(page.validerRapport(objet), validerRapport(objet));
  });
  it('calcule l’ensemble commun et les écarts sur ce seul ensemble', () => {
    const avant = {
      paires: [
        p('a', '#2a8390', 'echec'),
        p('b', '#000000', 'echec'),
        p('c', '#ffd84a', 'echec'),
        p('d', '#111111', 'conforme'),
      ],
    };
    const llm = {
      paires: [
        p('a', '#4ca1ae', 'conforme'),
        p('b', '#101010', 'conforme'),
        p('c', '#fff5c0', 'echec'),
        p('d', '#111111', 'conforme'),
      ],
    };
    const js = {
      paires: [
        p('a', '#4aa0ac', 'conforme'),
        p('b', '#101010', 'conforme'),
        p('c', '#2f2400', 'conforme'),
        p('d', '#222222', 'conforme'),
      ],
    };
    assert.deepEqual(page.ensembleCommun(avant, [llm, js]), ['a', 'b']);
    assert.deepEqual(page.ensembleCommun(avant, [js]), ['a', 'b', 'c']);
    assert.deepEqual(page.ensembleCommun(avant, [avant]), []);
    assert.equal(page.compterChanges(avant, llm), 3);
    assert.equal(page.compterChanges(avant, js), 4);
    const communs = page.ensembleCommun(avant, [llm, js]);
    const eLlm = page.calculerEcarts(avant, llm, communs);
    const eJs = page.calculerEcarts(avant, js, communs);
    assert.equal(eLlm.nombre, 2);
    assert.equal(eJs.nombre, 2);
    assert.ok(eJs.moyen < eLlm.moyen && eJs.maximal === eLlm.maximal);
    assert.deepEqual(page.calculerEcarts(avant, js, []), { nombre: 0, moyen: null, maximal: null });
  });
  it('calcule le même ΔE que le script', () => {
    assert.equal(page.deltaE('#000000', '#000000'), 0);
    assert.ok(
      Math.abs(page.deltaE('#2a8390', '#4ca1ae') - deltaE(hex('#2a8390'), hex('#4ca1ae'))) < 1e-9,
    );
    assert.equal(page.deltaE('#zzzzzz', '#000000'), null);
    assert.equal(page.tronquer(4.499), '4.49');
    assert.equal(page.taillePx('112px'), 44);
  });
});
