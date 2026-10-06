# Rendre un test déterministe

Exemples écrits et vérifiés pour Vitest 4. Chaque fichier de test qui utilise l'un de ces mécanismes remet tout en place après chaque test :

```ts
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
```

## Le temps

`setTimeout`, `setInterval` et `Date` se pilotent avec les faux timers :

```ts
vi.useFakeTimers();
const tic = vi.fn();
setInterval(tic, 100);
vi.advanceTimersByTime(350);
expect(tic).toHaveBeenCalledTimes(3);
```

Date et heure figées : `vi.setSystemTime(new Date(2026, 0, 1, 12))` après `vi.useFakeTimers()`.

Promesse qui attend un délai (`await new Promise((r) => setTimeout(r, 1200))`) : lancez la fonction sans l'attendre, avancez le temps avec `await vi.advanceTimersByTimeAsync(1200)`, puis attendez la promesse.

### requestAnimationFrame

Avec `environment: 'node'`, **`requestAnimationFrame` n'existe pas**, même sous faux timers, même en le demandant dans `toFake`. Fournissez-le, adossé à `setTimeout` pour que les faux timers le pilotent :

```ts
vi.useFakeTimers();
vi.stubGlobal('requestAnimationFrame', (rappel: FrameRequestCallback) => setTimeout(() => rappel(performance.now()), 16));
vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

lancerBoucle();
vi.advanceTimersByTime(16 * 3); // trois images
```

Là où `requestAnimationFrame` existe (navigateur, environnement DOM), `vi.advanceTimersToNextFrame()` exécute sous faux timers les rappels de la prochaine image.

Mieux encore : sortez la logique de la boucle d'animation (une fonction `tick(etat)` pure) et testez-la sans timer du tout.

## Le hasard

Le plus robuste : la fonction reçoit son générateur en paramètre, avec `Math.random` pour valeur par défaut, et le test lui passe une suite fixe :

```ts
// code : export function placerTuile(grille: Grille, aleatoire: () => number = Math.random)
const suite = [0, 0.5, 0.99];
placerTuile(grille, () => suite.shift() ?? 0);
```

Si le code appelle `Math.random` directement :

```ts
vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99);
```

Un test qui passe dans la suite complète mais échoue lancé seul (ou l'inverse) dépend presque toujours du hasard ou d'un état partagé entre tests.

## Le stockage

Avec `environment: 'node'`, ni `localStorage` ni `window` n'existent. Fournissez un stockage en mémoire :

```ts
function stockageEnMemoire(): Storage {
  const donnees = new Map<string, string>();
  return {
    getItem: (cle) => donnees.get(cle) ?? null,
    setItem: (cle, valeur) => void donnees.set(cle, String(valeur)),
    removeItem: (cle) => void donnees.delete(cle),
    clear: () => donnees.clear(),
    key: (index) => [...donnees.keys()][index] ?? null,
    get length() {
      return donnees.size;
    },
  };
}

vi.stubGlobal('localStorage', stockageEnMemoire());
// Code qui écrit window.localStorage :
vi.stubGlobal('window', { localStorage: globalThis.localStorage });
```

Un stockage neuf à chaque test (dans `beforeEach`) : sinon l'ordre des tests change leur résultat.

Pour tester la résistance à un stockage corrompu, écrivez-y directement une valeur invalide (`localStorage.setItem(cle, '{pas du json')`), puis appelez la fonction de lecture.

## Le DOM et le Canvas

- Un fichier qui a besoin du DOM le déclare en première ligne, sans toucher à la configuration globale : `// @vitest-environment jsdom` (le paquet `jsdom` doit être installé ; sinon, demandez avant de l'ajouter).
- jsdom n'implémente pas le Canvas : `getContext('2d')` renvoie `null`. Testez le rendu avec un faux contexte qui enregistre les appels, et vérifiez les appels plutôt que des pixels :

```ts
const ctx = { fillStyle: '', fillRect: vi.fn(), clearRect: vi.fn(), fillText: vi.fn() };
dessiner(ctx as unknown as CanvasRenderingContext2D, etat);
expect(ctx.fillRect).toHaveBeenCalledWith(40, 20, 20, 20);
```

- Clavier : en jsdom, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))` ; en `node`, appelez directement la fonction qui traite la touche.

## Les cas en série

```ts
it.each([
  { entree: [2, 2, 0, 0], attendu: [4, 0, 0, 0] },
  { entree: [2, 2, 2, 2], attendu: [4, 4, 0, 0] },
])('fusionne $entree en $attendu', ({ entree, attendu }) => {
  expect(fusionnerLigne(entree)).toEqual(attendu);
});
```

## Les erreurs

```ts
expect(() => lireScore('')).toThrow('pseudo vide');
await expect(charger('inconnu')).rejects.toThrow(/introuvable/);
```
