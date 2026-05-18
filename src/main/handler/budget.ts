import { ipcMain, Notification, net } from 'electron'
import https from 'https'
import { db } from '../db'
import { getSettings, getApiKey } from '../store'

// ── Types internes ────────────────────────────────────────────────────────────

type DbBudget = {
  id: number; name: string; total_amount: number; currency: string
  display_currency: string | null; display_rate: number | null
  display_rate_updated_at: string | null; start_date: string; end_date: string
  created_at: string; savings_goal: number; checkup_day: number; last_checkup_month: string | null
}
type DbExtra    = { id: number; budget_id: number; label: string; amount: number; planned_date: string | null; created_at: string }
type DbCategory = { id: number; budget_id: number | null; name: string; color: string; icon: string }
type DbRecurring = { id: number; budget_id: number; category_id: number | null; label: string
                     amount: number; currency: string; recurrence_type: string; recurrence_day: number
                     active: number; last_applied: string | null; is_revenue: number }
type DbGoal      = { id: number; budget_id: number; period_start: string; period_end: string
                     monthly_target: number; critical_threshold: number; recalculated_at: string }
type DbCategoryLimit = { id: number; budget_id: number; category_id: number; monthly_limit: number }
type DbCheckup   = { id: number; budget_id: number; month: string; rollover_amount: number; acknowledged: number; created_at: string }

// ── Utilitaires date ──────────────────────────────────────────────────────────

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentISOWeek(): string {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function periodBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end   = `${y}-${String(m).padStart(2, '0')}-${lastDay}`
  return { start, end }
}

function monthsBetween(start: string, end: string): number {
  const s = new Date(start), e = new Date(end)
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1)
}

function monthsElapsed(start: string): number {
  const s = new Date(start), now = new Date()
  return Math.max(0, (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth()))
}

// ── Taux de change (frankfurter.app via net.fetch Electron) ──────────────────

async function fetchRate(from: string, to: string): Promise<number> {
  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`
  const response = await net.fetch(url, {
    headers: { 'User-Agent': 'DailyOS-Budget/1.0', 'Accept': 'application/json' }
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 100)}`)
  }
  const data = await response.json() as { rates: Record<string, number> }
  const rate = data.rates?.[to]
  if (!rate || typeof rate !== 'number') {
    throw new Error(`Taux ${from}→${to} introuvable. Réponse: ${JSON.stringify(data).slice(0, 200)}`)
  }
  return rate
}

// ── Calcul des objectifs ──────────────────────────────────────────────────────

function computeGoal(budgetId: number): Omit<DbGoal, 'id' | 'recalculated_at'> {
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId) as DbBudget | undefined
  if (!budget) throw new Error('Budget introuvable')

  const extras = db.prepare('SELECT SUM(amount) as s FROM budget_extra_items WHERE budget_id = ?')
    .get(budgetId) as { s: number | null }
  const extraTotal = extras.s ?? 0

  const available = budget.total_amount - extraTotal

  const spent = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) -
            COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as net
     FROM budget_transactions WHERE budget_id = ?`
  ).get(budgetId) as { net: number }

  const totalMonths   = monthsBetween(budget.start_date, budget.end_date)
  const elapsed       = monthsElapsed(budget.start_date)
  const remaining_months = Math.max(1, totalMonths - elapsed)
  const remaining_budget = Math.max(0, available - (spent.net ?? 0))

  const monthly_target    = remaining_budget / remaining_months
  const critical_threshold = monthly_target * 0.85

  const { start, end } = periodBounds(currentYearMonth())
  return { budget_id: budgetId, period_start: start, period_end: end, monthly_target, critical_threshold }
}

function upsertGoal(budgetId: number): DbGoal {
  const g = computeGoal(budgetId)
  const existing = db.prepare(
    'SELECT id FROM budget_ai_goals WHERE budget_id = ? AND period_start = ?'
  ).get(budgetId, g.period_start) as { id: number } | undefined

  if (existing) {
    db.prepare(
      `UPDATE budget_ai_goals SET monthly_target=?, critical_threshold=?, recalculated_at=datetime('now')
       WHERE id = ?`
    ).run(g.monthly_target, g.critical_threshold, existing.id)
    return db.prepare('SELECT * FROM budget_ai_goals WHERE id = ?').get(existing.id) as DbGoal
  } else {
    const info = db.prepare(
      `INSERT INTO budget_ai_goals (budget_id, period_start, period_end, monthly_target, critical_threshold)
       VALUES (?, ?, ?, ?, ?)`
    ).run(g.budget_id, g.period_start, g.period_end, g.monthly_target, g.critical_threshold)
    return db.prepare('SELECT * FROM budget_ai_goals WHERE id = ?').get(info.lastInsertRowid) as DbGoal
  }
}

// ── Notification système ──────────────────────────────────────────────────────

function checkAndNotify(budgetId: number): void {
  try {
    const goal = db.prepare(
      `SELECT * FROM budget_ai_goals WHERE budget_id = ?
       ORDER BY recalculated_at DESC LIMIT 1`
    ).get(budgetId) as DbGoal | undefined
    if (!goal) return

    const { start } = periodBounds(currentYearMonth())
    const spent = db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) -
              COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as net
       FROM budget_transactions WHERE budget_id = ? AND date >= ?`
    ).get(budgetId, start) as { net: number }

    const budget = db.prepare('SELECT name, currency FROM budgets WHERE id = ?').get(budgetId) as { name: string; currency: string }
    const pct = (spent.net / goal.monthly_target) * 100

    if (pct >= 100 && Notification.isSupported()) {
      new Notification({
        title: `⚠️ Budget dépassé — ${budget.name}`,
        body: `Tu as dépassé ton objectif mensuel de ${goal.monthly_target.toFixed(0)} ${budget.currency}.`
      }).show()
    } else if (pct >= 85 && Notification.isSupported()) {
      new Notification({
        title: `🟡 Seuil critique — ${budget.name}`,
        body: `Tu as atteint ${pct.toFixed(0)}% de ton objectif mensuel.`
      }).show()
    }
  } catch { /* silencieux */ }
}

// ── Appliquer les récurrents ──────────────────────────────────────────────────

