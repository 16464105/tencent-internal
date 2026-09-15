import { defineConfig } from 'tsdown'

/**
 * Consumer-side build for git installs (the `prepare` script): transpile
 * straight from src without tsc project references, which need a sibling
 * harness checkout that only the originating monorepo has. Types are not
 * checked here.
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/invariant.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  tsconfig: 'tsconfig.prepare.json',
  external: [/^@deepseek-ai\//, /^node:/],
})
