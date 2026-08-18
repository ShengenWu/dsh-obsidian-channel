/**
 * Sync the bundled Obsidian agent preset into ~/.dsh/.agent-presets
 * so the mode picker can list it (same discovery root as user presets).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const OBSIDIAN_PRESET_ID = 'obsidian'

export function dshHome() {
  const override = process.env.DSH_HOME
  if (typeof override === 'string' && override.trim() !== '') return override
  return join(homedir(), '.dsh')
}

export function bundledPresetDir() {
  return fileURLToPath(new URL('../presets/obsidian/', import.meta.url))
}

export function syncObsidianPreset() {
  const source = bundledPresetDir()
  if (!existsSync(join(source, 'agent.cordis.yml'))) {
    throw new Error('bundled Obsidian preset is missing agent.cordis.yml')
  }
  const root = join(dshHome(), '.agent-presets')
  const dest = join(root, OBSIDIAN_PRESET_ID)
  mkdirSync(root, { recursive: true })
  if (presetUnchanged(source, dest)) return dest
  rmSync(dest, { recursive: true, force: true })
  cpSync(source, dest, { recursive: true })
  return dest
}

function presetUnchanged(source, dest) {
  for (const name of ['agent.cordis.yml', 'preset.yml']) {
    const a = join(source, name)
    const b = join(dest, name)
    if (!existsSync(a) || !existsSync(b)) return false
    try {
      if (readFileSync(a, 'utf8') !== readFileSync(b, 'utf8')) return false
    } catch {
      return false
    }
  }
  return true
}
