#!/usr/bin/env node
/*
 * contraste.mjs — contrastes WCAG 2.x d'un ou plusieurs fichiers CSS.
 *
 * Bibliothèque (importée par corriger.mjs et par les tests) et ligne de commande :
 *   node contraste.mjs ratio <texte> <fond>
 *   node contraste.mjs scan <fichier.css>... [--niveau AA|AAA] [--etiquette <nom>]
 *                                            [--sortie <rapport.json>] [--details]
 *   node contraste.mjs --aide
 *
 * Aucune dépendance, Node 20.19 ou plus récent.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve as resoudreChemin } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const VERSION_RAPPORT = 1;
export const NOM_OUTIL = 'wcag-contraste';

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

export const NOMS_CSS = {
  aliceblue: 'f0f8ff',
  antiquewhite: 'faebd7',
  aqua: '00ffff',
  aquamarine: '7fffd4',
  azure: 'f0ffff',
  beige: 'f5f5dc',
  bisque: 'ffe4c4',
  black: '000000',
  blanchedalmond: 'ffebcd',
  blue: '0000ff',
  blueviolet: '8a2be2',
  brown: 'a52a2a',
  burlywood: 'deb887',
  cadetblue: '5f9ea0',
  chartreuse: '7fff00',
  chocolate: 'd2691e',
  coral: 'ff7f50',
  cornflowerblue: '6495ed',
  cornsilk: 'fff8dc',
  crimson: 'dc143c',
  cyan: '00ffff',
  darkblue: '00008b',
  darkcyan: '008b8b',
  darkgoldenrod: 'b8860b',
  darkgray: 'a9a9a9',
  darkgreen: '006400',
  darkgrey: 'a9a9a9',
  darkkhaki: 'bdb76b',
  darkmagenta: '8b008b',
  darkolivegreen: '556b2f',
  darkorange: 'ff8c00',
  darkorchid: '9932cc',
  darkred: '8b0000',
  darksalmon: 'e9967a',
  darkseagreen: '8fbc8f',
  darkslateblue: '483d8b',
  darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f',
  darkturquoise: '00ced1',
  darkviolet: '9400d3',
  deeppink: 'ff1493',
  deepskyblue: '00bfff',
  dimgray: '696969',
  dimgrey: '696969',
  dodgerblue: '1e90ff',
  firebrick: 'b22222',
  floralwhite: 'fffaf0',
  forestgreen: '228b22',
  fuchsia: 'ff00ff',
  gainsboro: 'dcdcdc',
  ghostwhite: 'f8f8ff',
  gold: 'ffd700',
  goldenrod: 'daa520',
  gray: '808080',
  green: '008000',
  greenyellow: 'adff2f',
  grey: '808080',
  honeydew: 'f0fff0',
  hotpink: 'ff69b4',
  indianred: 'cd5c5c',
  indigo: '4b0082',
  ivory: 'fffff0',
  khaki: 'f0e68c',
  lavender: 'e6e6fa',
  lavenderblush: 'fff0f5',
  lawngreen: '7cfc00',
  lemonchiffon: 'fffacd',
  lightblue: 'add8e6',
  lightcoral: 'f08080',
  lightcyan: 'e0ffff',
  lightgoldenrodyellow: 'fafad2',
  lightgray: 'd3d3d3',
  lightgreen: '90ee90',
  lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1',
  lightsalmon: 'ffa07a',
  lightseagreen: '20b2aa',
  lightskyblue: '87cefa',
  lightslategray: '778899',
  lightslategrey: '778899',
  lightsteelblue: 'b0c4de',
  lightyellow: 'ffffe0',
  lime: '00ff00',
  limegreen: '32cd32',
  linen: 'faf0e6',
  magenta: 'ff00ff',
  maroon: '800000',
  mediumaquamarine: '66cdaa',
  mediumblue: '0000cd',
  mediumorchid: 'ba55d3',
  mediumpurple: '9370db',
  mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee',
  mediumspringgreen: '00fa9a',
  mediumturquoise: '48d1cc',
  mediumvioletred: 'c71585',
  midnightblue: '191970',
  mintcream: 'f5fffa',
  mistyrose: 'ffe4e1',
  moccasin: 'ffe4b5',
  navajowhite: 'ffdead',
  navy: '000080',
  oldlace: 'fdf5e6',
  olive: '808000',
  olivedrab: '6b8e23',
  orange: 'ffa500',
  orangered: 'ff4500',
  orchid: 'da70d6',
  palegoldenrod: 'eee8aa',
  palegreen: '98fb98',
  paleturquoise: 'afeeee',
  palevioletred: 'db7093',
  papayawhip: 'ffefd5',
  peachpuff: 'ffdab9',
  peru: 'cd853f',
  pink: 'ffc0cb',
  plum: 'dda0dd',
  powderblue: 'b0e0e6',
  purple: '800080',
  rebeccapurple: '663399',
  red: 'ff0000',
  rosybrown: 'bc8f8f',
  royalblue: '4169e1',
  saddlebrown: '8b4513',
  salmon: 'fa8072',
  sandybrown: 'f4a460',
  seagreen: '2e8b57',
  seashell: 'fff5ee',
  sienna: 'a0522d',
  silver: 'c0c0c0',
  skyblue: '87ceeb',
  slateblue: '6a5acd',
  slategray: '708090',
  slategrey: '708090',
  snow: 'fffafa',
  springgreen: '00ff7f',
  steelblue: '4682b4',
  tan: 'd2b48c',
  teal: '008080',
  thistle: 'd8bfd8',
  tomato: 'ff6347',
  turquoise: '40e0d0',
  violet: 'ee82ee',
  wheat: 'f5deb3',
  white: 'ffffff',
  whitesmoke: 'f5f5f5',
  yellow: 'ffff00',
  yellowgreen: '9acd32',
};

// Couleurs système : elles dépendent du navigateur et du thème, impossibles à évaluer.
const COULEURS_SYSTEME = new Set(
  [
    'AccentColor',
    'AccentColorText',
    'ActiveText',
    'ButtonBorder',
    'ButtonFace',
    'ButtonText',
    'Canvas',
    'CanvasText',
    'Field',
    'FieldText',
    'GrayText',
    'Highlight',
    'HighlightText',
    'LinkText',
    'Mark',
    'MarkText',
    'SelectedItem',
    'SelectedItemText',
    'VisitedText',
    'ActiveBorder',
    'ActiveCaption',
    'AppWorkspace',
    'Background',
    'ButtonHighlight',
    'ButtonShadow',
    'CaptionText',
    'InactiveBorder',
    'InactiveCaption',
    'InactiveCaptionText',
    'InfoBackground',
    'InfoText',
    'Menu',
    'MenuText',
    'Scrollbar',
    'ThreeDDarkShadow',
    'ThreeDFace',
    'ThreeDHighlight',
    'ThreeDLightShadow',
    'ThreeDShadow',
    'Window',
    'WindowFrame',
    'WindowText',
  ].map((nom) => nom.toLowerCase()),
);

const MOTS_CLES_CASCADE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

const borner = (valeur, min, max) => Math.min(max, Math.max(min, valeur));
const arrondir8 = (valeur) => borner(Math.round(valeur), 0, 255);

function lineariser(canal) {
  const v = canal / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function delineariser(lineaire) {
  const v = borner(lineaire, 0, 1);
  return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
}

/** Luminance relative WCAG 2.x d'une couleur sRGB 8 bits. */
export function luminance({ r, g, b }) {
  return 0.2126 * lineariser(r) + 0.7152 * lineariser(g) + 0.0722 * lineariser(b);
}

