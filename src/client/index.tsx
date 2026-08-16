/**
 * dsh-obsidian-channel — browser half:
 *   - registers the 'settings.section' page (Settings -> Obsidian) hosting the
 *     vault config fields and the change-history panel, both through the
 *     host's /obsidian connection RPC channel. 【DSH 尚未适配】配置不走官方
 *     settingsScope：DSH host-apiproxy 的 settings.describe 白名单不暴露第三方
 *     namespace，待 DSH 支持第三方 namespace 暴露后应改回 settingsScope。
 *   - mounts a sidebar entry that toggles a center-column Obsidian surface
 *     (today / recent / changes / broken links / composer). Clicking does not
 *     create a workspace.
 *   - registers the 'dsh-obsidian-channel' locale dictionaries.
 *
 * Discovered by dsh-client-modules via package.json dsh.client +
 * exports[\"./client\"], bundled to lib/client.js by tsdown.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { PanelController } from './controller.ts'
import { mountObsidianEntry } from './entry.ts'
import { NS, zh, en, type ObsidianKey } from './locales.ts'
import { ObsidianSettingsSection } from './ObsidianSection.tsx'
import { mountObsidianPanel } from './panel-mount.tsx'
import { handoffToAgent } from './talk.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-obsidian-channel': ObsidianKey
  }
}

/** Required client services: slots, workspaces/sessions (talk handoff), locale, connection RPC. */
export const inject = ['slots', 'workspaces', 'sessions', 'locale', 'connection', 'conversation']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-obsidian: dictionaries')
  const t = ctx.locale.bind(NS)

  const controller = new PanelController()
  const rpc = (endpoint: string, payload?: unknown) =>
    ctx.connection.rpc.call('/obsidian', endpoint, payload ?? null)

  ctx.effect(() => {
    const disposers: Array<() => void> = []
    try {
      disposers.push(mountObsidianEntry(controller))
      disposers.push(mountObsidianPanel({
        controller,
        rpc,
        t,
        onTalk: (text, vaultDir) => handoffToAgent(ctx, text, vaultDir),
      }))
    } catch (error) {
      console.error('[dsh-obsidian-channel] mount failed:', error)
    }
    return () => {
      for (const dispose of disposers.splice(0)) dispose()
    }
  }, 'dsh-obsidian: sidebar + surface')

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'dsh-obsidian-channel',
      order: 100,
      label: () => t('nav.label'),
      locale: NS,
      inject: () => ({ rpc }),
    },
    ObsidianSettingsSection,
  ))
}
