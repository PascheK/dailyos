// Constantes injectées par @electron-forge/plugin-vite
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string

import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { createReadStream, promises as fs } from 'fs'
import { Readable } from 'stream'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
const icon = join(__dirname, '../../resources/icon.png')
import './db'
import { registerCalendarHandlers } from './handler/calendar'
import { registerFilesHandlers } from './handler/files'
import { registerWhiteboardHandlers } from './handler/whiteboard'
import { registerSettingsHandlers } from './handler/settings'
import { registerAiHandlers } from './handler/ai'
import { registerOllamaHandlers } from './handler/ollama'

// ── Protocole local-file:// ────────────────────────────────────────────────
// Doit être appelé AVANT app.ready (contrainte Electron).
// On n'utilise PAS standard:true — avec standard, Chromium normalise l'URL
// et interprète le premier segment du chemin comme un hostname (le met en
// minuscules et supprime le slash initial). Sans standard, la chaîne brute
// est passée au handler sans transformation.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      secure: true,          // contexte sécurisé (comme https)
      supportFetchAPI: true, // le renderer peut faire fetch('local-file://...')
      stream: true,          // nécessaire pour les range requests vidéo
      bypassCSP: true        // contourne la CSP pour les ressources locales
    }
  }
])

// Table de correspondance extension → MIME type
const MIME_MAP: Record<string, string> = {
  // Images
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  bmp: 'image/bmp', ico: 'image/x-icon', tiff: 'image/tiff', avif: 'image/avif',
  // Documents
  pdf: 'application/pdf',
  // Vidéo
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', m4v: 'video/x-m4v',
  // Audio
  mp3: 'audio/mpeg', flac: 'audio/flac', ogg: 'audio/ogg',
  wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4',
  // Texte / code
  txt: 'text/plain', md: 'text/markdown', html: 'text/html',
  css: 'text/css', js: 'text/javascript', ts: 'text/typescript',
  json: 'application/json', xml: 'text/xml',
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 960,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // En dev : charge le serveur Vite local. En prod : charge le HTML buildé.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // ── Handler local-file:// ────────────────────────────────────────────────
  // Sans standard:true, request.url est la chaîne brute envoyée par le renderer.
  // On extrait le chemin avec slice() pour éviter toute normalisation URL.
  // On lit le fichier via fs.createReadStream (streaming) pour supporter les
  // vidéos lourdes et les range requests (lecture partielle par l'élément <video>).
  protocol.handle('local-file', async (request) => {
    try {
      // Extraction manuelle du chemin (pas de new URL() — schéma non standard)
      const raw = request.url.slice('local-file://'.length)
      const filePath = decodeURIComponent(raw)

      const stats = await fs.stat(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
      const mimeType = MIME_MAP[ext] ?? 'application/octet-stream'

      // Range request (nécessaire pour que <video> puisse scrubber)
      const rangeHeader = request.headers.get('range')
      if (rangeHeader) {
        const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
        if (match) {
          const start = parseInt(match[1], 10)
          const end = match[2] ? parseInt(match[2], 10) : stats.size - 1
          const chunkSize = end - start + 1

          const nodeStream = createReadStream(filePath, { start, end })
          const webStream = Readable.toWeb(nodeStream) as ReadableStream

          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Range': `bytes ${start}-${end}/${stats.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize)
            }
          })
        }
      }

      // Réponse complète en streaming
      const nodeStream = createReadStream(filePath)
      const webStream = Readable.toWeb(nodeStream) as ReadableStream

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(stats.size),
          'Accept-Ranges': 'bytes'
        }
      })
    } catch {
      return new Response('Fichier introuvable', { status: 404 })
    }
  })

  registerCalendarHandlers()
  registerFilesHandlers()
  registerWhiteboardHandlers()
  registerSettingsHandlers()
  registerAiHandlers()
  registerOllamaHandlers()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  // Auto-update — uniquement en production (pas en dev)
  // Vérifie les releases GitHub et installe en tâche de fond
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify()
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
