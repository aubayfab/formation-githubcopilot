#!/usr/bin/env node
/*
 * corriger.mjs — propose et applique la correction minimale des contrastes WCAG d'un CSS.
 *
 *   node corriger.mjs <fichier.css>... [--niveau AA|AAA] [--ecrire] [--etiquette <nom>]
 *                                      [--sortie <rapport.json>]
 *   node corriger.mjs --aide
 *
 * Sans --ecrire, seul le plan est affiché (et le rapport de l'état corrigé écrit si --sortie).
 * Les fonds ne sont jamais modifiés : on cherche, pour chaque couleur de texte, la couleur
 * conforme la plus proche en OKLCH (teinte conservée, luminosité déplacée, chroma réduite
 * seulement pour rester dans le gamut sRGB).
 */

import { writeFileSync } from 'node:fs';
import { resolve as resoudreChemin } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  NOMS_CSS,
  LIMITES,
  analyser,
  analyserArgumentsCli,
  analyserCouleur,
  composer,
  construireRapport,
  couleursTerminal,
  decouper,
  deltaE,
  ecrireRapport,
  lireFichiers,
  luminance,
  normaliserChemin,
  oklabVersLineaire,
  oklabVersOklch,
  oklabVersSrgb,
  oklchVersOklab,
  peindre,
  ratioContraste,
  srgbVersHsl,
  srgbVersHwb,
  srgbVersLab,
  srgbVersOklab,
  tronquer,
  versHex,
} from './contraste.mjs';

const borner = (v, min, max) => Math.min(max, Math.max(min, v));
const arrondir8 = (v) => borner(Math.round(v), 0, 255);

// ---------------------------------------------------------------------------
// Recherche de la couleur conforme la plus proche
// ---------------------------------------------------------------------------

function enGamut(lin) {
  const e = 1e-6;
  return (
    lin.r >= -e && lin.r <= 1 + e && lin.g >= -e && lin.g <= 1 + e && lin.b >= -e && lin.b <= 1 + e
  );
}

/** sRGB (flottant 0-255) d'une couleur OKLCH, la chroma réduite par dichotomie si elle sort du gamut. */
export function oklchVersSrgbBorne(L, C, h) {
  if (enGamut(oklabVersLineaire(oklchVersOklab({ L, C, h }))))
    return oklabVersSrgb(oklchVersOklab({ L, C, h }));
  let bas = 0;
  let haut = C;
  for (let i = 0; i < 24; i++) {
    const milieu = (bas + haut) / 2;
    if (enGamut(oklabVersLineaire(oklchVersOklab({ L, C: milieu, h })))) bas = milieu;
    else haut = milieu;
  }
  return oklabVersSrgb(oklchVersOklab({ L, C: bas, h }));
}

/**
 * Cherche la couleur 8 bits la plus proche (ΔE OKLab) de `origine` acceptée par `verifier`,
 * en ne déplaçant que la luminosité OKLCH, dans les deux sens. Retourne null si rien ne passe.
 *
 * Deux explorations se complètent : une grille de luminosités (robuste, sans hypothèse) et,
 * pour chaque contrainte de `options.contraintes` ({ passe, bas }), la frontière exacte trouvée
 * par dichotomie de part et d'autre du creux où le rendu a la luminance du fond. Le ratio étant
 * en V autour de ce creux, le point conforme le plus proche est toujours une de ces frontières.
 */
export function chercherCouleur(origine, verifier, options = {}) {
  const pas = options.pas ?? 0.004;
  const lch0 = oklabVersOklch(srgbVersOklab(origine));
  const C0 = lch0.C < 0.002 ? 0 : lch0.C;
  const candidat = (L) => {
    const c = oklchVersSrgbBorne(borner(L, 0, 1), C0, lch0.h);
    return { r: arrondir8(c.r), g: arrondir8(c.g), b: arrondir8(c.b) };
  };
  let meilleur = null;
  const essayer = (L) => {
    const c = candidat(L);
    if (!verifier(c)) return false;
    const ecart = deltaE(c, origine);
    if (!meilleur || ecart < meilleur.deltaE) meilleur = { couleur: c, deltaE: ecart, L };
    return true;
  };
  // Après arrondi 8 bits une frontière peut repasser sous le seuil : on avance d'un pas et on revérifie.
  const essayerEnAvancant = (L, direction) => {
    for (let k = 0; k < 100; k++) if (essayer(borner(L + direction * k * 0.0002, 0, 1))) return;
  };
  const frontiere = (vrai, faux, predicat) => {
    for (let i = 0; i < 24; i++) {
      const milieu = (vrai + faux) / 2;
      if (predicat(milieu)) vrai = milieu;
      else faux = milieu;
    }
    return vrai;
  };

  essayer(lch0.L);
  const n = Math.round(1 / pas);
  for (let i = 0; i <= n; i++) essayer(i / n);

  for (const { passe, bas } of options.contraintes || []) {
    const enBas = (L) => bas(candidat(L));
    const ok = (L) => passe(candidat(L));
    let creux;
    if (!enBas(0)) creux = 0;
    else if (enBas(1)) creux = 1;
    else creux = frontiere(1, 0, (L) => !enBas(L));
    if (ok(1)) essayerEnAvancant(ok(creux) ? creux : frontiere(1, creux, ok), 1);
    if (ok(0)) essayerEnAvancant(ok(creux) ? creux : frontiere(0, creux, ok), -1);
  }

  if (!meilleur) return null;
  // Affinage entre le point retenu et la luminosité d'origine.
  const direction = Math.sign(lch0.L - meilleur.L);
  const depart = meilleur.L;
  for (let k = 1; k < 10 && direction !== 0; k++) {
    const L = depart + (direction * k * pas) / 10;
    if (Math.abs(L - lch0.L) >= Math.abs(depart - lch0.L)) break;
    essayer(L);
  }
  return meilleur;
}

