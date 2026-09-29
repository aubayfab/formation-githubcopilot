import { enregistrerJeu, nomDuJeu, type ContexteJeu } from '../../shell/menu';

const ID = 'casse-briques';

const RANGEES = ['--neon-rouge', '--neon-orange', '--neon-jaune', '--neon-vert', '--neon-cyan'];

function lancer(contexte: ContexteJeu): () => void {
  const { ctx, largeur, hauteur } = contexte;
  const fond = contexte.couleur('--ecran-fond');
  const texte = contexte.couleur('--texte-discret');
  const accent = contexte.couleur('--neon-jaune');
  const nom = nomDuJeu(ID).toUpperCase();
  const briques = RANGEES.map((variable) => contexte.couleur(variable));
  const { lenteur } = contexte;
  let image = 0;

  function dessiner(instant: number): void {
    ctx.save();
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, largeur, hauteur);

    briques.forEach((couleur, rangee) => {
      for (let colonne = 0; colonne < 10; colonne++) {
        const lueur = 0.35 + 0.25 * Math.sin(instant / (400 * lenteur) + colonne * 0.6 + rangee);
        ctx.globalAlpha = lueur;
        ctx.fillStyle = couleur;
        ctx.fillRect(24 + colonne * 60, 40 + rangee * 26, 52, 18);
      }
    });
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.font = '18px "Silkscreen", monospace';
    ctx.fillStyle = texte;
    ctx.fillText(nom, largeur / 2, 250);

    if (Math.floor(instant / (600 * lenteur)) % 2 === 0) {
      ctx.font = 'bold 64px "Silkscreen", monospace';
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 20;
      ctx.fillText('BIENTÔT', largeur / 2, 320);
      ctx.shadowBlur = 0;
    }

    ctx.font = '15px "Silkscreen", monospace';
    ctx.fillStyle = texte;
    ctx.fillText('ÉCHAP : RETOUR AU MENU', largeur / 2, 420);
    ctx.restore();

    image = requestAnimationFrame(dessiner);
  }

  contexte.surAction(() => contexte.jouerSon('retour'));
  image = requestAnimationFrame(dessiner);

  return () => cancelAnimationFrame(image);
}

enregistrerJeu({
  id: ID,
  accroche: 'Cassez le mur, gardez la balle.',
  teinte: '--neon-orange',
  icone: [
    '.........',
    '###.###.#',
    '.........',
    '#.###.###',
    '.........',
    '.....@...',
    '.........',
    '..#####..',
    '.........',
  ],
  lancer,
});
