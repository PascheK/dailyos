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
