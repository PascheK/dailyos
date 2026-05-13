import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Trash2, Sparkles, Loader2, AlertCircle,
  Settings, Bot, User, Zap, Brain, Server,
  ChevronRight, Target, Lightbulb, LayoutList, Code2,
  Plus, X, FileText, CalendarDays, ListTodo,
  MessageSquare, Pencil, Check
} from 'lucide-react'
import { ActionConfirmModal } from '../components/ai/ActionConfirmModal'
import { useAiStream } from '../context/AiStreamContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReasoningMode = 'direct' | 'thoughtful' | 'creative' | 'structured' | 'technical'

type LocalMessage = {
  id: number | string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// ── Constantes ────────────────────────────────────────────────────────────────

const REASONING_MODES: { id: ReasoningMode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'direct',     label: 'Direct',    icon: Target,     desc: 'Réponse concise et directe' },
  { id: 'thoughtful', label: 'Réfléchi',  icon: Brain,      desc: 'Raisonnement étape par étape' },
  { id: 'creative',   label: 'Créatif',   icon: Lightbulb,  desc: 'Exploration et idées originales' },
  { id: 'structured', label: 'Organisé',  icon: LayoutList, desc: 'Réponse structurée avec titres' },
  { id: 'technical',  label: 'Technique', icon: Code2,      desc: 'Précision technique et code' },
]

const PROVIDER_LABEL: Record<string, string> = {
  openai:    'OpenAI',
  anthropic: 'Anthropic',
  ollama:    'Ollama (local)',
}

// ── Liste des conversations ────────────────────────────────────────────────────

function ConversationItem({
  conv, active, onSelect, onRename, onDelete
}: {
  conv: AiConversation
  active: boolean
  onSelect: () => void
  onRename: (title: string) => void
  onDelete: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(conv.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) { setDraft(conv.title); inputRef.current?.focus(); inputRef.current?.select() } }, [editing, conv.title])

  const commit = (): void => {
    const clean = draft.trim() || conv.title
    onRename(clean)
    setEditing(false)
  }

  // Date relative courte
  const relativeDate = (iso: string): string => {
    const d    = new Date(iso)
    const now  = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 60)     return "À l'instant"
    if (diff < 3600)   return `${Math.floor(diff / 60)} min`
    if (diff < 86400)  return `${Math.floor(diff / 3600)} h`
    if (diff < 604800) return `${Math.floor(diff / 86400)} j`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div
      onClick={() => !editing && onSelect()}
      className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        active
          ? 'bg-indigo-500/15 border border-indigo-500/25'
          : 'hover:bg-slate-800 border border-transparent'
      }`}
    >
      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-indigo-400' : 'text-slate-600'}`} />

      <div className="flex-1 min-w-0">
        {editing ? (
          <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={commit}
            onClick={e => e.stopPropagation()}
            className="w-full bg-slate-700 text-white text-xs rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        ) : (
          <>
            <p className={`text-xs font-medium truncate ${active ? 'text-white' : 'text-slate-300'}`}>
              {conv.title}
            </p>
            <p className="text-[10px] text-slate-600">{relativeDate(conv.updated_at)}</p>
          </>
        )}
      </div>

      {/* Actions (visibles au hover) */}
      {!editing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); setEditing(true) }}
            className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
      {editing && (
        <button onClick={e => { e.stopPropagation(); commit() }}
          className="w-5 h-5 flex items-center justify-center rounded text-indigo-400 hover:bg-indigo-500/20 transition-colors">
          <Check className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

function ConversationSidebar({
  conversations, activeId, onSelect, onCreate, onRename, onDelete
}: {
  conversations: AiConversation[]
  activeId: number | null
  onSelect:  (id: number) => void
  onCreate:  () => void
  onRename:  (id: number, title: string) => void
  onDelete:  (id: number) => void
}): React.JSX.Element {
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversations</span>
        <button onClick={onCreate}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 transition-colors"
          title="Nouvelle conversation">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <MessageSquare className="w-8 h-8 text-slate-700" />
            <p className="text-xs text-slate-600">Aucune conversation</p>
          </div>
        ) : (
          conversations.map(conv => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              onSelect={() => onSelect(conv.id)}
              onRename={(title) => onRename(conv.id, title)}
              onDelete={() => onDelete(conv.id)}
            />
          ))
        )}
      </div>
    </aside>
  )
}

