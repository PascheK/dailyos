import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import GridLayoutLib from 'react-grid-layout'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = GridLayoutLib as React.ComponentType<any>
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  Calendar, FileText, ArrowRight, Clock,
  CalendarX, FolderOpen, Sparkles, GripHorizontal,
  CalendarDays, Zap, StickyNote, Send, X, Settings2, RotateCcw,
  Wallet, TrendingDown, AlertTriangle
} from 'lucide-react'

type LayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number }
import type { CalendarEvent } from '../types/calendar'
import type { AppFile } from '../types/files'
import type { BudgetWidgetData } from '../types/budget'

// ── Constantes & types ────────────────────────────────────────────────────────

const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
const DAYS   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

const STORAGE_KEY         = 'dailyos:home-layout-v4'
const STORAGE_KEY_VISIBLE = 'dailyos:home-visible-v1'

type WidgetId = 'clock' | 'events' | 'files' | 'quicknote' | 'aishortcuts' | 'budget'

const WIDGET_META: Record<WidgetId, { label: string; icon: React.ElementType }> = {
  clock:       { label: 'Horloge',          icon: Clock },
  events:      { label: 'Événements',       icon: CalendarDays },
  files:       { label: 'Fichiers récents', icon: FolderOpen },
  quicknote:   { label: 'Note rapide',      icon: StickyNote },
  aishortcuts: { label: 'Raccourcis IA',    icon: Sparkles },
  budget:      { label: 'Budget',           icon: Wallet },
}

const ALL_WIDGET_IDS: WidgetId[] = ['clock', 'events', 'files', 'quicknote', 'aishortcuts', 'budget']

// Layout compact — tout tient sans scroll sur ~900px de hauteur
const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'clock',       x: 0,  y: 0, w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'events',      x: 3,  y: 0, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'files',       x: 7,  y: 0, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'quicknote',   x: 11, y: 0, w: 3, h: 5, minW: 2, minH: 3 },
  { i: 'aishortcuts', x: 0,  y: 5, w: 10, h: 3, minW: 4, minH: 2 },
  { i: 'budget',      x: 10, y: 5, w: 4,  h: 3, minW: 3, minH: 2 },
]
// 8 rangées × 32px + 7 × 8px + 24px padding = ~336px

