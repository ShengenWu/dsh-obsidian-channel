/**
 * dsh-obsidian-channel — browser half (M2):
 *   - registers the 'settings.section' page (Settings -> Obsidian) hosting the
 *     vault config fields (settingsScope) and the change-history panel (the
 *     host's /obsidian connection RPC channel);
 *   - registers the 'dsh-obsidian-channel' locale dictionaries.
 *
 * Discovered by dsh-client-modules via package.json dsh.client +
 * exports[\"./client\"], bundled to lib/client.js by tsdown.
 */
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { ObsidianSettingsSection } from './ObsidianSection.tsx'
import { NS, zh, en, type ObsidianKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-obsidian-channel': ObsidianKey
  }
}

/** Plugin config shape mirrored from the host Config (client view). */
interface ObsidianConfig {
  vaultDir?: string
  writePolicy?: 'per-write' | 'per-turn' | 'auto'
  excludes?: string[]
  journalRetentionDays?: number
}

/** Required client services: slots registry, settings scope binder, locale, connection RPC. */
export const inject = ['slots', 'settingsScope', 'locale', 'connection']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-obsidian: dictionaries')
  const t = ctx.locale.bind(NS)

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
        scope: ctx.settingsScope.bind<ObsidianConfig>({ namespace: NS }) as SettingsScope<ObsidianConfig>,
      }),
    },
    ObsidianSettingsSection,
  ))
}
