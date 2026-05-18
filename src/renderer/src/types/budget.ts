// ── Types Budget ──────────────────────────────────────────────────────────────

export type AppBudget = {
  id: number
  name: string
  total_amount: number
  currency: string                   // devise de base (ex: CHF)
  display_currency: string | null    // devise d'affichage (ex: JPY)
  display_rate: number | null        // taux base→display (ex: 165.5)
  display_rate_updated_at: string | null
  start_date: string                 // YYYY-MM-DD
  end_date: string                   // YYYY-MM-DD
  created_at: string
  savings_goal: number               // 0-100 : % de réserve sur la marge libre
  checkup_day: number                // jour du mois pour le checkup (défaut: 6)
  last_checkup_month: string | null  // YYYY-MM du dernier checkup
}

export type BudgetExtraItem = {
  id: number
  budget_id: number
  label: string
  amount: number                     // en devise de base
  planned_date: string | null        // YYYY-MM-DD
  created_at: string
}

export type BudgetCategory = {
  id: number
  budget_id: number | null           // null = catégorie globale (prédéfinie)
  name: string
  color: string                      // hex
  icon: string                       // nom emoji ou lucide
}

export type BudgetTransaction = {
  id: number
  budget_id: number
  category_id: number | null
  category_name: string | null
  category_color: string | null
  label: string
  amount: number                     // montant dans la devise saisie
  currency: string                   // devise de saisie
  amount_base: number                // converti en devise de base du budget
  date: string                       // YYYY-MM-DD
  is_revenue: number                 // 0 = dépense, 1 = revenu
  is_recurring: number
  recurring_id: number | null
  created_at: string
}

export type BudgetRecurring = {
  id: number
  budget_id: number
  category_id: number | null
  label: string
  amount: number
  currency: string
  recurrence_type: 'monthly' | 'weekly'
  recurrence_day: number             // jour du mois (1-31) ou semaine (0=lun…6=dim)
  active: number
  last_applied: string | null        // YYYY-MM ou YYYY-WW
  is_revenue: number                 // 0 = abonnement (dépense), 1 = source de revenu
}

// Version enrichie retournée dans BudgetSummary (avec montant converti en devise de base)
export type BudgetRecurringSummary = BudgetRecurring & {
  amount_base_monthly: number        // montant mensuel converti en devise de base
  category_name:  string | null
  category_color: string | null
  category_icon:  string | null
}

// Enveloppe mensuelle par catégorie (budget_category_limits enrichi)
export type BudgetEnvelopeItem = {
  id: number
  budget_id: number
  category_id: number
  monthly_limit: number              // montant prévu / mois
  current_month_spent: number        // dépensé ce mois dans cette catégorie
  category_name:  string
  category_color: string
  category_icon:  string
}

// Checkup mensuel
export type BudgetCheckup = {
  id: number
  budget_id: number
  month: string                      // YYYY-MM
  rollover_amount: number
  acknowledged: number
  created_at: string
}

export type BudgetCheckupDetail = {
  checkup: BudgetCheckup
  month_label: string
  revenue_received: number
  expenses_paid: number
  envelope_details: Array<{
    category_name:  string
    category_icon:  string
    category_color: string
    budget:  number
    spent:   number
    rollover: number
  }>
  total_rollover: number
  budget_libre_this_month: number
}

export type BudgetGoal = {
  id: number
  budget_id: number
  period_start: string               // YYYY-MM-DD
  period_end: string
  monthly_target: number             // objectif mensuel calculé
  critical_threshold: number         // seuil critique
  recalculated_at: string
}

// ── Payloads de création ──────────────────────────────────────────────────────

export type CreateBudgetPayload = {
  name: string
  total_amount: number
  currency: string
  display_currency: string | null
  start_date: string
  end_date: string
  savings_goal?: number
}

export type NewTransactionPayload = {
  budget_id: number
  category_id: number | null
  label: string
  amount: number
  currency: string
  date: string
  is_revenue: boolean
}

