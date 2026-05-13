import { useState, useEffect, useRef } from 'react'
import {
  User,
  Palette,
  AppWindow,
  Calendar,
  FolderOpen,
  Bot,
  Cloud,
  Database,
  Info,
  ChevronRight,
  Eye,
  EyeOff,
  Check,
  Loader2,
  Download,
  RotateCcw,
  Trash2,
  ExternalLink,
  Shield,
  AlertCircle
} from 'lucide-react'
import {
  COLOR_THEMES,
  applyTheme,
  DEFAULT_SETTINGS,
  type AppSettings,
  type ColorTheme
} from '../types/settings'

// ── Types ─────────────────────────────────────────────────────────────────────
type Section =
  | 'profile'
  | 'appearance'
  | 'app'
  | 'calendar'
  | 'files'
  | 'ai'
  | 'sync'
  | 'data'
  | 'about'

// ── Composants UI réutilisables ───────────────────────────────────────────────

function SectionTitle({
  title,
  subtitle
}: {
  title: string
  subtitle?: string
}): React.JSX.Element {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function SettingRow({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-700/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  value,
  onChange
}: {
  value: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none ${value ? 'bg-blue-500' : 'bg-slate-700'}`}
      style={{ height: 22, width: 40 }}
    >
      <div
        className="absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200"
        style={{
          width: 18,
          height: 18,
          transform: value ? 'translateX(18px)' : 'translateX(0)'
        }}
      />
    </button>
  )
}

function Select<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function ApiKeyField({
  service,
  label,
  placeholder,
  description
}: {
  service: string
  label: string
  placeholder: string
  description?: string
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.settings.hasApiKey(service).then(setHasKey)
  }, [service])

  const handleSave = async (): Promise<void> => {
    if (!value.trim()) return
    setSaving(true)
    await window.api.settings.setApiKey(service, value.trim())
    setValue('')
    setHasKey(true)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleDelete = async (): Promise<void> => {
    await window.api.settings.deleteApiKey(service)
    setHasKey(false)
    setValue('')
  }

  return (
    <div className="flex flex-col gap-2 py-3.5 border-b border-slate-700/50 last:border-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {hasKey && (
          <span className="text-[10px] font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> Configurée
          </span>
        )}
      </div>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave()
            }}
            placeholder={hasKey ? '••••••••••••••••' : placeholder}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={!value.trim() || saving}
          className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 min-w-[80px] justify-center"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saved ? (
            <>
              <Check className="w-3.5 h-3.5" /> Sauvé
            </>
          ) : (
            'Sauver'
          )}
        </button>
        {hasKey && (
          <button
            onClick={() => void handleDelete()}
            className="p-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            title="Supprimer la clé"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Sections ──────────────────────────────────────────────────────────────────

function ProfileSection({ settings, onPatch }: SectionProps): React.JSX.Element {
  const EMOJIS = ['👋', '😊', '🚀', '💻', '🎨', '🎯', '⚡', '🌟', '🔥', '🦊', '🐉', '🌸']

  return (
    <div>
      <SectionTitle title="Profil" subtitle="Ton identité dans DailyOS." />
      <SettingRow label="Nom d'affichage" description="Utilisé dans le message de bienvenue.">
        <input
          type="text"
          defaultValue={settings.profile.name}
          onBlur={(e) =>
            onPatch({
              profile: { ...settings.profile, name: e.target.value.trim() || 'Utilisateur' }
            })
          }
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-44 transition-colors"
        />
      </SettingRow>
      <SettingRow label="Emoji avatar" description="Affiché à côté de ton nom.">
        <div className="flex gap-1.5 flex-wrap justify-end max-w-48">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onPatch({ profile: { ...settings.profile, emoji: e } })}
              className={`text-lg p-1 rounded-lg transition-colors ${settings.profile.emoji === e ? 'bg-blue-500/20 ring-1 ring-blue-500' : 'hover:bg-slate-700'}`}
            >
              {e}
            </button>
          ))}
        </div>
      </SettingRow>
    </div>
  )
}

function AppearanceSection({ settings, onPatch }: SectionProps): React.JSX.Element {
  const handleTheme = (theme: ColorTheme): void => {
    applyTheme(theme)
    onPatch({ appearance: { ...settings.appearance, theme: theme.label } })
  }

  return (
    <div>
      <SectionTitle title="Apparence" subtitle="Personnalise les couleurs et l'interface." />

      {/* Sélecteur de thème */}
      <div className="mb-8">
        <p className="text-sm font-medium text-slate-300 mb-4">Thème de couleurs</p>
        <div className="grid grid-cols-3 gap-3">
          {COLOR_THEMES.map((t) => {
            const isActive = settings.appearance.theme === t.label
            const bg950 = t.vars['--color-slate-950']
            const bg900 = t.vars['--color-slate-900']
            const bg800 = t.vars['--color-slate-800']
            const accent = t.vars['--color-blue-500']
            const accent2 = t.vars['--accent-gradient-end']
            const textLight = t.vars['--color-slate-100']
            const textMuted = t.vars['--color-slate-500']
            const border = t.vars['--color-slate-700']

            return (
              <button
                key={t.label}
                onClick={() => handleTheme(t)}
                className={`group relative flex flex-col rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                  isActive
                    ? 'border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/10'
                    : 'border-transparent hover:border-slate-600'
                }`}
              >
                {/* ── Mini-preview de l'UI ── */}
                <div className="w-full h-24 flex" style={{ background: bg950 }}>
                  {/* Sidebar */}
                  <div
                    className="w-9 h-full flex flex-col gap-1 p-1.5"
                    style={{ background: bg900, borderRight: `1px solid ${border}` }}
                  >
                    {/* Logo dot */}
                    <div
                      className="w-4 h-4 rounded-md mb-1"
                      style={{ background: `linear-gradient(135deg, ${accent}, ${accent2})` }}
                    />
                    {/* Nav items */}
                    {[accent, textMuted, textMuted, textMuted].map((c, i) => (
                      <div
                        key={i}
                        className="w-full h-1.5 rounded-full opacity-60"
                        style={{ background: c }}
                      />
                    ))}
                  </div>

                  {/* Contenu principal */}
                  <div className="flex-1 p-2 flex flex-col gap-1.5" style={{ background: bg950 }}>
                    {/* Header bar */}
                    <div
                      className="w-full h-4 rounded-md"
                      style={{ background: bg900, border: `1px solid ${border}` }}
                    >
                      <div
                        className="h-full w-1/3 rounded-md"
                        style={{ background: `linear-gradient(90deg, ${accent}30, transparent)` }}
                      />
                    </div>
                    {/* Cards */}
                    <div className="flex gap-1 flex-1">
                      {[accent + '20', bg800, bg800].map((bg, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-md"
                          style={{ background: bg, border: `1px solid ${border}` }}
                        >
                          {i === 0 && (
                            <div
                              className="m-1 h-1 rounded-full"
                              style={{ background: accent, opacity: 0.8 }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Input bar */}
                    <div
                      className="w-full h-3 rounded-md"
                      style={{ background: bg800, border: `1px solid ${border}` }}
                    />
                  </div>
                </div>

                {/* ── Label & badge actif ── */}
                <div
                  className="flex items-center justify-between px-3 py-2.5"
                  style={{ background: bg900, borderTop: `1px solid ${border}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{t.emoji}</span>
                    <span className="text-xs font-semibold" style={{ color: textLight }}>
                      {t.label}
                    </span>
                  </div>
                  {isActive && (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: accent }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <SettingRow
        label="Animations"
        description="Transitions et effets de mouvement dans l'interface."
      >
        <Toggle
          value={settings.appearance.animations}
          onChange={(v) => onPatch({ appearance: { ...settings.appearance, animations: v } })}
        />
      </SettingRow>

      <SettingRow label="Taille du texte" description="Taille de police globale.">
        <Select
          value={settings.appearance.fontSize}
          onChange={(v) => onPatch({ appearance: { ...settings.appearance, fontSize: v } })}
          options={[
            { value: 'sm', label: 'Petite' },
            { value: 'md', label: 'Normale' },
            { value: 'lg', label: 'Grande' }
          ]}
        />
      </SettingRow>
    </div>
  )
}

function AppSection({ settings, onPatch }: SectionProps): React.JSX.Element {
  return (
    <div>
      <SectionTitle title="Application" subtitle="Comportement général de DailyOS." />

      <SettingRow label="Langue" description="Langue de l'interface.">
        <Select
          value={settings.app.language}
          onChange={(v) => onPatch({ app: { ...settings.app, language: v } })}
          options={[
            { value: 'fr', label: 'Français' }
            // { value: 'en', label: 'English' }
          ]}
        />
      </SettingRow>

      <SettingRow label="Page de démarrage" description="Page affichée à l'ouverture de l'app.">
        <Select
          value={settings.app.startPage}
          onChange={(v) => onPatch({ app: { ...settings.app, startPage: v } })}
          options={[
            { value: 'home', label: 'Accueil' },
            { value: 'files', label: 'Fichiers' },
            { value: 'notes', label: 'Notes' },
            { value: 'calendar', label: 'Calendrier' }
          ]}
        />
      </SettingRow>

      <SettingRow label="Sidebar par défaut" description="État de la barre latérale au démarrage.">
        <Select
          value={settings.app.sidebarDefault}
          onChange={(v) => onPatch({ app: { ...settings.app, sidebarDefault: v } })}
          options={[
            { value: 'expanded', label: 'Ouverte' },
            { value: 'collapsed', label: 'Réduite' }
          ]}
        />
      </SettingRow>
    </div>
  )
}

function CalendarSection({ settings, onPatch }: SectionProps): React.JSX.Element {
  return (
    <div>
      <SectionTitle title="Calendrier" subtitle="Préférences d'affichage et de comportement." />

      <SettingRow label="Premier jour de la semaine">
        <Select
          value={String(settings.calendar.firstDayOfWeek) as '0' | '1'}
          onChange={(v) =>
            onPatch({ calendar: { ...settings.calendar, firstDayOfWeek: Number(v) as 0 | 1 } })
          }
          options={[
            { value: '1', label: 'Lundi' },
            { value: '0', label: 'Dimanche' }
          ]}
        />
      </SettingRow>

      <SettingRow label="Vue par défaut">
        <Select
          value={settings.calendar.defaultView}
          onChange={(v) => onPatch({ calendar: { ...settings.calendar, defaultView: v } })}
          options={[
            { value: 'month', label: 'Mois' },
            { value: 'week', label: 'Semaine' },
            { value: 'day', label: 'Jour' }
          ]}
        />
      </SettingRow>

      <SettingRow label="Format de l'heure">
        <Select
          value={settings.calendar.timeFormat}
          onChange={(v) => onPatch({ calendar: { ...settings.calendar, timeFormat: v } })}
          options={[
            { value: '24h', label: '24h (14:30)' },
            { value: '12h', label: '12h (2:30 PM)' }
          ]}
        />
      </SettingRow>

      <SettingRow
        label="Numéros de semaine"
        description="Affiche le numéro ISO de la semaine dans la vue mois."
      >
        <Toggle
          value={settings.calendar.showWeekNumbers}
          onChange={(v) => onPatch({ calendar: { ...settings.calendar, showWeekNumbers: v } })}
        />
      </SettingRow>
    </div>
  )
}

function FilesSection({ settings, onPatch }: SectionProps): React.JSX.Element {
  return (
    <div>
      <SectionTitle
        title="Fichiers"
        subtitle="Préférences d'affichage du gestionnaire de fichiers."
      />

      <SettingRow label="Tri par défaut">
        <Select
          value={settings.files.defaultSort}
          onChange={(v) => onPatch({ files: { ...settings.files, defaultSort: v } })}
          options={[
            { value: 'date', label: "Date d'ajout" },
            { value: 'name', label: 'Nom A → Z' },
            { value: 'size', label: 'Taille' }
          ]}
        />
      </SettingRow>

      <SettingRow label="Vue par défaut">
        <Select
          value={settings.files.defaultView}
          onChange={(v) => onPatch({ files: { ...settings.files, defaultView: v } })}
          options={[
            { value: 'grid', label: 'Grille' },
            { value: 'list', label: 'Liste' }
          ]}
        />
      </SettingRow>
    </div>
  )
}

// ── Modèles connus par provider ───────────────────────────────────────────────

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o', desc: 'Le plus puissant, multimodal' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini', desc: 'Rapide et économique' },
  { value: 'o1-mini', label: 'o1 mini', desc: 'Raisonnement avancé' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', desc: 'Léger et rapide' }
]

