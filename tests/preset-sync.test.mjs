import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OBSIDIAN_PRESET_ID, syncObsidianPreset } from '../src/preset-sync.js'

test('syncObsidianPreset copies bundled files into DSH_HOME', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-ob-preset-'))
  const prev = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    const dest = syncObsidianPreset()
    assert.equal(dest, join(home, '.agent-presets', OBSIDIAN_PRESET_ID))
    assert.equal(existsSync(join(dest, 'preset.yml')), true)
    assert.equal(existsSync(join(dest, 'agent.cordis.yml')), true)
    const meta = readFileSync(join(dest, 'preset.yml'), 'utf8')
    assert.match(meta, /Obsidian 模式/)
    const agent = readFileSync(join(dest, 'agent.cordis.yml'), 'utf8')
    assert.match(agent, /knowledge collaborator/)
    assert.doesNotMatch(agent, /You are a coding agent/)
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prev
    rmSync(home, { recursive: true, force: true })
  }
})
