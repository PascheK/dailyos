import { useState, useCallback } from 'react'
import type { CalendarEvent, NewCalendarEvent } from '../types/calendar'

export function useCalendar(): {
  events: CalendarEvent[]
  loadEvents: (from: string, to: string) => Promise<void>
  updateEvent: (id: number, event: NewCalendarEvent) => Promise<void>
  createEvent: (event: NewCalendarEvent) => Promise<void>
  deleteEvent: (id: number) => Promise<void>
} {
  const [events, setEvents] = useState<CalendarEvent[]>([])

  const loadEvents = useCallback(async (from: string, to: string): Promise<void> => {
    const data = await window.api.calendar.list({ from, to })
    setEvents(data as CalendarEvent[])
  }, [])

  const createEvent = useCallback(async (event: NewCalendarEvent): Promise<void> => {
    const created = await window.api.calendar.create(event)
    setEvents((prev) => [...prev, created as CalendarEvent])
  }, [])
  const updateEvent = useCallback(async (id: number, event: NewCalendarEvent): Promise<void> => {
    const updated = await window.api.calendar.update(id, event)
    setEvents((prev) => prev.map((e) => (e.id === id ? (updated as CalendarEvent) : e)))
  }, [])

  const deleteEvent = useCallback(async (id: number): Promise<void> => {
    await window.api.calendar.delete(id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { events, loadEvents, createEvent, updateEvent, deleteEvent }
}
