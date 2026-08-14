/**
 * dsh-obsidian-channel — client half build (host half is plain ESM, no build).
 *
 * Produces lib/client.js in the official dual-face bundle contract:
 * CJS body wrapped in window.__ModuleLoader__.load({ id, factory }), with
 * react/react-dom/@deepseek-ai/dsh-client-* external (provided by the shell).
 */
export default [
  {
    name: 'dsh-obsidian-channel/client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    jsx: 'automatic',
    external: [/@deepseek-ai\/dsh-client-/, '@deepseek-ai/cordis', 'react', 'react-dom', 'react/jsx-runtime'],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-obsidian-channel", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