// ── Utilitaires ───────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)   return 'À l\'instant'
  if (min < 60)  return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `Il y a ${h}h`
  return h < 48 ? 'Hier' : `Il y a ${Math.floor(h / 24)} j`
}
function fileBadge(mime: string): { label: string; cls: string } {
  if (mime === 'application/pdf')  return { label: 'PDF', cls: 'bg-red-500/20 text-red-400' }
  if (mime === 'text/markdown')    return { label: 'MD',  cls: 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' }
  if (mime.startsWith('image/'))   return { label: 'IMG', cls: 'bg-emerald-500/20 text-emerald-400' }
  if (mime.startsWith('video/'))   return { label: 'VID', cls: 'bg-orange-500/20 text-orange-400' }
  if (mime.startsWith('audio/'))   return { label: 'AUD', cls: 'bg-purple-500/20 text-purple-400' }
  const ext = mime.split('/')[1]?.slice(0, 4).toUpperCase() ?? 'FIL'
  return { label: ext, cls: 'bg-slate-500/20 text-slate-400' }
}

// ── Wrapper de widget ─────────────────────────────────────────────────────────

function Widget({
  title, icon: Icon, action, onAction, children, dragging
}: {
  title: string; icon: React.ElementType
  action?: { label: string; to: string }
  onAction?: () => void
  children: React.ReactNode
  dragging: boolean
}): React.JSX.Element {
  return (
    <div className={`flex flex-col h-full bg-slate-900 rounded-2xl border transition-all ${
      dragging ? 'border-[var(--color-primary)]/40 shadow-lg shadow-[var(--color-primary)]/10' : 'border-slate-700/50 hover:border-slate-600/70'
    }`}>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-[var(--color-primary)]" />
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {action && (
            <button onClick={onAction}
              className="text-[10px] text-slate-700 hover:text-[var(--color-primary)] flex items-center gap-0.5 transition-colors">
              Voir tout <ArrowRight className="w-2.5 h-2.5" />
            </button>
          )}
          <div className="widget-drag-handle cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 transition-colors">
            <GripHorizontal className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-3 pb-2.5 min-h-0">
        {children}
      </div>
    </div>
  )
}

// ── Widget Horloge ────────────────────────────────────────────────────────────

function ClockWidget({ userName }: { userName: string }): React.JSX.Element {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const h = now.getHours()
  const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
  const timeStr  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const dateStr  = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`

  return (
    <div className="flex flex-col justify-center h-full gap-0.5">
      <p className="text-3xl font-bold text-white font-mono tracking-tight leading-none">{timeStr}</p>
      <p className="text-xs text-slate-400 mt-0.5">{dateStr}</p>
      <p className="text-[11px] text-slate-600 mt-1.5">{greeting}{userName ? `, ${userName}` : ''} 👋</p>
    </div>
  )
}

// ── Widget Événements ─────────────────────────────────────────────────────────

function EventsWidget({
  events, loading, navigate
}: {
  events: CalendarEvent[]; loading: boolean; navigate: (p: string) => void
}): React.JSX.Element {
  if (loading) return (
    <div className="flex flex-col gap-1.5 pt-1">
      {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-800 rounded-xl animate-pulse" />)}
    </div>
  )
  if (!events.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700">
      <CalendarX className="w-7 h-7" />
      <p className="text-xs">Aucun événement aujourd'hui</p>
    </div>
  )
  return (
    <div className="flex flex-col gap-1 pt-0.5">
      {events.map(ev => (
        <div key={ev.id} onClick={() => navigate('/calendar')}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group"
          style={{ borderLeft: `2px solid ${ev.color ?? 'var(--color-primary)'}` }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{ev.title}</p>
            <p className="text-[10px] text-slate-500">
              {ev.all_day ? 'Toute la journée' : `${fmtTime(ev.start_at)} → ${fmtTime(ev.end_at)}`}
            </p>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400 transition-colors shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ── Widget Fichiers récents ───────────────────────────────────────────────────

function FilesWidget({
  files, loading, navigate
}: {
  files: AppFile[]; loading: boolean; navigate: (p: string) => void
}): React.JSX.Element {
  const handleOpen = (f: AppFile): void => {
    if (f.mime_type === 'text/markdown') navigate('/notes')
    else void window.api.files.open(f.path)
  }

  if (loading) return (
    <div className="flex flex-col gap-1.5 pt-1">
      {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-800 rounded-xl animate-pulse" />)}
    </div>
  )
  if (!files.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700">
      <FolderOpen className="w-7 h-7" />
      <p className="text-xs">Aucun fichier récent</p>
    </div>
  )
  return (
    <div className="flex flex-col gap-0.5 pt-0.5">
      {files.map(f => {
        const badge = fileBadge(f.mime_type)
        return (
          <div key={f.id} onClick={() => handleOpen(f)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${badge.cls}`}>
              {badge.label}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{f.name}</p>
              <p className="text-[10px] text-slate-600">{relativeTime(f.created_at)}</p>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400 transition-colors shrink-0" />
          </div>
        )
      })}
    </div>
  )
}

// ── Widget Note rapide ────────────────────────────────────────────────────────

