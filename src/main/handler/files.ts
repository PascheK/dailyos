import { ipcMain, dialog, shell, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { db } from '../db'

const FILES_DIR = path.join(app.getPath('userData'), 'files')
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true })

// Requête de base : fichiers avec le nom du dossier via JOIN
const SELECT_FILES = `
  SELECT f.id, f.name, f.path, f.size, f.mime_type,
         f.folder_id, fo.name AS folder, f.created_at
  FROM files f
  LEFT JOIN folders fo ON f.folder_id = fo.id
`

export function registerFilesHandlers(): void {

  // ── Fichiers ──────────────────────────────────────────────────────────────

  ipcMain.handle('files:list', (_, folderId?: number) => {
    if (folderId !== undefined && folderId !== null) {
      return db.prepare(`${SELECT_FILES} WHERE f.folder_id = ? ORDER BY f.created_at DESC`).all(folderId)
    }
    return db.prepare(`${SELECT_FILES} ORDER BY f.created_at DESC`).all()
  })

  ipcMain.handle('files:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Ajouter des fichiers',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Tous les fichiers', extensions: ['*'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
        { name: 'Vidéos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return []

    const added: unknown[] = []

    for (const filePath of result.filePaths) {
      const stat = fs.statSync(filePath)
      const name = path.basename(filePath)
      const ext = path.extname(filePath).toLowerCase().slice(1)
      const mime = getMimeType(ext)

      try {
        const row = db
          .prepare('INSERT INTO files (name, path, size, mime_type) VALUES (?, ?, ?, ?)')
          .run(name, filePath, stat.size, mime)

        added.push({
          id: Number(row.lastInsertRowid),
          name,
          path: filePath,
          size: stat.size,
          mime_type: mime,
          folder_id: null,
          folder: null,
          created_at: new Date().toISOString()
        })
      } catch {
        // UNIQUE constraint → fichier déjà ajouté
      }
    }

    return added
  })

  ipcMain.handle('files:open', async (_, filePath: string) => {
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
    return true
  })

  ipcMain.handle('files:reveal', (_, filePath: string) => {
    shell.showItemInFolder(filePath)
    return true
  })

  ipcMain.handle('files:move', (_, { id, folderId }: { id: number; folderId: number | null }) => {
    db.prepare('UPDATE files SET folder_id = ? WHERE id = ?').run(folderId, id)
    return true
  })

  ipcMain.handle('files:delete', (_, id: number) => {
    db.prepare('DELETE FROM files WHERE id = ?').run(id)
    return true
  })

  // ── Dossiers ──────────────────────────────────────────────────────────────

  ipcMain.handle('folders:list', () => {
    return db.prepare('SELECT * FROM folders ORDER BY name ASC').all()
  })

  ipcMain.handle('folders:create', (_, name: string) => {
    const result = db.prepare('INSERT INTO folders (name) VALUES (?)').run(name.trim())
    return { id: Number(result.lastInsertRowid), name: name.trim() }
  })

  ipcMain.handle('folders:delete', (_, id: number) => {
    // Les fichiers du dossier supprimé passent à folder_id = NULL (ON DELETE SET NULL)
    db.prepare('DELETE FROM folders WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('folders:rename', (_, { id, name }: { id: number; name: string }) => {
    db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim(), id)
    return true
  })

  // ── Notes (fichiers .md gérés par l'app) ──────────────────────────────────

  // Crée un fichier .md dans userData/files/notes/, l'insère dans files DB
  ipcMain.handle('files:createNote', (_, title: string) => {
    const notesDir = path.join(FILES_DIR, 'notes')
    if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true })

    const safe     = (title || 'note').replace(/[^a-z0-9À-ÿ\s_-]/gi, '').trim() || 'note'
    const fileName = `${safe}-${Date.now()}.md`
    const filePath = path.join(notesDir, fileName)

    fs.writeFileSync(filePath, '', 'utf-8')

    const row = db
      .prepare('INSERT INTO files (name, path, size, mime_type, folder_id) VALUES (?, ?, 0, ?, NULL)')
      .run(fileName, filePath, 'text/markdown')

    return {
      id:         Number(row.lastInsertRowid),
      name:       fileName,
      path:       filePath,
      size:       0,
      mime_type:  'text/markdown',
      folder_id:  null,
      folder:     null,
      created_at: new Date().toISOString()
    }
  })

  // Lit le contenu d'un fichier depuis son chemin stocké en DB
  ipcMain.handle('files:readContent', (_, id: number) => {
    const file = db.prepare('SELECT path FROM files WHERE id = ?').get(id) as { path: string } | undefined
    if (!file) return ''
    try {
      return fs.readFileSync(file.path, 'utf-8')
    } catch {
      return ''
    }
  })

  // Écrit le contenu dans le fichier et met à jour la taille en DB
  ipcMain.handle('files:writeContent', (_, { id, content }: { id: number; content: string }) => {
    const file = db.prepare('SELECT path FROM files WHERE id = ?').get(id) as { path: string } | undefined
    if (!file) return false
    try {
      fs.writeFileSync(file.path, content, 'utf-8')
      db.prepare('UPDATE files SET size = ? WHERE id = ?').run(Buffer.byteLength(content, 'utf-8'), id)
      return true
    } catch {
      return false
    }
  })

  // Renomme une note : déplace le fichier sur le disque et met à jour DB
  ipcMain.handle('files:renameNote', (_, { id, newName }: { id: number; newName: string }) => {
    const file = db.prepare('SELECT path, name FROM files WHERE id = ?').get(id) as { path: string; name: string } | undefined
    if (!file) return false
    try {
      const dir  = path.dirname(file.path)
      const ext  = path.extname(file.name)                     // .md
      const safe = newName.replace(/[/\\:*?"<>|]/g, '').trim() || 'note'
      const newFileName = `${safe}${ext}`
      const newPath     = path.join(dir, newFileName)

      fs.renameSync(file.path, newPath)
      db.prepare('UPDATE files SET name = ?, path = ? WHERE id = ?').run(newFileName, newPath, id)
      return { name: newFileName, path: newPath }
    } catch {
      return false
    }
  })
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    zip: 'application/zip',
    json: 'application/json',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    js: 'text/javascript',
    jsx: 'text/javascript',
    css: 'text/css',
    html: 'text/html'
  }
  return map[ext] ?? 'application/octet-stream'
}