/** Ratio de contraste non arrondi entre deux couleurs opaques (ordre indifférent). */
export function ratioContraste(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Affichage tronqué (jamais arrondi vers le haut) : un ratio de 4,499 s'affiche « 4.49 »,
 * pour ne jamais montrer « 4.50 » à un ratio qui échoue.
 */
export function tronquer(valeur, decimales = 2) {
  const facteur = 10 ** decimales;
  return (Math.floor(valeur * facteur + 1e-9) / facteur).toFixed(decimales);
}

/** Composition alpha (source over) d'un texte semi-transparent sur un fond opaque. */
export function composer(texte, fond) {
  const a = texte.a ?? 1;
  if (a >= 1) return { r: texte.r, g: texte.g, b: texte.b, a: 1 };
  return {
    r: arrondir8(texte.r * a + fond.r * (1 - a)),
    g: arrondir8(texte.g * a + fond.g * (1 - a)),
    b: arrondir8(texte.b * a + fond.b * (1 - a)),
    a: 1,
  };
}

export function versHex({ r, g, b }) {
  return '#' + [r, g, b].map((c) => arrondir8(c).toString(16).padStart(2, '0')).join('');
}

export function seuilContraste(niveau, grandTexte) {
  if (niveau === 'AAA') return grandTexte ? 4.5 : 7;
  return grandTexte ? 3 : 4.5;
}

// Conversions d'espaces colorimétriques (formules et matrices de CSS Color 4 / Ottosson).

export function srgbVersOklab({ r, g, b }) {
  const lr = lineariser(r);
  const lg = lineariser(g);
  const lb = lineariser(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab → sRGB linéaire (composantes non bornées, pour tester le gamut). */
export function oklabVersLineaire({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function oklabVersSrgb(lab) {
  const lin = oklabVersLineaire(lab);
  return { r: delineariser(lin.r), g: delineariser(lin.g), b: delineariser(lin.b) };
}

export function oklchVersOklab({ L, C, h }) {
  const rad = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

export function oklabVersOklch({ L, a, b }) {
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, b), h };
}

/** Écart perceptif OKLab (distance euclidienne × 100) entre deux couleurs sRGB. */
export function deltaE(c1, c2) {
  const a = srgbVersOklab(c1);
  const b = srgbVersOklab(c2);
  return 100 * Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

const BLANC_D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const KAPPA = 24389 / 27;
const EPSILON = 216 / 24389;

function multiplier(matrice, v) {
  return matrice.map((ligne) => ligne[0] * v[0] + ligne[1] * v[1] + ligne[2] * v[2]);
}

const D50_VERS_D65 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];
const D65_VERS_D50 = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
];
const XYZ_VERS_LINEAIRE = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const LINEAIRE_VERS_XYZ = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];

export function labVersSrgb({ L, a, b }) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const xr = fx ** 3 > EPSILON ? fx ** 3 : (116 * fx - 16) / KAPPA;
  const yr = L > KAPPA * EPSILON ? fy ** 3 : L / KAPPA;
  const zr = fz ** 3 > EPSILON ? fz ** 3 : (116 * fz - 16) / KAPPA;
  const xyz50 = [xr * BLANC_D50[0], yr * BLANC_D50[1], zr * BLANC_D50[2]];
  const lin = multiplier(XYZ_VERS_LINEAIRE, multiplier(D50_VERS_D65, xyz50));
  return { r: delineariser(lin[0]), g: delineariser(lin[1]), b: delineariser(lin[2]) };
}

export function srgbVersLab({ r, g, b }) {
  const xyz65 = multiplier(LINEAIRE_VERS_XYZ, [lineariser(r), lineariser(g), lineariser(b)]);
  const xyz50 = multiplier(D65_VERS_D50, xyz65);
  const f = (t) => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
  const fx = f(xyz50[0] / BLANC_D50[0]);
  const fy = f(xyz50[1] / BLANC_D50[1]);
  const fz = f(xyz50[2] / BLANC_D50[2]);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function hslVersSrgb(h, s, l) {
  const teinte = (((h % 360) + 360) % 360) / 30;
  const f = (n) => {
    const k = (n + teinte) % 12;
    const a = s * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return { r: f(0), g: f(8), b: f(4) };
}

export function srgbVersHsl({ r, g, b }) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-9) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hwbVersSrgb(h, w, b) {
  if (w + b >= 1) {
    const gris = (255 * w) / (w + b);
    return { r: gris, g: gris, b: gris };
  }
  const base = hslVersSrgb(h, 1, 0.5);
  const echelle = 1 - w - b;
  return {
    r: base.r * echelle + 255 * w,
    g: base.g * echelle + 255 * w,
    b: base.b * echelle + 255 * w,
  };
}

export function srgbVersHwb(rgb) {
  const { h } = srgbVersHsl(rgb);
  const max = Math.max(rgb.r, rgb.g, rgb.b) / 255;
  const min = Math.min(rgb.r, rgb.g, rgb.b) / 255;
  return { h, w: min, b: 1 - max };
}

// Analyse syntaxique des couleurs CSS.

function analyserAngle(texte) {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i.exec(texte);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch ((m[2] || 'deg').toLowerCase()) {
    case 'grad':
      return n * 0.9;
    case 'rad':
      return (n * 180) / Math.PI;
    case 'turn':
      return n * 360;
    default:
      return n;
  }
}

/** Nombre CSS avec éventuel « % » : { valeur, pourcent } ou null. */
function analyserNombre(texte) {
  if (/^none$/i.test(texte)) return { valeur: 0, pourcent: false, none: true };
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/i.exec(texte);
  if (!m) return null;
  return { valeur: parseFloat(m[1]), pourcent: m[2] === '%' };
}

function analyserAlpha(texte) {
  const n = analyserNombre(texte);
  if (!n) return null;
  return borner(n.pourcent ? n.valeur / 100 : n.valeur, 0, 1);
}

/** Découpe une liste d'arguments sur un séparateur, en respectant parenthèses et chaînes. */
export function decouper(texte, separateur) {
  const morceaux = [];
  let profondeur = 0;
  let chaine = null;
  let debut = 0;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (chaine) {
      if (c === '\\') i++;
      else if (c === chaine) chaine = null;
      continue;
    }
    if (c === '"' || c === "'") chaine = c;
    else if (c === '(') profondeur++;
    else if (c === ')') profondeur--;
    else if (profondeur === 0 && c === separateur) {
      morceaux.push(texte.slice(debut, i));
      debut = i + 1;
    }
  }
  morceaux.push(texte.slice(debut));
  return morceaux;
}

/** Sépare une liste d'arguments en syntaxe virgules ou espaces (avec « / alpha »). */
function analyserArguments(interieur) {
  const virgules = decouper(interieur, ',').length > 1;
  if (virgules) {
    const parties = decouper(interieur, ',').map((p) => p.trim());
    return {
      virgules,
      composantes: parties.slice(0, 3),
      alpha: parties[3] ?? null,
      nb: parties.length,
    };
  }
  const [avant, apres] = decouper(interieur, '/');
  const composantes = avant.trim().split(/\s+/).filter(Boolean);
  return {
    virgules,
    composantes,
    alpha: apres === undefined ? null : apres.trim(),
    nb: composantes.length + (apres === undefined ? 0 : 1),
  };
}

function couleur(r, g, b, a = 1) {
  return { r: arrondir8(r), g: arrondir8(g), b: arrondir8(b), a: borner(a, 0, 1) };
}

/**
 * Analyse une couleur CSS. Retourne { r, g, b, a } (8 bits, alpha 0-1), ou
 * { indetermine: raison } pour ce qui ne peut pas être évalué statiquement
 * (currentColor, color-mix(), light-dark(), couleurs système, inherit…), ou null si invalide.
 */
export function analyserCouleur(texte) {
  if (typeof texte !== 'string') return null;
  const t = texte.trim();
  if (!t) return null;
  const minuscule = t.toLowerCase();

  if (minuscule === 'transparent') return couleur(0, 0, 0, 0);
  if (minuscule === 'currentcolor')
    return { indetermine: 'currentColor hérite de la couleur de l’ancêtre' };
  if (MOTS_CLES_CASCADE.has(minuscule)) return { indetermine: `mot-clé de cascade « ${t} »` };
  if (COULEURS_SYSTEME.has(minuscule)) return { indetermine: `couleur système « ${t} »` };
  if (NOMS_CSS[minuscule]) {
    const hex = NOMS_CSS[minuscule];
    return couleur(
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    );
  }

  const hex = /^#([0-9a-f]{3,8})$/i.exec(t);
  if (hex) {
    const d = hex[1];
    if (d.length === 3 || d.length === 4) {
      const c = [...d].map((x) => parseInt(x + x, 16));
      return couleur(c[0], c[1], c[2], d.length === 4 ? c[3] / 255 : 1);
    }
    if (d.length === 6 || d.length === 8) {
      const c = [0, 2, 4, 6].map((i) => parseInt(d.slice(i, i + 2), 16));
      return couleur(c[0], c[1], c[2], d.length === 8 ? c[3] / 255 : 1);
    }
    return null;
  }

  const fonction = /^([a-z-]+)\((.*)\)$/is.exec(t);
  if (!fonction) return null;
  const nom = fonction[1].toLowerCase();
  const interieur = fonction[2].trim();
  if (nom === 'color-mix')
    return { indetermine: 'color-mix() dépend d’une interpolation non modélisée' };
  if (nom === 'light-dark') return { indetermine: 'light-dark() dépend du thème du navigateur' };
  if (nom === 'var') return { indetermine: 'variable non résolue' };
  if (nom === 'color') {
    const parties = analyserArguments(interieur);
    const espace = (parties.composantes[0] || '').toLowerCase();
    const canaux = parties.composantes.slice(1).map(analyserNombre);
    if (canaux.length !== 3 || canaux.some((c) => !c)) return null;
    const alpha = parties.alpha === null ? 1 : analyserAlpha(parties.alpha);
    if (alpha === null) return null;
    const valeurs = canaux.map((c) => (c.pourcent ? c.valeur / 100 : c.valeur));
    if (espace === 'srgb')
      return couleur(valeurs[0] * 255, valeurs[1] * 255, valeurs[2] * 255, alpha);
    if (espace === 'srgb-linear') {
      return couleur(
        delineariser(valeurs[0]),
        delineariser(valeurs[1]),
        delineariser(valeurs[2]),
        alpha,
      );
    }
    return { indetermine: `espace color(${espace}) non pris en charge` };
  }

  const args = analyserArguments(interieur);
  if (args.composantes.length !== 3) return null;
  const alpha = args.alpha === null ? 1 : analyserAlpha(args.alpha);
  if (alpha === null) return null;
  const [c1, c2, c3] = args.composantes;

  if (nom === 'rgb' || nom === 'rgba') {
    const canaux = [c1, c2, c3].map(analyserNombre);
    if (canaux.some((c) => !c)) return null;
    const [r, g, b] = canaux.map((c) => (c.pourcent ? (c.valeur * 255) / 100 : c.valeur));
    return couleur(r, g, b, alpha);
  }
  if (nom === 'hsl' || nom === 'hsla') {
    const h = analyserAngle(c1) ?? (/^none$/i.test(c1) ? 0 : null);
    const s = analyserNombre(c2);
    const l = analyserNombre(c3);
    if (h === null || !s || !l) return null;
    const { r, g, b } = hslVersSrgb(h, borner(s.valeur / 100, 0, 1), borner(l.valeur / 100, 0, 1));
    return couleur(r, g, b, alpha);
  }
  if (nom === 'hwb') {
    const h = analyserAngle(c1) ?? (/^none$/i.test(c1) ? 0 : null);
    const w = analyserNombre(c2);
    const b = analyserNombre(c3);
    if (h === null || !w || !b) return null;
    const rgb = hwbVersSrgb(h, borner(w.valeur / 100, 0, 1), borner(b.valeur / 100, 0, 1));
    return couleur(rgb.r, rgb.g, rgb.b, alpha);
  }
  if (nom === 'lab' || nom === 'oklab') {
    const L = analyserNombre(c1);
    const a = analyserNombre(c2);
    const b = analyserNombre(c3);
    if (!L || !a || !b) return null;
    const ok = nom === 'oklab';
    const lab = {
      L: L.pourcent ? (ok ? L.valeur / 100 : L.valeur) : L.valeur,
      a: a.pourcent ? a.valeur * (ok ? 0.004 : 1.25) : a.valeur,
      b: b.pourcent ? b.valeur * (ok ? 0.004 : 1.25) : b.valeur,
    };
    const rgb = ok ? oklabVersSrgb(lab) : labVersSrgb(lab);
    return couleur(rgb.r, rgb.g, rgb.b, alpha);
  }
  if (nom === 'lch' || nom === 'oklch') {
    const L = analyserNombre(c1);
    const C = analyserNombre(c2);
    const h = analyserAngle(c3) ?? (/^none$/i.test(c3) ? 0 : null);
    if (!L || !C || h === null) return null;
    const ok = nom === 'oklch';
    const lch = {
      L: L.pourcent ? (ok ? L.valeur / 100 : L.valeur) : L.valeur,
      C: C.pourcent ? C.valeur * (ok ? 0.004 : 1.5) : C.valeur,
      h,
    };
    const rgb = ok
      ? oklabVersSrgb(oklchVersOklab(lch))
      : labVersSrgb({
          L: lch.L,
          a: lch.C * Math.cos((h * Math.PI) / 180),
          b: lch.C * Math.sin((h * Math.PI) / 180),
        });
    return couleur(rgb.r, rgb.g, rgb.b, alpha);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tailles et graisses
// ---------------------------------------------------------------------------

const TAILLES_MOTS_CLES = {
  'xx-small': 9,
  'x-small': 10,
  small: 13,
  medium: 16,
  large: 18,
  'x-large': 24,
  'xx-large': 32,
  'xxx-large': 48,
};

/** Taille en px si elle est déterminable statiquement, sinon { px: null, raison }. */
export function analyserTaille(texte) {
  if (typeof texte !== 'string' || !texte.trim()) return { px: null, raison: null };
  const t = texte.trim().toLowerCase();
  if (TAILLES_MOTS_CLES[t] !== undefined) return { px: TAILLES_MOTS_CLES[t], raison: null };
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|pt|pc|rem|in|cm|mm|q)?$/.exec(t);
  if (m) {
    const n = parseFloat(m[1]);
    const facteurs = {
      px: 1,
      pt: 4 / 3,
      pc: 16,
      rem: 16,
      in: 96,
      cm: 96 / 2.54,
      mm: 96 / 25.4,
      q: 96 / 101.6,
    };
    const unite = m[2] || (n === 0 ? 'px' : null);
    if (unite) return { px: n * facteurs[unite], raison: null };
  }
  return {
    px: null,
    raison: `taille « ${texte.trim()} » indéterminée statiquement, seuil du texte courant appliqué`,
  };
}

export function estGras(texte) {
  if (typeof texte !== 'string') return false;
  const t = texte.trim().toLowerCase();
  if (t === 'bold' || t === 'bolder') return true;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 700;
}

/** Grand texte WCAG : ≥ 24 px, ou ≥ 14 pt (18,6667 px) en gras. */
export function estGrandTexte(px, gras) {
  if (px === null || px === undefined) return false;
  return px >= 24 || (gras && px >= 56 / 3 - 1e-9);
}

// ---------------------------------------------------------------------------
// Parseur CSS
// ---------------------------------------------------------------------------

const AT_RULES_IGNOREES = new Set([
  'keyframes',
  '-webkit-keyframes',
  '-moz-keyframes',
  'font-face',
  'page',
  'counter-style',
  'property',
  'font-feature-values',
  'font-palette-values',
  'starting-style',
  'view-transition',
]);

function tableauLignes(source) {
  const debuts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') debuts.push(i + 1);
  return debuts;
}

function ligneDe(debuts, position) {
  let bas = 0;
  let haut = debuts.length - 1;
  while (bas < haut) {
    const milieu = (bas + haut + 1) >> 1;
    if (debuts[milieu] <= position) bas = milieu;
    else haut = milieu - 1;
  }
  return bas + 1;
}

/**
 * Découpe un fichier CSS en règles aplaties, avec pour chaque déclaration sa position exacte.
 * Résiste aux commentaires, aux chaînes, aux url(), aux at-rules imbriquées et au CSS imbriqué.
 * Retourne { regles: [...], erreurs: [...] }.
 */
export function analyserCss(source, fichier = '<css>') {
  const debuts = tableauLignes(source);
  const regles = [];
  const erreurs = [];
  const n = source.length;
  let i = 0;

  const sauterBlancsEtCommentaires = () => {
    for (;;) {
      while (i < n && /\s/.test(source[i])) i++;
      if (source.startsWith('/*', i)) {
        const fin = source.indexOf('*/', i + 2);
        i = fin === -1 ? n : fin + 2;
      } else return;
    }
  };

  // Avance jusqu'au premier caractère d'arrêt hors chaîne, commentaire et parenthèses.
  const lireJusqua = (arrets, compterAccolades) => {
    let profondeur = 0;
    let accolades = 0;
    while (i < n) {
      const c = source[i];
      if (c === '/' && source[i + 1] === '*') {
        const fin = source.indexOf('*/', i + 2);
        i = fin === -1 ? n : fin + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        i++;
        while (i < n && source[i] !== c) {
          if (source[i] === '\\') i++;
          if (source[i] === '\n') break;
          i++;
        }
        i++;
        continue;
      }
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '(') profondeur++;
      else if (c === ')') profondeur = Math.max(0, profondeur - 1);
      else if (compterAccolades && c === '{') accolades++;
      else if (compterAccolades && c === '}' && accolades > 0) accolades--;
      else if (profondeur === 0 && accolades === 0 && arrets.includes(c)) return c;
      i++;
    }
    return null;
  };

  const sauterBloc = () => {
    // Positionné juste après « { » : consomme jusqu'à l'accolade fermante correspondante.
    let niveau = 1;
    while (i < n && niveau > 0) {
      const arret = lireJusqua('{}', false);
      if (arret === '{') niveau++;
      else if (arret === '}') niveau--;
      if (arret === null) break;
      i++;
    }
  };

  const indentationDe = (position) => {
    const debutLigne = debuts[ligneDe(debuts, position) - 1];
    const avant = source.slice(debutLigne, position);
    return /^\s*$/.test(avant) ? avant : null;
  };

  const analyserDeclaration = (debut, fin, regle) => {
    const texte = source.slice(debut, fin);
    const deuxPoints = decouper(texte, ':');
    if (deuxPoints.length < 2) return false;
    const nom = deuxPoints[0].trim();
    if (!nom || /[\s{}]/.test(nom)) return false;
    const debutNom = debut + texte.indexOf(nom);
    let reste = texte.slice(deuxPoints[0].length + 1);
    let important = false;
    const m = /!\s*important\s*$/i.exec(reste);
    if (m) {
      important = true;
      reste = reste.slice(0, m.index);
    }
    const valeur = reste.trim();
    const debutValeur = debut + deuxPoints[0].length + 1 + reste.indexOf(valeur);
    regle.declarations.push({
      propriete: nom,
      valeur,
      important,
      fichier,
      ligne: ligneDe(debuts, debutNom),
      debutNom,
      finNom: debutNom + nom.length,
      debutValeur,
      finValeur: debutValeur + valeur.length,
      finDeclaration: fin,
      pointVirgule: source[fin] === ';',
      indentation: indentationDe(debutNom),
    });
    return true;
  };

  const analyserBloc = (parent, media, ignoree) => {
    for (;;) {
      sauterBlancsEtCommentaires();
      if (i >= n) return;
      if (source[i] === '}') {
        i++;
        return;
      }
      if (source[i] === ';') {
        i++;
        continue;
      }
      const debut = i;
      if (source[i] === '@') {
        const arret = lireJusqua('{;}', false);
        const prelude = source.slice(debut, i).trim();
        const nomAt = (/^@([\w-]+)/.exec(prelude) || [])[1]?.toLowerCase() || '';
        const params = prelude
          .slice(nomAt.length + 1)
          .replace(/\s+/g, ' ')
          .trim();
        if (arret !== '{') {
          if (arret === ';') i++;
          continue;
        }
        i++;
        if (AT_RULES_IGNOREES.has(nomAt)) {
          sauterBloc();
          continue;
        }
        const mediaEnfant = nomAt === 'media' ? (media ? `${media} and ${params}` : params) : media;
        analyserBloc(parent, mediaEnfant, ignoree);
        continue;
      }
      const proprietePersonnalisee = source.startsWith('--', i);
      const arret = lireJusqua(proprietePersonnalisee ? ';}' : '{;}', proprietePersonnalisee);
      if (arret === '{') {
        const selecteurBrut = source.slice(debut, i).trim();
        i++;
        const regle = {
          fichier,
          selecteurBrut,
          selecteurs: resoudreImbrication(selecteurBrut, parent),
          media,
          ligne: ligneDe(debuts, debut),
          debut,
          declarations: [],
          ignoree,
        };
        regles.push(regle);
        analyserBloc(regle, media, ignoree);
        regle.fin = i;
        continue;
      }
      // Déclaration (terminée par « ; », « } » ou la fin du fichier).
      let fin = i;
      while (fin > debut && /\s/.test(source[fin - 1])) fin--;
      if (parent && !analyserDeclaration(debut, fin, parent)) {
        erreurs.push({
          fichier,
          ligne: ligneDe(debuts, debut),
          texte: source.slice(debut, fin).trim(),
        });
      }
      if (arret === ';') i++;
      else if (arret === '}') {
        /* laissée au parent */
      }
    }
  };

  analyserBloc(null, null, false);
  return { regles: regles.filter((r) => !r.ignoree), erreurs };
}

/** Produit les sélecteurs absolus d'une règle imbriquée (« & » ou descendant implicite). */
function resoudreImbrication(selecteurBrut, parent) {
  const parties = decouper(selecteurBrut, ',')
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!parent) return parties;
  const resultat = [];
  for (const parentSel of parent.selecteurs) {
    for (const partie of parties) {
      if (partie.includes('&')) resultat.push(partie.replace(/&/g, parentSel));
      else resultat.push(`${parentSel} ${partie}`);
    }
  }
  return resultat;
}

