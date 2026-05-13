import type { CalendarEvent } from '../../types/calendar'
import { DAYS, isSameDay, getWeekDays } from './utils'

type Props = {
  current: Date
  today: Date
  eventsForDay: (day: Date) => CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDayClick: (day: Date) => void
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7)
const HOUR_HEIGHT = 64

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

export function WeekView({ current, today, eventsForDay, onEventClick, onDayClick }: Props): React.JSX.Element {
  const weekDays = getWeekDays(current)
  const now = new Date()
  const nowTop = (((now.getHours() - 7) * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT

  return (
    <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
      {/* Header jours */}
      <div className="flex border-b border-slate-700">
        <div className="w-16 shrink-0" />
        {weekDays.map((day, i) => (
          <div
            key={i}
            className="flex-1 relative border-l border-slate-700 cursor-pointer"
            onClick={() => onDayClick(day)}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {DAYS[i]}
            </p>
            <p
              className={`text-lg font-bold mt-0.5 ${isSameDay(day, today) ? 'text-blue-400' : 'text-white'}`}
            >
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>

      {/* Grille */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Heures */}
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

          {/* Colonnes jours */}
          {weekDays.map((day, i) => (
            <div key={i} className="flex-1 relative border-l border-slate-700">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="border-t border-slate-700/50"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}

              {/* Indicateur heure actuelle */}
              {isSameDay(day, today) && (
                <div
                  className="absolute left-0 right-0 flex items-center z-10"
                  style={{ top: nowTop }}
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 -translate-x-1" />
                  <div className="flex-1 h-px bg-blue-500" />
                </div>
              )}

              {/* Événements */}
              {eventsForDay(day).map((e) => (
                <div
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className="absolute left-1 right-1 rounded-md px-1.5 py-0.5 cursor-pointer border-l-2 transition-all duration-150 hover:brightness-125"
                  style={getEventStyle(e)}
                >
                  <p className="text-xs font-semibold truncate" style={{ color: e.color }}>
                    {e.title}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
