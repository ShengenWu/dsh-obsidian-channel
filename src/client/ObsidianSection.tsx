/**
 * settings.section component: Obsidian vault configuration + change-history
 * panel with per-entry diff and one-click rollback.
 *
 * Data channels:
 *   - config read/write: the /obsidian connection RPC channel the host mounts
 *     (config/get, config/set). Host persistence goes through the official
 *     settings.update seam. 【DSH 尚未适配】客户端不能走官方 settingsScope，
 *     因为 DSH host-apiproxy 的 settings.describe 白名单不暴露第三方 namespace；
 *     待 DSH 支持第三方 namespace 暴露后应改回 settingsScope。
 *   - journal read/rollback: the same /obsidian RPC (history/list,
 *     history/entry, history/rollback, vault/check). Panel rollback runs
 *     directly — the button click IS the authorization (ctx.approval requires
 *     an agent + open turn, which a UI click has not; every rollback is itself
 *     journaled and re-undoable).
 */
import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS, type ObsidianKey } from './locales.ts'
import { createObsidianRpc, type RpcFn } from './rpc.ts'

interface DailyHabit {
  folder: string
  format: string
  source: string
  todayRel: string | null
}

interface HomeWidgetRow {
  id: string
  enabled: boolean
}

interface ObsidianConfig {
  vaultDir?: string
  writePolicy?: 'per-write' | 'per-turn' | 'auto'
  excludes?: string[]
  journalRetentionDays?: number
  dailyFolder?: string
  dailyFormat?: string
  daily?: DailyHabit | null
  homeWidgets?: HomeWidgetRow[]
}

interface Entry {
  opId: string
  ts: number
  path: string
  kind: string
  status: string
  tool: string
  sessionId: string | null
  beforeHash: string | null
  afterHash: string | null
}

interface FullEntry extends Entry {
  args: unknown
  before: string | null
  after: string | null
}

export type SectionProps = PropsRuntime<'settings.section'> & PropsLocale<typeof NS> & {
  rpc?: RpcFn
}


// ---- tiny line diff (LCS over lines, capped for panel safety) ----
const DIFF_LINE_CAP = 500

