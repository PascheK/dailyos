import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, TrendingDown, Calendar, ChevronRight,
  Loader2, Trash2, Sparkles
} from 'lucide-react'
import type { AppBudget } from '../types/budget'
import { BudgetWizard } from './BudgetWizard'

// ── Devises disponibles ───────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'CHF', label: 'CHF — Franc suisse', symbol: 'CHF' },
  { code: 'EUR', label: 'EUR — Euro',          symbol: '€' },
  { code: 'USD', label: 'USD — Dollar US',     symbol: '$' },
  { code: 'JPY', label: 'JPY — Yen japonais',  symbol: '¥' },
  { code: 'GBP', label: 'GBP — Livre sterling', symbol: '£' },
  { code: 'CAD', label: 'CAD — Dollar canadien', symbol: 'CA$' },
  { code: 'AUD', label: 'AUD — Dollar australien', symbol: 'AU$' },
  { code: 'KRW', label: 'KRW — Won coréen',    symbol: '₩' },
  { code: 'CNY', label: 'CNY — Yuan chinois',  symbol: '¥' },
  { code: 'THB', label: 'THB — Baht thaïlandais', symbol: '฿' },
]

function currencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string): string {
  return `${currencySymbol(currency)} ${amount.toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function pct(spent: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((spent / total) * 100))
}

function dateLabel(start: string, end: string): string {
  const s = new Date(start), e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${s.toLocaleDateString('fr-FR', opts)} → ${e.toLocaleDateString('fr-FR', opts)}`
}

function daysRemaining(end: string): number {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000))
}

// ── Carte budget ──────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  onDelete,
  onClick
}: {
  budget: AppBudget
  onDelete: (id: number) => void
  onClick: () => void
}): React.JSX.Element {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!confirm(`Supprimer le budget "${budget.name}" et toutes ses données ?`)) return
    setDeleting(true)
    await window.api.budget.delete(budget.id)
    onDelete(budget.id)
  }

  // Calcul visuel simple basé sur les dates (le vrai % vient du summary)
  const totalDays = Math.max(1, (new Date(budget.end_date).getTime() - new Date(budget.start_date).getTime()) / 86400000)
  const elapsedDays = Math.max(0, (Date.now() - new Date(budget.start_date).getTime()) / 86400000)
  const timePct = Math.min(100, Math.round((elapsedDays / totalDays) * 100))
  const days = daysRemaining(budget.end_date)

  return (
    <div
      onClick={onClick}
      className="bg-slate-900 border border-slate-700/60 hover:border-[var(--color-primary)]/40 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-[var(--color-primary)]/5 group flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)]/15 flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            </div>
            <h3 className="text-sm font-semibold text-white truncate">{budget.name}</h3>
          </div>
          <p className="text-xs text-slate-500 ml-9">{dateLabel(budget.start_date, budget.end_date)}</p>
        </div>
        <button
          onClick={e => void handleDelete(e)}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Montant */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-white">
            {fmt(budget.total_amount, budget.currency)}
          </p>
          {budget.display_currency && budget.display_rate && (
            <p className="text-xs text-slate-500 mt-0.5">
              ≈ {fmt(budget.total_amount * budget.display_rate, budget.display_currency)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
          <Calendar className="w-3 h-3" />
          {days > 0 ? `${days} j restants` : 'Terminé'}
        </div>
      </div>

      {/* Barre de progression temporelle */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] text-slate-600">
          <span>Avancement temporel</span>
          <span>{timePct}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-primary)]/60 transition-all"
            style={{ width: `${timePct}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-600 group-hover:text-slate-400 transition-colors">
        <div className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          <span>{budget.currency}{budget.display_currency ? ` · ${budget.display_currency}` : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          Voir le détail <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  )
}

// ── Page Budget (liste) ───────────────────────────────────────────────────────

export function Budget(): React.JSX.Element {
  const navigate    = useNavigate()
  const [budgets,    setBudgets]    = useState<AppBudget[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [defaultCur, setDefaultCur] = useState('CHF')

  useEffect(() => {
    Promise.all([
      window.api.budget.list(),
      window.api.settings.get()
    ]).then(([list, settings]) => {
      setBudgets(list)
      setDefaultCur(settings.budget?.defaultCurrency ?? 'CHF')
      setLoading(false)
    })
  }, [])

  const handleDelete = (id: number): void => {
    setBudgets(prev => prev.filter(b => b.id !== id))
  }

  // Quand le wizard crée un budget, on navigue direct vers son détail
  const handleCreated = (budgetId: number): void => {
    // Rafraîchir la liste en arrière-plan (si l'user revient)
    window.api.budget.list().then(setBudgets)
    navigate(`/budget/${budgetId}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Budgets</h1>
            <p className="text-xs text-slate-500">{budgets.length} budget{budgets.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-xl text-white text-sm font-semibold transition-all"
        >
          <Sparkles className="w-4 h-4" /> Nouveau budget
        </button>
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-600">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
              <Wallet className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">Aucun budget</p>
              <p className="text-xs text-slate-600 mt-1">L'IA te configure un budget complet en quelques secondes.</p>
            </div>
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all"
            >
              <Sparkles className="w-4 h-4" /> Créer mon budget avec l'IA
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {budgets.map(b => (
              <BudgetCard
                key={b.id}
                budget={b}
                onDelete={handleDelete}
                onClick={() => navigate(`/budget/${b.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Wizard IA ── */}
      {showWizard && (
        <BudgetWizard
          onClose={() => setShowWizard(false)}
          onCreated={handleCreated}
          defaultCurrency={defaultCur}
        />
      )}
    </div>
  )
}
