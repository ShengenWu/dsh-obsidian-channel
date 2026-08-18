/**
 * Homepage widget catalog.
 *
 * The surface is a host: chrome (header / bind / composer) is fixed, everything
 * else is a named widget the user can toggle. Built-ins register here with a
 * default enabled flag. Unknown saved ids are ignored so later modules can be
 * added without breaking old config.
 *
 * Future third-party widgets are expected to use the same { id, enabled }
 * record and the client slot name `obsidian.home.widget`.
 */

export const HOME_WIDGETS = [
  { id: 'continue', enabled: true },
  { id: 'changes', enabled: true },
  { id: 'daily', enabled: false },
  { id: 'search', enabled: false },
  { id: 'structure', enabled: false },
  { id: 'inbox', enabled: false },
  { id: 'links', enabled: false },
  { id: 'actions', enabled: false },
]

export const HOME_WIDGET_IDS = HOME_WIDGETS.map((item) => item.id)

const KNOWN = new Set(HOME_WIDGET_IDS)

/** Widgets that need a vault walk (or more) when enabled. */
export const HOME_WIDGETS_NEED_WALK = new Set(['continue', 'daily', 'links', 'structure', 'inbox'])

export function mergeHomeWidgets(saved) {
  const byId = new Map()
  if (Array.isArray(saved)) {
    for (const row of saved) {
      if (row === null || typeof row !== 'object') continue
      const id = typeof row.id === 'string' ? row.id : ''
      if (!KNOWN.has(id)) continue
      byId.set(id, row.enabled === true)
    }
  }
  return HOME_WIDGETS.map((item) => ({
    id: item.id,
    enabled: byId.has(item.id) ? byId.get(item.id) : item.enabled,
  }))
}

export function enabledWidgetIds(saved) {
  return mergeHomeWidgets(saved).filter((item) => item.enabled).map((item) => item.id)
}

/** Accept either ['continue', 'changes'] or [{ id, enabled }]. Empty / missing → defaults. */
export function resolveWidgetIds(input) {
  if (!Array.isArray(input) || input.length === 0) return enabledWidgetIds()
  if (typeof input[0] === 'string') {
    const wanted = input.filter((id) => typeof id === 'string' && KNOWN.has(id))
    return wanted.length > 0 ? wanted : enabledWidgetIds()
  }
  return enabledWidgetIds(input)
}
