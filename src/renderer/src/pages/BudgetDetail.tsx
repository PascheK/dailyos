import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Tag,
  Repeat,
  List,
  Target,
  X,
  Pencil,
  PiggyBank,
  Check,
  ChevronDown,
} from 'lucide-react'
import type {
  BudgetSummary,
  BudgetTransaction,
  BudgetCategory,
  BudgetRecurring,
  BudgetExtraItem,
  BudgetCheckup,
  BudgetCheckupDetail,
  BudgetMonthlyData,
  BudgetEnvelopeItem,
  NewTransactionPayload,
  NewExtraPayload,
  NewRecurringPayload,
  CategorySpending
} from '../types/budget'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'CHF', symbol: 'CHF' },
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'JPY', symbol: '¥' },
  { code: 'GBP', symbol: '£' },
  { code: 'KRW', symbol: '₩' },
  { code: 'CNY', symbol: '¥' },
  { code: 'THB', symbol: '฿' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'AU$' }
]

function sym(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

function fmt(amount: number, currency: string, digits = 0): string {
  return `${sym(currency)} ${amount.toLocaleString('fr-CH', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function pct(a: number, b: number): number {
  return b <= 0 ? 0 : Math.min(100, Math.round((a / b) * 100))
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Tab: Vue d'ensemble ───────────────────────────────────────────────────────

function CategoryRow({
  cat,
  cur,
  budgetId,
  onLimitUpdated
}: {
  cat: CategorySpending
  cur: string
  budgetId: number
  onLimitUpdated: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [limitInput, setLimitInput] = useState(String(cat.monthly_limit ?? ''))
  const [saving, setSaving] = useState(false)

  const pctVal = cat.monthly_limit ? pct(cat.spent, cat.monthly_limit) : null
  const isOver = cat.monthly_limit != null && cat.spent >= cat.monthly_limit
  const isWarn = cat.monthly_limit != null && cat.spent >= cat.monthly_limit * 0.8 && !isOver

  const handleSave = async (): Promise<void> => {
    const val = parseFloat(limitInput)
    if (isNaN(val) || val <= 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    await window.api.budget.setCategoryLimit({
      budget_id: budgetId,
      category_id: cat.category_id!,
      monthly_limit: val
    })
    setSaving(false)
    setEditing(false)
    onLimitUpdated()
  }

  const handleRemoveLimit = async (): Promise<void> => {
    if (!cat.monthly_limit) return
    await window.api.budget.deleteCategoryLimit({
      budget_id: budgetId,
      category_id: cat.category_id!
    })
    onLimitUpdated()
  }

  const barColor = isOver ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-[var(--color-primary)]'

  return (
    <div className="flex flex-col gap-1.5 py-2.5 border-b border-slate-800 last:border-0">
      <div className="flex items-center gap-2">
        {/* Icône catégorie */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
          style={{ background: `${cat.category_color}22` }}
        >
          {cat.category_icon}
        </div>

        {/* Nom */}
        <span className="flex-1 text-sm font-medium text-slate-200 min-w-0 truncate">
          {cat.category_name}
        </span>

        {/* Montants + édition limite */}
        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <input
                type="number"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSave()
                  if (e.key === 'Escape') setEditing(false)
                }}
                autoFocus
                className="w-20 bg-slate-900 border border-[var(--color-primary)]/50 rounded-lg px-2 py-0.5 text-xs text-white text-right focus:outline-none"
                placeholder="Limite"
              />
              <span className="text-xs text-slate-600">{cur}</span>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1 rounded-lg text-slate-600 hover:text-slate-300 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              <span
                className={`text-sm font-semibold ${isOver ? 'text-red-400' : 'text-slate-200'}`}
              >
                {fmt(cat.spent, cur)}
              </span>
              {cat.monthly_limit != null && (
                <>
                  <span className="text-xs text-slate-600">/</span>
                  <span className="text-xs text-slate-500">{fmt(cat.monthly_limit, cur)}</span>
                  <button
                    onClick={() => void handleRemoveLimit()}
                    className="p-0.5 rounded text-slate-700 hover:text-red-400 transition-colors ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setLimitInput(String(cat.monthly_limit ?? ''))
                  setEditing(true)
                }}
                className="p-1 rounded-lg text-slate-700 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                title={cat.monthly_limit ? 'Modifier la limite' : 'Définir une limite'}
              >
                <Pencil className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barre de progression (uniquement si limite définie) */}
      {cat.monthly_limit != null && pctVal !== null && (
        <div className="ml-9 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pctVal}%` }}
            />
          </div>
          <span
            className={`text-[10px] font-medium w-7 text-right ${
              isOver ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-slate-600'
            }`}
          >
            {pctVal}%
          </span>
        </div>
      )}
    </div>
  )
}

// ── Section repliable ────────────────────────────────────────────────────────

