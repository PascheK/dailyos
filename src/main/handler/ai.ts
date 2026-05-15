import { ipcMain } from 'electron'
import type { WebContents } from 'electron'
import https from 'https'
import http from 'http'
import fs from 'fs'
import { db } from '../db'
import { getSettings, getApiKey } from '../store'

// ── Types ────────────────────────────────────────────────────────────────────

type ApiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type ReasoningMode = 'direct' | 'thoughtful' | 'creative' | 'structured' | 'technical'

type UserProfile = {
  name?: string
  domain?: string
  goals?: string
  style?: string
}

type ChatPayload = {
  message:        string
  reasoningMode:  ReasoningMode
  profile:        UserProfile | null
  conversationId: number
}

export type AiActionCreateEvent = {
  type:         'create_event'
  title:        string
  start_at:     string   // "YYYY-MM-DDTHH:mm"
  end_at:       string
  all_day:      boolean
  description?: string
  category?:    string
  color?:       string
}

export type AiActionCreateNote = {
  type:    'create_note'
  title:   string
  content: string
}

export type AiAction = AiActionCreateEvent | AiActionCreateNote

// ── Instructions de raisonnement ─────────────────────────────────────────────

const REASONING_INSTRUCTIONS: Record<ReasoningMode, string> = {
  direct:
    'Réponds de façon **concise et directe**. Va droit au but, sans préambule ni reformulation.',
  thoughtful:
    'Raisonne **étape par étape** avant de conclure. Montre ton processus : hypothèses, analyse, conclusion.',
  creative:
    'Adopte un mode **exploration créative**. Propose plusieurs approches différentes, favorise l\'originalité.',
  structured:
    'Structure ta réponse avec des **titres, listes et sous-sections**. Privilégie la lisibilité.',
  technical:
    'Réponds avec **précision technique**. Utilise du code si pertinent, cite les bonnes pratiques.',
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(mode: ReasoningMode, profile: UserProfile | null): string {
  const now   = new Date()
  const today = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  // Format ISO pour que l'IA génère des dates correctes
  const isoNow = now.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"

  const events = db.prepare(`
    SELECT title, start_at, end_at, all_day
    FROM events
    WHERE date(start_at) >= date('now', '-1 day')
      AND date(start_at) <= date('now', '+7 days')
    ORDER BY start_at LIMIT 15
  `).all() as { title: string; start_at: string; end_at: string; all_day: number }[]

  const noteRows = db.prepare(`
    SELECT id, name, path FROM files
    WHERE mime_type = 'text/markdown'
    ORDER BY created_at DESC LIMIT 8
  `).all() as { id: number; name: string; path: string }[]

  const notesWithContent = noteRows.slice(0, 3).map((n) => {
    let content = ''
    try { content = fs.readFileSync(n.path, 'utf-8').slice(0, 600) } catch {}
    return { name: n.name.replace(/\.md$/, ''), content }
  })
  const noteTitlesOnly = noteRows.slice(3).map((n) => n.name.replace(/\.md$/, ''))
  const fileCount = (db.prepare('SELECT COUNT(*) as c FROM files').get() as { c: number }).c

  // ── Profil ───────────────────────────────────────────────────────────────
  let profileSection = ''
  if (profile?.name) {
    profileSection = `\n## Profil utilisateur\n`
    profileSection += `- **Prénom :** ${profile.name}\n`
    if (profile.domain) profileSection += `- **Domaine :** ${profile.domain}\n`
    if (profile.goals)  profileSection += `- **Objectif :** ${profile.goals}\n`
    if (profile.style)  profileSection += `- **Style préféré :** ${profile.style}\n`
  }

  // ── Agenda ───────────────────────────────────────────────────────────────
  let agendaSection = '\n## Agenda — 7 prochains jours\n'
  if (events.length > 0) {
    for (const ev of events) {
      const start   = new Date(ev.start_at)
      const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      const timeStr = ev.all_day ? 'Journée entière' : start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      agendaSection += `- **${ev.title}** — ${dateStr} ${timeStr}\n`
    }
  } else {
    agendaSection += 'Aucun événement.\n'
  }

  // ── Notes ────────────────────────────────────────────────────────────────
  let notesSection = '\n## Notes récentes\n'
  for (const note of notesWithContent) {
    notesSection += `\n**${note.name}**\n`
    if (note.content.trim()) notesSection += `\`\`\`\n${note.content.trim()}\n\`\`\`\n`
  }
  if (noteTitlesOnly.length > 0) {
    notesSection += `\nAutres notes : ${noteTitlesOnly.join(', ')}\n`
  }

  // ── Budget ───────────────────────────────────────────────────────────────
  let budgetSection = ''
  try {
    const budgets = db.prepare('SELECT * FROM budgets ORDER BY created_at DESC LIMIT 3').all() as {
      id: number; name: string; total_amount: number; currency: string
      start_date: string; end_date: string
    }[]

    if (budgets.length > 0) {
      budgetSection = '\n## Budgets actifs\n'
      for (const b of budgets) {
        const extras = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM budget_extra_items WHERE budget_id = ?').get(b.id) as { s: number }
        const spent  = db.prepare(
          `SELECT COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) -
                  COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as net
           FROM budget_transactions WHERE budget_id = ?`
        ).get(b.id) as { net: number }
        const available  = b.total_amount - extras.s
        const remaining  = available - (spent.net ?? 0)
        // Mois courant
        const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2,'0')}`
        const periodStart = `${ym}-01`
        const periodSpent = db.prepare(
          `SELECT COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) as s
           FROM budget_transactions WHERE budget_id = ? AND date >= ?`
        ).get(b.id, periodStart) as { s: number }
        const goal = db.prepare(
          'SELECT monthly_target, critical_threshold FROM budget_ai_goals WHERE budget_id = ? ORDER BY recalculated_at DESC LIMIT 1'
        ).get(b.id) as { monthly_target: number; critical_threshold: number } | undefined

        budgetSection += `\n### Budget : ${b.name}\n`
        budgetSection += `- Période : ${b.start_date} → ${b.end_date}\n`
        budgetSection += `- Total : ${b.total_amount} ${b.currency} | Hors-budget : ${extras.s} ${b.currency}\n`
        budgetSection += `- Restant : ${remaining.toFixed(2)} ${b.currency}\n`
        budgetSection += `- Dépensé ce mois : ${periodSpent.s.toFixed(2)} ${b.currency}\n`
        if (goal) {
          budgetSection += `- Objectif mensuel : ${goal.monthly_target.toFixed(2)} ${b.currency} | Seuil critique : ${goal.critical_threshold.toFixed(2)} ${b.currency}\n`
        }
        const recentTx = db.prepare(
          `SELECT t.date, t.amount_base, t.is_revenue, c.name as cat
           FROM budget_transactions t LEFT JOIN budget_categories c ON t.category_id = c.id
           WHERE t.budget_id = ? ORDER BY t.date DESC LIMIT 5`
        ).all(b.id) as { date: string; amount_base: number; is_revenue: number; cat: string | null }[]
        if (recentTx.length > 0) {
          budgetSection += `- Dernières transactions :\n`
          for (const tx of recentTx) {
            budgetSection += `  - ${tx.date} | ${tx.is_revenue ? '+' : '-'}${tx.amount_base.toFixed(2)}${b.currency} | ${tx.cat ?? 'Autre'}\n`
          }
        }
      }
    }
  } catch { /* silencieux si tables pas encore créées */ }

  const modeInstruction = REASONING_INSTRUCTIONS[mode] ?? REASONING_INSTRUCTIONS.direct

  return `Tu es **DailyOS Assistant**, un assistant de productivité personnel intégré à DailyOS.
Tu réponds en **français** par défaut (sauf si l'utilisateur écrit dans une autre langue).
${profileSection}
## Contexte
- **Date du jour :** ${today}
- **Datetime ISO actuelle :** ${isoNow}
- **Fichiers stockés :** ${fileCount}
${agendaSection}${notesSection}${budgetSection}
## Mode de réponse actif
${modeInstruction}

## Actions disponibles
Tu peux créer des événements et des notes pour l'utilisateur.
Quand l'utilisateur te le demande, réponds-lui naturellement, puis **à la toute fin** de ta réponse ajoute un bloc action JSON.

### Créer un événement
\`\`\`action
{
  "type": "create_event",
  "title": "Titre de l'événement",
  "start_at": "YYYY-MM-DDTHH:mm",
  "end_at": "YYYY-MM-DDTHH:mm",
  "all_day": false,
  "description": "Description optionnelle",
  "category": "default",
  "color": "#1A56DB"
}
\`\`\`

### Créer une note
\`\`\`action
{
  "type": "create_note",
  "title": "Titre de la note",
  "content": "# Titre\\n\\nContenu en markdown..."
}
\`\`\`

**Règles impératives pour les actions :**
- N'inclus un bloc action QUE si tu crées réellement quelque chose (l'utilisateur le demande explicitement).
- Le bloc action doit être le **dernier élément** de ta réponse, après tout le texte.
- Utilise la datetime ISO actuelle (${isoNow}) comme référence pour calculer les dates.
- Pour les événements sans heure précisée, utilise 09:00–10:00 par défaut.
- Pour les journées entières, mets \`"all_day": true\` et des heures 00:00–23:59.
- Le JSON doit être **valide et complet** (pas de champs manquants obligatoires).

## Règles générales
- Utilise du Markdown (titres, listes, gras, code) pour la lisibilité.
- Sois bienveillant, professionnel et efficace.`
}

