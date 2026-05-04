/**
 * Native Node.js HTTPS fetch — bypasses Next.js's patched globalThis.fetch.
 *
 * Next.js wraps globalThis.fetch (undici) with ISR caching and request
 * deduplication. In API route contexts this patched fetch sometimes throws
 * "TypeError: fetch failed" when calling Supabase PostgREST, even though
 * the same Supabase hostname is reachable via node:https (as proven by the
 * storage upload path using the same host).
 *
 * This implementation mirrors the node:https approach already used by
 * uploadToStorageNative() in the upload route, making all service-client
 * DB calls consistent with working storage calls.
 */
import * as https from 'node:https'
import * as http from 'node:http'

const DEFAULT_TIMEOUT_MS = 30_000

function headersToRecord(src: RequestInit['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  if (!src) return out
  if (src instanceof Headers) {
    src.forEach((v, k) => { out[k] = v })
  } else if (Array.isArray(src)) {
    ;(src as [string, string][]).forEach(([k, v]) => { out[k] = v })
  } else {
    Object.assign(out, src as Record<string, string>)
  }
  return out
}

async function toBuffer(body: RequestInit['body']): Promise<Buffer | null> {
  if (body == null) return null
  if (typeof body === 'string') return Buffer.from(body, 'utf-8')
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  // ReadableStream / Blob — read fully
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer())
  if (typeof (body as ReadableStream).getReader === 'function') {
    const reader = (body as ReadableStream<Uint8Array>).getReader()
    const parts: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) parts.push(value)
    }
    return Buffer.concat(parts)
  }
  return Buffer.from(String(body), 'utf-8')
}

export async function nodeFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  // Normalise URL
  const rawUrl =
    typeof input === 'string' ? input
    : input instanceof URL ? input.href
    : (input as Request).url
  const url = new URL(rawUrl)

  // Merge headers (Request object first, then init override)
  const baseHeaders = input instanceof Request ? headersToRecord(input.headers) : {}
  const initHeaders = headersToRecord(init.headers)
  const headers: Record<string, string> = { ...baseHeaders, ...initHeaders }

  // Method
  const method = (
    init.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase()

  // Body
  const rawBody = init.body ?? (input instanceof Request ? (input as Request).body : null)
  const bodyBuf = rawBody instanceof ReadableStream ? await toBuffer(rawBody as BodyInit) : await toBuffer(rawBody as BodyInit)
  if (bodyBuf) {
    headers['content-length'] ??= String(bodyBuf.length)
  }

  // Transport
  const isHttps = url.protocol === 'https:'
  const transport = isHttps ? https : http
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80

  // Merge abort signals: init.signal + our 30s timeout
  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => timeoutCtrl.abort(new Error('nodeFetch timeout')), DEFAULT_TIMEOUT_MS)

  // Combine the caller's signal with our timeout signal (Node 18+ AbortSignal.any not always available)
  const callerSignal = init.signal as AbortSignal | null | undefined
  const abortHandler = () => timeoutCtrl.abort()
  if (callerSignal && !callerSignal.aborted) {
    callerSignal.addEventListener('abort', abortHandler, { once: true })
  }

  try {
    return await new Promise<Response>((resolve, reject) => {
      // Forward abort to the in-flight http request
      timeoutCtrl.signal.addEventListener('abort', () => req.destroy(new Error('request aborted')), { once: true })

      const req = transport.request(
        {
          hostname: url.hostname,
          port,
          path: url.pathname + url.search,
          method,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => {
            clearTimeout(timer)
            const status = res.statusCode ?? 200
            const responseHeaders = new Headers()
            for (const [k, v] of Object.entries(res.headers)) {
              if (v == null) continue
              if (Array.isArray(v)) v.forEach((vv) => responseHeaders.append(k, vv))
              else responseHeaders.set(k, v)
            }
            // WHATWG Fetch spec §2.2: 101, 204, 205, 304 are "null body statuses".
            // The undici Response constructor throws if a body (even empty Buffer) is
            // passed for these statuses. Pass null explicitly to stay spec-compliant.
            const NULL_BODY_STATUSES = [101, 204, 205, 304]
            const responseBody = NULL_BODY_STATUSES.includes(status) ? null : Buffer.concat(chunks)
            resolve(
              new Response(responseBody, {
                status,
                statusText: res.statusMessage ?? '',
                headers: responseHeaders,
              }),
            )
          })
          res.on('error', (err) => { clearTimeout(timer); reject(err) })
        },
      )

      req.on('error', (err) => { clearTimeout(timer); reject(err) })

      if (bodyBuf) req.write(bodyBuf)
      req.end()
    })
  } finally {
    callerSignal?.removeEventListener('abort', abortHandler)
  }
}
