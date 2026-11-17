// Neon Bay entrypoint: copies game/ and screenshots/ from beside this file
// into MAKEFUN_OUTPUT_DIR (or /output) and writes /output/dossier.json with
// buildDossier from vendor/makefun-game.ts. Node standard library only.
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  throw new Error(`neon-bay-6: no game/ directory beside main.ts (${gameDir})`);
}
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
  throw new Error(`neon-bay-6: no screenshots/ directory beside main.ts (${shotsDir})`);
}

// Start from a clean output directory so stale files never leak into an entry.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`neon-bay-6: wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