// ── Parser d'action ───────────────────────────────────────────────────────────

const ACTION_OPEN  = '```action'
const ACTION_CLOSE = '```'

function parseActionBlock(content: string): { cleanContent: string; action: AiAction | null } {
  const openIdx = content.indexOf(ACTION_OPEN)
  if (openIdx === -1) return { cleanContent: content, action: null }

  const afterOpen = content.indexOf('\n', openIdx) // saut de ligne après ```action
  if (afterOpen === -1) return { cleanContent: content.slice(0, openIdx).trim(), action: null }

  const closeIdx = content.indexOf(ACTION_CLOSE, afterOpen + 1)
  if (closeIdx === -1) return { cleanContent: content.slice(0, openIdx).trim(), action: null }

  const jsonStr = content.slice(afterOpen, closeIdx).trim()
  let action: AiAction | null = null
  try {
    const parsed = JSON.parse(jsonStr)
    if (parsed.type === 'create_event' || parsed.type === 'create_note') {
      action = parsed as AiAction
    }
  } catch (e) {
    console.error('[AI] Erreur parse action JSON:', e, jsonStr)
  }

  const cleanContent = content.slice(0, openIdx).trim()
  return { cleanContent, action }
}

// ── Streaming HTTP/HTTPS avec buffering anti-action ───────────────────────────

