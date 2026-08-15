/**
 * dsh-obsidian-channel — browser half:
 *   - registers the 'settings.section' page (Settings -> Obsidian) hosting the
 *     vault config fields and the change-history panel, both through the
 *     host's /obsidian connection RPC channel. 【DSH 尚未适配】配置不走官方
 *     settingsScope：DSH host-apiproxy 的 settings.describe 白名单不暴露第三方
 *     namespace，待 DSH 支持第三方 namespace 暴露后应改回 settingsScope。
 *   - mounts a 📓 Obsidian sidebar entry (DOM injection, no dependency on the
 *     web-ui group) that makes the vault a DSH workspace and opens a session in
 *     it — the vault's safety layer (journal + rollback) stays underwater.
 *   - registers the 'dsh-obsidian-channel' locale dictionaries.
 *
 * Discovered by dsh-client-modules via package.json dsh.client +
 * exports[\"./client\"], bundled to lib/client.js by tsdown.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { ObsidianSettingsSection } from './ObsidianSection.tsx'
import { mountObsidianEntry } from './entry.ts'
import { NS, zh, en, type ObsidianKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-obsidian-channel': ObsidianKey
  }
}

/** Required client services: slots registry, workspaces (vault workspace), locale, connection RPC. */
export const inject = ['slots', 'workspaces', 'locale', 'connection']

/** Sidebar entry styles (plain CSS, injected once; mirrors the shell nav-item look). */
const ENTRY_STYLE = [
  '[data-dsh-obsidian-entry]{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;border-radius:6px;background:transparent;border:1px solid transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px}',
  '[data-dsh-obsidian-entry]:hover{background:var(--dsw-specific-sidebar-nav-item-hover,rgba(128,128,140,.12))}',
  '[data-dsh-obsidian-entry] .entryIcon{display:inline-flex;align-items:center;color:var(--dsw-alias-text-accent,#a78bfa)}',
  '[data-dsh-obsidian-entry] .entryLabel{flex:1;text-align:left}',
].join('\n')

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-obsidian: dictionaries')
  const t = ctx.locale.bind(NS)

  // Sidebar entry: inject once, self-heal on re-renders, dispose on unload.
  let styleSeated = false
  ctx.effect(() => {
    if (!styleSeated) {
      styleSeated = true
      const style = document.createElement('style')
      style.id = 'dsh-obsidian-entry-style'
      style.textContent = ENTRY_STYLE
      document.head.appendChild(style)
    }
    return mountObsidianEntry(ctx)
  }, 'dsh-obsidian: sidebar entry')

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'dsh-obsidian-channel',
      order: 100,
      label: () => t('nav.label'),
      locale: NS,
      inject: () => ({
        rpc: (endpoint: string, payload?: unknown) =>
          ctx.connection.rpc.call('/obsidian', endpoint, payload ?? null),
      }),
    },
    ObsidianSettingsSection,
  ))
}