function Collapsible({
  title,
  icon,
  badge,
  defaultOpen = true,
  children
}: {
  title: string
  icon: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-slate-200">{title}</span>
          {badge}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ── Vue d'ensemble — helpers période ─────────────────────────────────────────

type PeriodKey = 'total' | 'mois' | 'semaine' | 'jour'

const PERIOD_LABELS: Record<PeriodKey, string> = {
  total: 'Total', mois: 'Mois', semaine: 'Semaine', jour: 'Jour'
}

function divByPeriod(key: PeriodKey, months: number): number {
  if (key === 'total')   return 1
  if (key === 'mois')    return months
  if (key === 'semaine') return months * 4.333
  return months * 30.44
}

/** Montant d'un extra (one-shot) ramené à la période choisie */
function extraForPeriod(amount: number, key: PeriodKey, months: number): number {
  return amount / divByPeriod(key, months)
}

/** Montant d'un récurrent (mensuel) ramené à la période choisie */
function recurringForPeriod(monthly: number, key: PeriodKey, months: number): number {
  if (key === 'total')   return monthly * months
  if (key === 'mois')    return monthly
  if (key === 'semaine') return monthly / 4.333
  return monthly / 30.44
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  label, amount, currency, dispAmount, dispCurrency, highlight = false, negative = false
}: {
  label: string; amount: number; currency: string
  dispAmount?: number | null; dispCurrency?: string | null
  highlight?: boolean; negative?: boolean
}): React.JSX.Element {
  const textColor = negative
    ? 'text-red-400'
    : highlight
      ? 'text-[var(--color-primary)]'
      : 'text-white'

  return (
    <div className={`flex flex-col gap-1.5 p-4 rounded-xl border ${
      highlight
        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30'
        : 'bg-slate-800/60 border-slate-700/40'
    }`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`text-lg font-bold leading-tight ${textColor}`}>{fmt(amount, currency)}</p>
      {dispAmount != null && dispCurrency && (
        <p className="text-[10px] text-slate-600">~{fmt(dispAmount, dispCurrency)}</p>
      )}
    </div>
  )
}

// ── ExpenseRow / ExpenseSection ───────────────────────────────────────────────

function ExpenseRow({
  icon, label, subtitle, amount, currency, dispAmount, dispCurrency
}: {
  icon: string; label: string; subtitle?: string
  amount: number; currency: string
  dispAmount?: number | null; dispCurrency?: string | null
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800/70 last:border-0">
      <span className="text-base w-6 text-center shrink-0 select-none">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{label}</p>
        {subtitle && <p className="text-[11px] text-slate-600 truncate mt-0.5">{subtitle}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-slate-200">{fmt(amount, currency)}</p>
        {dispAmount != null && dispCurrency && (
          <p className="text-[10px] text-slate-600">{fmt(dispAmount, dispCurrency)}</p>
        )}
      </div>
    </div>
  )
}

function ExpenseSection({
  title, total, currency, dispCurrency, rate, children
}: {
  title: string; total: number; currency: string
  dispCurrency?: string | null; rate?: number | null
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      </div>
      <div className="px-4">{children}</div>
      <div className="px-4 py-2.5 border-t border-slate-700/40 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Total</span>
        <div className="text-right">
          <p className="text-sm font-bold text-red-400">{fmt(total, currency)}</p>
          {dispCurrency && rate && (
            <p className="text-[10px] text-slate-600">{fmt(total * rate, dispCurrency)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CheckupModal ──────────────────────────────────────────────────────────────

function CheckupModal({
  checkup,
  budgetId,
  budgetLibreMonthly,
  currency,
  onAcknowledge
}: {
  checkup: BudgetCheckup
  budgetId: number
  budgetLibreMonthly: number
  currency: string
  onAcknowledge: () => void
}): React.JSX.Element {
  const [detail, setDetail] = useState<BudgetCheckupDetail | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)

  useEffect(() => {
    window.api.budget.checkupDetail(budgetId, checkup.month).then((d) => {
      if (d) setDetail(d)
    })
  }, [budgetId, checkup.month])

  const handleAcknowledge = async (): Promise<void> => {
    setAcknowledging(true)
    await window.api.budget.acknowledgeCheckup(checkup.id)
    onAcknowledge()
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-sm max-h-[85vh] overflow-auto flex flex-col gap-0 shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/50">
          <p className="text-base font-bold text-white">
            🗓️ Bilan de {detail?.month_label ?? checkup.month}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Bilan mensuel de ton budget</p>
        </div>

        {detail == null ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Revenus / Dépenses */}
            <div className="px-5 py-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Revenus reçus</span>
                <span className="text-sm font-semibold text-emerald-400">
                  +{fmt(detail.revenue_received, currency, 2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Dépenses payées</span>
                <span className="text-sm font-semibold text-red-400">
                  -{fmt(detail.expenses_paid, currency, 2)}
                </span>
              </div>
            </div>

            {/* Enveloppes */}
            {detail.envelope_details.length > 0 && (
              <div className="px-5 pb-4 flex flex-col gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">
                  Enveloppes
                </p>
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-4 px-3 py-1.5 border-b border-slate-700/40">
                    <span className="col-span-2 text-[10px] text-slate-600 font-medium">Catégorie</span>
                    <span className="text-[10px] text-slate-600 font-medium text-right">Budget</span>
                    <span className="text-[10px] text-slate-600 font-medium text-right">Report</span>
                  </div>
                  {detail.envelope_details.map((env, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-4 px-3 py-2 border-b border-slate-800/70 last:border-0 items-center"
                    >
                      <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                        <span className="text-sm">{env.category_icon}</span>
                        <span className="text-xs text-slate-300 truncate">{env.category_name}</span>
                      </div>
                      <span className="text-xs text-slate-400 text-right">{fmt(env.budget, currency)}</span>
                      <span className={`text-xs font-semibold text-right ${env.rollover >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {env.rollover >= 0 ? '+' : ''}{fmt(env.rollover, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total rollover */}
            <div className="px-5 pb-3 flex items-center justify-between bg-emerald-500/5 border-t border-slate-700/40 py-3">
              <span className="text-sm font-semibold text-slate-300">Total report</span>
              <span className={`text-sm font-bold ${detail.total_rollover >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {detail.total_rollover >= 0 ? '+' : ''}{fmt(detail.total_rollover, currency, 2)}
              </span>
            </div>

            {/* Budget libre accumulé */}
            <div className="px-5 py-3 border-t border-slate-700/40 flex flex-col gap-0.5">
              <p className="text-xs text-slate-500">Budget libre accumulé ce mois</p>
              <p className="text-lg font-bold text-emerald-400">
                {fmt(budgetLibreMonthly + detail.total_rollover, currency, 2)}
              </p>
              <p className="text-[11px] text-slate-600">
                dont {fmt(budgetLibreMonthly, currency, 2)} / mois
              </p>
            </div>

            {/* Bouton */}
            <div className="px-5 pb-5 pt-2">
              <button
                onClick={() => void handleAcknowledge()}
                disabled={acknowledging}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:opacity-90 disabled:opacity-50 rounded-xl text-white text-sm font-semibold transition-all"
              >
                {acknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                J'ai compris 👍
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

// ── MonthlyGraph ──────────────────────────────────────────────────────────────

function MonthlyGraph({
  budgetId,
  currency
}: {
  budgetId: number
  currency: string
}): React.JSX.Element {
  const [data,    setData]    = useState<BudgetMonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    window.api.budget.monthlyData(budgetId).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [budgetId])

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
      </div>
    )
  }
  if (data.length === 0) {
    return <p className="text-xs text-slate-600 py-3 text-center">Aucune donnée</p>
  }

  const BAR_W = 24
  const GAP   = 4
  const GROUP = BAR_W * 2 + GAP + 14
  const H     = 100
  const PAD_B = 22
  const PAD_L = 34
  const PAD_T = 32   // space for tooltip above bars

  const maxVal = Math.max(...data.map((d) => Math.max(d.planned, d.actual)), 1)
  const svgW   = PAD_L + data.length * GROUP + 8
  const svgH   = PAD_T + H + PAD_B

  const barH = (v: number): number => Math.max(2, (v / maxVal) * H)

  // Y axis: 3 levels
  const ticks = [0, 0.5, 1].map((f) => Math.round(maxVal * f))

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} className="select-none block" style={{ minWidth: svgW }}>
        {/* Grid lines + Y labels */}
        {ticks.map((tick, i) => {
          const y = PAD_T + H - (tick / maxVal) * H
          return (
            <g key={i}>
              <line
                x1={PAD_L - 3} y1={y} x2={svgW - 4} y2={y}
                stroke="#1e293b" strokeWidth={1} strokeDasharray={i === 0 ? '0' : '3 3'}
              />
              <text x={PAD_L - 5} y={y + 3.5} textAnchor="end" fontSize={7.5} fill="#334155">
                {tick >= 1000 ? `${(tick / 1000).toFixed(tick >= 10000 ? 0 : 1)}k` : tick}
              </text>
            </g>
          )
        })}

        {/* Bars per month */}
        {data.map((d, i) => {
          const x      = PAD_L + i * GROUP
          const isOver = !d.is_future && d.actual > d.planned && d.planned > 0
          const isHov  = hovered === i

          const pH = barH(d.planned)
          const aH = barH(d.actual)
          const pY = PAD_T + H - pH
          const aY = PAD_T + H - aH

          // Tooltip: show above the tallest bar
          const tipY   = Math.min(pY, aY) - 36
          const tipX   = x + (BAR_W * 2 + GAP) / 2
          const tipVis = isHov && tipY > 0

          return (
            <g
              key={d.month}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Planned bar */}
              <rect
                x={x} y={pY} width={BAR_W} height={pH} rx={3}
                fill={d.is_future ? '#1e293b' : '#4f5fa8'}
                opacity={d.is_future ? 0.5 : isHov ? 1 : 0.85}
              />
              {/* Actual bar (only non-future) */}
              {!d.is_future && (
                <rect
                  x={x + BAR_W + GAP} y={aY} width={BAR_W} height={aH} rx={3}
                  fill={isOver ? '#ef4444' : '#22c55e'}
                  opacity={isHov ? 1 : 0.85}
                />
              )}
              {/* Month label */}
              <text
                x={x + BAR_W + GAP / 2}
                y={PAD_T + H + 13}
                textAnchor="middle"
                fontSize={8.5}
                fill={d.is_future ? '#1e293b' : '#475569'}
              >
                {d.month_label}
              </text>

              {/* Hover tooltip */}
              {tipVis && (
                <g>
                  <rect
                    x={tipX - 28} y={tipY - 2}
                    width={56} height={d.is_future ? 20 : 34}
                    rx={4} fill="#0f172a" stroke="#334155" strokeWidth={0.5}
                  />
                  <text x={tipX} y={tipY + 9} textAnchor="middle" fontSize={7.5} fill="#94a3b8" fontWeight="600">
                    {d.month_label}
                  </text>
                  <text x={tipX} y={tipY + 19} textAnchor="middle" fontSize={7.5} fill="#6366f1">
                    {`P: ${Math.round(d.planned)} ${currency}`}
                  </text>
                  {!d.is_future && (
                    <text x={tipX} y={tipY + 29} textAnchor="middle" fontSize={7.5} fill={isOver ? '#f87171' : '#4ade80'}>
                      {`R: ${Math.round(d.actual)} ${currency}`}
                    </text>
                  )}
                </g>
              )}
            </g>
          )
        })}

        {/* Legend */}
        <g transform={`translate(${PAD_L}, ${svgH - 6})`}>
          <rect x={0} y={-6} width={8} height={8} rx={2} fill="#4f5fa8" />
          <text x={11} y={1} fontSize={8} fill="#475569">Planifié</text>
          <rect x={52} y={-6} width={8} height={8} rx={2} fill="#22c55e" />
          <text x={63} y={1} fontSize={8} fill="#475569">Réel</text>
          <rect x={90} y={-6} width={8} height={8} rx={2} fill="#ef4444" />
          <text x={101} y={1} fontSize={8} fill="#475569">Dépassé</text>
        </g>
      </svg>
    </div>
  )
}

// ── OverviewTab ───────────────────────────────────────────────────────────────

function OverviewTab({
  summary,
  budgetId,
  onRefresh
}: {
  summary: BudgetSummary
  budgetId: number
  onRefresh: () => Promise<void>
}): React.JSX.Element {
  const {
    budget, goal,
    extra_items,
    planned_total, marge_libre,
    expense_recurring_items, revenue_items, envelope_items,
    total_budget_available,
    budget_libre_monthly, cumulative_budget_libre,
    months_count,
    current_period_spent, current_period_revenue,
    savings_goal: initialSavingsGoal,
  } = summary

  const cur     = budget.currency
  const dispCur = budget.display_currency
  const rate    = budget.display_rate

  const [period,       setPeriod]       = useState<PeriodKey>('total')
  const [savingsGoal,  setSavingsGoal]  = useState(initialSavingsGoal)
  const [updatingGoal, setUpdatingGoal] = useState(false)
  const [catSpending,  setCatSpending]  = useState<CategorySpending[]>([])

  const loadCatSpending = useCallback(async () => {
    const result = await window.api.budget.categorySpending(budgetId)
    setCatSpending(result.categories)
  }, [budgetId])

  useEffect(() => { void loadCatSpending() }, [loadCatSpending])

  // Mise à jour de l'objectif de réserve (sauvegardée en base)
  const handleSavingsGoal = async (pct: number): Promise<void> => {
    setSavingsGoal(pct)
    setUpdatingGoal(true)
    await window.api.budget.update({ id: budgetId, savings_goal: pct })
    setUpdatingGoal(false)
    await onRefresh()
  }

  // Valeurs KPI ramenées à la période
  const div              = divByPeriod(period, months_count)
  const budgetAmt        = total_budget_available / div
  const plannedAmt       = planned_total / div
  const margeAmt         = marge_libre / div
  const libreAmt         = margeAmt * (1 - savingsGoal / 100)
  const reserveAmt       = margeAmt * savingsGoal / 100

  // Totaux des tableaux pour la période
  const extraTotal     = extra_items.reduce(
    (a, e) => a + extraForPeriod(e.amount, period, months_count), 0
  )
  const expenseRecurringTotal = expense_recurring_items.reduce(
    (a, r) => a + recurringForPeriod(r.amount_base_monthly, period, months_count), 0
  )
  const revenueRecurringTotal = revenue_items.reduce(
    (a, r) => a + recurringForPeriod(r.amount_base_monthly, period, months_count), 0
  )
  const envelopeTotal = envelope_items.reduce(
    (a, e) => a + recurringForPeriod(e.monthly_limit, period, months_count), 0
  )

  // Alertes dépassement mois courant
  const periodNet    = current_period_spent - current_period_revenue
  const overTarget   = goal && periodNet >= goal.monthly_target
  const overCritical = goal && !overTarget && periodNet >= goal.critical_threshold

  // Titre du header avec la durée complète du budget
  const fmtDate = (d: string): string =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const SAVINGS_OPTS = [0, 5, 10, 15, 20, 25, 30]

  return (
    <div className="flex flex-col gap-4">

      {/* ── Alerte dépassement mois courant ── */}
      {(overTarget || overCritical) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          overTarget
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm">
            {overTarget
              ? `Objectif mensuel dépassé (${fmt(goal!.monthly_target, cur)}).`
              : `Tu approches du seuil critique (${fmt(goal!.critical_threshold, cur)}).`}
          </p>
        </div>
      )}

      {/* ── Header période ── */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
        Vue d'ensemble — {months_count} mois &nbsp;({fmtDate(budget.start_date)} → {fmtDate(budget.end_date)})
      </p>

      {/* ── Sélecteur de période ── */}
      <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1">
        {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              period === p
                ? 'bg-[var(--color-primary)] text-white shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* ── 4 KPI cards ── */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard
          label="Budget disponible"
          amount={budgetAmt}
          currency={cur}
          dispAmount={rate ? budgetAmt * rate : null}
          dispCurrency={dispCur}
        />
        <KpiCard
          label="Montant à dépenser"
          amount={plannedAmt}
          currency={cur}
          dispAmount={rate ? plannedAmt * rate : null}
          dispCurrency={dispCur}
          negative={plannedAmt > budgetAmt}
        />
        <KpiCard
          label="Marge libre"
          amount={margeAmt}
          currency={cur}
          dispAmount={rate ? margeAmt * rate : null}
          dispCurrency={dispCur}
          negative={margeAmt < 0}
        />
        <KpiCard
          label="Budget libre"
          amount={libreAmt}
          currency={cur}
          dispAmount={rate ? libreAmt * rate : null}
          dispCurrency={dispCur}
          highlight
          negative={libreAmt < 0}
        />
      </div>

      {/* ── Cagnotte budget libre ── */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
        <PiggyBank className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">Cagnotte budget libre</p>
          <p className="text-lg font-bold text-emerald-400">{fmt(cumulative_budget_libre, cur, 2)}</p>
          <p className="text-[11px] text-slate-500">dont {fmt(budget_libre_monthly, cur, 2)} / mois</p>
        </div>
      </div>

      {/* ── Graphique évolution mensuelle ── */}
      <Collapsible
        title="Évolution mensuelle"
        icon={<TrendingDown className="w-4 h-4 text-[var(--color-primary)]" />}
        defaultOpen={months_count <= 6}
      >
        <div className="pt-2">
          <MonthlyGraph budgetId={budgetId} currency={cur} />
        </div>
      </Collapsible>

      {/* ── Objectif de réserve ── */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-semibold text-slate-300">Objectif de réserve</p>
            {updatingGoal && <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />}
          </div>
          {savingsGoal > 0 && (
            <p className="text-xs text-slate-500">
              Réserve :{' '}
              <span className="text-emerald-400 font-semibold">{fmt(reserveAmt, cur)}</span>
            </p>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {SAVINGS_OPTS.map((opt) => (
            <button
              key={opt}
              onClick={() => void handleSavingsGoal(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                savingsGoal === opt
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900/60 border-slate-700/40 text-slate-500 hover:text-slate-300'
              }`}
            >
              {opt}%
            </button>
          ))}
        </div>
      </div>

      {/* ── Dépenses fixes (uniques) ── */}
      {extra_items.length > 0 && (
        <ExpenseSection
          title="Dépenses fixes (uniques)"
          total={extraTotal}
          currency={cur}
          dispCurrency={dispCur}
          rate={rate}
        >
          {extra_items.map((e) => (
            <ExpenseRow
              key={e.id}
              icon="📦"
              label={e.label}
              subtitle={e.planned_date ?? undefined}
              amount={extraForPeriod(e.amount, period, months_count)}
              currency={cur}
              dispAmount={rate ? extraForPeriod(e.amount, period, months_count) * rate : null}
              dispCurrency={dispCur}
            />
          ))}
        </ExpenseSection>
      )}

      {/* ── Abonnements (dépenses récurrentes) ── */}
      {expense_recurring_items.length > 0 && (
        <ExpenseSection
          title={`Abonnements${period === 'total' ? ` (× ${months_count} mois)` : ''}`}
          total={expenseRecurringTotal}
          currency={cur}
          dispCurrency={dispCur}
          rate={rate}
        >
          {expense_recurring_items.map((r) => (
            <ExpenseRow
              key={r.id}
              icon={r.category_icon ?? '💳'}
              label={r.label}
              subtitle={r.currency !== cur ? `${fmt(r.amount, r.currency)}/mois` : undefined}
              amount={recurringForPeriod(r.amount_base_monthly, period, months_count)}
              currency={cur}
              dispAmount={rate ? recurringForPeriod(r.amount_base_monthly, period, months_count) * rate : null}
              dispCurrency={dispCur}
            />
          ))}
        </ExpenseSection>
      )}

      {/* ── Sources de revenus ── */}
      {revenue_items.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Sources de revenus{period === 'total' ? ` (× ${months_count} mois)` : ''}
            </p>
          </div>
          <div className="px-4">
            {revenue_items.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-slate-800/70 last:border-0">
                <span className="text-base w-6 text-center shrink-0 select-none">💰</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{r.label}</p>
                  {r.currency !== cur && (
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">{fmt(r.amount, r.currency)}/mois</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-400">
                    +{fmt(recurringForPeriod(r.amount_base_monthly, period, months_count), cur)}
                  </p>
                  {rate && (
                    <p className="text-[10px] text-slate-600">
                      {fmt(recurringForPeriod(r.amount_base_monthly, period, months_count) * rate, dispCur!)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-700/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total</span>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-400">+{fmt(revenueRecurringTotal, cur)}</p>
              {dispCur && rate && (
                <p className="text-[10px] text-slate-600">{fmt(revenueRecurringTotal * rate, dispCur)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Enveloppes mensuelles ── */}
      {envelope_items.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-700/40">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Enveloppes mensuelles{period === 'total' ? ` (× ${months_count} mois)` : ''}
            </p>
          </div>
          <div className="px-4">
            {envelope_items.map((e) => {
              const plannedAmt = recurringForPeriod(e.monthly_limit, period, months_count)
              const spentPct = e.monthly_limit > 0 ? pct(e.current_month_spent, e.monthly_limit) : 0
              const isOver = e.current_month_spent >= e.monthly_limit
              return (
                <div key={e.id} className="flex flex-col gap-1.5 py-2.5 border-b border-slate-800/70 last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{ background: `${e.category_color}22` }}
                    >
                      {e.category_icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{e.category_name}</p>
                      {e.current_month_spent > 0 && (
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Dépensé ce mois : {fmt(e.current_month_spent, cur, 2)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-primary)] shrink-0">
                      {fmt(plannedAmt, cur)}
                    </p>
                  </div>
                  {e.current_month_spent > 0 && (
                    <div className="ml-9 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-[var(--color-primary)]'}`}
                          style={{ width: `${spentPct}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-medium w-7 text-right ${isOver ? 'text-red-400' : 'text-slate-600'}`}>
                        {spentPct}%
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-700/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total</span>
            <div className="text-right">
              <p className="text-sm font-bold text-[var(--color-primary)]">{fmt(envelopeTotal, cur)}</p>
              {dispCur && rate && (
                <p className="text-[10px] text-slate-600">{fmt(envelopeTotal * rate, dispCur)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Par catégorie (mois courant) ── */}
      <Collapsible
        title="Par catégorie"
        icon={<Tag className="w-4 h-4 text-[var(--color-primary)]" />}
        badge={
          catSpending.length > 0
            ? <span className="text-[10px] text-slate-500 ml-1">Clique ✏️ pour fixer un budget</span>
            : undefined
        }
        defaultOpen={true}
      >
        {catSpending.length === 0 ? (
          <p className="text-xs text-slate-600 py-3 text-center">Aucune dépense ce mois</p>
        ) : (
          <div className="flex flex-col mt-1">
            {catSpending.map((cat) => (
              <CategoryRow
                key={cat.category_id ?? 'uncategorized'}
                cat={cat}
                cur={cur}
                budgetId={budgetId}
                onLimitUpdated={() => void loadCatSpending()}
              />
            ))}
          </div>
        )}
      </Collapsible>

    </div>
  )
}

// ── Formulaire ajout transaction ──────────────────────────────────────────────

function AddTransactionForm({
  budgetId,
  budgetCurrency,
  budgetStartDate,
  budgetEndDate,
  categories,
  onAdded
}: {
  budgetId: number
  budgetCurrency: string
  budgetStartDate: string
  budgetEndDate: string
  categories: BudgetCategory[]
  onAdded: (tx: BudgetTransaction) => void
}): React.JSX.Element {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(budgetCurrency)
  const [catId, setCatId] = useState<number | null>(null)
  const [date, setDate] = useState(todayStr())
  const [isRevenue, setIsRevenue] = useState(false)
  const [saving, setSaving] = useState(false)

  // Détection hors-période (dépenses uniquement)
  const isOutsidePeriod = !isRevenue && (date < budgetStartDate || date > budgetEndDate)

  const handleAdd = async (): Promise<void> => {
    if (!label.trim() || !amount) return
    setSaving(true)
    try {
      const payload: NewTransactionPayload = {
        budget_id: budgetId,
        // Si hors-période, le backend va auto-assigner "Préparatifs" — on passe null
        category_id: isOutsidePeriod ? null : catId,
        label: label.trim(),
        amount: parseFloat(amount),
        currency,
        date,
        is_revenue: isRevenue
      }
      const tx = await window.api.budget.addTransaction(payload)
      onAdded(tx)
      setLabel('')
      setAmount('')
      setCatId(null)
      setDate(todayStr())
      setIsRevenue(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Nouvelle transaction
      </p>

      {/* Type */}
      <div className="flex gap-2">
        {[
          { v: false, label: 'Dépense', icon: TrendingDown },
          { v: true, label: 'Revenu', icon: TrendingUp }
        ].map((opt) => (
          <button
            key={String(opt.v)}
            onClick={() => setIsRevenue(opt.v)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm border transition-all ${
              isRevenue === opt.v
                ? opt.v
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-red-500/15 border-red-500/40 text-red-400'
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
          >
            <opt.icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Label */}
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Description (ex: Loyer, Resto, Salaire…)"
        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
      />

      {/* Montant + devise + date */}
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Montant"
          className="col-span-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-sm text-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      </div>

      {/* Badge hors-période */}
      {isOutsidePeriod && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
          <p className="text-xs text-indigo-300">
            Date hors période du budget → catégorisé automatiquement en{' '}
            <span className="font-semibold">Préparatifs</span>
          </p>
        </div>
      )}

      {/* Catégorie (désactivée hors-période) */}
      <select
        value={isOutsidePeriod ? '' : (catId ?? '')}
        onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : null)}
        disabled={isOutsidePeriod}
        className={`bg-slate-900 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors ${
          isOutsidePeriod
            ? 'border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
            : 'border-slate-700 text-slate-200 cursor-pointer'
        }`}
      >
        <option value="">{isOutsidePeriod ? 'Préparatifs (auto)' : 'Sans catégorie'}</option>
        {!isOutsidePeriod && categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </select>

      <button
        onClick={() => void handleAdd()}
        disabled={saving || !label.trim() || !amount}
        className="flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-xl text-white text-sm font-medium transition-all"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {saving ? 'Ajout…' : 'Ajouter'}
      </button>
    </div>
  )
}

// ── Tab: Transactions ─────────────────────────────────────────────────────────

function TransactionsTab({
  budgetId,
  budgetCurrency,
  budgetStartDate,
  budgetEndDate,
  categories
}: {
  budgetId: number
  budgetCurrency: string
  budgetStartDate: string
  budgetEndDate: string
  categories: BudgetCategory[]
}): React.JSX.Element {
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'expense' | 'revenue'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const list = await window.api.budget.listTransactions(budgetId)
    setTransactions(list)
    setLoading(false)
  }, [budgetId])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (id: number): Promise<void> => {
    await window.api.budget.deleteTransaction(id)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  const filtered = transactions.filter((t) =>
    filter === 'all' ? true : filter === 'expense' ? !t.is_revenue : !!t.is_revenue
  )

  // Grouper par mois
  const grouped: Record<string, BudgetTransaction[]> = {}
  for (const tx of filtered) {
    const month = tx.date.slice(0, 7)
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(tx)
  }

  const monthLabel = (ym: string): string => {
    const [y, m] = ym.split('-')
    const months = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre'
    ]
    return `${months[parseInt(m) - 1]} ${y}`
  }

  return (
    <div className="flex flex-col gap-4">
      <AddTransactionForm
        budgetId={budgetId}
        budgetCurrency={budgetCurrency}
        budgetStartDate={budgetStartDate}
        budgetEndDate={budgetEndDate}
        categories={categories}
        onAdded={(tx) => {
          setTransactions((prev) => [tx, ...prev])
        }}
      />

      {/* Filtres */}
      <div className="flex gap-2">
        {(
          [
            ['all', 'Toutes'],
            ['expense', 'Dépenses'],
            ['revenue', 'Revenus']
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              filter === v
                ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
          <List className="w-8 h-8" />
          <p className="text-sm">Aucune transaction</p>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([month, txs]) => {
            const total = txs.reduce(
              (s, t) => s + (t.is_revenue ? t.amount_base : -t.amount_base),
              0
            )
            return (
              <div key={month}>
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {monthLabel(month)}
                  </p>
                  <span
                    className={`text-xs font-medium ${total >= 0 ? 'text-emerald-400' : 'text-slate-400'}`}
                  >
                    {total >= 0 ? '+' : ''}
                    {fmt(total, budgetCurrency, 2)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {txs.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 rounded-xl transition-all group"
                    >
                      {/* Catégorie */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{
                          background: tx.category_color ? `${tx.category_color}25` : '#ffffff10'
                        }}
                      >
                        {tx.category_color ? '💳' : '💳'}
                      </div>
                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-white truncate">{tx.label}</p>
                          {tx.is_recurring ? (
                            <Repeat className="w-3 h-3 text-slate-600 shrink-0" />
                          ) : null}
                        </div>
                        <p className="text-[10px] text-slate-600">
                          {tx.date}
                          {tx.category_name && ` · ${tx.category_name}`}
                          {tx.currency !== budgetCurrency && ` · ${fmt(tx.amount, tx.currency)}`}
                        </p>
                      </div>
                      {/* Montant */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${tx.is_revenue ? 'text-emerald-400' : 'text-slate-200'}`}
                        >
                          {tx.is_revenue ? '+' : '-'}
                          {fmt(tx.amount_base, budgetCurrency, 2)}
                        </span>
                        <button
                          onClick={() => void handleDelete(tx.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
      )}
    </div>
  )
}

// ── Tab: Hors-budget ──────────────────────────────────────────────────────────

function ExtrasTab({
  budgetId,
  budgetCurrency
}: {
  budgetId: number
  budgetCurrency: string
}): React.JSX.Element {
  const [extras, setExtras] = useState<BudgetExtraItem[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    window.api.budget.listExtras(budgetId).then((list) => {
      setExtras(list)
      setLoading(false)
    })
  }, [budgetId])

  const handleAdd = async (): Promise<void> => {
    if (!label.trim() || !amount) return
    setAdding(true)
    const payload: NewExtraPayload = {
      budget_id: budgetId,
      label: label.trim(),
      amount: parseFloat(amount),
      planned_date: date || null
    }
    const extra = await window.api.budget.addExtra(payload)
    setExtras((prev) => [...prev, extra])
    setLabel('')
    setAmount('')
    setDate('')
    setAdding(false)
  }

  const handleDelete = async (id: number): Promise<void> => {
    await window.api.budget.deleteExtra(id)
    setExtras((prev) => prev.filter((e) => e.id !== id))
  }

  const total = extras.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Ajouter un hors-budget
        </p>
        <p className="text-xs text-slate-600">
          Les hors-budget sont déduits du total avant le calcul des objectifs mensuels.
        </p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Billet d'avion, Visa, Assurance…"
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Montant (${budgetCurrency})`}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <button
          onClick={() => void handleAdd()}
          disabled={adding || !label.trim() || !amount}
          className="flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-xl text-white text-sm font-medium transition-all"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Ajouter
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      ) : extras.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-slate-600 gap-2">
          <p className="text-sm">Aucun hors-budget planifié</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {extras.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/40 border border-slate-700/40 rounded-xl group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{e.label}</p>
                {e.planned_date && (
                  <p className="text-xs text-slate-600">Prévu : {e.planned_date}</p>
                )}
              </div>
              <span className="text-amber-400 font-semibold text-sm">
                {fmt(e.amount, budgetCurrency, 2)}
              </span>
              <button
                onClick={() => void handleDelete(e.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/50 text-sm font-semibold">
            <span className="text-slate-400">Total hors-budget</span>
            <span className="text-amber-400">{fmt(total, budgetCurrency, 2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Récurrents ───────────────────────────────────────────────────────────

function RecurringTab({
  budgetId,
  budgetCurrency,
  categories
}: {
  budgetId: number
  budgetCurrency: string
  categories: BudgetCategory[]
}): React.JSX.Element {
  const [recurrings, setRecurrings] = useState<BudgetRecurring[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [applying, setApplying] = useState(false)
  const [form, setForm] = useState({
    label: '',
    amount: '',
    currency: budgetCurrency,
    catId: '',
    type: 'monthly' as 'monthly' | 'weekly',
    day: '1',
    isRevenue: false
  })

  const load = (): void => {
    window.api.budget.listRecurring(budgetId).then((list) => {
      setRecurrings(list)
      setLoading(false)
    })
  }
  useEffect(load, [budgetId])

  const handleAdd = async (): Promise<void> => {
    if (!form.label.trim() || !form.amount) return
    setAdding(true)
    const payload: NewRecurringPayload = {
      budget_id: budgetId,
      category_id: form.catId ? Number(form.catId) : null,
      label: form.label.trim(),
      amount: parseFloat(form.amount),
      currency: form.currency,
      recurrence_type: form.type,
      recurrence_day: parseInt(form.day),
      is_revenue: form.isRevenue
    }
    const r = await window.api.budget.createRecurring(payload)
    setRecurrings((prev) => [...prev, r])
    setForm({
      label: '',
      amount: '',
      currency: budgetCurrency,
      catId: '',
      type: 'monthly',
      day: '1',
      isRevenue: false
    })
    setAdding(false)
  }

  const handleToggle = async (id: number): Promise<void> => {
    await window.api.budget.toggleRecurring(id)
    setRecurrings((prev) => prev.map((r) => (r.id === id ? { ...r, active: r.active ? 0 : 1 } : r)))
  }

  const handleDelete = async (id: number): Promise<void> => {
    await window.api.budget.deleteRecurring(id)
    setRecurrings((prev) => prev.filter((r) => r.id !== id))
  }

  const handleApply = async (): Promise<void> => {
    setApplying(true)
    const n = await window.api.budget.applyRecurring(budgetId)
    setApplying(false)
    alert(
      n > 0
        ? `${n} transaction(s) récurrente(s) appliquée(s).`
        : 'Aucune nouvelle transaction à appliquer.'
    )
  }

  const DAYS_MONTH = Array.from({ length: 28 }, (_, i) => i + 1)
  const DAYS_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Nouvelle récurrence
        </p>
        {/* Type: Abonnement ou Revenu */}
        <div className="flex gap-2">
          {[
            { v: false, label: 'Abonnement (dépense)', icon: TrendingDown },
            { v: true, label: 'Source de revenu', icon: TrendingUp }
          ].map((opt) => (
            <button
              key={String(opt.v)}
              onClick={() => setForm((p) => ({ ...p, isRevenue: opt.v }))}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs border transition-all ${
                form.isRevenue === opt.v
                  ? opt.v
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-red-500/15 border-red-500/40 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              <opt.icon className="w-3 h-3" />
              {opt.label}
            </button>
          ))}
        </div>
        <input
          value={form.label}
          onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          placeholder="Ex: Loyer, Netflix, Abonnement…"
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            placeholder="Montant"
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-sm text-slate-200 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <select
            value={form.catId}
            onChange={(e) => setForm((p) => ({ ...p, catId: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-sm text-slate-200 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
          >
            <option value="">Catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={form.type}
            onChange={(e) =>
              setForm((p) => ({ ...p, type: e.target.value as 'monthly' | 'weekly', day: '1' }))
            }
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
          >
            <option value="monthly">Mensuel</option>
            <option value="weekly">Hebdomadaire</option>
          </select>
          <select
            value={form.day}
            onChange={(e) => setForm((p) => ({ ...p, day: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
          >
            {form.type === 'monthly'
              ? DAYS_MONTH.map((d) => (
                  <option key={d} value={d}>
                    Le {d} du mois
                  </option>
                ))
              : DAYS_WEEK.map((d, i) => (
                  <option key={i} value={i}>
                    Chaque {d}
                  </option>
                ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handleAdd()}
            disabled={adding || !form.label.trim() || !form.amount}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-xl text-white text-sm font-medium transition-all"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer
          </button>
          <button
            onClick={() => void handleApply()}
            disabled={applying}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-sm text-slate-300 transition-colors flex items-center gap-2"
          >
            {applying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Appliquer
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      ) : recurrings.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-slate-600 gap-2">
          <Repeat className="w-8 h-8" />
          <p className="text-sm">Aucune transaction récurrente</p>
        </div>
      ) : (() => {
        const abonnements = recurrings.filter((r) => r.is_revenue === 0)
        const revenus     = recurrings.filter((r) => r.is_revenue === 1)

        const renderRow = (r: BudgetRecurring): React.JSX.Element => (
          <div
            key={r.id}
            className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl transition-all group ${
              r.active
                ? 'bg-slate-800/40 border-slate-700/40'
                : 'bg-slate-900/30 border-slate-800/40 opacity-50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{r.label}</p>
              <p className="text-xs text-slate-600">
                {fmt(r.amount, r.currency, 2)} ·{' '}
                {r.recurrence_type === 'monthly'
                  ? `Le ${r.recurrence_day} du mois`
                  : `Chaque ${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][r.recurrence_day]}`}
              </p>
            </div>
            <button
              onClick={() => void handleToggle(r.id)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all text-xs ${
                r.active
                  ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                  : 'bg-slate-800 border-slate-700 text-slate-600'
              }`}
            >
              {r.active ? <CheckCircle className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => void handleDelete(r.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )

        return (
          <div className="flex flex-col gap-4">
            {abonnements.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-1">
                  Abonnements
                </p>
                {abonnements.map(renderRow)}
              </div>
            )}
            {revenus.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 px-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
                    Sources de revenus
                  </p>
                </div>
                {revenus.map(renderRow)}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ── Tab: Enveloppes ───────────────────────────────────────────────────────────

function EnvelopesTab({
  budgetId,
  budgetCurrency,
  categories
}: {
  budgetId: number
  budgetCurrency: string
  categories: BudgetCategory[]
}): React.JSX.Element {
  const [envelopes,  setEnvelopes]  = useState<BudgetEnvelopeItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [editingId,  setEditingId]  = useState<number | null>(null)
  const [editVal,    setEditVal]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [newCatId,   setNewCatId]   = useState('')
  const [newLimit,   setNewLimit]   = useState('')
  const [adding,     setAdding]     = useState(false)

  const load = useCallback(async () => {
    const items = await window.api.budget.listCategoryLimits(budgetId)
    // Fetch current month spending to enrich each item
    const spending = await window.api.budget.categorySpending(budgetId)
    const enriched: BudgetEnvelopeItem[] = items.map((item) => {
      const cat = spending.categories.find((c) => c.category_id === item.category_id)
      return {
        id: item.id,
        budget_id: item.budget_id,
        category_id: item.category_id,
        monthly_limit: item.monthly_limit,
        current_month_spent: cat?.spent ?? 0,
        category_name:  item.category_name,
        category_color: item.category_color,
        category_icon:  item.category_icon,
      }
    })
    setEnvelopes(enriched)
    setLoading(false)
  }, [budgetId])

  useEffect(() => { void load() }, [load])

  // Categories not yet assigned to an envelope
  const usedCatIds = new Set(envelopes.map((e) => e.category_id))
  const availableCats = categories.filter((c) => !usedCatIds.has(c.id))

  const handleSave = async (catId: number): Promise<void> => {
    const val = parseFloat(editVal)
    if (isNaN(val) || val <= 0) { setEditingId(null); return }
    setSaving(true)
    await window.api.budget.setCategoryLimit({ budget_id: budgetId, category_id: catId, monthly_limit: val })
    setSaving(false)
    setEditingId(null)
    await load()
  }

  const handleDelete = async (catId: number): Promise<void> => {
    await window.api.budget.deleteCategoryLimit({ budget_id: budgetId, category_id: catId })
    await load()
  }

  const handleAdd = async (): Promise<void> => {
    if (!newCatId || !newLimit) return
    const val = parseFloat(newLimit)
    if (isNaN(val) || val <= 0) return
    setAdding(true)
    await window.api.budget.setCategoryLimit({ budget_id: budgetId, category_id: Number(newCatId), monthly_limit: val })
    setNewCatId('')
    setNewLimit('')
    setAdding(false)
    await load()
  }

  const totalPlanned = envelopes.reduce((s, e) => s + e.monthly_limit, 0)
  const totalSpent   = envelopes.reduce((s, e) => s + e.current_month_spent, 0)

  return (
    <div className="flex flex-col gap-4">

      {/* ── Formulaire ajout ── */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Ajouter une enveloppe
        </p>
        <p className="text-xs text-slate-600">
          Une enveloppe définit un budget mensuel max pour une catégorie de dépenses.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={newCatId}
            onChange={(e) => setNewCatId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
          >
            <option value="">Catégorie…</option>
            {availableCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={newLimit}
            onChange={(e) => setNewLimit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
            placeholder={`Limite / mois (${budgetCurrency})`}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <button
          onClick={() => void handleAdd()}
          disabled={adding || !newCatId || !newLimit}
          className="flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 rounded-xl text-white text-sm font-medium transition-all"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Ajouter l'enveloppe
        </button>
      </div>

      {/* ── Liste des enveloppes ── */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        </div>
      ) : envelopes.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-slate-600 gap-2">
          <Target className="w-8 h-8" />
          <p className="text-sm">Aucune enveloppe définie</p>
          <p className="text-xs text-slate-700">
            Ajoute une enveloppe pour limiter tes dépenses par catégorie.
          </p>
        </div>
      ) : (
        <>
          {/* Résumé mois courant */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Budget enveloppes</p>
              <p className="text-base font-bold text-[var(--color-primary)] mt-1">{fmt(totalPlanned, budgetCurrency)} / mois</p>
            </div>
            <div className={`rounded-xl p-3 border ${
              totalSpent > totalPlanned
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-slate-800/60 border-slate-700/40'
            }`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Dépensé ce mois</p>
              <p className={`text-base font-bold mt-1 ${totalSpent > totalPlanned ? 'text-red-400' : 'text-slate-200'}`}>
                {fmt(totalSpent, budgetCurrency, 2)}
              </p>
            </div>
          </div>

          {/* Cards enveloppes */}
          <div className="flex flex-col gap-2">
            {envelopes.map((env) => {
              const spentPct = env.monthly_limit > 0
                ? Math.min(100, Math.round((env.current_month_spent / env.monthly_limit) * 100))
                : 0
              const isOver = env.current_month_spent >= env.monthly_limit
              const isWarn = !isOver && env.current_month_spent >= env.monthly_limit * 0.8
              const barCol = isOver ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-[var(--color-primary)]'
              const isEditing = editingId === env.category_id

              return (
                <div
                  key={env.id}
                  className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: `${env.category_color}22` }}
                    >
                      {env.category_icon}
                    </div>
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{env.category_name}</p>
                      <p className="text-[11px] text-slate-600">
                        {env.current_month_spent > 0
                          ? `${fmt(env.current_month_spent, budgetCurrency, 2)} dépensé`
                          : 'Rien dépensé ce mois'}
                      </p>
                    </div>
                    {/* Limit + actions */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSave(env.category_id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          autoFocus
                          className="w-20 bg-slate-900 border border-[var(--color-primary)]/50 rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none"
                          placeholder="Montant"
                        />
                        <button
                          onClick={() => void handleSave(env.category_id)}
                          disabled={saving}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <p className="text-sm font-bold text-[var(--color-primary)]">
                          {fmt(env.monthly_limit, budgetCurrency)}
                        </p>
                        <span className="text-[10px] text-slate-600">/mois</span>
                        <button
                          onClick={() => { setEditingId(env.category_id); setEditVal(String(env.monthly_limit)) }}
                          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => void handleDelete(env.category_id)}
                          className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barCol}`}
                        style={{ width: `${spentPct}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold w-8 text-right shrink-0 ${
                      isOver ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                      {spentPct}%
                    </span>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {fmt(env.monthly_limit - env.current_month_spent, budgetCurrency)} restant
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab: IA ───────────────────────────────────────────────────────────────────

function AiTab({ budgetId }: { budgetId: number }): React.JSX.Element {
  const [streamText, setStreamText] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [_done,      setDone]       = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamText])

  const handleAnalysis = async (): Promise<void> => {
    setLoading(true)
    setStreamText('')
    setDone(false)

    // L'analyse actuelle retourne un string complet (pas encore de streaming côté IPC)
    // On l'affiche chunk par chunk pour simuler le streaming — et on gère bien les erreurs
    try {
      const result = await window.api.budget.aiAnalysis(budgetId)
      // Afficher lettre par lettre pour l'effet streaming
      if (!result || result === 'Analyse indisponible.') {
        setStreamText('⚠️ L\'IA n\'a pas pu répondre. Causes possibles :\n• Ollama : mémoire insuffisante (essaie un modèle plus petit, ex: llama3.2:1b)\n• OpenAI/Anthropic : vérifie ta clé API dans les paramètres\n• Connexion à Ollama : vérifie que Ollama est démarré')
      } else {
        // Affichage progressif
        let i = 0
        const interval = setInterval(() => {
          i += 4
          setStreamText(result.slice(0, i))
          if (i >= result.length) {
            clearInterval(interval)
            setStreamText(result)
          }
        }, 8)
      }
    } catch (e) {
      setStreamText(`⚠️ Erreur : ${e instanceof Error ? e.message : 'inconnue'}`)
    } finally {
      setLoading(false)
      setDone(true)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
          <p className="text-sm font-medium text-slate-200">Analyse IA de ton budget</p>
        </div>
        <p className="text-xs text-slate-500">
          L'IA analyse tes dépenses, détecte les tendances, évalue les risques et te donne des conseils personnalisés.
        </p>
        <button
          onClick={() => void handleAnalysis()}
          disabled={loading}
          className="flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 rounded-xl text-white text-sm font-medium transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Analyse en cours…' : "Lancer l'analyse"}
        </button>
      </div>

      {(streamText || loading) && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 max-h-[50vh] overflow-auto">
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {streamText}
            {loading && <span className="inline-block w-1.5 h-3.5 bg-[var(--color-primary)] ml-0.5 animate-pulse align-middle" />}
          </div>
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

// ── Page BudgetDetail ─────────────────────────────────────────────────────────

type Tab = 'overview' | 'transactions' | 'extras' | 'recurring' | 'envelopes' | 'ai'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',      label: 'Vue',         icon: Target },
  { id: 'transactions',  label: 'Transactions', icon: List },
  { id: 'extras',        label: 'Hors-budget',  icon: Tag },
  { id: 'recurring',     label: 'Récurrents',   icon: Repeat },
  { id: 'envelopes',     label: 'Enveloppes',   icon: PiggyBank },
  { id: 'ai',            label: 'IA',           icon: Sparkles }
]

export function BudgetDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const budgetId = parseInt(id ?? '0')

  const [summary,       setSummary]       = useState<BudgetSummary | null>(null)
  const [categories,    setCategories]    = useState<BudgetCategory[]>([])
  const [loading,       setLoading]       = useState(true)
  const [tab,           setTab]           = useState<Tab>('overview')
  const [refreshing,    setRefreshing]    = useState(false)
  const [autoSynced,    setAutoSynced]    = useState(0)   // nb de récurrents appliqués auto
  const didAutoSync = useRef(false)

  const load = useCallback(async () => {
    const [s, cats] = await Promise.all([
      window.api.budget.summary(budgetId),
      window.api.budget.listCategories(budgetId)
    ])
    setSummary(s)
    setCategories(cats)
    setLoading(false)
  }, [budgetId])

  // Auto-sync des récurrents au premier chargement
  useEffect(() => {
    if (didAutoSync.current) return
    didAutoSync.current = true
    window.api.budget.applyRecurring(budgetId).then(n => {
      if (n > 0) {
        setAutoSynced(n)
        void load()                         // recharger le summary avec les nouvelles tx
        setTimeout(() => setAutoSynced(0), 5000)  // masquer le badge après 5s
      }
    })
  }, [budgetId, load])

  useEffect(() => {
    void load()
  }, [load])

  const handleRefreshRate = async (): Promise<void> => {
    setRefreshing(true)
    await window.api.budget.refreshRate(budgetId)
    await load()
    setRefreshing(false)
  }

  const handleRecalculate = async (): Promise<void> => {
    await window.api.budget.recalculateGoal(budgetId)
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
        <p className="text-sm">Budget introuvable.</p>
        <button
          onClick={() => navigate('/budget')}
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          ← Retour aux budgets
        </button>
      </div>
    )
  }

  const { budget } = summary

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-700/50 shrink-0">
        <button
          onClick={() => navigate('/budget')}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{budget.name}</h1>
          <p className="text-[11px] text-slate-500">
            {budget.start_date} → {budget.end_date}
            {budget.display_currency && budget.display_rate && (
              <span className="ml-2 text-slate-600">
                · 1 {budget.currency} = {budget.display_rate.toFixed(2)} {budget.display_currency}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {budget.display_currency && (
            <button
              onClick={() => void handleRefreshRate()}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Actualiser le taux de change"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={() => void handleRecalculate()}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Recalculer les objectifs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Banner auto-sync ── */}
      {autoSynced > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/20 shrink-0">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300">
            {autoSynced} transaction{autoSynced > 1 ? 's' : ''} récurrente{autoSynced > 1 ? 's' : ''} appliquée{autoSynced > 1 ? 's' : ''} automatiquement
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-slate-700/50 shrink-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
              tab === t.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {tab === 'overview' && <OverviewTab summary={summary} budgetId={budgetId} onRefresh={load} />}
        {tab === 'transactions' && (
          <TransactionsTab
            budgetId={budgetId}
            budgetCurrency={budget.currency}
            budgetStartDate={budget.start_date}
            budgetEndDate={budget.end_date}
            categories={categories}
          />
        )}
        {tab === 'extras' && <ExtrasTab budgetId={budgetId} budgetCurrency={budget.currency} />}
        {tab === 'recurring' && (
          <RecurringTab
            budgetId={budgetId}
            budgetCurrency={budget.currency}
            categories={categories}
          />
        )}
        {tab === 'envelopes' && (
          <EnvelopesTab
            budgetId={budgetId}
            budgetCurrency={budget.currency}
            categories={categories}
          />
        )}
        {tab === 'ai' && <AiTab budgetId={budgetId} />}
      </div>

      {summary.pending_checkup && (
        <CheckupModal
          checkup={summary.pending_checkup}
          budgetId={budgetId}
          budgetLibreMonthly={summary.budget_libre_monthly}
          currency={summary.budget.currency}
          onAcknowledge={() => void load()}
        />
      )}
    </div>
  )
}