/** Vérificateur : toutes les contraintes [{ fond, seuil }] passent pour un texte d'alpha donné. */
export function verificateurTexte(contraintes, alpha = 1) {
  return (c) =>
    contraintes.every(
      ({ fond, seuil }) => ratioContraste(composer({ ...c, a: alpha }, fond), fond) >= seuil,
    );
}

/** Contraintes individuelles ({ passe, bas }) pour la recherche par frontières. */
function contraintesTexte(contraintes, alpha = 1) {
  return contraintes.map(({ fond, seuil }) => ({
    passe: (c) => ratioContraste(composer({ ...c, a: alpha }, fond), fond) >= seuil,
    bas: (c) => luminance(composer({ ...c, a: alpha }, fond)) < luminance(fond),
  }));
}

/**
 * Couleur de texte conforme la plus proche, sérialisée dans le format d'origine et revérifiée
 * après relecture. Retourne { couleur, texte, deltaE, ratio } ou null si c'est impossible.
 */
export function chercherCouleurTexte(origine, contraintes, format) {
  const alpha = origine.a ?? 1;
  const verifier = verificateurTexte(contraintes, alpha);
  const serialiser = (c) => serialiserPassant(c, alpha, format, verifier);
  const trouve = chercherCouleur(origine, (c) => serialiser(c) !== null, {
    contraintes: contraintesTexte(contraintes, alpha),
  });
  if (!trouve) return null;
  const texte = serialiser(trouve.couleur);
  const couleur = analyserCouleur(texte);
  const ratio = Math.min(
    ...contraintes.map(({ fond }) => ratioContraste(composer(couleur, fond), fond)),
  );
  return { couleur, texte, deltaE: deltaE(couleur, origine), ratio };
}

/** Fond conforme le plus proche pour un texte donné (proposition quand le texte seul ne suffit pas). */
export function chercherFond(texte, fond, seuil) {
  const passe = (c) => ratioContraste(composer(texte, c), c) >= seuil;
  const bas = (c) => luminance(c) < luminance(composer(texte, c));
  const trouve = chercherCouleur(fond, passe, { contraintes: [{ passe, bas }] });
  return trouve ? { couleur: trouve.couleur, deltaE: trouve.deltaE } : null;
}

// ---------------------------------------------------------------------------
// Formats de couleur : conserver la syntaxe d'origine
// ---------------------------------------------------------------------------

function decimalesDe(texte) {
  const m = /\.(\d+)/.exec(texte);
  return m ? m[1].length : 0;
}

/** Décrit la syntaxe d'un littéral de couleur pour la reproduire. */
export function analyserFormat(texte) {
  const t = (texte || '').trim();
  const hex = /^#([0-9a-f]+)$/i.exec(t);
  if (hex) {
    const d = hex[1];
    return {
      type: 'hex',
      court: d.length <= 4,
      majuscules: /[A-F]/.test(d) && !/[a-f]/.test(d),
      alpha: d.length === 4 ? d[3] + d[3] : d.length === 8 ? d.slice(6) : null,
    };
  }
  const fonction = /^([a-z]+)\((.*)\)$/is.exec(t);
  if (fonction) {
    const nom = fonction[1].toLowerCase();
    const interieur = fonction[2];
    const virgules = decouper(interieur, ',').length > 1;
    let composantes;
    let separateur;
    let alpha = null;
    let separateurAlpha = null;
    if (virgules) {
      const parties = decouper(interieur, ',');
      composantes = parties.slice(0, 3).map((p) => p.trim());
      separateur = /,\s*/.exec(interieur.slice(parties[0].length))[0];
      if (parties.length > 3) {
        alpha = parties[3].trim();
        separateurAlpha = separateur;
      }
    } else {
      const [avant, apres] = decouper(interieur, '/');
      composantes = avant.trim().split(/\s+/);
      separateur = (/\S(\s+)\S/.exec(avant.trim()) || [, ' '])[1];
      if (apres !== undefined) {
        alpha = apres.trim();
        separateurAlpha = (/(\s*\/\s*)/.exec(interieur) || [, ' / '])[1];
      }
    }
    const debut = /^\s*/.exec(interieur)[0];
    const fin = /\s*$/.exec(interieur)[0];
    return {
      type: 'fonction',
      nom,
      composantes,
      separateur,
      alpha,
      separateurAlpha,
      debut,
      fin,
      pourcentages: composantes.some((c) => /%$/.test(c)),
      pourcentL: /%$/.test(composantes[0] || ''),
      uniteAngle: (/(deg|grad|rad|turn)$/i.exec(
        (nom === 'hsl' || nom === 'hsla' || nom === 'hwb' ? composantes[0] : composantes[2]) || '',
      ) || [, ''])[1],
      precision: Math.max(...composantes.map(decimalesDe)),
    };
  }
  if (NOMS_CSS[t.toLowerCase()]) return { type: 'nom' };
  return { type: 'hex', court: true, majuscules: false, alpha: null };
}

