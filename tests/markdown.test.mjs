import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from '../src/client/markdown.ts'

test('renderMarkdown turns headings lists and emphasis into HTML', () => {
  const html = renderMarkdown('# Title\n\nHello **bold** and *em*.\n\n- a\n- b\n')
  assert.match(html, /<h1>Title<\/h1>/)
  assert.match(html, /<strong>bold<\/strong>/)
  assert.match(html, /<em>em<\/em>/)
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/)
})

test('renderMarkdown escapes raw HTML and keeps wikilinks', () => {
  const html = renderMarkdown('See [[Other|alias]] and <script>x</script>')
  assert.match(html, /<span class="wiki">alias<\/span>/)
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test('renderMarkdown shows frontmatter separately', () => {
  const html = renderMarkdown('---\ntags: x\n---\n# Hi')
  assert.match(html, /<pre class="fm">/)
  assert.match(html, /tags: x/)
  assert.match(html, /<h1>Hi<\/h1>/)
})
