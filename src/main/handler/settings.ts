import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { db } from '../db'
import {
  getSettings, patchSettings, resetSettings,
  getApiKey, setApiKey, hasApiKey, deleteApiKey
} from '../store'

export function registerSettingsHandlers(): void {

  // ── Préférences ────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:patch', (_, patch: object) => patchSettings(patch))

  ipcMain.handle('settings:reset', () => resetSettings())

  // ── Clés API (safeStorage) ─────────────────────────────────────────────────

  ipcMain.handle('settings:hasApiKey', (_, service: string) =>
    hasApiKey(service)
  )

  ipcMain.handle('settings:setApiKey', (_, { service, key }: { service: string; key: string }) => {
    setApiKey(service, key)
    return true
  })

  ipcMain.handle('settings:getApiKey', (_, service: string) =>
    getApiKey(service)
  )

  ipcMain.handle('settings:deleteApiKey', (_, service: string) => {
    deleteApiKey(service)
    return true
  })

  // ── Export des données ─────────────────────────────────────────────────────

  ipcMain.handle('settings:export', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Exporter les données DailyOS',
      defaultPath: path.join(app.getPath('downloads'), `dailyos-export-${Date.now()}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (canceled || !filePath) return false

    const data = {
      exportedAt: new Date().toISOString(),
      version:    app.getVersion(),
      settings:   getSettings(),
      calendar:   db.prepare('SELECT * FROM calendar_events').all(),
      files:      db.prepare('SELECT * FROM files').all(),
      folders:    db.prepare('SELECT * FROM folders').all(),
      whiteboards: db.prepare('SELECT * FROM whiteboards').all(),
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  })

  // ── Info app ───────────────────────────────────────────────────────────────

  ipcMain.handle('settings:appInfo', () => ({
    version:  app.getVersion(),
    platform: process.platform,
    userData: app.getPath('userData'),
    electron: process.versions.electron,
    node:     process.versions.node,
  }))
}
