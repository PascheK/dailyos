export type CalendarEvent = {
  id: number
  title: string
  description: string
  start_at: string
  end_at: string
  all_day: boolean
  category: string
  color: string
}

export type NewCalendarEvent = Omit<CalendarEvent, 'id'>