/**
 * Thème de l'arcade : sobre par défaut, néon en option.
 * Le thème est porté par `data-theme` sur `<html>` et mémorisé dans le `localStorage`.
 */

export type Theme = 'sobre' | 'neon';

type EcouteurTheme = (theme: Theme) => void;

const CLE_THEME = 'arcade:theme';

/** Facteur de ralentissement des mouvements et animations des jeux en thème sobre. */
export const LENTEUR_SOBRE = 10;

const THEMES: Readonly<Record<Theme, { libelle: string; couleur: string; icone: string }>> = {
  sobre: {
    libelle: 'Sobre',
    couleur: '#f4f5f7',
    icone:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%23394150'/%3E%3Crect x='3' y='4' width='10' height='8' rx='1' fill='%23c9ced6'/%3E%3C/svg%3E",
  },
  neon: {
    libelle: 'Néon',
    couleur: '#07030f',
    icone:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%2307030f'/%3E%3Crect x='3' y='3' width='10' height='7' rx='1' fill='%2300f0ff'/%3E%3Ccircle cx='5' cy='12.5' r='1.3' fill='%23ff2e97'/%3E%3Ccircle cx='11' cy='12.5' r='1.3' fill='%23ffe14d'/%3E%3C/svg%3E",
  },
};

/** Polices pixel du thème néon, chargées seulement quand il est actif. */
const POLICES_NEON =
  'https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=VT323&family=Monoton&display=swap';

const ecouteurs = new Set<EcouteurTheme>();

export function themeActif(): Theme {
  return document.documentElement.dataset.theme === 'neon' ? 'neon' : 'sobre';
}

function lireTheme(): Theme {
  try {
    return localStorage.getItem(CLE_THEME) === 'neon' ? 'neon' : 'sobre';
  } catch {
    return 'sobre';
  }
}

function enregistrerTheme(theme: Theme): void {
  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch {
    // Stockage indisponible : le thème ne durera que le temps de la session.
  }
}

function brancherPolices(theme: Theme): void {
  const existant = document.querySelector('link[data-polices-neon]');
  if (theme === 'sobre') {
    existant?.remove();
    return;
  }
  if (existant) return;
  const lien = document.createElement('link');
  lien.rel = 'stylesheet';
  lien.href = POLICES_NEON;
  lien.dataset.policesNeon = '';
  document.head.append(lien);
}

function appliquerTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEMES[theme].couleur);
  document.querySelector('link[rel="icon"]')?.setAttribute('href', THEMES[theme].icone);
  brancherPolices(theme);
}

/** Applique le thème mémorisé. À appeler avant de construire l'arcade. */
export function demarrerTheme(): void {
  appliquerTheme(lireTheme());
}

export function changerTheme(theme: Theme): void {
  if (theme === themeActif()) return;
  appliquerTheme(theme);
  enregistrerTheme(theme);
  for (const ecouteur of ecouteurs) ecouteur(theme);
}

/** Changements de thème. Renvoie la fonction de désabonnement. */
export function ecouterTheme(ecouteur: EcouteurTheme): () => void {
  ecouteurs.add(ecouteur);
  return () => ecouteurs.delete(ecouteur);
}

type Filtre<T> = (valeur: T) => T;

/** Fait passer une propriété du contexte par `filtre` tant que le thème sobre est actif. */
function intercepter<T>(ctx: CanvasRenderingContext2D, propriete: string, filtre: Filtre<T>): void {
  const descripteur = Object.getOwnPropertyDescriptor(
    CanvasRenderingContext2D.prototype,
    propriete,
  );
  if (!descripteur?.get || !descripteur.set) return;
  const { get, set } = descripteur;
  Object.defineProperty(ctx, propriete, {
    configurable: true,
    get: () => get.call(ctx),
    set: (valeur: T) => set.call(ctx, themeActif() === 'sobre' ? filtre(valeur) : valeur),
  });
}

const SATURATION_MAX = 25;

/** Ramène les couleurs `hsl()` vives, comme l'arc-en-ciel de la tuile 2048, à des tons neutres. */
function desaturer(couleur: string | CanvasGradient | CanvasPattern) {
  if (typeof couleur !== 'string') return couleur;
  return couleur.replace(
    /^(hsla?\(\s*[\d.]+(?:deg)?\s*,\s*)([\d.]+)%/,
    (_, debut: string, saturation: string) =>
      `${debut}${Math.min(Number(saturation), SATURATION_MAX)}%`,
  );
}

/** En thème sobre : ni halo ni couleur criarde sur le canvas, sans toucher au code des jeux. */
export function adoucirCanvas(ctx: CanvasRenderingContext2D): void {
  intercepter<number>(ctx, 'shadowBlur', () => 0);
  intercepter(ctx, 'fillStyle', desaturer);
  intercepter(ctx, 'strokeStyle', desaturer);
}

/** Sélecteur flottant, en haut à droite de la page. */
export function installerBascule(racine: HTMLElement): void {
  const groupe = document.createElement('div');
  groupe.className = 'bascule-theme';
  groupe.setAttribute('role', 'group');
  groupe.setAttribute('aria-label', 'Thème');

  const boutons = (Object.keys(THEMES) as Theme[]).map((theme) => {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.tabIndex = -1;
    bouton.className = 'bascule-theme__option';
    bouton.textContent = THEMES[theme].libelle;
    bouton.addEventListener('click', () => changerTheme(theme));
    return { theme, bouton };
  });

  const rafraichir = () => {
    for (const { theme, bouton } of boutons) {
      bouton.setAttribute('aria-pressed', String(theme === themeActif()));
    }
  };

  groupe.append(...boutons.map(({ bouton }) => bouton));
  racine.append(groupe);
  rafraichir();
  ecouterTheme(rafraichir);
}