// ---------------------------------------------------------------------------
// Analyse sémantique : contextes, variables, paires
// ---------------------------------------------------------------------------

const COMPOSE_RACINE = String.raw`(?::root|html)(?:\[[^\]]*\]|\.[-\w]+|:[-\w]+(?:\([^()]*\))?|#[-\w]+)*`;
const ATTRIBUT_DATA = String.raw`\[data-[^\]]*\]`;
const REGEX_RACINE = new RegExp(`^(?:${COMPOSE_RACINE}|${ATTRIBUT_DATA})$`, 'i');
const REGEX_PREFIXE = new RegExp(
  `^(${COMPOSE_RACINE}|${ATTRIBUT_DATA})\\s*(?:[>~+]\\s*)?(?=[^\\s>~+])(.+)$`,
  'i',
);

function estRacinePlaine(selecteur) {
  return /^(?::root|html)$/i.test(selecteur);
}

/** Sépare un sélecteur en (thème racine éventuel, sélecteur propre). */
export function separerTheme(selecteur) {
  if (REGEX_RACINE.test(selecteur)) {
    return { theme: estRacinePlaine(selecteur) ? null : selecteur, selecteur, racine: true };
  }
  const m = REGEX_PREFIXE.exec(selecteur);
  if (m && !estRacinePlaine(m[1])) return { theme: m[1], selecteur: m[2].trim(), racine: false };
  return { theme: null, selecteur, racine: false };
}

