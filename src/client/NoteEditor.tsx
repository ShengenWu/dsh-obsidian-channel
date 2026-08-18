import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ObsidianKey } from './locales.ts'
import { renderMarkdown } from './markdown.ts'
import type { RpcFn } from './ObsidianPanel.tsx'

export interface NoteDoc {
  path: string
  title: string | null
  source: string
  version?: unknown
}

export function NoteEditor({
  path,
  rpc,
  t,
  onClose,
  onSaved,
  createIfMissing = false,
  seed = '',
}: {
  path: string
  rpc: RpcFn
  t: (key: ObsidianKey, params?: Record<string, unknown>) => string
  onClose: () => void
  onSaved: () => void
  createIfMissing?: boolean
  seed?: string
}) {
  const [doc, setDoc] = useState<NoteDoc | null>(null)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const load = async (target: string) => {
    setStatus('loading')
    setError(null)
    const res = await rpc('surface/preview', { path: target, allowMissing: createIfMissing })
    if (!res.ok) {
      setStatus('error')
      setError(res.error.message)
      return
    }
    const value = res.value as {
      path: string
      title: string | null
      source?: string
      body?: string
      version?: unknown
      missing?: boolean
    }
    const source = typeof value.source === 'string' ? value.source : String(value.body ?? '')
    const nextSource = value.missing === true ? '' : source
    setDoc({ path: value.path, title: value.title, source: nextSource, version: value.version })
    setDraft(value.missing === true ? seed : nextSource)
    setStatus('ready')
  }

  useEffect(() => { void load(path) }, [path, createIfMissing, seed])

  const dirty = doc !== null && draft !== doc.source
  const html = useMemo(() => renderMarkdown(draft), [draft])

  const close = () => {
    if (dirty && !window.confirm(t('home.editorDiscard'))) return
    onClose()
  }

  const save = async () => {
    if (doc === null || busy || !dirty) return
    setBusy(true)
    setError(null)
    const res = await rpc('surface/save', { path: doc.path, content: draft, version: doc.version })
    setBusy(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    const value = res.value as { path?: string; title?: string | null; source?: string; version?: unknown }
    const source = typeof value.source === 'string' ? value.source : draft
    setDoc({
      path: value.path ?? doc.path,
      title: value.title ?? doc.title,
      source,
      version: value.version ?? doc.version,
    })
    setDraft(source)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1600)
    onSaved()
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        close()
      }
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return createPortal(
    <div className="ob-overlay" data-dsh-obsidian-editor="">
      <button type="button" className="ob-overlay-back" aria-label={t('home.previewClose')} onClick={close} />
      <div className="ob-overlay-sheet" role="dialog" aria-modal="true">
        <header className="ob-modal-h">
          <div className="ob-modal-title">
            <div className="name">{doc?.title ?? path}</div>
            <div className="meta">{doc?.path ?? path}{dirty ? ' · ' + t('home.editorDirty') : savedFlash ? ' · ' + t('home.editorSaved') : ''}</div>
          </div>
          <div className="ob-actions">
            <button type="button" className="ob-btn primary" disabled={!dirty || busy || status !== 'ready'} onClick={() => { void save() }}>
              {t('home.editorSave')}
            </button>
            <button type="button" className="ob-btn" onClick={close}>{t('home.previewClose')}</button>
          </div>
        </header>
        {status === 'loading' && <div className="ob-hint wrap">{t('config.loading')}</div>}
        {error !== null && <div className="ob-msg err">{error}</div>}
        {status === 'ready' && (
          <div className="ob-editor">
            <section className="ob-editor-pane">
              <div className="ob-editor-label">{t('home.editorSource')}</div>
              <textarea
                className="ob-editor-src"
                value={draft}
                spellCheck={false}
                onChange={(ev) => setDraft(ev.target.value)}
              />
            </section>
            <section className="ob-editor-pane">
              <div className="ob-editor-label">{t('home.editorRender')}</div>
              <div className="ob-md" dangerouslySetInnerHTML={{ __html: html || ' ' }} />
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
