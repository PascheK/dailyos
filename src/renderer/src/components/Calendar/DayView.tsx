import type { CalendarEvent } from '../../types/calendar'
import { DAYS, MONTHS } from './utils'

type Props = {
  current: Date
  eventsForDay: (day: Date) => CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
    onDayClick: (day: Date) => void

}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7) // 7h → 23h
const HOUR_HEIGHT = 64 // px par heure

function getEventStyle(event: CalendarEvent): React.CSSProperties {
  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const startMinutes = (start.getHours() - 7) * 60 + start.getMinutes()
  const duration = (end.getTime() - start.getTime()) / 60000
  return {
    top: (startMinutes / 60) * HOUR_HEIGHT,
    height: Math.max((duration / 60) * HOUR_HEIGHT, 24),
    backgroundColor: event.color + '33',
    borderLeftColor: event.color,
    color: event.color
  }
}

export function DayView({ current, eventsForDay, onEventClick, onDayClick }: Props): React.JSX.Element {
  const dayEvents = eventsForDay(current)
  const now = new Date()
  const nowTop = (((now.getHours() - 7) * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT

  return (
    <div
      className="flex-1 relative border-l border-slate-700 cursor-pointer"
      onClick={() => onDayClick(current)}
    >
      {' '}
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            {DAYS[(current.getDay() + 6) % 7]}
          </span>
          <span className="text-2xl font-bold text-white">
            {current.getDate()} {MONTHS[current.getMonth()]}
          </span>
        </div>
      </div>
      {/* Grille horaire */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Colonne heures */}
          <div className="w-16 shrink-0">
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pr-3 text-xs text-slate-500"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="-translate-y-2">{h}h</span>
              </div>
            ))}
          </div>

          {/* Colonne événements */}
          <div className="flex-1 relative border-l border-slate-700">
            {/* Lignes horaires */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="border-t border-slate-700/50"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {/* Indicateur heure actuelle */}
            <div className="absolute left-0 right-0 flex items-center z-10" style={{ top: nowTop }}>
              <div className="w-2 h-2 rounded-full bg-blue-500 -translate-x-1" />
              <div className="flex-1 h-px bg-blue-500" />
            </div>

            {/* Événements */}
            {dayEvents.map((e) => (
              <div
                key={e.id}
                onClick={() => onEventClick(e)}
                className="absolute left-2 right-2 rounded-lg px-2 py-1 cursor-pointer border-l-2 transition-all duration-150 hover:brightness-125 hover:scale-[1.01]"
                style={getEventStyle(e)}
              >
                <p className="text-xs font-semibold truncate" style={{ color: e.color }}>
                  {e.title}
                </p>
                <p className="text-xs opacity-70" style={{ color: e.color }}>
                  {new Date(e.start_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {' → '}
                  {new Date(e.end_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