function QuickNoteWidget({ navigate }: { navigate: (p: string) => void }): React.JSX.Element {
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const handleCreate = async (): Promise<void> => {
    const t = title.trim() || 'Note rapide'
    const c = content.trim()
    if (!c && !title.trim()) return
    setSaving(true)
    const file = await window.api.files.createNote(t)
    if (c) await window.api.files.writeContent(file.id, c)
    setSaving(false)
    setSaved(true)
    setTitle('')
    setContent('')
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-1.5 h-full">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Titre de la note…"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[var(--color-primary)] transition-colors"
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Commence à écrire…"
        className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-none min-h-0"
      />
      <div className="flex gap-1.5 shrink-0">
        <button onClick={() => { setTitle(''); setContent('') }} disabled={!title && !content}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors">
          <X className="w-3 h-3" />
        </button>
        <button onClick={() => void handleCreate()} disabled={saving || (!title.trim() && !content.trim())}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-lg text-white text-xs font-medium transition-all">
          {saving ? 'Création…' : saved ? '✓ Créée !' : <><Send className="w-3 h-3" /> Créer</>}
        </button>
        <button onClick={() => navigate('/notes')}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-600 hover:text-slate-400 transition-colors">
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ── Widget Raccourcis IA ──────────────────────────────────────────────────────

const AI_SHORTCUTS = [
  { label: 'Résume ma journée',    icon: Calendar,     prompt: 'Résume ma journée et mes priorités' },
  { label: 'Créer un événement',   icon: CalendarDays, prompt: 'Crée un événement dans mon calendrier' },
  { label: 'Idées créatives',      icon: Sparkles,     prompt: 'Donne-moi 5 idées créatives pour aujourd\'hui' },
  { label: 'Planifier ma semaine', icon: Zap,          prompt: 'Aide-moi à planifier ma semaine' },
  { label: 'Rédige une note',      icon: StickyNote,   prompt: 'Aide-moi à rédiger une note structurée' },
  { label: 'Brainstorming',        icon: FileText,     prompt: 'Lance un brainstorming sur un projet' },
]

function AiShortcutsWidget({ navigate }: { navigate: (p: string) => void }): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-1 h-full content-start pt-0.5">
      {AI_SHORTCUTS.map(s => {
        const Icon = s.icon
        return (
          <button key={s.label}
            onClick={() => {
              sessionStorage.setItem('dailyos:ai-prefill', s.prompt)
              navigate('/ai')
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 hover:border-[var(--color-primary)]/30 rounded-lg text-left transition-all group">
            <Icon className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
            <span className="text-[10px] text-slate-300 group-hover:text-white transition-colors leading-tight truncate">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Widget Budget ─────────────────────────────────────────────────────────────

function BudgetWidget({
  data, navigate
}: {
  data: BudgetWidgetData | null; navigate: (p: string) => void
}): React.JSX.Element {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700">
        <Wallet className="w-7 h-7" />
        <p className="text-xs">Aucun budget actif</p>
        <button
          onClick={() => navigate('/budget')}
          className="text-[10px] text-[var(--color-primary)] hover:underline">
          Créer un budget →
        </button>
      </div>
    )
  }

  const sym = (c: string): string => ({ CHF:'CHF', EUR:'€', USD:'$', JPY:'¥', GBP:'£', KRW:'₩', CNY:'¥', THB:'฿' }[c] ?? c)
  const fmtAmt = (v: number, c: string): string =>
    `${sym(c)} ${v.toLocaleString('fr-CH', { maximumFractionDigits: 0 })}`

  const p = data.period_goal > 0 ? Math.min(100, Math.round((data.period_spent / data.period_goal) * 100)) : 0
  const isWarn   = data.period_spent >= data.critical_threshold && data.period_spent < data.period_goal
  const isDanger = data.period_spent >= data.period_goal
  const barColor = isDanger ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-[var(--color-primary)]'

  return (
    <div className="flex flex-col justify-between h-full gap-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-slate-300 truncate">{data.budget_name}</p>
          {(isWarn || isDanger) && (
            <AlertTriangle className={`w-3 h-3 shrink-0 ${isDanger ? 'text-red-400' : 'text-amber-400'}`} />
          )}
        </div>
        {/* Solde restant */}
        <p className="text-xl font-bold text-white leading-tight">
          {fmtAmt(data.total_remaining, data.currency)}
        </p>
        {data.display_currency && data.display_rate && (
          <p className="text-[10px] text-slate-600">
            ≈ {fmtAmt(data.display_remaining ?? data.total_remaining * data.display_rate, data.display_currency)}
          </p>
        )}
      </div>

      {/* Barre mensuelle */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-slate-600">
          <span className="flex items-center gap-0.5"><TrendingDown className="w-2.5 h-2.5" /> Ce mois</span>
          <span>{p}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${p}%` }} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-600">
          <span>{fmtAmt(data.period_spent, data.currency)}</span>
          <span>/ {fmtAmt(data.period_goal, data.currency)}</span>
        </div>
      </div>

      <button
        onClick={() => navigate(`/budget/${data.budget_id}`)}
        className="flex items-center justify-center gap-1 text-[10px] text-slate-600 hover:text-[var(--color-primary)] transition-colors">
        Voir le détail <ArrowRight className="w-2.5 h-2.5" />
      </button>
    </div>
  )
}

// ── Panneau de personnalisation ───────────────────────────────────────────────

function CustomizePanel({
  visible, onToggle, onReset, onClose
}: {
  visible: Set<WidgetId>
  onToggle: (id: WidgetId) => void
  onReset: () => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="absolute top-10 right-4 z-50 w-56 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl shadow-black/40 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Widgets</span>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {ALL_WIDGET_IDS.map(id => {
          const { label, icon: Icon } = WIDGET_META[id]
          const isVisible = visible.has(id)
          return (
            <button key={id} onClick={() => onToggle(id)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all text-left ${
                isVisible
                  ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-white'
                  : 'bg-slate-800/60 border border-transparent text-slate-500 hover:text-slate-400'
              }`}>
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isVisible ? 'text-[var(--color-primary)]' : 'text-slate-600'}`} />
              <span className="text-xs flex-1">{label}</span>
              {/* Toggle indicator */}
              <div className={`w-7 h-4 rounded-full transition-all flex items-center px-0.5 ${
                isVisible ? 'bg-[var(--color-primary)]' : 'bg-slate-700'
              }`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                  isVisible ? 'translate-x-3' : 'translate-x-0'
                }`} />
              </div>
            </button>
          )
        })}
      </div>

      <button onClick={onReset}
        className="flex items-center justify-center gap-1.5 py-1.5 mt-1 text-[11px] text-slate-600 hover:text-slate-400 transition-colors border-t border-slate-800 pt-2">
        <RotateCcw className="w-3 h-3" />
        Réinitialiser la grille
      </button>
    </div>
  )
}

