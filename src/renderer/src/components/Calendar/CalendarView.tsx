import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Columns, List } from 'lucide-react'
import { useCalendar } from '../../hooks/useCalendar'
import type { CalendarEvent } from '../../types/calendar'
import { getDaysInMonth, MONTHS } from './utils'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { DayView } from './DayView'
import { useModal } from '@renderer/hooks/useModal'
import { EventModal } from '@renderer/components/Calendar/EventModal'
import { EventSidebar } from '@renderer/components/Calendar/EventSidebar'

type CalendarViewMode = 'month' | 'week' | 'day'

type DatePickerProps = {
  current: Date
  onSelect: (date: Date) => void
  onClose: () => void
}

function DatePicker({ current, onSelect, onClose }: DatePickerProps): React.JSX.Element {
  const [pickerYear, setPickerYear] = useState(current.getFullYear())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div className="absolute top-12 left-0 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setPickerYear((y) => y - 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400"
        >
          ‹
        </button>
        <span className="font-semibold text-white">{pickerYear}</span>
        <button
          onClick={() => setPickerYear((y) => y + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => {
              onSelect(new Date(pickerYear, i, 1))
              onClose()
            }}
            className={`py-2 rounded-lg text-sm transition-colors ${
              i === current.getMonth() && pickerYear === current.getFullYear()
                ? 'bg-blue-500 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            {m.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CalendarView(): React.JSX.Element {
  const [view, setView] = useState<CalendarViewMode>('month')
  const [current, setCurrent] = useState(new Date())
  const [showPicker, setShowPicker] = useState(false)
  const { events, loadEvents, createEvent, deleteEvent, updateEvent } = useCalendar()
  const eventModal = useModal<Date>()
  const eventSidebar = useModal<CalendarEvent>()
  const editModal = useModal<CalendarEvent>()
  const year = current.getFullYear()
  const month = current.getMonth()
  const days = getDaysInMonth(year, month)
  const today = new Date()
  useEffect(() => {
    const from = new Date(year, month, 1).toISOString()
    const to = new Date(year, month + 1, 0).toISOString()
    loadEvents(from, to)
  }, [year, month, loadEvents])
  const prev = (): void => {
    if (view === 'month') setCurrent(new Date(year, month - 1, 1))
    else if (view === 'week')
      setCurrent((d) => {
        const n = new Date(d)
        n.setDate(d.getDate() - 7)
        return n
      })
    else
      setCurrent((d) => {
        const n = new Date(d)
        n.setDate(d.getDate() - 1)
        return n
      })
  }

  const next = (): void => {
    if (view === 'month') setCurrent(new Date(year, month + 1, 1))
    else if (view === 'week')
      setCurrent((d) => {
        const n = new Date(d)
        n.setDate(d.getDate() + 7)
        return n
      })
    else
      setCurrent((d) => {
        const n = new Date(d)
        n.setDate(d.getDate() + 1)
        return n
      })
  }

  const eventsForDay = (day: Date): CalendarEvent[] =>
    events.filter((e) => {
      const eventDate = new Date(e.start_at)
      return (
        eventDate.getFullYear() === day.getFullYear() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getDate() === day.getDate()
      )
    })

  const viewButtons: { mode: CalendarViewMode; icon: React.JSX.Element }[] = [
    { mode: 'month', icon: <LayoutGrid className="w-4 h-4" /> },
    { mode: 'week', icon: <Columns className="w-4 h-4" /> },
    { mode: 'day', icon: <List className="w-4 h-4" /> }
  ]

  return (
    <div className="relative h-full p-6 flex flex-col gap-4 overflow-hidden">
        <div className="grid grid-cols-3 items-center py-2">
          <div className="relative">
            <button
              onClick={() => setShowPicker((p) => !p)}
              className="text-xl font-semibold text-white hover:text-blue-400 transition-colors"
            >
              {MONTHS[month]} {year}
            </button>
            {showPicker && (
              <DatePicker
                current={current}
                onSelect={setCurrent}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>

          <div className="flex items-center justify-center gap-1">
            <button
              onClick={prev}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrent(new Date())}
              className="px-3 h-8 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              Aujourd'hui
            </button>
            <button
              onClick={next}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              ›
            </button>
          </div>

          <div className="flex items-center justify-end gap-1 bg-slate-800 rounded-lg p-1 w-fit ml-auto">
            {viewButtons.map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  view === mode
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {view === 'month' && (
          <MonthView
            days={days}
            today={today}
            eventsForDay={eventsForDay}
            onDayClick={eventModal.open}
            onEventClick={eventSidebar.open}
          />
        )}
        {view === 'week' && (
          <WeekView
            current={current}
            today={today}
            eventsForDay={eventsForDay}
            onEventClick={eventSidebar.open}
            onDayClick={eventModal.open}
          />
        )}
        {view === 'day' && (
          <DayView
            current={current}
            eventsForDay={eventsForDay}
            onEventClick={eventSidebar.open}
            onDayClick={eventModal.open}
          />
        )}
      {/* Sidebar droite en overlay */}
      {eventSidebar.isOpen && eventSidebar.data && (
        <div className="absolute top-0 right-0 bottom-0 w-80 z-40 shadow-2xl">
        <EventSidebar
          event={eventSidebar.data}
          onClose={eventSidebar.close}
          onDelete={deleteEvent}
          onEdit={(e) => {
            eventSidebar.close()
            editModal.open(e)
          }}
        />
        </div>
      )}

      {editModal.isOpen && editModal.data && (
        <EventModal
          day={new Date(editModal.data.start_at)}
          existingEvent={editModal.data}
          onClose={editModal.close}
          onCreate={createEvent}
          onUpdate={updateEvent}
        />
      )}

      {/* Modal création */}
      {eventModal.isOpen && eventModal.data && (
        <EventModal day={eventModal.data} onClose={eventModal.close} onCreate={createEvent} />
      )}
    </div>
  )
}
