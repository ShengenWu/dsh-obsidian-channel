import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { normalizePickedPath, pickFolder, pickFolderCommand, relativeInside } from '../src/pick-folder.js'

test('normalizePickedPath strips quotes and trailing slashes', () => {
  assert.equal(normalizePickedPath('  /Users/me/vault/\n'), '/Users/me/vault')
  assert.equal(normalizePickedPath('"/Users/me/vault"'), '/Users/me/vault')
  assert.equal(normalizePickedPath('C:\\Notes\\'), 'C:\\Notes')
  assert.equal(normalizePickedPath(''), '')
})

test('pickFolderCommand uses a native picker per platform', () => {
  assert.equal(pickFolderCommand('darwin').command, 'osascript')
  assert.equal(pickFolderCommand('win32').command, 'powershell')
  assert.equal(pickFolderCommand('linux').command, 'zenity')
})

test('pickFolderCommand starts inside the given folder', () => {
  const mac = pickFolderCommand('darwin', { startDir: '/Users/me/vault', prompt: '选择日记所在文件夹' })
  assert.match(mac.args[1], /default location start/)
  assert.match(mac.args[1], /Users\/me\/vault/)
  assert.doesNotMatch(mac.args[1], /Finder/)
  const win = pickFolderCommand('win32', { startDir: 'C:\\Notes' })
  assert.match(win.args.at(-1), /SelectedPath/)
  const linux = pickFolderCommand('linux', { startDir: '/home/me/vault' })
  assert.ok(linux.args.some((arg) => arg.startsWith('--filename=/home/me/vault/')))
})

test('relativeInside keeps a vault-relative path', () => {
  assert.equal(relativeInside('/Users/me/vault', '/Users/me/vault/Daily', 'darwin'), 'Daily')
  assert.equal(relativeInside('/Users/me/vault/', '/Users/me/vault/Journal/2026', 'darwin'), 'Journal/2026')
  assert.equal(relativeInside('/Users/me/vault', '/Users/me/vault', 'darwin'), '')
  assert.equal(relativeInside('/Users/me/vault', '/Users/me/other', 'darwin'), null)
  assert.equal(relativeInside('C:\\Notes', 'C:\\Notes\\Daily', 'win32'), 'Daily')
})

function fakeSpawn(stdout, code = 0) {
  return () => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    queueMicrotask(() => {
      if (stdout !== '') child.stdout.emit('data', stdout)
      child.emit('close', code)
    })
    return child
  }
}

test('pickFolder returns the chosen path', async () => {
  const result = await pickFolder({ spawn: fakeSpawn('/Users/me/Notes/\n'), platform: 'darwin' })
  assert.deepEqual(result, { path: '/Users/me/Notes' })
})

test('pickFolder treats empty output as cancel', async () => {
  const result = await pickFolder({ spawn: fakeSpawn('', 1), platform: 'linux' })
  assert.deepEqual(result, { cancelled: true })
})
