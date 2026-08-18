/**
 * Native folder picker on the host. The web client cannot see a real
 * filesystem path from <input type=file> / showDirectoryPicker.
 */

function applescriptString(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function powershellSingle(value) {
  return "'" + String(value).replace(/'/g, "''") + "'"
}

export function pickFolderCommand(platform = process.platform, opts = {}) {
  const prompt = typeof opts.prompt === 'string' && opts.prompt !== '' ? opts.prompt : '选择文件夹'
  const startDir = typeof opts.startDir === 'string' ? opts.startDir.trim() : ''

  if (platform === 'darwin') {
    const lines = [
      'try',
    ]
    if (startDir !== '') {
      lines.push('set start to POSIX file ' + applescriptString(startDir))
      lines.push('POSIX path of (choose folder with prompt ' + applescriptString(prompt) + ' default location start)')
    } else {
      lines.push('POSIX path of (choose folder with prompt ' + applescriptString(prompt) + ')')
    }
    lines.push('on error number -128', 'return ""', 'end try')
    return { command: 'osascript', args: ['-e', lines.join('\n')] }
  }

  if (platform === 'win32') {
    const statements = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
      '$d.Description = ' + powershellSingle(prompt),
      '$d.ShowNewFolderButton = $false',
    ]
    if (startDir !== '') statements.push('$d.SelectedPath = ' + powershellSingle(startDir))
    statements.push('if ($d.ShowDialog() -eq "OK") { [Console]::Out.Write($d.SelectedPath) }')
    return {
      command: 'powershell',
      args: ['-NoProfile', '-STA', '-Command', statements.join('; ')],
    }
  }

  const args = ['--file-selection', '--directory', '--title=' + prompt]
  if (startDir !== '') args.push('--filename=' + startDir.replace(/\/?$/, '/') )
  return { command: 'zenity', args }
}

export function normalizePickedPath(raw) {
  let path = String(raw ?? '').trim()
  if (path === '') return ''
  if ((path.startsWith('"') && path.endsWith('"')) || (path.startsWith("'") && path.endsWith("'"))) {
    path = path.slice(1, -1).trim()
  }
  if (path.length > 1 && (path.endsWith('/') || path.endsWith('\\'))) {
    path = path.slice(0, -1)
  }
  return path
}

export function relativeInside(root, picked, platform = process.platform) {
  const a = normalizePickedPath(root).replace(/\\/g, '/')
  const b = normalizePickedPath(picked).replace(/\\/g, '/')
  if (a === '' || b === '') return null
  const fold = platform === 'win32' || platform === 'darwin'
    ? (value) => value.toLowerCase()
    : (value) => value
  if (fold(b) === fold(a)) return ''
  if (fold(b).startsWith(fold(a) + '/')) return b.slice(a.length + 1)
  return null
}

export async function pickFolder(deps = {}) {
  const spawn = deps.spawn ?? (await import('node:child_process')).spawn
  const platform = deps.platform ?? process.platform
  const spec = pickFolderCommand(platform, { prompt: deps.prompt, startDir: deps.startDir })
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', (chunk) => { err += chunk })
    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      const path = normalizePickedPath(out)
      if (path !== '') {
        resolve({ path })
        return
      }
      // osascript cancel → 0 + empty; zenity cancel → 1
      if (code === 0 || code === 1) {
        resolve({ cancelled: true })
        return
      }
      reject(new Error((err.trim() || spec.command + ' exited ' + String(code))))
    })
  })
}
