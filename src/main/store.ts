import { app, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')
const API_KEYS_PATH = path.join(app.getPath('userData'), 'api-keys.enc')

// ── Type (miroir de src/renderer/src/types/settings.ts) ──────────────────────
type AppSettings = {
  profile:    { name: string; emoji: string }
  appearance: { theme: string; animations: boolean; fontSize: string }
  calendar:   { firstDayOfWeek: number; defaultView: string; timeFormat: string; showWeekNumbers: boolean }
  files:      { defaultSort: string; defaultView: string }
  ai:         { provider: string; model: string; temperature: number }
  app:        { language: string; startPage: string; sidebarDefault: string }
}

const DEFAULTS: AppSettings = {
  profile:    { name: 'Killian', emoji: '👋' },
  appearance: { theme: 'Aurora', animations: true, fontSize: 'md' },
  calendar:   { firstDayOfWeek: 1, defaultView: 'month', timeFormat: '24h', showWeekNumbers: false },
  files:      { defaultSort: 'date', defaultView: 'grid' },
  ai:         { provider: 'openai', model: 'gpt-4o', temperature: 0.7 },
  app:        { language: 'fr', startPage: 'home', sidebarDefault: 'expanded' },
}

// ── Merge profond (préserve les clés manquantes des nouvelles versions) ────────
function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base }
  for (const key in override) {
    const b = base[key]
    const o = override[key]
    if (o && typeof o === 'object' && !Array.isArray(o) && b && typeof b === 'object') {
      result[key] = deepMerge(b as object, o as object) as T[typeof key]
    } else if (o !== undefined) {
      result[key] = o as T[typeof key]
    }
  }
  return result
}

// ── Settings JSON ─────────────────────────────────────────────────────────────

export function getSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
    return deepMerge(DEFAULTS, JSON.parse(raw) as Partial<AppSettings>)
  } catch {
    return { ...DEFAULTS }
  }
}

export function patchSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const merged  = deepMerge(current, patch)
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

export function resetSettings(): AppSettings {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf-8')
  return { ...DEFAULTS }
}

// ── API Keys (chiffrées via Electron safeStorage) ─────────────────────────────
// safeStorage utilise le trousseau OS (Keychain macOS, libsecret Linux, DPAPI Windows)
// Les clés sont stockées en base64 chiffré dans api-keys.enc

type StoredKeys = Record<string, string>  // service → base64 encrypted buffer

function loadStoredKeys(): StoredKeys {
  try {
    return JSON.parse(fs.readFileSync(API_KEYS_PATH, 'utf-8')) as StoredKeys
  } catch {
    return {}
  }
}

function saveStoredKeys(keys: StoredKeys): void {
  fs.writeFileSync(API_KEYS_PATH, JSON.stringify(keys), 'utf-8')
}

export function setApiKey(service: string, key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage non disponible sur ce système')
  }
  const keys = loadStoredKeys()
  keys[service] = safeStorage.encryptString(key).toString('base64')
  saveStoredKeys(keys)
}

export function getApiKey(service: string): string {
  if (!safeStorage.isEncryptionAvailable()) return ''
  const keys = loadStoredKeys()
  if (!keys[service]) return ''
  try {
    return safeStorage.decryptString(Buffer.from(keys[service], 'base64'))
  } catch {
    return ''
  }
}

export function hasApiKey(service: string): boolean {
  const keys = loadStoredKeys()
  return !!keys[service]
}

export function deleteApiKey(service: string): void {
  const keys = loadStoredKeys()
  delete keys[service]
  saveStoredKeys(keys)
}
