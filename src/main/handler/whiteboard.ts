import { ipcMain } from 'electron'
import { db } from '../db'

export function registerWhiteboardHandlers(): void {

  // Lister tous les boards (sans le champ data — trop lourd pour la liste)
  ipcMain.handle('whiteboard:list', () => {
    return db
      .prepare('SELECT id, title, color, created_at, updated_at FROM whiteboards ORDER BY updated_at DESC')
      .all()
  })

  // Créer un nouveau board vide
  ipcMain.handle('whiteboard:create', (_, { title, color }: { title: string; color: string }) => {
    const result = db
      .prepare("INSERT INTO whiteboards (title, color) VALUES (?, ?)")
      .run(title, color)

    return {
      id: Number(result.lastInsertRowid),
      title,
      color,
      data: '{}',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  })

  // Charger un board complet (avec son data Excalidraw)
  ipcMain.handle('whiteboard:get', (_, id: number) => {
    return db.prepare('SELECT * FROM whiteboards WHERE id = ?').get(id)
  })

  // Sauvegarder le contenu Excalidraw (appelé en debounce depuis le renderer)
  ipcMain.handle('whiteboard:save', (_, { id, data }: { id: number; data: string }) => {
    db.prepare("UPDATE whiteboards SET data = ?, updated_at = datetime('now') WHERE id = ?").run(data, id)
    return true
  })

  // Renommer un board
  ipcMain.handle('whiteboard:rename', (_, { id, title }: { id: number; title: string }) => {
    db.prepare("UPDATE whiteboards SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id)
    return true
  })

  // Supprimer un board
  ipcMain.handle('whiteboard:delete', (_, id: number) => {
    db.prepare('DELETE FROM whiteboards WHERE id = ?').run(id)
    return true
  })
}