function nombre(valeur, decimales) {
  const texte = Number(valeur).toFixed(Math.max(0, decimales));
  const propre = texte.includes('.') ? texte.replace(/0+$/, '').replace(/\.$/, '') : texte;
  return propre === '-0' ? '0' : propre;
}

function serialiserHex(rgb, format) {
  const canaux = [rgb.r, rgb.g, rgb.b].map((c) => arrondir8(c).toString(16).padStart(2, '0'));
  const alpha = format.alpha;
  const courtPossible =
    format.court && canaux.every((c) => c[0] === c[1]) && (alpha === null || alpha[0] === alpha[1]);
  let texte = courtPossible
    ? '#' + canaux.map((c) => c[0]).join('') + (alpha === null ? '' : alpha[0])
    : '#' + canaux.join('') + (alpha === null ? '' : alpha);
  if (format.majuscules) texte = texte.toUpperCase();
  return texte;
}

/** Sérialise une couleur 8 bits dans un format donné, avec `precision` décimales. */
export function serialiserCouleur(rgb, format, precision = 0) {
  if (!format || format.type === 'nom')
    return serialiserHex(rgb, { court: true, majuscules: false, alpha: null });
  if (format.type === 'hex') return serialiserHex(rgb, format);
  const { nom, separateur: sep } = format;
  const alpha = format.alpha === null ? '' : `${format.separateurAlpha}${format.alpha}`;
  const angle = (h) =>
    `${nombre(h, precision)}${format.uniteAngle && format.uniteAngle !== 'deg' ? 'deg' : format.uniteAngle}`;
  let corps;
  if (nom === 'rgb' || nom === 'rgba') {
    const canaux = [rgb.r, rgb.g, rgb.b].map((c) =>
      format.pourcentages
        ? `${nombre((c * 100) / 255, Math.max(1, precision))}%`
        : String(arrondir8(c)),
    );
    corps = canaux.join(sep);
  } else if (nom === 'hsl' || nom === 'hsla') {
    const { h, s, l } = srgbVersHsl(rgb);
    corps = [angle(h), `${nombre(s * 100, precision)}%`, `${nombre(l * 100, precision)}%`].join(
      sep,
    );
  } else if (nom === 'hwb') {
    const { h, w, b } = srgbVersHwb(rgb);
    corps = [angle(h), `${nombre(w * 100, precision)}%`, `${nombre(b * 100, precision)}%`].join(
      sep,
    );
  } else if (nom === 'lab' || nom === 'lch') {
    const lab = srgbVersLab(rgb);
    const L = `${nombre(lab.L, precision)}${format.pourcentL ? '%' : ''}`;
    if (nom === 'lab') corps = [L, nombre(lab.a, precision), nombre(lab.b, precision)].join(sep);
    else {
      const lch = oklabVersOklch(lab);
      corps = [L, nombre(lch.C, precision), angle(lch.h)].join(sep);
    }
  } else if (nom === 'oklab' || nom === 'oklch') {
    const lab = srgbVersOklab(rgb);
    const L = format.pourcentL
      ? `${nombre(lab.L * 100, precision)}%`
      : nombre(lab.L, precision + 2);
    if (nom === 'oklab')
      corps = [L, nombre(lab.a, precision + 3), nombre(lab.b, precision + 3)].join(sep);
    else {
      const lch = oklabVersOklch(lab);
      corps = [L, nombre(lch.C, precision + 3), angle(lch.h)].join(sep);
    }
  } else return serialiserHex(rgb, { court: true, majuscules: false, alpha: null });
  return `${nom}(${format.debut}${corps}${alpha}${format.fin})`;
}