function diffLines(a: string, b: string) {
  const al = a.split('\n').slice(0, DIFF_LINE_CAP)
  const bl = b.split('\n').slice(0, DIFF_LINE_CAP)
  const n = al.length, m = bl.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = al[i] === bl[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const rows: { kind: 'same' | 'add' | 'del'; text: string }[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (al[i] === bl[j]) { rows.push({ kind: 'same', text: al[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ kind: 'del', text: al[i] }); i++ }
    else { rows.push({ kind: 'add', text: bl[j] }); j++ }
  }
  while (i < n) { rows.push({ kind: 'del', text: al[i] }); i++ }
  while (j < m) { rows.push({ kind: 'add', text: bl[j] }); j++ }
  return { rows, truncated: a.split('\n').length > DIFF_LINE_CAP || b.split('\n').length > DIFF_LINE_CAP }
}

const WIDGET_LABEL: Record<string, ObsidianKey> = {
  continue: 'home.widget.continue',
  changes: 'home.widget.changes',
  daily: 'home.widget.daily',
  search: 'home.widget.search',
  structure: 'home.widget.structure',
  inbox: 'home.widget.inbox',
  links: 'home.widget.links',
  actions: 'home.widget.actions',
}

const WRITE_POLICY: { id: 'per-write' | 'per-turn' | 'auto'; title: ObsidianKey }[] = [
  { id: 'per-write', title: 'config.writePolicy.perWrite' },
  { id: 'per-turn', title: 'config.writePolicy.perTurn' },
  { id: 'auto', title: 'config.writePolicy.auto' },
]

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

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString()
}

function snapshotSourceKey(source?: string): ObsidianKey {
  if (source === 'obsidian') return 'config.dailySource.obsidian'
  if (source === 'override') return 'config.dailySource.override'
  return 'config.dailySource.none'
}

// ---- stylesheet injected once per page ----
let styleSeated = false
function seatStyle() {
  if (styleSeated) return
  styleSeated = true
  const style = document.createElement('style')
  style.id = 'dsh-obsidian-section-style'
  style.textContent = [
    '.obs-section { display: flex; flex-direction: column; gap: 28px; }',
    '.obs-hero { display: flex; flex-direction: column; gap: 6px; }',
    '.obs-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.02em; line-height: 1.3; }',
    '.obs-lead { margin: 0; font-size: 13px; line-height: 1.55; opacity: .68; }',
    '.obs-block { display: flex; flex-direction: column; gap: 14px; padding-top: 18px; border-top: 1px solid rgba(128,128,140,.2); }',
    '.obs-h { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -.01em; }',
    '.obs-block .obs-lead { font-size: 12px; }',
    '.obs-field { display: flex; flex-direction: column; gap: 6px; }',
    '.obs-label { font-size: 13px; font-weight: 600; opacity: .92; }',
    '.obs-hint { font-size: 12px; line-height: 1.5; opacity: .55; }',
    '.obs-input { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128,128,140,.35); background: transparent; color: inherit; font: inherit; }',
    '.obs-path-row { display: flex; gap: 8px; align-items: center; }',
    '.obs-path-row .obs-path { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128,128,140,.35); }',
    '.obs-path-row .obs-path.empty { opacity: .45; }',
    '.obs-unit { display: flex; align-items: center; gap: 8px; }',
    '.obs-unit .obs-input { width: 96px; }',
    '.obs-unit .unit { font-size: 13px; opacity: .7; }',
    '.obs-radio { display: flex; flex-direction: column; gap: 6px; }',
    '.obs-radio label { display: flex; gap: 6px; align-items: center; font-size: 13px; }',
    '.obs-check { display: flex; flex-direction: column; gap: 6px; }',
    '.obs-check label { display: flex; gap: 8px; align-items: center; font-size: 13px; }',
    '.obs-choice { display: flex; flex-direction: column; gap: 2px; min-width: 0; }',
    '.obs-choice .name { font-weight: 600; }',
    '.obs-choice .hint { font-size: 12px; line-height: 1.45; opacity: .55; }',
    '.obs-btn { align-self: flex-start; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(128,128,140,.4); background: transparent; color: inherit; cursor: pointer; font: inherit; }',
    '.obs-btn:disabled { opacity: .5; cursor: default; }',
    '.obs-btn.primary { border-color: var(--dsw-alias-text-accent, #4c9aff); color: var(--dsw-alias-text-accent, #4c9aff); }',
    '.obs-msg { font-size: 12px; }',
    '.obs-msg.err { color: #ff6b6b; }',
    '.obs-msg.ok { color: #51c88a; }',
    '.obs-row { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 8px 10px; border: 1px solid rgba(128,128,140,.22); border-radius: 8px; cursor: pointer; }',
    '.obs-row:hover { border-color: rgba(128,128,140,.5); }',
    '.obs-row .main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }',
    '.obs-row .path { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.obs-row .meta { font-size: 11px; opacity: .6; }',
    '.obs-badge { flex: none; font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(128,128,140,.4); }',
    '.obs-diff { display: flex; flex-direction: column; border: 1px solid rgba(128,128,140,.22); border-radius: 8px; overflow: hidden; }',
    '.obs-diff .pane-head { padding: 6px 10px; font-size: 11px; opacity: .65; border-bottom: 1px solid rgba(128,128,140,.2); }',
    '.obs-diff .pane { display: flex; }',
    '.obs-diff .col { flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; padding: 6px 10px; }',
    '.obs-diff .col + .col { border-left: 1px solid rgba(128,128,140,.2); }',
    '.obs-diff .del { background: rgba(255,107,107,.12); }',
    '.obs-diff .add { background: rgba(81,200,138,.12); }',
    '.obs-diff .line-del { color: #ff6b6b; }',
    '.obs-diff .line-add { color: #51c88a; }',
    '.obs-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }',
  ].join('\n')
  document.head.appendChild(style)
}

class SettingsErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(error: unknown) {
    return { err: error instanceof Error ? error.message : String(error) }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[dsh-obsidian-channel] settings section crashed:', error, info.componentStack)
  }
  render() {
    if (this.state.err !== null) {
      return <div className="obs-msg err">{this.state.err}</div>
    }
    return this.props.children
  }
}

export function ObsidianSettingsSection(props: SectionProps) {
  return (
    <SettingsErrorBoundary>
      <ObsidianSettingsBody {...props} />
    </SettingsErrorBoundary>
  )
}

