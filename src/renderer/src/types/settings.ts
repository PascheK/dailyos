export type ColorTheme = {
  label: string
  /** Toutes les CSS custom properties à appliquer sur :root */
  vars: Record<string, string>
}

// ── Builder compact ───────────────────────────────────────────────────────────

function theme(
  label: string,
  /** slate [950, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50] */
  s: [string, string, string, string, string, string, string, string, string, string, string],
  /** blue [700, 600, 500, 400, 300] */
  b: [string, string, string, string, string],
  /** cyan [600, 500, 400] */
  c: [string, string, string],
  /** gradient [from, to] */
  g: [string, string]
): ColorTheme {
  return {
    label,
    vars: {
      '--color-slate-950': s[0],
      '--color-slate-900': s[1],
      '--color-slate-800': s[2],
      '--color-slate-700': s[3],
      '--color-slate-600': s[4],
      '--color-slate-500': s[5],
      '--color-slate-400': s[6],
      '--color-slate-300': s[7],
      '--color-slate-200': s[8],
      '--color-slate-100': s[9],
      '--color-slate-50': s[10],
      '--color-blue-700': b[0],
      '--color-blue-600': b[1],
      '--color-blue-500': b[2],
      '--color-blue-400': b[3],
      '--color-blue-300': b[4],
      '--color-cyan-600': c[0],
      '--color-cyan-500': c[1],
      '--color-cyan-400': c[2],
      '--color-primary': b[2],
      '--accent-gradient-start': g[0],
      '--accent-gradient-end': g[1]
    }
  }
}

// ── Thèmes ────────────────────────────────────────────────────────────────────

export const COLOR_THEMES: ColorTheme[] = [
  // 🌸 Blossom — palette douce
  theme(
    'Blossom',
    [
      '#0d0a12',  // 950 — fond le plus sombre
      '#151020',  // 900 — fond principal
      '#1d1628',  // 800 — cartes
      '#28203a',  // 700 — bordures
      '#3c2e52',  // 600 — bordures hover
      '#8c7a90',  // 500 — texte désactivé (rehaussé)
      '#c2b4cc',  // 400 — texte secondaire (bien lisible)
      '#ddd4e8',  // 300 — titres secondaires
      '#eee8f4',  // 200 — texte fort
      '#F8E1E1',  // 100 — blanc teinté
      '#fdf4f4'   // 50  — blanc pur
    ],
    ['#455f8d', '#5570a0', '#6985B5', '#99B4DA', '#bdd0ea'],
    ['#7a6882', '#9a84a3', '#C1CFE6'],
    ['#6985B5', '#806E83']
  ),

  // 🌌 Midnight — violet profond
  theme(
    'Midnight',
    [
      '#09090f',
      '#0e0e1a',
      '#16162a',
      '#1f1f3a',
      '#2d2d52',
      '#5a5a8a',  // 500 — rehaussé
      '#8888b8',  // 400 — rehaussé
      '#b0b0d8',  // 300 — rehaussé
      '#d0d0ec',
      '#e8e8f8',
      '#f0f0ff'
    ],
    ['#4739c4', '#5a4de0', '#6d5fff', '#9d8fff', '#b8adff'],
    ['#0891b2', '#06b6d4', '#22d3ee'],
    ['#6d5fff', '#06b6d4']
  ),

  // 🍵 Matcha — vert forêt
  theme(
    'Matcha',
    [
      '#080e09',
      '#0d1510',
      '#121e16',
      '#192a1e',
      '#223d29',
      '#4a7a54',  // 500 — rehaussé
      '#7ab086',  // 400 — rehaussé
      '#a8cead',  // 300 — rehaussé
      '#c8e4cc',
      '#e4f4e6',
      '#f0faf1'
    ],
    ['#145c2d', '#1a7a3a', '#22a84e', '#4dca74', '#86efac'],
    ['#0f7466', '#0d9488', '#2dd4bf'],
    ['#22a84e', '#2dd4bf']
  ),

  // 🔥 Ember — ambre chaud
  theme(
    'Ember',
    [
      '#100904',
      '#1a1008',
      '#24160a',
      '#321e0e',
      '#472c14',
      '#8c6030',  // 500 — rehaussé
      '#c08050',  // 400 — rehaussé
      '#e0aa78',  // 300 — rehaussé
      '#f0cc9a',
      '#faf0d4',
      '#fffbf0'
    ],
    ['#b45309', '#d97706', '#f59e0b', '#fbbf24', '#fde68a'],
    ['#c2410c', '#ea580c', '#fb923c'],
    ['#f59e0b', '#ea580c']
  ),

  // 🌊 Ocean — bleu abyssal
  theme(
    'Ocean',
    [
      '#060c12',
      '#0a1420',
      '#0f1e2e',
      '#162a3e',
      '#1e3c55',
      '#3a7898',  // 500 — rehaussé
      '#60a8c0',  // 400 — rehaussé
      '#8ecee0',  // 300 — rehaussé
      '#b8e4f0',
      '#d8f4fc',
      '#f0fbff'
    ],
    ['#155e75', '#0e7490', '#0891b2', '#22d3ee', '#67e8f9'],
    ['#0f766e', '#0d9488', '#2dd4bf'],
    ['#0891b2', '#2dd4bf']
  ),

  // ⬛ Graphite — monochrome élégant
  theme(
    'Graphite',
    [
      '#090909',
      '#111111',
      '#1a1a1a',
      '#242424',
      '#303030',
      '#606060',  // 500 — rehaussé
      '#909090',  // 400 — rehaussé
      '#b8b8b8',  // 300 — rehaussé
      '#d4d4d4',
      '#eeeeee',
      '#f5f5f5'
    ],
    ['#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6'],
    ['#6b7280', '#9ca3af', '#d1d5db'],
    ['#d1d5db', '#9ca3af']
  )
]

