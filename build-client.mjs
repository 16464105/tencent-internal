/**
 * esbuild bundler for the Web client half.
 *
 * Produces `lib/client.js` as a `window.__ModuleLoader__.load({ id, factory })`
 * module — the format the shell's module loader fetches per plugin row. The
 * static modules the shell shares into the module table (react, cordis, slots)
 * stay external. CSS Modules are inlined as a style tag plus a class map.
 */
import { build } from 'esbuild'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8'))

const externals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

function cssModulesPlugin(packageName) {
  return {
    name: 'css-modules-inline',
    setup(api) {
      api.onLoad({ filter: /\.module\.css$/ }, (args) => {
        const css = readFileSync(args.path, 'utf8')
        const names = [...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(match => match[1])
        const classMap = Object.fromEntries(names.map(name => [name, name]))
        const tagId = `${packageName}/${basename(args.path)}`
        return {
          loader: 'js',
          contents: [
            `const css = ${JSON.stringify(css)};`,
            `const tagId = ${JSON.stringify(tagId)};`,
            'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
            '  const tag = document.createElement(\'style\');',
            `  tag.dataset.plugin = ${JSON.stringify(packageName)};`,
            '  tag.dataset.pluginCss = tagId;',
            '  tag.textContent = css;',
            '  document.head.appendChild(tag);',
            '}',
            `export default ${JSON.stringify(classMap)};`,
          ].join('\n'),
        }
      })
    },
  }
}

await build({
  entryPoints: [resolve(here, 'src/client/index.ts')],
  bundle: true,
  format: 'cjs',
  banner: {
    js: `window.__ModuleLoader__.load({\n\tid: ${JSON.stringify(pkg.name)},\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;\n\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });`,
  },
  footer: {
    js: `\n\t\treturn module.exports;\n\t}\n});`,
  },
  external: externals,
  plugins: [cssModulesPlugin(pkg.name)],
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  outfile: resolve(here, 'lib/client.js'),
  sourcemap: true,
  logLevel: 'info',
})