function applyRecurring(budgetId: number): number {
  const budget = db.prepare(
    'SELECT currency, display_rate, start_date, end_date FROM budgets WHERE id = ?'
  ).get(budgetId) as { currency: string; display_rate: number | null; start_date: string; end_date: string } | undefined
  if (!budget) return 0

  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // Ne rien appliquer si la période du budget n'est pas encore commencée ou déjà terminée
  if (todayStr < budget.start_date || todayStr > budget.end_date) return 0

  const recurrings = db.prepare(
    'SELECT * FROM budget_recurring WHERE budget_id = ? AND active = 1'
  ).all(budgetId) as DbRecurring[]

  let applied = 0

  for (const r of recurrings) {
    if (r.recurrence_type === 'monthly') {
      const ym = currentYearMonth()
      if (r.last_applied === ym) continue
      const dayNow = today.getDate()
      if (dayNow < r.recurrence_day) continue

      // Convertir si nécessaire
      let amount_base = r.amount
      if (r.currency !== budget.currency && budget.display_rate) {
        amount_base = r.amount / budget.display_rate
      }

      const dateStr = `${ym}-${String(r.recurrence_day).padStart(2, '0')}`
      db.prepare(
        `INSERT INTO budget_transactions
         (budget_id, category_id, label, amount, currency, amount_base, date, is_recurring, recurring_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
      ).run(budgetId, r.category_id, r.label, r.amount, r.currency, amount_base, dateStr, r.id)

      db.prepare('UPDATE budget_recurring SET last_applied = ? WHERE id = ?').run(ym, r.id)
      applied++
    } else if (r.recurrence_type === 'weekly') {
      const iw = currentISOWeek()
      if (r.last_applied === iw) continue
      const dayOfWeek = (today.getDay() + 6) % 7 // 0=lun…6=dim
      if (dayOfWeek < r.recurrence_day) continue

      let amount_base = r.amount
      if (r.currency !== budget.currency && budget.display_rate) {
        amount_base = r.amount / budget.display_rate
      }

      db.prepare(
        `INSERT INTO budget_transactions
         (budget_id, category_id, label, amount, currency, amount_base, date, is_recurring, recurring_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
      ).run(budgetId, r.category_id, r.label, r.amount, r.currency, amount_base, todayStr, r.id)

      db.prepare('UPDATE budget_recurring SET last_applied = ? WHERE id = ?').run(iw, r.id)
      applied++
    }
  }
  return applied
}

// ── Handler IA pour analyse budget ───────────────────────────────────────────

async function fetchAiAnalysis(budgetId: number): Promise<string> {
  const settings = getSettings()
  const provider  = settings.ai?.provider ?? 'openai'
  const model     = settings.ai?.model ?? 'gpt-4o-mini'

  const budget  = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId) as DbBudget | undefined
  if (!budget) return 'Budget introuvable.'

  const extras = db.prepare('SELECT * FROM budget_extra_items WHERE budget_id = ?').all(budgetId) as DbExtra[]
  const goal   = db.prepare('SELECT * FROM budget_ai_goals WHERE budget_id = ? ORDER BY recalculated_at DESC LIMIT 1').get(budgetId) as DbGoal | undefined

  const txRows = db.prepare(
    `SELECT t.date, t.amount_base, t.is_revenue, c.name as cat
     FROM budget_transactions t
     LEFT JOIN budget_categories c ON t.category_id = c.id
     WHERE t.budget_id = ? ORDER BY t.date DESC LIMIT 50`
  ).all(budgetId) as { date: string; amount_base: number; is_revenue: number; cat: string | null }[]

  const { start } = periodBounds(currentYearMonth())
  const periodSpent = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) as s
     FROM budget_transactions WHERE budget_id = ? AND date >= ?`
  ).get(budgetId, start) as { s: number }

  const extraTotal = extras.reduce((a, e) => a + e.amount, 0)
  const available  = budget.total_amount - extraTotal
  const totalMonths = monthsBetween(budget.start_date, budget.end_date)
  const elapsed     = monthsElapsed(budget.start_date)
  const remaining_m = Math.max(1, totalMonths - elapsed)

  const totalSpent = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) -
            COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as net
     FROM budget_transactions WHERE budget_id = ?`
  ).get(budgetId) as { net: number }

  const prompt = `Tu es un conseiller financier. Analyse ce budget et donne des conseils pratiques en français.

## Budget : ${budget.name}
- Total : ${budget.total_amount} ${budget.currency}
- Période : ${budget.start_date} → ${budget.end_date} (${totalMonths} mois, ${elapsed} écoulés, ${remaining_m} restants)
- Hors-budget : ${extras.map(e => `${e.label} ${e.amount}${budget.currency}`).join(', ') || 'aucun'} (total: ${extraTotal}${budget.currency})
- Budget disponible (après hors-budget) : ${available.toFixed(2)} ${budget.currency}
- Dépensé au total : ${(totalSpent.net ?? 0).toFixed(2)} ${budget.currency}
- Restant total : ${(available - (totalSpent.net ?? 0)).toFixed(2)} ${budget.currency}
- Objectif mensuel calculé : ${goal ? goal.monthly_target.toFixed(2) : 'non calculé'} ${budget.currency}
- Seuil critique : ${goal ? goal.critical_threshold.toFixed(2) : 'non calculé'} ${budget.currency}
- Dépenses ce mois-ci : ${periodSpent.s.toFixed(2)} ${budget.currency}

## 30 dernières transactions
${txRows.slice(0, 30).map(t => `- ${t.date} | ${t.is_revenue ? '+' : '-'}${t.amount_base.toFixed(2)}${budget.currency} | ${t.cat ?? 'Sans catégorie'}`).join('\n')}

Donne une analyse structurée avec :
1. Résumé de la situation actuelle (2-3 phrases)
2. Points positifs
3. Points d'attention ou risques
4. Conseils concrets pour rester dans le budget
5. Prévision si le rythme actuel continue`

  const apiMessages = [{ role: 'user' as const, content: prompt }]

  return new Promise((resolve) => {
    let result = ''
    const onLine = (line: string): void => {
      if (provider === 'openai') {
        if (!line.startsWith('data: ')) return
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try { result += JSON.parse(data).choices?.[0]?.delta?.content ?? '' } catch { /* */ }
      } else if (provider === 'anthropic') {
        if (!line.startsWith('data: ')) return
        try {
          const chunk = JSON.parse(line.slice(6).trim())
          if (chunk.type === 'content_block_delta') result += chunk.delta?.text ?? ''
        } catch { /* */ }
      } else {
        const t = line.trim()
        if (t) try { result += JSON.parse(t).message?.content ?? '' } catch { /* */ }
      }
    }

    const finish = (): void => resolve(result || 'Analyse indisponible.')

    try {
      if (provider === 'openai') {
        const key = getApiKey('openai')
        if (!key) { resolve('Clé OpenAI manquante.'); return }
        streamPost('https://api.openai.com/v1/chat/completions',
          { Authorization: `Bearer ${key}` },
          { model, messages: apiMessages, stream: true },
          onLine, finish
        )
      } else if (provider === 'anthropic') {
        const key = getApiKey('anthropic')
        if (!key) { resolve('Clé Anthropic manquante.'); return }
        streamPost('https://api.anthropic.com/v1/messages',
          { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          { model, messages: apiMessages, max_tokens: 1024, stream: true },
          onLine, finish
        )
      } else {
        streamPost('http://localhost:11434/api/chat', {},
          { model, messages: apiMessages, stream: true },
          onLine, finish
        )
      }
    } catch { resolve('Erreur lors de l\'analyse IA.') }
  })
}

