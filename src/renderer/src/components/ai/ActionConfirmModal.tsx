import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  CalendarDays, FileText, Check, X,
  Loader2, AlertCircle, CheckCircle2
} from 'lucide-react'

// ── Helper datetime ───────────────────────────────────────────────────────────

/** Convertit "YYYY-MM-DDTHH:mm" en "lun. 13 jan. 10:00" */
function formatDatetime(iso: string, allDay: boolean): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const date = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    if (allDay) return date
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return `${date} · ${time}`
  } catch { return iso }
}

/** Retourne l'heure de fin par défaut (1h après le début) */
function defaultEndAt(startAt: string): string {
  try {
    const d = new Date(startAt)
    d.setHours(d.getHours() + 1)
    return d.toISOString().slice(0, 16)
  } catch { return startAt }
}

// ── Couleurs d'événement ──────────────────────────────────────────────────────

const EVENT_COLORS = [
  { value: '#1A56DB', label: 'Bleu'    },
  { value: '#7E3AF2', label: 'Violet'  },
  { value: '#0E9F6E', label: 'Vert'    },
  { value: '#E3A008', label: 'Orange'  },
  { value: '#E02424', label: 'Rouge'   },
  { value: '#6B7280', label: 'Gris'    },
]

// ── Formulaire Événement ──────────────────────────────────────────────────────

function EventForm({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: AiActionCreateEvent
  onConfirm: (data: AiActionCreateEvent) => Promise<void>
  onCancel: () => void
}): React.JSX.Element {
  const [title,       setTitle]       = useState(initial.title)
  const [startAt,     setStartAt]     = useState(initial.start_at ?? '')
  const [endAt,       setEndAt]       = useState(initial.end_at ?? defaultEndAt(initial.start_at ?? ''))
  const [allDay,      setAllDay]      = useState(initial.all_day ?? false)
  const [description, setDescription] = useState(initial.description ?? '')
  const [color,       setColor]       = useState(initial.color ?? '#1A56DB')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [done,        setDone]        = useState(false)

  const handleConfirm = async (): Promise<void> => {
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onConfirm({ type: 'create_event', title: title.trim(), start_at: startAt, end_at: endAt, all_day: allDay, description, color })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (done) return <SuccessState label="Événement créé !" onClose={onCancel} />

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <CalendarDays className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Créer un événement</h2>
          <p className="text-xs text-slate-500">L'assistant a préparé cet événement. Vérifiez et confirmez.</p>
        </div>
      </div>

      {/* Champs */}
      <div className="flex flex-col gap-3">
        {/* Titre */}
        <Field label="Titre">
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="input-modal" placeholder="Titre de l'événement" />
        </Field>

        {/* Toute la journée */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setAllDay(v => !v)}
            className={`w-9 h-5 rounded-full transition-colors relative ${allDay ? 'bg-blue-500' : 'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${allDay ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-slate-300">Journée entière</span>
        </label>

        {/* Dates */}
        {!allDay ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début">
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)}
                className="input-modal" />
            </Field>
            <Field label="Fin">
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)}
                className="input-modal" />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date de début">
              <input type="date" value={startAt.slice(0, 10)} onChange={e => setStartAt(e.target.value + 'T00:00')}
                className="input-modal" />
            </Field>
            <Field label="Date de fin">
              <input type="date" value={endAt.slice(0, 10)} onChange={e => setEndAt(e.target.value + 'T23:59')}
                className="input-modal" />
            </Field>
          </div>
        )}

        {/* Description */}
        <Field label="Description (optionnelle)">
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} className="input-modal resize-none" placeholder="Ajouter une description…" />
        </Field>

        {/* Couleur */}
        <Field label="Couleur">
          <div className="flex gap-2 flex-wrap">
            {EVENT_COLORS.map(c => (
              <button key={c.value} onClick={() => setColor(c.value)} title={c.label}
                className={`w-7 h-7 rounded-full border-2 transition-all ${color === c.value ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                style={{ backgroundColor: c.value }} />
            ))}
          </div>
        </Field>
      </div>

      {/* Résumé */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-slate-300">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-medium text-white">{title || '–'}</span>
        </div>
        <p className="text-xs text-slate-500 ml-[18px]">
          {startAt ? formatDatetime(startAt, allDay) : '–'}
          {!allDay && endAt ? ` → ${formatDatetime(endAt, allDay)}` : ''}
        </p>
        {description && <p className="text-xs text-slate-500 mt-1 ml-[18px] line-clamp-2">{description}</p>}
      </div>

      <FormFooter error={error} loading={loading} onCancel={onCancel} onConfirm={handleConfirm}
        disabled={!title.trim() || !startAt} confirmLabel="Créer l'événement" />
    </div>
  )
}

