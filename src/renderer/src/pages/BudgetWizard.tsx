import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  MapPin,
  Wallet,
  Plane,
  Home,
  TrendingUp,
  Loader2,
  CheckCircle2,
  ChevronRight,
  AlertTriangle
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TripReason = 'studies' | 'work' | 'tourism' | 'pvt' | 'other'
type Lifestyle = 'budget' | 'comfortable' | 'luxury'

type WizardData = {
  // Étape 1
  name: string
  total_amount: string
  currency: string
  display_currency: string
  start_date: string
  end_date: string
  // Étape 2
  destination_country: string
  trip_reason: TripReason
  lifestyle: Lifestyle
  // Étape 3
  accommodation_booked: boolean
  accommodation_monthly: string
  flight_out_paid: boolean
  flight_out_amount: string
  flight_return_paid: boolean
  flight_return_amount: string
  monthly_income: string
  spending_margin: number // 0.7 | 0.8 | 0.9 | 1.0
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'CHF', label: 'CHF — Franc suisse' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'USD', label: 'USD — Dollar US' },
  { code: 'JPY', label: 'JPY — Yen japonais' },
  { code: 'GBP', label: 'GBP — Livre sterling' },
  { code: 'CAD', label: 'CAD — Dollar canadien' },
  { code: 'AUD', label: 'AUD — Dollar australien' },
  { code: 'KRW', label: 'KRW — Won coréen' },
  { code: 'CNY', label: 'CNY — Yuan chinois' },
  { code: 'THB', label: 'THB — Baht thaïlandais' }
]

const TRIP_REASONS: { id: TripReason; label: string; icon: string }[] = [
  { id: 'studies', label: 'Études / Bourse', icon: '🎓' },
  { id: 'work', label: 'Travail', icon: '💼' },
  { id: 'tourism', label: 'Tourisme', icon: '🗺️' },
  { id: 'pvt', label: 'PVT', icon: '🌏' },
  { id: 'other', label: 'Autre', icon: '✨' }
]

const LIFESTYLES: { id: Lifestyle; label: string; desc: string; icon: string }[] = [
  { id: 'budget', label: 'Économique', desc: 'Konbini, auberges, transports publics', icon: '🌱' },
  {
    id: 'comfortable',
    label: 'Confortable',
    desc: 'Mix restaurants/konbini, chambre privée',
    icon: '☕'
  },
  { id: 'luxury', label: 'Luxe', desc: 'Restaurants, hôtels, shopping régulier', icon: '✨' }
]