function streamPost(
  url: string, headers: Record<string, string>, body: object,
  onLine: (line: string) => void, onEnd: () => void
): void {
  const parsed  = new URL(url)
  const isHttps = parsed.protocol === 'https:'
  const mod     = isHttps ? https : require('http') as typeof https
  const bodyStr = JSON.stringify(body)

  const req = mod.request({
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + (parsed.search || ''),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers }
  }, (res) => {
    let buf = ''
    res.on('data', (c: Buffer) => {
      buf += c.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const l of lines) onLine(l)
    })
    res.on('end', () => { if (buf) onLine(buf); onEnd() })
    res.on('error', onEnd)
  })
  req.on('error', onEnd)
  req.write(bodyStr)
  req.end()
}

// ── Checkup mensuel ───────────────────────────────────────────────────────────

function runMonthlyCheckup(budgetId: number, month: string): DbCheckup | null {
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId) as DbBudget | undefined
  if (!budget) return null

  const { start: mStart, end: mEnd } = periodBounds(month)

  // Calcul du rollover : somme des enveloppes non-atteintes
  const envelopes = db.prepare(
    'SELECT * FROM budget_category_limits WHERE budget_id = ?'
  ).all(budgetId) as DbCategoryLimit[]

  let rollover_amount = 0
  for (const env of envelopes) {
    const spent = db.prepare(
      `SELECT COALESCE(SUM(amount_base), 0) as s
       FROM budget_transactions
       WHERE budget_id = ? AND category_id = ? AND date >= ? AND date <= ? AND is_revenue = 0`
    ).get(budgetId, env.category_id, mStart, mEnd) as { s: number }
    rollover_amount += Math.max(0, env.monthly_limit - spent.s)
  }

  // Insérer le checkup (IGNORE si déjà existant)
  db.prepare(
    `INSERT OR IGNORE INTO budget_monthly_checkups (budget_id, month, rollover_amount)
     VALUES (?, ?, ?)`
  ).run(budgetId, month, rollover_amount)

  return db.prepare(
    'SELECT * FROM budget_monthly_checkups WHERE budget_id = ? AND month = ?'
  ).get(budgetId, month) as DbCheckup
}

function autoCheckupIfDue(budgetId: number): void {
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId) as DbBudget | undefined
  if (!budget) return

  const today    = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  if (todayISO < budget.start_date || todayISO > budget.end_date) return

  // Le jour du checkup = jour de démarrage du budget (ex: budget du 09.02 → checkup le 9)
  const checkupDay = parseInt(budget.start_date.split('-')[2], 10)
  if (today.getDate() < checkupDay) return

  // Mois précédent
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevYM    = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`

  // Vérifier que le mois précédent est dans la période du budget
  const { end: prevEnd } = periodBounds(prevYM)
  if (prevEnd < budget.start_date) return

  // Ne pas refaire si déjà fait
  const existing = db.prepare(
    'SELECT id FROM budget_monthly_checkups WHERE budget_id = ? AND month = ?'
  ).get(budgetId, prevYM) as { id: number } | undefined
  if (existing) return

  runMonthlyCheckup(budgetId, prevYM)
}

// ── Construction du résumé ────────────────────────────────────────────────────

function buildSummary(budgetId: number) {
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId) as DbBudget | undefined
  if (!budget) return null

  // ── Extras (dépenses fixes uniques) ──────────────────────────────────────
  const extra_items = db.prepare(
    'SELECT * FROM budget_extra_items WHERE budget_id = ? ORDER BY planned_date'
  ).all(budgetId) as DbExtra[]
  const extra_total     = extra_items.reduce((a, e) => a + e.amount, 0)
  const available_amount = budget.total_amount - extra_total   // compat ancienne logique

  const total_months    = monthsBetween(budget.start_date, budget.end_date)
  const months_elapsed  = monthsElapsed(budget.start_date)
  const months_remaining = Math.max(0, total_months - months_elapsed)

  const { start, end } = periodBounds(currentYearMonth())

  // ── Récurrents : abonnements (is_revenue=0) + sources de revenus (is_revenue=1) ──
  const recurringRows = db.prepare(
    `SELECT r.*, c.name as category_name, c.color as category_color, c.icon as category_icon
     FROM budget_recurring r
     LEFT JOIN budget_categories c ON r.category_id = c.id
     WHERE r.budget_id = ? AND r.active = 1`
  ).all(budgetId) as (DbRecurring & { category_name: string | null; category_color: string | null; category_icon: string | null })[]

  const allRecurring = recurringRows.map((r) => {
    let amount_base_monthly = r.amount
    if (r.currency !== budget.currency && budget.display_rate) {
      amount_base_monthly = r.amount / budget.display_rate
    }
    return { ...r, amount_base_monthly }
  })

  const expense_recurring_items = allRecurring.filter((r) => !r.is_revenue)
  const revenue_items           = allRecurring.filter((r) => !!r.is_revenue)
  const expense_recurring_monthly = expense_recurring_items.reduce((a, r) => a + r.amount_base_monthly, 0)
  const revenue_monthly_total     = revenue_items.reduce((a, r) => a + r.amount_base_monthly, 0)

  // ── Enveloppes (budget_category_limits) ──────────────────────────────────
  const envelopeRows = db.prepare(
    `SELECT cl.*, c.name as category_name, c.color as category_color, c.icon as category_icon
     FROM budget_category_limits cl
     JOIN budget_categories c ON cl.category_id = c.id
     WHERE cl.budget_id = ?`
  ).all(budgetId) as (DbCategoryLimit & { category_name: string; category_color: string; category_icon: string })[]

  const envelope_items = envelopeRows.map((env) => {
    const spent = db.prepare(
      `SELECT COALESCE(SUM(amount_base), 0) as s
       FROM budget_transactions
       WHERE budget_id = ? AND category_id = ? AND date >= ? AND date <= ? AND is_revenue = 0`
    ).get(budgetId, env.category_id, start, end) as { s: number }
    return { ...env, current_month_spent: spent.s }
  })
  const envelope_monthly_total = envelope_items.reduce((a, e) => a + e.monthly_limit, 0)

  // ── Calculs budget ────────────────────────────────────────────────────────
  // Budget total réel = lump sum + revenus récurrents sur toute la durée
  const total_budget_available = budget.total_amount + revenue_monthly_total * total_months

  // Montant planifié = fixes + abonnements × mois + enveloppes × mois
  const planned_total = extra_total
    + expense_recurring_monthly * total_months
    + envelope_monthly_total    * total_months

  const marge_libre  = total_budget_available - planned_total
  const savings_goal = budget.savings_goal ?? 0
  const reserve      = marge_libre * savings_goal / 100
  const budget_libre = marge_libre * (1 - savings_goal / 100)
  const budget_libre_monthly = total_months > 0 ? budget_libre / total_months : 0

  // ── Cagnotte cumulative (budget libre accumulé sur les mois écoulés) ─────
  let cumulative_budget_libre = 0
  for (let m = 0; m < months_elapsed; m++) {
    const md = new Date(budget.start_date)
    md.setMonth(md.getMonth() + m)
    const ym = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}`
    const { start: ms, end: me } = periodBounds(ym)
    cumulative_budget_libre += budget_libre_monthly
    for (const env of envelopeRows) {
      const sp = db.prepare(
        `SELECT COALESCE(SUM(amount_base), 0) as s
         FROM budget_transactions
         WHERE budget_id = ? AND category_id = ? AND date >= ? AND date <= ? AND is_revenue = 0`
      ).get(budgetId, env.category_id, ms, me) as { s: number }
      cumulative_budget_libre += Math.max(0, env.monthly_limit - sp.s)
    }
  }

  // ── Agrégats transactions (compat ancienne logique) ───────────────────────
  const agg = db.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) as spent,
      COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as revenue
     FROM budget_transactions WHERE budget_id = ?`
  ).get(budgetId) as { spent: number; revenue: number }

  const periodAgg = db.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) as spent,
      COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as revenue
     FROM budget_transactions WHERE budget_id = ? AND date >= ? AND date <= ?`
  ).get(budgetId, start, end) as { spent: number; revenue: number }

  const net_spent       = agg.spent - agg.revenue
  const total_remaining = available_amount - net_spent

  const goal = db.prepare(
    'SELECT * FROM budget_ai_goals WHERE budget_id = ? ORDER BY recalculated_at DESC LIMIT 1'
  ).get(budgetId) as DbGoal | undefined

  const display_remaining    = (budget.display_currency && budget.display_rate) ? total_remaining * budget.display_rate : null
  const display_period_spent = (budget.display_currency && budget.display_rate) ? (periodAgg.spent - periodAgg.revenue) * budget.display_rate : null

  const monthly_goal           = goal?.monthly_target ?? (months_remaining > 0 ? available_amount / total_months : 0)
  const expected_spent_to_date = monthly_goal * months_elapsed
  const savings                = Math.max(0, expected_spent_to_date - net_spent)
  const display_savings        = (budget.display_currency && budget.display_rate && savings > 0) ? savings * budget.display_rate : null

  const todayISO  = new Date().toISOString().slice(0, 10)
  const dayAgg    = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) as spent,
            COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as revenue
     FROM budget_transactions WHERE budget_id = ? AND date = ?`
  ).get(budgetId, todayISO) as { spent: number; revenue: number }
  const day_spent = dayAgg.spent - dayAgg.revenue

  const dayOfWeek   = (new Date().getDay() + 6) % 7
  const weekStartDt = new Date(); weekStartDt.setDate(weekStartDt.getDate() - dayOfWeek)
  const week_start  = weekStartDt.toISOString().slice(0, 10)
  const weekAgg     = db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) as spent,
            COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as revenue
     FROM budget_transactions WHERE budget_id = ? AND date >= ? AND date <= ?`
  ).get(budgetId, week_start, todayISO) as { spent: number; revenue: number }
  const week_spent = weekAgg.spent - weekAgg.revenue

  // ── Checkup en attente ────────────────────────────────────────────────────
  const pending_checkup = db.prepare(
    'SELECT * FROM budget_monthly_checkups WHERE budget_id = ? AND acknowledged = 0 ORDER BY month DESC LIMIT 1'
  ).get(budgetId) as DbCheckup | null

  return {
    budget, extra_items, extra_total, available_amount,
    total_spent: agg.spent, total_revenue: agg.revenue, net_spent, total_remaining,
    months_count: total_months, months_elapsed, months_remaining,
    current_period_start: start, current_period_end: end,
    current_period_spent: periodAgg.spent, current_period_revenue: periodAgg.revenue,
    goal: goal ?? null, display_remaining, display_period_spent,
    savings, display_savings, monthly_goal,
    day_spent, week_spent, week_start,
    // Nouveaux champs
    expense_recurring_items, revenue_items, envelope_items,
    expense_recurring_monthly, revenue_monthly_total, envelope_monthly_total,
    total_budget_available, planned_total, marge_libre,
    savings_goal, reserve, budget_libre, budget_libre_monthly,
    cumulative_budget_libre,
    pending_checkup: pending_checkup ?? null,
    // Compat (certains endroits utilisaient encore ces champs)
    recurring_items: expense_recurring_items,
    recurring_monthly_total: expense_recurring_monthly,
  }
}

