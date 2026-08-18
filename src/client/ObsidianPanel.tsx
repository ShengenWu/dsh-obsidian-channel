/**
 * Center-column Obsidian surface: chrome + a widget host.
 *
 * Chrome (header / bind / composer) is fixed. Everything else is a named
 * widget from home-catalog, toggled in Settings. Built-ins render here;
 * the reserved slot name for later injectors is `obsidian.home.widget`.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { enabledWidgetIds, HOME_WIDGETS } from '../home-catalog.js'
import { mergeHomeLayout, upsertHomeLayout } from '../home-layout.js'
import type { PanelController } from './controller.ts'
import { HomeBoard } from './HomeBoard.tsx'
import type { ObsidianKey } from './locales.ts'
import { NoteEditor } from './NoteEditor.tsx'

export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
export type RpcFn = (endpoint: string, payload?: unknown) => Promise<RpcResult<unknown>>

interface SurfaceNote {
  path: string
  title: string | null
  excerpt?: string
}

interface OpenNote {
  path: string
  createIfMissing?: boolean
  seed?: string
}

interface SurfaceChange {
  opId: string
  ts: number
  path: string
  kind: string
  status: string
}

interface SurfaceBroken {
  from: string
  target: string
}

interface DailyHabit {
  folder: string
  format: string
  source: string
  stamp: string
  todayRel: string | null
}

interface SurfaceOverview {
  vault: string
  widgets?: string[]
  noteCount?: number
  truncated?: boolean
  todayDate?: string
  todayRel?: string | null
  daily?: DailyHabit
  today?: SurfaceNote | null
  recent?: SurfaceNote[]
  changes?: SurfaceChange[]
  brokenCount?: number
  broken?: SurfaceBroken[]
  orphans?: string[]
  orphanCount?: number
  folders?: { name: string; count: number }[]
  tags?: { name: string; count: number }[]
  inbox?: SurfaceNote[]
}

interface DetectedVault {
  id: string
  path: string
  open: boolean
}

interface FullChange extends SurfaceChange {
  before: string | null
  after: string | null
}

interface HomeWidgetRow {
  id: string
  enabled: boolean
}

const KIND_KEYS: Record<string, ObsidianKey> = {
  create: 'history.created',
  update: 'history.updated',
  append: 'history.appended',
  delete: 'history.deleted',
  undo: 'history.undone',
  restore: 'history.restored',
  rollback: 'history.rolledBack',
  move: 'history.moved',
}

const DIFF_LINE_CAP = 200

const WIDGET_TITLE: Record<string, ObsidianKey> = {
  continue: 'home.widget.continue',
  changes: 'home.widget.changes',
  daily: 'home.widget.daily',
  search: 'home.widget.search',
  structure: 'home.widget.structure',
  inbox: 'home.widget.inbox',
  links: 'home.widget.links',
  actions: 'home.widget.actions',
}

function diffLines(a: string, b: string) {
  const al = a.split('\n').slice(0, DIFF_LINE_CAP)
  const bl = b.split('\n').slice(0, DIFF_LINE_CAP)
  const n = al.length
  const m = bl.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = al[i] === bl[j] ? (dp[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0)
    }
  }
  const rows: { kind: 'same' | 'add' | 'del'; text: string }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (al[i] === bl[j]) { rows.push({ kind: 'same', text: al[i] ?? '' }); i++; j++ }
    else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) { rows.push({ kind: 'del', text: al[i] ?? '' }); i++ }
    else { rows.push({ kind: 'add', text: bl[j] ?? '' }); j++ }
  }
  while (i < n) { rows.push({ kind: 'del', text: al[i] ?? '' }); i++ }
  while (j < m) { rows.push({ kind: 'add', text: bl[j] ?? '' }); j++ }
  return rows
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString()
}

function orderedHomeWidgets(rows: HomeWidgetRow[]) {
  const on = rows.filter((row) => row.enabled)
  const lead = ['continue', 'changes']
  const head = lead.flatMap((id) => on.filter((row) => row.id === id))
  const rest = on.filter((row) => !lead.includes(row.id))
  return [...head, ...rest]
}

function fileStem(path: string) {
  return (path.split('/').pop() ?? path).replace(/\.md$/i, '')
}

function NoteLine({ path, title }: { path: string; title: string | null }) {
  const name = title !== null && title.trim() !== '' ? title : fileStem(path)
  return (
    <div className="main">
      <span className="path">{name}</span>
      <span className="meta">{path}</span>
    </div>
  )
}

export interface ObsidianPanelProps {
  controller: PanelController
  rpc: RpcFn
  t: (key: ObsidianKey, params?: Record<string, unknown>) => string
  onTalk: (text: string, vaultDir?: string) => Promise<string | undefined>
}

export function ObsidianPanel({ controller, rpc, t, onTalk }: ObsidianPanelProps) {
  const [open, setOpen] = useState(controller.getSnapshot().panelOpen)
  useEffect(() => controller.subscribe(() => setOpen(controller.getSnapshot().panelOpen)), [controller])

  const [vaultDir, setVaultDir] = useState('')
  const [needBind, setNeedBind] = useState(false)
  const [homeWidgets, setHomeWidgets] = useState<HomeWidgetRow[]>(HOME_WIDGETS)
  const [overview, setOverview] = useState<SurfaceOverview | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [talkBusy, setTalkBusy] = useState(false)
  const [talkError, setTalkError] = useState<string | null>(null)
  const [detected, setDetected] = useState<DetectedVault[]>([])
  const [openNote, setOpenNote] = useState<OpenNote | null>(null)
  const [homeLayout, setHomeLayout] = useState(() => mergeHomeLayout([]))

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    const cfg = await rpc('config/get')
    if (!cfg.ok) {
      setStatus('error')
      setError(cfg.error.message)
      return
    }
    const value = cfg.value as { vaultDir?: string; homeWidgets?: HomeWidgetRow[]; homeLayout?: unknown[] }
    const dir = String(value.vaultDir ?? '').trim()
    const widgets = Array.isArray(value.homeWidgets) ? value.homeWidgets : HOME_WIDGETS
    setVaultDir(dir)
    setHomeWidgets(widgets)
    setHomeLayout(mergeHomeLayout(value.homeLayout))
    if (dir === '') {
      setNeedBind(true)
      setOverview(null)
      setStatus('ready')
      const found = await rpc('vault/detect')
      if (found.ok) setDetected(((found.value as { vaults?: DetectedVault[] }).vaults ?? []))
      return
    }
    setNeedBind(false)
    const ids = enabledWidgetIds(widgets)
    const res = await rpc('surface/overview', { widgets: ids })
    if (!res.ok) {
      setStatus('error')
      setError(res.error.message)
      return
    }
    setOverview(res.value as SurfaceOverview)
    setStatus('ready')
  }, [rpc])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const bind = async (path: string) => {
    const dir = path.trim()
    if (dir === '') return
    const res = await rpc('config/set', { field: 'vaultDir', value: dir })
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    await load()
  }

  const pickVault = async () => {
    setError(null)
    const res = await rpc('vault/pick')
    if (!res.ok) {
      setError(t('config.vaultPickFailed', { error: res.error.message }))
      return
    }
    const path = String((res.value as { path?: string }).path ?? '').trim()
    if (path !== '') await bind(path)
  }

  const talk = async (text: string) => {
    const prompt = text.trim()
    if (prompt === '') return
    setTalkBusy(true)
    setTalkError(null)
    const err = await onTalk(prompt, vaultDir || undefined)
    setTalkBusy(false)
    if (err !== undefined) {
      setTalkError(err)
      return
    }
    setDraft('')
    controller.close()
  }

  const enabled = orderedHomeWidgets(homeWidgets)

  if (!open) return null

  return (
    <div className="ob-surface" data-dsh-obsidian-board="">
      <header className="ob-head">
        <div>
          <p className="ob-kicker">{t('dash.kicker')}</p>
          <h2 className="ob-title">{t('panel.title')}</h2>
          <p className="ob-sub">{needBind ? t('panel.unbound') : (overview?.vault ?? vaultDir)}</p>
        </div>
        <div className="ob-actions">
          <button type="button" className="ob-btn" onClick={() => { void load() }} disabled={status === 'loading'}>
            {t('history.refresh')}
          </button>
          <button type="button" className="ob-btn" onClick={() => controller.close()}>
            {t('panel.close')}
          </button>
        </div>
      </header>

      <div className="ob-body">
        {status === 'loading' && <div className="ob-hint">{t('config.loading')}</div>}
        {error !== null && <div className="ob-msg err">{error}</div>}

        {needBind && (
          <Card span2 title={t('panel.bindHeading')}>
            <button type="button" className="ob-btn primary" onClick={() => { void pickVault() }}>{t('config.vaultPick')}</button>
            {detected.length > 0 && (
              <>
                <div className="ob-hint wrap">{t('home.detectHint')}</div>
                {detected.map((vault) => (
                  <div key={vault.id} className="ob-row" onClick={() => { void bind(vault.path) }}>
                    <div className="main">
                      <span className="path">{vault.path}</span>
                      {vault.open && <span className="meta">{t('home.detectOpen')}</span>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </Card>
        )}

        {overview !== null && !needBind && (
          <HomeBoard
            ids={enabled.map((row) => row.id)}
            saved={homeLayout}
            t={t}
            onCommit={(next) => {
              const full = upsertHomeLayout(homeLayout, next)
              setHomeLayout(full)
              void rpc('config/set', { field: 'homeLayout', value: full })
            }}
            renderTile={(id) => (
              <WidgetCard
                id={id}
                overview={overview}
                rpc={rpc}
                t={t}
                enabledIds={enabled.map((item) => item.id)}
                onRefresh={() => { void load() }}
                onFill={(text) => setDraft(text)}
                onOpenNote={(path, opts) => setOpenNote({ path, ...opts })}
                onAskAgent={(text) => { void talk(text) }}
                askBusy={talkBusy}
              />
            )}
          />
        )}
      </div>

      {!needBind && (
        <form
          className="ob-composer"
          onSubmit={(ev) => { ev.preventDefault(); void talk(draft) }}
        >
          <textarea
            className="ob-area"
            rows={2}
            value={draft}
            placeholder={t('panel.composerPlaceholder')}
            onChange={(ev) => setDraft(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
                ev.preventDefault()
                void talk(draft)
              }
            }}
          />
          <button type="submit" className="ob-btn primary" disabled={talkBusy || draft.trim() === ''}>
            {t('panel.send')}
          </button>
        </form>
      )}
      {talkError !== null && <div className="ob-msg err">{talkError}</div>}
      {openNote !== null && (
        <NoteEditor
          path={openNote.path}
          createIfMissing={openNote.createIfMissing === true}
          seed={openNote.seed}
          rpc={rpc}
          t={t}
          onClose={() => setOpenNote(null)}
          onSaved={() => { void load() }}
        />
      )}
    </div>
  )
}

interface WidgetCardProps {
  id: string
  overview: SurfaceOverview
  rpc: RpcFn
  t: ObsidianPanelProps['t']
  enabledIds: string[]
  onRefresh: () => void
  onFill: (text: string) => void
  onOpenNote: (path: string, opts?: { createIfMissing?: boolean; seed?: string }) => void
  onAskAgent: (text: string) => void
  askBusy: boolean
}

function Card({
  id,
  title,
  count,
  span2,
  action,
  children,
}: {
  id?: string
  title: string
  count?: string
  span2?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={'ob-card' + (span2 ? ' span2' : '') + (action !== undefined ? ' has-agent' : '')} data-home-widget={id}>
      <div className="ob-card-h">
        <span>{title}</span>
        <div className="ob-card-h-right">
          {count !== undefined && <span className="ob-count">{count}</span>}
          {action}
        </div>
      </div>
      <div className="ob-card-body">{children}</div>
    </section>
  )
}

function WidgetCard({ id, overview, rpc, t, enabledIds, onRefresh, onFill, onOpenNote, onAskAgent, askBusy }: WidgetCardProps) {
  const titleKey = WIDGET_TITLE[id]
  const title = titleKey !== undefined ? t(titleKey) : id
  if (id === 'continue') {
    return <ContinueWidget overview={overview} t={t} title={title} onOpenNote={onOpenNote} />
  }
  if (id === 'changes') {
    return <ChangesWidget overview={overview} rpc={rpc} t={t} title={title} onRefresh={onRefresh} />
  }
  if (id === 'daily') {
    return (
      <DailyWidget
        overview={overview}
        t={t}
        title={title}
        onOpenNote={onOpenNote}
        onAskAgent={onAskAgent}
        askBusy={askBusy}
      />
    )
  }
  if (id === 'links') {
    return <LinksWidget overview={overview} t={t} title={title} onOpenNote={onOpenNote} />
  }
  if (id === 'search') {
    return <SearchWidget rpc={rpc} t={t} title={title} onOpenNote={onOpenNote} />
  }
  if (id === 'structure') {
    return <StructureWidget overview={overview} t={t} title={title} onOpenNote={onOpenNote} />
  }
  if (id === 'inbox') {
    return <InboxWidget overview={overview} t={t} title={title} onOpenNote={onOpenNote} />
  }
  if (id === 'actions') {
    return <ActionsWidget enabledIds={enabledIds} overview={overview} t={t} title={title} onFill={onFill} />
  }
  return (
    <Card id={id} title={title}>
      <div className="ob-hint wrap">{t('home.reserved')}</div>
    </Card>
  )
}

function ContinueWidget({ overview, t, title, onOpenNote }: { overview: SurfaceOverview; t: ObsidianPanelProps['t']; title: string; onOpenNote: (path: string) => void }) {
  const recent = overview.recent ?? []
  return (
    <Card id="continue" title={title} count={t('panel.noteCount', { n: String(overview.noteCount ?? recent.length) })}>
      {recent.length === 0 && <div className="ob-hint wrap">{t('panel.recentEmpty')}</div>}
      {recent.map((note) => (
        <div
          key={note.path}
          className="ob-row"
          onClick={() => onOpenNote(note.path)}
        >
          <NoteLine path={note.path} title={note.title} />
        </div>
      ))}
    </Card>
  )
}

function DailyWidget({ overview, t, title, onOpenNote, onAskAgent, askBusy }: {
  overview: SurfaceOverview
  t: ObsidianPanelProps['t']
  title: string
  onOpenNote: (path: string, opts?: { createIfMissing?: boolean; seed?: string }) => void
  onAskAgent: (text: string) => void
  askBusy: boolean
}) {
  const daily = overview.daily

  if (daily === undefined || daily.source === 'none' || daily.todayRel === null) {
    return (
      <Card id="daily" title={title}>
        <div className="ob-hint wrap">{t('home.dailyNone')}</div>
      </Card>
    )
  }

  const path = daily.todayRel
  const missing = overview.today === null
  const prompt = missing
    ? t('panel.prompt.todayMissing', { date: overview.todayDate ?? daily.stamp, path })
    : t('panel.prompt.dailyWork', { date: overview.todayDate ?? daily.stamp, path })

  return (
    <Card
      id="daily"
      title={title}
      action={(
        <button
          type="button"
          className="ob-card-agent"
          disabled={askBusy}
          aria-label={t('home.daily.ask')}
          onClick={() => onAskAgent(prompt)}
        >
          {t('home.daily.ask')}
        </button>
      )}
    >
      <button
        type="button"
        className="ob-daily-hit"
        onClick={() => onOpenNote(path, {
          createIfMissing: missing,
          seed: missing ? '# ' + (daily.stamp ?? '') + '\n\n' : undefined,
        })}
      >
        {missing ? (
          <>
            <span className="ob-daily-date">{daily.stamp}</span>
            <span className="ob-hint wrap">{path}</span>
          </>
        ) : (
          <>
            <NoteLine path={overview.today!.path} title={overview.today!.title} />
            {overview.today?.excerpt !== undefined && overview.today.excerpt !== '' && (
              <span className="ob-hint wrap">{overview.today.excerpt}</span>
            )}
          </>
        )}
      </button>
    </Card>
  )
}

function ChangesWidget({ overview, rpc, t, title, onRefresh }: { overview: SurfaceOverview; rpc: RpcFn; t: ObsidianPanelProps['t']; title: string; onRefresh: () => void }) {
  const changes = overview.changes ?? []
  const [selected, setSelected] = useState<FullChange | null>(null)
  const [rollbackBusy, setRollbackBusy] = useState(false)
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null)

  const openChange = async (opId: string) => {
    const res = await rpc('history/entry', { opId })
    if (res.ok) setSelected(res.value as FullChange)
    else setRollbackMsg(res.error.message)
  }

  const rollback = async () => {
    if (selected === null || rollbackBusy) return
    if (!window.confirm(t('history.rollbackConfirm', { path: selected.path }))) return
    setRollbackBusy(true)
    setRollbackMsg(null)
    const res = await rpc('history/rollback', { opId: selected.opId })
    setRollbackBusy(false)
    if (!res.ok) {
      setRollbackMsg(res.error.message)
      return
    }
    setSelected(null)
    onRefresh()
  }

  return (
    <Card id="changes" title={title} count={t('panel.changeCount', { n: String(changes.length) })}>
      {changes.length === 0 && <div className="ob-hint wrap">{t('history.empty')}</div>}
      {changes.map((entry) => (
        <div key={entry.opId} className="ob-row" onClick={() => { void openChange(entry.opId) }}>
          <div className="main">
            <span className="path">{entry.path}</span>
            <span className="meta">{fmtTime(entry.ts)}</span>
          </div>
          <span className="ob-badge">{t(KIND_KEYS[entry.kind] ?? ('history.' + entry.kind as ObsidianKey))}</span>
        </div>
      ))}
      {selected !== null && <ChangeDetail entry={selected} t={t} />}
      {selected !== null && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="ob-btn primary" disabled={rollbackBusy} onClick={() => { void rollback() }}>
            {t('history.rollback')}
          </button>
          <button type="button" className="ob-btn" onClick={() => setSelected(null)}>{t('history.closeDetail')}</button>
          {rollbackMsg !== null && <span className="ob-msg err">{rollbackMsg}</span>}
        </div>
      )}
    </Card>
  )
}

function LinksWidget({ overview, t, title, onOpenNote }: { overview: SurfaceOverview; t: ObsidianPanelProps['t']; title: string; onOpenNote: (path: string) => void }) {
  const broken = overview.broken ?? []
  const count = overview.brokenCount ?? broken.length
  const orphans = overview.orphans ?? []
  return (
    <Card id="links" title={title} count={String(count)}>
      <div className="ob-hint wrap">{t('home.linksHint')}</div>
      {count === 0 && <div className="ob-hint wrap">{t('panel.brokenNone')}</div>}
      {broken.map((link, i) => (
        <div key={link.from + '->' + link.target + i} className="ob-row" onClick={() => onOpenNote(link.from)}>
          <div className="main">
            <span className="path">[[{link.target}]]</span>
            <span className="meta">{link.from}</span>
          </div>
        </div>
      ))}
      {orphans.length > 0 && (
        <>
          <div className="ob-hint wrap">{t('home.orphans')} · {overview.orphanCount ?? orphans.length}</div>
          {orphans.map((path) => (
            <div key={path} className="ob-row" onClick={() => onOpenNote(path)}>
              <div className="main"><span className="path">{path}</span></div>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}

function SearchWidget({ rpc, t, title, onOpenNote }: { rpc: RpcFn; t: ObsidianPanelProps['t']; title: string; onOpenNote: (path: string) => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<{ path: string; title: string; snippet: string; tags: string[] }[] | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    const q = query.trim()
    if (q === '') {
      setHits(null)
      return
    }
    setBusy(true)
    const res = await rpc('surface/search', { query: q, limit: 20 })
    setBusy(false)
    if (res.ok) setHits((res.value as { matches?: typeof hits }).matches ?? [])
    else setHits([])
  }

  return (
    <Card id="search" title={title}>
      <div className="ob-search">
        <input
          className="ob-input"
          value={query}
          placeholder={t('home.searchPlaceholder')}
          onChange={(ev) => setQuery(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); void run() } }}
        />
        <button type="button" className="ob-btn" disabled={busy} onClick={() => { void run() }}>{t('home.searchRun')}</button>
      </div>
      {hits === null && <div className="ob-hint wrap">{t('home.searchEmpty')}</div>}
      {hits !== null && hits.length === 0 && <div className="ob-hint wrap">{t('home.searchNone')}</div>}
      {(hits ?? []).map((hit) => (
        <div key={hit.path} className="ob-row" onClick={() => onOpenNote(hit.path)}>
          <div className="main">
            <span className="path">{hit.title || fileStem(hit.path)}</span>
            <span className="meta">{hit.snippet || hit.path}</span>
          </div>
        </div>
      ))}
    </Card>
  )
}

function StructureWidget({ overview, t, title, onOpenNote }: { overview: SurfaceOverview; t: ObsidianPanelProps['t']; title: string; onOpenNote: (path: string) => void }) {
  const folders = overview.folders ?? []
  const tags = overview.tags ?? []
  const orphans = overview.orphans ?? []
  return (
    <Card id="structure" title={title} count={t('panel.noteCount', { n: String(overview.noteCount ?? 0) })}>
      {folders.length > 0 && (
        <>
          <div className="ob-hint wrap">{t('home.folders')}</div>
          {folders.map((folder) => (
            <div key={folder.name} className="ob-row static">
              <div className="main"><span className="path">{folder.name}</span></div>
              <span className="ob-badge">{folder.count}</span>
            </div>
          ))}
        </>
      )}
      {tags.length > 0 && (
        <>
          <div className="ob-hint wrap">{t('home.tags')}</div>
          {tags.map((tag) => (
            <div key={tag.name} className="ob-row static">
              <div className="main"><span className="path">#{tag.name}</span></div>
              <span className="ob-badge">{tag.count}</span>
            </div>
          ))}
        </>
      )}
      {orphans.length > 0 && (
        <>
          <div className="ob-hint wrap">{t('home.orphans')} · {overview.orphanCount ?? orphans.length}</div>
          {orphans.map((path) => (
            <div key={path} className="ob-row" onClick={() => onOpenNote(path)}>
              <div className="main"><span className="path">{path}</span></div>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}

function InboxWidget({ overview, t, title, onOpenNote }: { overview: SurfaceOverview; t: ObsidianPanelProps['t']; title: string; onOpenNote: (path: string) => void }) {
  const inbox = overview.inbox ?? []
  return (
    <Card id="inbox" title={title} count={String(inbox.length)}>
      {inbox.length === 0 && <div className="ob-hint wrap">{t('home.inboxEmpty')}</div>}
      {inbox.map((note) => (
        <div key={note.path} className="ob-row" onClick={() => onOpenNote(note.path)}>
          <NoteLine path={note.path} title={note.title} />
        </div>
      ))}
    </Card>
  )
}

function ActionsWidget({ enabledIds, overview, t, title, onFill }: {
  enabledIds: string[]
  overview: SurfaceOverview
  t: ObsidianPanelProps['t']
  title: string
  onFill: (text: string) => void
}) {
  const chips: { key: string; label: string; text: string }[] = []
  if (enabledIds.includes('daily') && overview.daily?.source !== 'none' && overview.daily?.todayRel) {
    chips.push({
      key: 'daily',
      label: t('dash.action.daily'),
      text: t('panel.prompt.dailyWork', { date: overview.todayDate ?? '', path: overview.daily.todayRel }),
    })
  }
  if (enabledIds.includes('structure')) {
    chips.push({ key: 'structure', label: t('home.action.structure'), text: t('home.action.structure') })
  }
  if (enabledIds.includes('links')) {
    chips.push({ key: 'links', label: t('dash.action.broken'), text: t('panel.prompt.brokenSweep') })
  }
  if (enabledIds.includes('search')) {
    chips.push({ key: 'search', label: t('home.widget.search'), text: t('home.action.search') })
  }
  return (
    <Card id="actions" title={title}>
      {chips.length === 0 && <div className="ob-hint wrap">{t('home.actionsEmpty')}</div>}
      <div className="ob-quick">
        {chips.map((chip) => (
          <button type="button" key={chip.key} className="ob-chip" onClick={() => onFill(chip.text)}>{chip.label}</button>
        ))}
      </div>
    </Card>
  )
}

function ChangeDetail({ entry, t }: { entry: FullChange; t: ObsidianPanelProps['t'] }) {
  const rows = useMemo(
    () => diffLines(entry.before ?? '', entry.after ?? ''),
    [entry.before, entry.after],
  )
  return (
    <div className="ob-diff">
      <div className="pane">
        <div className="col">
          <div className="pane-head">{t('history.before')}</div>
          {rows.map((row, i) => (
            row.kind !== 'add' ? <div key={i} className={row.kind === 'del' ? 'del' : undefined}>{row.text || ' '}</div> : null
          ))}
        </div>
        <div className="col">
          <div className="pane-head">{t('history.after')}</div>
          {rows.map((row, i) => (
            row.kind !== 'del' ? <div key={i} className={row.kind === 'add' ? 'add' : undefined}>{row.text || ' '}</div> : null
          ))}
        </div>
      </div>
    </div>
  )
}
