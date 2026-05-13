/**
 * SetupWizard — affiché au premier lancement de l'app.
 * Étapes : Bienvenue → Profil → Thème → IA → Terminé
 */

import { useState, useEffect } from 'react'
import {
  Sparkles, User, Palette, Bot, Check, ChevronRight,
  ChevronLeft, Loader2, ExternalLink, Download, Eye, EyeOff
} from 'lucide-react'
import { COLOR_THEMES, applyTheme, type AppSettings } from '../types/settings'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'welcome' | 'profile' | 'theme' | 'ai' | 'done'

const STEPS: Step[] = ['welcome', 'profile', 'theme', 'ai', 'done']

const EMOJIS = ['✨', '🚀', '💻', '🎨', '🎯', '⚡', '🌟', '🔥', '🦊', '🐉', '🌸', '👋']

// ── Sous-composants ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: Step }): React.JSX.Element {
  const idx = STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.filter(s => s !== 'done').map((s, i) => (
        <div key={s} className={`rounded-full transition-all duration-300 ${
          i < idx
            ? 'w-4 h-1.5 bg-[var(--color-primary)]'
            : i === idx
              ? 'w-5 h-1.5 bg-[var(--color-primary)]'
              : 'w-1.5 h-1.5 bg-slate-700'
        }`} />
      ))}
    </div>
  )
}

// ── Étape 1 : Bienvenue ───────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center text-center gap-8">
      <div className="w-24 h-24 rounded-3xl bg-accent-gradient flex items-center justify-center shadow-2xl"
        style={{ boxShadow: '0 0 60px color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
        <Sparkles className="w-12 h-12 text-white" />
      </div>
      <div>
        <h1 className="text-4xl font-bold text-white mb-3">Bienvenue sur DailyOS</h1>
        <p className="text-slate-400 text-lg max-w-sm leading-relaxed">
          Ton assistant de productivité personnel. Prenons 2 minutes pour tout configurer.
        </p>
      </div>
      <button
        onClick={onNext}
        className="flex items-center gap-2 px-8 py-3.5 bg-[var(--color-primary)] hover:opacity-90 rounded-2xl text-white font-semibold text-base transition-all active:scale-95"
      >
        Commencer <ChevronRight className="w-5 h-5" />
      </button>
      <p className="text-xs text-slate-600">Toutes les données restent en local sur ton appareil.</p>
    </div>
  )
}

// ── Étape 2 : Profil ──────────────────────────────────────────────────────────

function ProfileStep({
  name, emoji, onName, onEmoji, onNext, onBack
}: {
  name: string; emoji: string
  onName: (v: string) => void; onEmoji: (v: string) => void
  onNext: () => void; onBack: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
          <User className="w-7 h-7 text-[var(--color-primary)]" />
        </div>
        <h2 className="text-2xl font-bold text-white">Comment tu t'appelles ?</h2>
        <p className="text-slate-500 mt-2 text-sm">Utilisé dans le message de bienvenue.</p>
      </div>

      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={name}
          onChange={e => onName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onNext()}
          placeholder="Ton prénom ou pseudo…"
          autoFocus
          className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-white text-lg focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder-slate-600"
        />

        <div>
          <p className="text-sm text-slate-500 mb-3">Choisis un avatar</p>
          <div className="grid grid-cols-6 gap-2">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => onEmoji(e)}
                className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all ${
                  emoji === e
                    ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] scale-110'
                    : 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
                }`}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 text-sm font-medium transition-colors">
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>
        <button onClick={onNext} disabled={!name.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-2xl text-white text-sm font-semibold transition-all">
          Continuer <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Étape 3 : Thème ──────────────────────────────────────────────────────────

function ThemeStep({
  selected, onSelect, onNext, onBack
}: {
  selected: string; onSelect: (t: string) => void
  onNext: () => void; onBack: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
          <Palette className="w-7 h-7 text-[var(--color-primary)]" />
        </div>
        <h2 className="text-2xl font-bold text-white">Choisis ton thème</h2>
        <p className="text-slate-500 mt-2 text-sm">Tu pourras le changer dans les paramètres.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {COLOR_THEMES.map(t => {
          const isActive = selected === t.label
          const bg    = t.vars['--color-slate-900']
          const card  = t.vars['--color-slate-800']
          const acc   = t.vars['--color-primary']
          const text  = t.vars['--color-slate-100']
          const muted = t.vars['--color-slate-500']
          return (
            <button key={t.label} onClick={() => { onSelect(t.label); applyTheme(t) }}
              className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                isActive ? 'border-[var(--color-primary)] scale-[1.03]' : 'border-transparent hover:border-slate-600'
              }`}>
              {/* Mini preview */}
              <div className="flex h-20" style={{ background: bg }}>
                {/* Sidebar strip */}
                <div className="w-6 flex flex-col gap-1 p-1.5" style={{ background: card }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} className="h-1.5 rounded-full" style={{
                      background: i === 0 ? acc : muted, opacity: i === 0 ? 1 : 0.4
                    }} />
                  ))}
                </div>
                {/* Content */}
                <div className="flex-1 p-2 flex flex-col gap-1.5">
                  <div className="h-2 rounded w-3/4" style={{ background: text, opacity: 0.8 }} />
                  <div className="h-1.5 rounded w-1/2" style={{ background: muted, opacity: 0.5 }} />
                  <div className="mt-auto flex gap-1">
                    <div className="h-3 rounded flex-1" style={{ background: acc, opacity: 0.7 }} />
                    <div className="h-3 rounded flex-1" style={{ background: card }} />
                  </div>
                </div>
              </div>
              {/* Label */}
              <div className="py-2 text-xs font-medium" style={{ background: card, color: text }}>
                {t.label}
              </div>
              {isActive && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: acc }}>
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 text-sm font-medium transition-colors">
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>
        <button onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-2xl text-white text-sm font-semibold transition-all">
          Continuer <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Étape 4 : IA ─────────────────────────────────────────────────────────────

