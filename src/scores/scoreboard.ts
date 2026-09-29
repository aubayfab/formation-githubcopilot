/**
 * Écran du tableau des scores : tri, filtre par jeu, pagination et partage.
 */

import type { Son } from '../shell/cabinet';
import type { Action } from '../shell/input';
import { gamesPlayed, hiscore, lastPlayer } from '../legacy/scoreStore.v1';
import { versCsv } from './partage';
import { lireScores, type Score } from './scoreStore';

export const TAILLE_PAGE = 10;

const FILTRES = [{ jeu: '' }, { jeu: 'snake' }, { jeu: '2048' }] as const;

export interface OptionsTableau {
  jouerSon(son: Son): void;
  /** Nom affiché d'un jeu, à partir de son identifiant. */
  nomDuJeu(id: string): string;
  surRetour(): void;
}

export interface Tableau {
  gerer(action: Action): void;
  fermer(): void;
}

export function trierScores(scores: readonly Score[]): Score[] {
  return [...scores].sort((a, b) => b.points - a.points || a.date.localeCompare(b.date));
}

export function compterPages(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

function formaterPoints(points: number): string {
  return String(points).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`;
}

export function rendreLignes(
  scores: readonly Score[],
  page: number,
  size: number,
  nomDuJeu: (id: string) => string,
  joueur = '',
): string {
  if (scores.length === 0) {
    return '<tr><td class="tableau__vide" colspan="5">Aucun score pour l’instant</td></tr>';
  }

  return trierScores(scores)
    .slice(0, 10)
    .map((score, index) => {
      const rang = index + 1;
      const classes = [
        'tableau__ligne',
        rang <= 3 ? `tableau__ligne--podium-${rang}` : '',
        joueur && score.pseudo === joueur ? 'est-joueur' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return `
        <tr class="${classes}" style="--delai: ${index * 40}ms">
          <td class="tableau__rang">${String(rang).padStart(2, '0')}</td>
          <td class="tableau__pseudo">${score.pseudo}</td>
          <td class="tableau__jeu">${nomDuJeu(score.jeu)}</td>
          <td class="tableau__points">${formaterPoints(score.points)}</td>
          <td class="tableau__date">${formatDate(score.date)}</td>
        </tr>`;
    })
    .join('');
}

function telecharger(contenu: string, nom: string): void {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
}

export function ouvrirTableau(conteneur: HTMLElement, options: OptionsTableau): Tableau {
  let page = 1;
  let filtre = 0;
  let minuterie = 0;

  const racine = document.createElement('section');
  racine.className = 'vue tableau';
  racine.innerHTML = `
    <h2 class="tableau__titre">Meilleurs scores</h2>
    <nav class="tableau__filtres">
      ${FILTRES.map(
        (f, rang) =>
          `<button type="button" tabindex="-1" class="tableau__filtre" data-filtre="${rang}">${f.jeu ? options.nomDuJeu(f.jeu) : 'Tous'}</button>`,
      ).join('')}
    </nav>
    <div class="tableau__cadre">
      <table class="tableau__grille">
        <colgroup>
          <col class="col-rang" /><col class="col-pseudo" /><col class="col-jeu" />
          <col class="col-points" /><col class="col-date" />
        </colgroup>
        <thead>
          <tr><th>Rang</th><th>Pseudo</th><th>Jeu</th><th class="tableau__points">Points</th><th>Date</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <footer class="tableau__pied">
      <div class="pagination">
        <button type="button" tabindex="-1" class="pagination__bouton" data-sens="-1" aria-label="Page précédente">◀</button>
        <span class="pagination__page"></span>
        <button type="button" tabindex="-1" class="pagination__bouton" data-sens="1" aria-label="Page suivante">▶</button>
      </div>
      <dl class="tableau__bilan"></dl>
      <button type="button" tabindex="-1" class="bouton--partage">Entrée · Partager</button>
    </footer>
    <p class="tableau__toast" role="status"></p>
    <p class="menu__aide">←→ Page · ↑↓ Jeu · Entrée Partager · Échap Retour</p>`;
  conteneur.append(racine);

  const corps = racine.querySelector('tbody') as HTMLTableSectionElement;
  const indicateur = racine.querySelector('.pagination__page') as HTMLElement;
  const bilan = racine.querySelector('.tableau__bilan') as HTMLElement;
  const toast = racine.querySelector('.tableau__toast') as HTMLElement;
  const [precedent, suivant] = racine.querySelectorAll<HTMLButtonElement>('.pagination__bouton');
  const filtres = [...racine.querySelectorAll<HTMLButtonElement>('.tableau__filtre')];

  function scoresFiltres(): Score[] {
    const { jeu } = FILTRES[filtre];
    return lireScores().filter((score) => !jeu || score.jeu === jeu);
  }

  function rafraichir(): void {
    const scores = scoresFiltres();
    const pages = compterPages(scores.length, TAILLE_PAGE);
    page = Math.min(page, pages);

    corps.innerHTML = rendreLignes(scores, page, TAILLE_PAGE, options.nomDuJeu, lastPlayer());
    indicateur.textContent = `Page ${page}/${pages}`;
    precedent.disabled = page <= 1;
    suivant.disabled = page >= pages;
    filtres.forEach((bouton, rang) => bouton.classList.toggle('est-actif', rang === filtre));

    bilan.innerHTML = `
      <div><dt>${options.nomDuJeu('snake')}</dt><dd>${pluriel(gamesPlayed('snake'), 'partie')} · ${formaterPoints(hiscore('snake'))}</dd></div>
      <div><dt>${options.nomDuJeu('2048')}</dt><dd>${pluriel(gamesPlayed('2048'), 'partie')} · ${formaterPoints(hiscore('2048'))}</dd></div>`;
  }

  function appuyer(bouton: HTMLElement): void {
    bouton.classList.remove('est-appuye');
    void bouton.offsetWidth;
    bouton.classList.add('est-appuye');
  }

  function changerPage(sens: number): void {
    const pages = compterPages(scoresFiltres().length, TAILLE_PAGE);
    const cible = page + sens;
    if (cible < 1 || cible > pages) return;

    page = cible;
    appuyer(sens < 0 ? precedent : suivant);
    appuyer(indicateur);
    options.jouerSon('deplacement');
    rafraichir();
  }

  function changerFiltre(sens: number): void {
    filtre = (filtre + sens + FILTRES.length) % FILTRES.length;
    page = 1;
    options.jouerSon('deplacement');
    rafraichir();
  }

  function annoncer(message: string): void {
    toast.textContent = message;
    toast.classList.remove('est-visible');
    void toast.offsetWidth;
    toast.classList.add('est-visible');
    clearTimeout(minuterie);
    minuterie = window.setTimeout(() => toast.classList.remove('est-visible'), 2200);
  }

  async function partager(): Promise<void> {
    const contenu = versCsv(trierScores(scoresFiltres()));
    options.jouerSon('validation');
    try {
      await navigator.clipboard.writeText(contenu);
      annoncer('Scores copiés dans le presse-papiers');
    } catch {
      telecharger(contenu, 'arcade-scores.csv');
      annoncer('Scores téléchargés');
    }
  }

  precedent.addEventListener('click', () => changerPage(-1));
  suivant.addEventListener('click', () => changerPage(1));
  racine.querySelector('.bouton--partage')?.addEventListener('click', () => void partager());
  filtres.forEach((bouton, rang) =>
    bouton.addEventListener('click', () => changerFiltre(rang - filtre)),
  );

  rafraichir();

  return {
    gerer(action) {
      switch (action) {
        case 'gauche':
          changerPage(-1);
          break;
        case 'droite':
          changerPage(1);
          break;
        case 'haut':
          changerFiltre(-1);
          break;
        case 'bas':
          changerFiltre(1);
          break;
        case 'valider':
          void partager();
          break;
        case 'retour':
          options.jouerSon('retour');
          options.surRetour();
          break;
      }
    },
    fermer() {
      clearTimeout(minuterie);
      racine.remove();
    },
  };
}
