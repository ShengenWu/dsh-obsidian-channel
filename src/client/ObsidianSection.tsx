/**
 * settings.section component: Obsidian vault configuration + change-history
 * panel with per-entry diff and one-click rollback.
 *
 * Data channels (all official seams):
 *   - config read/write: settingsScope bound to the host namespace
 *     'dsh-obsidian-channel' (host: installSettingsSection); writes persist to
 *     the settings document and apply live on the host.
 *   - journal read/rollback: the /obsidian connection RPC channel the host
 *     mounts (history/list, history/entry, history/rollback, vault/check).
 *     Panel rollback runs directly — the button click IS the authorization
 *     (ctx.approval requires an agent + open turn, which a UI click has not;
 *     every rollback is itself journaled and re-undoable).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { NS, type ObsidianKey } from './locales.ts'

interface ObsidianConfig {
  vaultDir?: string
  writePolicy?: 'per-write' | 'per-turn' | 'auto'
  excludes?: string[]
  journalRetentionDays?: number
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

type RpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
type RpcFn = (endpoint: string, payload?: unknown) => Promise<RpcResult<unknown>>

export type SectionProps = PropsRuntime<'settings.section'> & PropsLocale<typeof NS> & {
  rpc: RpcFn
  scope: SettingsScope<ObsidianConfig>
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

const KIND_KEYS: Record<string, ObsidianKey> = {
  create: 'history.created',
  update: 'history.updated',
  append: 'history.appended',
  delete: 'history.deleted',
  undo: 'history.undone',
  restore: 'history.restored',
  rollback: 'history.rolledBack',
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString()
}

// ---- stylesheet injected once per page ----
let styleSeated = false
function seatStyle() {
  if (styleSeated) return
  styleSeated = true
  const style = document.createElement('style')
  style.id = 'dsh-obsidian-section-style'
  style.textContent = [
    '.obs-section { display: flex; flex-direction: column; gap: 16px; }',
    '.obs-block { display: flex; flex-direction: column; gap: 8px; }',
    '.obs-field { display: flex; flex-direction: column; gap: 4px; }',
    '.obs-label { font-size: 12px; opacity: .7; }',
    '.obs-hint { font-size: 11px; opacity: .55; }',
    '.obs-input { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128,128,140,.35); background: transparent; color: inherit; font: inherit; }',
    '.obs-radio { display: flex; flex-direction: column; gap: 4px; }',
    '.obs-radio label { display: flex; gap: 6px; align-items: center; font-size: 13px; }',
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

export function ObsidianSettingsSection({ t, close, rpc, scope }: SectionProps) {
  seatStyle()

  const [cfg, setCfg] = useState(() => scope.getSnapshot())
  useEffect(() => scope.subscribe(() => { setCfg(scope.getSnapshot()) }), [scope])

  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<FullEntry | null>(null)
  const [listBusy, setListBusy] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [rollbackBusy, setRollbackBusy] = useState(false)
  const [rollbackMsg, setRollbackMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    setListBusy(true)
    setListError(null)
    const res = await rpc('history/list', { limit: 200 })
    setListBusy(false)
    if (res.ok) {
      const e = (res.value as { entries?: Entry[] }).entries ?? []
      setEntries(e)
    } else {
      setListError(t('history.loadFailed', { error: res.error.message }))
    }
  }, [rpc, t])

  useEffect(() => { void refresh() }, [refresh])

  const openDetail = async (opId: string) => {
    setDetailBusy(true)
    setRollbackMsg(null)
    const res = await rpc('history/entry', { opId })
    setDetailBusy(false)
    if (res.ok) setSelected(res.value as FullEntry)
    else setRollbackMsg({ kind: 'err', text: t('history.loadFailed', { error: res.error.message }) })
  }

  const doRollback = async () => {
    if (selected === null || rollbackBusy) return
    const sure = window.confirm(t('history.rollback') + ' — ' + selected.path + ' (opId ' + selected.opId + ')')
    if (!sure) return
    setRollbackBusy(true)
    setRollbackMsg(null)
    const res = await rpc('history/rollback', { opId: selected.opId })
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
    const res = await rpc('vault/check', {})
    if (res.ok) {
      const v = res.value as { vault?: string; topLevel?: number | null }
      setTestMsg({ kind: 'ok', text: t('config.testRead.ok', { vault: v.vault ?? '', n: String(v.topLevel ?? '?') }) })
    } else {
      setTestMsg({ kind: 'err', text: t('config.testRead.fail', { error: res.error.message }) })
    }
  }

  const setField = (field: keyof ObsidianConfig, value: unknown) => {
    void scope.set(field as string, value).catch((err: unknown) => {
      setRollbackMsg({ kind: 'err', text: String((err as { message?: string })?.message ?? err) })
    })
  }

  const snapshotValue = cfg.value
  const cfgStatus = cfg.status

  return (
    <div className="obs-section">
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t('page.title')}</div>
        <div className="obs-hint">{t('page.subtitle')}</div>
      </div>

      <div className="obs-block">
        <div style={{ fontSize: 13, fontWeight: 600 }}>{t('config.heading')}</div>
        {cfgStatus === 'loading' && <div className="obs-hint">{t('config.loading')}</div>}
        {cfgStatus === 'unavailable' && <div className="obs-msg err">{t('config.unavailable')}</div>}
        {cfgStatus === 'ready' && (
          <>
            <div className="obs-field">
              <span className="obs-label">{t('config.vaultDir')}</span>
              <input
                className="obs-input"
                value={snapshotValue?.vaultDir ?? ''}
                placeholder="/Users/me/obsidian"
                onChange={(ev) => setField('vaultDir', ev.target.value)}
              />
              <span className="obs-hint">{t('config.vaultDirHint')}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <button type="button" className="obs-btn" onClick={() => { void doTestRead() }}>{t('config.testRead')}</button>
                {testMsg !== null && <span className={testMsg.kind === 'ok' ? 'obs-msg ok' : 'obs-msg err'}>{testMsg.text}</span>}
              </div>
            </div>

            <div className="obs-field">
              <span className="obs-label">{t('config.writePolicy')}</span>
              <div className="obs-radio">
                {(['per-write', 'per-turn', 'auto'] as const).map((policy) => (
                  <label key={policy}>
                    <input
                      type="radio"
                      name="dsh-obsidian-write-policy"
                      checked={(snapshotValue?.writePolicy ?? 'per-write') === policy}
                      onChange={() => setField('writePolicy', policy)}
                    />
                    {t('config.writePolicy.' + (policy === 'per-write' ? 'perWrite' : policy === 'per-turn' ? 'perTurn' : 'auto') as ObsidianKey)}
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

            <div className="obs-field">
              <span className="obs-label">{t('config.retention')}</span>
              <input
                className="obs-input"
                type="number"
                min={1}
                value={snapshotValue?.journalRetentionDays ?? 30}
                onChange={(ev) => setField('journalRetentionDays', Number(ev.target.value) || 30)}
              />
            </div>
          </>
        )}
      </div>

      <div className="obs-block">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t('history.heading')} · {t('history.entryCount', { n: String(entries.length) })}</span>
          <button type="button" className="obs-btn" disabled={listBusy} onClick={() => { void refresh() }}>{t('history.refresh')}</button>
        </div>
        {listError !== null && <div className="obs-msg err">{listError}</div>}
        {entries.length === 0 && !listBusy && listError === null && <div className="obs-hint">{t('history.empty')}</div>}
        <div className="obs-list">
          {entries.map((e) => (
            <div key={e.opId} className="obs-row" onClick={() => { void openDetail(e.opId) }}>
              <div className="main">
                <span className="path">{e.path}</span>
                <span className="meta">{fmtTime(e.ts)} · {e.tool} · {t('history.sessionLabel')} {shortSession(e.sessionId)}</span>
              </div>
              <span className="obs-badge">{t(KIND_KEYS[e.kind] ?? ('history.' + e.kind + '' as ObsidianKey))}</span>
            </div>
          ))}
        </div>
      </div>

      {(selected !== null || detailBusy) && (
        <div className="obs-block">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('history.detailTitle')}{selected !== null ? ' — ' + selected.path : ''}</span>
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
        </div>
      )}
    </div>
  )
}

function shortSession(sessionId: string | null) {
  if (sessionId === null || sessionId === undefined) return '—'
  const s = String(sessionId)
  return s.length > 12 ? s.slice(0, 12) : s
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
          {before === null ? <div className="obs-hint">（无）</div> : diff.rows.map((r, i) => (
            r.kind === 'del' || r.kind === 'same' ? <div key={i} className={r.kind === 'del' ? 'del line-del' : undefined}>{r.text || ' '}</div> : <div key={i} className="del" style={{ opacity: 0 }}> </div>
          ))}
        </div>
        <div className="col">
          <div className="pane-head">{t('history.after')}</div>
          {after === null ? <div className="obs-hint">（无）</div> : diff.rows.map((r, i) => (
            r.kind === 'add' || r.kind === 'same' ? <div key={i} className={r.kind === 'add' ? 'add line-add' : undefined}>{r.text || ' '}</div> : <div key={i} className="add" style={{ opacity: 0 }}> </div>
          ))}
        </div>
      </div>
      {diff.truncated && <div className="obs-hint">（前 {DIFF_LINE_CAP} 行）</div>}
    </div>
  )
}