// ── Formulaire Note ───────────────────────────────────────────────────────────

function NoteForm({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: AiActionCreateNote
  onConfirm: (data: AiActionCreateNote) => Promise<void>
  onCancel: () => void
}): React.JSX.Element {
  const [title,   setTitle]   = useState(initial.title)
  const [content, setContent] = useState(initial.content)
  const [tab,     setTab]     = useState<'preview' | 'edit'>('preview')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)

  const handleConfirm = async (): Promise<void> => {
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    try {
      await onConfirm({ type: 'create_note', title: title.trim(), content })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (done) return <SuccessState label="Note créée !" onClose={onCancel} />

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Créer une note</h2>
          <p className="text-xs text-slate-500">L'assistant a rédigé cette note. Vérifiez et confirmez.</p>
        </div>
      </div>

      {/* Titre */}
      <Field label="Titre de la note">
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="input-modal" placeholder="Titre…" />
      </Field>

      {/* Contenu avec onglets */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Contenu</span>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            {(['preview', 'edit'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {t === 'preview' ? 'Aperçu' : 'Modifier'}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          {tab === 'preview' ? (
            <div className="max-h-52 overflow-y-auto bg-slate-800/50 px-4 py-3">
              <div className="md-preview prose-sm text-sm text-slate-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '_Aucun contenu_'}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              className="w-full bg-slate-800/50 text-sm text-slate-200 font-mono px-4 py-3 focus:outline-none resize-none leading-relaxed"
              rows={8} placeholder="Contenu en markdown…" />
          )}
        </div>
      </div>

      <FormFooter error={error} loading={loading} onCancel={onCancel} onConfirm={handleConfirm}
        disabled={!title.trim()} confirmLabel="Créer la note" confirmColor="emerald" />
    </div>
  )
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function FormFooter({ error, loading, onCancel, onConfirm, disabled, confirmLabel, confirmColor = 'blue' }: {
  error: string | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
  disabled: boolean
  confirmLabel: string
  confirmColor?: 'blue' | 'emerald'
}): React.JSX.Element {
  const colorClass = confirmColor === 'emerald'
    ? 'bg-emerald-500 hover:bg-emerald-400'
    : 'bg-blue-500 hover:bg-blue-400'

  return (
    <>
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={loading}
          className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50">
          Annuler
        </button>
        <button onClick={onConfirm} disabled={disabled || loading}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${colorClass}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {confirmLabel}
        </button>
      </div>
    </>
  )
}

function SuccessState({ label, onClose }: { label: string; onClose: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
      </div>
      <p className="text-base font-semibold text-white">{label}</p>
      <button onClick={onClose}
        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 hover:text-white rounded-xl transition-colors">
        Fermer
      </button>
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────

export function ActionConfirmModal({
  action,
  onClose,
}: {
  action: AiAction
  onClose: () => void
}): React.JSX.Element {

  // ── Exécution des actions ────────────────────────────────────────────────

  const handleCreateEvent = async (data: AiActionCreateEvent): Promise<void> => {
    await window.api.calendar.create({
      title:       data.title,
      start_at:    data.start_at,
      end_at:      data.end_at,
      all_day:     data.all_day,
      description: data.description ?? '',
      category:    data.category ?? 'default',
      color:       data.color ?? '#1A56DB',
    })
  }

  const handleCreateNote = async (data: AiActionCreateNote): Promise<void> => {
    const file = await window.api.files.createNote(data.title)
    await window.api.files.writeContent(file.id, data.content)
  }

  return (
    /* Backdrop */
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Card */}
      <div className="animate-scale-in w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        {/* Bouton fermer */}
        <div className="flex justify-end px-4 pt-4">
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulaire selon le type */}
        <div className="px-6 pb-6">
          {action.type === 'create_event' ? (
            <EventForm
              initial={action}
              onConfirm={handleCreateEvent}
              onCancel={onClose}
            />
          ) : (
            <NoteForm
              initial={action}
              onConfirm={handleCreateNote}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
