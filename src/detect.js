/**
 * Discover local Obsidian vaults from the desktop app's obsidian.json.
 */

export function obsidianConfigPaths(home, platform, appData) {
  if (platform === 'darwin') return [home + '/Library/Application Support/obsidian/obsidian.json']
  if (platform === 'win32') {
    const roaming = typeof appData === 'string' && appData !== '' ? appData : home + '/AppData/Roaming'
    return [roaming + '/obsidian/obsidian.json']
  }
  return [home + '/.config/obsidian/obsidian.json']
}

export function parseObsidianVaults(jsonText) {
  let data
  try { data = JSON.parse(jsonText) } catch { return [] }
  const vaults = data?.vaults
  if (vaults === null || typeof vaults !== 'object' || Array.isArray(vaults)) return []
  const out = []
  for (const [id, raw] of Object.entries(vaults)) {
    if (raw === null || typeof raw !== 'object') continue
    const path = typeof raw.path === 'string' ? raw.path.trim() : ''
    if (path === '') continue
    out.push({
      id: String(id),
      path,
      open: raw.open === true,
      ts: typeof raw.ts === 'number' ? raw.ts : 0,
    })
  }
  out.sort((a, b) => Number(b.open) - Number(a.open) || b.ts - a.ts || a.path.localeCompare(b.path))
  return out
}

export async function detectObsidianVaults(deps = {}) {
  const os = deps.os ?? await import('node:os')
  const fsp = deps.fs ?? await import('node:fs/promises')
  const home = typeof deps.homedir === 'string' ? deps.homedir : os.homedir()
  const platform = typeof deps.platform === 'string' ? deps.platform : process.platform
  const appData = deps.appData ?? process.env.APPDATA
  const readFile = deps.readFile ?? ((p) => fsp.readFile(p, 'utf8'))
  for (const file of obsidianConfigPaths(home, platform, appData)) {
    try {
      return parseObsidianVaults(await readFile(file))
    } catch {
      continue
    }
  }
  return []
}
