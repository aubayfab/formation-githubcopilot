// Records, compteurs et dernier joueur de l'arcade.
// Une clé localStorage par information, préfixée par "arcade_".

export type Entry = { name: string; points: number };

const PREFIX = 'arcade_';
const MAX_ENTRIES = 20;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch (e) {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch (e) {}
}

function readNumber(key: string): number {
  var value = parseInt(read(key) || '0', 10);
  return isNaN(value) ? 0 : value;
}

export function hiscore(game: string): number {
  return readNumber('hiscore_' + game);
}

export function hiscoreHolder(game: string): string {
  return read('hiscore_' + game + '_name') || '---';
}

export function setHiscore(game: string, points: number, name?: string): boolean {
  if (points <= hiscore(game)) return false;
  write('hiscore_' + game, String(points));
  if (name) write('hiscore_' + game + '_name', name);
  return true;
}

export function lastScore(game: string): number {
  return readNumber('last_' + game);
}

export function setLastScore(game: string, points: number) {
  write('last_' + game, String(points));
}

export function gamesPlayed(game: string): number {
  return readNumber('plays_' + game);
}

export function countGame(game: string): number {
  var plays = gamesPlayed(game) + 1;
  write('plays_' + game, String(plays));
  return plays;
}

export function totalPoints(game: string): number {
  return readNumber('total_' + game);
}

export function addPoints(game: string, points: number): number {
  var total = totalPoints(game) + points;
  write('total_' + game, String(total));
  return total;
}

export function bestTile(game: string): number {
  return readNumber('tile_' + game);
}

export function setBestTile(game: string, value: number) {
  if (value > bestTile(game)) write('tile_' + game, String(value));
}

export function lastPlayer(): string {
  return read('player') || '';
}

export function rememberPlayer(name: string) {
  write('player', name);
}

export function entries(game: string): Entry[] {
  var raw = read('table_' + game);
  if (!raw) return [];
  return raw.split('|').map(function (item) {
    var cut = item.lastIndexOf(':');
    return { name: item.substring(0, cut), points: parseInt(item.substring(cut + 1), 10) || 0 };
  });
}

export function addEntry(game: string, name: string, points: number) {
  var list = entries(game);
  list.push({ name: name, points: points });
  list.sort(function (a, b) {
    return b.points - a.points;
  });
  write(
    'table_' + game,
    list
      .slice(0, MAX_ENTRIES)
      .map(function (e) {
        return e.name + ':' + e.points;
      })
      .join('|'),
  );
}
