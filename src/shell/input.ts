/**
 * Clavier de l'arcade : les flèches, Entrée et Échap sont traduites en actions.
 * Les boutons cliquables du pupitre passent par `emettre` et suivent le même chemin.
 */

export type Action = 'haut' | 'bas' | 'gauche' | 'droite' | 'valider' | 'retour';

type EcouteurAction = (action: Action) => void;
type EcouteurEtat = (action: Action, enfoncee: boolean) => void;
type EcouteurSaisie = (touche: string) => void;

const TOUCHES: Readonly<Record<string, Action>> = {
  ArrowUp: 'haut',
  ArrowDown: 'bas',
  ArrowLeft: 'gauche',
  ArrowRight: 'droite',
  Enter: 'valider',
  NumpadEnter: 'valider',
  Escape: 'retour',
};

const ecouteursAction = new Set<EcouteurAction>();
const ecouteursEtat = new Set<EcouteurEtat>();
const ecouteursSaisie = new Set<EcouteurSaisie>();

let demarre = false;

function abonner<T>(ensemble: Set<T>, ecouteur: T): () => void {
  ensemble.add(ecouteur);
  return () => ensemble.delete(ecouteur);
}

/** Actions de jeu. Renvoie la fonction de désabonnement. */
export function ecouterActions(ecouteur: EcouteurAction): () => void {
  return abonner(ecouteursAction, ecouteur);
}

/** Appui et relâchement, pour animer la manette et les boutons du pupitre. */
export function ecouterEtat(ecouteur: EcouteurEtat): () => void {
  return abonner(ecouteursEtat, ecouteur);
}

/** Caractères imprimables et retour arrière, pour la saisie d'un pseudo. */
export function ecouterSaisie(ecouteur: EcouteurSaisie): () => void {
  return abonner(ecouteursSaisie, ecouteur);
}

export function emettre(action: Action): void {
  for (const ecouteur of ecouteursAction) ecouteur(action);
}

export function signalerEtat(action: Action, enfoncee: boolean): void {
  for (const ecouteur of ecouteursEtat) ecouteur(action, enfoncee);
}

function surToucheEnfoncee(evenement: KeyboardEvent): void {
  if (evenement.metaKey || evenement.altKey) return;

  const action = TOUCHES[evenement.key];
  if (action) {
    evenement.preventDefault();
    signalerEtat(action, true);
    const repetable = action !== 'valider' && action !== 'retour';
    if (!evenement.repeat || repetable) emettre(action);
    return;
  }

  if (evenement.key.length === 1 || evenement.key === 'Backspace') {
    if (ecouteursSaisie.size > 0) evenement.preventDefault();
    for (const ecouteur of ecouteursSaisie) ecouteur(evenement.key);
  }
}

function surToucheRelachee(evenement: KeyboardEvent): void {
  const action = TOUCHES[evenement.key];
  if (action) signalerEtat(action, false);
}

export function demarrerClavier(cible: Window = window): void {
  if (demarre) return;
  demarre = true;
  cible.addEventListener('keydown', surToucheEnfoncee);
  cible.addEventListener('keyup', surToucheRelachee);
}