/** Applique un thème de couleurs via les variables CSS */
export function applyTheme(t: ColorTheme): void {
  const root = document.documentElement
  for (const [key, val] of Object.entries(t.vars)) {
    root.style.setProperty(key, val)
  }
  // Met à jour le gradient (utilisé par .bg-accent-gradient)
  root.style.setProperty(
    '--accent-gradient',
    `linear-gradient(135deg, ${t.vars['--accent-gradient-start']}, ${t.vars['--accent-gradient-end']})`
  )
}

// ── AppSettings ───────────────────────────────────────────────────────────────

export type AppSettings = {
  profile: {
    name: string
    emoji: string
  }
  appearance: {
    theme: string
    animations: boolean
    fontSize: 'sm' | 'md' | 'lg'
  }
  calendar: {
    firstDayOfWeek: 0 | 1
    defaultView: 'month' | 'week' | 'day'
    timeFormat: '12h' | '24h'
    showWeekNumbers: boolean
  }
  files: {
    defaultSort: 'date' | 'name' | 'size'
    defaultView: 'list' | 'grid'
  }
  ai: {
    provider: 'openai' | 'anthropic' | 'ollama'
    model: string
    temperature: number
  }
  app: {
    language: 'fr' | 'en'
    startPage: 'home' | 'files' | 'notes' | 'calendar'
    sidebarDefault: 'expanded' | 'collapsed'
  }
  budget: {
    defaultCurrency: string
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  profile: { name: '', emoji: '✨' },
  appearance: { theme: 'Blossom', animations: true, fontSize: 'md' },
  calendar: { firstDayOfWeek: 1, defaultView: 'month', timeFormat: '24h', showWeekNumbers: false },
  files: { defaultSort: 'date', defaultView: 'grid' },
  ai: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.7 },
  app: { language: 'fr', startPage: 'home', sidebarDefault: 'expanded' },
  budget: { defaultCurrency: 'CHF' }
}