// ── Page Home ─────────────────────────────────────────────────────────────────

export function Home(): React.JSX.Element {
  const navigate = useNavigate()

  const [loading, setLoading]   = useState(true)
  const [events,  setEvents]    = useState<CalendarEvent[]>([])
  const [files,   setFiles]     = useState<AppFile[]>([])
  const [userName, setUserName] = useState('')
  const [budgetData, setBudgetData] = useState<BudgetWidgetData | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)

  // Widgets visibles
  const [visible, setVisible] = useState<Set<WidgetId>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VISIBLE)
      if (saved) return new Set(JSON.parse(saved) as WidgetId[])
    } catch { /* ignore */ }
    return new Set(ALL_WIDGET_IDS)
  })

  const toggleWidget = useCallback((id: WidgetId) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(STORAGE_KEY_VISIBLE, JSON.stringify([...next]))
      return next
    })
  }, [])

  // Layout persisté
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved) as LayoutItem[]
    } catch { /* ignore */ }
    return DEFAULT_LAYOUT
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1200)

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Données
  useEffect(() => {
    const today = localDateStr(new Date())
    Promise.all([
      window.api.calendar.list({ from: today, to: today }),
      window.api.files.list(),
      window.api.settings.get(),
      window.api.budget.widgetData(),
    ]).then(([evs, fls, settings, budgetWidget]) => {
      setEvents((evs as CalendarEvent[]).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()))
      setFiles((fls as AppFile[]).slice(0, 8))
      setUserName(settings.profile.name || '')
      setBudgetData(budgetWidget)
      setLoading(false)
    })
  }, [])

  // Merge les nouvelles positions (widgets visibles) dans le layout complet
  // pour ne pas perdre la position des widgets cachés
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = useCallback((newLayout: any) => {
    const updated = newLayout as LayoutItem[]
    setLayout(prev => {
      const merged = prev.map(item => {
        const found = updated.find(n => n.i === item.i)
        return found ? { ...item, ...found } : item
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      return merged
    })
  }, [])

  const resetLayout = (): void => {
    setLayout(DEFAULT_LAYOUT)
    setVisible(new Set(ALL_WIDGET_IDS))
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY_VISIBLE)
    setShowCustomize(false)
  }

  // Fermer le panneau en cliquant ailleurs
  useEffect(() => {
    if (!showCustomize) return
    const handler = (e: MouseEvent): void => {
      const panel = document.getElementById('customize-panel')
      if (panel && !panel.contains(e.target as Node)) setShowCustomize(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCustomize])

  const widgets: Record<WidgetId, React.JSX.Element> = {
    clock: (
      <Widget title="Horloge" icon={Clock} dragging={isDragging}>
        <ClockWidget userName={userName} />
      </Widget>
    ),
    events: (
      <Widget title="Aujourd'hui" icon={CalendarDays} action={{ label: 'Calendrier', to: '/calendar' }}
        onAction={() => navigate('/calendar')} dragging={isDragging}>
        <EventsWidget events={events} loading={loading} navigate={navigate} />
      </Widget>
    ),
    files: (
      <Widget title="Fichiers récents" icon={FolderOpen} action={{ label: 'Tous', to: '/files' }}
        onAction={() => navigate('/files')} dragging={isDragging}>
        <FilesWidget files={files} loading={loading} navigate={navigate} />
      </Widget>
    ),
    quicknote: (
      <Widget title="Note rapide" icon={StickyNote} action={{ label: 'Notes', to: '/notes' }}
        onAction={() => navigate('/notes')} dragging={isDragging}>
        <QuickNoteWidget navigate={navigate} />
      </Widget>
    ),
    aishortcuts: (
      <Widget title="Raccourcis IA" icon={Sparkles} action={{ label: 'Assistant', to: '/ai' }}
        onAction={() => navigate('/ai')} dragging={isDragging}>
        <AiShortcutsWidget navigate={navigate} />
      </Widget>
    ),
    budget: (
      <Widget title="Budget" icon={Wallet} action={{ label: 'Budgets', to: '/budget' }}
        onAction={() => navigate('/budget')} dragging={isDragging}>
        <BudgetWidget data={budgetData} navigate={navigate} />
      </Widget>
    ),
  }

  // Layout filtré selon les widgets visibles
  const activeLayout = layout.filter(item => visible.has(item.i as WidgetId))

  return (
    <div ref={containerRef} className="h-full overflow-auto relative">
      {/* Bouton personnaliser */}
      <button
        id="customize-btn"
        onClick={() => setShowCustomize(v => !v)}
        className={`absolute top-4 right-4 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
          showCustomize
            ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
            : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
        }`}>
        <Settings2 className="w-3.5 h-3.5" />
        Personnaliser
      </button>

      {/* Panneau de personnalisation */}
      {showCustomize && (
        <div id="customize-panel">
          <CustomizePanel
            visible={visible}
            onToggle={toggleWidget}
            onReset={resetLayout}
            onClose={() => setShowCustomize(false)}
          />
        </div>
      )}

      <GridLayout
        className="layout"
        layout={activeLayout}
        cols={14}
        rowHeight={32}
        width={width}
        margin={[8, 8]}
        containerPadding={[12, 12]}
        draggableHandle=".widget-drag-handle"
        onLayoutChange={handleLayoutChange}
        onDragStart={() => setIsDragging(true)}
        onDragStop={() => setIsDragging(false)}
        onResizeStart={() => setIsDragging(true)}
        onResizeStop={() => setIsDragging(false)}
        useCSSTransforms
      >
        {activeLayout.map(item => (
          <div key={item.i}>
            {widgets[item.i as WidgetId]}
          </div>
        ))}
      </GridLayout>
    </div>
  )
}