// ── Icône provider ────────────────────────────────────────────────────────────

function ProviderIcon({ provider }: { provider: string }): React.JSX.Element {
  if (provider === 'anthropic') return <Brain className="w-3.5 h-3.5" />
  if (provider === 'ollama')    return <Server className="w-3.5 h-3.5" />
  return <Zap className="w-3.5 h-3.5" />
}

// ── Bulle de message ──────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: LocalMessage }): React.JSX.Element {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-[color:var(--color-primary)]/20 text-[color:var(--color-primary)]' : 'bg-indigo-500/20 text-indigo-400'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[color:var(--color-primary)]/15 border border-[color:var(--color-primary)]/25 text-slate-100 rounded-tr-sm'
            : 'bg-slate-800 border border-slate-700/60 text-slate-200 rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="md-preview prose-sm">
              {msg.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown> : null}
              {msg.streaming && (
                <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Menu d'actions ────────────────────────────────────────────────────────────

/** Retourne datetime local au format "YYYY-MM-DDTHH:mm" */
function localDatetime(offsetHours = 0): string {
  const d = new Date()
  d.setHours(d.getHours() + offsetHours, 0, 0, 0)
  // Compenser le décalage UTC pour avoir l'heure locale
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

type DirectAction = { kind: 'direct'; action: AiAction }
type PromptAction = { kind: 'prompt'; text: string }
type MenuEntry    = { label: string; icon: React.ElementType; desc: string } & (DirectAction | PromptAction)

const DIRECT_ACTIONS: MenuEntry[] = [
  {
    kind: 'direct', label: 'Nouvel événement', icon: CalendarDays,
    desc: 'Ouvre le formulaire de création',
    action: {
      type: 'create_event', title: '', all_day: false,
      start_at: localDatetime(1), end_at: localDatetime(2),
      description: '', category: 'default', color: '#1A56DB'
    }
  },
  {
    kind: 'direct', label: 'Nouvelle note', icon: FileText,
    desc: 'Ouvre l\'éditeur de note',
    action: { type: 'create_note', title: '', content: '' }
  },
  {
    kind: 'direct', label: 'Note liste de tâches', icon: ListTodo,
    desc: 'Note avec une checklist vide',
    action: {
      type: 'create_note', title: 'Tâches du jour',
      content: `# Tâches du jour\n\n- [ ] \n- [ ] \n- [ ] \n`
    }
  },
]

const AI_ACTIONS: MenuEntry[] = [
  {
    kind: 'prompt', label: 'Planifier ma semaine', icon: CalendarDays,
    desc: 'L\'IA crée un plan d\'événements',
    text: 'Aide-moi à planifier ma semaine. Propose des événements concrets à créer dans mon agenda.'
  },
  {
    kind: 'prompt', label: 'Résumer mes notes', icon: FileText,
    desc: 'L\'IA résume et propose une note de synthèse',
    text: 'Résume mes notes récentes et crée une note de synthèse.'
  },
  {
    kind: 'prompt', label: 'Brainstorm → note', icon: Lightbulb,
    desc: 'L\'IA génère des idées et les met en note',
    text: 'Fais un brainstorm créatif sur ce sujet et crée une note avec les idées : '
  },
]

function ActionMenu({
  onDirectAction, onPrompt, onClose
}: {
  onDirectAction: (action: AiAction) => void
  onPrompt:       (text: string)    => void
  onClose:        () => void
}): React.JSX.Element {

  const handleEntry = (entry: MenuEntry): void => {
    if (entry.kind === 'direct') { onDirectAction(entry.action); onClose() }
    else                         { onPrompt(entry.text);         onClose() }
  }

  const Section = ({ title, entries }: { title: string; entries: MenuEntry[] }): React.JSX.Element => (
    <div className="mb-1 last:mb-0">
      <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 py-1.5">{title}</p>
      {entries.map(entry => {
        const Icon = entry.icon
        const isDirect = entry.kind === 'direct'
        return (
          <button key={entry.label} onClick={() => handleEntry(entry)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-700 transition-colors group text-left">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              isDirect
                ? 'bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25'
                : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'
            }`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 group-hover:text-white font-medium leading-tight">{entry.label}</p>
              <p className="text-[11px] text-slate-600 group-hover:text-slate-500 leading-tight">{entry.desc}</p>
            </div>
            {isDirect && (
              <span className="text-[10px] text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">Direct</span>
            )}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="absolute bottom-full mb-2 left-0 w-72 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <span className="text-sm font-semibold text-white">Actions</span>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-2 max-h-80 overflow-y-auto">
        <Section title="Créer directement" entries={DIRECT_ACTIONS} />
        <div className="h-px bg-slate-700/60 my-1" />
        <Section title="Demander à l'IA" entries={AI_ACTIONS} />
      </div>
    </div>
  )
}

// ── Sélecteur de mode ─────────────────────────────────────────────────────────

function ModeSelector({ current, onChange }: { current: ReasoningMode; onChange: (m: ReasoningMode) => void }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-t border-slate-800/60 flex-shrink-0 overflow-x-auto">
      <span className="text-xs text-slate-600 mr-1 flex-shrink-0">Mode :</span>
      {REASONING_MODES.map(m => {
        const Icon = m.icon
        const active = current === m.id
        return (
          <button key={m.id} onClick={() => onChange(m.id)} title={m.desc}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
              active ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}>
            <Icon className="w-3 h-3" />{m.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Écran vide de la conversation ─────────────────────────────────────────────

const SUGGESTIONS = [
  "Qu'est-ce que j'ai prévu cette semaine ?",
  "Résume mes notes récentes",
  "Aide-moi à rédiger un plan de travail pour demain",
  "Quels sont mes événements d'aujourd'hui ?",
]

function EmptyChat({ status, profile, onSend }: {
  status: AiStatus | null; profile: UserProfile | null; onSend: (t: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-indigo-500/15 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            {profile?.name ? `Bonjour, ${profile.name} !` : 'Comment puis-je vous aider ?'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">Je connais votre agenda, vos notes et vos fichiers.</p>
        </div>
        {status && !status.hasKey && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5 text-sm text-amber-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Configurez votre clé API dans{' '}
            <button onClick={() => { window.location.hash = '#/settings' }} className="underline hover:text-amber-300 transition-colors">
              Paramètres
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => onSend(s)}
            className="text-left text-sm text-slate-400 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 hover:border-slate-600 rounded-xl px-4 py-3 transition-all hover:text-white leading-snug">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AI(): React.JSX.Element {
  const ctx = useAiStream()

  // ── État local ───────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [activeConvId, setActiveConvId]   = useState<number | null>(null)
  const [messages, setMessages]           = useState<LocalMessage[]>([])
  const [input, setInput]                 = useState('')
  const [streaming, setStreaming]         = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [status, setStatus]               = useState<AiStatus | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [mode, setMode]                   = useState<ReasoningMode>('direct')
  const [showActions, setShowActions]     = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingId = useRef<string>('')
  const actionsRef  = useRef<HTMLDivElement>(null)

  // ── Visibilité pour les notifications ────────────────────────────────────

  useEffect(() => {
    ctx.markAiVisible(true)
    return () => ctx.markAiVisible(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Pré-remplissage depuis les raccourcis Home ────────────────────────────

  useEffect(() => {
    const prefill = sessionStorage.getItem('dailyos:ai-prefill')
    if (prefill) {
      sessionStorage.removeItem('dailyos:ai-prefill')
      setInput(prefill)
      textareaRef.current?.focus()
    }
  }, [])

  // ── Chargement initial ───────────────────────────────────────────────────

  const selectConversation = useCallback(async (id: number): Promise<void> => {
    setActiveConvId(id)
    setError(null)
    setLoadingMessages(true)
    const hist = await window.api.ai.history(id)
    const loaded: LocalMessage[] = hist.map(m => ({ id: m.id, role: m.role, content: m.content }))

    // Si l'IA est encore en train de répondre à cette conversation, ajouter le placeholder
    if (ctx.streamingConvId === id && ctx.isStreaming) {
      const sid = ctx.streamingMsgId ?? `stream-resume-${Date.now()}`
      streamingId.current = sid
      setStreaming(true)
      loaded.push({ id: sid, role: 'assistant', content: ctx.streamingContent, streaming: true })
    } else {
      setStreaming(false)
    }
    setMessages(loaded)
    setLoadingMessages(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.streamingConvId, ctx.isStreaming, ctx.streamingContent, ctx.streamingMsgId])

  useEffect(() => {
    Promise.all([
      window.api.ai.conversations.list(),
      window.api.ai.status()
    ]).then(([convs, st]) => {
      setConversations(convs)
      setStatus(st)
      if (convs.length > 0) {
        selectConversation(convs[0].id)
      } else {
        createConversation()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync contexte → messages locaux ──────────────────────────────────────

  // Mise à jour des chunks en temps réel
  useEffect(() => {
    if (!streamingId.current) return
    setMessages(prev => prev.map(m =>
      m.id === streamingId.current
        ? { ...m, content: ctx.streamingContent }
        : m
    ))
  }, [ctx.streamingContent])

  // Fin de stream
  useEffect(() => {
    if (ctx.isStreaming || !streamingId.current) return
    const finalId = `done-${Date.now()}`
    setMessages(prev => prev.map(m =>
      m.id === streamingId.current
        ? { ...m, id: finalId, content: ctx.streamingContent, streaming: false }
        : m
    ))
    streamingId.current = ''
    setStreaming(false)
    window.api.ai.status().then(setStatus)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isStreaming])

  // Mise à jour des titres de conversations
  useEffect(() => {
    const offUpdated = window.api.ai.onConversationUpdated(() => {
      window.api.ai.conversations.list().then(setConversations)
    })
    return () => offUpdated()
  }, [])

  // ── Fermeture du menu actions ────────────────────────────────────────────

  useEffect(() => {
    if (!showActions) return
    const handler = (e: MouseEvent): void => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showActions])

  // ── Scroll automatique ───────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Auto-resize textarea ─────────────────────────────────────────────────

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  // ── CRUD conversations ───────────────────────────────────────────────────

  const createConversation = useCallback(async (): Promise<void> => {
    const conv = await window.api.ai.conversations.create()
    setConversations(prev => [conv, ...prev])
    setActiveConvId(conv.id)
    setMessages([])
    setError(null)
  }, [])

  const renameConversation = useCallback(async (id: number, title: string): Promise<void> => {
    await window.api.ai.conversations.rename(id, title)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }, [])

  const deleteConversation = useCallback(async (id: number): Promise<void> => {
    await window.api.ai.conversations.delete(id)
    setConversations(prev => {
      const remaining = prev.filter(c => c.id !== id)
      if (id === activeConvId) {
        if (remaining.length > 0) selectConversation(remaining[0].id)
        else createConversation()
      }
      return remaining
    })
  }, [activeConvId, selectConversation, createConversation])

  // ── Envoi du message ─────────────────────────────────────────────────────

  const sendMessage = useCallback(async (overrideText?: string): Promise<void> => {
    const text = (overrideText ?? input).trim()
    if (!text || streaming || activeConvId == null) return

    setInput('')
    setError(null)
    setStreaming(true)

    const newId = `stream-${Date.now()}`
    streamingId.current = newId

    // Notifier le contexte global (les listeners IPC sont là-bas)
    ctx.startStream(activeConvId, newId)

    const userMsg: LocalMessage      = { id: `user-${Date.now()}`, role: 'user', content: text }
    const assistantMsg: LocalMessage = { id: newId, role: 'assistant', content: '', streaming: true }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    await window.api.ai.chat({
      message:        text,
      reasoningMode:  mode,
      profile:        null,
      conversationId: activeConvId
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, streaming, mode, activeConvId])

  const clearMessages = useCallback(async (): Promise<void> => {
    if (activeConvId == null) return
    await window.api.ai.clear(activeConvId)
    setMessages([])
    setError(null)
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, title: 'Nouvelle conversation' } : c))
  }, [activeConvId])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() }
  }

  // ── Actions pending : contexte (IA) + local (direct depuis menu) ─────────

  const [localPendingAction, setLocalPendingAction] = useState<AiAction | null>(null)
  const pendingAction = ctx.pendingAction ?? localPendingAction

  // ── Rendu principal ──────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Modal de confirmation d'action ───────────────────────────── */}
      {pendingAction && (
        <ActionConfirmModal
          action={pendingAction}
          onClose={() => { ctx.clearPendingAction(); setLocalPendingAction(null) }}
        />
      )}

      {/* ── Panneau conversations ─────────────────────────────────────── */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={selectConversation}
        onCreate={createConversation}
        onRename={renameConversation}
        onDelete={deleteConversation}
      />

      {/* ── Zone de chat ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* En-tête */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 flex-shrink-0 bg-slate-900/50">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">
              {conversations.find(c => c.id === activeConvId)?.title ?? 'DailyOS Assistant'}
            </h1>
            {status && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <ProviderIcon provider={status.provider} />
                <span>{PROVIDER_LABEL[status.provider] ?? status.provider}</span>
                <span>·</span>
                <span className="font-mono">{status.model}</span>
                {!status.hasKey && (
                  <><span>·</span><span className="text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Clé manquante</span></>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={() => void clearMessages()} title="Vider la conversation"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => { window.location.hash = '#/settings' }} title="Configurer le modèle"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyChat status={status} profile={null} onSend={(t) => void sendMessage(t)} />
          ) : (
            <div className="max-w-3xl mx-auto px-5 py-6 flex flex-col gap-5">
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Sélecteur de mode */}
        <ModeSelector current={mode} onChange={setMode} />

        {/* Erreur */}
        {error && (
          <div className="mx-5 mb-3 flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 transition-colors">×</button>
          </div>
        )}

        {/* Zone de saisie */}
        <div className="flex-shrink-0 px-5 pb-5">
          <div className={`relative flex items-end gap-3 bg-slate-800 border rounded-2xl px-4 py-3 transition-colors ${
            streaming ? 'border-[var(--color-primary)]/40' : 'border-slate-700 focus-within:border-slate-600'
          }`}>
            {/* Bouton actions */}
            <div ref={actionsRef} className="relative flex-shrink-0">
              {showActions && (
                <ActionMenu
                  onDirectAction={action => { setLocalPendingAction(action); setShowActions(false) }}
                  onPrompt={text => { setInput(text); textareaRef.current?.focus(); setShowActions(false) }}
                  onClose={() => setShowActions(false)}
                />
              )}
              <button onClick={() => setShowActions(v => !v)} title="Actions rapides"
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                  showActions ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                }`}>
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <textarea ref={textareaRef} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Envoyer un message… (Entrée pour envoyer, Maj+Entrée pour retour à la ligne)"
              rows={1} disabled={streaming}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none focus:outline-none leading-relaxed min-h-[24px] max-h-[160px] disabled:opacity-50" />

            <button onClick={() => void sendMessage()} disabled={!input.trim() || streaming}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
              {streaming ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
            </button>
          </div>
          <p className="text-center text-xs text-slate-700 mt-2">L'IA peut faire des erreurs — vérifiez les informations importantes.</p>
        </div>
      </div>
    </div>
  )
}