/** Sérialisation avec la précision minimale dont la relecture passe encore `verifier`. */
export function serialiserPassant(rgb, alpha, format, verifier) {
  const base = format && format.type === 'fonction' ? format.precision : 0;
  for (let precision = base; precision <= base + 4; precision++) {
    const texte = serialiserCouleur(rgb, format, precision);
    const relu = analyserCouleur(texte);
    if (!relu || relu.indetermine) return null;
    if (Math.abs((relu.a ?? 1) - alpha) > 0.005) return null;
    if (verifier(relu)) return texte;
    if (!format || format.type !== 'fonction') return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plan de correction
// ---------------------------------------------------------------------------

function detecterFinDeLigne(source) {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

/** Remplace `var(--nom` par `var(--nouveau` dans une valeur, sans toucher au repli. */
export function renommerVariable(valeur, nom, nouveau) {
  const motif = new RegExp(
    `(var\\(\\s*)${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s,)])`,
    'g',
  );
  return valeur.replace(motif, `$1${nouveau}`);
}

function contrainteDe(paire) {
  return { fond: paire._fondBrut, seuil: paire.seuil };
}

/** Contraintes d'un ensemble de paires : celles qui échouent et celles qui doivent rester conformes. */
function contraintesDe(paires) {
  const contraintes = [];
  for (const p of paires) {
    if (!p._fondBrut || p._fondBrut.a < 1 || p.ratio === null) continue;
    if (p.statut === 'a-verifier' && p.ratio < p.seuil) continue;
    contraintes.push(contrainteDe(p));
  }
  return contraintes;
}

function texteBrutDe(paire) {
  return paire._texteBrut || { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Vrai si, pour une des paires, le texte change de côté par rapport au fond (plus clair que le
 * fond avant, plus sombre après, ou l'inverse). C'est voulu, mais à valider visuellement.
 */
export function detecterInversion(paires, origine, couleur) {
  const alpha = origine.a ?? 1;
  return paires.some((p) => {
    if (!p._fondBrut || p._fondBrut.a < 1) return false;
    const fond = luminance(p._fondBrut);
    const avant = luminance(composer({ ...origine, a: alpha }, p._fondBrut)) - fond;
    const apres = luminance(composer({ ...couleur, a: alpha }, p._fondBrut)) - fond;
    return avant * apres < 0;
  });
}

/** Décrit les usages d'une variable qui empêchent de la modifier en place. */
export function decrireUsagesGenants(usages) {
  const descriptions = [];
  for (const u of usages) {
    if (u.propriete === 'color' && u.paire && u.paire.ratio !== null) continue;
    let d;
    if (u.propriete.startsWith('--')) d = `par la variable ${u.propriete}`;
    else if (u.propriete !== 'color') d = `comme ${u.propriete} dans ${u.selecteur}`;
    else if (u.fondInconnu) d = `par ${u.selecteur} (fond inconnu)`;
    else d = `par ${u.selecteur} (à vérifier)`;
    if (u.contexte !== ':root') d += ` [${u.contexte}]`;
    if (!descriptions.includes(d)) descriptions.push(d);
  }
  const affichees = descriptions.slice(0, 4);
  const reste = descriptions.length - affichees.length;
  return `aussi utilisée ${affichees.join(', ')}${reste > 0 ? ` et ${reste} autre(s) usage(s)` : ''}`;
}

/** Choisit un nom de variable dédiée qui n'existe encore nulle part. */
function nomDedie(nom, analyse) {
  const existants = new Set();
  for (const regle of analyse.regles)
    for (const d of regle.declarations) existants.add(d.propriete);
  let candidat = `${nom}-contraste`;
  for (let n = 2; existants.has(candidat); n++) candidat = `${nom}-contraste-${n}`;
  return candidat;
}

function entreePaire(paire) {
  return {
    id: paire.id,
    selecteur: paire.selecteur,
    contexte: paire.contexte,
    ratioAvant: paire.ratio === null ? null : Number(paire.ratio.toFixed(4)),
    ratioApres: null,
  };
}

function siteDefinition(definition) {
  return {
    fichier: normaliserChemin(definition.fichier),
    ligne: definition.ligne,
    variable: definition.nom,
    selecteur: definition.selecteur,
    contexte:
      definition.theme || definition.media
        ? `${definition.theme || ''}${definition.theme && definition.media ? ' ' : ''}${definition.media ? `@media ${definition.media}` : ''}`
        : ':root',
  };
}

/**
 * Construit le plan de correction d'une analyse. Retourne
 * { corrections, impossibles, modifications: Map<fichier, [{ debut, fin, texte }]>, avertissements }.
 */
export function planifier(analyse, sources) {
  const corrections = [];
  const impossibles = [];
  const avertissements = [];
  const modifications = new Map();
  const modifier = (fichier, debut, fin, texte) => {
    if (!modifications.has(fichier)) modifications.set(fichier, []);
    modifications.get(fichier).push({ debut, fin, texte });
  };
  const declarerImpossible = (paire, raison) => {
    const texte = texteBrutDe(paire);
    const fond = paire._fondBrut;
    const proposition = fond ? chercherFond(texte, fond, paire.seuil) : null;
    const entree = {
      mode: 'impossible',
      raison,
      site: {
        fichier: normaliserChemin(paire.fichier),
        ligne: paire.ligne,
        selecteur: paire.selecteur,
        contexte: paire.contexte,
      },
      avant: paire.texte.hex,
      apres: null,
      deltaE: null,
      paires: [entreePaire(paire)],
      fondActuel: fond ? versHex(fond) : null,
      fondPropose: proposition ? versHex(proposition.couleur) : null,
      fondDeltaE: proposition ? Number(proposition.deltaE.toFixed(1)) : null,
    };
    impossibles.push(entree);
    corrections.push(entree);
  };

  const echecs = analyse.paires.filter((p) => p.statut === 'echec');
  const sitesLitteraux = new Map();
  const sitesVariables = new Map();
  for (const paire of echecs) {
    const origine = paire._origineTexte;
    if (!origine) {
      declarerImpossible(paire, 'origine de la couleur de texte non localisée');
      continue;
    }
    if (origine.type === 'variable' && !origine.definition.locale) {
      const cle = `${origine.definition.portee}|${origine.nom}`;
      if (!sitesVariables.has(cle))
        sitesVariables.set(cle, { definition: origine.definition, nom: origine.nom, paires: [] });
      sitesVariables.get(cle).paires.push(paire);
    } else {
      const decl = origine.type === 'variable' ? origine.definition : paire._declColor;
      const debut =
        origine.type === 'variable' ? decl.debutValeur : decl.debutValeur + origine.debut;
      const fin = origine.type === 'variable' ? decl.finValeur : decl.debutValeur + origine.fin;
      const cle = `${decl.fichier}|${debut}|${fin}`;
      if (!sitesLitteraux.has(cle))
        sitesLitteraux.set(cle, {
          fichier: decl.fichier,
          debut,
          fin,
          ligne: decl.ligne,
          paires: [],
        });
      sitesLitteraux.get(cle).paires.push(paire);
    }
  }

  // Sites littéraux : la même portion de texte peut servir à plusieurs paires (plusieurs contextes).
  for (const site of sitesLitteraux.values()) {
    const source = sources.get(site.fichier);
    const texteAvant = source.slice(site.debut, site.fin);
    const memeSite = analyse.paires.filter((p) => {
      const o = p._origineTexte;
      if (!o) return false;
      const decl =
        o.type === 'variable' ? (o.definition.locale ? o.definition : null) : p._declColor;
      if (!decl) return false;
      const debut = o.type === 'variable' ? decl.debutValeur : decl.debutValeur + o.debut;
      return decl.fichier === site.fichier && debut === site.debut;
    });
    const origine = texteBrutDe(site.paires[0]);
    const format = analyserFormat(texteAvant);
    const trouve = chercherCouleurTexte(origine, contraintesDe(memeSite), format);
    if (!trouve) {
      for (const p of site.paires)
        declarerImpossible(p, 'ni le noir ni le blanc ne suffisent sur ce fond');
      continue;
    }
    modifier(site.fichier, site.debut, site.fin, trouve.texte);
    corrections.push({
      mode: 'litteral',
      site: {
        fichier: normaliserChemin(site.fichier),
        ligne: site.ligne,
        selecteur: site.paires[0].selecteur,
        contexte: site.paires[0].contexte,
      },
      avant: versHex(origine),
      apres: versHex(trouve.couleur),
      texteAvant,
      texteApres: trouve.texte,
      deltaE: Number(trouve.deltaE.toFixed(1)),
      inversion: detecterInversion(memeSite, origine, trouve.couleur),
      paires: memeSite.map(entreePaire),
    });
  }

  // Sites variables, regroupés par nom : une variable redéfinie dans un thème est un site distinct.
  const parNom = new Map();
  for (const site of sitesVariables.values()) {
    if (!parNom.has(site.nom)) parNom.set(site.nom, []);
    parNom.get(site.nom).push(site);
  }
  for (const [nom, sites] of parNom) {
    const dedies = [];
    for (const site of sites) {
      const usages = analyse.usages.get(`${site.definition.portee}|${nom}`) || [];
      const tousTexte = usages.every(
        (u) => u.propriete === 'color' && u.paire && u.paire.ratio !== null,
      );
      const pairesUsage = [...new Set(usages.map((u) => u.paire).filter(Boolean))];
      const texteAvant = site.definition.valeur;
      const origine = texteBrutDe(site.paires[0]);
      const format = analyserFormat(analyserCouleur(texteAvant) ? texteAvant : versHex(origine));
      const trouve = tousTexte
        ? chercherCouleurTexte(origine, contraintesDe(pairesUsage), format)
        : null;
      if (trouve) {
        modifier(
          site.definition.fichier,
          site.definition.declaration.debutValeur,
          site.definition.declaration.finValeur,
          trouve.texte,
        );
        corrections.push({
          mode: 'variable',
          site: siteDefinition(site.definition),
          avant: versHex(origine),
          apres: versHex(trouve.couleur),
          texteAvant,
          texteApres: trouve.texte,
          deltaE: Number(trouve.deltaE.toFixed(1)),
          inversion: detecterInversion(pairesUsage, origine, trouve.couleur),
          paires: pairesUsage.filter((p) => p.id).map(entreePaire),
          usages: usages.length,
        });
      } else {
        dedies.push({
          site,
          raison: tousTexte
            ? 'contraintes incompatibles entre les usages'
            : decrireUsagesGenants(usages),
        });
      }
    }
    if (!dedies.length) continue;

    // Variable dédiée : définie après chaque définition connue de la variable d'origine,
    // avec un littéral là où c'est nécessaire, `var(--nom)` ailleurs pour ne rien changer.
    const nouveau = nomDedie(nom, analyse);
    const remplacees = new Map();
    for (const { site } of dedies) {
      for (const p of site.paires)
        remplacees.set(`${p._declColor.fichier}|${p._declColor.debutValeur}`, p._declColor);
    }
    const definitionsDuNom = [];
    for (const carte of analyse.definitions.values())
      if (carte.has(nom)) definitionsDuNom.push(carte.get(nom));
    for (const definition of definitionsDuNom) {
      const usages = analyse.usages.get(`${definition.portee}|${nom}`) || [];
      const concernees = [
        ...new Set(
          usages
            .filter(
              (u) =>
                u.propriete === 'color' &&
                u.paire &&
                remplacees.has(`${u.declaration.fichier}|${u.declaration.debutValeur}`),
            )
            .map((u) => u.paire),
        ),
      ];
      const dedie = dedies.find((d) => d.site.definition === definition);
      let valeur = `var(${nom})`;
      let correction = null;
      if (dedie) {
        const origine = texteBrutDe(dedie.site.paires[0]);
        const texteAvant = definition.valeur;
        const format = analyserFormat(analyserCouleur(texteAvant) ? texteAvant : versHex(origine));
        const trouve = chercherCouleurTexte(origine, contraintesDe(concernees), format);
        if (trouve) {
          valeur = trouve.texte;
          correction = {
            mode: 'variable-dediee',
            variableDediee: nouveau,
            raison: dedie.raison,
            site: siteDefinition(definition),
            avant: versHex(origine),
            apres: versHex(trouve.couleur),
            texteAvant,
            texteApres: trouve.texte,
            deltaE: Number(trouve.deltaE.toFixed(1)),
            inversion: detecterInversion(concernees, origine, trouve.couleur),
            paires: concernees.filter((p) => p.id).map(entreePaire),
          };
          corrections.push(correction);
        } else {
          for (const p of dedie.site.paires)
            declarerImpossible(p, 'ni le noir ni le blanc ne suffisent sur ce fond');
        }
      }
      const decl = definition.declaration;
      const source = sources.get(decl.fichier);
      const finDeLigne = detecterFinDeLigne(source);
      const important = decl.important ? ' !important' : '';
      const prefixe = decl.indentation === null ? ' ' : finDeLigne + decl.indentation;
      // Sans « ; » final (dernière déclaration du bloc), la nouvelle déclaration hérite de ce style.
      const insertion = decl.pointVirgule ? decl.finDeclaration + 1 : decl.finDeclaration;
      const texte = `${prefixe}${nouveau}: ${valeur}${important}`;
      modifier(decl.fichier, insertion, insertion, decl.pointVirgule ? `${texte};` : `;${texte}`);
    }
    if (
      dedies.some((d) =>
        corrections.some((c) => c.mode === 'variable-dediee' && c.site.variable === nom),
      )
    ) {
      for (const decl of remplacees.values()) {
        modifier(
          decl.fichier,
          decl.debutValeur,
          decl.finValeur,
          renommerVariable(decl.valeur, nom, nouveau),
        );
      }
      avertissements.push(
        `Variable dédiée ${nouveau} créée : un thème défini dans un fichier non analysé qui redéfinit ${nom} ` +
          `doit aussi déclarer « ${nouveau}: var(${nom}); ».`,
      );
    } else {
      // Rien n'a pu être corrigé : on retire les insertions préparées pour cette variable.
      for (const definition of definitionsDuNom) {
        const liste = modifications.get(definition.declaration.fichier) || [];
        modifications.set(
          definition.declaration.fichier,
          liste.filter((m) => !(m.debut === m.fin && m.texte.includes(`${nouveau}:`))),
        );
      }
    }
  }

  return { corrections, impossibles, modifications, avertissements };
}

/** Applique des modifications par décalages (remplacements et insertions) à une source. */
export function appliquerModifications(source, modifications) {
  const triees = [...modifications].sort((a, b) => b.debut - a.debut || b.fin - a.fin);
  let resultat = source;
  let borne = Infinity;
  for (const m of triees) {
    if (m.fin > borne) throw new Error('modifications qui se chevauchent');
    resultat = resultat.slice(0, m.debut) + m.texte + resultat.slice(m.fin);
    borne = m.debut;
  }
  return resultat;
}

/**
 * Enchaîne analyse, plan, application en mémoire et nouvelle analyse.
 * `fichiers` : [{ chemin, source }]. Retourne { analyseAvant, plan, sourcesApres, analyseApres, rapport }.
 */
export function corriger(fichiers, options = {}) {
  const analyseAvant = analyser(fichiers, { niveau: options.niveau });
  const sources = new Map(fichiers.map((f) => [f.chemin, f.source]));
  const plan = planifier(analyseAvant, sources);
  const sourcesApres = new Map();
  for (const [chemin, source] of sources) {
    sourcesApres.set(chemin, appliquerModifications(source, plan.modifications.get(chemin) || []));
  }
  const analyseApres = analyser(
    fichiers.map((f) => ({ chemin: f.chemin, source: sourcesApres.get(f.chemin) })),
    { niveau: options.niveau },
  );
  const apres = new Map(analyseApres.paires.map((p) => [p.id, p]));
  for (const correction of plan.corrections) {
    for (const entree of correction.paires) {
      const p = apres.get(entree.id);
      entree.ratioApres = p && p.ratio !== null ? Number(p.ratio.toFixed(4)) : null;
      if (correction.mode !== 'impossible' && (!p || p.statut === 'echec')) {
        plan.avertissements.push(
          `${entree.selecteur} (${entree.contexte}) reste en échec après correction : à examiner.`,
        );
      }
    }
  }
  const rapport = construireRapport(analyseApres, {
    etiquette: options.etiquette || 'Après',
    corrections: plan.corrections,
  });
  return { analyseAvant, plan, sourcesApres, analyseApres, rapport };
}

// ---------------------------------------------------------------------------
// Ligne de commande
// ---------------------------------------------------------------------------

const AIDE = `corriger.mjs — correction minimale des contrastes WCAG d'un ou plusieurs fichiers CSS

Usage :
  node corriger.mjs <fichier.css>... [options]
  node corriger.mjs --aide

Options :
  --niveau AA|AAA       Niveau visé (AA par défaut).
  --ecrire              Applique les modifications aux fichiers. Sans cette option, seul le plan
                        est affiché ; le CSS n'est pas touché.
  --etiquette <nom>     Étiquette du rapport (« Après » par défaut).
  --sortie <rapport>    Écrit le rapport JSON de l'état corrigé (même format que « scan »,
                        avec la liste « corrections »), même sans --ecrire.
  --sans-couleur        Désactive les couleurs ANSI (comme la variable NO_COLOR).

Méthode :
  Pour chaque texte en échec, la couleur conforme la plus proche (ΔE OKLab) est cherchée en
  OKLCH : teinte conservée, luminosité déplacée dans les deux sens, chroma réduite seulement
  pour rester dans le gamut sRGB. Le résultat est revérifié après arrondi 8 bits et après
  sérialisation dans le format d'origine. Les fonds ne sont jamais modifiés.
  Site de correction : le littéral de la règle, ou la définition de la variable directement
  référencée. Une variable utilisée ailleurs (fond, bordure, autre propriété) ou aux contraintes
  incompatibles reçoit une variable dédiée « --nom-contraste », référencée uniquement par les
  règles en échec ; chaque autre contexte connu qui redéfinit la variable reçoit
  « --nom-contraste: var(--nom); ». Le résultat est idempotent.

Codes de sortie : 0 tout est (ou serait) conforme, 1 il reste des cas impossibles, 2 erreur.

Limites connues :
${LIMITES.map((l) => `  ${l}`).join('\n')}
  Les paires « à vérifier » (dégradés, filtres, ombres…) ne sont pas corrigées.
`;

const LIBELLES_MODE = {
  litteral: 'littéral',
  variable: 'variable',
  'variable-dediee': 'variable dédiée',
  impossible: 'impossible',
};

export function formaterPlan(resultat, options = {}) {
  const p = peindre(options.couleurs ?? false);
  const { plan, analyseAvant, rapport } = resultat;
  const lignes = [];
  const echecs = analyseAvant.paires.filter((x) => x.statut === 'echec').length;
  lignes.push(
    p.gras(
      `Plan de correction WCAG ${analyseAvant.niveau} — ${analyseAvant.fichiers.map(normaliserChemin).join(', ')}`,
    ),
  );
  if (!echecs) lignes.push('Aucun échec : rien à corriger.');
  let numero = 0;
  for (const c of plan.corrections) {
    if (c.mode === 'impossible') continue;
    numero++;
    const site = c.site.variable
      ? `${c.site.variable} (${c.site.contexte}, ${c.site.fichier}:${c.site.ligne})`
      : `${c.site.selecteur} (${c.site.contexte}, ${c.site.fichier}:${c.site.ligne})`;
    const mode =
      c.mode === 'variable-dediee'
        ? `${LIBELLES_MODE[c.mode]} ${c.variableDediee}`
        : LIBELLES_MODE[c.mode];
    lignes.push(
      `${String(numero).padStart(2)}. ${site} — ${p.gras(mode)}${c.raison ? ` (${c.raison})` : ''}`,
    );
    lignes.push(`    ${c.texteAvant} → ${p.vert(c.texteApres)}   ΔE ${c.deltaE.toFixed(1)}`);
    if (c.inversion) {
      lignes.push(`    ${p.jaune('Attention : inversion clair/sombre, à valider visuellement')}`);
    }
    for (const e of c.paires) {
      const avant = e.ratioAvant === null ? '—' : tronquer(e.ratioAvant);
      const apres = e.ratioApres === null ? '—' : tronquer(e.ratioApres);
      lignes.push(`      ${e.selecteur} [${e.contexte}]  ${avant} → ${apres}`);
    }
  }
  if (plan.impossibles.length) {
    lignes.push('', p.rouge('Impossible en ne modifiant que le texte :'));
    for (const c of plan.impossibles) {
      lignes.push(
        `  ${c.site.selecteur} [${c.site.contexte}]  ${c.site.fichier}:${c.site.ligne} — ${c.raison}`,
      );
      lignes.push(
        `      texte ${c.avant} sur fond ${c.fondActuel}, seuil ${analyseAvant.paires.find((x) => x.id === c.paires[0].id)?.seuil}` +
          (c.fondPropose
            ? ` ; fond conforme le plus proche pour ce texte : ${c.fondPropose} (ΔE ${c.fondDeltaE})`
            : ''),
      );
    }
  }
  for (const a of plan.avertissements) lignes.push('', p.jaune(`Attention : ${a}`));
  const r = rapport.resume;
  lignes.push(
    '',
    `Après correction : ${r.echecs ? p.rouge(`${r.echecs} échec(s)`) : p.vert('0 échec')}, ${r.conformes} conforme(s), ` +
      `${r.aVerifier} à vérifier (non traitées), ${r.fondInconnu} règle(s) au fond inconnu.`,
  );
  return lignes.join('\n');
}

export function executerCli(argv) {
  const sortie = {
    couleurs: couleursTerminal(),
    info: (t) => process.stdout.write(t + '\n'),
    erreur: (t) => process.stderr.write(t + '\n'),
  };
  let options;
  try {
    options = analyserArgumentsCli(argv);
  } catch (erreur) {
    sortie.erreur(`Erreur : ${erreur.message}`);
    return 2;
  }
  if (options.aide || !argv.length) {
    sortie.info(AIDE);
    return options.aide ? 0 : 2;
  }
  if (!options.fichiers.length) {
    sortie.erreur(
      'Usage : node corriger.mjs <fichier.css>... [--niveau AA|AAA] [--ecrire] [--sortie rapport.json]',
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
  const resultat = corriger(fichiers, { niveau: options.niveau, etiquette: options.etiquette });
  sortie.info(formaterPlan(resultat, { couleurs: sortie.couleurs && !options.sansCouleur }));
  const modifies = [...resultat.plan.modifications]
    .filter(([, liste]) => liste.length)
    .map(([chemin]) => chemin);
  if (options.ecrire) {
    try {
      for (const chemin of modifies)
        writeFileSync(chemin, resultat.sourcesApres.get(chemin), 'utf8');
    } catch (erreur) {
      sortie.erreur(`Erreur d'écriture : ${erreur.message}`);
      return 2;
    }
    sortie.info(
      modifies.length
        ? `Fichier(s) modifié(s) : ${modifies.join(', ')}`
        : 'Aucune modification à écrire.',
    );
  } else if (modifies.length) {
    sortie.info(
      `Aucun fichier modifié (relancez avec --ecrire pour appliquer : ${modifies.join(', ')}).`,
    );
  }
  if (options.sortie) {
    try {
      ecrireRapport(options.sortie, resultat.rapport);
      sortie.info(`Rapport de l'état corrigé écrit : ${options.sortie}`);
    } catch (erreur) {
      sortie.erreur(`Erreur d'écriture : ${erreur.message}`);
      return 2;
    }
  }
  return resultat.plan.impossibles.length ? 1 : 0;
}

const lanceDirectement =
  process.argv[1] && import.meta.url === pathToFileURL(resoudreChemin(process.argv[1])).href;
if (lanceDirectement) process.exitCode = executerCli(process.argv.slice(2));
