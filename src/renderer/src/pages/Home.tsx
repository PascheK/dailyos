import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import GridLayout, { type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  Calendar, FileText, NotebookPen, ArrowRight, Clock,
  CalendarX, FolderOpen, Sparkles, GripHorizontal,
  CalendarDays, Zap, StickyNote, Send, X
} from 'lucide-react'
import type { CalendarEvent } from '../types/calendar'
import type { AppFile } from '../types/files'

// ── Constantes & types ────────────────────────────────────────────────────────

const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
const DAYS   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

// v2 — layout repensé pour tenir dans l'écran sans scroll
const STORAGE_KEY = 'dailyos:home-layout-v2'

type WidgetId = 'clock' | 'events' | 'files' | 'quicknote' | 'aishortcuts'

const DEFAULT_LAYOUT: Layout[] = [
  { i: 'clock',       x: 0, y: 0,  w: 4, h: 3, minW: 3, minH: 2 },
  { i: 'events',      x: 4, y: 0,  w: 5, h: 7, minW: 3, minH: 3 },
  { i: 'files',       x: 9, y: 0,  w: 5, h: 7, minW: 3, minH: 3 },
  { i: 'quicknote',   x: 0, y: 3,  w: 4, h: 7, minW: 3, minH: 3 },
  { i: 'aishortcuts', x: 4, y: 7,  w: 10, h: 3, minW: 4, minH: 2 },
]
// Total : 10 rangées × 36px + 9 × 10px margin + 28px padding = ~478px → pas de scroll

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
      {/* Header widget */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5 shrink-0">
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
          {/* Drag handle */}
          <div className="widget-drag-handle cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 transition-colors">
            <GripHorizontal className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
      {/* Contenu scrollable */}
      <div className="flex-1 overflow-auto px-3 pb-3 min-h-0">
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
      <p className="text-[11px] text-slate-600 mt-2">{greeting}{userName ? `, ${userName}` : ''} 👋</p>
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
    <div className="flex flex-col gap-2 pt-1">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />)}
    </div>
  )
  if (!events.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700">
      <CalendarX className="w-8 h-8" />
      <p className="text-sm">Aucun événement aujourd'hui</p>
    </div>
  )
  return (
    <div className="flex flex-col gap-1 pt-0.5">
      {events.map(ev => (
        <div key={ev.id} onClick={() => navigate('/calendar')}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group"
          style={{ borderLeft: `2px solid ${ev.color ?? 'var(--color-primary)'}` }}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{ev.title}</p>
            <p className="text-[11px] text-slate-500">
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
    if (f.mime_type === 'text/markdown') {
      navigate(`/notes`)
    } else {
      void window.api.files.open(f.path)
    }
  }

  if (loading) return (
    <div className="flex flex-col gap-2 pt-1">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />)}
    </div>
  )
  if (!files.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700">
      <FolderOpen className="w-8 h-8" />
      <p className="text-sm">Aucun fichier récent</p>
    </div>
  )
  return (
    <div className="flex flex-col gap-0.5 pt-0.5">
      {files.map(f => {
        const badge = fileBadge(f.mime_type)
        return (
          <div key={f.id} onClick={() => handleOpen(f)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${badge.cls}`}>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    <div className="flex flex-col gap-2 h-full">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Titre de la note…"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[var(--color-primary)] transition-colors"
      />
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Commence à écrire…"
        className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[var(--color-primary)] transition-colors resize-none min-h-0"
      />
      <div className="flex gap-1.5 shrink-0">
        <button onClick={() => { setTitle(''); setContent('') }} disabled={!title && !content}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => void handleCreate()} disabled={saving || (!title.trim() && !content.trim())}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-lg text-white text-xs font-medium transition-all">
          {saving ? 'Création…' : saved ? '✓ Créée !' : <><Send className="w-3 h-3" /> Créer</>}
        </button>
        <button onClick={() => navigate('/notes')}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-600 hover:text-slate-400 transition-colors">
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Widget Raccourcis IA ──────────────────────────────────────────────────────

const AI_SHORTCUTS = [
  { label: 'Résume ma journée',       icon: Calendar,     prompt: 'Résume ma journée et mes priorités' },
  { label: 'Créer un événement',      icon: CalendarDays, prompt: 'Crée un événement dans mon calendrier' },
  { label: 'Idées créatives',         icon: Sparkles,     prompt: 'Donne-moi 5 idées créatives pour aujourd\'hui' },
  { label: 'Aide-moi à planifier',    icon: Zap,          prompt: 'Aide-moi à planifier ma semaine' },
  { label: 'Rédige une note',         icon: StickyNote,   prompt: 'Aide-moi à rédiger une note structurée' },
  { label: 'Brainstorming',           icon: FileText,     prompt: 'Lance un brainstorming sur un projet' },
]

function AiShortcutsWidget({ navigate }: { navigate: (p: string) => void }): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-1.5 pt-0.5 h-full content-start">
      {AI_SHORTCUTS.map(s => {
        const Icon = s.icon
        return (
          <button key={s.label}
            onClick={() => {
              sessionStorage.setItem('dailyos:ai-prefill', s.prompt)
              navigate('/ai')
            }}
            className="flex items-center gap-2 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 hover:border-[var(--color-primary)]/30 rounded-lg text-left transition-all group">
            <Icon className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
            <span className="text-[11px] text-slate-300 group-hover:text-white transition-colors leading-tight">{s.label}</span>
          </button>
        )
      })}
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
  const [isDragging, setIsDragging] = useState(false)

  // Layout persisté
  const [layout, setLayout] = useState<Layout[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved) as Layout[]
    } catch { /* ignore */ }
    return DEFAULT_LAYOUT
  })

  // Dimensions du conteneur pour GridLayout
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
    ]).then(([evs, fls, settings]) => {
      setEvents((evs as CalendarEvent[]).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()))
      setFiles((fls as AppFile[]).slice(0, 8))
      setUserName(settings.profile.name || '')
      setLoading(false)
    })
  }, [])

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout))
  }, [])

  const resetLayout = (): void => {
    setLayout(DEFAULT_LAYOUT)
    localStorage.removeItem(STORAGE_KEY)
  }

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
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto relative">
      {/* Bouton reset layout */}
      <button onClick={resetLayout}
        className="absolute top-4 right-4 z-10 text-[11px] text-slate-700 hover:text-slate-500 transition-colors">
        Réinitialiser la grille
      </button>

      <GridLayout
        className="layout"
        layout={layout}
        cols={14}
        rowHeight={36}
        width={width}
        margin={[10, 10]}
        containerPadding={[14, 14]}
        draggableHandle=".widget-drag-handle"
        onLayoutChange={handleLayoutChange}
        onDragStart={() => setIsDragging(true)}
        onDragStop={() => setIsDragging(false)}
        onResizeStart={() => setIsDragging(true)}
        onResizeStop={() => setIsDragging(false)}
        useCSSTransforms
      >
        {layout.map(item => (
          <div key={item.i}>
            {widgets[item.i as WidgetId]}
          </div>
        ))}
      </GridLayout>
    </div>
  )
}