/**
 * Crée un gestionnaire de texte qui buffer la fin du stream pour éviter
 * d'envoyer le bloc ```action au renderer, et retourne le contenu final.
 */
function createStreamBuffer(sender: WebContents): {
  feed: (text: string) => void
  flush: () => string
} {
  // On bufferise les N derniers chars pour détecter le marqueur avant de l'envoyer
  const LOOKAHEAD = ACTION_OPEN.length + 2
  let pending = ''
  let full    = ''
  let blocked = false // on a détecté ```action → on ne forward plus rien

  const feed = (text: string): void => {
    full += text
    if (blocked) return

    pending += text
    const markerIdx = pending.indexOf(ACTION_OPEN)

    if (markerIdx !== -1) {
      // Envoyer uniquement ce qui précède le marqueur
      const safe = pending.slice(0, markerIdx)
      if (safe) sender.send('ai:chunk', safe)
      blocked = true
      pending = ''
    } else {
      // Envoyer tout sauf les LOOKAHEAD derniers chars (bord de marqueur potentiel)
      const sendable = Math.max(0, pending.length - LOOKAHEAD)
      if (sendable > 0) {
        sender.send('ai:chunk', pending.slice(0, sendable))
        pending = pending.slice(sendable)
      }
    }
  }

  const flush = (): string => {
    // Si pas de marqueur, vider le pending buffer
    if (!blocked && pending) {
      sender.send('ai:chunk', pending)
      pending = ''
    }
    return full
  }

  return { feed, flush }
}

