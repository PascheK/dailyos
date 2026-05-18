import { useState, useEffect, useCallback, useRef } from 'react'
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
  Wallet,
  CalendarDays,
} from 'lucide-react'
import type {
  BudgetSummary,
  BudgetTransaction,
  BudgetCategory,
  BudgetRecurring,
  BudgetExtraItem,
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

// ── Barre de progression ──────────────────────────────────────────────────────

function ProgressBar({
  value,
  max,
  warn,
  danger,
  label,
  sublabel,
  small = false
}: {
  value: number
  max: number
  warn?: number
  danger?: number
  label?: string
  sublabel?: string
  small?: boolean
}): React.JSX.Element {
  const p = pct(value, max)
  const isDanger = danger !== undefined && value >= danger
  const isWarn = warn !== undefined && value >= warn && !isDanger
  const color = isDanger ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-[var(--color-primary)]'
  const text = isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-[var(--color-primary)]'

  return (
    <div className="flex flex-col gap-1">
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-slate-400">{label}</span>}
          {sublabel && <span className={`font-medium ${text}`}>{sublabel}</span>}
        </div>
      )}
      <div className={`${small ? 'h-1.5' : 'h-2'} bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  )
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

// ── Vue par période ───────────────────────────────────────────────────────────

type PeriodKey = 'total' | 'mois' | 'semaine' | 'jour'

function PeriodView({
  summary,
  cur,
  dispCur,
  rate
}: {
  summary: BudgetSummary
  cur: string
  dispCur: string | null | undefined
  rate: number | null | undefined
}): React.JSX.Element {
  const { net_spent, available_amount, monthly_goal, day_spent, week_spent, months_count, goal } = summary
  const { start_date, end_date } = summary.budget

  // Le budget est-il actif aujourd'hui ?
  const todayISO    = new Date().toISOString().slice(0, 10)
  const isActive    = todayISO >= start_date && todayISO <= end_date
  const hasNotStarted = todayISO < start_date

  const [period, setPeriod] = useState<PeriodKey>('mois')

  // Si le budget n'est pas actif, forcer la vue "total"
  const effectivePeriod: PeriodKey = isActive ? period : 'total'

  // Quotas par période
  const weeklyQuota  = monthly_goal * 12 / 52
  const dailyQuota   = monthly_goal / 30.44

  const periodData: Record<PeriodKey, { label: string; spent: number; quota: number; warn?: number }> = {
    total:   { label: 'Total',    spent: net_spent,   quota: available_amount, warn: available_amount * 0.8 },
    mois:    { label: 'Ce mois',  spent: summary.current_period_spent - summary.current_period_revenue,
                                   quota: monthly_goal, warn: goal?.critical_threshold },
    semaine: { label: 'Semaine',  spent: week_spent,   quota: weeklyQuota,   warn: weeklyQuota * 0.85 },
    jour:    { label: 'Jour',     spent: day_spent,    quota: dailyQuota,    warn: dailyQuota  * 0.85 },
  }

  const current  = periodData[effectivePeriod]
  const spentPct = pct(current.spent, current.quota)
  const isOver   = current.spent > current.quota
  const isWarn   = !isOver && current.warn !== undefined && current.spent >= current.warn

  const tabs: PeriodKey[] = ['total', 'mois', 'semaine', 'jour']

  return (
    <div className="flex flex-col gap-3">
      {/* Bannière si budget non actif */}
      {!isActive && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 border border-slate-600/30 rounded-lg">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <p className="text-xs text-slate-400">
            {hasNotStarted
              ? `Budget démarre le ${new Date(start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} — seule la vue totale est disponible.`
              : `Budget terminé le ${new Date(end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} — seule la vue totale est disponible.`}
          </p>
        </div>
      )}

      {/* Toggles (visibles uniquement si budget actif) */}
      {isActive && (
      <div className="flex gap-1 bg-slate-900/60 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setPeriod(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
              period === t
                ? 'bg-[var(--color-primary)] text-white shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {periodData[t].label}
          </button>
        ))}
      </div>
      )}

      {/* Montant dépensé */}
      <div className="flex items-end justify-between gap-2 pt-1">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Dépensé</p>
          <p className={`text-2xl font-bold ${isOver ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-white'}`}>
            {fmt(current.spent, cur)}
          </p>
          {dispCur && rate && (
            <p className="text-xs text-slate-500 mt-0.5">≈ {fmt(current.spent * rate, dispCur)}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-0.5">Quota</p>
          <p className="text-sm font-semibold text-slate-300">{fmt(current.quota, cur)}</p>
          <p className="text-xs text-slate-600 mt-0.5">{spentPct}% utilisé</p>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOver ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-[var(--color-primary)]'
          }`}
          style={{ width: `${Math.min(100, spentPct)}%` }}
        />
        {/* Marqueur seuil critique (mois uniquement) */}
        {effectivePeriod === 'mois' && goal && (
          <div
            className="absolute top-0 h-full w-px bg-amber-500/70 pointer-events-none"
            style={{ left: `${pct(goal.critical_threshold, current.quota)}%` }}
          />
        )}
      </div>

      {/* Légende */}
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span>
          Reste :{' '}
          <span className={`font-medium ${current.quota - current.spent < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {fmt(Math.max(0, current.quota - current.spent), cur)}
          </span>
        </span>
        {effectivePeriod === 'mois' && goal && (
          <span className="text-amber-700">⚡ seuil {fmt(goal.critical_threshold, cur)}</span>
        )}
        {effectivePeriod === 'total' && (
          <span>{months_count} mois au total</span>
        )}
      </div>
    </div>
  )
}

// ── OverviewTab v2 ────────────────────────────────────────────────────────────

function OverviewTab({
  summary,
  budgetId
}: {
  summary: BudgetSummary
  budgetId: number
}): React.JSX.Element {
  const {
    budget,
    goal,
    extra_items,
    extra_total,
    available_amount,
    net_spent,
    total_remaining,
    months_remaining,
    months_count,
    display_remaining,
    savings,
    display_savings,
    monthly_goal
  } = summary

  const cur     = budget.currency
  const dispCur = budget.display_currency
  const rate    = budget.display_rate

  const [catSpending, setCatSpending] = useState<CategorySpending[]>([])

  const loadCatSpending = useCallback(async () => {
    const result = await window.api.budget.categorySpending(budgetId)
    setCatSpending(result.categories)
  }, [budgetId])

  useEffect(() => { void loadCatSpending() }, [loadCatSpending])

  // Calcul de la marge d'économie (ratio objectif mensuel / allocation brute)
  const rawMonthly     = months_count > 0 ? available_amount / months_count : 0
  const marginPct      = rawMonthly > 0 ? Math.round((monthly_goal / rawMonthly) * 100) : 100
  const bourseEffective = total_remaining * (marginPct / 100)

  // Alertes dépassement mois courant
  const periodNet  = summary.current_period_spent - summary.current_period_revenue
  const overTarget   = goal && periodNet >= goal.monthly_target
  const overCritical = goal && !overTarget && periodNet >= goal.critical_threshold

  return (
    <div className="flex flex-col gap-3">
      {/* ── Alerte dépassement ── */}
      {(overTarget || overCritical) && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            overTarget
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm">
            {overTarget
              ? `Objectif mensuel dépassé (${fmt(goal!.monthly_target, cur)}).`
              : `Tu approches du seuil critique (${fmt(goal!.critical_threshold, cur)}).`}
          </p>
        </div>
      )}

      {/* ── Section 1 : Résumé de la bourse ── */}
      <Collapsible
        title="Résumé de la bourse"
        icon={<Wallet className="w-4 h-4 text-[var(--color-primary)]" />}
        defaultOpen={true}
      >
        {/* Lignes bilan */}
        <div className="flex flex-col divide-y divide-slate-700/40 mt-1">
          {/* Bourse totale */}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-xs text-slate-400 font-medium">Bourse totale</p>
              {extra_total > 0 && (
                <p className="text-[11px] text-slate-600 mt-0.5">
                  dont {fmt(extra_total, cur)} hors-budget
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{fmt(budget.total_amount, cur)}</p>
              {dispCur && rate && (
                <p className="text-[11px] text-slate-500">≈ {fmt(budget.total_amount * rate, dispCur)}</p>
              )}
            </div>
          </div>

          {/* Bourse nette (– hors-budget) */}
          {extra_total > 0 && (
            <div className="flex items-center justify-between py-2.5">
              <p className="text-xs text-slate-400 font-medium">Bourse nette <span className="text-slate-600 font-normal">(– hors-budget)</span></p>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{fmt(available_amount, cur)}</p>
                {dispCur && rate && (
                  <p className="text-[11px] text-slate-500">≈ {fmt(available_amount * rate, dispCur)}</p>
                )}
              </div>
            </div>
          )}

          {/* Bourse finale (solde restant) */}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-xs text-slate-400 font-medium">Bourse finale <span className="text-slate-600 font-normal">(solde restant)</span></p>
              <p className="text-[11px] text-slate-600 mt-0.5">{months_remaining} mois restants · {fmt(net_spent, cur)} dépensés</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${total_remaining >= 0 ? 'text-white' : 'text-red-400'}`}>
                {fmt(total_remaining, cur)}
              </p>
              {dispCur && rate && (
                <p className="text-[11px] text-slate-500">≈ {fmt(display_remaining ?? total_remaining * rate, dispCur)}</p>
              )}
            </div>
          </div>

          {/* Bourse effective (avec marge d'économie) */}
          {goal && marginPct < 100 && (
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-xs text-slate-400 font-medium">
                  Bourse effective{' '}
                  <span className="text-[var(--color-primary)] font-normal">×{marginPct}%</span>
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">Objectif d'économie activé par l'IA</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--color-primary)]">{fmt(bourseEffective, cur)}</p>
                {dispCur && rate && (
                  <p className="text-[11px] text-slate-500">≈ {fmt(bourseEffective * rate, dispCur)}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Barre globale */}
        <div className="mt-3">
          <ProgressBar
            value={net_spent}
            max={available_amount}
            warn={available_amount * 0.75}
            danger={available_amount}
            label={`${fmt(net_spent, cur)} dépensé sur ${fmt(available_amount, cur)}`}
          />
        </div>
      </Collapsible>

      {/* ── Section 2 : Dépenses par période ── */}
      <Collapsible
        title="Dépenses par période"
        icon={<CalendarDays className="w-4 h-4 text-[var(--color-primary)]" />}
        defaultOpen={true}
      >
        <div className="mt-1">
          <PeriodView summary={summary} cur={cur} dispCur={dispCur} rate={rate} />
        </div>
      </Collapsible>

      {/* ── Section 3 : Par catégorie ── */}
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

      {/* ── Section 4 : Cagnotte ── */}
      {savings > 0 && (
        <Collapsible
          title="Cagnotte"
          icon={<PiggyBank className="w-4 h-4 text-emerald-400" />}
          defaultOpen={true}
        >
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <PiggyBank className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-bold text-emerald-300">
                {fmt(savings, cur)} économisés 🎉
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {display_savings && dispCur ? `≈ ${fmt(display_savings, dispCur)} · ` : ''}
                En avance sur l'objectif mensuel de {fmt(monthly_goal, cur)}
              </p>
            </div>
          </div>
        </Collapsible>
      )}

      {/* ── Section 5 : Hors-budget ── */}
      {extra_items.length > 0 && (
        <Collapsible
          title="Hors-budget planifiés"
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          badge={
            <span className="ml-1 px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-medium rounded-full">
              {fmt(extra_total, cur)}
            </span>
          }
          defaultOpen={false}
        >
          <div className="flex flex-col gap-2 mt-2">
            {extra_items.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-slate-300">{e.label}</span>
                  {e.planned_date && (
                    <span className="text-xs text-slate-600">{e.planned_date}</span>
                  )}
                </div>
                <span className="text-amber-400 font-medium">{fmt(e.amount, cur)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm font-medium border-t border-slate-700 pt-2 mt-1">
              <span className="text-slate-400">Total hors-budget</span>
              <span className="text-amber-400">{fmt(extra_total, cur)}</span>
            </div>
          </div>
        </Collapsible>
      )}
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
    day: '1'
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
      recurrence_day: parseInt(form.day)
    }
    const r = await window.api.budget.createRecurring(payload)
    setRecurrings((prev) => [...prev, r])
    setForm({
      label: '',
      amount: '',
      currency: budgetCurrency,
      catId: '',
      type: 'monthly',
      day: '1'
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
      ) : (
        <div className="flex flex-col gap-2">
          {recurrings.map((r) => (
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
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: IA ───────────────────────────────────────────────────────────────────

function AiTab({ budgetId }: { budgetId: number }): React.JSX.Element {
  const [streamText, setStreamText] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [done,       setDone]       = useState(false)
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

type Tab = 'overview' | 'transactions' | 'extras' | 'recurring' | 'ai'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Vue', icon: Target },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'extras', label: 'Hors-budget', icon: Tag },
  { id: 'recurring', label: 'Récurrents', icon: Repeat },
  { id: 'ai', label: 'IA', icon: Sparkles }
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
        {tab === 'overview' && <OverviewTab summary={summary} budgetId={budgetId} />}
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
        {tab === 'ai' && <AiTab budgetId={budgetId} />}
      </div>
    </div>
  )
}
