import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import http from 'http'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OllamaModel = {
  name:        string
  size:        number
  modified_at: string
}

// ── Helpers HTTP ──────────────────────────────────────────────────────────────

function httpRequest(
  options: http.RequestOptions,
  body?: string
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, data }))
      res.on('error', reject)
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function httpStream(
  options: http.RequestOptions,
  body: string,
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errBody = ''
        res.on('data', (c: Buffer) => { errBody += c.toString() })
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody.slice(0, 300)}`)))
        return
      }
      let buffer = ''
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) onLine(line)
      })
      res.on('end', () => { if (buffer.trim()) onLine(buffer); resolve() })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export function registerOllamaHandlers(): void {

  // ── ollama:status — GET /api/tags ─────────────────────────────────────────
  ipcMain.handle('ollama:status', async () => {
    try {
      const { statusCode, data } = await httpRequest({
        hostname: 'localhost',
        port:     11434,
        path:     '/api/tags',
        method:   'GET'
      })

      if (statusCode >= 400) return { running: false, models: [] }

      const json  = JSON.parse(data)
      const models: OllamaModel[] = (json.models ?? []).map((m: {
        name: string; size: number; modified_at: string
      }) => ({
        name:        m.name,
        size:        m.size,
        modified_at: m.modified_at
      }))

      return { running: true, models }
    } catch {
      return { running: false, models: [] }
    }
  })

  // ── ollama:delete — DELETE /api/delete ───────────────────────────────────
  ipcMain.handle('ollama:delete', async (_event, name: string) => {
    try {
      const body = JSON.stringify({ name })
      const { statusCode } = await httpRequest(
        {
          hostname: 'localhost',
          port:     11434,
          path:     '/api/delete',
          method:   'DELETE',
          headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        },
        body
      )
      return statusCode < 400
    } catch {
      return false
    }
  })

  // ── ollama:pull — POST /api/pull (streaming NDJSON) ───────────────────────
  ipcMain.handle('ollama:pull', (event, name: string) => {
    const sender: WebContents = event.sender
    const body = JSON.stringify({ name, stream: true })

    ;(async () => {
      try {
        await httpStream(
          {
            hostname: 'localhost',
            port:     11434,
            path:     '/api/pull',
            method:   'POST',
            headers:  {
              'Content-Type':   'application/json',
              'Content-Length': Buffer.byteLength(body)
            }
          },
          body,
          (line) => {
            try {
              const parsed: {
                status:     string
                completed?: number
                total?:     number
              } = JSON.parse(line)

              if (parsed.status === 'success') {
                sender.send('ollama:pull:done', name)
              } else {
                sender.send('ollama:pull:progress', {
                  status:    parsed.status,
                  completed: parsed.completed,
                  total:     parsed.total
                })
              }
            } catch { /* ligne incomplète */ }
          }
        )
      } catch (err) {
        sender.send('ollama:pull:error', err instanceof Error ? err.message : String(err))
      }
    })()

    return null
  })
}