const clePortee = (theme, media) => `${theme ?? ''}\u0000${media ?? ''}`;

export function nomContexte(theme, media) {
  if (theme && media) return `${theme} @media ${media}`;
  if (theme) return theme;
  if (media) return `@media ${media}`;
  return ':root';
}

const PROPRIETES_PERTINENTES = new Set([
  'color',
  'background',
  'background-color',
  'font-size',
  'font-weight',
  'font',
  'opacity',
  'filter',
  'text-shadow',
  'mix-blend-mode',
  'background-clip',
  '-webkit-background-clip',
]);

function nomPropriete(declaration) {
  return declaration.propriete.startsWith('--')
    ? declaration.propriete
    : declaration.propriete.toLowerCase();
}

/** Fusionne des déclarations dans l'ordre de cascade : la dernière gagne, « !important » prioritaire. */
export function fusionnerDeclarations(declarations) {
  const carte = new Map();
  declarations.forEach((d, ordre) => {
    const nom = nomPropriete(d);
    const existante = carte.get(nom);
    if (existante && existante.important && !d.important) return;
    carte.set(nom, { ...d, ordre });
  });
  return carte;
}

const REGEX_VAR = /var\(\s*(--[^\s,)]+)/g;

/** Noms des variables directement référencées par une valeur. */
export function variablesReferencees(valeur) {
  const noms = new Set();
  for (const m of valeur.matchAll(REGEX_VAR)) noms.add(m[1]);
  return noms;
}

/** Trouve l'appel var( commençant à `debut` et retourne { fin, nom, repli, debutRepli, finRepli }. */
function lireVar(valeur, debut) {
  let profondeur = 0;
  let fin = -1;
  for (let i = debut; i < valeur.length; i++) {
    const c = valeur[i];
    if (c === '(') profondeur++;
    else if (c === ')') {
      profondeur--;
      if (profondeur === 0) {
        fin = i;
        break;
      }
    }
  }
  if (fin === -1) return null;
  const interieur = valeur.slice(debut + 4, fin);
  const virgule = decouper(interieur, ',');
  const nom = virgule[0].trim();
  if (virgule.length === 1) return { fin: fin + 1, nom, repli: null };
  const repliBrut = virgule.slice(1).join(',');
  const repli = repliBrut.trim();
  const debutRepli = debut + 4 + virgule[0].length + 1 + repliBrut.indexOf(repli);
  return { fin: fin + 1, nom, repli, debutRepli, finRepli: debutRepli + repli.length };
}

/**
 * Remplace les var() d'une valeur par leur définition dans un contexte.
 * `chercher(nom)` retourne la définition { valeur, ... } ou undefined.
 */
export function resoudreValeur(valeur, chercher, visites = new Set()) {
  const resultat = { valeur: '', variables: new Set(), raisons: [], origine: null, echec: false };
  const brut = valeur;
  const rogne = brut.trim();
  const decalage = brut.indexOf(rogne);
  let position = 0;
  let sortie = '';
  let compteVar = 0;
  for (;;) {
    const index = brut.indexOf('var(', position);
    if (index === -1) {
      sortie += brut.slice(position);
      break;
    }
    sortie += brut.slice(position, index);
    const appel = lireVar(brut, index);
    if (!appel) {
      sortie += brut.slice(index);
      break;
    }
    compteVar++;
    position = appel.fin;
    resultat.variables.add(appel.nom);
    // L'origine n'est suivie que si la valeur entière est un unique appel var().
    const unique = compteVar === 1 && index === decalage && appel.fin === decalage + rogne.length;
    if (visites.has(appel.nom)) {
      resultat.raisons.push(`cycle de variables sur ${appel.nom}`);
      resultat.echec = true;
      continue;
    }
    const definition = chercher(appel.nom);
    if (definition) {
      const interne = resoudreValeur(definition.valeur, chercher, new Set([...visites, appel.nom]));
      for (const v of interne.variables) resultat.variables.add(v);
      resultat.raisons.push(...interne.raisons);
      if (interne.echec) resultat.echec = true;
      sortie += interne.valeur;
      if (unique) resultat.origine = { type: 'variable', nom: appel.nom, definition };
    } else if (appel.repli !== null) {
      const interne = resoudreValeur(appel.repli, chercher, visites);
      for (const v of interne.variables) resultat.variables.add(v);
      resultat.raisons.push(...interne.raisons);
      if (interne.echec) resultat.echec = true;
      sortie += interne.valeur;
      if (unique && interne.origine && interne.origine.type === 'litteral') {
        resultat.origine = {
          type: 'litteral',
          debut: appel.debutRepli + interne.origine.debut,
          fin: appel.debutRepli + interne.origine.fin,
          texte: interne.origine.texte,
        };
      } else if (unique && interne.origine) resultat.origine = interne.origine;
    } else {
      resultat.raisons.push(`variable ${appel.nom} introuvable`);
      resultat.echec = true;
    }
  }
  resultat.valeur = sortie.trim();
  if (compteVar === 0)
    resultat.origine = {
      type: 'litteral',
      debut: decalage,
      fin: decalage + rogne.length,
      texte: rogne,
    };
  return resultat;
}

