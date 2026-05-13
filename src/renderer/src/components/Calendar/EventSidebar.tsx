import { X, Clock, Tag, Trash2, Pencil, Calendar } from 'lucide-react'
import type { CalendarEvent } from '../../types/calendar'
import { useState } from 'react'

type Props = {
  event: CalendarEvent
  onClose: () => void
  onDelete: (id: number) => Promise<void>
  onEdit: (event: CalendarEvent) => void
}

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

export function EventSidebar({ event, onClose, onDelete, onEdit }: Props): React.JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const start = new Date(event.start_at)
  const end = new Date(event.end_at)

  const dateLabel = `${DAYS_LONG[start.getDay()]} ${start.getDate()} ${MONTHS_LONG[start.getMonth()]} ${start.getFullYear()}`
  const timeLabel = event.all_day
    ? 'Toute la journée'
    : `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`

  const handleDelete = async (): Promise<void> => {
    await onDelete(event.id)
    onClose()
  }

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-700/50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Bande couleur */}
      <div className="h-1.5 w-full" style={{ backgroundColor: event.color }} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Détails
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 px-5 py-5 flex flex-col gap-5 overflow-auto">
        {/* Titre */}
        <div className="flex items-start gap-3">
          <div
            className="w-3 h-3 rounded-full mt-1 shrink-0"
            style={{ backgroundColor: event.color }}
          />
          <h2 className="text-lg font-semibold text-white leading-snug">{event.title}</h2>
        </div>

        {/* Date */}
        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm text-slate-300">{dateLabel}</span>
            <span className="text-xs text-slate-500 mt-0.5">{timeLabel}</span>
          </div>
        </div>

        {/* Heure */}
        {!event.all_day && (
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-sm text-slate-300">{timeLabel}</span>
          </div>
        )}

        {/* Catégorie */}
        <div className="flex items-center gap-3">
          <Tag className="w-4 h-4 text-slate-500 shrink-0" />
          <span
            className="text-sm px-2.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: event.color + '22', color: event.color }}
          >
            {event.category}
          </span>
        </div>

        {/* Description */}
        {event.description && (
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-300 leading-relaxed">{event.description}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-slate-700/50 flex flex-col gap-2">
        <button
          onClick={() => onEdit(event)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
        >
          <Pencil className="w-4 h-4" />
          Modifier
        </button>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
            >
              Confirmer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