export type NewExtraPayload = {
  budget_id: number
  label: string
  amount: number
  planned_date: string | null
}

export type NewCategoryPayload = {
  budget_id: number | null
  name: string
  color: string
  icon: string
}

export type NewRecurringPayload = {
  budget_id: number
  category_id: number | null
  label: string
  amount: number
  currency: string
  recurrence_type: 'monthly' | 'weekly'
  recurrence_day: number
  is_revenue?: boolean
}

// ── Données agrégées ──────────────────────────────────────────────────────────

export type BudgetSummary = {
  budget: AppBudget
  extra_items: BudgetExtraItem[]
  extra_total: number                // somme des hors-budget
  available_amount: number           // total - extra_total
  total_spent: number                // toutes dépenses depuis le début
  total_revenue: number
  net_spent: number                  // total_spent - total_revenue
  total_remaining: number            // available_amount - net_spent
  months_count: number               // durée totale du budget en mois
  months_elapsed: number             // mois écoulés
  months_remaining: number
  current_period_start: string       // début du mois courant
  current_period_end: string         // fin du mois courant
  current_period_spent: number       // dépenses du mois courant
  current_period_revenue: number
  goal: BudgetGoal | null
  // En devise d'affichage (si display_currency est défini)
  display_remaining: number | null
  display_period_spent: number | null
  // Cagnotte (économies vs objectif)
  savings: number
  display_savings: number | null
  monthly_goal: number
  // Vues par période
  day_spent: number
  week_spent: number
  week_start: string
  // ── Vue d'ensemble ────────────────────────────────────────────────────────
  expense_recurring_items: BudgetRecurringSummary[]   // abonnements (dépenses)
  revenue_items:           BudgetRecurringSummary[]   // sources de revenus
  envelope_items:          BudgetEnvelopeItem[]       // enveloppes par catégorie
  expense_recurring_monthly: number   // total abonnements / mois
  revenue_monthly_total:     number   // total revenus récurrents / mois
  envelope_monthly_total:    number   // total enveloppes / mois
  total_budget_available:    number   // budget_initial + revenus × months
  planned_total:             number   // tout ce qui est planifié
  marge_libre:               number   // total_budget_available - planned_total
  savings_goal:              number   // 0-100 (% de réserve)
  reserve:                   number   // marge_libre × savings_goal / 100
  budget_libre:              number   // marge_libre × (1 - savings_goal / 100)
  budget_libre_monthly:      number   // budget_libre / months_count
  cumulative_budget_libre:   number   // cagnotte accumulée sur les mois écoulés
  pending_checkup:           BudgetCheckup | null
  // compat
  recurring_items:           BudgetRecurringSummary[]
  recurring_monthly_total:   number
}

// Limite mensuelle par catégorie
export type BudgetCategoryLimit = {
  id: number
  budget_id: number
  category_id: number
  monthly_limit: number
  category_name: string
  category_color: string
  category_icon: string
}

// Dépenses par catégorie sur la période courante
export type CategorySpending = {
  category_id: number | null
  category_name: string
  category_color: string
  category_icon: string
  spent: number
  revenue: number
  monthly_limit: number | null
}

export type CategorySpendingResult = {
  period_start: string
  period_end: string
  categories: CategorySpending[]
}

// Données mensuelles pour le graphique d'évolution
export type BudgetMonthlyData = {
  month:            string   // YYYY-MM
  month_label:      string   // ex: "Jan", "Fév"
  planned:          number   // dépenses planifiées / mois (abonnements + enveloppes)
  actual:           number   // dépenses réelles ce mois
  revenue_received: number   // revenus réels ce mois
  is_future:        boolean  // mois pas encore commencé
}

// Pour le widget home
export type BudgetWidgetData = {
  budget_id: number
  budget_name: string
  currency: string
  display_currency: string | null
  display_rate: number | null
  period_spent: number
  period_goal: number
  critical_threshold: number
  total_remaining: number
  display_remaining: number | null
  period_start: string
  period_end: string
  over_critical: boolean
}
