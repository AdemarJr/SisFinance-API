/**
 * Compila a API para dist/index.js (esbuild — deploy Railway).
 */
import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  external: ['pg', 'pg-native'],
  logLevel: 'info',
});

console.log('✓ dist/index.js');
