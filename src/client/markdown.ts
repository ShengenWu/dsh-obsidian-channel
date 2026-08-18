/** Small, escaped Markdown renderer for the in-app note preview. */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (/^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#')) return href
  return null
}

function inline(text: string): string {
  let out = escapeHtml(text)
  const codes: string[] = []
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    codes.push('<code>' + code + '</code>')
    return '\u0000C' + String(codes.length - 1) + '\u0000'
  })
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, href) => {
    const safe = safeHref(href)
    if (safe === null) return escapeHtml(alt || href)
    return '<img alt="' + alt + '" src="' + escapeHtml(safe) + '">'
  })
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safe = safeHref(href)
    if (safe === null) return label
    return '<a href="' + escapeHtml(safe) + '" target="_blank" rel="noreferrer">' + label + '</a>'
  })
  out = out.replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
    return '<span class="wiki">' + (alias || target) + '</span>'
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>')
  out = out.replace(/(^|[\s(])#([A-Za-z0-9_\u4e00-\u9fff/-]+)/g, '$1<span class="tag">#$2</span>')
  return out.replace(/\u0000C(\d+)\u0000/g, (_, i) => codes[Number(i)] ?? '')
}

function splitFrontmatter(source: string): { fm: string | null; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (match === null) return { fm: null, body: source }
  return { fm: match[1] ?? '', body: source.slice(match[0].length) }
}

function flushParagraph(buf: string[], html: string[]) {
  const text = buf.join('\n').trim()
  if (text !== '') html.push('<p>' + inline(text).replace(/\n/g, '<br>') + '</p>')
  buf.length = 0
}

export function renderMarkdown(source: string): string {
  const { fm, body } = splitFrontmatter(source)
  const html: string[] = []
  if (fm !== null && fm.trim() !== '') {
    html.push('<pre class="fm">' + escapeHtml(fm) + '</pre>')
  }

  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const para: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line.startsWith('```')) {
      flushParagraph(para, html)
      const lang = escapeHtml(line.slice(3).trim())
      const chunk: string[] = []
      i += 1
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        chunk.push(lines[i] ?? '')
        i += 1
      }
      html.push('<pre><code' + (lang !== '' ? ' data-lang="' + lang + '"' : '') + '>' + escapeHtml(chunk.join('\n')) + '</code></pre>')
      i += 1
      continue
    }

    const heading = /^(#{1,6})[ \t]+(.+)$/.exec(line)
    if (heading !== null) {
      flushParagraph(para, html)
      const level = heading[1]?.length ?? 1
      html.push('<h' + String(level) + '>' + inline(heading[2] ?? '') + '</h' + String(level) + '>')
      i += 1
      continue
    }

    if (/^([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph(para, html)
      html.push('<hr>')
      i += 1
      continue
    }

    if (/^>[ \t]?/.test(line)) {
      flushParagraph(para, html)
      const quote: string[] = []
      while (i < lines.length && /^>[ \t]?/.test(lines[i] ?? '')) {
        quote.push((lines[i] ?? '').replace(/^>[ \t]?/, ''))
        i += 1
      }
      html.push('<blockquote>' + renderMarkdown(quote.join('\n')) + '</blockquote>')
      continue
    }

    if (/^\s*[-*][ \t]+/.test(line) || /^\s*\d+\.[ \t]+/.test(line)) {
      flushParagraph(para, html)
      const ordered = /^\s*\d+\.[ \t]+/.test(line)
      const items: string[] = []
      while (i < lines.length && (ordered ? /^\s*\d+\.[ \t]+/ : /^\s*[-*][ \t]+/).test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(ordered ? /^\s*\d+\.[ \t]+/ : /^\s*[-*][ \t]+/, ''))
        i += 1
      }
      const tag = ordered ? 'ol' : 'ul'
      html.push('<' + tag + '>' + items.map((item) => '<li>' + inline(item) + '</li>').join('') + '</' + tag + '>')
      continue
    }

    if (line.trim() === '') {
      flushParagraph(para, html)
      i += 1
      continue
    }

    para.push(line)
    i += 1
  }
  flushParagraph(para, html)
  return html.join('')
}