const ANTHROPIC_MODELS = [
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5', desc: 'Ultra-puissant, contexte long' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', desc: 'Équilibre performance/vitesse' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5', desc: 'Ultrarapide et compact' }
]

const POPULAR_OLLAMA_MODELS = [
  { name: 'llama3.2', size: '2 GB', desc: 'Meta Llama 3.2 — 3B params' },
  { name: 'llama3.1', size: '4.7 GB', desc: 'Meta Llama 3.1 — 8B params' },
  { name: 'mistral', size: '4.1 GB', desc: 'Mistral AI — 7B params' },
  { name: 'phi3', size: '2.2 GB', desc: 'Microsoft Phi-3 — 3.8B params' },
  { name: 'gemma3', size: '3.3 GB', desc: 'Google Gemma 3 — 4B params' },
  { name: 'qwen2.5', size: '4.4 GB', desc: 'Alibaba Qwen 2.5 — 7B params' },
  { name: 'deepseek-r1', size: '4.7 GB', desc: 'DeepSeek R1 — 7B params' },
  { name: 'codellama', size: '3.8 GB', desc: 'Code LLaMA — 7B params' }
]

// ── Panneau Ollama ─────────────────────────────────────────────────────────────

function OllamaPanel({
  currentModel,
  onModelSelect
}: {
  currentModel: string
  onModelSelect: (name: string) => void
}): React.JSX.Element {
  const [status, setStatus] = useState<{ running: boolean; models: OllamaModel[] } | null>(null)
  const [pullName, setPullName] = useState('')
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState<{ status: string; pct: number } | null>(null)
  const [pullError, setPullError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Charger le statut Ollama
  const refresh = (): void => {
    window.api.ollama.status().then(setStatus)
  }
  useEffect(() => {
    refresh()
  }, [])

  // Listeners de progression
  useEffect(() => {
    const offProgress = window.api.ollama.onPullProgress((data) => {
      const pct = data.total ? Math.round(((data.completed ?? 0) / data.total) * 100) : 0
      setPullProgress({ status: data.status, pct })
    })
    const offDone = window.api.ollama.onPullDone((name) => {
      setPulling(false)
      setPullProgress(null)
      setPullName('')
      refresh()
      onModelSelect(name)
    })
    const offError = window.api.ollama.onPullError((msg) => {
      setPulling(false)
      setPullProgress(null)
      setPullError(msg)
    })
    return () => {
      offProgress()
      offDone()
      offError()
    }
  }, [onModelSelect])

  const handlePull = async (): Promise<void> => {
    const name = pullName.trim()
    if (!name || pulling) return
    setPulling(true)
    setPullError(null)
    setPullProgress({ status: 'Connexion…', pct: 0 })
    await window.api.ollama.pull(name)
  }

  const handleDelete = async (name: string): Promise<void> => {
    if (!confirm(`Supprimer le modèle "${name}" ?`)) return
    await window.api.ollama.delete(name)
    refresh()
    if (currentModel === name) onModelSelect('')
  }

  const formatSize = (bytes: number): string => {
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
    return `${(bytes / 1e6).toFixed(0)} MB`
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Vérification d'Ollama…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Statut */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
          status.running
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-red-500/5 border-red-500/20'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2 h-2 rounded-full ${status.running ? 'bg-emerald-400' : 'bg-red-400'}`}
            style={{ boxShadow: status.running ? '0 0 6px #4ade80' : '0 0 6px #f87171' }}
          />
          <span
            className={`text-sm font-medium ${status.running ? 'text-emerald-300' : 'text-red-300'}`}
          >
            {status.running
              ? `Ollama actif · ${status.models.length} modèle${status.models.length !== 1 ? 's' : ''} installé${status.models.length !== 1 ? 's' : ''}`
              : 'Ollama non détecté'}
          </span>
        </div>
        {status.running ? (
          <button
            onClick={refresh}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Actualiser
          </button>
        ) : (
          <a
            href="https://ollama.com/download"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Installer Ollama <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {!status.running && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Ollama permet de faire tourner des LLM en local, sans clé API ni connexion internet.
            <br />
            Après l'installation, lance{' '}
            <code className="bg-slate-700 px-1 rounded text-blue-400 mx-0.5">ollama serve</code>
            puis reviens ici.
          </p>
        </div>
      )}

      {/* Modèles installés */}
      {status.running && status.models.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Modèles installés
          </p>
          {status.models.map((m) => (
            <div
              key={m.name}
              onClick={() => onModelSelect(m.name)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                currentModel === m.name
                  ? 'border-blue-500/40 bg-blue-500/8'
                  : 'border-slate-700/60 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                  currentModel === m.name ? 'bg-blue-400' : 'bg-slate-600'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{m.name}</p>
                <p className="text-[11px] text-slate-500">{formatSize(m.size)}</p>
              </div>
              {currentModel === m.name && (
                <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                  Actif
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDelete(m.name)
                }}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Télécharger un modèle */}
      {status.running && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Installer un modèle
          </p>

          {/* Suggestions */}
          <div className="grid grid-cols-2 gap-1.5">
            {POPULAR_OLLAMA_MODELS.map((m) => {
              const installed = status.models.some((i) => i.name === m.name)
              return (
                <button
                  key={m.name}
                  onClick={() => {
                    setPullName(m.name)
                    setShowSuggestions(false)
                  }}
                  disabled={installed}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                    installed
                      ? 'border-emerald-500/20 bg-emerald-500/5 opacity-60 cursor-default'
                      : 'border-slate-700/60 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800 cursor-pointer'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{m.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{m.desc}</p>
                  </div>
                  <span
                    className={`text-[10px] flex-shrink-0 mt-0.5 ${installed ? 'text-emerald-400' : 'text-slate-600'}`}
                  >
                    {installed ? '✓' : m.size}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Champ de saisie */}
          <div className="flex gap-2">
            <input
              value={pullName}
              onChange={(e) => setPullName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handlePull()}
              placeholder="llama3.2, mistral, phi3…"
              disabled={pulling}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600 disabled:opacity-50"
            />
            <button
              onClick={() => void handlePull()}
              disabled={!pullName.trim() || pulling}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
            >
              {pulling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {pulling ? 'Téléchargement…' : 'Installer'}
            </button>
          </div>

          {/* Barre de progression */}
          {pullProgress && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 truncate">{pullProgress.status}</span>
                {pullProgress.pct > 0 && (
                  <span className="text-blue-400 font-mono flex-shrink-0 ml-2">
                    {pullProgress.pct}%
                  </span>
                )}
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: pullProgress.pct > 0 ? `${pullProgress.pct}%` : '100%',
                    background: 'var(--accent-gradient)',
                    animation:
                      pullProgress.pct === 0
                        ? 'progress-indeterminate 1.5s ease-in-out infinite'
                        : 'none'
                  }}
                />
              </div>
            </div>
          )}

          {pullError && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{pullError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section IA principale ─────────────────────────────────────────────────────

function AISection({ settings, onPatch }: SectionProps): React.JSX.Element {
  const [tempVal, setTempVal] = useState(settings.ai.temperature)
  const provider = settings.ai.provider

  const setProvider = (p: typeof provider): void => {
    // Changer le modèle par défaut selon le provider
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-sonnet-4-5',
      ollama: ''
    }
    onPatch({ ai: { ...settings.ai, provider: p, model: defaultModels[p] ?? '' } })
  }

  const setModel = (m: string): void => {
    onPatch({ ai: { ...settings.ai, model: m } })
  }

  const knownModels =
    provider === 'openai' ? OPENAI_MODELS : provider === 'anthropic' ? ANTHROPIC_MODELS : null

  return (
    <div>
      <SectionTitle
        title="IA & Modèles"
        subtitle="Configure ton assistant. Les clés API sont chiffrées via le trousseau système."
      />

      {/* Fournisseur */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Fournisseur
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'openai', label: 'OpenAI', sub: 'GPT-4o, o1…', color: '#10a37f' },
              { id: 'anthropic', label: 'Anthropic', sub: 'Claude…', color: '#d97706' },
              { id: 'ollama', label: 'Ollama', sub: '100% local', color: '#6985B5' }
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`flex flex-col gap-1 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                provider === p.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8'
                  : 'border-slate-700/60 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: p.color }}
                />
                <span
                  className={`text-sm font-semibold ${provider === p.id ? 'text-white' : 'text-slate-300'}`}
                >
                  {p.label}
                </span>
                {provider === p.id && (
                  <div className="ml-auto w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-500 ml-4">{p.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modèle */}
      {provider !== 'ollama' && knownModels && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Modèle
          </p>
          <div className="flex flex-col gap-1.5">
            {knownModels.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                  settings.ai.model === m.value
                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/8'
                    : 'border-slate-700/60 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                    settings.ai.model === m.value ? 'bg-[var(--color-primary)]' : 'bg-slate-600'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">{m.label}</p>
                  <p className="text-[11px] text-slate-500">{m.desc}</p>
                </div>
                {settings.ai.model === m.value && (
                  <span className="text-[10px] bg-[var(--color-primary)]/15 text-[var(--color-primary)] px-2 py-0.5 rounded-full font-medium">
                    Actif
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Panneau Ollama complet */}
      {provider === 'ollama' && (
        <div className="mb-6 border-b border-slate-700/50">
          <OllamaPanel currentModel={settings.ai.model} onModelSelect={(m) => setModel(m)} />
        </div>
      )}

      {/* Température */}
      <div className="py-4 border-b border-slate-700/50 mb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-slate-200">Température</p>
            <p className="text-xs text-slate-500 mt-0.5">Précision (0) ↔ Créativité (2)</p>
          </div>
          <span className="text-sm text-[var(--color-primary)] font-mono font-semibold bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-lg">
            {tempVal.toFixed(1)}
          </span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={tempVal}
            onChange={(e) => setTempVal(Number(e.target.value))}
            onMouseUp={() => onPatch({ ai: { ...settings.ai, temperature: tempVal } })}
            onTouchEnd={() => onPatch({ ai: { ...settings.ai, temperature: tempVal } })}
            className="w-full accent-[var(--color-primary)] h-1.5 cursor-pointer"
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1.5">
          <span>0 — Déterministe</span>
          <span>1 — Équilibré</span>
          <span>2 — Créatif</span>
        </div>
      </div>

      {/* Clés API */}
      {provider !== 'ollama' && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4">
            Clés API
          </p>
          {provider === 'openai' && (
            <ApiKeyField
              service="openai"
              label="Clé OpenAI"
              placeholder="sk-proj-..."
              description="Requise pour GPT-4o, GPT-4o-mini, o1…"
            />
          )}
          {provider === 'anthropic' && (
            <ApiKeyField
              service="anthropic"
              label="Clé Anthropic"
              placeholder="sk-ant-..."
              description="Requise pour Claude Opus, Sonnet, Haiku."
            />
          )}
        </div>
      )}
    </div>
  )
}

function SyncSection(): React.JSX.Element {
  return (
    <div>
      <SectionTitle title="Synchronisation" subtitle="Synchronise tes données entre appareils." />
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
        <Cloud className="w-12 h-12" />
        <p className="text-sm font-medium">Bientôt disponible</p>
        <p className="text-xs text-center max-w-xs">
          La sync Supabase arrive dans la prochaine phase. Tes données restent en local pour
          l'instant.
        </p>
      </div>
    </div>
  )
}

function DataSection(): React.JSX.Element {
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    await window.api.settings.export()
    setExporting(false)
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  const handleReset = async (): Promise<void> => {
    if (
      !confirm(
        'Réinitialiser toutes les préférences ? Les données (fichiers, notes, calendrier) ne seront pas supprimées.'
      )
    )
      return
    setResetting(true)
    await window.api.settings.reset()
    window.location.reload()
  }

  return (
    <div>
      <SectionTitle title="Données" subtitle="Exporte ou réinitialise tes données." />

      <div className="flex flex-col gap-3">
        {/* Export */}
        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700/50">
          <div>
            <p className="text-sm font-medium text-slate-200">Exporter toutes les données</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Calendrier, fichiers, notes, préférences → fichier JSON.
            </p>
          </div>
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : exported ? (
              <Check className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exported ? 'Exporté !' : 'Exporter'}
          </button>
        </div>

        {/* Reset préférences */}
        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700/50">
          <div>
            <p className="text-sm font-medium text-slate-200">Réinitialiser les préférences</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Remet tous les paramètres aux valeurs par défaut. Les données ne sont pas affectées.
            </p>
          </div>
          <button
            onClick={() => void handleReset()}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Réinitialiser
          </button>
        </div>

        {/* Danger zone */}
        <div className="mt-4 p-4 bg-red-500/5 rounded-xl border border-red-500/20">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
            Zone de danger
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Supprimer toutes les clés API</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Efface les clés chiffrées du trousseau OS.
              </p>
            </div>
            <button
              onClick={async () => {
                if (!confirm('Supprimer toutes les clés API ?')) return
                await Promise.all(
                  ['openai', 'anthropic'].map((s) => window.api.settings.deleteApiKey(s))
                )
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-sm font-medium text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Effacer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AboutSection(): React.JSX.Element {
  const [info, setInfo] = useState<{
    version: string
    platform: string
    userData: string
    electron: string
    node: string
  } | null>(null)

  useEffect(() => {
    window.api.settings.appInfo().then(setInfo)
  }, [])

  return (
    <div>
      <SectionTitle title="À propos" subtitle="Informations sur DailyOS." />

      <div className="flex flex-col items-center py-8 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-accent-gradient flex items-center justify-center text-3xl">
          ✦
        </div>
        <h3 className="text-xl font-bold text-white">DailyOS</h3>
        <p className="text-slate-500 text-sm">Ton assistant de productivité personnel</p>
        {info && (
          <span className="text-xs text-slate-600 bg-slate-800 px-3 py-1 rounded-full">
            v{info.version}
          </span>
        )}
      </div>

      {info && (
        <div className="flex flex-col gap-2 mt-2">
          {[
            ['Version', info.version],
            ['Plateforme', info.platform],
            ['Electron', info.electron],
            ['Node.js', info.node]
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between py-2.5 border-b border-slate-700/50 last:border-0"
            >
              <span className="text-sm text-slate-400">{k}</span>
              <span className="text-sm text-slate-300 font-mono">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-400">Données</span>
            <span className="text-xs text-slate-500 font-mono truncate max-w-xs">
              {info.userData}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-slate-300 transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> GitHub
        </a>
        <a
          href="https://docs.dailyos.app"
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-slate-300 transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Docs
        </a>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

type SectionProps = {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => void
}

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'appearance', label: 'Apparence', icon: Palette },
  { id: 'app', label: 'Application', icon: AppWindow },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'files', label: 'Fichiers', icon: FolderOpen },
  { id: 'ai', label: 'IA & API', icon: Bot },
  { id: 'sync', label: 'Synchronisation', icon: Cloud },
  { id: 'data', label: 'Données', icon: Database },
  { id: 'about', label: 'À propos', icon: Info }
]

export function Settings(): React.JSX.Element {
  const [active, setActive] = useState<Section>('profile')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const handlePatch = async (patch: Partial<AppSettings>): Promise<void> => {
    const updated = await window.api.settings.patch(patch)
    setSettings(updated)
    // Applique immédiatement la préférence d'animations
    if (patch.appearance?.animations !== undefined) {
      document.body.classList.toggle('no-animations', !patch.appearance.animations)
    }
  }

  const sectionProps: SectionProps = { settings, onPatch: (p) => void handlePatch(p) }

  const content: Record<Section, React.JSX.Element> = {
    profile: <ProfileSection {...sectionProps} />,
    appearance: <AppearanceSection {...sectionProps} />,
    app: <AppSection {...sectionProps} />,
    calendar: <CalendarSection {...sectionProps} />,
    files: <FilesSection {...sectionProps} />,
    ai: <AISection {...sectionProps} />,
    sync: <SyncSection />,
    data: <DataSection />,
    about: <AboutSection />
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar gauche */}
      <aside className="w-52 shrink-0 bg-slate-900 border-r border-slate-700/50 flex flex-col py-4 gap-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-4 mb-2">
          Paramètres
        </p>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              active === id
                ? 'bg-blue-500/15 text-blue-400 border-r-2 border-blue-500'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {active === id && <ChevronRight className="w-3 h-3 opacity-50" />}
          </button>
        ))}
      </aside>

      {/* Panneau de droite */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : (
          <div className="max-w-xl mx-auto px-8 py-8">{content[active]}</div>
        )}
      </main>
    </div>
  )
}
