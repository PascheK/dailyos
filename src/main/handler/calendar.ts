import { ipcMain } from 'electron'
import { db } from '../db'

export function registerCalendarHandlers(): void {
  ipcMain.handle('calendar:list', (_, { from, to }) =>
    db
      .prepare('SELECT * FROM events WHERE start_at >= ? AND end_at <= ? ORDER BY start_at')
      .all(from, to)
  )

  ipcMain.handle('calendar:create', (_, event) => {
    const result = db
      .prepare(
        'INSERT INTO events (title, description, start_at, end_at, all_day, category, color) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        event.title,
        event.description,
        event.start_at,
        event.end_at,
        event.all_day ? 1 : 0,
        event.category,
        event.color
      )
    return { id: Number(result.lastInsertRowid), ...event }
  })
  ipcMain.handle('calendar:update', (_, { id, ...data }) => {
    db.prepare(
      "UPDATE events SET title=?, description=?, start_at=?, end_at=?, all_day=?, category=?, color=?, updated_at=datetime('now') WHERE id=?"
    ).run(
      data.title,
      data.description,
      data.start_at,
      data.end_at,
      data.all_day ? 1 : 0,
      data.category,
      data.color,
      id
    )
    return { id, ...data }
  })
  ipcMain.handle('calendar:delete', (_, id) =>
    db.prepare('DELETE FROM events WHERE id = ?').run(id)
  )
}