// ── Streaming HTTP/HTTPS ──────────────────────────────────────────────────────

function streamRequest(
  url: string,
  headers: Record<string, string>,
  body: object,
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const mod     = isHttps ? https : http
    const bodyStr = JSON.stringify(body)

    const req = mod.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname + (parsed.search || ''),
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          ...headers
        }
      },
      (res) => {
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
          for (const line of lines) onLine(line)
        })
        res.on('end', () => { if (buffer) onLine(buffer); resolve() })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

// ── Providers ─────────────────────────────────────────────────────────────────

async function streamOpenAI(
  messages: ApiMessage[], apiKey: string,
  model: string, temperature: number,
  buf: ReturnType<typeof createStreamBuffer>
): Promise<void> {
  await streamRequest(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    { model, messages, temperature, stream: true },
    (line) => {
      if (!line.startsWith('data: ')) return
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const text = JSON.parse(data).choices?.[0]?.delta?.content ?? ''
        if (text) buf.feed(text)
      } catch { /* ligne incomplète */ }
    }
  )
}

async function streamAnthropic(
  messages: ApiMessage[], apiKey: string,
  model: string, temperature: number,
  buf: ReturnType<typeof createStreamBuffer>
): Promise<void> {
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
  const chatMsgs  = messages.filter((m) => m.role !== 'system')
  await streamRequest(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { model, system: systemMsg, messages: chatMsgs, max_tokens: 4096, temperature, stream: true },
    (line) => {
      if (!line.startsWith('data: ')) return
      try {
        const chunk = JSON.parse(line.slice(6).trim())
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          const text = chunk.delta.text ?? ''
          if (text) buf.feed(text)
        }
      } catch { /* ignore */ }
    }
  )
}

async function streamOllama(
  messages: ApiMessage[], model: string,
  temperature: number,
  buf: ReturnType<typeof createStreamBuffer>
): Promise<void> {
  await streamRequest(
    'http://localhost:11434/api/chat',
    {},
    { model, messages, stream: true, options: { temperature } },
    (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      try {
        const text = JSON.parse(trimmed).message?.content ?? ''
        if (text) buf.feed(text)
      } catch { /* ignore */ }
    }
  )
}

// ── Helpers conversations ─────────────────────────────────────────────────────

function ensureConversation(id: number): boolean {
  return db.prepare('SELECT id FROM conversations WHERE id = ?').get(id) != null
}

function touchConversation(id: number): void {
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(id)
}

