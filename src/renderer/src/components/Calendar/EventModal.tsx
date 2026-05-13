import { useState, useEffect, useRef } from 'react'
import { X, Clock, Calendar, AlignLeft, Tag } from 'lucide-react'
import type { CalendarEvent, NewCalendarEvent } from '../../types/calendar'

type Props = {
  day: Date
  existingEvent?: CalendarEvent
  onClose: () => void
  onCreate: (event: NewCalendarEvent) => Promise<void>
  onUpdate?: (id: number, event: NewCalendarEvent) => Promise<void>
}

const COLORS = [
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#10b981', label: 'Vert' },
  { value: '#f59e0b', label: 'Jaune' },
  { value: '#ef4444', label: 'Rouge' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Rose' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#f97316', label: 'Orange' }
]

const CATEGORIES = ['Personnel', 'Travail', 'Santé', 'Social', 'Autre']
const MONTHS_LONG = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
]
const DAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export function EventModal({
  day,
  existingEvent,
  onClose,
  onCreate,
  onUpdate
}: Props): React.JSX.Element {
  const [title, setTitle] = useState(existingEvent?.title ?? '')
  const [color, setColor] = useState(existingEvent?.color ?? '#3b82f6')
  const [category, setCategory] = useState(existingEvent?.category ?? 'Personnel')
  const [description, setDescription] = useState(existingEvent?.description ?? '')
  const [allDay, setAllDay] = useState(existingEvent?.all_day ?? false)
  const [startTime, setStartTime] = useState(
    existingEvent ? new Date(existingEvent.start_at).toTimeString().slice(0, 5) : '09:00'
  )
  const [endTime, setEndTime] = useState(
    existingEvent ? new Date(existingEvent.end_at).toTimeString().slice(0, 5) : '10:00'
  )
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const isEditing = !!existingEvent
  const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  const dateLabel = `${DAYS_LONG[day.getDay()]} ${day.getDate()} ${MONTHS_LONG[day.getMonth()]}`

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)

    const payload: NewCalendarEvent = {
      title: title.trim(),
      description,
      start_at: allDay ? `${dateStr}T00:00:00` : `${dateStr}T${startTime}:00`,
      end_at:   allDay ? `${dateStr}T23:59:00` : `${dateStr}T${endTime}:00`,
      all_day: allDay,
      category,
      color
    }

    if (isEditing && onUpdate) {
      await onUpdate(existingEvent.id, payload)
    } else {
      await onCreate(payload)
    }

    setLoading(false)
    onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div
          className="h-1.5 w-full transition-colors duration-200"
          style={{ backgroundColor: color }}
        />

        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Calendar className="w-4 h-4" />
            <span>{dateLabel}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-5">
          <input
            type="text"
            placeholder="Nom de l'événement"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-2xl font-semibold text-white placeholder-slate-600 focus:outline-none border-b border-slate-700 pb-3 transition-colors focus:border-slate-500"
          />

          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setAllDay((a) => !a)}
              className={`w-10 h-5 rounded-full transition-colors duration-200 ${allDay ? 'bg-blue-500' : 'bg-slate-700'}`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform duration-200 shadow ${allDay ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </div>
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              Toute la journée
            </span>
          </label>

          {!allDay && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors" />
                <span className="text-slate-500 text-sm">→</span>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors" />
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <AlignLeft className="w-4 h-4 text-slate-500 shrink-0 mt-2.5" />
            <textarea
              placeholder="Ajouter une description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <Tag className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === cat ? 'text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  style={category === cat ? { backgroundColor: color } : {}}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  className={`w-6 h-6 rounded-full transition-all duration-150 ${color === c.value ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: color }}
            >
              {loading ? '...' : isEditing ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