type AiProvider = 'openai' | 'anthropic' | 'ollama'

function AIStep({
  onNext, onBack
}: {
  onNext: (provider: AiProvider, model: string) => void
  onBack: () => void
}): React.JSX.Element {
  const [provider, setProvider] = useState<AiProvider>('openai')
  const [apiKey, setApiKey]     = useState('')
  const [show, setShow]         = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<{ running: boolean } | null>(null)
  const [pulling, setPulling]   = useState(false)
  const [pullModel, setPullModel] = useState('llama3.2')

  useEffect(() => {
    if (provider === 'ollama') {
      window.api.ollama.status().then(s => setOllamaStatus({ running: s.running }))
    }
  }, [provider])

  useEffect(() => {
    const offDone = window.api.ollama.onPullDone(() => { setPulling(false) })
    const offError = window.api.ollama.onPullError(() => { setPulling(false) })
    return () => { offDone(); offError() }
  }, [])

  const handleSaveKey = async (): Promise<void> => {
    if (!apiKey.trim()) return
    setSaving(true)
    await window.api.settings.setApiKey(provider, apiKey.trim())
    setSaving(false)
    setSaved(true)
  }

  const defaultModel: Record<AiProvider, string> = {
    openai:    'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-5',
    ollama:    pullModel,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
          <Bot className="w-7 h-7 text-[var(--color-primary)]" />
        </div>
        <h2 className="text-2xl font-bold text-white">Configure l'assistant IA</h2>
        <p className="text-slate-500 mt-2 text-sm">Tu peux passer cette étape et configurer plus tard.</p>
      </div>

      {/* Choix du provider */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { id: 'openai',    label: 'OpenAI',    sub: 'GPT-4o',     color: '#10a37f' },
          { id: 'anthropic', label: 'Anthropic', sub: 'Claude',      color: '#d97706' },
          { id: 'ollama',    label: 'Ollama',    sub: '100% local',  color: '#6985B5' },
        ] as const).map(p => (
          <button key={p.id} onClick={() => setProvider(p.id)}
            className={`flex flex-col gap-1 px-3 py-3 rounded-xl border-2 transition-all text-left ${
              provider === p.id
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8'
                : 'border-slate-700/60 bg-slate-800/50 hover:border-slate-600'
            }`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className={`text-sm font-semibold ${provider === p.id ? 'text-white' : 'text-slate-300'}`}>{p.label}</span>
            </div>
            <span className="text-[11px] text-slate-500 ml-4">{p.sub}</span>
          </button>
        ))}
      </div>

      {/* Config par provider */}
      {provider !== 'ollama' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            {provider === 'openai' ? 'Clé API OpenAI (commence par sk-proj-)' : 'Clé API Anthropic (commence par sk-ant-)'}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={show ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={provider === 'openai' ? 'sk-proj-...' : 'sk-ant-...'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <button onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={() => void handleSaveKey()} disabled={!apiKey.trim() || saving || saved}
              className="flex items-center gap-1.5 px-4 py-3 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-xl text-white text-sm font-medium transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : 'Sauver'}
            </button>
          </div>
          {saved && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Clé enregistrée dans le trousseau</p>}
        </div>
      )}

      {provider === 'ollama' && (
        <div className="flex flex-col gap-3">
          {ollamaStatus === null ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Vérification…
            </div>
          ) : ollamaStatus.running ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #4ade80' }} />
                Ollama est actif
              </div>
              <div className="flex gap-2">
                <input value={pullModel} onChange={e => setPullModel(e.target.value)}
                  placeholder="llama3.2, mistral…"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors" />
                <button onClick={() => { setPulling(true); void window.api.ollama.pull(pullModel) }}
                  disabled={pulling || !pullModel.trim()}
                  className="flex items-center gap-1.5 px-4 py-3 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-xl text-white text-sm font-medium transition-all">
                  {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {pulling ? 'Téléchargement…' : 'Installer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                Ollama non détecté
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ollama te permet de faire tourner des LLM en local, sans clé API.
                Installe-le, lance <code className="bg-slate-700 px-1 rounded text-[var(--color-primary)] mx-0.5">ollama serve</code> puis reviens.
              </p>
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline">
                <ExternalLink className="w-4 h-4" /> Télécharger Ollama
              </a>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-300 text-sm font-medium transition-colors">
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>
        <button onClick={() => void onNext(provider, defaultModel[provider])}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-2xl text-white text-sm font-semibold transition-all">
          {saved || provider === 'ollama' ? 'Continuer' : 'Passer'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Étape 5 : Terminé ─────────────────────────────────────────────────────────

function DoneStep({ name, emoji, onFinish }: { name: string; emoji: string; onFinish: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center text-center gap-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-accent-gradient flex items-center justify-center text-5xl shadow-2xl">
          {emoji}
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
          <Check className="w-4 h-4 text-white" />
        </div>
      </div>
      <div>
        <h2 className="text-3xl font-bold text-white mb-3">
          Tout est prêt, {name || 'bienvenue'} !
        </h2>
        <p className="text-slate-400 leading-relaxed max-w-sm">
          DailyOS est configuré selon tes préférences. Tu peux tout modifier dans les paramètres.
        </p>
      </div>
      <button
        onClick={onFinish}
        className="flex items-center gap-2 px-8 py-3.5 bg-[var(--color-primary)] hover:opacity-90 rounded-2xl text-white font-semibold text-base transition-all active:scale-95"
      >
        Découvrir DailyOS <Sparkles className="w-5 h-5" />
      </button>
    </div>
  )
}

// ── Wizard principal ──────────────────────────────────────────────────────────

export function SetupWizard({ onComplete }: { onComplete: () => void }): React.JSX.Element {
  const [step, setStep]   = useState<Step>('welcome')
  const [name, setName]   = useState('')
  const [emoji, setEmoji] = useState('✨')
  const [theme, setTheme] = useState('Blossom')

  const next = (): void => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const back = (): void => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const handleAiNext = async (provider: AiProvider, model: string): Promise<void> => {
    await window.api.settings.patch({ ai: { provider, model, temperature: 0.7 } })
    next()
  }

  const handleFinish = async (): Promise<void> => {
    // Sauvegarder profil + thème
    await window.api.settings.patch({
      profile: { name: name.trim() || 'Utilisateur', emoji },
      appearance: { theme, animations: true, fontSize: 'md' },
    })
    localStorage.setItem('dailyos:setup-done', 'true')
    onComplete()
  }

  const content: Record<Step, React.JSX.Element> = {
    welcome: <WelcomeStep onNext={next} />,
    profile: <ProfileStep name={name} emoji={emoji} onName={setName} onEmoji={setEmoji} onNext={next} onBack={back} />,
    theme:   <ThemeStep selected={theme} onSelect={setTheme} onNext={next} onBack={back} />,
    ai:      <AIStep onNext={handleAiNext} onBack={back} />,
    done:    <DoneStep name={name} emoji={emoji} onFinish={() => void handleFinish()} />,
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-6 overflow-auto">
      {/* Fond décoratif */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--color-primary), transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, var(--accent-gradient-end), transparent)' }} />
      </div>

      {/* Card centrale */}
      <div className="animate-scale-in relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-3xl p-8 shadow-2xl">
        {/* Indicateur de progression */}
        {step !== 'welcome' && step !== 'done' && (
          <div className="flex justify-center mb-8">
            <StepDots current={step} />
          </div>
        )}

        {/* Contenu de l'étape */}
        <div key={step} className="animate-fade-in">
          {content[step]}
        </div>
      </div>
    </div>
  )
}