const REGEX_IMAGE =
  /(?:^|[\s,(])(?:url\(|[-\w]*gradient\(|image\(|image-set\(|cross-fade\(|element\(|paint\()/i;

/** Extrait la couleur du raccourci `background` (dernière couche) et signale les images. */
export function analyserFond(valeur) {
  const couches = decouper(valeur, ',').map((c) => c.trim());
  const image = couches.some((c) => REGEX_IMAGE.test(' ' + c));
  const derniere = couches[couches.length - 1];
  let trouvee = null;
  // Un jeton par un jeton : le premier qui est une couleur valide est la couleur de la couche.
  for (const jeton of decouper(derniere, ' ').filter(Boolean)) {
    const c = analyserCouleur(jeton);
    if (c) {
      trouvee = { texte: jeton, couleur: c };
      break;
    }
  }
  if (!trouvee && /^none$/i.test(derniere))
    trouvee = { texte: 'none', couleur: couleur(0, 0, 0, 0) };
  return {
    image,
    couleur: trouvee ? trouvee.couleur : null,
    texte: trouvee ? trouvee.texte : null,
  };
}

/** Taille et graisse depuis le raccourci `font` (« 700 20px/1.2 sans-serif »). */
function analyserRaccourciFont(valeur) {
  const jetons = decouper(valeur, ',')[0].split(/\s+/).filter(Boolean);
  let taille = null;
  let poids = null;
  for (const jeton of jetons) {
    const t = jeton.split('/')[0];
    if (
      taille === null &&
      (TAILLES_MOTS_CLES[t.toLowerCase()] !== undefined || /^[\d.]+[a-z%]*$/i.test(t))
    ) {
      if (/^\d{3}$/.test(t) && poids === null) {
        poids = t;
        continue;
      }
      taille = t;
    } else if (poids === null && /^(bold|bolder|lighter|normal|\d{3})$/i.test(t)) poids = t;
  }
  return { taille, poids };
}

/**
 * Analyse complète d'un ensemble de fichiers [{ chemin, source }] partageant variables et contextes.
 * Retourne { paires, fondInconnu, contextes, usages, definitions, regles, erreurs, fichiers }.
 */
export function analyser(fichiers, options = {}) {
  const niveau = options.niveau === 'AAA' ? 'AAA' : 'AA';
  const regles = [];
  const erreurs = [];
  for (const f of fichiers) {
    const resultat = analyserCss(f.source, f.chemin);
    regles.push(...resultat.regles);
    erreurs.push(...resultat.erreurs);
  }

  // Variantes : (thème, media, sélecteur) → déclarations en ordre de cascade.
  const variantes = new Map();
  const portees = new Map();
  const noterPortee = (theme, media) => {
    const cle = clePortee(theme, media);
    if (!portees.has(cle)) portees.set(cle, { theme, media, cle, nom: nomContexte(theme, media) });
    return portees.get(cle);
  };
  noterPortee(null, null);
  for (const regle of regles) {
    for (const absolu of regle.selecteurs) {
      const { theme, selecteur, racine } = separerTheme(absolu);
      const media = regle.media;
      noterPortee(theme, media);
      const cle = `${clePortee(theme, media)}\u0000${selecteur}`;
      if (!variantes.has(cle))
        variantes.set(cle, { theme, media, selecteur, racine, declarations: [], regles: [] });
      const variante = variantes.get(cle);
      variante.declarations.push(...regle.declarations);
      variante.regles.push(regle);
    }
  }

  // Définitions de variables par portée (règles racine seulement).
  const definitions = new Map();
  for (const variante of variantes.values()) {
    if (!variante.racine) continue;
    const cle = clePortee(variante.theme, variante.media);
    if (!definitions.has(cle)) definitions.set(cle, new Map());
    const carte = definitions.get(cle);
    for (const [nom, declaration] of fusionnerDeclarations(variante.declarations)) {
      if (!nom.startsWith('--')) continue;
      const existante = carte.get(nom);
      if (existante && existante.declaration.important && !declaration.important) continue;
      carte.set(nom, {
        nom,
        valeur: declaration.valeur,
        declaration,
        fichier: declaration.fichier,
        ligne: declaration.ligne,
        theme: variante.theme,
        media: variante.media,
        portee: cle,
        selecteur: variante.selecteur,
      });
    }
  }

  // Contextes : chaque portée rencontrée, avec ses variables effectives et celles qu'elle redéfinit.
  const porteesApplicables = (theme, media) => {
    const liste = [clePortee(null, null)];
    if (media) liste.push(clePortee(null, media));
    if (theme) liste.push(clePortee(theme, null));
    if (theme && media) liste.push(clePortee(theme, media));
    return liste;
  };
  const contextes = [];
  for (const portee of portees.values()) {
    const applicables = porteesApplicables(portee.theme, portee.media);
    const variables = new Map();
    const redefinit = new Set();
    for (const cle of applicables) {
      const carte = definitions.get(cle);
      if (!carte) continue;
      for (const [nom, definition] of carte) {
        variables.set(nom, definition);
        if (cle !== clePortee(null, null)) redefinit.add(nom);
      }
    }
    contextes.push({ ...portee, variables, redefinit, applicables });
  }

  const selecteurs = new Map();
  for (const variante of variantes.values()) {
    if (!selecteurs.has(variante.selecteur)) selecteurs.set(variante.selecteur, []);
    selecteurs.get(variante.selecteur).push(variante);
  }

  const declarationsEffectives = (selecteur, contexte) => {
    const ordre = contexte.applicables;
    const liste = [];
    for (const cle of ordre) {
      for (const variante of selecteurs.get(selecteur)) {
        if (clePortee(variante.theme, variante.media) === cle) liste.push(...variante.declarations);
      }
    }
    return fusionnerDeclarations(liste);
  };

  const paires = [];
  const fondInconnu = [];
  const usages = new Map();
  const noterUsage = (definition, usage) => {
    const cle = `${definition.portee}|${definition.nom}`;
    if (!usages.has(cle)) usages.set(cle, []);
    usages.get(cle).push(usage);
  };

  for (const [selecteur, listeVariantes] of selecteurs) {
    // Contextes où le sélecteur est évalué : ses propres portées, plus chaque contexte qui
    // redéfinit une variable qu'il utilise. Une paire n'est retenue que si une propriété
    // influençant le contraste change ; les autres évaluations ne servent qu'à l'index d'usages.
    const contextesEvalues = new Map();
    const pertinente = (d) =>
      PROPRIETES_PERTINENTES.has(nomPropriete(d)) || d.propriete.startsWith('--');
    // Les propriétés personnalisées d'une règle ordinaire lui sont locales ; celles d'une règle
    // racine sont les variables du contexte elles-mêmes (et un alias `--a: var(--b)` y est un usage).
    const racine = listeVariantes.some((v) => v.racine);
    const localesDe = (effectives) =>
      racine
        ? new Map()
        : new Map(
            [...effectives]
              .filter(([nom]) => nom.startsWith('--'))
              .map(([nom, d]) => [nom, { ...d, nom, locale: true }]),
          );
    for (const contexte of contextes) {
      const propres = listeVariantes.filter((v) => clePortee(v.theme, v.media) === contexte.cle);
      const applicable = listeVariantes.some((v) =>
        contexte.applicables.includes(clePortee(v.theme, v.media)),
      );
      if (!applicable) continue;
      let concerne = propres.length > 0;
      let retenu =
        contexte.cle === clePortee(null, null) ||
        propres.some((v) => v.declarations.some(pertinente));
      if (contexte.redefinit.size > 0) {
        const effectives = declarationsEffectives(selecteur, contexte);
        const locales = localesDe(effectives);
        const chercher = (nom) => locales.get(nom) || contexte.variables.get(nom);
        for (const [nom, declaration] of effectives) {
          const r = resoudreValeur(declaration.valeur, chercher);
          if (![...r.variables].some((v) => contexte.redefinit.has(v))) continue;
          concerne = true;
          if (PROPRIETES_PERTINENTES.has(nom) || nom.startsWith('--')) retenu = true;
        }
      }
      if (concerne) contextesEvalues.set(contexte.cle, { contexte, retenu });
    }

    for (const { contexte, retenu } of contextesEvalues.values()) {
      const effectives = declarationsEffectives(selecteur, contexte);
      const locales = localesDe(effectives);
      const chercher = (nom) => locales.get(nom) || contexte.variables.get(nom);
      const resultat = evaluer(selecteur, contexte, effectives, chercher, niveau);
      for (const [nom, declaration] of effectives) {
        for (const variable of variablesReferencees(declaration.valeur)) {
          const definition = contexte.variables.get(variable);
          if (!definition || locales.has(variable)) continue;
          noterUsage(definition, {
            contexte: contexte.nom,
            selecteur,
            propriete: nom,
            declaration,
            paire: resultat && resultat.type === 'paire' && nom === 'color' ? resultat.paire : null,
            fondInconnu: Boolean(resultat && resultat.type === 'fond-inconnu' && nom === 'color'),
          });
        }
      }
      if (!resultat || !retenu) continue;
      if (resultat.type === 'paire') paires.push(resultat.paire);
      else fondInconnu.push(resultat.entree);
    }
  }

  attribuerIds(paires);
  attribuerIds(fondInconnu);
  return {
    niveau,
    fichiers: fichiers.map((f) => f.chemin),
    paires,
    fondInconnu,
    contextes,
    definitions,
    usages,
    regles,
    variantes,
    erreurs,
  };
}

function attribuerIds(entrees) {
  const comptes = new Map();
  for (const entree of entrees) {
    const base = `${normaliserChemin(entree.fichier)}|${entree.contexte}|${entree.selecteur}`;
    const compte = (comptes.get(base) || 0) + 1;
    comptes.set(base, compte);
    entree.id = compte === 1 ? base : `${base}#${compte}`;
  }
}

/** Évalue un sélecteur dans un contexte : paire, fond inconnu, ou rien s'il n'a pas de `color`. */
function evaluer(selecteur, contexte, effectives, chercher, niveau) {
  const declColor = effectives.get('color');
  if (!declColor) return null;
  const raisons = [];
  const texteResolu = resoudreValeur(declColor.valeur, chercher);
  raisons.push(...texteResolu.raisons);

  const infoTexte = { declaree: declColor.valeur, variable: null, hex: null };
  if (texteResolu.origine && texteResolu.origine.type === 'variable')
    infoTexte.variable = texteResolu.origine.nom;
  let texte = null;
  if (!texteResolu.echec) {
    texte = analyserCouleur(texteResolu.valeur);
    if (!texte) raisons.push(`couleur de texte « ${texteResolu.valeur} » invalide`);
    else if (texte.indetermine) {
      raisons.push(`texte : ${texte.indetermine}`);
      texte = null;
    } else if (texte.a === 0) {
      raisons.push('texte transparent (probablement un effet background-clip: text)');
      texte = null;
    }
  }
  if (texte) {
    infoTexte.hex = versHex(texte);
    if (texte.a < 1) infoTexte.alpha = Number(texte.a.toFixed(4));
  }

  const base = {
    fichier: declColor.fichier,
    ligne: declColor.ligne,
    selecteur,
    contexte: contexte.nom,
    texte: infoTexte,
    _declColor: declColor,
    _origineTexte: texteResolu.origine,
    _contexte: contexte,
    _texteBrut: texte,
  };

  // Fond : background-color ou raccourci background, le plus récent des deux gagne.
  const bc = effectives.get('background-color');
  const bg = effectives.get('background');
  let declFond = null;
  if (bc && bg) {
    if (bc.important !== bg.important) declFond = bc.important ? bc : bg;
    else declFond = bc.ordre > bg.ordre ? bc : bg;
  } else declFond = bc || bg || null;

  if (!declFond) {
    return {
      type: 'fond-inconnu',
      entree: { ...base, raisons, raison: 'aucun fond déclaré dans cette règle' },
    };
  }

  const fondResolu = resoudreValeur(declFond.valeur, chercher);
  raisons.push(...fondResolu.raisons.map((r) => `fond : ${r}`));
  const infoFond = { declaree: declFond.valeur, variable: null, hex: null };
  if (fondResolu.origine && fondResolu.origine.type === 'variable')
    infoFond.variable = fondResolu.origine.nom;
  let fond = null;
  let fondIndetermine = null;
  let aVerifier = false;
  if (!fondResolu.echec) {
    if (nomPropriete(declFond) === 'background') {
      const analyse = analyserFond(fondResolu.valeur);
      if (analyse.image) {
        raisons.push('fond avec dégradé ou image : la couleur réelle sous le texte varie');
        aVerifier = true;
      }
      if (analyse.couleur) fond = analyse.couleur;
      else if (analyse.texte === null && !analyse.image) {
        const c = analyserCouleur(fondResolu.valeur);
        if (c && c.indetermine) fondIndetermine = c.indetermine;
        else raisons.push(`fond « ${fondResolu.valeur} » sans couleur reconnue`);
      } else if (!analyse.couleur) raisons.push('fond sans couleur explicite (image seule)');
    } else {
      const c = analyserCouleur(fondResolu.valeur);
      if (!c) raisons.push(`couleur de fond « ${fondResolu.valeur} » invalide`);
      else if (c.indetermine) fondIndetermine = c.indetermine;
      else fond = c;
    }
  }
  if (fondIndetermine) raisons.push(`fond : ${fondIndetermine}`);

  if (fond && fond.a === 0) {
    return {
      type: 'fond-inconnu',
      entree: {
        ...base,
        raisons,
        raison: 'fond transparent : la couleur sous le texte vient d’un ancêtre',
      },
    };
  }

  // Taille et graisse.
  const declTaille = effectives.get('font-size');
  const declPoids = effectives.get('font-weight');
  const declFont = effectives.get('font');
  let tailleTexte = null;
  let poidsTexte = null;
  if (declFont && (!declTaille || declFont.ordre > declTaille.ordre)) {
    const rf = analyserRaccourciFont(resoudreValeur(declFont.valeur, chercher).valeur);
    tailleTexte = rf.taille;
    poidsTexte = rf.poids;
  }
  if (declTaille && (!declFont || declTaille.ordre > declFont.ordre)) {
    const r = resoudreValeur(declTaille.valeur, chercher);
    tailleTexte = r.echec ? declTaille.valeur : r.valeur;
  }
  if (declPoids && (!declFont || declPoids.ordre > declFont.ordre)) {
    const r = resoudreValeur(declPoids.valeur, chercher);
    poidsTexte = r.echec ? declPoids.valeur : r.valeur;
  }
  const taille = analyserTaille(tailleTexte);
  if (taille.raison) raisons.push(taille.raison);
  const gras = estGras(poidsTexte);
  const grandTexte = estGrandTexte(taille.px, gras);
  const seuil = seuilContraste(niveau, grandTexte);

  // Effets qui invalident un calcul purement statique.
  const lire = (nom) => {
    const d = effectives.get(nom);
    return d ? resoudreValeur(d.valeur, chercher).valeur.trim().toLowerCase() : null;
  };
  const opacite = lire('opacity');
  if (opacite !== null) {
    const n = parseFloat(opacite);
    const valeur = opacite.endsWith('%') ? n / 100 : n;
    if (Number.isFinite(valeur) && valeur < 1) {
      raisons.push(`opacity ${opacite} sur la règle`);
      aVerifier = true;
    }
  }
  const filtre = lire('filter');
  if (filtre !== null && filtre !== 'none') {
    raisons.push(`filter « ${filtre} » modifie les couleurs rendues`);
    aVerifier = true;
  }
  const melange = lire('mix-blend-mode');
  if (melange !== null && melange !== 'normal') {
    raisons.push(`mix-blend-mode « ${melange} »`);
    aVerifier = true;
  }
  const ombre = lire('text-shadow');
  if (ombre !== null && ombre !== 'none') {
    raisons.push('text-shadow : l’ombre change le contraste perçu');
    aVerifier = true;
  }
  const clip = lire('background-clip') || lire('-webkit-background-clip');
  if (clip === 'text') {
    raisons.push('background-clip: text : le fond peint le texte');
    aVerifier = true;
  }

  const paire = {
    ...base,
    fond: infoFond,
    taille: tailleTexte,
    taillePx: taille.px,
    gras,
    grandTexte,
    seuil,
    ratio: null,
    statut: 'a-verifier',
    raisons,
    _fondBrut: fond,
    _declFond: declFond,
  };

  if (fond) infoFond.hex = versHex(fond);
  if (fond && fond.a < 1) {
    raisons.push(
      `fond semi-transparent (alpha ${fond.a.toFixed(2)}) : couleur sous-jacente inconnue`,
    );
    aVerifier = true;
  }
  if (texte && fond && fond.a >= 1) {
    const rendu = composer(texte, fond);
    infoTexte.hex = versHex(rendu);
    paire.ratio = ratioContraste(rendu, fond);
    paire._texteRendu = rendu;
  }
  if (paire.ratio !== null && !aVerifier)
    paire.statut = paire.ratio >= seuil ? 'conforme' : 'echec';
  return { type: 'paire', paire };
}

// ---------------------------------------------------------------------------
// Rapport JSON
// ---------------------------------------------------------------------------

export function normaliserChemin(chemin) {
  return chemin.replace(/\\/g, '/');
}

const ORDRE_STATUT = { echec: 0, 'a-verifier': 1, conforme: 2 };

/** Tri du pire au moins grave : échecs d'abord, par ratio croissant. */
export function trierPaires(paires) {
  return [...paires].sort((a, b) => {
    const s = ORDRE_STATUT[a.statut] - ORDRE_STATUT[b.statut];
    if (s !== 0) return s;
    const ra = a.ratio === null ? Infinity : a.ratio / a.seuil;
    const rb = b.ratio === null ? Infinity : b.ratio / b.seuil;
    if (ra !== rb) return ra - rb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function exporterPaire(p) {
  const texte = { declaree: p.texte.declaree, variable: p.texte.variable, hex: p.texte.hex };
  if (p.texte.alpha !== undefined) texte.alpha = p.texte.alpha;
  return {
    id: p.id,
    fichier: normaliserChemin(p.fichier),
    ligne: p.ligne,
    selecteur: p.selecteur,
    contexte: p.contexte,
    texte,
    fond: { declaree: p.fond.declaree, variable: p.fond.variable, hex: p.fond.hex },
    taille: p.taille,
    grandTexte: p.grandTexte,
    seuil: p.seuil,
    ratio: p.ratio === null ? null : Number(p.ratio.toFixed(4)),
    statut: p.statut,
    raisons: p.raisons,
  };
}

export function construireRapport(analyse, options = {}) {
  const paires = trierPaires(analyse.paires).map(exporterPaire);
  const fondInconnu = analyse.fondInconnu.map((e) => ({
    id: e.id,
    fichier: normaliserChemin(e.fichier),
    ligne: e.ligne,
    selecteur: e.selecteur,
    contexte: e.contexte,
    texte: { declaree: e.texte.declaree, variable: e.texte.variable, hex: e.texte.hex },
    raison: e.raison,
    raisons: e.raisons,
  }));
  return {
    outil: NOM_OUTIL,
    version: VERSION_RAPPORT,
    etiquette: options.etiquette || 'Avant',
    date: options.date || new Date().toISOString(),
    niveau: analyse.niveau,
    fichiers: analyse.fichiers.map(normaliserChemin),
    resume: {
      paires: paires.length,
      conformes: paires.filter((p) => p.statut === 'conforme').length,
      echecs: paires.filter((p) => p.statut === 'echec').length,
      aVerifier: paires.filter((p) => p.statut === 'a-verifier').length,
      fondInconnu: fondInconnu.length,
    },
    paires,
    fondInconnu,
    corrections: options.corrections || [],
  };
}

export function ecrireRapport(chemin, rapport) {
  mkdirSync(dirname(resoudreChemin(chemin)), { recursive: true });
  writeFileSync(chemin, JSON.stringify(rapport, null, 2) + '\n', 'utf8');
}

export function lireFichiers(chemins) {
  return chemins.map((chemin) => {
    let source;
    try {
      source = readFileSync(chemin, 'utf8');
    } catch (erreur) {
      throw new Error(`impossible de lire « ${chemin} » : ${erreur.message}`);
    }
    return { chemin, source };
  });
}

// ---------------------------------------------------------------------------
// Sortie terminal
// ---------------------------------------------------------------------------

export function couleursTerminal(flux = process.stdout) {
  return Boolean(flux.isTTY) && !('NO_COLOR' in process.env);
}

export function peindre(actif) {
  const code = (n) => (texte) => (actif ? `\u001b[${n}m${texte}\u001b[0m` : texte);
  return { rouge: code(31), vert: code(32), jaune: code(33), gras: code(1), gris: code(90) };
}

function tableau(lignes, entetes) {
  const largeurs = entetes.map((e, i) =>
    Math.max(e.length, ...lignes.map((l) => String(l[i].texte).length)),
  );
  const rendre = (cellules, colorer) =>
    cellules
      .map((c, i) => {
        const texte = String(c.texte ?? c);
        const pad = c.droite ? texte.padStart(largeurs[i]) : texte.padEnd(largeurs[i]);
        return colorer && c.couleur ? c.couleur(pad) : pad;
      })
      .join('  ');
  const sortie = [
    rendre(
      entetes.map((e) => ({ texte: e })),
      false,
    ),
  ];
  sortie.push(largeurs.map((l) => '-'.repeat(l)).join('  '));
  for (const l of lignes) sortie.push(rendre(l, true));
  return sortie.join('\n');
}

export function formaterScan(rapport, options = {}) {
  const p = peindre(options.couleurs ?? false);
  const lignes = [];
  const paires = rapport.paires.filter((x) => x.statut !== 'a-verifier' || options.details);
  const colorerStatut = (statut) =>
    statut === 'echec' ? p.rouge : statut === 'conforme' ? p.vert : p.jaune;
  const libelle = { echec: 'ÉCHEC', conforme: 'ok', 'a-verifier': 'à vérifier' };
  const rangees = paires.map((x) => {
    const c = colorerStatut(x.statut);
    return [
      { texte: libelle[x.statut], couleur: c },
      { texte: x.ratio === null ? '—' : tronquer(x.ratio), couleur: c, droite: true },
      { texte: String(x.seuil), droite: true },
      { texte: x.selecteur },
      { texte: x.contexte },
      { texte: `${x.texte.hex || '?'} sur ${x.fond.hex || '?'}` },
      { texte: x.taille ? `${x.taille}${x.grandTexte ? ' (grand)' : ''}` : '' },
      { texte: `${x.fichier}:${x.ligne}` },
    ];
  });
  lignes.push(
    p.gras(
      `Contraste WCAG ${rapport.niveau} — ${rapport.etiquette} — ${rapport.fichiers.join(', ')}`,
    ),
  );
  if (rangees.length) {
    lignes.push(
      tableau(rangees, [
        'Statut',
        'Ratio',
        'Seuil',
        'Sélecteur',
        'Contexte',
        'Texte sur fond',
        'Taille',
        'Fichier',
      ]),
    );
  } else lignes.push('Aucune paire texte/fond trouvée.');
  const r = rapport.resume;
  lignes.push('');
  lignes.push(
    `${r.paires} paire(s) : ${r.echecs ? p.rouge(`${r.echecs} échec(s)`) : '0 échec'}, ${r.conformes} conforme(s), ` +
      `${r.aVerifier} à vérifier, ${r.fondInconnu} règle(s) au fond inconnu` +
      (options.details ? '' : ' (détails avec --details)'),
  );
  if (options.details) {
    const aVerifier = rapport.paires.filter((x) => x.statut === 'a-verifier');
    if (aVerifier.length) {
      lignes.push('', p.gras('À vérifier manuellement :'));
      for (const x of aVerifier) {
        lignes.push(`  ${x.selecteur}  [${x.contexte}]  ${x.fichier}:${x.ligne}`);
        for (const raison of x.raisons) lignes.push(`      - ${raison}`);
      }
    }
    if (rapport.fondInconnu.length) {
      lignes.push('', p.gras('Fond inconnu (color sans fond dans la même règle) :'));
      for (const x of rapport.fondInconnu) {
        lignes.push(
          `  ${x.selecteur}  [${x.contexte}]  ${x.fichier}:${x.ligne}  texte ${x.texte.hex || x.texte.declaree}`,
        );
        for (const raison of x.raisons || []) lignes.push(`      - ${raison}`);
      }
    }
  }
  return lignes.join('\n');
}

// ---------------------------------------------------------------------------
// Ligne de commande
// ---------------------------------------------------------------------------

export const LIMITES = [
  'Analyse statique : la cascade par spécificité entre sélecteurs différents n’est pas modélisée',
  '(seule la même règle, ou sa variante dans un thème, est fusionnée) ; les couleurs héritées des',
  'ancêtres sont inconnues (règles « fond inconnu »).',
  'Les contextes reconnus sont les sélecteurs de thème sur la racine (:root[data-theme=…],',
  'html.dark, [data-theme=…]) et les media queries qui redéfinissent des variables ; deux media',
  'queries simultanées ne sont pas combinées entre elles.',
  'Les tailles en em, %, vw, cqw, calc(), clamp() ou var() non résolue prennent le seuil du texte',
  'courant. color-mix(), light-dark(), currentColor, les couleurs système, les dégradés, filter,',
  'mix-blend-mode, text-shadow, opacity et les fonds semi-transparents sont signalés « à vérifier ».',
];

const AIDE = `contraste.mjs — contrastes WCAG 2.x d'un ou plusieurs fichiers CSS

Usage :
  node contraste.mjs ratio <texte> <fond>
  node contraste.mjs scan <fichier.css>... [options]
  node contraste.mjs page <rapport.json>... [options]
  node contraste.mjs --aide

Commandes :
  ratio   Ratio de contraste entre deux couleurs CSS et verdicts AA/AAA (texte courant, grand texte).
          Le fond doit être opaque ; un texte semi-transparent est composé sur le fond.
  scan    Analyse chaque règle qui déclare une couleur de texte et un fond, dans chaque contexte
          (thème, media query) qui la concerne, puis affiche le tableau du pire au moins grave.
  page    Écrit une copie de rapport.html déjà remplie avec les rapports JSON donnés (le premier
          est la référence, en pratique « Avant ») et, avec --ouvrir, l'ouvre dans le navigateur.

Options de scan :
  --niveau AA|AAA       Niveau visé (AA par défaut : 4,5 texte courant, 3 grand texte ; AAA : 7 / 4,5).
  --etiquette <nom>     Étiquette du rapport (« Avant » par défaut).
  --sortie <rapport>    Écrit le rapport JSON (le dossier est créé au besoin).
  --details             Détaille les paires « à vérifier » et les règles au fond inconnu.
  --sans-couleur        Désactive les couleurs ANSI (comme la variable NO_COLOR).

Options de page :
  --sortie <page.html>  Page à écrire (par défaut rapport-contraste.html à côté du premier rapport ;
                        le dossier est créé au besoin).
  --modele <fichier>    Modèle de page. Sinon : rapport.html à côté du script, puis ../assets/rapport.html.
  --ouvrir              Ouvre la page dans le navigateur par défaut, sans bloquer. Avec la variable
                        d'environnement CONTRASTE_SANS_OUVRIR=1, affiche la commande au lieu de la lancer.

Codes de sortie :
  scan : 0 aucun échec, 1 au moins un échec, 2 erreur d'usage ou de lecture.
  page : 0 page écrite, 2 erreur (rapport illisible ou invalide, modèle introuvable, aucun rapport).

Limites connues :
${LIMITES.map((l) => `  ${l}`).join('\n')}
`;

export function analyserArgumentsCli(argv) {
  const options = {
    fichiers: [],
    niveau: 'AA',
    etiquette: null,
    sortie: null,
    details: false,
    aide: false,
  };
  const args = [...argv];
  while (args.length) {
    const arg = args.shift();
    if (arg === '--aide' || arg === '--help' || arg === '-h') options.aide = true;
    else if (arg === '--niveau') {
      const v = (args.shift() || '').toUpperCase();
      if (v !== 'AA' && v !== 'AAA') throw new Error('--niveau attend AA ou AAA');
      options.niveau = v;
    } else if (arg === '--etiquette') {
      options.etiquette = args.shift();
      if (!options.etiquette) throw new Error('--etiquette attend un nom');
    } else if (arg === '--sortie') {
      options.sortie = args.shift();
      if (!options.sortie) throw new Error('--sortie attend un chemin');
    } else if (arg === '--modele') {
      options.modele = args.shift();
      if (!options.modele) throw new Error('--modele attend un chemin');
    } else if (arg === '--details') options.details = true;
    else if (arg === '--ecrire') options.ecrire = true;
    else if (arg === '--ouvrir') options.ouvrir = true;
    else if (arg === '--sans-couleur') options.sansCouleur = true;
    else if (arg.startsWith('--')) throw new Error(`option inconnue : ${arg}`);
    else options.fichiers.push(arg);
  }
  return options;
}

function commandeRatio(args, sortie) {
  const [texteBrut, fondBrut] = args;
  if (!texteBrut || !fondBrut) {
    sortie.erreur('Usage : node contraste.mjs ratio <texte> <fond>');
    return 2;
  }
  const texte = analyserCouleur(texteBrut);
  const fond = analyserCouleur(fondBrut);
  for (const [nom, c, brut] of [
    ['texte', texte, texteBrut],
    ['fond', fond, fondBrut],
  ]) {
    if (!c) {
      sortie.erreur(`Couleur de ${nom} invalide : « ${brut} »`);
      return 2;
    }
    if (c.indetermine) {
      sortie.erreur(`Couleur de ${nom} non évaluable : ${c.indetermine}`);
      return 2;
    }
  }
  if (fond.a < 1) {
    sortie.erreur(
      `Fond semi-transparent refusé (alpha ${fond.a.toFixed(2)}) : le contraste dépend de ce qui se trouve derrière.\n` +
        'Donnez la couleur opaque réellement rendue sous le texte.',
    );
    return 2;
  }
  const rendu = composer(texte, fond);
  const ratio = ratioContraste(rendu, fond);
  const p = peindre(sortie.couleurs);
  const verdict = (seuil) =>
    ratio >= seuil ? p.vert(`ok (≥ ${seuil})`) : p.rouge(`échec (< ${seuil})`);
  const lignes = [];
  if (texte.a < 1)
    lignes.push(
      `Texte ${versHex(texte)} à ${texte.a.toFixed(2)} d'opacité, rendu ${versHex(rendu)} sur ${versHex(fond)}`,
    );
  else lignes.push(`Texte ${versHex(texte)} sur fond ${versHex(fond)}`);
  lignes.push(`Ratio : ${p.gras(tronquer(ratio))}:1`);
  lignes.push(`  AA  texte courant ${verdict(4.5)}   grand texte ${verdict(3)}`);
  lignes.push(`  AAA texte courant ${verdict(7)}   grand texte ${verdict(4.5)}`);
  sortie.info(lignes.join('\n'));
  return 0;
}

function commandeScan(args, sortie) {
  let options;
  try {
    options = analyserArgumentsCli(args);
  } catch (erreur) {
    sortie.erreur(`Erreur : ${erreur.message}`);
    return 2;
  }
  if (options.aide) {
    sortie.info(AIDE);
    return 0;
  }
  if (!options.fichiers.length) {
    sortie.erreur(
      'Usage : node contraste.mjs scan <fichier.css>... [--niveau AA|AAA] [--sortie rapport.json]',
    );
    return 2;
  }
  let fichiers;
  try {
    fichiers = lireFichiers(options.fichiers);
  } catch (erreur) {
    sortie.erreur(`Erreur : ${erreur.message}`);
    return 2;
  }
  const analyse = analyser(fichiers, { niveau: options.niveau });
  const rapport = construireRapport(analyse, { etiquette: options.etiquette || 'Avant' });
  sortie.info(
    formaterScan(rapport, {
      couleurs: sortie.couleurs && !options.sansCouleur,
      details: options.details,
    }),
  );
  if (options.sortie) {
    try {
      ecrireRapport(options.sortie, rapport);
      sortie.info(`Rapport écrit : ${options.sortie}`);
    } catch (erreur) {
      sortie.erreur(`Erreur d'écriture : ${erreur.message}`);
      return 2;
    }
  }
  return rapport.resume.echecs > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Commande page : rapport.html rempli avec des rapports JSON
// ---------------------------------------------------------------------------

/** Même règle de validation que la page : outil, version, listes et résumé présents. */
export function validerRapport(objet) {
  if (!objet || typeof objet !== 'object' || Array.isArray(objet)) {
    return { ok: false, erreur: 'le JSON ne décrit pas un objet' };
  }
  if (objet.outil !== NOM_OUTIL) {
    return {
      ok: false,
      erreur: 'ce fichier ne vient pas de wcag-contraste (champ « outil » absent ou différent)',
    };
  }
  if (objet.version !== VERSION_RAPPORT) {
    return {
      ok: false,
      erreur: `version de rapport ${objet.version} non prise en charge (attendue : ${VERSION_RAPPORT})`,
    };
  }
  if (!Array.isArray(objet.paires) || !Array.isArray(objet.fondInconnu) || !objet.resume) {
    return { ok: false, erreur: 'rapport incomplet (paires, fondInconnu ou resume manquant)' };
  }
  return { ok: true };
}

const REGEX_BLOC_INTEGRE = /(<script\b[^>]*\bid="rapports-integres"[^>]*>)[\s\S]*?(<\/script>)/;

/** JSON sûr dans un <script> : « < », U+2028 et U+2029 échappés, JSON.parse les restitue. */
export function serialiserPourScript(donnees) {
  return JSON.stringify(donnees)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

/** Remplit le bloc de données intégrées du modèle ; null si le bloc est absent. */
export function injecterRapports(modele, rapports) {
  if (!REGEX_BLOC_INTEGRE.test(modele)) return null;
  return modele.replace(
    REGEX_BLOC_INTEGRE,
    (_, ouverture, fermeture) => `${ouverture}${serialiserPourScript(rapports)}${fermeture}`,
  );
}

const DOSSIER_SCRIPT = dirname(fileURLToPath(import.meta.url));

/** Modèle explicite, sinon rapport.html à côté du script, puis ../assets/rapport.html (skill). */
export function chercherModele(modele) {
  const candidats = modele
    ? [resoudreChemin(modele)]
    : [join(DOSSIER_SCRIPT, 'rapport.html'), join(DOSSIER_SCRIPT, '..', 'assets', 'rapport.html')];
  const chemin = candidats.find((c) => existsSync(c)) || null;
  return { chemin, candidats };
}

/** Commande d'ouverture d'un fichier dans le navigateur par défaut, selon la plateforme. */
export function commandeOuverture(chemin, plateforme = process.platform) {
  if (plateforme === 'win32') {
    // « start » prend le premier argument entre guillemets pour un titre : d'où le "" vide.
    return {
      commande: 'cmd.exe',
      args: ['/c', 'start', '""', `"${chemin}"`],
      verbatim: true,
      affichage: `cmd /c start "" "${chemin}"`,
    };
  }
  const commande = plateforme === 'darwin' ? 'open' : 'xdg-open';
  return { commande, args: [chemin], verbatim: false, affichage: `${commande} "${chemin}"` };
}

function ouvrirDansNavigateur(chemin, sortie) {
  const { commande, args, verbatim, affichage } = commandeOuverture(chemin);
  if (process.env.CONTRASTE_SANS_OUVRIR === '1') {
    sortie.info(`Commande d'ouverture (non exécutée, CONTRASTE_SANS_OUVRIR=1) : ${affichage}`);
    return;
  }
  const aLaMain = () =>
    sortie.erreur(
      `Impossible d'ouvrir le navigateur automatiquement : ouvrez ${chemin} à la main.`,
    );
  try {
    const enfant = spawn(commande, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      windowsVerbatimArguments: verbatim,
    });
    enfant.on('error', aLaMain);
    enfant.unref();
    sortie.info(`Ouverture dans le navigateur : ${affichage}`);
  } catch {
    aLaMain();
  }
}

function commandePage(args, sortie) {
  let options;
  try {
    options = analyserArgumentsCli(args);
  } catch (erreur) {
    sortie.erreur(`Erreur : ${erreur.message}`);
    return 2;
  }
  if (options.aide) {
    sortie.info(AIDE);
    return 0;
  }
  if (!options.fichiers.length) {
    sortie.erreur(
      'Usage : node contraste.mjs page <rapport.json>... [--sortie page.html] [--modele rapport.html] [--ouvrir]',
    );
    return 2;
  }
  const rapports = [];
  for (const chemin of options.fichiers) {
    let objet;
    try {
      objet = JSON.parse(readFileSync(chemin, 'utf8'));
    } catch (erreur) {
      sortie.erreur(`Erreur : rapport « ${chemin} » illisible (${erreur.message})`);
      return 2;
    }
    const validation = validerRapport(objet);
    if (!validation.ok) {
      sortie.erreur(`Erreur : rapport « ${chemin} » invalide : ${validation.erreur}`);
      return 2;
    }
    rapports.push({ nom: basename(chemin), rapport: objet });
  }
  const modele = chercherModele(options.modele);
  if (!modele.chemin) {
    sortie.erreur(
      `Erreur : modèle de page introuvable. Chemins essayés :\n${modele.candidats.map((c) => `  - ${c}`).join('\n')}`,
    );
    return 2;
  }
  let page;
  try {
    page = injecterRapports(readFileSync(modele.chemin, 'utf8'), rapports);
  } catch (erreur) {
    sortie.erreur(`Erreur : modèle « ${modele.chemin} » illisible (${erreur.message})`);
    return 2;
  }
  if (page === null) {
    sortie.erreur(
      `Erreur : le modèle « ${modele.chemin} » ne contient pas le bloc <script type="application/json" id="rapports-integres">.`,
    );
    return 2;
  }
  const cible = resoudreChemin(
    options.sortie || join(dirname(resoudreChemin(options.fichiers[0])), 'rapport-contraste.html'),
  );
  try {
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, page, 'utf8');
  } catch (erreur) {
    sortie.erreur(`Erreur d'écriture : ${erreur.message}`);
    return 2;
  }
  sortie.info(`Page écrite : ${cible}`);
  if (options.ouvrir) ouvrirDansNavigateur(cible, sortie);
  return 0;
}

export function executerCli(argv) {
  const sortie = {
    couleurs: couleursTerminal(),
    info: (t) => process.stdout.write(t + '\n'),
    erreur: (t) => process.stderr.write(t + '\n'),
  };
  const [commande, ...reste] = argv;
  if (!commande || commande === '--aide' || commande === '--help' || commande === '-h') {
    sortie.info(AIDE);
    return commande ? 0 : 2;
  }
  if (commande === 'ratio') return commandeRatio(reste, sortie);
  if (commande === 'scan') return commandeScan(reste, sortie);
  if (commande === 'page') return commandePage(reste, sortie);
  sortie.erreur(`Commande inconnue : ${commande}\n`);
  sortie.erreur(AIDE);
  return 2;
}

const lanceDirectement =
  process.argv[1] && import.meta.url === pathToFileURL(resoudreChemin(process.argv[1])).href;
if (lanceDirectement) process.exitCode = executerCli(process.argv.slice(2));