// ── Enregistrement des handlers IPC ──────────────────────────────────────────

export function registerBudgetHandlers(): void {

  // ── BUDGETS CRUD ────────────────────────────────────────────────────────────

  ipcMain.handle('budget:list', () =>
    db.prepare('SELECT * FROM budgets ORDER BY created_at DESC').all()
  )

  ipcMain.handle('budget:create', async (_event, payload: {
    name: string; total_amount: number; currency: string
    display_currency: string | null; start_date: string; end_date: string
  }) => {
    let display_rate: number | null = null
    let display_rate_updated_at: string | null = null

    if (payload.display_currency && payload.display_currency !== payload.currency) {
      try {
        display_rate = await fetchRate(payload.currency, payload.display_currency)
        display_rate_updated_at = new Date().toISOString()
      } catch { /* taux non disponible */ }
    }

    const info = db.prepare(
      `INSERT INTO budgets (name, total_amount, currency, display_currency, display_rate, display_rate_updated_at, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(payload.name, payload.total_amount, payload.currency,
          payload.display_currency, display_rate, display_rate_updated_at,
          payload.start_date, payload.end_date)

    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(info.lastInsertRowid) as DbBudget
    upsertGoal(budget.id)
    return budget
  })

  ipcMain.handle('budget:update', async (_event, { id, ...payload }: {
    id: number; name?: string; total_amount?: number; currency?: string
    display_currency?: string | null; start_date?: string; end_date?: string
    savings_goal?: number; checkup_day?: number
  }) => {
    const existing = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as DbBudget
    if (!existing) return null

    const updated = { ...existing, ...payload }

    if (payload.display_currency && payload.display_currency !== updated.currency) {
      try {
        updated.display_rate = await fetchRate(updated.currency, payload.display_currency)
        updated.display_rate_updated_at = new Date().toISOString()
      } catch { /* */ }
    } else if (payload.display_currency === null) {
      updated.display_rate = null
      updated.display_rate_updated_at = null
    }

    db.prepare(
      `UPDATE budgets SET name=?, total_amount=?, currency=?, display_currency=?,
       display_rate=?, display_rate_updated_at=?, start_date=?, end_date=?,
       savings_goal=?, checkup_day=? WHERE id=?`
    ).run(updated.name, updated.total_amount, updated.currency, updated.display_currency,
          updated.display_rate, updated.display_rate_updated_at, updated.start_date, updated.end_date,
          updated.savings_goal ?? 0, updated.checkup_day ?? 6, id)

    upsertGoal(id)
    return db.prepare('SELECT * FROM budgets WHERE id = ?').get(id)
  })

  ipcMain.handle('budget:delete', (_event, id: number) => {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('budget:summary', (_event, id: number) => {
    autoCheckupIfDue(id)
    return buildSummary(id)
  })

  ipcMain.handle('budget:checkup:detail', (_event, { budgetId, month }: { budgetId: number; month: string }) => {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId) as DbBudget | undefined
    if (!budget) return null
    const checkup = db.prepare(
      'SELECT * FROM budget_monthly_checkups WHERE budget_id = ? AND month = ?'
    ).get(budgetId, month) as DbCheckup | undefined
    if (!checkup) return null

    const { start: mStart, end: mEnd } = periodBounds(month)

    // Revenus reçus ce mois (transactions is_revenue=1)
    const revRow = db.prepare(
      `SELECT COALESCE(SUM(amount_base),0) as s FROM budget_transactions
       WHERE budget_id = ? AND date >= ? AND date <= ? AND is_revenue = 1`
    ).get(budgetId, mStart, mEnd) as { s: number }

    // Abonnements payés ce mois (transactions is_revenue=0)
    const expRow = db.prepare(
      `SELECT COALESCE(SUM(amount_base),0) as s FROM budget_transactions
       WHERE budget_id = ? AND date >= ? AND date <= ? AND is_revenue = 0`
    ).get(budgetId, mStart, mEnd) as { s: number }

    // Détail par enveloppe
    const envelopes = db.prepare(
      `SELECT cl.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM budget_category_limits cl JOIN budget_categories c ON cl.category_id = c.id
       WHERE cl.budget_id = ?`
    ).all(budgetId) as (DbCategoryLimit & { category_name: string; category_color: string; category_icon: string })[]

    const envelope_details = envelopes.map((env) => {
      const sp = db.prepare(
        `SELECT COALESCE(SUM(amount_base),0) as s FROM budget_transactions
         WHERE budget_id = ? AND category_id = ? AND date >= ? AND date <= ? AND is_revenue = 0`
      ).get(budgetId, env.category_id, mStart, mEnd) as { s: number }
      return {
        category_name:  env.category_name,
        category_icon:  env.category_icon,
        category_color: env.category_color,
        budget:  env.monthly_limit,
        spent:   sp.s,
        rollover: Math.max(0, env.monthly_limit - sp.s),
      }
    })

    const monthLabel = new Date(`${month}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    return {
      checkup,
      month_label:         monthLabel,
      revenue_received:    revRow.s,
      expenses_paid:       expRow.s,
      envelope_details,
      total_rollover:      checkup.rollover_amount,
      budget_libre_this_month: 0,  // calculé côté frontend si besoin
    }
  })

  ipcMain.handle('budget:checkup:acknowledge', (_event, id: number) => {
    db.prepare('UPDATE budget_monthly_checkups SET acknowledged = 1 WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('budget:widgetData', () => {
    const budget = db.prepare('SELECT * FROM budgets ORDER BY created_at DESC LIMIT 1').get() as DbBudget | undefined
    if (!budget) return null

    const { start, end } = periodBounds(currentYearMonth())
    const agg = db.prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) -
        COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as net
       FROM budget_transactions WHERE budget_id = ? AND date >= ? AND date <= ?`
    ).get(budget.id, start, end) as { net: number }

    const totalAgg = db.prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) -
        COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as net
       FROM budget_transactions WHERE budget_id = ?`
    ).get(budget.id) as { net: number }

    const extras = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM budget_extra_items WHERE budget_id = ?').get(budget.id) as { s: number }
    const available = budget.total_amount - extras.s
    const total_remaining = available - totalAgg.net

    const goal = db.prepare('SELECT * FROM budget_ai_goals WHERE budget_id = ? ORDER BY recalculated_at DESC LIMIT 1').get(budget.id) as DbGoal | undefined

    const period_goal = goal?.monthly_target ?? available / monthsBetween(budget.start_date, budget.end_date)
    const critical_threshold = goal?.critical_threshold ?? period_goal * 0.85

    return {
      budget_id: budget.id, budget_name: budget.name, currency: budget.currency,
      display_currency: budget.display_currency, display_rate: budget.display_rate,
      period_spent: agg.net, period_goal, critical_threshold, total_remaining,
      display_remaining: (budget.display_currency && budget.display_rate) ? total_remaining * budget.display_rate : null,
      period_start: start, period_end: end,
      over_critical: agg.net >= critical_threshold
    }
  })

  // ── TRANSACTIONS ────────────────────────────────────────────────────────────

  ipcMain.handle('budget:transactions:list', (_event, budgetId: number) =>
    db.prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color
       FROM budget_transactions t
       LEFT JOIN budget_categories c ON t.category_id = c.id
       WHERE t.budget_id = ? ORDER BY t.date DESC, t.created_at DESC`
    ).all(budgetId)
  )

  ipcMain.handle('budget:transactions:add', async (_event, payload: {
    budget_id: number; category_id: number | null; label: string
    amount: number; currency: string; date: string; is_revenue: boolean
  }) => {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(payload.budget_id) as DbBudget
    if (!budget) throw new Error('Budget introuvable')

    let amount_base = payload.amount
    if (payload.currency !== budget.currency) {
      if (budget.display_rate && budget.display_currency === payload.currency) {
        amount_base = payload.amount / budget.display_rate
      } else {
        // Tenter une conversion live
        try {
          const rate = await fetchRate(payload.currency, budget.currency)
          amount_base = payload.amount * rate
        } catch { /* 1:1 fallback */ }
      }
    }

    // ── Auto-catégorisation "Préparatifs" hors période ─────────────────────
    let effectiveCategoryId = payload.category_id
    const isOutsidePeriod =
      !payload.is_revenue &&
      (payload.date < budget.start_date || payload.date > budget.end_date)

    if (isOutsidePeriod) {
      // Cherche ou crée la catégorie "Préparatifs" spécifique à ce budget
      let prepCat = db.prepare(
        `SELECT id FROM budget_categories WHERE budget_id = ? AND name = 'Préparatifs' LIMIT 1`
      ).get(payload.budget_id) as { id: number } | undefined

      if (!prepCat) {
        const ins = db.prepare(
          `INSERT INTO budget_categories (budget_id, name, color) VALUES (?, 'Préparatifs', '#6366f1')`
        ).run(payload.budget_id)
        prepCat = { id: ins.lastInsertRowid as number }
      }
      effectiveCategoryId = prepCat.id
    }

    const info = db.prepare(
      `INSERT INTO budget_transactions
       (budget_id, category_id, label, amount, currency, amount_base, date, is_revenue)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(payload.budget_id, effectiveCategoryId, payload.label,
          payload.amount, payload.currency, amount_base, payload.date,
          payload.is_revenue ? 1 : 0)

    // Recalcul objectif + notification
    upsertGoal(payload.budget_id)
    if (!payload.is_revenue) checkAndNotify(payload.budget_id)

    return db.prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color
       FROM budget_transactions t LEFT JOIN budget_categories c ON t.category_id = c.id
       WHERE t.id = ?`
    ).get(info.lastInsertRowid)
  })

  ipcMain.handle('budget:transactions:delete', (_event, id: number) => {
    const tx = db.prepare('SELECT budget_id FROM budget_transactions WHERE id = ?').get(id) as { budget_id: number } | undefined
    db.prepare('DELETE FROM budget_transactions WHERE id = ?').run(id)
    if (tx) upsertGoal(tx.budget_id)
    return true
  })

  // ── HORS-BUDGET ─────────────────────────────────────────────────────────────

  ipcMain.handle('budget:extras:list', (_event, budgetId: number) =>
    db.prepare('SELECT * FROM budget_extra_items WHERE budget_id = ? ORDER BY planned_date').all(budgetId)
  )

  ipcMain.handle('budget:extras:add', (_event, payload: {
    budget_id: number; label: string; amount: number; planned_date: string | null
  }) => {
    const info = db.prepare(
      'INSERT INTO budget_extra_items (budget_id, label, amount, planned_date) VALUES (?, ?, ?, ?)'
    ).run(payload.budget_id, payload.label, payload.amount, payload.planned_date)
    upsertGoal(payload.budget_id)
    return db.prepare('SELECT * FROM budget_extra_items WHERE id = ?').get(info.lastInsertRowid)
  })

  ipcMain.handle('budget:extras:delete', (_event, id: number) => {
    const row = db.prepare('SELECT budget_id FROM budget_extra_items WHERE id = ?').get(id) as { budget_id: number } | undefined
    db.prepare('DELETE FROM budget_extra_items WHERE id = ?').run(id)
    if (row) upsertGoal(row.budget_id)
    return true
  })

  // ── CATÉGORIES ──────────────────────────────────────────────────────────────

  ipcMain.handle('budget:categories:list', (_event, budgetId?: number) => {
    if (budgetId !== undefined) {
      return db.prepare(
        'SELECT * FROM budget_categories WHERE budget_id IS NULL OR budget_id = ? ORDER BY budget_id, name'
      ).all(budgetId)
    }
    return db.prepare('SELECT * FROM budget_categories WHERE budget_id IS NULL ORDER BY name').all()
  })

  ipcMain.handle('budget:categories:create', (_event, payload: {
    budget_id: number | null; name: string; color: string; icon: string
  }) => {
    const info = db.prepare(
      'INSERT INTO budget_categories (budget_id, name, color, icon) VALUES (?, ?, ?, ?)'
    ).run(payload.budget_id, payload.name, payload.color, payload.icon)
    return db.prepare('SELECT * FROM budget_categories WHERE id = ?').get(info.lastInsertRowid)
  })

  ipcMain.handle('budget:categories:delete', (_event, id: number) => {
    db.prepare('UPDATE budget_transactions SET category_id = NULL WHERE category_id = ?').run(id)
    db.prepare('UPDATE budget_recurring SET category_id = NULL WHERE category_id = ?').run(id)
    db.prepare('DELETE FROM budget_categories WHERE id = ?').run(id)
    return true
  })

  // ── RÉCURRENTS ──────────────────────────────────────────────────────────────

  ipcMain.handle('budget:recurring:list', (_event, budgetId: number) =>
    db.prepare('SELECT * FROM budget_recurring WHERE budget_id = ? ORDER BY label').all(budgetId)
  )

  ipcMain.handle('budget:recurring:create', (_event, payload: {
    budget_id: number; category_id: number | null; label: string
    amount: number; currency: string; recurrence_type: string; recurrence_day: number
    is_revenue?: boolean
  }) => {
    const isRevenue = payload.is_revenue ? 1 : 0
    const info = db.prepare(
      `INSERT INTO budget_recurring
       (budget_id, category_id, label, amount, currency, recurrence_type, recurrence_day, is_revenue)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(payload.budget_id, payload.category_id, payload.label,
          payload.amount, payload.currency, payload.recurrence_type, payload.recurrence_day, isRevenue)
    return db.prepare('SELECT * FROM budget_recurring WHERE id = ?').get(info.lastInsertRowid)
  })

  // ── Données mensuelles pour le graphique ────────────────────────────────────

  ipcMain.handle('budget:monthlyData', (_event, budgetId: number) => {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId) as DbBudget | undefined
    if (!budget) return []

    const totalMonths = monthsBetween(budget.start_date, budget.end_date)

    // Abonnements actifs (dépenses uniquement)
    const expRec = db.prepare(
      'SELECT * FROM budget_recurring WHERE budget_id = ? AND active = 1 AND is_revenue = 0'
    ).all(budgetId) as DbRecurring[]
    const expRecMonthly = expRec.reduce((a, r) => {
      let amt = r.amount
      if (r.currency !== budget.currency && budget.display_rate) amt = r.amount / budget.display_rate
      return a + amt
    }, 0)

    // Enveloppes
    const envRow = db.prepare(
      'SELECT COALESCE(SUM(monthly_limit), 0) as s FROM budget_category_limits WHERE budget_id = ?'
    ).get(budgetId) as { s: number }
    const plannedMonthly = expRecMonthly + envRow.s

    const todayISO = new Date().toISOString().slice(0, 10)

    const results = []
    for (let m = 0; m < totalMonths; m++) {
      const md = new Date(budget.start_date)
      md.setMonth(md.getMonth() + m)
      const ym     = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}`
      const { start: ms, end: me } = periodBounds(ym)

      const agg = db.prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) as spent,
          COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as revenue
         FROM budget_transactions WHERE budget_id = ? AND date >= ? AND date <= ?`
      ).get(budgetId, ms, me) as { spent: number; revenue: number }

      const label = new Date(`${ym}-15`).toLocaleDateString('fr-FR', { month: 'short' })
        .replace('.', '').slice(0, 4)

      results.push({
        month:            ym,
        month_label:      label.charAt(0).toUpperCase() + label.slice(1),
        planned:          plannedMonthly,
        actual:           agg.spent,
        revenue_received: agg.revenue,
        is_future:        ms > todayISO,
      })
    }
    return results
  })

  ipcMain.handle('budget:recurring:toggle', (_event, id: number) => {
    const row = db.prepare('SELECT active FROM budget_recurring WHERE id = ?').get(id) as { active: number } | undefined
    if (!row) return false
    db.prepare('UPDATE budget_recurring SET active = ? WHERE id = ?').run(row.active ? 0 : 1, id)
    return true
  })

  ipcMain.handle('budget:recurring:delete', (_event, id: number) => {
    db.prepare('DELETE FROM budget_recurring WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('budget:recurring:apply', (_event, budgetId: number) =>
    applyRecurring(budgetId)
  )

  // ── OBJECTIFS ───────────────────────────────────────────────────────────────

  ipcMain.handle('budget:goals:get', (_event, budgetId: number) =>
    db.prepare('SELECT * FROM budget_ai_goals WHERE budget_id = ? ORDER BY recalculated_at DESC LIMIT 1').get(budgetId) ?? null
  )

  ipcMain.handle('budget:goals:recalculate', (_event, budgetId: number) =>
    upsertGoal(budgetId)
  )

  ipcMain.handle('budget:goals:aiAnalysis', async (_event, budgetId: number) =>
    fetchAiAnalysis(budgetId)
  )

  // ── LIMITES PAR CATÉGORIE ───────────────────────────────────────────────────

  ipcMain.handle('budget:categoryLimits:list', (_event, budgetId: number) =>
    db.prepare(
      `SELECT cl.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM budget_category_limits cl
       JOIN budget_categories c ON cl.category_id = c.id
       WHERE cl.budget_id = ?`
    ).all(budgetId)
  )

  ipcMain.handle('budget:categoryLimits:set', (_event, payload: {
    budget_id: number; category_id: number; monthly_limit: number
  }) => {
    db.prepare(
      `INSERT INTO budget_category_limits (budget_id, category_id, monthly_limit)
       VALUES (?, ?, ?)
       ON CONFLICT(budget_id, category_id) DO UPDATE SET monthly_limit = excluded.monthly_limit`
    ).run(payload.budget_id, payload.category_id, payload.monthly_limit)
    return db.prepare(
      `SELECT cl.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM budget_category_limits cl
       JOIN budget_categories c ON cl.category_id = c.id
       WHERE cl.budget_id = ? AND cl.category_id = ?`
    ).get(payload.budget_id, payload.category_id)
  })

  ipcMain.handle('budget:categoryLimits:delete', (_event, payload: {
    budget_id: number; category_id: number
  }) => {
    db.prepare(
      'DELETE FROM budget_category_limits WHERE budget_id = ? AND category_id = ?'
    ).run(payload.budget_id, payload.category_id)
    return true
  })

  // ── DÉPENSES PAR CATÉGORIE (période courante) ────────────────────────────────

  ipcMain.handle('budget:categorySpending', (_event, budgetId: number) => {
    const { start, end } = periodBounds(currentYearMonth())

    // Toutes les catégories du budget (globales + spécifiques)
    const categories = db.prepare(
      'SELECT * FROM budget_categories WHERE budget_id IS NULL OR budget_id = ? ORDER BY name'
    ).all(budgetId) as { id: number; name: string; color: string; icon: string }[]

    // Limites définies pour ce budget
    const limits = db.prepare(
      'SELECT * FROM budget_category_limits WHERE budget_id = ?'
    ).all(budgetId) as { category_id: number; monthly_limit: number }[]
    const limitMap = new Map(limits.map(l => [l.category_id, l.monthly_limit]))

    // Dépenses par catégorie sur la période courante
    const rows = db.prepare(
      `SELECT category_id,
         COALESCE(SUM(CASE WHEN is_revenue=0 THEN amount_base ELSE 0 END),0) as spent,
         COALESCE(SUM(CASE WHEN is_revenue=1 THEN amount_base ELSE 0 END),0) as revenue
       FROM budget_transactions
       WHERE budget_id = ? AND date >= ? AND date <= ?
       GROUP BY category_id`
    ).all(budgetId, start, end) as { category_id: number | null; spent: number; revenue: number }[]
    const spendMap = new Map(rows.map(r => [r.category_id, { spent: r.spent, revenue: r.revenue }]))

    // Total non-catégorisé
    const uncategorized = spendMap.get(null) ?? { spent: 0, revenue: 0 }

    // Construire le résultat : uniquement catégories avec limite OU avec dépenses
    const result = categories
      .map(cat => {
        const spending = spendMap.get(cat.id) ?? { spent: 0, revenue: 0 }
        const monthly_limit = limitMap.get(cat.id) ?? null
        if (spending.spent === 0 && monthly_limit === null) return null
        return {
          category_id: cat.id,
          category_name: cat.name,
          category_color: cat.color,
          category_icon: cat.icon,
          spent: spending.spent,
          revenue: spending.revenue,
          monthly_limit
        }
      })
      .filter(Boolean)

    // Ajouter ligne non-catégorisé si nécessaire
    if (uncategorized.spent > 0) {
      result.push({
        category_id: null as unknown as number,
        category_name: 'Non catégorisé',
        category_color: '#94a3b8',
        category_icon: '❓',
        spent: uncategorized.spent,
        revenue: uncategorized.revenue,
        monthly_limit: null
      })
    }

    return { period_start: start, period_end: end, categories: result }
  })

  // ── WIZARD IA ───────────────────────────────────────────────────────────────

  ipcMain.handle('budget:wizard:start', (event, payload: {
    name: string; total_amount: number; currency: string
    display_currency: string | null; start_date: string; end_date: string
    destination_country: string
    trip_reason: 'studies' | 'work' | 'tourism' | 'pvt' | 'other'
    lifestyle: 'budget' | 'comfortable' | 'luxury'
    accommodation_booked: boolean; accommodation_monthly: number | null
    flight_out_paid: boolean;  flight_out_amount: number | null
    flight_return_paid: boolean; flight_return_amount: number | null
    monthly_income: number; spending_margin: number
  }) => {
    return new Promise<{ budgetId: number; ok: boolean }>((resolve) => {
      const months = monthsBetween(payload.start_date, payload.end_date)
      const theoreticalMonthly = payload.total_amount / months
      const effectiveMonthly   = Math.round(theoreticalMonthly * payload.spending_margin + payload.monthly_income)

      const REASON_LABELS: Record<string, string> = {
        studies: 'étudiant / bourse', work: 'travail', tourism: 'tourisme', pvt: 'PVT', other: 'autre'
      }
      const LIFESTYLE_LABELS: Record<string, string> = {
        budget: 'économique (konbini, auberges, transports en commun…)',
        comfortable: 'confortable (mix restaurants/konbini, chambre privée…)',
        luxury: 'luxe (restaurants, hôtels, shopping régulier…)'
      }

      const extraHints: string[] = []
      if (!payload.flight_out_paid  && payload.flight_out_amount)    extraHints.push(`billet aller ~${payload.flight_out_amount} ${payload.currency} (hors-budget)`)
      if (!payload.flight_return_paid && payload.flight_return_amount) extraHints.push(`billet retour ~${payload.flight_return_amount} ${payload.currency} (hors-budget)`)
      if (payload.accommodation_booked && payload.accommodation_monthly) extraHints.push(`loyer réservé : ${payload.accommodation_monthly} ${payload.currency}/mois`)
      if (payload.monthly_income > 0) extraHints.push(`revenu mensuel prévu : ${payload.monthly_income} ${payload.currency}`)

      const prompt = `Tu es un expert en budgets de voyage. Configure un budget complet en JSON strict.

## Contexte
- Voyage : ${REASON_LABELS[payload.trip_reason]} en ${payload.destination_country}
- Budget total : ${payload.total_amount} ${payload.currency} pour ${months} mois (${payload.start_date} → ${payload.end_date})
- Style de vie : ${LIFESTYLE_LABELS[payload.lifestyle]}
- Marge choisie : ${Math.round(payload.spending_margin * 100)}% du budget mensuel théorique
- Budget mensuel effectif : ~${effectiveMonthly} ${payload.currency}/mois
${extraHints.length ? '- ' + extraHints.join('\n- ') : ''}

## Instructions
1. Écris 2-3 phrases d'analyse (faisabilité, points clés pour ce pays/style de vie).
2. Génère le JSON ci-dessous EXACTEMENT, adapté au pays et au style de vie.
   - Les noms de catégories DOIVENT être parmi : Logement, Nourriture, Transport, Loisirs, Santé, Shopping, Voyages, Abonnements, Autre
   - Les montants en ${payload.currency} doivent totaliser ≤ ${effectiveMonthly} ${payload.currency}/mois
   - "recurring" = charges mensuelles fixes (loyer, SIM, abonnements…)
   - "extras" = dépenses exceptionnelles une fois (billets, visa, assurance…)

\`\`\`json
{
  "monthly_target": <entier>,
  "category_limits": [
    {"name": "<catégorie>", "monthly_limit": <entier>, "icon": "<emoji>", "color": "<hex>"}
  ],
  "recurring": [
    {"label": "<label précis>", "amount": <nombre>, "currency": "${payload.currency}", "category_name": "<catégorie>", "recurrence_type": "monthly", "recurrence_day": 1}
  ],
  "extras": [
    {"label": "<label précis>", "amount": <nombre>, "planned_date": null}
  ]
}
\`\`\``

      const settings = getSettings()
      const provider  = settings.ai?.provider ?? 'openai'
      const model     = settings.ai?.model    ?? 'gpt-4o-mini'

      let fullText = ''
      const sendChunk = (chunk: string): void => {
        fullText += chunk
        try { event.sender.send('budget:wizard:chunk', chunk) } catch { /* */ }
      }

      const onLine = (line: string): void => {
        let chunk = ''
        if (provider === 'openai') {
          if (!line.startsWith('data: ')) return
          const d = line.slice(6).trim()
          if (d === '[DONE]') return
          try { chunk = JSON.parse(d).choices?.[0]?.delta?.content ?? '' } catch { /* */ }
        } else if (provider === 'anthropic') {
          if (!line.startsWith('data: ')) return
          try {
            const c = JSON.parse(line.slice(6).trim())
            if (c.type === 'content_block_delta') chunk = c.delta?.text ?? ''
          } catch { /* */ }
        } else {
          const t = line.trim()
          if (t) try { chunk = JSON.parse(t).message?.content ?? '' } catch { /* */ }
        }
        if (chunk) sendChunk(chunk)
      }

      const onEnd = async (): Promise<void> => {
        type WizardConfig = {
          monthly_target?: number
          category_limits?: { name: string; monthly_limit: number; icon: string; color: string }[]
          recurring?: { label: string; amount: number; currency: string; category_name: string; recurrence_type: 'monthly' | 'weekly'; recurrence_day: number }[]
          extras?: { label: string; amount: number; planned_date: string | null }[]
        }
        let config: WizardConfig | null = null
        const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/)
        if (jsonMatch) {
          try { config = JSON.parse(jsonMatch[1].trim()) } catch { /* JSON invalide */ }
        }

        // Taux de change
        let display_rate: number | null = null
        if (payload.display_currency && payload.display_currency !== payload.currency) {
          try { display_rate = await fetchRate(payload.currency, payload.display_currency) } catch { /* */ }
        }

        // Créer le budget
        const info = db.prepare(
          `INSERT INTO budgets (name, total_amount, currency, display_currency, display_rate, display_rate_updated_at, start_date, end_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(payload.name, payload.total_amount, payload.currency,
              payload.display_currency, display_rate,
              display_rate ? new Date().toISOString() : null,
              payload.start_date, payload.end_date)
        const budgetId = Number(info.lastInsertRowid)

        if (config) {
          const globalCats = db.prepare('SELECT * FROM budget_categories WHERE budget_id IS NULL').all() as DbCategory[]
          const catByName  = new Map(globalCats.map(c => [c.name.toLowerCase(), c]))
          const catIdMap   = new Map<string, number>()

          for (const cl of config.category_limits ?? []) {
            const key = cl.name.toLowerCase()
            let catId: number
            if (catByName.has(key)) {
              catId = catByName.get(key)!.id
            } else {
              const ci = db.prepare(
                'INSERT INTO budget_categories (budget_id, name, color, icon) VALUES (?, ?, ?, ?)'
              ).run(budgetId, cl.name, cl.color ?? '#6985B5', cl.icon ?? '💳')
              catId = Number(ci.lastInsertRowid)
            }
            catIdMap.set(key, catId)
            db.prepare(
              `INSERT INTO budget_category_limits (budget_id, category_id, monthly_limit)
               VALUES (?, ?, ?)
               ON CONFLICT(budget_id, category_id) DO UPDATE SET monthly_limit = excluded.monthly_limit`
            ).run(budgetId, catId, cl.monthly_limit)
          }

          for (const r of config.recurring ?? []) {
            const catKey = r.category_name?.toLowerCase() ?? ''
            const catId  = catIdMap.get(catKey) ?? catByName.get(catKey)?.id ?? null
            db.prepare(
              `INSERT INTO budget_recurring (budget_id, category_id, label, amount, currency, recurrence_type, recurrence_day)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(budgetId, catId, r.label, r.amount, r.currency ?? payload.currency,
                  r.recurrence_type ?? 'monthly', r.recurrence_day ?? 1)
          }

          for (const e of config.extras ?? []) {
            db.prepare(
              'INSERT INTO budget_extra_items (budget_id, label, amount, planned_date) VALUES (?, ?, ?, ?)'
            ).run(budgetId, e.label, e.amount, e.planned_date ?? null)
          }

          upsertGoal(budgetId)
          if (config.monthly_target && config.monthly_target > 0) {
            db.prepare(
              `UPDATE budget_ai_goals SET monthly_target = ?, critical_threshold = ? WHERE budget_id = ?`
            ).run(config.monthly_target, config.monthly_target * 0.85, budgetId)
          }
        } else {
          upsertGoal(budgetId)
        }

        try { event.sender.send('budget:wizard:done', { budgetId }) } catch { /* */ }
        resolve({ budgetId, ok: true })
      }

      if (provider === 'openai') {
        const key = getApiKey('openai')
        if (!key) { sendChunk('⚠️ Clé OpenAI manquante dans les paramètres.'); void onEnd(); return }
        streamPost('https://api.openai.com/v1/chat/completions',
          { Authorization: `Bearer ${key}` },
          { model, messages: [{ role: 'user', content: prompt }], stream: true },
          onLine, () => void onEnd())
      } else if (provider === 'anthropic') {
        const key = getApiKey('anthropic')
        if (!key) { sendChunk('⚠️ Clé Anthropic manquante dans les paramètres.'); void onEnd(); return }
        streamPost('https://api.anthropic.com/v1/messages',
          { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          { model, messages: [{ role: 'user', content: prompt }], max_tokens: 2048, stream: true },
          onLine, () => void onEnd())
      } else {
        // Ollama
        streamPost('http://localhost:11434/api/chat', {},
          { model, messages: [{ role: 'user', content: prompt }], stream: true },
          onLine, () => void onEnd())
      }
    })
  })

  // ── TAUX DE CHANGE ──────────────────────────────────────────────────────────

  ipcMain.handle('budget:rate:refresh', async (_event, budgetId: number) => {
    const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId) as DbBudget | undefined
    if (!budget?.display_currency || budget.display_currency === budget.currency) return null

    const rate = await fetchRate(budget.currency, budget.display_currency)
    const now  = new Date().toISOString()
    db.prepare('UPDATE budgets SET display_rate = ?, display_rate_updated_at = ? WHERE id = ?').run(rate, now, budgetId)
    return { rate, updated_at: now }
  })
}