function ObsidianSettingsBody({ t, rpc }: SectionProps) {
  seatStyle()
  const call = typeof rpc === 'function' ? rpc : createObsidianRpc()

  const [cfg, setCfg] = useState<ObsidianConfig | null>(null)
  const [cfgStatus, setCfgStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const loadConfig = useCallback(async () => {
    try {
      const res = await call('config/get')
      if (res.ok) {
        setCfg(res.value as ObsidianConfig)
        setCfgStatus('ready')
      } else {
        setCfgStatus('unavailable')
        setRollbackMsg({ kind: 'err', text: res.error.message })
      }
    } catch (error) {
      setCfgStatus('unavailable')
      setRollbackMsg({ kind: 'err', text: error instanceof Error ? error.message : String(error) })
    }
  }, [call])
  useEffect(() => { void loadConfig() }, [loadConfig])

  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<FullEntry | null>(null)
  const [listBusy, setListBusy] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [rollbackBusy, setRollbackBusy] = useState(false)
  const [rollbackMsg, setRollbackMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [dailyMsg, setDailyMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [detected, setDetected] = useState<{ path: string; open?: boolean }[]>([])

  const refresh = useCallback(async () => {
    setListBusy(true)
    setListError(null)
    try {
      const res = await call('history/list', { limit: 200 })
      if (res.ok) {
        const e = (res.value as { entries?: Entry[] }).entries ?? []
        setEntries(e)
      } else {
        setListError(t('history.loadFailed', { error: res.error.message }))
      }
    } catch (error) {
      setListError(t('history.loadFailed', { error: error instanceof Error ? error.message : String(error) }))
    }
    setListBusy(false)
  }, [call, t])

  useEffect(() => { void refresh() }, [refresh])

  const openDetail = async (opId: string) => {
    setDetailBusy(true)
    setRollbackMsg(null)
    const res = await call('history/entry', { opId })
    setDetailBusy(false)
    if (res.ok) setSelected(res.value as FullEntry)
    else setRollbackMsg({ kind: 'err', text: t('history.loadFailed', { error: res.error.message }) })
  }

  const doRollback = async () => {
    if (selected === null || rollbackBusy) return
    const sure = window.confirm(t('history.rollbackConfirm', { path: selected.path }))
    if (!sure) return
    setRollbackBusy(true)
    setRollbackMsg(null)
    const res = await call('history/rollback', { opId: selected.opId })
    setRollbackBusy(false)
    if (res.ok) {
      const v = res.value as { message?: string }
      setRollbackMsg({ kind: 'ok', text: t('history.rollbackDone', { message: v.message ?? '' }) })
      setSelected(null)
      void refresh()
    } else {
      setRollbackMsg({ kind: 'err', text: t('history.rollbackFailed', { message: res.error.message }) })
    }
  }

  const doTestRead = async () => {
    setTestMsg(null)
    const res = await call('vault/check', {})
    if (res.ok) {
      const v = res.value as { vault?: string; topLevel?: number | null }
      setTestMsg({ kind: 'ok', text: t('config.testRead.ok', { vault: v.vault ?? '', n: String(v.topLevel ?? '?') }) })
    } else {
      setTestMsg({ kind: 'err', text: t('config.testRead.fail', { error: res.error.message }) })
    }
  }

  const doPickVault = async () => {
    setTestMsg(null)
    const res = await call('vault/pick')
    if (!res.ok) {
      setTestMsg({ kind: 'err', text: t('config.vaultPickFailed', { error: res.error.message }) })
      return
    }
    const path = String((res.value as { path?: string }).path ?? '').trim()
    if (path === '') return
    setField('vaultDir', path)
  }

  const doPickDaily = async () => {
    setDailyMsg(null)
    const res = await call('vault/pick', { kind: 'daily' })
    if (!res.ok) {
      const code = res.error.code
      const text = code === 'vault-required'
        ? t('config.dailyFolderNeedVault')
        : code === 'outside-vault'
          ? t('config.dailyFolderOutside')
          : t('config.vaultPickFailed', { error: res.error.message })
      setDailyMsg({ kind: 'err', text })
      return
    }
    if ((res.value as { cancelled?: boolean }).cancelled === true) return
    const path = String((res.value as { path?: string }).path ?? '').trim()
    setField('dailyFolder', path)
  }

  const doDetect = async () => {
    const res = await call('vault/detect')
    if (!res.ok) {
      setTestMsg({ kind: 'err', text: res.error.message })
      return
    }
    const vaults = (res.value as { vaults?: { path: string; open?: boolean }[] }).vaults ?? []
    setDetected(vaults)
    if (vaults.length === 0) setTestMsg({ kind: 'err', text: t('home.detectNone') })
  }

  const setField = (field: keyof ObsidianConfig, value: unknown) => {
    void call('config/set', { field, value }).then((res) => {
      if (res.ok) setCfg(res.value as ObsidianConfig)
      else setRollbackMsg({ kind: 'err', text: res.error.message })
    })
  }

  const snapshotValue = cfg

  const dailySourceKey = snapshotSourceKey(snapshotValue?.daily?.source)

  return (
    <div className="obs-section">
      <header className="obs-hero">
        <h2 className="obs-title">{t('page.title')}</h2>
      </header>

      {cfgStatus === 'loading' && <div className="obs-hint">{t('config.loading')}</div>}
      {cfgStatus === 'unavailable' && <div className="obs-msg err">{t('config.unavailable')}</div>}

      {cfgStatus === 'ready' && (
        <>
          <section className="obs-block">
            <h3 className="obs-h">{t('config.heading.library')}</h3>
            <div className="obs-field">
              <span className="obs-label">{t('config.vaultDir')}</span>
              <div className="obs-path-row">
                <span className={'obs-path' + ((snapshotValue?.vaultDir ?? '') === '' ? ' empty' : '')}>
                  {(snapshotValue?.vaultDir ?? '') === '' ? t('config.vaultDirEmpty') : snapshotValue?.vaultDir}
                </span>
                <button type="button" className="obs-btn" onClick={() => { void doPickVault() }}>{t('config.vaultPick')}</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                <button type="button" className="obs-btn" onClick={() => { void doTestRead() }}>{t('config.testRead')}</button>
                <button type="button" className="obs-btn" onClick={() => { void doDetect() }}>{t('home.detect')}</button>
                {testMsg !== null && <span className={testMsg.kind === 'ok' ? 'obs-msg ok' : 'obs-msg err'}>{testMsg.text}</span>}
              </div>
              {detected.length > 0 && (
                <div className="obs-list" style={{ maxHeight: 160, marginTop: 6 }}>
                  {detected.map((vault) => (
                    <div key={vault.path} className="obs-row" onClick={() => setField('vaultDir', vault.path)}>
                      <div className="main">
                        <span className="path">{vault.path}</span>
                        {vault.open === true && <span className="meta">{t('home.detectOpen')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </section>

          <section className="obs-block">
            <h3 className="obs-h">{t('config.heading.write')}</h3>
            <div className="obs-field">
              <span className="obs-label">{t('config.writePolicy')}</span>
              <div className="obs-radio">
                {WRITE_POLICY.map((policy) => (
                  <label key={policy.id}>
                    <input
                      type="radio"
                      name="dsh-obsidian-write-policy"
                      checked={(snapshotValue?.writePolicy ?? 'per-write') === policy.id}
                      onChange={() => setField('writePolicy', policy.id)}
                    />
                    {t(policy.title)}
                  </label>
                ))}
              </div>
            </div>
            <div className="obs-field">
              <span className="obs-label">{t('config.excludes')}</span>
              <textarea
                className="obs-input"
                rows={3}
                value={(snapshotValue?.excludes ?? []).join('\n')}
                onChange={(ev) => setField('excludes', ev.target.value.split('\n').map((s) => s.trim()).filter((s) => s !== ''))}
              />
              <span className="obs-hint">{t('config.excludesHint')}</span>
            </div>
          </section>

          <section className="obs-block">
            <h3 className="obs-h">{t('config.heading.daily')}</h3>
            <div className="obs-field">
              <span className="obs-label">{t('config.dailyFolder')}</span>
              <div className="obs-path-row">
                <span className={'obs-path' + ((snapshotValue?.dailyFolder ?? '') === '' ? ' empty' : '')}>
                  {(snapshotValue?.dailyFolder ?? '') === '' ? t('config.vaultDirEmpty') : snapshotValue?.dailyFolder}
                </span>
                <button type="button" className="obs-btn" onClick={() => { void doPickDaily() }}>{t('config.vaultPick')}</button>
                {(snapshotValue?.dailyFolder ?? '') !== '' && (
                  <button type="button" className="obs-btn" onClick={() => setField('dailyFolder', '')}>{t('config.dailyFolderClear')}</button>
                )}
              </div>
              <span className="obs-hint">{t('config.dailyFolderHint')}</span>
              {dailyMsg !== null && <span className={dailyMsg.kind === 'ok' ? 'obs-msg ok' : 'obs-msg err'}>{dailyMsg.text}</span>}
            </div>
            <div className="obs-field">
              <span className="obs-label">{t('config.dailyFormat')}</span>
              <input
                className="obs-input"
                value={snapshotValue?.dailyFormat ?? ''}
                placeholder="MM-DD-YYYY"
                onChange={(ev) => setField('dailyFormat', ev.target.value)}
              />
              <span className="obs-hint">{t('config.dailyFormatHint')}</span>
              {snapshotValue?.daily != null && snapshotValue.daily.todayRel != null && (
                <span className="obs-hint">{t('config.dailyResolved', { path: snapshotValue.daily.todayRel, source: t(dailySourceKey) })}</span>
              )}
            </div>
          </section>

          <section className="obs-block">
            <h3 className="obs-h">{t('config.heading.home')}</h3>
            <div className="obs-check">
              {(snapshotValue?.homeWidgets ?? []).map((row) => {
                const label = WIDGET_LABEL[row.id]
                return (
                  <label key={row.id}>
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={() => {
                        const next = (snapshotValue?.homeWidgets ?? []).map((item) => (
                          item.id === row.id ? { ...item, enabled: !item.enabled } : item
                        ))
                        setField('homeWidgets', next)
                      }}
                    />
                    {label !== undefined ? t(label) : row.id}
                  </label>
                )
              })}
            </div>
          </section>
        </>
      )}

      <section className="obs-block">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 className="obs-h">{t('history.heading')}</h3>
          <button type="button" className="obs-btn" disabled={listBusy} onClick={() => { void refresh() }}>{t('history.refresh')}</button>
        </div>
        <div className="obs-field">
          <span className="obs-label">{t('config.retention')}</span>
          <div className="obs-unit">
            <input
              className="obs-input"
              type="number"
              min={1}
              value={snapshotValue?.journalRetentionDays ?? 30}
              onChange={(ev) => setField('journalRetentionDays', Number(ev.target.value) || 30)}
            />
            <span className="unit">{t('config.retentionUnit')}</span>
          </div>
          <span className="obs-hint">{t('config.retentionHint')}</span>
        </div>
        <div className="obs-hint">{t('history.entryCount', { n: String(entries.length) })}</div>
        {listError !== null && <div className="obs-msg err">{listError}</div>}
        {entries.length === 0 && !listBusy && listError === null && <div className="obs-hint">{t('history.empty')}</div>}
        <div className="obs-list">
          {entries.map((e) => (
            <div key={e.opId} className="obs-row" onClick={() => { void openDetail(e.opId) }}>
              <div className="main">
                <span className="path">{e.path}</span>
                <span className="meta">{fmtTime(e.ts)}</span>
              </div>
              <span className="obs-badge">{t(KIND_KEYS[e.kind] ?? ('history.' + e.kind + '' as ObsidianKey))}</span>
            </div>
          ))}
        </div>
      </section>

      {(selected !== null || detailBusy) && (
        <section className="obs-block">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h3 className="obs-h">{t('history.detailTitle')}{selected !== null ? ' · ' + selected.path : ''}</h3>
            <button type="button" className="obs-btn" onClick={() => setSelected(null)}>{t('history.closeDetail')}</button>
          </div>
          {detailBusy && <div className="obs-hint">{t('config.loading')}</div>}
          {selected !== null && <EntryDetail entry={selected} t={t} />}
          {selected !== null && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="obs-btn primary" disabled={rollbackBusy} onClick={() => { void doRollback() }}>{t('history.rollback')}</button>
              {rollbackMsg !== null && <span className={rollbackMsg.kind === 'ok' ? 'obs-msg ok' : 'obs-msg err'}>{rollbackMsg.text}</span>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function EntryDetail({ entry, t }: { entry: FullEntry; t: (k: ObsidianKey, p?: Record<string, unknown>) => string }) {
  const before = entry.before
  const after = entry.after
  const diff = useMemo(() => diffLines(before ?? '', after ?? ''), [before, after])
  return (
    <div className="obs-diff">
      <div className="pane">
        <div className="col">
          <div className="pane-head">{t('history.before')}{before === null ? ' — ' + t('history.created') : ''}</div>
          {before === null ? <div className="obs-hint">{t('history.none')}</div> : diff.rows.map((r, i) => (
            r.kind === 'del' || r.kind === 'same' ? <div key={i} className={r.kind === 'del' ? 'del line-del' : undefined}>{r.text || ' '}</div> : <div key={i} className="del" style={{ opacity: 0 }}> </div>
          ))}
        </div>
        <div className="col">
          <div className="pane-head">{t('history.after')}</div>
          {after === null ? <div className="obs-hint">{t('history.none')}</div> : diff.rows.map((r, i) => (
            r.kind === 'add' || r.kind === 'same' ? <div key={i} className={r.kind === 'add' ? 'add line-add' : undefined}>{r.text || ' '}</div> : <div key={i} className="add" style={{ opacity: 0 }}> </div>
          ))}
        </div>
      </div>
      {diff.truncated && <div className="obs-hint">{t('history.truncated')}</div>}
    </div>
  )
}