function autoTitleConversation(convId: number, firstMessage: string): void {
  const conv = db.prepare('SELECT title FROM conversations WHERE id = ?').get(convId) as { title: string } | undefined
  if (!conv || conv.title !== 'Nouvelle conversation') return
  const title = firstMessage.slice(0, 50).trim() + (firstMessage.length > 50 ? '…' : '')
  db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, convId)
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export function registerAiHandlers(): void {

  // ── CONVERSATIONS CRUD ──────────────────────────────────────────────────

  ipcMain.handle('ai:conversations:list', () =>
    db.prepare('SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC').all()
  )

  ipcMain.handle('ai:conversations:create', () => {
    const info = db.prepare("INSERT INTO conversations (title) VALUES ('Nouvelle conversation')").run()
    return db.prepare('SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?')
      .get(info.lastInsertRowid)
  })

  ipcMain.handle('ai:conversations:rename', (_event, { id, title }: { id: number; title: string }) => {
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?')
      .run(title.trim().slice(0, 100) || 'Nouvelle conversation', id)
    return true
  })

  ipcMain.handle('ai:conversations:delete', (_event, id: number) => {
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
    return true
  })

  // ── CHAT ────────────────────────────────────────────────────────────────

  ipcMain.handle('ai:chat', async (event, payload: ChatPayload) => {
    const sender = event.sender
    const { message, reasoningMode = 'direct', profile = null, conversationId } = payload

    if (!ensureConversation(conversationId)) {
      sender.send('ai:error', 'Conversation introuvable.')
      return null
    }

    const settings    = getSettings()
    const provider    = settings.ai?.provider ?? 'openai'
    const model       = settings.ai?.model ?? 'gpt-4o-mini'
    const temperature = settings.ai?.temperature ?? 0.7

    db.prepare('INSERT INTO messages (role, content, provider, model, conversation_id) VALUES (?, ?, ?, ?, ?)')
      .run('user', message, provider, model, conversationId)

    const msgCount = (db.prepare('SELECT COUNT(*) as c FROM messages WHERE conversation_id = ?').get(conversationId) as { c: number }).c
    if (msgCount === 1) autoTitleConversation(conversationId, message)

    touchConversation(conversationId)

    const history = db.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 40'
    ).all(conversationId).reverse() as { role: string; content: string }[]

    const apiMessages: ApiMessage[] = [
      { role: 'system', content: buildSystemPrompt(reasoningMode, profile) },
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    ;(async () => {
      try {
        const buf = createStreamBuffer(sender)

        if (provider === 'openai') {
          const key = getApiKey('openai')
          if (!key) throw new Error('Clé OpenAI manquante — Paramètres → IA & API.')
          await streamOpenAI(apiMessages, key, model, temperature, buf)
        } else if (provider === 'anthropic') {
          const key = getApiKey('anthropic')
          if (!key) throw new Error('Clé Anthropic manquante — Paramètres → IA & API.')
          await streamAnthropic(apiMessages, key, model, temperature, buf)
        } else if (provider === 'ollama') {
          await streamOllama(apiMessages, model, temperature, buf)
        } else {
          throw new Error(`Provider inconnu : ${provider}`)
        }

        const fullContent = buf.flush()
        const { cleanContent, action } = parseActionBlock(fullContent)

        // Sauvegarder le contenu sans le bloc action
        db.prepare('INSERT INTO messages (role, content, provider, model, conversation_id) VALUES (?, ?, ?, ?, ?)')
          .run('assistant', cleanContent, provider, model, conversationId)

        touchConversation(conversationId)

        // Signaler la fin avec le contenu propre et l'action éventuelle
        sender.send('ai:done', { cleanContent, action })
        sender.send('ai:conversation:updated', conversationId)

      } catch (err) {
        sender.send('ai:error', err instanceof Error ? err.message : String(err))
      }
    })()

    return null
  })

  // ── HISTORY ─────────────────────────────────────────────────────────────

  ipcMain.handle('ai:history', (_event, conversationId: number) =>
    db.prepare(
      'SELECT id, role, content, provider, model, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC'
    ).all(conversationId)
  )

  // ── CLEAR ────────────────────────────────────────────────────────────────

  ipcMain.handle('ai:clear', (_event, conversationId: number) => {
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId)
    db.prepare("UPDATE conversations SET title = 'Nouvelle conversation', updated_at = datetime('now') WHERE id = ?")
      .run(conversationId)
    return true
  })

  // ── STATUS ───────────────────────────────────────────────────────────────

  ipcMain.handle('ai:status', () => {
    const s = getSettings()
    const provider = s.ai?.provider ?? 'openai'
    return {
      provider,
      model:  s.ai?.model ?? 'gpt-4o-mini',
      hasKey: provider !== 'ollama' ? !!getApiKey(provider) : true
    }
  })
}
