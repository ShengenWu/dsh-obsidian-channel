/**
 * Center-column Obsidian surface: today / recent / journalled changes /
 * broken-link sample / a composer that hands off to the vault's own session.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PanelController } from './controller.ts'
import type { ObsidianKey } from './locales.ts'

export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
export type RpcFn = (endpoint: string, payload?: unknown) => Promise<RpcResult<unknown>>

interface SurfaceNote {
  path: string
  title: string | null
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
  todayRel: string
}

interface SurfaceOverview {
  vault: string
  noteCount: number
  truncated: boolean
  todayDate: string
  todayRel?: string
  daily?: DailyHabit
  today: SurfaceNote | null
  recent: SurfaceNote[]
  changes: SurfaceChange[]
  brokenCount: number
  broken: SurfaceBroken[]
}

interface FullChange extends SurfaceChange {
  before: string | null
  after: string | null
}

const KIND_KEYS: Record<string, ObsidianKey> = {
  create: 'history.created',
  update: 'history.updated',
  append: 'history.appended',
  delete: 'history.deleted',
  undo: 'history.undone',
  restore: 'history.restored',
  rollback: 'history.rolledBack',
}

const DIFF_LINE_CAP = 200

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
  const [bindDraft, setBindDraft] = useState('')
  const [needBind, setNeedBind] = useState(false)
  const [overview, setOverview] = useState<SurfaceOverview | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [talkBusy, setTalkBusy] = useState(false)
  const [talkError, setTalkError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FullChange | null>(null)
  const [rollbackBusy, setRollbackBusy] = useState(false)
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    setSelected(null)
    setRollbackMsg(null)
    const cfg = await rpc('config/get')
    if (!cfg.ok) {
      setStatus('error')
      setError(cfg.error.message)
      return
    }
    const dir = String((cfg.value as { vaultDir?: string }).vaultDir ?? '').trim()
    setVaultDir(dir)
    if (dir === '') {
      setNeedBind(true)
      setOverview(null)
      setStatus('ready')
      return
    }
    setNeedBind(false)
    const res = await rpc('surface/overview')
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

  const bind = async () => {
    const path = bindDraft.trim()
    if (path === '') return
    const res = await rpc('config/set', { field: 'vaultDir', value: path })
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setBindDraft('')
    await load()
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

  const openChange = async (opId: string) => {
    const res = await rpc('history/entry', { opId })
    if (res.ok) setSelected(res.value as FullChange)
    else setRollbackMsg(res.error.message)
  }

  const rollback = async () => {
    if (selected === null || rollbackBusy) return
    if (!window.confirm(t('history.rollback') + ' — ' + selected.path)) return
    setRollbackBusy(true)
    setRollbackMsg(null)
    const res = await rpc('history/rollback', { opId: selected.opId })
    setRollbackBusy(false)
    if (!res.ok) {
      setRollbackMsg(res.error.message)
      return
    }
    setSelected(null)
    await load()
  }

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

      {overview !== null && !needBind && (
        <>
          <div className="ob-stats">
            <div className={overview.today === null ? 'ob-stat warn' : 'ob-stat'}>
              <span className="n">{overview.today === null ? t('dash.stat.todayOff') : t('dash.stat.todayOn')}</span>
              <span className="l">{overview.todayDate}</span>
            </div>
            <div className="ob-stat">
              <span className="n">{overview.noteCount}</span>
              <span className="l">{t('dash.stat.notes', { n: String(overview.noteCount) })}</span>
            </div>
            <div className="ob-stat">
              <span className="n">{overview.changes.length}</span>
              <span className="l">{t('dash.stat.changes', { n: String(overview.changes.length) })}</span>
            </div>
            <div className={overview.brokenCount > 0 ? 'ob-stat warn' : 'ob-stat'}>
              <span className="n">{overview.brokenCount}</span>
              <span className="l">{t('dash.stat.broken', { n: String(overview.brokenCount) })}</span>
            </div>
          </div>
          <div className="ob-quick">
            <span className="ob-quick-label">{t('dash.actions')}</span>
            <button type="button" className="ob-chip" onClick={() => { void talk(t('panel.prompt.dailyWork', { date: overview.todayDate, path: overview.todayRel ?? overview.todayDate })) }}>
              {t('dash.action.daily')}
            </button>
            <button type="button" className="ob-chip" onClick={() => { void talk(t('panel.prompt.weekly')) }}>
              {t('dash.action.weekly')}
            </button>
            <button type="button" className="ob-chip" onClick={() => { void talk(t('panel.prompt.brokenSweep')) }}>
              {t('dash.action.broken')}
            </button>
          </div>
        </>
      )}

      <div className="ob-body">
        {status === 'loading' && <div className="ob-hint">{t('config.loading')}</div>}
        {error !== null && <div className="ob-msg err">{error}</div>}

        {needBind && (
          <section className="ob-card span2">
            <div className="ob-card-h">{t('panel.bindHeading')}</div>
            <div className="ob-hint">{t('panel.bindHint')}</div>
            <input
              className="ob-input"
              value={bindDraft}
              placeholder="/Users/me/obsidian"
              onChange={(ev) => setBindDraft(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') void bind() }}
            />
            <button type="button" className="ob-btn primary" onClick={() => { void bind() }}>{t('panel.bind')}</button>
          </section>
        )}

        {overview !== null && !needBind && (
          <>
            <section className="ob-card">
              <div className="ob-card-h">
                <span>{t('panel.today')}</span>
                <span className="ob-count">{overview.todayRel ?? overview.todayDate}</span>
              </div>
              {overview.daily !== undefined && (
                <div className="ob-hint">{t('panel.dailyHabit', { folder: overview.daily.folder || '/', format: overview.daily.format })}</div>
              )}
              {overview.today === null ? (
                <div className="ob-row" onClick={() => { void talk(t('panel.prompt.todayMissing', { date: overview.todayDate, path: overview.todayRel ?? overview.todayDate })) }}>
                  <div className="main">
                    <span className="path">{t('panel.todayMissing')}</span>
                    <span className="meta">{overview.todayRel ?? t('panel.todayMissingHint')}</span>
                  </div>
                  <button type="button" className="ob-link">{t('panel.ask')}</button>
                </div>
              ) : (
                <NoteRow
                  note={overview.today}
                  askLabel={t('panel.ask')}
                  onAsk={() => { void talk(t('panel.prompt.read', { path: overview.today!.path })) }}
                />
              )}
            </section>

            <section className="ob-card">
              <div className="ob-card-h">
                <span>{t('panel.broken')}</span>
                <span className="ob-count">{overview.brokenCount}</span>
              </div>
              {overview.brokenCount === 0 && <div className="ob-hint">{t('panel.brokenNone')}</div>}
              {overview.broken.map((link, i) => (
                <div
                  key={link.from + '->' + link.target + i}
                  className="ob-row"
                  onClick={() => { void talk(t('panel.prompt.broken', { from: link.from, target: link.target })) }}
                >
                  <div className="main">
                    <span className="path">[[{link.target}]]</span>
                    <span className="meta">{link.from}</span>
                  </div>
                  <button type="button" className="ob-link">{t('panel.ask')}</button>
                </div>
              ))}
            </section>

            <section className="ob-card">
              <div className="ob-card-h">
                <span>{t('panel.recent')}</span>
                <span className="ob-count">{t('panel.noteCount', { n: String(overview.noteCount) })}</span>
              </div>
              {overview.recent.length === 0 && <div className="ob-hint">{t('panel.recentEmpty')}</div>}
              {overview.recent.map((note) => (
                <NoteRow
                  key={note.path}
                  note={note}
                  askLabel={t('panel.ask')}
                  onAsk={() => { void talk(t('panel.prompt.read', { path: note.path })) }}
                />
              ))}
            </section>

            <section className="ob-card">
              <div className="ob-card-h">
                <span>{t('panel.changes')}</span>
                <span className="ob-count">{t('panel.changeCount', { n: String(overview.changes.length) })}</span>
              </div>
              {overview.changes.length === 0 && <div className="ob-hint">{t('history.empty')}</div>}
              {overview.changes.map((entry) => (
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="ob-btn primary" disabled={rollbackBusy} onClick={() => { void rollback() }}>
                    {t('history.rollback')}
                  </button>
                  <button type="button" className="ob-btn" onClick={() => setSelected(null)}>{t('history.closeDetail')}</button>
                  {rollbackMsg !== null && <span className="ob-msg err">{rollbackMsg}</span>}
                </div>
              )}
            </section>
          </>
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
    </div>
  )
}

function NoteRow({ note, askLabel, onAsk }: { note: SurfaceNote; askLabel: string; onAsk: () => void }) {
  return (
    <div className="ob-row" onClick={onAsk}>
      <div className="main">
        <span className="path">{note.title ?? note.path}</span>
        {note.title !== null && <span className="meta">{note.path}</span>}
      </div>
      <button type="button" className="ob-link" onClick={(ev) => { ev.stopPropagation(); onAsk() }}>{askLabel}</button>
    </div>
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