const MARGINS: { val: number; label: string; desc: string }[] = [
  { val: 0.7, label: '70%', desc: 'Strict' },
  { val: 0.8, label: '80%', desc: 'Conseillé' },
  { val: 0.9, label: '90%', desc: 'Confort' },
  { val: 1.0, label: '100%', desc: 'Tout dépenser' }
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function sym(code: string): string {
  return (
    {
      CHF: '₣',
      EUR: '€',
      USD: '$',
      JPY: '¥',
      GBP: '£',
      CAD: 'CA$',
      AUD: 'AU$',
      KRW: '₩',
      CNY: '¥',
      THB: '฿'
    }[code] ?? code
  )
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function in6m(): string {
  return new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i + 1 === current
              ? 'w-5 h-1.5 bg-[var(--color-primary)]'
              : i + 1 < current
                ? 'w-1.5 h-1.5 bg-[var(--color-primary)]/40'
                : 'w-1.5 h-1.5 bg-slate-700'
          }`}
        />
      ))}
    </div>
  )
}

// ── Step 1 : L'essentiel ──────────────────────────────────────────────────────

function Step1({
  data,
  onChange
}: {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}): React.JSX.Element {
  const inputCls =
    'bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors w-full'
  const labelCls = 'text-xs font-medium text-slate-400 mb-1 block'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelCls}>Nom du budget *</label>
        <input
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ex: Bourse Japon 2026, Road trip Europe…"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Montant total *</label>
          <input
            type="number"
            value={data.total_amount}
            onChange={(e) => onChange({ total_amount: e.target.value })}
            placeholder="11000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Devise de base *</label>
          <select
            value={data.currency}
            onChange={(e) => onChange({ currency: e.target.value })}
            className={`${inputCls} cursor-pointer`}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>
          Devise secondaire
          <span className="text-slate-600 font-normal ml-1">
            (optionnel — ex: voir en ¥ si budget en CHF)
          </span>
        </label>
        <select
          value={data.display_currency}
          onChange={(e) => onChange({ display_currency: e.target.value })}
          className={`${inputCls} cursor-pointer`}
        >
          <option value="">Aucune</option>
          {CURRENCIES.filter((c) => c.code !== data.currency).map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.label.split('—')[1]?.trim()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Début *</label>
          <input
            type="date"
            value={data.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Fin *</label>
          <input
            type="date"
            value={data.end_date}
            onChange={(e) => onChange({ end_date: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  )
}

// ── Step 2 : Destination ──────────────────────────────────────────────────────

function Step2({
  data,
  onChange
}: {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}): React.JSX.Element {
  const inputCls =
    'bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors w-full'

  return (
    <div className="flex flex-col gap-5">
      {/* Pays */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-1 block">
          Pays de destination *
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={data.destination_country}
            onChange={(e) => onChange({ destination_country: e.target.value })}
            placeholder="Ex: Japon, Corée du Sud, Thaïlande, Canada…"
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      {/* Raison */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">Raison du séjour *</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TRIP_REASONS.map((r) => (
            <button
              key={r.id}
              onClick={() => onChange({ trip_reason: r.id })}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                data.trip_reason === r.id
                  ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 text-[var(--color-primary)]'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              <span>{r.icon}</span>
              <span className="font-medium text-xs">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Style de vie */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">Style de vie *</label>
        <div className="flex flex-col gap-2">
          {LIFESTYLES.map((l) => (
            <button
              key={l.id}
              onClick={() => onChange({ lifestyle: l.id })}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                data.lifestyle === l.id
                  ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40'
                  : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
              }`}
            >
              <span className="text-xl shrink-0">{l.icon}</span>
              <div>
                <p
                  className={`text-sm font-medium ${data.lifestyle === l.id ? 'text-[var(--color-primary)]' : 'text-slate-200'}`}
                >
                  {l.label}
                </p>
                <p className="text-xs text-slate-500">{l.desc}</p>
              </div>
              {data.lifestyle === l.id && (
                <div className="ml-auto w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 3 : Les détails ──────────────────────────────────────────────────────

function Step3({
  data,
  onChange
}: {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}): React.JSX.Element {
  const inputCls =
    'bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors'
  const sectionCls = 'bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3'

  const months = Math.max(
    1,
    (() => {
      try {
        const s = new Date(data.start_date),
          e = new Date(data.end_date)
        return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
      } catch {
        return 1
      }
    })()
  )
  const theoreticalMonthly = data.total_amount
    ? Math.round(parseFloat(data.total_amount) / months)
    : 0
  const effectiveMonthly = Math.round(
    theoreticalMonthly * data.spending_margin + (parseFloat(data.monthly_income) || 0)
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Logement */}
      <div className={sectionCls}>
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-sm font-medium text-slate-200">Logement</p>
        </div>
        <div className="flex gap-2">
          {[
            { val: false, label: 'Pas encore réservé' },
            { val: true, label: 'Déjà réservé' }
          ].map((opt) => (
            <button
              key={String(opt.val)}
              onClick={() => onChange({ accommodation_booked: opt.val })}
              className={`flex-1 py-2 rounded-xl text-xs border font-medium transition-all ${
                data.accommodation_booked === opt.val
                  ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 text-[var(--color-primary)]'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {data.accommodation_booked && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={data.accommodation_monthly}
              onChange={(e) => onChange({ accommodation_monthly: e.target.value })}
              placeholder="Montant/mois"
              className={`${inputCls} flex-1`}
            />
            <span className="text-xs text-slate-500 shrink-0">{data.currency}/mois</span>
          </div>
        )}
      </div>

      {/* Billets */}
      <div className={sectionCls}>
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-sm font-medium text-slate-200">Billets d'avion</p>
        </div>
        {/* Aller */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">Billet aller</p>
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ flight_out_paid: true })}
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${
                data.flight_out_paid
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              ✓ Déjà payé
            </button>
            <button
              onClick={() => onChange({ flight_out_paid: false })}
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${
                !data.flight_out_paid
                  ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 text-[var(--color-primary)]'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              À payer
            </button>
          </div>
          {!data.flight_out_paid && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={data.flight_out_amount}
                onChange={(e) => onChange({ flight_out_amount: e.target.value })}
                placeholder="Montant estimé"
                className={`${inputCls} flex-1`}
              />
              <span className="text-xs text-slate-500 shrink-0">{data.currency}</span>
            </div>
          )}
        </div>
        {/* Retour */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">Billet retour</p>
          <div className="flex gap-2">
            <button
              onClick={() => onChange({ flight_return_paid: true })}
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${
                data.flight_return_paid
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              ✓ Déjà payé
            </button>
            <button
              onClick={() => onChange({ flight_return_paid: false })}
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${
                !data.flight_return_paid
                  ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 text-[var(--color-primary)]'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              À payer
            </button>
          </div>
          {!data.flight_return_paid && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={data.flight_return_amount}
                onChange={(e) => onChange({ flight_return_amount: e.target.value })}
                placeholder="Montant estimé"
                className={`${inputCls} flex-1`}
              />
              <span className="text-xs text-slate-500 shrink-0">{data.currency}</span>
            </div>
          )}
        </div>
      </div>

      {/* Revenus */}
      <div className={sectionCls}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-sm font-medium text-slate-200">Revenus mensuels</p>
          <span className="text-xs text-slate-600">(bourse, salaire, etc. — 0 si aucun)</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={data.monthly_income}
            onChange={(e) => onChange({ monthly_income: e.target.value })}
            placeholder="0"
            className={`${inputCls} flex-1`}
          />
          <span className="text-xs text-slate-500 shrink-0">{data.currency}/mois</span>
        </div>
      </div>

      {/* Marge */}
      <div className={sectionCls}>
        <div>
          <p className="text-sm font-medium text-slate-200">Marge budgétaire</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Quelle part du budget mensuel théorique veux-tu utiliser ?
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {MARGINS.map((m) => (
            <button
              key={m.val}
              onClick={() => onChange({ spending_margin: m.val })}
              className={`flex flex-col items-center py-2 rounded-xl border text-xs transition-all ${
                data.spending_margin === m.val
                  ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 text-[var(--color-primary)]'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="font-bold text-sm">{m.label}</span>
              <span className="opacity-70">{m.desc}</span>
            </button>
          ))}
        </div>
        {theoreticalMonthly > 0 && (
          <div className="flex items-center justify-between text-xs mt-1 pt-2 border-t border-slate-700">
            <span className="text-slate-500">Budget mensuel effectif :</span>
            <span className="font-semibold text-white">
              {sym(data.currency)} {effectiveMonthly.toLocaleString('fr-CH')} / mois
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 4 : IA en action ─────────────────────────────────────────────────────

type AiStatus = 'loading' | 'streaming' | 'done' | 'ai_error' | 'ipc_error'

function Step4({
  streamText,
  status,
  budgetId,
  onCreateWithoutAI
}: {
  streamText: string
  status: AiStatus
  budgetId: number | null
  onCreateWithoutAI: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamText])

  const jsonStart = streamText.indexOf('```json')
  const analysisText = jsonStart >= 0 ? streamText.slice(0, jsonStart).trim() : streamText
  const isDone = status === 'done'
  const isAiError = status === 'ai_error'
  const isIpcError = status === 'ipc_error'
  const isError = isAiError || isIpcError

  // Couleurs du header selon l'état
  const headerBg = isDone
    ? 'bg-emerald-500/10 border-emerald-500/30'
    : isError
      ? 'bg-red-500/10 border-red-500/30'
      : 'bg-[var(--color-primary)]/8 border-[var(--color-primary)]/20'
  const iconBg = isDone
    ? 'bg-emerald-500/20'
    : isError
      ? 'bg-red-500/15'
      : 'bg-[var(--color-primary)]/15'
  const headerTitle = isDone
    ? 'Budget configuré avec succès !'
    : isAiError
      ? "L'IA n'a pas répondu"
      : isIpcError
        ? "Erreur de connexion à l'IA"
        : "L'IA configure ton budget…"
  const headerSub = isDone
    ? 'Catégories, limites et récurrents créés'
    : isAiError
      ? 'Le budget a quand même été créé sans configuration IA'
      : isIpcError
        ? "Le budget n'a pas encore été créé"
        : 'Analyse en cours, ça peut prendre 10–30 secondes'

  return (
    <div className="flex flex-col gap-4">
      {/* ── Bandeau de statut ── */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${headerBg}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : isError ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : (
            <Sparkles className="w-5 h-5 text-[var(--color-primary)] animate-pulse" />
          )}
        </div>
        <div>
          <p
            className={`text-sm font-semibold ${isDone ? 'text-emerald-300' : isError ? 'text-red-300' : 'text-slate-200'}`}
          >
            {headerTitle}
          </p>
          <p className="text-xs text-slate-500">{headerSub}</p>
        </div>
      </div>

      {/* ── Texte d'analyse en streaming ── */}
      {analysisText && !isError && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 max-h-60 overflow-auto">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Analyse IA
          </p>
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {analysisText}
            {status === 'streaming' && (
              <span className="inline-block w-1.5 h-3.5 bg-[var(--color-primary)] ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        </div>
      )}

      {/* ── Génération JSON en cours ── */}
      {status === 'streaming' && jsonStart >= 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 rounded-xl border border-slate-700/40">
          <Loader2 className="w-3.5 h-3.5 text-[var(--color-primary)] animate-spin shrink-0" />
          <span className="text-xs text-slate-500">Application de la configuration…</span>
        </div>
      )}

      {/* ── Attente de connexion ── */}
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
          <p className="text-xs text-slate-500">Connexion à l'IA…</p>
        </div>
      )}

      {/* ── Détail erreur IA (budget créé, config manquante) ── */}
      {isAiError && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-400">Causes possibles</p>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>
              • <span className="text-slate-400">Ollama</span> — mémoire insuffisante, essaie un
              modèle plus petit (ex:{' '}
              <code className="text-slate-300 bg-slate-800 px-1 rounded">llama3.2:1b</code>)
            </li>
            <li>
              • <span className="text-slate-400">OpenAI/Anthropic</span> — vérifie ta clé API dans
              Paramètres
            </li>
            <li>• Ollama n'est pas démarré sur ton serveur</li>
          </ul>
          <p className="text-xs text-slate-600 mt-1">
            Ton budget a été créé avec les informations de base. Tu peux configurer manuellement les
            catégories et récurrents dans le détail.
          </p>
        </div>
      )}

      {/* ── Détail erreur IPC (budget non créé) ── */}
      {isIpcError && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            La connexion avec le processus principal a échoué. Tu peux créer le budget sans
            configuration IA.
          </p>
          <button
            onClick={onCreateWithoutAI}
            className="flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-white text-sm font-medium transition-colors"
          >
            <Wallet className="w-4 h-4" /> Créer le budget sans IA
          </button>
        </div>
      )}

      <div ref={bottomRef} />

      {/* ── CTA final ── */}
      {(isDone || isAiError) && budgetId && (
        <button
          onClick={() => navigate(`/budget/${budgetId}`)}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
            isDone
              ? 'bg-[var(--color-primary)] hover:opacity-90'
              : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'
          }`}
        >
          {isDone ? 'Voir mon budget' : 'Ouvrir le budget (config manuelle)'}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ── Wizard principal ──────────────────────────────────────────────────────────

export function BudgetWizard({
  onClose,
  onCreated,
  defaultCurrency = 'CHF'
}: {
  onClose: () => void
  onCreated: (budgetId: number) => void
  defaultCurrency?: string
}): React.JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [data, setData] = useState<WizardData>({
    name: '',
    total_amount: '',
    currency: defaultCurrency,
    display_currency: '',
    start_date: today(),
    end_date: in6m(),
    destination_country: '',
    trip_reason: 'studies',
    lifestyle: 'comfortable',
    accommodation_booked: false,
    accommodation_monthly: '',
    flight_out_paid: false,
    flight_out_amount: '',
    flight_return_paid: false,
    flight_return_amount: '',
    monthly_income: '0',
    spending_margin: 0.8
  })
  const [error, setError] = useState('')
  const [streamText, setStreamText] = useState('')
  const [aiStatus, setAiStatus] = useState<AiStatus>('loading')
  const [budgetId, setBudgetId] = useState<number | null>(null)
  const [launching, setLaunching] = useState(false)
  const gotChunks = useRef(false) // track si l'IA a bien envoyé du contenu

  const onChange = useCallback((patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }))
    setError('')
  }, [])

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!data.name.trim()) {
        setError('Donne un nom à ton budget.')
        return false
      }
      if (!data.total_amount || parseFloat(data.total_amount) <= 0) {
        setError('Le montant total est requis.')
        return false
      }
      if (!data.start_date || !data.end_date) {
        setError('Les dates sont requises.')
        return false
      }
      if (new Date(data.end_date) <= new Date(data.start_date)) {
        setError('La date de fin doit être après la date de début.')
        return false
      }
    }
    if (step === 2) {
      if (!data.destination_country.trim()) {
        setError('Indique ton pays de destination.')
        return false
      }
    }
    return true
  }

  const next = (): void => {
    if (!validateStep()) return
    if (step === 3) {
      void launchWizard()
      return
    }
    setStep((s) => (s + 1) as 1 | 2 | 3 | 4)
  }

  const back = (): void => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)

  const launchWizard = async (): Promise<void> => {
    setLaunching(true)
    setStreamText('')
    setAiStatus('loading')
    setBudgetId(null)
    gotChunks.current = false
    setStep(4)

    const removeChunk = window.api.budget.onWizardChunk((chunk) => {
      gotChunks.current = true
      setAiStatus('streaming')
      setStreamText((prev) => prev + chunk)
    })
    const removeDone = window.api.budget.onWizardDone(({ budgetId: id }) => {
      setBudgetId(id)
      onCreated(id)
    })

    try {
      const result = await window.api.budget.wizardStart({
        name: data.name.trim(),
        total_amount: parseFloat(data.total_amount),
        currency: data.currency,
        display_currency:
          data.display_currency && data.display_currency !== data.currency
            ? data.display_currency
            : null,
        start_date: data.start_date,
        end_date: data.end_date,
        destination_country: data.destination_country.trim(),
        trip_reason: data.trip_reason,
        lifestyle: data.lifestyle,
        accommodation_booked: data.accommodation_booked,
        accommodation_monthly:
          data.accommodation_booked && data.accommodation_monthly
            ? parseFloat(data.accommodation_monthly)
            : null,
        flight_out_paid: data.flight_out_paid,
        flight_out_amount:
          !data.flight_out_paid && data.flight_out_amount
            ? parseFloat(data.flight_out_amount)
            : null,
        flight_return_paid: data.flight_return_paid,
        flight_return_amount:
          !data.flight_return_paid && data.flight_return_amount
            ? parseFloat(data.flight_return_amount)
            : null,
        monthly_income: parseFloat(data.monthly_income) || 0,
        spending_margin: data.spending_margin
      })

      // wizardStart a résolu → budget créé (même si l'IA a échoué)
      if (result?.budgetId) {
        setBudgetId(result.budgetId)
        onCreated(result.budgetId)
      }

      // Si l'IA a envoyé du contenu → 'done', sinon → 'ai_error' (budget créé, sans config)
      setAiStatus(gotChunks.current ? 'done' : 'ai_error')
    } catch (e) {
      // L'IPC a throw → budget probablement non créé
      setAiStatus('ipc_error')
    } finally {
      removeChunk()
      removeDone()
      setLaunching(false)
    }
  }

  // Fallback : créer le budget sans IA (cas ipc_error)
  const createWithoutAI = async (): Promise<void> => {
    setLaunching(true)
    try {
      const budget = await window.api.budget.create({
        name: data.name.trim(),
        total_amount: parseFloat(data.total_amount),
        currency: data.currency,
        display_currency:
          data.display_currency && data.display_currency !== data.currency
            ? data.display_currency
            : null,
        start_date: data.start_date,
        end_date: data.end_date
      })
      setBudgetId(budget.id)
      setAiStatus('ai_error') // budget créé, mais sans config IA
      onCreated(budget.id)
    } catch {
      setError("Impossible de créer le budget. Vérifie l'application et réessaie.")
      setStep(1)
    } finally {
      setLaunching(false)
    }
  }

  const STEP_TITLES: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'Ton budget', subtitle: 'Définis les bases de ton budget' },
    2: { title: 'La destination', subtitle: 'Où vas-tu et quel style de voyage ?' },
    3: { title: 'Les détails', subtitle: 'Quelques infos pour mieux te configurer' },
    4: { title: 'Configuration IA', subtitle: "L'IA analyse et configure ton budget" }
  }

  const { title, subtitle } = STEP_TITLES[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Progress ── */}
        <div className="px-6 pb-4 shrink-0">
          <StepDots current={step} total={4} />
        </div>

        {/* ── Contenu ── */}
        <div className="flex-1 overflow-auto px-6 pb-2">
          {step === 1 && <Step1 data={data} onChange={onChange} />}
          {step === 2 && <Step2 data={data} onChange={onChange} />}
          {step === 3 && <Step3 data={data} onChange={onChange} />}
          {step === 4 && (
            <Step4
              streamText={streamText}
              status={aiStatus}
              budgetId={budgetId}
              onCreateWithoutAI={() => void createWithoutAI()}
            />
          )}
        </div>

        {/* ── Erreur ── */}
        {error && (
          <div className="mx-6 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 shrink-0">
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        {step < 4 && (
          <div className="flex gap-2 px-6 py-4 border-t border-slate-800 shrink-0">
            {step > 1 ? (
              <button
                onClick={back}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Retour
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Annuler
              </button>
            )}
            <button
              onClick={next}
              disabled={launching}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 rounded-xl text-white text-sm font-semibold transition-all"
            >
              {step === 3 ? (
                launching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Lancement…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Configurer avec l'IA
                  </>
                )
              ) : (
                <>
                  Suivant <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
