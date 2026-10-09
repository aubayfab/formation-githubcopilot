import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Fichier lu et écrit par le serveur MCP « mcp-scores ». */
const FICHIER_SCORES = fileURLToPath(new URL('./mcp-scores/scores.json', import.meta.url));

/** Score au format de la borne (voir src/scores/scoreStore.ts). */
interface ScoreBorne {
  jeu: string;
  pseudo: string;
  points: number;
  date: string;
  dureeMs: number;
}

/** Score au format du serveur MCP : `joueur` et `score` au lieu de `pseudo` et `points`. */
interface ScoreMcp {
  jeu: string;
  joueur: string;
  score: number;
  date: string;
  dureeMs?: number;
}

function estScoreBorne(valeur: unknown): valeur is ScoreBorne {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const score = valeur as Record<string, unknown>;
  return (
    typeof score.jeu === 'string' &&
    typeof score.pseudo === 'string' &&
    typeof score.points === 'number' &&
    typeof score.date === 'string'
  );
}

async function lireFichier(): Promise<ScoreMcp[]> {
  try {
    // Le BOM est retiré : le fichier peut avoir été enregistré à la main sous Windows.
    const donnees: unknown = JSON.parse((await readFile(FICHIER_SCORES, 'utf8')).replace(/^﻿/, ''));
    return Array.isArray(donnees) ? donnees : [];
  } catch {
    return [];
  }
}

async function ecrireFichier(scores: ScoreMcp[]): Promise<void> {
  // Fichier temporaire puis remplacement, comme le serveur MCP : jamais de scores.json à moitié écrit.
  const temporaire = `${FICHIER_SCORES}.tmp`;
  await writeFile(temporaire, JSON.stringify(scores, null, 2), 'utf8');
  await rename(temporaire, FICHIER_SCORES);
}

async function lireCorps(req: IncomingMessage): Promise<unknown> {
  let corps = '';
  for await (const morceau of req) corps += morceau;
  return JSON.parse(corps);
}

function repondre(res: ServerResponse, statut: number, donnees: unknown): void {
  res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(donnees));
}

/**
 * Expose `/api/scores` sur le serveur de dev, pour que la borne partage ses scores avec le
 * serveur MCP via mcp-scores/scores.json. GET renvoie les scores du fichier, POST y ajoute
 * un score ou une liste de scores.
 */
function scoresMcp(): Plugin {
  // Les écritures sont enchaînées pour ne jamais perdre un score entre lecture et écriture.
  let file: Promise<unknown> = Promise.resolve();

  return {
    name: 'arcade-scores-mcp',
    configureServer(server) {
      server.middlewares.use('/api/scores', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const scores: ScoreBorne[] = (await lireFichier()).map((s) => ({
              jeu: s.jeu,
              pseudo: s.joueur,
              points: s.score,
              date: s.date,
              dureeMs: s.dureeMs ?? 0,
            }));
            repondre(res, 200, scores);
          } else if (req.method === 'POST') {
            if (!existsSync(dirname(FICHIER_SCORES))) {
              // Serveur MCP pas encore créé : rien à partager, et aucune erreur dans la console.
              res.writeHead(204).end();
              return;
            }
            const corps = await lireCorps(req);
            const recus = Array.isArray(corps) ? corps : [corps];
            if (!recus.every(estScoreBorne)) {
              repondre(res, 400, { erreur: 'Score invalide.' });
              return;
            }
            const nouveaux: ScoreMcp[] = recus.map((s) => ({
              jeu: s.jeu,
              joueur: s.pseudo,
              score: s.points,
              date: s.date,
              dureeMs: s.dureeMs,
            }));
            const ecriture = file.then(async () =>
              ecrireFichier([...(await lireFichier()), ...nouveaux]),
            );
            file = ecriture.catch(() => {});
            await ecriture;
            repondre(res, 201, { ajoutes: nouveaux.length });
          } else {
            repondre(res, 405, { erreur: 'Méthode non autorisée.' });
          }
        } catch {
          repondre(res, 500, { erreur: 'Lecture ou écriture de scores.json impossible.' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [scoresMcp()],
  server: {
    open: true,
    host: '127.0.0.1'
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
