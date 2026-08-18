/**
 * Call the host /obsidian channel. Never throws: a transport failure becomes
 * { ok: false } so the settings page cannot sit on "loading" forever.
 */

export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }

export type RpcFn = (endpoint: string, payload?: unknown) => Promise<RpcResult<unknown>>

const TIMEOUT_MS = 8000
const PICK_TIMEOUT_MS = 10 * 60 * 1000

function timeoutMs(endpoint: string) {
  return endpoint === 'vault/pick' ? PICK_TIMEOUT_MS : TIMEOUT_MS
}

interface ConnectionRpc {
  call: (channel: string, endpoint: string, payload: unknown, signal?: AbortSignal) => Promise<unknown>
}

function asResult(value: unknown, fallback: string): RpcResult<unknown> {
  if (value !== null && typeof value === 'object' && 'ok' in value) {
    const rec = value as { ok: unknown; value?: unknown; error?: { code?: string; message?: string } }
    if (rec.ok === true) return { ok: true, value: rec.value }
    return {
      ok: false,
      error: { code: rec.error?.code ?? 'error', message: rec.error?.message ?? fallback },
    }
  }
  return { ok: false, error: { code: 'error', message: fallback } }
}

async function fetchObsidian(endpoint: string, payload: unknown, signal: AbortSignal): Promise<RpcResult<unknown>> {
  const rpcId = crypto.randomUUID()
  const response = await fetch(new URL('/obsidian/' + endpoint, globalThis.location.origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId,
      method: endpoint,
      payload: payload ?? null,
    }),
    signal,
  })
  if (!response.ok) {
    return { ok: false, error: { code: 'http', message: 'HTTP ' + String(response.status) } }
  }
  const full = await response.json() as { result?: unknown }
  return asResult(full.result, 'empty rpc result')
}

export function createObsidianRpc(connection?: { rpc?: ConnectionRpc }): RpcFn {
  return async (endpoint, payload) => {
    const signal = AbortSignal.timeout(timeoutMs(endpoint))
    try {
      if (connection?.rpc !== undefined && typeof connection.rpc.call === 'function') {
        const raw = await connection.rpc.call('/obsidian', endpoint, payload ?? null, signal)
        return asResult(raw, 'invalid rpc result')
      }
      return await fetchObsidian(endpoint, payload, signal)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      try {
        return await fetchObsidian(endpoint, payload, AbortSignal.timeout(timeoutMs(endpoint)))
      } catch {
        return { ok: false, error: { code: 'transport', message } }
      }
    }
  }
}
