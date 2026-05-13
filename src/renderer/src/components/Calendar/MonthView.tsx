import type { CalendarEvent } from '../../types/calendar'
import { DAYS, isSameDay } from './utils'

type Props = {
  days: (Date | null)[]
  today: Date
  eventsForDay: (day: Date) => CalendarEvent[]
  onDayClick: (day: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

export function MonthView({
  days,
  today,
  eventsForDay,
  onDayClick,
  onEventClick
}: Props): React.JSX.Element {
  return (
    <div className="flex-1 flex flex-col">
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider py-2"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 gap-px bg-slate-700 rounded-xl overflow-hidden border border-slate-700">
        {days.map((day, i) => (
          <div
            key={i}
            onClick={() => day && onDayClick(day)}
            className="bg-slate-800 p-2 min-h-24 flex flex-col gap-1 cursor-pointer hover:ring-1 hover:ring-slate-600 transition-all duration-150 group"
          >
            {day && (
              <>
                <span
                  className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-150 ${
                    isSameDay(day, today)
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-400 group-hover:text-white'
                  }`}
                >
                  {day.getDate()}
                </span>
                {eventsForDay(day).map((e) => (
                  <span
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onEventClick(e)
                    }}
                    className="text-xs px-2 py-0.5 rounded-md truncate cursor-pointer transition-all duration-150 hover:brightness-125 hover:scale-[1.02]"
                    style={{ backgroundColor: e.color + '33', color: e.color }}
                  >
                    {e.title}
                  </span>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
